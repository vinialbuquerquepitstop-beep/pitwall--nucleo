-- External Calc Beta Store Team Access V0.
-- Papel validador = acesso privilegiado temporario de beta dentro do proprio tenant.
-- Vendedor de producao continua sem acesso aos dados internos do External Calc.
-- Nao altera C01-C05.

alter table public.app_usuario
  drop constraint if exists app_usuario_papel_check;

alter table public.app_usuario
  add constraint app_usuario_papel_check
  check (papel = any (array['dono'::text, 'vendedor'::text, 'validador'::text]));

create or replace function privado.fn_extcalc_beta_operador_v0()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(privado.fn_papel_atual(), '') in ('dono', 'validador')
$$;

comment on function privado.fn_extcalc_beta_operador_v0() is
  'External Calc Beta V0: dono e validador podem operar; vendedor permanece bloqueado ate seller-safe projection.';

revoke all on function privado.fn_extcalc_beta_operador_v0()
  from public, anon, authenticated;
grant execute on function privado.fn_extcalc_beta_operador_v0()
  to authenticated;

-- Leitura minima exigida pelos adapters atuais.
drop policy if exists calc_dados_sel on public.calc_dados;
create policy calc_dados_sel on public.calc_dados
  for select to authenticated
  using (
    tenant_id = privado.fn_tenant_atual()
    and privado.fn_extcalc_beta_operador_v0()
  );

drop policy if exists extcalc_execution_sel on public.extcalc_execution;
create policy extcalc_execution_sel on public.extcalc_execution
  for select to authenticated
  using (
    tenant_id = privado.fn_tenant_atual()
    and privado.fn_extcalc_beta_operador_v0()
  );

drop policy if exists extcalc_offer_revision_sel on public.extcalc_offer_revision;
create policy extcalc_offer_revision_sel on public.extcalc_offer_revision
  for select to authenticated
  using (
    tenant_id = privado.fn_tenant_atual()
    and privado.fn_extcalc_beta_operador_v0()
  );

drop policy if exists extcalc_evidence_sel on public.extcalc_evidence;
create policy extcalc_evidence_sel on public.extcalc_evidence
  for select to authenticated
  using (
    tenant_id = privado.fn_tenant_atual()
    and privado.fn_extcalc_beta_operador_v0()
  );

drop policy if exists extcalc_review_candidate_sel on public.extcalc_review_candidate;
create policy extcalc_review_candidate_sel on public.extcalc_review_candidate
  for select to authenticated
  using (
    tenant_id = privado.fn_tenant_atual()
    and privado.fn_extcalc_beta_operador_v0()
  );

