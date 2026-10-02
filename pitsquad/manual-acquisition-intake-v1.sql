-- PITSQUAD Manual Acquisition Intake V1
-- Preserves pasted inbound WhatsApp message as acquisition evidence and
-- deterministically creates/reuses AcquisitionInput from the embedded [PS-AQ-...] ref.

create table if not exists public.pitsquad_manual_message_event (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  input_id uuid not null references public.pitsquad_acquisition_input(id),
  whatsapp_ref text not null,
  acquisition_ref text not null,
  message_text text not null check (char_length(message_text) between 1 and 4000),
  event_key text not null unique,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.pitsquad_manual_message_event enable row level security;

drop policy if exists pitsquad_manual_message_event_select on public.pitsquad_manual_message_event;
create policy pitsquad_manual_message_event_select
on public.pitsquad_manual_message_event
for select
using (tenant_id = privado.fn_tenant_atual());

drop policy if exists pitsquad_manual_message_event_insert on public.pitsquad_manual_message_event;
create policy pitsquad_manual_message_event_insert
on public.pitsquad_manual_message_event
for insert
with check (tenant_id = privado.fn_tenant_atual());

create index if not exists pitsquad_manual_message_event_input_idx
  on public.pitsquad_manual_message_event(input_id, created_at desc);

create or replace function public.pitsquad_capture_manual_message_v1(
  p_whatsapp text,
  p_message text
)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_whatsapp text;
  v_message text := trim(coalesce(p_message,''));
  v_ref text;
  v_action public.pitsquad_acquisition_action%rowtype;
  v_input public.pitsquad_acquisition_input%rowtype;
  v_event_id uuid;
  v_event_key text;
begin
  if v_tenant is null then
    return jsonb_build_object('ok',false,'state','INVALID','reason','NO_TENANT');
  end if;

  v_whatsapp := regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g');
  if length(v_whatsapp) in (10,11) then
    v_whatsapp := '55' || v_whatsapp;
  end if;
  if v_whatsapp !~ '^[0-9]{10,15}$' then
    return jsonb_build_object('ok',false,'state','INVALID','reason','INVALID_WHATSAPP');
  end if;

  if v_message = '' or char_length(v_message) > 4000 then
    return jsonb_build_object('ok',false,'state','INVALID','reason','INVALID_MESSAGE');
  end if;

  select (regexp_match(v_message, '\[(PS-AQ-[A-Za-z0-9-]+)\]', 'i'))[1]
    into v_ref;

  if v_ref is null then
    return jsonb_build_object('ok',false,'state','INVALID','reason','MISSING_TRACKING_REF');
  end if;

  v_ref := upper(v_ref);

  select * into v_action
  from public.pitsquad_acquisition_action
  where tenant_id=v_tenant
    and upper(acquisition_ref)=v_ref
    and status='ACTIVE'
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'state','INVALID','reason','ACTION_NOT_FOUND_OR_CLOSED','acquisition_ref',v_ref);
  end if;

  insert into public.pitsquad_acquisition_input(
    tenant_id,acquisition_ref,contact_ref,campaign_ref,source,occurred_at
  )
  values(
    v_tenant,
    v_action.acquisition_ref,
    v_whatsapp,
    v_action.campaign_ref,
    v_action.source,
    now()
  )
  on conflict (tenant_id,acquisition_ref,contact_ref)
  do update set
    campaign_ref=coalesce(public.pitsquad_acquisition_input.campaign_ref,excluded.campaign_ref),
    source=coalesce(public.pitsquad_acquisition_input.source,excluded.source)
  returning * into v_input;

  v_event_key := md5(v_tenant::text || '|' || v_input.id::text || '|' || v_message);

  insert into public.pitsquad_manual_message_event(
    tenant_id,input_id,whatsapp_ref,acquisition_ref,message_text,event_key,created_by
  )
  values(
    v_tenant,v_input.id,v_whatsapp,v_action.acquisition_ref,v_message,v_event_key,auth.uid()
  )
  on conflict (event_key) do update
    set event_key=excluded.event_key
  returning id into v_event_id;

  return jsonb_build_object(
    'ok',true,
    'state',v_input.status,
    'input_id',v_input.id,
    'event_id',v_event_id,
    'acquisition_ref',v_action.acquisition_ref,
    'contact_ref',v_whatsapp,
    'campaign_ref',v_action.campaign_ref,
    'source',v_action.source,
    'lead_id',v_input.lead_id
  );
end;
$function$;

revoke all on function public.pitsquad_capture_manual_message_v1(text,text) from public;
grant execute on function public.pitsquad_capture_manual_message_v1(text,text) to authenticated;
