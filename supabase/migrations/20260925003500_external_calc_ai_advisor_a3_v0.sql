-- External Calc AI Advisor A3 — Runtime Loader + Persistence V0.
-- Reuses persisted External Calc execution/evidence as the only operational source.
-- Does not duplicate C01-C05 domain state.
-- Raw extcalc_* RLS remains unchanged.

create table if not exists public.extcalc_ai_advisor_execution (
  advisor_execution_id       uuid primary key,
  tenant_id                  uuid not null,
  source_execution_id        uuid not null,
  analysis_id                text not null,
  offer_id                   text not null,
  offer_revision             integer not null check (offer_revision > 0),
  decision_output_id         text not null,
  execution_contract_version text not null,
  executor_version           text not null,
  capability                 text not null,
  provider_name              text not null,
  model_name                 text not null,
  model_version              text not null,
  adapter_version            text not null,
  prompt_version             text not null,
  context_fingerprint        text not null,
  input_hash                 text,
  source_refs                jsonb not null default '[]'::jsonb check (jsonb_typeof(source_refs) = 'array'),
  requested_at               timestamptz not null,
  completed_at               timestamptz not null,
  execution_status           text not null check (execution_status in ('SUCCEEDED','REJECTED','FAILED','BLOCKED')),
  validator_version          text not null,
  validator_status           text not null,
  candidate_output           jsonb,
  candidate_output_hash      text,
  error                      jsonb,
  envelope_snapshot          jsonb not null check (jsonb_typeof(envelope_snapshot) = 'object'),
  actor_id                   uuid not null,
  criado_em                  timestamptz not null default now(),
  constraint extcalc_ai_advisor_execution_source_fk
    foreign key (tenant_id, source_execution_id)
    references public.extcalc_execution (tenant_id, execution_id),
  constraint extcalc_ai_advisor_execution_tenant_id_uk
    unique (tenant_id, advisor_execution_id)
);

comment on table public.extcalc_ai_advisor_execution is
  'Append-only audit envelope for AI Advisor executions. C01-C05 stay authoritative in existing External Calc persistence.';

create index if not exists extcalc_ai_advisor_execution_source_ix
  on public.extcalc_ai_advisor_execution (
    tenant_id,
    source_execution_id,
    criado_em desc
  );

alter table public.extcalc_ai_advisor_execution enable row level security;

drop policy if exists extcalc_ai_advisor_execution_sel
  on public.extcalc_ai_advisor_execution;

create policy extcalc_ai_advisor_execution_sel
  on public.extcalc_ai_advisor_execution
  for select
  to authenticated
  using (
    tenant_id = privado.fn_tenant_atual()
    and privado.fn_papel_atual() = 'dono'
  );

revoke all on public.extcalc_ai_advisor_execution
  from anon, authenticated;

grant select on public.extcalc_ai_advisor_execution
  to authenticated;

create or replace function public.extcalc_load_ai_advisor_source_v0(
  p_source_execution_id uuid
)
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

  if not found then
    return null;
  end if;

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

  return pg_catalog.jsonb_build_object(
    'resource_tenant_id', v_tenant,
    'source_execution_id', v_execution.execution_id,
    'analysis_id', v_execution.analysis_id,
    'offer_id', v_execution.offer_id,
    'offer_revision', v_execution.offer_revision,
    'c05_decision_output', v_c05,
    'evidence_records', v_evidence
  );
end
$$;

comment on function public.extcalc_load_ai_advisor_source_v0(uuid) is
  'Loads only the persisted CURRENT C05 plus evidence snapshots required to build AI Advisor A1 context. Tenant and role come from JWT.';

revoke all on function public.extcalc_load_ai_advisor_source_v0(uuid)
  from public, anon, authenticated;

grant execute on function public.extcalc_load_ai_advisor_source_v0(uuid)
  to authenticated;

