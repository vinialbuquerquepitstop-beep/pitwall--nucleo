-- VS53P staging-only source registration. No production deployment.
-- Authenticated owner uploads one exact UTF-8 original, binds existing supplier.
-- The source is APPEND_ONLY, immutable, hash-verified and tenant scoped.
BEGIN;
SET LOCAL statement_timeout='20000ms';
DO $scope$
BEGIN
 IF current_user IS DISTINCT FROM 'postgres'
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolbypassrls)
 OR to_regclass('privado.extcalc_original_source_v0') IS NULL
 OR to_regprocedure('public.extcalc_bind_source_supplier_v0(text,uuid)') IS NULL
 OR to_regprocedure('public.extcalc_register_original_source_v0(text,uuid,text,text,text)') IS NOT NULL
 OR (SELECT count(*) FROM privado.extcalc_staging_tenant_v0)<>2
 THEN RAISE EXCEPTION 'VS53P_REGISTER_STAGING_SCOPE_MISMATCH'; END IF;
END $scope$;

CREATE FUNCTION public.extcalc_register_original_source_v0(
 p_source_id text,p_supplier_id uuid,p_filename text,p_content text,p_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $register$
DECLARE
 t uuid; b bytea; expected_hash text; old_bytes bytea;
 existing boolean:=false; inserted_rows integer:=0; bound uuid;
BEGIN
 t:=privado.fn_tenant_atual();
 IF auth.uid() IS NULL OR t IS NULL OR privado.fn_papel_atual() IS DISTINCT FROM 'dono'
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='RECOVERY_SOURCE_REGISTER_UNAUTHORIZED'; END IF;
 IF p_source_id IS NULL OR pg_catalog.length(p_source_id)<3
 OR pg_catalog.length(p_source_id)>160
 OR p_source_id !~ '^[A-Za-z0-9_.:-]+$' OR p_supplier_id IS NULL
 OR p_filename IS NULL OR pg_catalog.length(pg_catalog.btrim(p_filename))<1
 OR pg_catalog.length(p_filename)>180 OR p_content IS NULL
 THEN RAISE EXCEPTION 'RECOVERY_SOURCE_REGISTER_INVALID';END IF;
 b:=pg_catalog.convert_to(p_content,'UTF8');
 IF pg_catalog.octet_length(b)<1 OR pg_catalog.octet_length(b)>1048576
 THEN RAISE EXCEPTION 'RECOVERY_SOURCE_SIZE_INVALID'; END IF;
 expected_hash:='sha256:'||pg_catalog.encode(pg_catalog.sha256(b),'hex');
 IF p_hash IS DISTINCT FROM expected_hash
 THEN RAISE EXCEPTION 'RECOVERY_SOURCE_HASH_MISMATCH'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.extcalc_supplier s
 WHERE s.tenant_id=t AND s.supplier_id=p_supplier_id)
 THEN RAISE EXCEPTION 'RECOVERY_REGISTER_SUPPLIER_NOT_FOUND'; END IF;
 IF EXISTS(SELECT 1 FROM privado.extcalc_original_source_state_event_v0 ev
 WHERE ev.tenant_id=t AND ev.source_ref=p_source_id
 AND ev.event_type IN ('QUARANTINED','REVOKED'))
 THEN RAISE EXCEPTION 'RECOVERY_REGISTER_ORIGINAL_UNAVAILABLE';END IF;

 INSERT INTO privado.extcalc_original_source_v0
  (tenant_id,source_ref,filename,created_by,content_bytes,content_sha256)
 VALUES(t,p_source_id,p_filename,auth.uid(),b,expected_hash)
 ON CONFLICT(tenant_id,source_ref) DO NOTHING;
 GET DIAGNOSTICS inserted_rows=ROW_COUNT;
 existing:=(inserted_rows=0); -- true when the exact source already existed
 SELECT s.content_bytes INTO old_bytes
 FROM privado.extcalc_original_source_v0 s
 WHERE s.tenant_id=t AND s.source_ref=p_source_id;
 IF old_bytes IS DISTINCT FROM b THEN
  RAISE EXCEPTION 'RECOVERY_SOURCE_REF_COLLISION'; END IF;
 PERFORM public.extcalc_bind_source_supplier_v0(p_source_id,p_supplier_id);
 SELECT ss.supplier_id INTO bound
 FROM public.extcalc_source_supplier ss
 WHERE ss.tenant_id=t AND ss.source_id=p_source_id;
 IF bound IS DISTINCT FROM p_supplier_id
 THEN RAISE EXCEPTION 'RECOVERY_SOURCE_BOUND_SUPPLIER_MISMATCH';END IF;
 RETURN pg_catalog.jsonb_build_object('ok',true,'source_id',p_source_id,
    'supplier_id',p_supplier_id,'original_sha256',expected_hash,
    'idempotent',existing);
END $register$;

REVOKE ALL ON FUNCTION public.extcalc_register_original_source_v0(text,uuid,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.extcalc_register_original_source_v0(text,uuid,text,text,text)
 TO authenticated;

DO $postflight$
BEGIN
 IF pg_catalog.has_function_privilege('anon',
  'public.extcalc_register_original_source_v0(text,uuid,text,text,text)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('authenticated',
  'public.extcalc_register_original_source_v0(text,uuid,text,text,text)','EXECUTE')
 OR pg_catalog.has_table_privilege('authenticated','privado.extcalc_original_source_v0','INSERT')
 THEN RAISE EXCEPTION 'VS53P_REGISTER_AUTHORITY_INVALID';END IF;
END $postflight$;
COMMIT;
