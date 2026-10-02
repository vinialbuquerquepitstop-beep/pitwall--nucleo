-- PITSQUAD Acquisition Input Mode V1
-- Distinguishes operational tests from real customer acquisition inputs.

alter table public.pitsquad_acquisition_input
  add column if not exists input_mode text not null default 'REAL';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='pitsquad_acquisition_input_mode_check'
      and conrelid='public.pitsquad_acquisition_input'::regclass
  ) then
    alter table public.pitsquad_acquisition_input
      add constraint pitsquad_acquisition_input_mode_check
      check (input_mode in ('REAL','TEST'));
  end if;
end $$;

drop function if exists public.pitsquad_capture_manual_message_v1(text,text);

create or replace function public.pitsquad_capture_manual_message_v1(
  p_whatsapp text,
  p_message text,
  p_input_mode text default 'REAL'
)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_whatsapp text;
  v_message text := trim(coalesce(p_message,''));
  v_mode text := upper(trim(coalesce(p_input_mode,'REAL')));
  v_ref text;
  v_action public.pitsquad_acquisition_action%rowtype;
  v_input public.pitsquad_acquisition_input%rowtype;
  v_event_id uuid;
  v_event_key text;
begin
  if v_tenant is null then
    return jsonb_build_object('ok',false,'state','INVALID','reason','NO_TENANT');
  end if;

  if v_mode not in ('REAL','TEST') then
    return jsonb_build_object('ok',false,'state','INVALID','reason','INVALID_INPUT_MODE');
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
    tenant_id,acquisition_ref,contact_ref,campaign_ref,source,occurred_at,input_mode
  )
  values(
    v_tenant,v_action.acquisition_ref,v_whatsapp,v_action.campaign_ref,v_action.source,now(),v_mode
  )
  on conflict (tenant_id,acquisition_ref,contact_ref)
  do update set
    campaign_ref=coalesce(public.pitsquad_acquisition_input.campaign_ref,excluded.campaign_ref),
    source=coalesce(public.pitsquad_acquisition_input.source,excluded.source),
    input_mode=excluded.input_mode
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
    where event_key=v_event_key and tenant_id=v_tenant
    limit 1;
  end if;

  return jsonb_build_object(
    'ok',true,'state',v_input.status,'input_id',v_input.id,'event_id',v_event_id,
    'acquisition_ref',v_action.acquisition_ref,'contact_ref',v_whatsapp,
    'campaign_ref',v_action.campaign_ref,'source',v_action.source,
    'input_mode',v_input.input_mode,'lead_id',v_input.lead_id
  );
end;
$function$;

grant execute on function public.pitsquad_capture_manual_message_v1(text,text,text) to authenticated;

create or replace function public.pitsquad_acquisition_queue_v0()
returns jsonb
language plpgsql
stable
set search_path to 'public', 'privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_items jsonb;
  v_counts jsonb;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'msg', 'Sessao invalida');
  end if;

  select jsonb_build_object(
    'pending', count(*) filter (where status='PENDING'),
    'conflict', count(*) filter (where status='CONFLICT'),
    'linked', count(*) filter (where status='LINKED')
  )
  into v_counts
  from public.pitsquad_acquisition_input
  where tenant_id=v_tenant and status <> 'DISCARDED';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', x.id,
      'acquisition_ref', x.acquisition_ref,
      'campaign_ref', x.campaign_ref,
      'source', x.source,
      'input_mode', x.input_mode,
      'contact_ref', x.contact_ref,
      'occurred_at', x.occurred_at,
      'status', x.status,
      'lead_id', x.lead_id,
      'lead_code', l.lead_code,
      'lead_nome', l.nome,
      'resolution_reason', x.resolution_reason
    )
    order by case x.status when 'CONFLICT' then 0 when 'PENDING' then 1 else 2 end, x.occurred_at desc
  ), '[]'::jsonb)
  into v_items
  from public.pitsquad_acquisition_input x
  left join public.lead l on l.id=x.lead_id and l.tenant_id=x.tenant_id
  where x.tenant_id=v_tenant and x.status <> 'DISCARDED';

  return jsonb_build_object(
    'ok', true,
    'counts', coalesce(v_counts,jsonb_build_object('pending',0,'conflict',0,'linked',0)),
    'items', v_items
  );
end;
$function$;