create or replace function public.extcalc_persist_execution_v0(p_bundle jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_papel text;

  v_analysis_tenant uuid;
  v_analysis_id text;
  v_analysis_created timestamptz;

  v_offer_tenant uuid;
  v_offer_analysis_id text;
  v_offer_id text;
  v_source_id text;
  v_offer_created timestamptz;

  v_revision_tenant uuid;
  v_revision_analysis_id text;
  v_revision_offer_id text;
  v_offer_revision integer;
  v_c01_contract_version text;
  v_c01_snapshot jsonb;
  v_offer_identity_fingerprint text;
  v_offer_value_fingerprint text;
  v_revision_domain_outcome text;
  v_revision_freshness_status text;
  v_revision_created timestamptz;

  v_execution_id uuid;
  v_execution_tenant uuid;
  v_execution_analysis_id text;
  v_execution_offer_id text;
  v_execution_offer_revision integer;
  v_service_version text;
  v_service_engine_version text;
  v_core_contract_version text;
  v_core_engine_version text;
  v_core_input_fingerprint text;
  v_core_output_fingerprint text;
  v_execution_status text;
  v_execution_freshness_status text;
  v_request_snapshot jsonb;
  v_response_snapshot jsonb;
  v_execution_created timestamptz;

  v_existing_source text;
  v_existing_identity_fp text;
  v_existing_value_fp text;
  v_existing_c01_snapshot jsonb;
  v_existing_output_fp text;
  v_bad integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'EXTCALC_UNAUTHENTICATED';
  end if;

  v_tenant := privado.fn_tenant_atual();
  v_papel := privado.fn_papel_atual();

  if v_tenant is null then
    raise exception using errcode = '42501', message = 'EXTCALC_TENANT_UNAVAILABLE';
  end if;

  if coalesce(v_papel, '') not in ('dono', 'validador') then
    raise exception using errcode = '42501', message = 'EXTCALC_FORBIDDEN';
  end if;

  if p_bundle is null or jsonb_typeof(p_bundle) <> 'object' then
    raise exception 'EXTCALC_BUNDLE_INVALID';
  end if;

  if p_bundle->>'version' is distinct from 'external-calc-persistence-bundle/v0' then
    raise exception 'EXTCALC_BUNDLE_VERSION_INVALID';
  end if;

  select *
  into
    v_analysis_tenant,
    v_analysis_id,
    v_analysis_created
  from pg_catalog.jsonb_to_record(p_bundle->'analysis') as x(
    tenant_id uuid,
    analysis_id text,
    criado_em timestamptz
  );

  select *
  into
    v_offer_tenant,
    v_offer_analysis_id,
    v_offer_id,
    v_source_id,
    v_offer_created
  from pg_catalog.jsonb_to_record(p_bundle->'offer') as x(
    tenant_id uuid,
    analysis_id text,
    offer_id text,
    source_id text,
    criado_em timestamptz
  );

  select *
  into
    v_revision_tenant,
    v_revision_analysis_id,
    v_revision_offer_id,
    v_offer_revision,
    v_c01_contract_version,
    v_c01_snapshot,
    v_offer_identity_fingerprint,
    v_offer_value_fingerprint,
    v_revision_domain_outcome,
    v_revision_freshness_status,
    v_revision_created
  from pg_catalog.jsonb_to_record(p_bundle->'offer_revision') as x(
    tenant_id uuid,
    analysis_id text,
    offer_id text,
    offer_revision integer,
    c01_contract_version text,
    c01_snapshot jsonb,
    offer_identity_fingerprint text,
    offer_value_fingerprint text,
    domain_outcome text,
    freshness_status text,
    criado_em timestamptz
  );

  select *
  into
    v_execution_id,
    v_execution_tenant,
    v_execution_analysis_id,
    v_execution_offer_id,
    v_execution_offer_revision,
    v_service_version,
    v_service_engine_version,
    v_core_contract_version,
    v_core_engine_version,
    v_core_input_fingerprint,
    v_core_output_fingerprint,
    v_execution_status,
    v_execution_freshness_status,
    v_request_snapshot,
    v_response_snapshot,
    v_execution_created
  from pg_catalog.jsonb_to_record(p_bundle->'execution') as x(
    execution_id uuid,
    tenant_id uuid,
    analysis_id text,
    offer_id text,
    offer_revision integer,
    service_version text,
    service_engine_version text,
    core_contract_version text,
    core_engine_version text,
    core_input_fingerprint text,
    core_output_fingerprint text,
    execution_status text,
    freshness_status text,
    request_snapshot jsonb,
    response_snapshot jsonb,
    criado_em timestamptz
  );

  if v_analysis_tenant is distinct from v_tenant
     or v_offer_tenant is distinct from v_tenant
     or v_revision_tenant is distinct from v_tenant
     or v_execution_tenant is distinct from v_tenant then
    raise exception using errcode = '42501', message = 'EXTCALC_TENANT_MISMATCH';
  end if;

  if v_analysis_id is null
     or v_offer_id is null
     or v_execution_id is null
     or v_offer_revision is null then
    raise exception 'EXTCALC_IDENTITY_INCOMPLETE';
  end if;

  if v_offer_analysis_id is distinct from v_analysis_id
     or v_revision_analysis_id is distinct from v_analysis_id
     or v_execution_analysis_id is distinct from v_analysis_id
     or v_revision_offer_id is distinct from v_offer_id
     or v_execution_offer_id is distinct from v_offer_id
     or v_execution_offer_revision is distinct from v_offer_revision then
    raise exception 'EXTCALC_LINEAGE_MISMATCH';
  end if;

  select count(*)
  into v_bad
  from pg_catalog.jsonb_to_recordset(coalesce(p_bundle->'runs','[]'::jsonb)) as r(
    tenant_id uuid,
    execution_id uuid,
    analysis_id text,
    offer_id text,
    offer_revision integer
  )
  where r.tenant_id is distinct from v_tenant
     or r.execution_id is distinct from v_execution_id
     or r.analysis_id is distinct from v_analysis_id
     or r.offer_id is distinct from v_offer_id
     or r.offer_revision is distinct from v_offer_revision;

  if v_bad <> 0 then
    raise exception 'EXTCALC_RUN_LINEAGE_MISMATCH';
  end if;

  select count(*)
  into v_bad
  from pg_catalog.jsonb_to_recordset(coalesce(p_bundle->'evidence','[]'::jsonb)) as e(
    tenant_id uuid,
    execution_id uuid,
    analysis_id text,
    offer_id text,
    offer_revision integer
  )
  where e.tenant_id is distinct from v_tenant
     or e.execution_id is distinct from v_execution_id
     or e.analysis_id is distinct from v_analysis_id
     or e.offer_id is distinct from v_offer_id
     or e.offer_revision is distinct from v_offer_revision;

  if v_bad <> 0 then
    raise exception 'EXTCALC_EVIDENCE_LINEAGE_MISMATCH';
  end if;

  if p_bundle->'human_review' is not null
     and p_bundle->'human_review' <> 'null'::jsonb then
    select count(*)
    into v_bad
    from pg_catalog.jsonb_to_record(p_bundle->'human_review') as h(
      tenant_id uuid,
      analysis_id text,
      offer_id text,
      offer_revision integer
    )
    where h.tenant_id is distinct from v_tenant
       or h.analysis_id is distinct from v_analysis_id
       or h.offer_id is distinct from v_offer_id
       or h.offer_revision is distinct from v_offer_revision;

    if v_bad <> 0 then
      raise exception 'EXTCALC_REVIEW_LINEAGE_MISMATCH';
    end if;
  end if;

  select core_output_fingerprint
  into v_existing_output_fp
  from public.extcalc_execution
  where tenant_id = v_tenant
    and execution_id = v_execution_id;

  if found then
    if v_existing_output_fp is distinct from v_core_output_fingerprint then
      raise exception 'EXTCALC_EXECUTION_ID_CONFLICT';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'execution_id', v_execution_id,
      'idempotent', true
    );
  end if;

  insert into public.extcalc_analysis (
    tenant_id, analysis_id, criado_em
  ) values (
    v_tenant, v_analysis_id, v_analysis_created
  )
  on conflict (tenant_id, analysis_id) do nothing;

  insert into public.extcalc_offer (
    tenant_id, analysis_id, offer_id, source_id, criado_em
  ) values (
    v_tenant, v_analysis_id, v_offer_id, v_source_id, v_offer_created
  )
  on conflict (tenant_id, analysis_id, offer_id) do nothing;

  select source_id
  into v_existing_source
  from public.extcalc_offer
  where tenant_id = v_tenant
    and analysis_id = v_analysis_id
    and offer_id = v_offer_id;

  if v_existing_source is distinct from v_source_id then
    raise exception 'EXTCALC_OFFER_ID_CONFLICT';
  end if;

  insert into public.extcalc_offer_revision (
    tenant_id,
    analysis_id,
    offer_id,
    offer_revision,
    c01_contract_version,
    c01_snapshot,
    offer_identity_fingerprint,
    offer_value_fingerprint,
    domain_outcome,
    freshness_status,
    criado_em
  ) values (
    v_tenant,
    v_analysis_id,
    v_offer_id,
    v_offer_revision,
    v_c01_contract_version,
    v_c01_snapshot,
    v_offer_identity_fingerprint,
    v_offer_value_fingerprint,
    v_revision_domain_outcome,
    v_revision_freshness_status,
    v_revision_created
  )
  on conflict (tenant_id, analysis_id, offer_id, offer_revision) do nothing;

  select
    offer_identity_fingerprint,
    offer_value_fingerprint,
    c01_snapshot
  into
    v_existing_identity_fp,
    v_existing_value_fp,
    v_existing_c01_snapshot
  from public.extcalc_offer_revision
  where tenant_id = v_tenant
    and analysis_id = v_analysis_id
    and offer_id = v_offer_id
    and offer_revision = v_offer_revision;

  if v_existing_identity_fp is distinct from v_offer_identity_fingerprint
     or v_existing_value_fp is distinct from v_offer_value_fingerprint
     or v_existing_c01_snapshot is distinct from v_c01_snapshot then
    raise exception 'EXTCALC_OFFER_REVISION_CONFLICT';
  end if;

  if p_bundle->'human_review' is not null
     and p_bundle->'human_review' <> 'null'::jsonb then
    insert into public.extcalc_human_review (
      review_id,
      tenant_id,
      analysis_id,
      offer_id,
      offer_revision,
      decision,
      reviewer_ref,
      reviewed_at,
      review_snapshot,
      criado_em
    )
    select
      h.review_id,
      h.tenant_id,
      h.analysis_id,
      h.offer_id,
      h.offer_revision,
      h.decision,
      h.reviewer_ref,
      h.reviewed_at,
      h.review_snapshot,
      h.criado_em
    from pg_catalog.jsonb_to_record(p_bundle->'human_review') as h(
      review_id uuid,
      tenant_id uuid,
      analysis_id text,
      offer_id text,
      offer_revision integer,
      decision text,
      reviewer_ref text,
      reviewed_at timestamptz,
      review_snapshot jsonb,
      criado_em timestamptz
    );
  end if;

  insert into public.extcalc_execution (
    execution_id,
    tenant_id,
    analysis_id,
    offer_id,
    offer_revision,
    service_version,
    service_engine_version,
    core_contract_version,
    core_engine_version,
    core_input_fingerprint,
    core_output_fingerprint,
    execution_status,
    freshness_status,
    request_snapshot,
    response_snapshot,
    criado_em
  ) values (
    v_execution_id,
    v_tenant,
    v_analysis_id,
    v_offer_id,
    v_offer_revision,
    v_service_version,
    v_service_engine_version,
    v_core_contract_version,
    v_core_engine_version,
    v_core_input_fingerprint,
    v_core_output_fingerprint,
    v_execution_status,
    v_execution_freshness_status,
    v_request_snapshot,
    v_response_snapshot,
    v_execution_created
  );

  insert into public.extcalc_run (
    tenant_id,
    execution_id,
    analysis_id,
    offer_id,
    offer_revision,
    contract_id,
    run_id,
    contract_version,
    engine_version,
    stage,
    execution_status,
    domain_outcome,
    freshness_status,
    input_fingerprint,
    output_fingerprint,
    provenance_refs,
    output_snapshot,
    criado_em
  )
  select
    r.tenant_id,
    r.execution_id,
    r.analysis_id,
    r.offer_id,
    r.offer_revision,
    r.contract_id,
    r.run_id,
    r.contract_version,
    r.engine_version,
    r.stage,
    r.execution_status,
    r.domain_outcome,
    r.freshness_status,
    r.input_fingerprint,
    r.output_fingerprint,
    r.provenance_refs,
    r.output_snapshot,
    r.criado_em
  from pg_catalog.jsonb_to_recordset(coalesce(p_bundle->'runs','[]'::jsonb)) as r(
    tenant_id uuid,
    execution_id uuid,
    analysis_id text,
    offer_id text,
    offer_revision integer,
    contract_id text,
    run_id text,
    contract_version text,
    engine_version text,
    stage text,
    execution_status text,
    domain_outcome text,
    freshness_status text,
    input_fingerprint text,
    output_fingerprint text,
    provenance_refs jsonb,
    output_snapshot jsonb,
    criado_em timestamptz
  );

  insert into public.extcalc_evidence (
    tenant_id,
    execution_id,
    analysis_id,
    offer_id,
    offer_revision,
    evidence_id,
    observed_at,
    evidence_snapshot,
    criado_em
  )
  select
    e.tenant_id,
    e.execution_id,
    e.analysis_id,
    e.offer_id,
    e.offer_revision,
    e.evidence_id,
    e.observed_at,
    e.evidence_snapshot,
    e.criado_em
  from pg_catalog.jsonb_to_recordset(coalesce(p_bundle->'evidence','[]'::jsonb)) as e(
    tenant_id uuid,
    execution_id uuid,
    analysis_id text,
    offer_id text,
    offer_revision integer,
    evidence_id text,
    observed_at timestamptz,
    evidence_snapshot jsonb,
    criado_em timestamptz
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'execution_id', v_execution_id,
    'idempotent', false
  );
