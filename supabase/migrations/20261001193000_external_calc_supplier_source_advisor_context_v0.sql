-- External Calc Supplier Context V0
-- Links an ingested list source to one registered supplier and exposes only
-- the supplier identity + ai_context to the AI Advisor as non-authoritative context.

create table if not exists public.extcalc_source_supplier (
  tenant_id uuid not null,
  source_id text not null,
  supplier_id uuid not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (tenant_id, source_id),
  constraint extcalc_source_supplier_supplier_fk
    foreign key (supplier_id) references public.extcalc_supplier(supplier_id) on delete restrict
);

create index if not exists extcalc_source_supplier_supplier_idx
  on public.extcalc_source_supplier (tenant_id, supplier_id);

alter table public.extcalc_source_supplier enable row level security;

drop policy if exists extcalc_source_supplier_select on public.extcalc_source_supplier;
create policy extcalc_source_supplier_select
on public.extcalc_source_supplier
for select
to authenticated
using (
  tenant_id = privado.fn_tenant_atual()
  and privado.fn_papel_atual() = 'dono'
);

revoke all on public.extcalc_source_supplier from public, anon;
grant select on public.extcalc_source_supplier to authenticated;

create or replace function public.extcalc_bind_source_supplier_v0(
  p_source_id text,
  p_supplier_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_role text;
  v_existing uuid;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='EXTCALC_UNAUTHENTICATED';
  end if;

  v_tenant := privado.fn_tenant_atual();
  v_role := privado.fn_papel_atual();

  if v_tenant is null then
    raise exception using errcode='42501', message='EXTCALC_TENANT_UNAVAILABLE';
  end if;
  if v_role is distinct from 'dono' then
    raise exception using errcode='42501', message='EXTCALC_FORBIDDEN';
  end if;
  if p_source_id is null or length(btrim(p_source_id)) = 0 then
    raise exception 'EXTCALC_SOURCE_ID_REQUIRED';
  end if;
  if p_supplier_id is null then
    raise exception 'EXTCALC_SUPPLIER_ID_REQUIRED';
  end if;

  perform 1
  from public.extcalc_supplier s
  where s.tenant_id = v_tenant
    and s.supplier_id = p_supplier_id;

  if not found then
    raise exception 'EXTCALC_SUPPLIER_NOT_FOUND';
  end if;

  select ss.supplier_id into v_existing
  from public.extcalc_source_supplier ss
  where ss.tenant_id = v_tenant
    and ss.source_id = btrim(p_source_id);

  if found then
    if v_existing is distinct from p_supplier_id then
      raise exception 'EXTCALC_SOURCE_SUPPLIER_CONFLICT';
    end if;
    return jsonb_build_object(
      'ok', true,
      'source_id', btrim(p_source_id),
      'supplier_id', p_supplier_id,
      'idempotent', true
    );
  end if;

  insert into public.extcalc_source_supplier(
    tenant_id, source_id, supplier_id, created_by
  ) values (
    v_tenant, btrim(p_source_id), p_supplier_id, auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'source_id', btrim(p_source_id),
    'supplier_id', p_supplier_id,
    'idempotent', false
  );
end
$$;

revoke all on function public.extcalc_bind_source_supplier_v0(text, uuid)
  from public, anon, authenticated;
grant execute on function public.extcalc_bind_source_supplier_v0(text, uuid)
  to authenticated;

create or replace function public.extcalc_load_ai_advisor_source_v0(p_source_execution_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_papel text;
  v_execution record;
  v_c05 jsonb;
  v_evidence jsonb;
  v_supplier_context jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'EXTCALC_UNAUTHENTICATED';
  end if;

  v_tenant := privado.fn_tenant_atual();
  v_papel := privado.fn_papel_atual();

  if v_tenant is null then
    raise exception using errcode = '42501', message = 'EXTCALC_TENANT_UNAVAILABLE';
  end if;

  if v_papel not in ('dono', 'validador') then
    raise exception using errcode = '42501', message = 'EXTCALC_ADVISOR_FORBIDDEN';
  end if;

  select
    e.execution_id,
    e.tenant_id,
    e.analysis_id,
    e.offer_id,
    e.offer_revision,
    e.execution_status,
    e.freshness_status,
    e.response_snapshot
  into v_execution
  from public.extcalc_execution e
  where e.tenant_id = v_tenant
    and e.execution_id = p_source_execution_id;

  if not found then return null; end if;

  if v_execution.execution_status is distinct from 'SUCCEEDED'
     or v_execution.freshness_status is distinct from 'CURRENT' then
    raise exception 'EXTCALC_ADVISOR_SOURCE_NOT_CURRENT';
  end if;

  v_c05 := v_execution.response_snapshot #> '{outputs,c05}';

  if v_c05 is null
     or pg_catalog.jsonb_typeof(v_c05) is distinct from 'object' then
    raise exception 'EXTCALC_ADVISOR_C05_MISSING';
  end if;

  if v_c05->>'contract_version' is distinct from 'external-calc-c05/v1'
     or v_c05->>'analysis_id' is distinct from v_execution.analysis_id
     or v_c05->>'offer_id' is distinct from v_execution.offer_id
     or (v_c05->>'offer_revision')::integer is distinct from v_execution.offer_revision
     or v_c05->>'execution_status' is distinct from 'SUCCEEDED'
     or v_c05->>'freshness_status' is distinct from 'CURRENT' then
    raise exception 'EXTCALC_ADVISOR_C05_LINEAGE_INVALID';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(ev.evidence_snapshot order by ev.evidence_id),
    '[]'::jsonb
  )
  into v_evidence
  from public.extcalc_evidence ev
  where ev.tenant_id = v_tenant
    and ev.execution_id = p_source_execution_id;

  select jsonb_build_object(
    'supplier_id', s.supplier_id,
    'name', s.name,
    'ai_context', s.ai_context
  )
  into v_supplier_context
  from public.extcalc_offer o
  join public.extcalc_source_supplier ss
    on ss.tenant_id = o.tenant_id
   and ss.source_id = o.source_id
  join public.extcalc_supplier s
    on s.tenant_id = ss.tenant_id
   and s.supplier_id = ss.supplier_id
  where o.tenant_id = v_tenant
    and o.analysis_id = v_execution.analysis_id
    and o.offer_id = v_execution.offer_id
  limit 1;

  return pg_catalog.jsonb_build_object(
    'resource_tenant_id', v_tenant,
    'source_execution_id', v_execution.execution_id,
    'analysis_id', v_execution.analysis_id,
    'offer_id', v_execution.offer_id,
    'offer_revision', v_execution.offer_revision,
    'c05_decision_output', v_c05,
    'evidence_records', v_evidence,
    'supplier_context', v_supplier_context
  );
end
$$;

revoke all on function public.extcalc_load_ai_advisor_source_v0(uuid)
  from public, anon, authenticated;
grant execute on function public.extcalc_load_ai_advisor_source_v0(uuid)
  to authenticated;
