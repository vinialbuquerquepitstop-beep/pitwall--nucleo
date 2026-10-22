-- VS5.3L: execute only after foundation and EXACT PR #179 guard are installed.
-- Run in PitswallV2/mfsshvckclnmftpaprxk ONLY. Every write in this proof rolls back.
-- Does not issue/verify real signed JWT. Sessions inject Auth UID in Postgres.
BEGIN;
SET LOCAL statement_timeout='15000ms';

DO $scope$
BEGIN
 IF to_regclass('privado.extcalc_original_source_v0') is null
 OR to_regclass('public.extcalc_offer_revision') is null
 OR to_regprocedure('public.extcalc_persist_auto_promoted_c01_v0(jsonb)') is null
 OR (SELECT count(*) FROM privado.extcalc_staging_tenant_v0)<>2
 THEN RAISE EXCEPTION 'VS53L_PROOF_WRONG_DATABASE_OR_MIGRATION_MISSING'; END IF;
END $scope$;

INSERT INTO public.extcalc_supplier(tenant_id,supplier_id,name) VALUES
 ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','VS53L Synthetic A'),
 ('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','VS53L Synthetic B');
INSERT INTO privado.extcalc_original_source_v0(tenant_id,source_ref,filename,created_by,content_bytes) VALUES
 ('11111111-1111-4111-8111-111111111111','vs53l-a-001','VS53L_SOURCE_A.txt',(select user_id from privado.extcalc_staging_membership_v0 where tenant_id='11111111-1111-4111-8111-111111111111' and active),pg_catalog.convert_to(E'iPhone 17 Pro 256GB\nAzul R$ 6.900,00','UTF8')),
 ('22222222-2222-4222-8222-222222222222','vs53l-b-001','VS53L_SOURCE_B.txt',(select user_id from privado.extcalc_staging_membership_v0 where tenant_id='22222222-2222-4222-8222-222222222222' and active),pg_catalog.convert_to(E'iPhone 17 Pro 256GB\nPreto R$ 6.950,00','UTF8'));

-- Resolve real staging test identities *before* dropping admin role. No UID in Git.
SELECT pg_catalog.set_config('vs53l.auth_uid_a',
 (select user_id::text from privado.extcalc_staging_membership_v0
  where tenant_id='11111111-1111-4111-8111-111111111111' and active),true);
SELECT pg_catalog.set_config('vs53l.auth_uid_b',
 (select user_id::text from privado.extcalc_staging_membership_v0
  where tenant_id='22222222-2222-4222-8222-222222222222' and active),true);
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',current_setting('vs53l.auth_uid_a'),true);

DO $test$
DECLARE
 c jsonb; p jsonb; r jsonb; reported text;
 supplier uuid:='33333333-3333-4333-8333-333333333333';