end
$$;

comment on function public.extcalc_persist_execution_v0(jsonb) is
  'Writer transacional do External Calc Runtime V0. Deriva tenant/papel do JWT, valida lineage e apenas persiste snapshots produzidos pelo Service.';

revoke all on function public.extcalc_persist_execution_v0(jsonb)
  from public, anon, authenticated;

grant execute on function public.extcalc_persist_execution_v0(jsonb)
  to authenticated;

create or replace function public.extcalc_persist_review_candidate_v0(p_candidate jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_papel text;
  v_analysis_id text;
  v_source_id text;
  v_offer_id text;
  v_offer_revision integer;
  v_contract_version text;
  v_identity_fp text;
  v_value_fp text;
  v_interpretation_run_id text;
  v_execution_status text;
  v_domain_outcome text;
  v_freshness_status text;

  v_existing_source text;
  v_existing_snapshot jsonb;
  v_existing_identity_fp text;
  v_existing_value_fp text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'EXTCALC_UNAUTHENTICATED';
  end if;

  v_tenant := privado.fn_tenant_atual();
  v_papel := privado.fn_papel_atual();

  if v_tenant is null then
    raise exception using errcode = '42501', message = 'EXTCALC_TENANT_UNAVAILABLE';
  end if;

  if coalesce(v_papel, '') not in ('dono', 'validador') then
    raise exception using errcode = '42501', message = 'EXTCALC_FORBIDDEN';
  end if;

  if p_candidate is null or jsonb_typeof(p_candidate) <> 'object' then
    raise exception 'EXTCALC_REVIEW_CANDIDATE_INVALID';
  end if;

  v_analysis_id := nullif(pg_catalog.btrim(p_candidate->>'analysis_id'), '');
  v_source_id := nullif(pg_catalog.btrim(p_candidate->>'source_id'), '');
  v_offer_id := nullif(pg_catalog.btrim(p_candidate->>'offer_id'), '');
  v_offer_revision := nullif(p_candidate->>'offer_revision', '')::integer;
  v_contract_version := nullif(pg_catalog.btrim(p_candidate->>'contract_version'), '');
  v_identity_fp := nullif(pg_catalog.btrim(p_candidate->>'offer_identity_fingerprint'), '');
  v_value_fp := nullif(pg_catalog.btrim(p_candidate->>'offer_value_fingerprint'), '');
  v_interpretation_run_id := nullif(pg_catalog.btrim(p_candidate->>'interpretation_run_id'), '');
  v_execution_status := nullif(pg_catalog.btrim(p_candidate->>'execution_status'), '');
  v_domain_outcome := nullif(pg_catalog.btrim(p_candidate->>'domain_outcome'), '');
  v_freshness_status := nullif(pg_catalog.btrim(p_candidate->>'freshness_status'), '');

  if v_analysis_id is null
     or v_source_id is null
     or v_offer_id is null
     or v_offer_revision is null
     or v_offer_revision < 1
     or v_contract_version is null
     or v_identity_fp is null
     or v_value_fp is null
     or v_interpretation_run_id is null then
    raise exception 'EXTCALC_REVIEW_CANDIDATE_IDENTITY_INCOMPLETE';
  end if;

  if v_contract_version is distinct from 'external-calc-c01-readonly/v1'
     or v_execution_status is distinct from 'SUCCEEDED'
     or v_domain_outcome is distinct from 'REVIEW_REQUIRED'
     or v_freshness_status is distinct from 'CURRENT'
     or p_candidate->'reviewed_offer' is distinct from 'null'::jsonb
     or p_candidate->'review' is distinct from 'null'::jsonb then
    raise exception 'EXTCALC_REVIEW_CANDIDATE_STATE_INVALID';
  end if;

  select
    candidate_snapshot,
    offer_identity_fingerprint,
    offer_value_fingerprint
  into
    v_existing_snapshot,
    v_existing_identity_fp,
    v_existing_value_fp
  from public.extcalc_review_candidate
  where tenant_id = v_tenant
    and analysis_id = v_analysis_id
    and offer_id = v_offer_id
    and offer_revision = v_offer_revision;

  if found then
    if v_existing_snapshot is distinct from p_candidate
       or v_existing_identity_fp is distinct from v_identity_fp
       or v_existing_value_fp is distinct from v_value_fp then
      raise exception 'EXTCALC_REVIEW_CANDIDATE_CONFLICT';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'analysis_id', v_analysis_id,
      'offer_id', v_offer_id,
      'offer_revision', v_offer_revision,
      'idempotent', true
    );
  end if;

  insert into public.extcalc_analysis (
    tenant_id,
    analysis_id
  ) values (
    v_tenant,
    v_analysis_id
  )
  on conflict (tenant_id, analysis_id) do nothing;

  insert into public.extcalc_offer (
    tenant_id,
    analysis_id,
    offer_id,
    source_id
  ) values (
    v_tenant,
    v_analysis_id,
    v_offer_id,
    v_source_id
  )
  on conflict (tenant_id, analysis_id, offer_id) do nothing;

  select source_id
  into v_existing_source
  from public.extcalc_offer
  where tenant_id = v_tenant
    and analysis_id = v_analysis_id
    and offer_id = v_offer_id;

  if v_existing_source is distinct from v_source_id then
    raise exception 'EXTCALC_OFFER_ID_CONFLICT';
  end if;

  insert into public.extcalc_review_candidate (
    tenant_id,
    analysis_id,
    offer_id,
    offer_revision,
    c01_contract_version,
    candidate_snapshot,
    offer_identity_fingerprint,
    offer_value_fingerprint,
    interpretation_run_id,
    execution_status,
    domain_outcome,
    freshness_status
  ) values (
    v_tenant,
    v_analysis_id,
    v_offer_id,
    v_offer_revision,
    v_contract_version,
    p_candidate,
    v_identity_fp,
    v_value_fp,
    v_interpretation_run_id,
    v_execution_status,
    v_domain_outcome,
    v_freshness_status
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'analysis_id', v_analysis_id,
    'offer_id', v_offer_id,
    'offer_revision', v_offer_revision,
    'idempotent', false
  );
