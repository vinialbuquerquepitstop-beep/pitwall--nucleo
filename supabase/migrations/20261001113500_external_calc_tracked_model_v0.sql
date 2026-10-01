-- External Calc — Tracked Model / Price History V0
create table if not exists public.extcalc_tracked_model (
  tracked_model_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  model_id text not null,
  capacity_gb integer,
  condition text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  active boolean not null default true,
  check (capacity_gb is null or capacity_gb > 0)
);
create unique index if not exists extcalc_tracked_model_active_uq on public.extcalc_tracked_model(tenant_id,model_id,coalesce(capacity_gb,-1),coalesce(lower(condition),'')) where active;

create table if not exists public.extcalc_price_snapshot (
  snapshot_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  tracked_model_id uuid not null references public.extcalc_tracked_model(tracked_model_id),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency='BRL'),
  analysis_id text not null,
  offer_id text not null,
  offer_revision integer not null check (offer_revision > 0),
  offer_value_fingerprint text not null,
  supplier_id text,
  observed_at timestamptz not null default now()
);
create unique index if not exists extcalc_price_snapshot_source_uq on public.extcalc_price_snapshot(tracked_model_id,offer_id,offer_revision,offer_value_fingerprint);
create index if not exists extcalc_price_snapshot_history_idx on public.extcalc_price_snapshot(tracked_model_id,observed_at desc);

alter table public.extcalc_tracked_model enable row level security;
alter table public.extcalc_price_snapshot enable row level security;
drop policy if exists extcalc_tracked_model_sel on public.extcalc_tracked_model;
create policy extcalc_tracked_model_sel on public.extcalc_tracked_model for select to authenticated using (tenant_id=privado.fn_tenant_atual() and privado.fn_extcalc_beta_operador_v0());
drop policy if exists extcalc_price_snapshot_sel on public.extcalc_price_snapshot;
create policy extcalc_price_snapshot_sel on public.extcalc_price_snapshot for select to authenticated using (tenant_id=privado.fn_tenant_atual() and privado.fn_extcalc_beta_operador_v0());
revoke insert,update,delete on public.extcalc_tracked_model from authenticated,anon;
revoke insert,update,delete on public.extcalc_price_snapshot from authenticated,anon;

