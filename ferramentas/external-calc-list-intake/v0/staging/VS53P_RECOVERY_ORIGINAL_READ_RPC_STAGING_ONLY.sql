-- VS53P. Homologacao external-calc-staging ONLY. Never execute in production.
-- Supply an authorized original source to the existing server-side C01
-- recovery flow. Direct SELECT on private original remains revoked.
BEGIN;
SET LOCAL statement_timeout='20000ms';
DO $preflight$
BEGIN
 IF current_user IS DISTINCT FROM 'postgres'
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolbypassrls)
 OR to_regclass('privado.extcalc_original_source_v0') IS NULL
 OR to_regclass('privado.extcalc_staging_membership_v0') IS NULL
 OR to_regclass('public.extcalc_source_supplier') IS NULL
 OR to_regprocedure('public.extcalc_resolve_manual_recovery_source_v0(text)') IS NOT NULL
 OR (SELECT count(*) FROM privado.extcalc_staging_tenant_v0)<>2
 OR to_regprocedure('pg_catalog.sha256(bytea)') IS NULL
 THEN RAISE EXCEPTION 'VS53P_NOT_AN_EMPTY_STAGING_INSTALL'; END IF;
END $preflight$;

CREATE FUNCTION public.extcalc_resolve_manual_recovery_source_v0(p_source_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
 t uuid; aid text; n_analyses integer;
 source_text text; source_hash text; stored_hash text;
 source_bytes bytea; supplier uuid;
BEGIN
 t:=privado.fn_tenant_atual();
 IF auth.uid() IS NULL OR t IS NULL
 OR privado.fn_papel_atual() IS DISTINCT FROM 'dono'
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='RECOVERY_SOURCE_UNAUTHORIZED'; END IF;
 IF p_source_ref IS NULL OR pg_catalog.length(p_source_ref)<3
 OR pg_catalog.length(p_source_ref)>160
 OR p_source_ref !~ '^[A-Za-z0-9_.:-]+$'
 THEN RAISE EXCEPTION 'RECOVERY_SOURCE_REF_INVALID'; END IF;

 SELECT s.content_bytes,s.content_sha256,ss.supplier_id
 INTO source_bytes,stored_hash,supplier
 FROM privado.extcalc_original_source_v0 s
 JOIN public.extcalc_source_supplier ss
  ON ss.tenant_id=s.tenant_id AND ss.source_id=s.source_ref
 JOIN public.extcalc_supplier supplier_record
  ON supplier_record.tenant_id=ss.tenant_id
  AND supplier_record.supplier_id=ss.supplier_id
 WHERE s.tenant_id=t AND s.source_ref=p_source_ref
  AND s.source_contract_version='external-calc-original-supplier-source/v0'
  AND s.source_type='ORIGINAL_SUPPLIER_TEXT' AND s.immutability='APPEND_ONLY'
  AND NOT EXISTS(
    SELECT 1 FROM privado.extcalc_original_source_state_event_v0 event
    WHERE event.tenant_id=t AND event.source_ref=s.source_ref
     AND event.event_type IN ('QUARANTINED','REVOKED')
  );
 IF NOT FOUND THEN RAISE EXCEPTION 'RECOVERY_ORIGINAL_NOT_FOUND_OR_NOT_BOUND'; END IF;
 source_hash:=pg_catalog.encode(pg_catalog.sha256(source_bytes),'hex');
 IF stored_hash IS DISTINCT FROM 'sha256:'||source_hash
 THEN RAISE EXCEPTION 'RECOVERY_ORIGINAL_DIGEST_MISMATCH'; END IF;
 source_text:=pg_catalog.convert_from(source_bytes,'UTF8');
 IF pg_catalog.length(source_text)>1048576
 THEN RAISE EXCEPTION 'RECOVERY_ORIGINAL_EXCEEDS_LIMIT'; END IF;

 SELECT pg_catalog.count(DISTINCT o.analysis_id),
        pg_catalog.min(o.analysis_id)
 INTO n_analyses,aid
 FROM public.extcalc_offer o
 WHERE o.tenant_id=t AND o.source_id=p_source_ref;
 IF n_analyses>1 THEN RAISE EXCEPTION 'RECOVERY_SOURCE_MULTIPLE_ANALYSES'; END IF;
 IF n_analyses=0 THEN
  aid:='analysis_'||pg_catalog.left(
   pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to(p_source_ref||':'||source_hash,'UTF8')),'hex'),24);
 END IF;
 RETURN pg_catalog.jsonb_build_object(
  'trusted_input_ref',p_source_ref,'source_id',p_source_ref,
  'analysis_id',aid,'supplier_id',supplier,
  'original_text',source_text,'original_sha256',source_hash,
  'is_immutable',true,'is_authorized',true,'is_supplier_bound',true,
  'is_quarantined',false
 );
END $body$;

REVOKE ALL ON FUNCTION public.extcalc_resolve_manual_recovery_source_v0(text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.extcalc_resolve_manual_recovery_source_v0(text)
 TO authenticated;

DO $postflight$
BEGIN
 IF pg_catalog.has_function_privilege('anon',
   'public.extcalc_resolve_manual_recovery_source_v0(text)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('authenticated',
   'public.extcalc_resolve_manual_recovery_source_v0(text)','EXECUTE')
 OR NOT EXISTS(
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_roles r ON r.oid=p.proowner
  WHERE n.nspname='public' AND p.proname='extcalc_resolve_manual_recovery_source_v0'
  AND p.prosecdef AND r.rolname='postgres' AND r.rolbypassrls)
 OR pg_catalog.has_table_privilege('authenticated',
   'privado.extcalc_original_source_v0','SELECT')
 THEN RAISE EXCEPTION 'VS53P_RECOVERY_SOURCE_SECURITY_POSTFLIGHT_FAILED'; END IF;
END $postflight$;
COMMIT;
