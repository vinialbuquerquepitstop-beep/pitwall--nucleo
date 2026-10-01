-- PITSQUAD Acquisition Input Layer V0
-- CANDIDATE ONLY — do not deploy without approval.

create table if not exists public.pitsquad_acquisition_input (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  acquisition_ref text not null,
  contact_ref text not null,
  campaign_ref text,
  source text,
  occurred_at timestamptz not null default now(),
  status text not null default 'PENDING'
    check (status in ('PENDING','LINKED','CONFLICT','DISCARDED')),
  lead_id uuid references public.lead(id),
  resolution_reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (tenant_id, acquisition_ref, contact_ref)
);

alter table public.pitsquad_acquisition_input enable row level security;

create policy pitsquad_acquisition_input_select
on public.pitsquad_acquisition_input
for select
using (tenant_id = privado.fn_tenant_atual());

create policy pitsquad_acquisition_input_insert
on public.pitsquad_acquisition_input
for insert
with check (tenant_id = privado.fn_tenant_atual());

create policy pitsquad_acquisition_input_update
on public.pitsquad_acquisition_input
for update
using (tenant_id = privado.fn_tenant_atual())
with check (tenant_id = privado.fn_tenant_atual());

create or replace function public.pitsquad_capture_acquisition_input_v0(
  p_whatsapp text,
  p_acquisition_ref text,
  p_campaign_ref text default null,
  p_source text default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
set search_path to 'public', 'privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_digitos text;
  v_row public.pitsquad_acquisition_input%rowtype;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'state', 'INVALID', 'reason', 'NO_TENANT');
  end if;

  if nullif(trim(coalesce(p_acquisition_ref,'')), '') is null then
    return jsonb_build_object('ok', false, 'state', 'INVALID', 'reason', 'MISSING_ACQUISITION_REF');
  end if;

  v_digitos := regexp_replace(coalesce(p_whatsapp,''), '\\D', '', 'g');
  if length(v_digitos) in (10,11) then
    v_digitos := '55' || v_digitos;
  end if;

  if v_digitos !~ '^[0-9]{10,15}$' then
    return jsonb_build_object('ok', false, 'state', 'INVALID', 'reason', 'INVALID_WHATSAPP');
  end if;

  insert into public.pitsquad_acquisition_input (
    tenant_id, acquisition_ref, contact_ref,
    campaign_ref, source, occurred_at
  )
  values (
    v_tenant,
    trim(p_acquisition_ref),
    v_digitos,
    nullif(trim(coalesce(p_campaign_ref,'')), ''),
    nullif(trim(coalesce(p_source,'')), ''),
    coalesce(p_occurred_at, now())
  )
  on conflict (tenant_id, acquisition_ref, contact_ref)
  do update set
    campaign_ref = coalesce(public.pitsquad_acquisition_input.campaign_ref, excluded.campaign_ref),
    source = coalesce(public.pitsquad_acquisition_input.source, excluded.source)
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'state', v_row.status,
    'input_id', v_row.id,
    'acquisition_ref', v_row.acquisition_ref,
    'contact_ref', v_row.contact_ref,
    'lead_id', v_row.lead_id
  );
end;
$function$;

create or replace function public.pitsquad_resolve_acquisition_input_v0(
  p_input_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public', 'privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_input public.pitsquad_acquisition_input%rowtype;
  v_lead public.lead%rowtype;
  v_count integer;
begin
  select *
    into v_input
    from public.pitsquad_acquisition_input
   where id = p_input_id
     and tenant_id = v_tenant
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'state', 'INVALID', 'reason', 'INPUT_NOT_FOUND');
  end if;

  if v_input.status = 'LINKED' then
    return jsonb_build_object('ok', true, 'state', 'LINKED', 'lead_id', v_input.lead_id);
  end if;

  select count(*)
    into v_count
    from public.lead
   where tenant_id = v_tenant
     and arquivado_em is null
     and whatsapp_digitos is not null
     and right(whatsapp_digitos,11) = right(v_input.contact_ref,11);

  if v_count = 0 then
    return jsonb_build_object('ok', true, 'state', 'PENDING', 'input_id', v_input.id);
  end if;

  if v_count > 1 then
    update public.pitsquad_acquisition_input
       set status='CONFLICT',
           resolution_reason='MULTIPLE_LEADS',
           resolved_at=now()
     where id=v_input.id;

    return jsonb_build_object('ok', false, 'state', 'CONFLICT', 'reason', 'MULTIPLE_LEADS');
  end if;

  select *
    into v_lead
    from public.lead
   where tenant_id = v_tenant
     and arquivado_em is null
     and whatsapp_digitos is not null
     and right(whatsapp_digitos,11) = right(v_input.contact_ref,11)
   limit 1;

  if v_lead.trafego_ref is not null
     and v_lead.trafego_ref <> v_input.acquisition_ref then
    update public.pitsquad_acquisition_input
       set status='CONFLICT',
           lead_id=v_lead.id,
           resolution_reason='LEAD_ALREADY_ATTRIBUTED',
           resolved_at=now()
     where id=v_input.id;

    return jsonb_build_object(
      'ok', false,
      'state', 'CONFLICT',
      'reason', 'LEAD_ALREADY_ATTRIBUTED',
      'lead_id', v_lead.id
    );
  end if;

  update public.lead
     set trafego_ref = coalesce(trafego_ref, v_input.acquisition_ref),
         trafego_campanha = coalesce(trafego_campanha, v_input.campaign_ref),
         trafego_data_contato = coalesce(trafego_data_contato, v_input.occurred_at),
         atualizado_em = now()
   where id = v_lead.id;

  insert into public.lead_evento (
    tenant_id, lead_id, tipo, detalhe, criado_por
  )
  values (
    v_tenant,
    v_lead.id,
    'nota',
    'Pitsquad attribution: ' || v_input.acquisition_ref
      || case when v_input.campaign_ref is not null
              then ' · ' || v_input.campaign_ref else '' end,
    auth.uid()
  );

  update public.pitsquad_acquisition_input
     set status='LINKED',
         lead_id=v_lead.id,
         resolution_reason=null,
         resolved_at=now()
   where id=v_input.id;

  return jsonb_build_object(
    'ok', true,
    'state', 'LINKED',
    'input_id', v_input.id,
    'lead_id', v_lead.id,
    'lead_code', v_lead.lead_code
  );