end
$$;

comment on function public.extcalc_persist_review_candidate_v0(jsonb) is
  'Persiste candidate C01 REVIEW_REQUIRED imutavel. Tenant/papel sao derivados do JWT; a funcao nao calcula nem revisa C01.';

revoke all on function public.extcalc_persist_review_candidate_v0(jsonb)
  from public, anon, authenticated;

grant execute on function public.extcalc_persist_review_candidate_v0(jsonb)
  to authenticated;

create or replace function public.extcalc_persist_review_result_v0(p_reviewed jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $extcalc_review_result$
declare
  v_tenant uuid;
  v_papel text;
  v_actor text;
  v_analysis_id text;
  v_source_id text;
  v_offer_id text;
  v_offer_revision integer;
  v_original_revision integer;
  v_contract_version text;
  v_identity_fp text;
  v_value_fp text;
  v_domain_outcome text;
  v_freshness_status text;
  v_decision text;
  v_reviewer_ref text;
  v_reviewed_at timestamptz;
  v_material_change boolean;
  v_candidate jsonb;
  v_existing_snapshot jsonb;
  v_existing_review jsonb;
  v_review_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'EXTCALC_UNAUTHENTICATED';
  end if;

  v_tenant := privado.fn_tenant_atual();
  v_papel := privado.fn_papel_atual();
  v_actor := auth.uid()::text;

  if v_tenant is null then
    raise exception using errcode = '42501', message = 'EXTCALC_TENANT_UNAVAILABLE';
  end if;
  if coalesce(v_papel, '') not in ('dono', 'validador') then
    raise exception using errcode = '42501', message = 'EXTCALC_FORBIDDEN';
  end if;
  if p_reviewed is null or jsonb_typeof(p_reviewed) <> 'object' then
    raise exception 'EXTCALC_REVIEW_RESULT_INVALID';
  end if;

  v_analysis_id := nullif(pg_catalog.btrim(p_reviewed->>'analysis_id'), '');
  v_source_id := nullif(pg_catalog.btrim(p_reviewed->>'source_id'), '');
  v_offer_id := nullif(pg_catalog.btrim(p_reviewed->>'offer_id'), '');
  v_offer_revision := nullif(p_reviewed->>'offer_revision', '')::integer;
  v_contract_version := nullif(pg_catalog.btrim(p_reviewed->>'contract_version'), '');
  v_identity_fp := nullif(pg_catalog.btrim(p_reviewed->>'offer_identity_fingerprint'), '');
  v_value_fp := nullif(pg_catalog.btrim(p_reviewed->>'offer_value_fingerprint'), '');
  v_domain_outcome := nullif(pg_catalog.btrim(p_reviewed->>'domain_outcome'), '');
  v_freshness_status := nullif(pg_catalog.btrim(p_reviewed->>'freshness_status'), '');
  v_decision := nullif(pg_catalog.btrim(p_reviewed->'review'->>'decision'), '');
  v_reviewer_ref := nullif(pg_catalog.btrim(p_reviewed->'review'->>'reviewer_ref'), '');
  v_reviewed_at := nullif(p_reviewed->'review'->>'reviewed_at', '')::timestamptz;
  v_original_revision := coalesce(
    nullif(p_reviewed->'review'->>'original_offer_revision', '')::integer,
    nullif(p_reviewed->>'offer_revision', '')::integer
  );
  v_material_change := coalesce((p_reviewed->'review'->>'material_change')::boolean, false);

  if v_analysis_id is null or v_source_id is null or v_offer_id is null
     or v_offer_revision is null or v_original_revision is null
     or v_contract_version is null or v_identity_fp is null or v_value_fp is null
     or v_decision is null or v_reviewer_ref is null or v_reviewed_at is null then
    raise exception 'EXTCALC_REVIEW_RESULT_INCOMPLETE';
  end if;

  if v_contract_version is distinct from 'external-calc-c01-readonly/v1'
     or p_reviewed->>'execution_status' is distinct from 'SUCCEEDED'
     or v_freshness_status is distinct from 'CURRENT'
     or v_reviewer_ref is distinct from v_actor then
    raise exception 'EXTCALC_REVIEW_RESULT_STATE_INVALID';
  end if;

  if v_material_change and v_offer_revision <> v_original_revision + 1 then
    raise exception 'EXTCALC_REVIEW_RESULT_REVISION_INVALID';
  end if;

  if not v_material_change and v_offer_revision <> v_original_revision then
    raise exception 'EXTCALC_REVIEW_RESULT_REVISION_INVALID';
  end if;

  select candidate_snapshot into v_candidate
  from public.extcalc_review_candidate
  where tenant_id = v_tenant
    and analysis_id = v_analysis_id
    and offer_id = v_offer_id
    and offer_revision = v_original_revision;

  if not found then raise exception 'EXTCALC_REVIEW_CANDIDATE_NOT_FOUND'; end if;

  if v_candidate->>'source_id' is distinct from v_source_id
     or v_candidate->>'offer_identity_fingerprint' is null
     or v_candidate->>'offer_value_fingerprint' is null then
    raise exception 'EXTCALC_REVIEW_CANDIDATE_LINEAGE_INVALID';
  end if;

  if v_domain_outcome = 'VALID' then
    if p_reviewed->'reviewed_offer' is null or p_reviewed->'reviewed_offer' = 'null'::jsonb then
      raise exception 'EXTCALC_REVIEW_RESULT_VALID_WITHOUT_OFFER';
    end if;
  elsif v_domain_outcome in ('EXCLUDED','INVALID') then
    if p_reviewed->'reviewed_offer' is distinct from 'null'::jsonb then
      raise exception 'EXTCALC_REVIEW_RESULT_NONVALID_WITH_OFFER';
    end if;
  else
    raise exception 'EXTCALC_REVIEW_RESULT_OUTCOME_INVALID';
  end if;

  select c01_snapshot into v_existing_snapshot
  from public.extcalc_offer_revision
  where tenant_id = v_tenant and analysis_id = v_analysis_id
    and offer_id = v_offer_id and offer_revision = v_offer_revision;

  if found then
    if v_existing_snapshot is distinct from p_reviewed then
      raise exception 'EXTCALC_REVIEW_RESULT_CONFLICT';
    end if;
  else
    insert into public.extcalc_offer_revision (
      tenant_id, analysis_id, offer_id, offer_revision,
      c01_contract_version, c01_snapshot,
      offer_identity_fingerprint, offer_value_fingerprint,
      domain_outcome, freshness_status
    ) values (
      v_tenant, v_analysis_id, v_offer_id, v_offer_revision,
      v_contract_version, p_reviewed,
      v_identity_fp, v_value_fp,
      v_domain_outcome, v_freshness_status
    );
  end if;

  select review_id, review_snapshot into v_review_id, v_existing_review
  from public.extcalc_human_review
  where tenant_id = v_tenant and analysis_id = v_analysis_id
    and offer_id = v_offer_id and offer_revision = v_offer_revision
    and reviewer_ref = v_reviewer_ref and reviewed_at = v_reviewed_at;

  if found then
    if v_existing_review is distinct from p_reviewed->'review' then
      raise exception 'EXTCALC_HUMAN_REVIEW_CONFLICT';
    end if;
  else
    insert into public.extcalc_human_review (
      tenant_id, analysis_id, offer_id, offer_revision,
      decision, reviewer_ref, reviewed_at, review_snapshot
    ) values (
      v_tenant, v_analysis_id, v_offer_id, v_offer_revision,
      v_decision, v_reviewer_ref, v_reviewed_at, p_reviewed->'review'
    ) returning review_id into v_review_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'analysis_id', v_analysis_id,
    'offer_id', v_offer_id,
    'offer_revision', v_offer_revision,
    'review_id', v_review_id
  );
