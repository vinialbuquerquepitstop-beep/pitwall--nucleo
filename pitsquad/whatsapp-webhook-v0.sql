-- PITSQUAD WhatsApp Webhook V0
-- Ingests verified Meta webhook messages into the acquisition layer.
-- Callable only with service_role.

create table if not exists public.pitsquad_whatsapp_message_event (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  message_id text not null unique,
  whatsapp_ref text not null,
  acquisition_ref text,
  input_id uuid references public.pitsquad_acquisition_input(id),
  state text not null
    check (state in ('LINKED_TO_INPUT','NO_TRACKING_REF','ACTION_NOT_FOUND')),
  created_at timestamptz not null default now()
);

alter table public.pitsquad_whatsapp_message_event enable row level security;

create or replace function public.pitsquad_ingest_whatsapp_message_v0(
  p_message_id text,
  p_whatsapp text,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_message_id text := nullif(trim(coalesce(p_message_id,'')),'');
  v_whatsapp text;
  v_text text := coalesce(p_text,'');
  v_ref text;
  v_action public.pitsquad_acquisition_action%rowtype;
  v_input public.pitsquad_acquisition_input%rowtype;
  v_existing public.pitsquad_whatsapp_message_event%rowtype;
begin
  if v_message_id is null then
    return jsonb_build_object('ok',false,'state','INVALID','reason','MISSING_MESSAGE_ID');
  end if;

  select * into v_existing
  from public.pitsquad_whatsapp_message_event
  where message_id=v_message_id;

  if found then
    return jsonb_build_object(
      'ok',true,
      'state',v_existing.state,
      'duplicate',true,
      'input_id',v_existing.input_id,
      'acquisition_ref',v_existing.acquisition_ref
    );
  end if;

  v_whatsapp := regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g');
  if v_whatsapp !~ '^[0-9]{10,15}$' then
    return jsonb_build_object('ok',false,'state','INVALID','reason','INVALID_WHATSAPP');
  end if;

  select (regexp_match(v_text, '\[(PS-AQ-[A-Za-z0-9-]+)\]', 'i'))[1]
    into v_ref;

  if v_ref is null then
    return jsonb_build_object('ok',true,'state','NO_TRACKING_REF');
  end if;

  v_ref := upper(v_ref);

  select * into v_action
  from public.pitsquad_acquisition_action
  where upper(acquisition_ref)=v_ref
    and status='ACTIVE'
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok',true,'state','ACTION_NOT_FOUND','acquisition_ref',v_ref);
  end if;

  insert into public.pitsquad_acquisition_input(
    tenant_id,acquisition_ref,contact_ref,campaign_ref,source,occurred_at
  )
  values(
    v_action.tenant_id,
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

  insert into public.pitsquad_whatsapp_message_event(
    tenant_id,message_id,whatsapp_ref,acquisition_ref,input_id,state
  )
  values(
    v_action.tenant_id,
    v_message_id,
    v_whatsapp,
    v_action.acquisition_ref,
    v_input.id,
    'LINKED_TO_INPUT'
  );

  return jsonb_build_object(
    'ok',true,
    'state','LINKED_TO_INPUT',
    'duplicate',false,
    'input_id',v_input.id,
    'acquisition_ref',v_action.acquisition_ref
  );
end;
$function$;

revoke all on function public.pitsquad_ingest_whatsapp_message_v0(text,text,text) from public;
grant execute on function public.pitsquad_ingest_whatsapp_message_v0(text,text,text) to service_role;
