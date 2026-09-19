-- External Calc C01 Review Result Persistence V0.
-- Persiste o C01 final e HumanReview produzidos pelo Core.
-- Nao recalcula fingerprint, revision ou materialidade.

create or replace function public.extcalc_persist_review_result_v0(p_reviewed jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  if v_papel is distinct from 'dono' then
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
  v_original_revision := nullif(p_reviewed->'review'->>'original_offer_revision', '')::integer;
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

  if v_offer_revision <> v_original_revision + case when v_material_change then 1 else 0 end then
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
end
$$;

comment on function public.extcalc_persist_review_result_v0(jsonb) is
  'Persiste o C01 final e HumanReview ja produzidos pelo Core. Nao calcula fingerprint, revision ou materialidade.';

revoke all on function public.extcalc_persist_review_result_v0(jsonb)
  from public, anon, authenticated;
grant execute on function public.extcalc_persist_review_result_v0(jsonb)
  to authenticated;