end;
$extcalc_review_result$;

comment on function public.extcalc_persist_review_result_v0(jsonb) is
  'Persiste o C01 final e HumanReview ja produzidos pelo Core. Nao calcula fingerprint, revision ou materialidade.';

revoke all on function public.extcalc_persist_review_result_v0(jsonb)
  from public, anon, authenticated;
grant execute on function public.extcalc_persist_review_result_v0(jsonb)
  to authenticated;

create or replace function public.extcalc_list_pending_review_candidates_v0(
  p_limit integer default 50
)
returns table (
  candidate_snapshot jsonb,
  criado_em timestamptz
)
language plpgsql
security definer
set search_path = ''
as $extcalc_pending_review$
declare
  v_tenant uuid;
  v_papel text;
  v_limit integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'EXTCALC_UNAUTHENTICATED';
  end if;

  v_tenant := privado.fn_tenant_atual();
  v_papel := privado.fn_papel_atual();

  if v_tenant is null then
    raise exception using errcode = '42501', message = 'EXTCALC_TENANT_UNAVAILABLE';
  end if;

  if coalesce(v_papel, '') not in ('dono', 'validador') then
    raise exception using errcode = '42501', message = 'EXTCALC_FORBIDDEN';
  end if;

  v_limit := coalesce(p_limit, 50);
  if v_limit < 1 or v_limit > 100 then
    raise exception 'EXTCALC_REVIEW_QUEUE_LIMIT_INVALID';
  end if;

  return query
  select
    c.candidate_snapshot,
    c.criado_em
  from public.extcalc_review_candidate c
  where c.tenant_id = v_tenant
    and not exists (
      select 1
      from public.extcalc_human_review h
      where h.tenant_id = c.tenant_id
        and h.analysis_id = c.analysis_id
        and h.offer_id = c.offer_id
        and coalesce(
          nullif(h.review_snapshot->>'original_offer_revision', '')::integer,
          h.offer_revision
        ) = c.offer_revision
    )
  order by c.criado_em asc
  limit v_limit;
end;
$extcalc_pending_review$;

comment on function public.extcalc_list_pending_review_candidates_v0(integer) is
  'Lista C01 review candidates sem HumanReview correspondente, preservando o candidate store imutavel.';

revoke all on function public.extcalc_list_pending_review_candidates_v0(integer)
  from public, anon, authenticated;
grant execute on function public.extcalc_list_pending_review_candidates_v0(integer)
  to authenticated;

-- Invariantes:
-- 1. tenant continua derivado do JWT via fn_tenant_atual();
-- 2. vendedor continua fora do beta privilegiado;
-- 3. learning candidates continuam owner-only;
-- 4. app_usuario continua self-readable para o proprio usuario;
-- 5. nenhuma service_role e exposta ao browser.