create or replace function public.extcalc_persist_ai_advisor_execution_v0(
  p_source_execution_id uuid,
  p_advisor_execution_id uuid,
  p_envelope jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_papel text;
  v_source record;
  v_existing jsonb;
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

  if p_envelope is null
     or pg_catalog.jsonb_typeof(p_envelope) is distinct from 'object' then
    raise exception 'EXTCALC_ADVISOR_ENVELOPE_INVALID';
  end if;

  select
    e.execution_id,
    e.analysis_id,
    e.offer_id,
    e.offer_revision
  into v_source
  from public.extcalc_execution e
  where e.tenant_id = v_tenant
    and e.execution_id = p_source_execution_id;

  if not found then
    raise exception 'EXTCALC_ADVISOR_SOURCE_NOT_FOUND';
  end if;

  if p_envelope->>'execution_contract_version'
       is distinct from 'external-calc-ai-advisor-execution/v0'
     or p_envelope->>'execution_id'
       is distinct from p_advisor_execution_id::text
     or p_envelope->>'analysis_id'
       is distinct from v_source.analysis_id
     or p_envelope->>'offer_id'
       is distinct from v_source.offer_id
     or (p_envelope->>'offer_revision')::integer
       is distinct from v_source.offer_revision
     or p_envelope->>'capability'
       is distinct from 'EXTERNAL_CALC_ADVISOR_INSIGHTS' then
    raise exception 'EXTCALC_ADVISOR_ENVELOPE_LINEAGE_INVALID';
  end if;

  select a.envelope_snapshot
  into v_existing
  from public.extcalc_ai_advisor_execution a
  where a.tenant_id = v_tenant
    and a.advisor_execution_id = p_advisor_execution_id;

  if found then
    if v_existing is distinct from p_envelope then
      raise exception 'EXTCALC_ADVISOR_EXECUTION_ID_CONFLICT';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'advisor_execution_id', p_advisor_execution_id,
      'idempotent', true
    );
  end if;

  insert into public.extcalc_ai_advisor_execution (
    advisor_execution_id,
    tenant_id,
    source_execution_id,
    analysis_id,
    offer_id,
    offer_revision,
    decision_output_id,
    execution_contract_version,
    executor_version,
    capability,
    provider_name,
    model_name,
    model_version,
    adapter_version,
    prompt_version,
    context_fingerprint,
    input_hash,
    source_refs,
    requested_at,
    completed_at,
    execution_status,
    validator_version,
    validator_status,
    candidate_output,
    candidate_output_hash,
    error,
    envelope_snapshot,
    actor_id
  ) values (
    p_advisor_execution_id,
    v_tenant,
    p_source_execution_id,
    v_source.analysis_id,
    v_source.offer_id,
    v_source.offer_revision,
    p_envelope->>'decision_output_id',
    p_envelope->>'execution_contract_version',
    p_envelope->>'executor_version',
    p_envelope->>'capability',
    p_envelope->>'provider_name',
    p_envelope->>'model_name',
    p_envelope->>'model_version',
    p_envelope->>'adapter_version',
    p_envelope->>'prompt_version',
    p_envelope->>'context_fingerprint',
    nullif(p_envelope->>'input_hash',''),
    coalesce(p_envelope->'source_refs','[]'::jsonb),
    (p_envelope->>'requested_at')::timestamptz,
    (p_envelope->>'completed_at')::timestamptz,
    p_envelope->>'execution_status',
    p_envelope->>'validator_version',
    p_envelope->>'validator_status',
    p_envelope->'candidate_output',
    nullif(p_envelope->>'candidate_output_hash',''),
    p_envelope->'error',
    p_envelope,
    auth.uid()
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'advisor_execution_id', p_advisor_execution_id,
    'idempotent', false
  );
end
$$;

comment on function public.extcalc_persist_ai_advisor_execution_v0(uuid, uuid, jsonb) is
  'Persists only the AI Advisor execution envelope with JWT-derived tenant/actor and source-execution lineage checks.';

revoke all on function public.extcalc_persist_ai_advisor_execution_v0(uuid, uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.extcalc_persist_ai_advisor_execution_v0(uuid, uuid, jsonb)
  to authenticated;
