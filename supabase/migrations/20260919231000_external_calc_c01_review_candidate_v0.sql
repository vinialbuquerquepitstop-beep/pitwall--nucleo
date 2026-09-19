-- External Calc C01 Review Candidate Persistence V0.
-- Armazena o snapshot imutavel REVIEW_REQUIRED separado do resultado final de review.
-- Nao calcula C01; apenas valida a fronteira e preserva o fato produzido pelo Core.

create table if not exists public.extcalc_review_candidate (
  tenant_id                  uuid not null,
  analysis_id                text not null,
  offer_id                   text not null,
  offer_revision             integer not null check (offer_revision > 0),
  c01_contract_version       text not null,
  candidate_snapshot         jsonb not null check (jsonb_typeof(candidate_snapshot) = 'object'),
  offer_identity_fingerprint text not null,
  offer_value_fingerprint    text not null,
  interpretation_run_id      text not null,
  execution_status           text not null,
  domain_outcome             text not null,
  freshness_status           text not null,
  criado_em                  timestamptz not null default now(),
  primary key (tenant_id, analysis_id, offer_id, offer_revision),
  constraint extcalc_review_candidate_offer_fk
    foreign key (tenant_id, analysis_id, offer_id)
    references public.extcalc_offer (tenant_id, analysis_id, offer_id)
);

comment on table public.extcalc_review_candidate is
  'Snapshot imutavel do C01 REVIEW_REQUIRED antes da revisao humana. Fica separado de extcalc_offer_revision para preservar ACCEPT sem mudanca material na mesma offer_revision.';

create index if not exists extcalc_review_candidate_lookup_ix
  on public.extcalc_review_candidate (tenant_id, analysis_id, offer_id, offer_revision desc);

alter table public.extcalc_review_candidate enable row level security;

drop policy if exists extcalc_review_candidate_sel on public.extcalc_review_candidate;

create policy extcalc_review_candidate_sel on public.extcalc_review_candidate
  for select to authenticated
  using (
    tenant_id = privado.fn_tenant_atual()
    and privado.fn_papel_atual() = 'dono'
  );

revoke all on public.extcalc_review_candidate from anon, authenticated;
grant select on public.extcalc_review_candidate to authenticated;

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

  if v_papel is distinct from 'dono' then
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