BEGIN
 -- Reject nonexistent supplier, quarantined source, and cross-tenant source.
 BEGIN
  PERFORM public.extcalc_bind_source_supplier_v0('vs53l-a-001','55555555-5555-4555-8555-555555555555');
  RAISE EXCEPTION 'NEGATIVE_SUPPLIER_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'C01_STAGING_SUPPLIER_UNKNOWN' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.extcalc_bind_source_supplier_v0('original-A',supplier);
  RAISE EXCEPTION 'NEGATIVE_QUARANTINE_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'C01_STAGING_SOURCE_UNAVAILABLE' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.extcalc_bind_source_supplier_v0('vs53l-b-001',supplier);
  RAISE EXCEPTION 'NEGATIVE_CROSS_TENANT_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'C01_STAGING_SOURCE_UNAVAILABLE' THEN RAISE; END IF;
 END;
 r:=public.extcalc_bind_source_supplier_v0('vs53l-a-001',supplier);
 IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'A_BIND_FAIL'; END IF;

 c:=pg_catalog.jsonb_build_object(
  'contract_version','external-calc-c01-readonly/v1',
  'analysis_id','analysis_vs53l_a','source_id','vs53l-a-001',
  'offer_id','offer_vs53l_a','offer_revision',1,
  'offer_identity_fingerprint','vs53l_identity_a','offer_value_fingerprint','vs53l_value_a',
  'interpretation_run_id','vs53l_run_a','stage','REVIEW',
  'execution_status','SUCCEEDED','domain_outcome','REVIEW_REQUIRED','freshness_status','CURRENT',
  'interpreted_offer',pg_catalog.jsonb_build_object(
    'supplier_id',supplier::text,
    'model',pg_catalog.jsonb_build_object('id','iphone-17-pro','label','iPhone 17 Pro'),
    'capacity_gb',256,'color','Azul',
    'price',pg_catalog.jsonb_build_object('amount_minor',690000,'currency','BRL')),
  'review_evidence',pg_catalog.jsonb_build_object(
    'field_sources',pg_catalog.jsonb_build_object('model',pg_catalog.jsonb_build_array(1),'price',pg_catalog.jsonb_build_array(2)),
    'source_lines',pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('line_number',1,'raw','iPhone 17 Pro 256GB'),
      pg_catalog.jsonb_build_object('line_number',2,'raw','Azul R$ 6.900,00'))));
 p:=c||pg_catalog.jsonb_build_object(
    'stage','READY','domain_outcome','VALID','reviewed_offer',c->'interpreted_offer',
    'review','null'::jsonb,'auto_promotion',pg_catalog.jsonb_build_object(
       'decision','AUTO_PROMOTE','authority_version','external-calc-c01-auto-promotion/v0'));

 -- Guard must reject promotion before persistent review candidate exists.
 BEGIN
  PERFORM public.extcalc_persist_auto_promoted_c01_v0(p);
  RAISE EXCEPTION 'NEGATIVE_CANDIDATE_ABSENT_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'EXTCALC_AUTO_PROMOTION_CANDIDATE_MISSING' THEN RAISE; END IF;
 END;

 -- Original text is the independent oracle for model/price, not candidate JSON.
 BEGIN
  PERFORM public.extcalc_persist_review_candidate_v0(
   pg_catalog.jsonb_set(c,'{review_evidence,source_lines,1,raw}','"Azul R$ 6.950,00"'::jsonb));
  RAISE EXCEPTION 'NEGATIVE_FORGED_LINE_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'C01_STAGING_LINE_NOT_IN_ORIGINAL' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.extcalc_persist_review_candidate_v0(
   pg_catalog.jsonb_set(c,'{interpreted_offer,price,amount_minor}','700000'::jsonb));
  RAISE EXCEPTION 'NEGATIVE_FORGED_PRICE_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'C01_STAGING_PRICE_UNVERIFIED' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.extcalc_persist_review_candidate_v0(
   pg_catalog.jsonb_set(c,'{interpreted_offer,supplier_id}','"44444444-4444-4444-8444-444444444444"'::jsonb));
  RAISE EXCEPTION 'NEGATIVE_FORGED_SUPPLIER_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'C01_STAGING_SUPPLIER_MISMATCH' THEN RAISE; END IF;
 END;

 r:=public.extcalc_persist_review_candidate_v0(c);
 IF r->>'ok' IS DISTINCT FROM 'true' OR r->>'idempotent' IS DISTINCT FROM 'false' THEN
   RAISE EXCEPTION 'CANDIDATE_INSERT_FAILED';END IF;
 r:=public.extcalc_persist_review_candidate_v0(c);
 IF r->>'idempotent' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'CANDIDATE_IDEMPOTENCE_FAILED';END IF;

 BEGIN
  PERFORM public.extcalc_persist_auto_promoted_c01_v0(
    pg_catalog.jsonb_set(p,'{reviewed_offer,price,amount_minor}','700000'::jsonb));
  RAISE EXCEPTION 'NEGATIVE_PROMOTION_MISMATCH_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'EXTCALC_AUTO_PROMOTION_CANDIDATE_MISMATCH' THEN RAISE; END IF;
 END;
 r:=public.extcalc_persist_auto_promoted_c01_v0(p);
 IF r->>'ok' IS DISTINCT FROM 'true' OR r->>'idempotent' IS DISTINCT FROM 'false' THEN
  RAISE EXCEPTION 'PROMOTION_A_FAILED'; END IF;
 r:=public.extcalc_persist_auto_promoted_c01_v0(p);
 IF r->>'idempotent' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'PROMOTION_RETRY_FAILED'; END IF;
 -- Switch to B with the same valid candidate A: cannot use the A supplier/source.
 PERFORM pg_catalog.set_config('request.jwt.claim.sub',current_setting('vs53l.auth_uid_b'),true);
 BEGIN
  PERFORM public.extcalc_persist_auto_promoted_c01_v0(p);
  RAISE EXCEPTION 'NEGATIVE_CROSS_TENANT_PROMOTION_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'EXTCALC_AUTO_PROMOTION_SOURCE_UNBOUND' THEN RAISE; END IF;
 END;
 -- Confirm B cannot read A revision via the REAL RLS policy.
 IF (select count(*) from public.extcalc_offer_revision where analysis_id='analysis_vs53l_a')<>0 THEN
  RAISE EXCEPTION 'CROSS_TENANT_READ_LEAK'; END IF;
 -- Confirm anonymous user can't reach any function (by grants).
 IF pg_catalog.has_function_privilege('anon','public.extcalc_persist_auto_promoted_c01_v0(jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'ANON_PROMOTION_RPC_EXPOSED'; END IF;
 RAISE NOTICE 'VS53L_SYNTHETIC_STAGING_DB_PROOF=PASS;JWT_SIGNED_HTTP=NOT_TESTED';
END $test$;
ROLLBACK;
