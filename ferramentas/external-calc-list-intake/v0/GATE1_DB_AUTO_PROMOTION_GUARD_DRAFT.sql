-- DRAFT ONLY. DO NOT DEPLOY TO PRODUCTION. AUTHENTICATED STAGING REQUIRED.
-- Complete function sourced from read-only pg_get_functiondef on 2026-10-20.
-- Matching a candidate snapshot is NOT independent verification of source truth.

CREATE OR REPLACE FUNCTION public.extcalc_persist_auto_promoted_c01_v0(p_promoted jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_existing_source text;
  v_existing jsonb;
  v_candidate jsonb;
  v_bound_supplier uuid;
  v_candidate_source text;
  v_field_name text;
  v_sources jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='EXTCALC_UNAUTHENTICATED';
  end if;

  v_tenant := privado.fn_tenant_atual();
  v_papel := privado.fn_papel_atual();
  if v_tenant is null then raise exception using errcode='42501', message='EXTCALC_TENANT_UNAVAILABLE'; end if;
  if v_papel is distinct from 'dono' then raise exception using errcode='42501', message='EXTCALC_FORBIDDEN'; end if;

  if p_promoted is null or jsonb_typeof(p_promoted) <> 'object' then
    raise exception 'EXTCALC_AUTO_PROMOTION_INVALID';
  end if;

  v_analysis_id := nullif(pg_catalog.btrim(p_promoted->>'analysis_id'),'');
  v_source_id := nullif(pg_catalog.btrim(p_promoted->>'source_id'),'');
  v_offer_id := nullif(pg_catalog.btrim(p_promoted->>'offer_id'),'');
  v_offer_revision := nullif(p_promoted->>'offer_revision','')::integer;
  v_contract_version := nullif(pg_catalog.btrim(p_promoted->>'contract_version'),'');
  v_identity_fp := nullif(pg_catalog.btrim(p_promoted->>'offer_identity_fingerprint'),'');
  v_value_fp := nullif(pg_catalog.btrim(p_promoted->>'offer_value_fingerprint'),'');

  if v_analysis_id is null or v_source_id is null or v_offer_id is null or v_offer_revision is null
     or v_contract_version is null or v_identity_fp is null or v_value_fp is null then
    raise exception 'EXTCALC_AUTO_PROMOTION_INCOMPLETE';
  end if;

  if v_contract_version is distinct from 'external-calc-c01-readonly/v1'
     or p_promoted->>'execution_status' is distinct from 'SUCCEEDED'
     or p_promoted->>'freshness_status' is distinct from 'CURRENT'
     or p_promoted->>'domain_outcome' is distinct from 'VALID'
     or p_promoted->'review' is distinct from 'null'::jsonb
     or p_promoted->'reviewed_offer' is null
     or p_promoted->'reviewed_offer' = 'null'::jsonb
     or p_promoted->'auto_promotion'->>'decision' is distinct from 'AUTO_PROMOTE'
     or p_promoted->'auto_promotion'->>'authority_version' is distinct from 'external-calc-c01-auto-promotion/v0' then
    raise exception 'EXTCALC_AUTO_PROMOTION_STATE_INVALID';
  end if;


  -- Authority: check tenant-bound source and previously persisted review candidate.
  select ss.supplier_id into v_bound_supplier
  from public.extcalc_source_supplier ss
  where ss.tenant_id=v_tenant and ss.source_id=v_source_id;
  if not found then
    raise exception 'EXTCALC_AUTO_PROMOTION_SOURCE_UNBOUND';
  end if;

  select c.candidate_snapshot into v_candidate
  from public.extcalc_review_candidate c
  where c.tenant_id=v_tenant and c.analysis_id=v_analysis_id
    and c.offer_id=v_offer_id and c.offer_revision=v_offer_revision;
  if not found then
    raise exception 'EXTCALC_AUTO_PROMOTION_CANDIDATE_MISSING';
  end if;

  select o.source_id into v_candidate_source
  from public.extcalc_offer o
  where o.tenant_id=v_tenant and o.analysis_id=v_analysis_id and o.offer_id=v_offer_id;
  if v_candidate_source is distinct from v_source_id then
    raise exception 'EXTCALC_AUTO_PROMOTION_SOURCE_CONFLICT';
  end if;

  if v_candidate->>'source_id' is distinct from v_source_id
     or v_candidate->>'analysis_id' is distinct from v_analysis_id
     or v_candidate->>'offer_id' is distinct from v_offer_id
     or (v_candidate->>'offer_revision')::integer is distinct from v_offer_revision
     or v_candidate->>'domain_outcome' is distinct from 'REVIEW_REQUIRED'
     or v_candidate->>'execution_status' is distinct from 'SUCCEEDED'
     or v_candidate->>'freshness_status' is distinct from 'CURRENT'
     or v_candidate->'interpreted_offer' is distinct from p_promoted->'interpreted_offer'
     or v_candidate->'interpreted_offer' is distinct from p_promoted->'reviewed_offer'
     or v_candidate->>'offer_identity_fingerprint' is distinct from v_identity_fp
     or v_candidate->>'offer_value_fingerprint' is distinct from v_value_fp
     or v_candidate->>'interpretation_run_id' is distinct from p_promoted->>'interpretation_run_id'
     or p_promoted->>'stage' is distinct from 'READY' then
    raise exception 'EXTCALC_AUTO_PROMOTION_CANDIDATE_MISMATCH';
  end if;

  -- A supplied supplier UUID must match the authoritative source binding.
  if p_promoted#>>'{interpreted_offer,supplier_id}' ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     and (p_promoted#>>'{interpreted_offer,supplier_id}')::uuid
       is distinct from v_bound_supplier then
    raise exception 'EXTCALC_AUTO_PROMOTION_SUPPLIER_MISMATCH';
  end if;

  -- Structural lineage: every model/price field source line must exist and be nonblank.
  for v_field_name in select unnest(array['model','price']) loop
    v_sources := v_candidate#>array['review_evidence','field_sources',v_field_name];
    if coalesce(pg_catalog.jsonb_typeof(v_sources),'') <> 'array' then
      raise exception 'EXTCALC_AUTO_PROMOTION_SOURCE_EVIDENCE_MISSING';
    end if;
    if pg_catalog.jsonb_array_length(v_sources)=0 then
      raise exception 'EXTCALC_AUTO_PROMOTION_SOURCE_EVIDENCE_MISSING';
    end if;
    if exists (
      select 1 from pg_catalog.jsonb_array_elements_text(v_sources) as field_line(value)
      where not exists (
        select 1 from pg_catalog.jsonb_array_elements(
          coalesce(v_candidate#>'{review_evidence,source_lines}','[]'::jsonb)
        ) as evidence_line(value)
        where evidence_line.value->>'line_number'=field_line.value
          and coalesce(pg_catalog.btrim(evidence_line.value->>'raw'),'')<>''
      )
    ) then
      raise exception 'EXTCALC_AUTO_PROMOTION_SOURCE_EVIDENCE_MISMATCH';
    end if;
  end loop;

  insert into public.extcalc_analysis(tenant_id,analysis_id)
  values(v_tenant,v_analysis_id)
  on conflict (tenant_id,analysis_id) do nothing;

  insert into public.extcalc_offer(tenant_id,analysis_id,offer_id,source_id)
  values(v_tenant,v_analysis_id,v_offer_id,v_source_id)
  on conflict (tenant_id,analysis_id,offer_id) do nothing;

  select source_id into v_existing_source
  from public.extcalc_offer
  where tenant_id=v_tenant and analysis_id=v_analysis_id and offer_id=v_offer_id;

  if v_existing_source is distinct from v_source_id then raise exception 'EXTCALC_OFFER_ID_CONFLICT'; end if;

  select c01_snapshot into v_existing
  from public.extcalc_offer_revision
  where tenant_id=v_tenant and analysis_id=v_analysis_id
    and offer_id=v_offer_id and offer_revision=v_offer_revision;

  if found then
    if v_existing is distinct from p_promoted then raise exception 'EXTCALC_AUTO_PROMOTION_CONFLICT'; end if;
    return pg_catalog.jsonb_build_object(
      'ok',true,'analysis_id',v_analysis_id,'offer_id',v_offer_id,
      'offer_revision',v_offer_revision,'idempotent',true
    );
  end if;

  insert into public.extcalc_offer_revision(
    tenant_id,analysis_id,offer_id,offer_revision,
    c01_contract_version,c01_snapshot,
    offer_identity_fingerprint,offer_value_fingerprint,
    domain_outcome,freshness_status
  ) values (
    v_tenant,v_analysis_id,v_offer_id,v_offer_revision,
    v_contract_version,p_promoted,
    v_identity_fp,v_value_fp,
    'VALID','CURRENT'
  );

  return pg_catalog.jsonb_build_object(
    'ok',true,'analysis_id',v_analysis_id,'offer_id',v_offer_id,
    'offer_revision',v_offer_revision,'idempotent',false
  );
end;
$function$
