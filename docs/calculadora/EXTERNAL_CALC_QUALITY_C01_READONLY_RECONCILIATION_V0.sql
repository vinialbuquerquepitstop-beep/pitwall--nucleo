-- EXTERNAL CALC | Quality C01 partial-ingestion diagnostic V0
-- READ ONLY. Must run only against the verified External Calc Supabase project
-- with an authorized owner/admin. Do not execute against Pitwall CRM V2.
-- Purpose: identify previously persisted candidates and whether an authorized
-- C01 snapshot exists. Does not return raw supplier text, price, phone or PII.
-- The search term and window below are investigative filters, not authority.
-- Nothing here repairs or deletes immutable C01 snapshots.

WITH quality_suppliers AS (
  SELECT tenant_id, supplier_id, name
  FROM public.extcalc_supplier
  WHERE name ILIKE '%quality%'
),
candidate_rows AS (
  SELECT
    c.tenant_id,
    c.analysis_id,
    c.offer_id,
    c.offer_revision,
    c.criado_em,
    c.interpretation_run_id,
    c.offer_identity_fingerprint,
    c.offer_value_fingerprint,
    (c.candidate_snapshot ->> 'source_id') AS candidate_source_id,
    c.candidate_snapshot ->> 'domain_outcome' AS candidate_outcome
  FROM public.extcalc_review_candidate AS c
  WHERE c.criado_em >= now() - interval '14 days'
)
SELECT
  c.tenant_id,
  qs.name AS supplier_name,
  qs.supplier_id,
  c.analysis_id,
  c.candidate_source_id AS source_id,
  c.offer_id,
  c.offer_revision,
  c.criado_em AS candidate_created_at,
  c.interpretation_run_id,
  left(c.offer_identity_fingerprint, 12) AS identity_fp_prefix,
  left(c.offer_value_fingerprint, 12) AS value_fp_prefix,
  c.candidate_outcome,
  CASE
    WHEN r.offer_id IS NULL THEN 'CANDIDATE_ONLY'
    WHEN r.domain_outcome = 'VALID' THEN 'C01_VALID_EXISTS'
    ELSE 'C01_REVISION_EXISTS_CHECK_STATUS'
  END AS reconciliation_state,
  r.domain_outcome AS reviewed_outcome,
  r.freshness_status AS reviewed_freshness
FROM candidate_rows AS c
JOIN public.extcalc_source_supplier AS link
  ON link.tenant_id = c.tenant_id
 AND link.source_id = c.candidate_source_id
JOIN quality_suppliers AS qs
  ON qs.tenant_id = link.tenant_id
 AND qs.supplier_id = link.supplier_id
LEFT JOIN public.extcalc_offer_revision AS r
  ON r.tenant_id = c.tenant_id
 AND r.analysis_id = c.analysis_id
 AND r.offer_id = c.offer_id
 AND r.offer_revision = c.offer_revision
ORDER BY c.criado_em DESC, c.analysis_id, c.offer_id
LIMIT 250;

-- Interpretation:
-- CANDIDATE_ONLY: candidate persisted, no corresponding C01 revision.
-- C01_VALID_EXISTS: C01 revision exists; verify whether it is CURRENT.
-- A candidate missing from this report is NOT proof it was never saved:
-- supplier binding may be absent, supplier name may differ, or it may be
-- outside the time window. Investigate source_id/analysis_id separately.
-- Existing randomized-run snapshots may conflict with deterministic retries;
-- never DELETE, UPSERT, or rewrite them based on this query alone.