create or replace function privado.extcalc_capture_tracked_model_v0(p_tracked_model_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.extcalc_tracked_model%rowtype; r record;
begin
  select * into t from public.extcalc_tracked_model where tracked_model_id=p_tracked_model_id and active;
  if t.tracked_model_id is null then return; end if;
  select o.analysis_id,o.offer_id,o.offer_revision,o.offer_value_fingerprint,
    o.c01_snapshot #>> '{reviewed_offer,supplier_id}' supplier_id,
    (o.c01_snapshot #>> '{reviewed_offer,price,amount_minor}')::bigint amount_minor
  into r
  from public.extcalc_offer_revision o
  where o.tenant_id=t.tenant_id and o.domain_outcome='VALID' and o.freshness_status='CURRENT'
    and o.c01_snapshot->>'execution_status'='SUCCEEDED'
    and o.c01_snapshot #>> '{reviewed_offer,model,id}'=t.model_id
    and (t.capacity_gb is null or o.c01_snapshot #>> '{reviewed_offer,capacity_gb}'=t.capacity_gb::text)
    and (t.condition is null or lower(o.c01_snapshot #>> '{reviewed_offer,condition}')=lower(t.condition))
    and o.c01_snapshot #>> '{reviewed_offer,price,currency}'='BRL'
    and (o.c01_snapshot #>> '{reviewed_offer,price,amount_minor}') ~ '^[0-9]+$'
    and (o.c01_snapshot #>> '{reviewed_offer,price,amount_minor}')::bigint>0
  order by (o.c01_snapshot #>> '{reviewed_offer,price,amount_minor}')::bigint asc,o.criado_em desc limit 1;
  if r.offer_id is null then return; end if;
  insert into public.extcalc_price_snapshot(tenant_id,tracked_model_id,amount_minor,currency,analysis_id,offer_id,offer_revision,offer_value_fingerprint,supplier_id)
  values(t.tenant_id,t.tracked_model_id,r.amount_minor,'BRL',r.analysis_id,r.offer_id,r.offer_revision,r.offer_value_fingerprint,nullif(r.supplier_id,''))
  on conflict do nothing;
end $$;
revoke all on function privado.extcalc_capture_tracked_model_v0(uuid) from public,anon,authenticated;

create or replace function privado.extcalc_offer_revision_track_capture_v0() returns trigger language plpgsql security definer set search_path='' as $$
declare x record;
begin
  for x in select t.tracked_model_id from public.extcalc_tracked_model t where t.tenant_id=new.tenant_id and t.active
    and t.model_id=new.c01_snapshot #>> '{reviewed_offer,model,id}'
    and (t.capacity_gb is null or new.c01_snapshot #>> '{reviewed_offer,capacity_gb}'=t.capacity_gb::text)
    and (t.condition is null or lower(new.c01_snapshot #>> '{reviewed_offer,condition}')=lower(t.condition))
  loop perform privado.extcalc_capture_tracked_model_v0(x.tracked_model_id); end loop;
  return new;
end $$;
drop trigger if exists extcalc_offer_revision_track_capture_v0 on public.extcalc_offer_revision;
create trigger extcalc_offer_revision_track_capture_v0 after insert or update of c01_snapshot,domain_outcome,freshness_status on public.extcalc_offer_revision for each row execute function privado.extcalc_offer_revision_track_capture_v0();

create or replace function public.extcalc_product_track_model_v0(p_model_id text,p_capacity_gb integer default null,p_condition text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare m record; v_id uuid; v_label text;
begin
  select * into m from privado.extcalc_product_membership_v0();
  if m.tenant_id is null then raise exception using errcode='42501',message='EXTCALC_PRODUCT_FORBIDDEN'; end if;
  if nullif(trim(p_model_id),'') is null or (p_capacity_gb is not null and p_capacity_gb<=0) then raise exception using errcode='22023',message='TRACKED_MODEL_INVALID'; end if;
  select coalesce(nullif(r.c01_snapshot #>> '{reviewed_offer,model,label}',''),p_model_id) into v_label
  from public.extcalc_offer_revision r where r.tenant_id=m.tenant_id and r.domain_outcome='VALID' and r.freshness_status='CURRENT'
    and r.c01_snapshot #>> '{reviewed_offer,model,id}'=trim(p_model_id)
    and (p_capacity_gb is null or r.c01_snapshot #>> '{reviewed_offer,capacity_gb}'=p_capacity_gb::text)
  order by r.criado_em desc limit 1;
  if v_label is null then raise exception using errcode='22023',message='TRACKED_MODEL_NOT_FOUND'; end if;
  select t.tracked_model_id into v_id from public.extcalc_tracked_model t where t.tenant_id=m.tenant_id and t.active and t.model_id=trim(p_model_id)
    and coalesce(t.capacity_gb,-1)=coalesce(p_capacity_gb,-1) and coalesce(lower(t.condition),'')=coalesce(lower(nullif(trim(p_condition),'')),'') limit 1;
  if v_id is null then insert into public.extcalc_tracked_model(tenant_id,model_id,capacity_gb,condition,created_by)
    values(m.tenant_id,trim(p_model_id),p_capacity_gb,nullif(trim(p_condition),''),m.actor_id) returning tracked_model_id into v_id; end if;
  perform privado.extcalc_capture_tracked_model_v0(v_id);
  return pg_catalog.jsonb_build_object('tracked_model_id',v_id,'model_id',trim(p_model_id),'label',v_label,'capacity_gb',p_capacity_gb,'condition',nullif(trim(p_condition),''),'active',true);
end $$;

create or replace function public.extcalc_product_untrack_model_v0(p_tracked_model_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m record; v_count integer;
begin
  select * into m from privado.extcalc_product_membership_v0();
  if m.tenant_id is null then raise exception using errcode='42501',message='EXTCALC_PRODUCT_FORBIDDEN'; end if;
  update public.extcalc_tracked_model set active=false where tracked_model_id=p_tracked_model_id and tenant_id=m.tenant_id and active;
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception using errcode='P0002',message='TRACKED_MODEL_NOT_FOUND'; end if;
  return pg_catalog.jsonb_build_object('tracked_model_id',p_tracked_model_id,'active',false);
end $$;

create or replace function public.extcalc_product_tracked_models_v0() returns setof jsonb language plpgsql security definer set search_path='' stable as $$
declare m record;
begin
  select * into m from privado.extcalc_product_membership_v0();
  if m.tenant_id is null then raise exception using errcode='42501',message='EXTCALC_PRODUCT_FORBIDDEN'; end if;
  return query
  select pg_catalog.jsonb_build_object(
    'tracked_model_id',t.tracked_model_id,'model_id',t.model_id,'label',coalesce(cur.label,t.model_id),'capacity_gb',t.capacity_gb,'condition',t.condition,
    'current_price',case when cur.amount_minor is null then null else pg_catalog.jsonb_build_object('amount_minor',cur.amount_minor,'currency','BRL') end,
    'previous_price',case when prev.amount_minor is null then null else pg_catalog.jsonb_build_object('amount_minor',prev.amount_minor,'currency','BRL') end,
    'delta_amount_minor',case when cur.amount_minor is null or prev.amount_minor is null then null else cur.amount_minor-prev.amount_minor end,
    'delta_percent',case when cur.amount_minor is null or prev.amount_minor is null or prev.amount_minor=0 then null else round(((cur.amount_minor-prev.amount_minor)::numeric/prev.amount_minor::numeric)*100,2) end,
    'direction',case when cur.amount_minor is null or prev.amount_minor is null then 'INSUFFICIENT_DATA' when cur.amount_minor<prev.amount_minor then 'DOWN' when cur.amount_minor>prev.amount_minor then 'UP' else 'UNCHANGED' end,
    'supplier_id',cur.supplier_id,'observed_at',cur.observed_at,'history_count',coalesce(hist.cnt,0))
  from public.extcalc_tracked_model t
  left join lateral (
    select s.amount_minor,s.supplier_id,s.observed_at,coalesce(nullif(r.c01_snapshot #>> '{reviewed_offer,model,label}',''),t.model_id) label
    from public.extcalc_price_snapshot s left join public.extcalc_offer_revision r on r.tenant_id=s.tenant_id and r.analysis_id=s.analysis_id and r.offer_id=s.offer_id and r.offer_revision=s.offer_revision
    where s.tracked_model_id=t.tracked_model_id order by s.observed_at desc,s.snapshot_id desc limit 1
  ) cur on true
  left join lateral (select s.amount_minor from public.extcalc_price_snapshot s where s.tracked_model_id=t.tracked_model_id order by s.observed_at desc,s.snapshot_id desc offset 1 limit 1) prev on true
  left join lateral (select count(*)::integer cnt from public.extcalc_price_snapshot s where s.tracked_model_id=t.tracked_model_id) hist on true
  where t.tenant_id=m.tenant_id and t.active order by t.created_at desc;
end $$;

revoke all on function public.extcalc_product_track_model_v0(text,integer,text) from public,anon,authenticated;
revoke all on function public.extcalc_product_untrack_model_v0(uuid) from public,anon,authenticated;
revoke all on function public.extcalc_product_tracked_models_v0() from public,anon,authenticated;
grant execute on function public.extcalc_product_track_model_v0(text,integer,text) to authenticated;
grant execute on function public.extcalc_product_untrack_model_v0(uuid) to authenticated;
grant execute on function public.extcalc_product_tracked_models_v0() to authenticated;
