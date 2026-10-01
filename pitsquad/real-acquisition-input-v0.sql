-- PITSQUAD Real Acquisition Input V0
-- Candidate: public tracked lead capture without exposing CRM writes.

create table if not exists public.pitsquad_acquisition_action (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  acquisition_ref text not null,
  public_token uuid not null default gen_random_uuid(),
  campaign_ref text,
  source text,
  label text,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','PAUSED','CLOSED')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (tenant_id, acquisition_ref),
  unique (public_token)
);

alter table public.pitsquad_acquisition_action enable row level security;

create policy pitsquad_acquisition_action_select
on public.pitsquad_acquisition_action
for select
using (tenant_id = privado.fn_tenant_atual());

create policy pitsquad_acquisition_action_insert
on public.pitsquad_acquisition_action
for insert
with check (tenant_id = privado.fn_tenant_atual());

create policy pitsquad_acquisition_action_update
on public.pitsquad_acquisition_action
for update
using (tenant_id = privado.fn_tenant_atual())
with check (tenant_id = privado.fn_tenant_atual());

create or replace function public.pitsquad_create_acquisition_action_v0(
  p_acquisition_ref text,
  p_campaign_ref text default null,
  p_source text default null,
  p_label text default null
)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_row public.pitsquad_acquisition_action%rowtype;
begin
  if v_tenant is null then
    return jsonb_build_object('ok',false,'state','INVALID','reason','NO_TENANT');
  end if;

  if nullif(trim(coalesce(p_acquisition_ref,'')),'') is null then
    return jsonb_build_object('ok',false,'state','INVALID','reason','MISSING_ACQUISITION_REF');
  end if;

  insert into public.pitsquad_acquisition_action(
    tenant_id,acquisition_ref,campaign_ref,source,label
  )
  values(
    v_tenant,
    trim(p_acquisition_ref),
    nullif(trim(coalesce(p_campaign_ref,'')),''),
    nullif(trim(coalesce(p_source,'')),''),
    nullif(trim(coalesce(p_label,'')),'')
  )
  on conflict (tenant_id,acquisition_ref)
  do update set
    campaign_ref=coalesce(public.pitsquad_acquisition_action.campaign_ref,excluded.campaign_ref),
    source=coalesce(public.pitsquad_acquisition_action.source,excluded.source),
    label=coalesce(public.pitsquad_acquisition_action.label,excluded.label)
  returning * into v_row;

  return jsonb_build_object(
    'ok',true,
    'state',v_row.status,
    'action_id',v_row.id,
    'acquisition_ref',v_row.acquisition_ref,
    'public_token',v_row.public_token,
    'campaign_ref',v_row.campaign_ref,
    'source',v_row.source,
    'label',v_row.label
  );
end;
$function$;

create or replace function public.pitsquad_list_acquisition_actions_v0()
returns jsonb
language plpgsql
stable
set search_path to 'public','privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_items jsonb;
begin
  if v_tenant is null then
    return jsonb_build_object('ok',false,'state','INVALID','reason','NO_TENANT');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'action_id',a.id,
    'acquisition_ref',a.acquisition_ref,
    'public_token',a.public_token,
    'campaign_ref',a.campaign_ref,
    'source',a.source,
    'label',a.label,
    'status',a.status,
    'created_at',a.created_at,
    'inputs',(
      select count(*)
      from public.pitsquad_acquisition_input i
      where i.tenant_id=a.tenant_id and i.acquisition_ref=a.acquisition_ref
    )
  ) order by a.created_at desc),'[]'::jsonb)
  into v_items
  from public.pitsquad_acquisition_action a
  where a.tenant_id=v_tenant;

  return jsonb_build_object('ok',true,'items',v_items);
end;
$function$;

create or replace function public.pitsquad_public_acquisition_action_v0(
  p_token uuid
)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  select case
    when a.id is null then jsonb_build_object('ok',false,'state','NOT_FOUND')
    else jsonb_build_object(
      'ok',true,
      'state',a.status,
      'label',a.label,
      'source',a.source
    )
  end
  from (select 1) seed
  left join public.pitsquad_acquisition_action a
    on a.public_token=p_token
   and a.status='ACTIVE'
  limit 1
$function$;

create or replace function public.pitsquad_public_capture_acquisition_v0(
  p_token uuid,
  p_whatsapp text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_action public.pitsquad_acquisition_action%rowtype;
  v_digitos text;
  v_row public.pitsquad_acquisition_input%rowtype;
  v_recent_count integer;
begin
  select * into v_action
  from public.pitsquad_acquisition_action
  where public_token=p_token
    and status='ACTIVE';

  if not found then
    return jsonb_build_object('ok',false,'state','INVALID','reason','ACTION_NOT_ACTIVE');
  end if;

  v_digitos := regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g');
  if length(v_digitos) in (10,11) then
    v_digitos := '55' || v_digitos;
  end if;

  if v_digitos !~ '^[0-9]{10,15}$' then
    return jsonb_build_object('ok',false,'state','INVALID','reason','INVALID_WHATSAPP');
  end if;

  select count(*)
    into v_recent_count
    from public.pitsquad_acquisition_input i
   where i.tenant_id=v_action.tenant_id
     and i.acquisition_ref=v_action.acquisition_ref
     and i.occurred_at >= now() - interval '1 minute'
     and i.contact_ref <> v_digitos;

  if v_recent_count >= 30 then
    return jsonb_build_object('ok',false,'state','RATE_LIMITED','reason','ACTION_BURST_LIMIT');
  end if;

  insert into public.pitsquad_acquisition_input(
    tenant_id,acquisition_ref,contact_ref,campaign_ref,source,occurred_at
  )
  values(
    v_action.tenant_id,
    v_action.acquisition_ref,
    v_digitos,
    v_action.campaign_ref,
    v_action.source,
    now()
  )
  on conflict (tenant_id,acquisition_ref,contact_ref)
  do update set
    campaign_ref=coalesce(public.pitsquad_acquisition_input.campaign_ref,excluded.campaign_ref),
    source=coalesce(public.pitsquad_acquisition_input.source,excluded.source)
  returning * into v_row;

  return jsonb_build_object(
    'ok',true,
    'state',v_row.status,
    'input_id',v_row.id
  );
end;
$function$;

revoke all on function public.pitsquad_public_acquisition_action_v0(uuid) from public;
revoke all on function public.pitsquad_public_capture_acquisition_v0(uuid,text) from public;

grant execute on function public.pitsquad_public_acquisition_action_v0(uuid) to anon, authenticated;
grant execute on function public.pitsquad_public_capture_acquisition_v0(uuid,text) to anon, authenticated;