end;
$function$;


-- ---------------------------------------------------------------------------
-- Integration Slice V0 — operator queue + discard + result reconciliation
-- ---------------------------------------------------------------------------

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
  where tenant_id=v_tenant
    and status <> 'DISCARDED';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', x.id,
      'acquisition_ref', x.acquisition_ref,
      'campaign_ref', x.campaign_ref,
      'source', x.source,
      'contact_ref', x.contact_ref,
      'occurred_at', x.occurred_at,
      'status', x.status,
      'lead_id', x.lead_id,
      'lead_code', l.lead_code,
      'lead_nome', l.nome,
      'resolution_reason', x.resolution_reason
    )
    order by
      case x.status when 'CONFLICT' then 0 when 'PENDING' then 1 else 2 end,
      x.occurred_at desc
  ), '[]'::jsonb)
  into v_items
  from public.pitsquad_acquisition_input x
  left join public.lead l
    on l.id=x.lead_id and l.tenant_id=x.tenant_id
  where x.tenant_id=v_tenant
    and x.status <> 'DISCARDED';

  return jsonb_build_object(
    'ok', true,
    'counts', coalesce(v_counts, jsonb_build_object('pending',0,'conflict',0,'linked',0)),
    'items', v_items
  );
end;
$function$;

create or replace function public.pitsquad_discard_acquisition_input_v0(
  p_input_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
set search_path to 'public', 'privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_row public.pitsquad_acquisition_input%rowtype;
begin
  select * into v_row
  from public.pitsquad_acquisition_input
  where id=p_input_id and tenant_id=v_tenant
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'state', 'INVALID', 'reason', 'INPUT_NOT_FOUND');
  end if;

  if v_row.status='LINKED' then
    return jsonb_build_object('ok', false, 'state', 'LINKED', 'reason', 'LINKED_INPUT_CANNOT_BE_DISCARDED');
  end if;

  update public.pitsquad_acquisition_input
     set status='DISCARDED',
         resolution_reason=coalesce(nullif(trim(coalesce(p_reason,'')),''),'OPERATOR_DISCARDED'),
         resolved_at=now()
   where id=v_row.id;

  return jsonb_build_object('ok', true, 'state', 'DISCARDED', 'input_id', v_row.id);
end;
$function$;

create or replace function public.pitsquad_reconcile_result_v0(
  p_input_id uuid
)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_input public.pitsquad_acquisition_input%rowtype;
  v_sales jsonb;
  v_count integer;
  v_revenue numeric;
  v_gross numeric;
begin
  select * into v_input
  from public.pitsquad_acquisition_input
  where id=p_input_id and tenant_id=v_tenant;

  if not found then
    return jsonb_build_object('ok', false, 'state', 'INVALID', 'reason', 'INPUT_NOT_FOUND');
  end if;

  if v_input.status <> 'LINKED' or v_input.lead_id is null then
    return jsonb_build_object(
      'ok', true,
      'state', 'NO_LINKED_LEAD',
      'input_id', v_input.id,
      'acquisition_ref', v_input.acquisition_ref
    );
  end if;

  select
    count(*)::int,
    coalesce(sum(v.valor_venda),0),
    coalesce(sum(
      v.valor_venda
      - coalesce(v.custo_aparelho,0)
      - coalesce(v.despesa_frete,0)
      - coalesce(v.despesa_taxas,0)
    ),0),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'venda_id', v.id,
        'venda_code', v.venda_code,
        'status', v.status,
        'etapa', v.etapa,
        'data_venda', v.data_venda,
        'valor_venda', v.valor_venda,
        'custo_aparelho', v.custo_aparelho,
        'despesa_frete', v.despesa_frete,
        'despesa_taxas', v.despesa_taxas,
        'resultado_bruto_observado',
          v.valor_venda
          - coalesce(v.custo_aparelho,0)
          - coalesce(v.despesa_frete,0)
          - coalesce(v.despesa_taxas,0)
      )
      order by v.data_venda nulls last, v.criado_em
    ), '[]'::jsonb)
  into v_count, v_revenue, v_gross, v_sales
  from public.venda v
  where v.tenant_id=v_tenant
    and v.lead_id=v_input.lead_id
    and v.arquivado_em is null
    and coalesce(v.status,'') <> 'cancelada';

  return jsonb_build_object(
    'ok', true,
    'state', case when v_count>0 then 'SALE_OBSERVED' else 'NO_SALE_OBSERVED' end,
    'input_id', v_input.id,
    'acquisition_ref', v_input.acquisition_ref,
    'lead_id', v_input.lead_id,
    'sales_count', v_count,
    'revenue_observed', v_revenue,
    'gross_result_observed', v_gross,
    'sales', v_sales
  );
end;
$function$;
