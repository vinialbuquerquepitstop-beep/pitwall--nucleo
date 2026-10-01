-- External Calc — Tracked Model Customer Association V0
-- Adds lightweight client association without creating a customer master record.

alter table public.extcalc_tracked_model
  add column if not exists customer_name text,
  add column if not exists customer_phone text;

drop index if exists public.extcalc_tracked_model_active_uq;

create unique index if not exists extcalc_tracked_model_active_uq
on public.extcalc_tracked_model(
  tenant_id,
  model_id,
  coalesce(capacity_gb,-1),
  coalesce(lower(condition),''),
  coalesce(lower(customer_phone),'')
)
where active;

create or replace function public.extcalc_product_track_model_v1(
  p_model_id text,
  p_customer_name text,
  p_customer_phone text,
  p_capacity_gb integer default null,
  p_condition text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  m record;
  v_id uuid;
  v_label text;
  v_name text := nullif(trim(p_customer_name),'');
  v_phone text := nullif(trim(p_customer_phone),'');
begin
  select * into m from privado.extcalc_product_membership_v0();
  if m.tenant_id is null then
    raise exception using errcode='42501',message='EXTCALC_PRODUCT_FORBIDDEN';
  end if;

  if nullif(trim(p_model_id),'') is null
    or (p_capacity_gb is not null and p_capacity_gb<=0)
    or v_name is null or length(v_name)>120
    or v_phone is null or length(v_phone)>40
  then
    raise exception using errcode='22023',message='TRACKED_MODEL_INVALID';
  end if;

  select coalesce(nullif(r.c01_snapshot #>> '{reviewed_offer,model,label}',''),p_model_id)
  into v_label
  from public.extcalc_offer_revision r
  where r.tenant_id=m.tenant_id
    and r.domain_outcome='VALID'
    and r.freshness_status='CURRENT'
    and r.c01_snapshot #>> '{reviewed_offer,model,id}'=trim(p_model_id)
    and (p_capacity_gb is null or r.c01_snapshot #>> '{reviewed_offer,capacity_gb}'=p_capacity_gb::text)
  order by r.criado_em desc
  limit 1;

  if v_label is null then
    raise exception using errcode='22023',message='TRACKED_MODEL_NOT_FOUND';
  end if;

  select t.tracked_model_id into v_id
  from public.extcalc_tracked_model t
  where t.tenant_id=m.tenant_id
    and t.active
    and t.model_id=trim(p_model_id)
    and coalesce(t.capacity_gb,-1)=coalesce(p_capacity_gb,-1)
    and coalesce(lower(t.condition),'')=coalesce(lower(nullif(trim(p_condition),'')),'')
    and coalesce(lower(t.customer_phone),'')=lower(v_phone)
  limit 1;

  if v_id is null then
    insert into public.extcalc_tracked_model(
      tenant_id,model_id,capacity_gb,condition,created_by,customer_name,customer_phone
    )
    values(
      m.tenant_id,trim(p_model_id),p_capacity_gb,nullif(trim(p_condition),''),
      m.actor_id,v_name,v_phone
    )
    returning tracked_model_id into v_id;
  else
    update public.extcalc_tracked_model
    set customer_name=v_name
    where tracked_model_id=v_id;
  end if;

  perform privado.extcalc_capture_tracked_model_v0(v_id);

  return pg_catalog.jsonb_build_object(
    'tracked_model_id',v_id,
    'model_id',trim(p_model_id),
    'label',v_label,
    'capacity_gb',p_capacity_gb,
    'condition',nullif(trim(p_condition),''),
    'customer_name',v_name,
    'customer_phone',v_phone,
    'active',true
  );
end;
$$;

revoke all on function public.extcalc_product_track_model_v1(text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.extcalc_product_track_model_v1(text,text,text,integer,text) to authenticated;

create or replace function public.extcalc_product_tracked_models_v0()
returns setof jsonb
language plpgsql
security definer
set search_path=''
stable
as $$
declare m record;
begin
  select * into m from privado.extcalc_product_membership_v0();
  if m.tenant_id is null then
    raise exception using errcode='42501',message='EXTCALC_PRODUCT_FORBIDDEN';
  end if;

  return query
  select pg_catalog.jsonb_build_object(
    'tracked_model_id',t.tracked_model_id,
    'model_id',t.model_id,
    'label',coalesce(cur.label,t.model_id),
    'capacity_gb',t.capacity_gb,
    'condition',t.condition,
    'customer_name',t.customer_name,
    'customer_phone',t.customer_phone,
    'current_price',case when cur.amount_minor is null then null else pg_catalog.jsonb_build_object('amount_minor',cur.amount_minor,'currency','BRL') end,
    'previous_price',case when prev.amount_minor is null then null else pg_catalog.jsonb_build_object('amount_minor',prev.amount_minor,'currency','BRL') end,
    'delta_amount_minor',case when cur.amount_minor is null or prev.amount_minor is null then null else cur.amount_minor-prev.amount_minor end,
    'delta_percent',case when cur.amount_minor is null or prev.amount_minor is null or prev.amount_minor=0 then null else round(((cur.amount_minor-prev.amount_minor)::numeric/prev.amount_minor::numeric)*100,2) end,
    'direction',case when cur.amount_minor is null or prev.amount_minor is null then 'INSUFFICIENT_DATA' when cur.amount_minor<prev.amount_minor then 'DOWN' when cur.amount_minor>prev.amount_minor then 'UP' else 'UNCHANGED' end,
    'supplier_id',cur.supplier_id,
    'observed_at',cur.observed_at,
    'history_count',coalesce(hist.cnt,0)
  )
  from public.extcalc_tracked_model t
  left join lateral (
    select s.amount_minor,s.supplier_id,s.observed_at,
      coalesce(nullif(r.c01_snapshot #>> '{reviewed_offer,model,label}',''),t.model_id) label
    from public.extcalc_price_snapshot s
    left join public.extcalc_offer_revision r
      on r.tenant_id=s.tenant_id
      and r.analysis_id=s.analysis_id
      and r.offer_id=s.offer_id
      and r.offer_revision=s.offer_revision
    where s.tracked_model_id=t.tracked_model_id
    order by s.observed_at desc,s.snapshot_id desc
    limit 1
  ) cur on true
  left join lateral (
    select s.amount_minor
    from public.extcalc_price_snapshot s
    where s.tracked_model_id=t.tracked_model_id
    order by s.observed_at desc,s.snapshot_id desc
    offset 1 limit 1
  ) prev on true
  left join lateral (
    select count(*)::integer cnt
    from public.extcalc_price_snapshot s
    where s.tracked_model_id=t.tracked_model_id
  ) hist on true
  where t.tenant_id=m.tenant_id and t.active
  order by t.created_at desc;
end;
$$;

comment on column public.extcalc_tracked_model.customer_name is 'Lightweight client association for this watch; not a customer master record.';
comment on column public.extcalc_tracked_model.customer_phone is 'Client contact typed at watch creation; no prior customer registration required.';
