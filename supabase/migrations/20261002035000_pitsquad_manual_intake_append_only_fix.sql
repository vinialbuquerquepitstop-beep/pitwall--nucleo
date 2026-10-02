-- PITSQUAD Manual Acquisition Intake — append-only conflict fix
-- Avoids UPDATE privilege on the evidence table by reusing duplicate events
-- with ON CONFLICT DO NOTHING + SELECT.

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
  on conflict (event_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id into v_event_id
    from public.pitsquad_manual_message_event
    where event_key=v_event_key
      and tenant_id=v_tenant
    limit 1;
  end if;

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
