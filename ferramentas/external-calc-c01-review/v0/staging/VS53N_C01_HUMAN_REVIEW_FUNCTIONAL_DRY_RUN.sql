-- VS53N: STAGING ONLY. NEVER APPLY TO PRODUCTION.
-- Preserves C01 candidate and auto-promotion tables. No review result becomes quoteable.
BEGIN;
SET LOCAL statement_timeout = '20000ms';
DO $scope$
BEGIN
 IF current_user <> 'postgres'
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolbypassrls)
    OR to_regclass('privado.extcalc_staging_tenant_v0') IS NULL
    OR to_regclass('privado.extcalc_staging_membership_v0') IS NULL
    OR to_regclass('privado.extcalc_original_source_v0') IS NULL
    OR to_regclass('public.extcalc_review_candidate') IS NULL
    OR to_regclass('public.extcalc_offer_revision') IS NULL
    OR to_regclass('privado.extcalc_c01_review_decision_stage_v0') IS NOT NULL
    OR to_regprocedure('public.extcalc_list_pending_review_candidates_v0(integer)') IS NOT NULL
    OR to_regprocedure('public.extcalc_load_review_candidate_v0(text,text,integer)') IS NOT NULL
    OR to_regprocedure('public.extcalc_persist_review_result_v0(jsonb)') IS NOT NULL
    OR (SELECT count(*) FROM privado.extcalc_staging_tenant_v0) <> 2
 THEN RAISE EXCEPTION 'VS53N_STAGING_SCOPE_OR_STATE_MISMATCH'; END IF;
END $scope$;

CREATE TABLE privado.extcalc_c01_review_decision_stage_v0 (
 tenant_id uuid NOT NULL,
 analysis_id text NOT NULL,
 offer_id text NOT NULL,
 original_offer_revision integer NOT NULL CHECK(original_offer_revision>0),
 review_id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
 reviewer_id uuid NOT NULL,
 decision text NOT NULL CHECK(decision IN ('ACCEPT','EDIT','EXCLUDE','INVALIDATE')),
 reviewed_snapshot jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(reviewed_snapshot)='object'),
 recorded_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 decision_status text NOT NULL DEFAULT 'RECORDED_AWAITING_C01_AUTHORITY'
    CHECK(decision_status='RECORDED_AWAITING_C01_AUTHORITY'),
 PRIMARY KEY(tenant_id,analysis_id,offer_id,original_offer_revision),
 UNIQUE(review_id),
 FOREIGN KEY(tenant_id,analysis_id,offer_id,original_offer_revision)
 REFERENCES public.extcalc_review_candidate(tenant_id,analysis_id,offer_id,offer_revision)
);
ALTER TABLE privado.extcalc_c01_review_decision_stage_v0 ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.extcalc_c01_review_decision_stage_v0 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.extcalc_c01_review_decision_stage_v0 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION privado.extcalc_c01_review_decision_immutable_v0()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $guard$
BEGIN
 RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='C01_REVIEW_DECISION_IMMUTABLE';
END $guard$;
CREATE TRIGGER extcalc_c01_review_decision_immutable_v0
 BEFORE UPDATE OR DELETE ON privado.extcalc_c01_review_decision_stage_v0
 FOR EACH ROW EXECUTE FUNCTION privado.extcalc_c01_review_decision_immutable_v0();
REVOKE ALL ON FUNCTION privado.extcalc_c01_review_decision_immutable_v0() FROM PUBLIC,anon,authenticated;

-- Critical write barrier: legacy auto-promotion cannot bypass a recorded
-- ACCEPT/EDIT/EXCLUDE/INVALIDATE for this source offer. No later revision
-- is sale-ready until an explicit audited authority migrates it.
CREATE FUNCTION privado.extcalc_c01_no_promotion_after_review_v0()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fence$
BEGIN
 IF EXISTS(
  SELECT 1 FROM privado.extcalc_c01_review_decision_stage_v0 d
  WHERE d.tenant_id=NEW.tenant_id
  AND d.analysis_id=NEW.analysis_id AND d.offer_id=NEW.offer_id)
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='C01_REVIEWED_OFFER_REQUIRES_AUTHORITY_GATE'; END IF;
 RETURN NEW;
END $fence$;
CREATE TRIGGER extcalc_c01_no_promotion_after_review_v0
 BEFORE INSERT OR UPDATE ON public.extcalc_offer_revision
 FOR EACH ROW EXECUTE FUNCTION privado.extcalc_c01_no_promotion_after_review_v0();
REVOKE ALL ON FUNCTION privado.extcalc_c01_no_promotion_after_review_v0() FROM PUBLIC,anon,authenticated;

-- Readonly page. Original tenant bound to auth.uid, never to request payload.
CREATE FUNCTION public.extcalc_list_pending_review_candidates_v0(p_limit integer DEFAULT 50)
RETURNS TABLE(candidate_snapshot jsonb,criado_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $queue$
DECLARE t uuid; lim integer;
BEGIN
 t:=privado.fn_tenant_atual();
 IF auth.uid() IS NULL OR t IS NULL OR privado.fn_papel_atual() IS DISTINCT FROM 'dono'
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='C01_REVIEW_UNAUTHORIZED'; END IF;
 lim:=pg_catalog.coalesce(p_limit,50);
 IF lim<1 OR lim>50 THEN RAISE EXCEPTION 'C01_REVIEW_QUEUE_LIMIT_INVALID'; END IF;
 RETURN QUERY
 SELECT c.candidate_snapshot, NULL::timestamptz AS criado_em
 FROM public.extcalc_review_candidate c
 WHERE c.tenant_id=t
   AND c.candidate_snapshot->>'domain_outcome'='REVIEW_REQUIRED'
   AND NOT EXISTS(
     SELECT 1 FROM privado.extcalc_c01_review_decision_stage_v0 d
     WHERE d.tenant_id=c.tenant_id AND d.analysis_id=c.analysis_id
       AND d.offer_id=c.offer_id AND d.original_offer_revision=c.offer_revision)
 ORDER BY c.analysis_id,c.offer_id,c.offer_revision
 LIMIT lim;
END $queue$;
REVOKE ALL ON FUNCTION public.extcalc_list_pending_review_candidates_v0(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.extcalc_list_pending_review_candidates_v0(integer) TO authenticated;

-- The existing backend repository cannot SELECT directly from the protected candidate table.
CREATE FUNCTION public.extcalc_load_review_candidate_v0(
 p_analysis_id text,p_offer_id text,p_offer_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $load$
DECLARE t uuid; row_json jsonb;
BEGIN
 t:=privado.fn_tenant_atual();
 IF auth.uid() IS NULL OR t IS NULL OR privado.fn_papel_atual() IS DISTINCT FROM 'dono'
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='C01_REVIEW_UNAUTHORIZED'; END IF;
 IF pg_catalog.nullif(pg_catalog.btrim(p_analysis_id),'') IS NULL
 OR pg_catalog.nullif(pg_catalog.btrim(p_offer_id),'') IS NULL
 OR p_offer_revision IS NULL OR p_offer_revision<1 THEN
 RAISE EXCEPTION 'C01_REVIEW_REFERENCE_INVALID'; END IF;
 SELECT pg_catalog.jsonb_build_object(
  'tenant_id',c.tenant_id,'analysis_id',c.analysis_id,'offer_id',c.offer_id,
  'offer_revision',c.offer_revision,'candidate_snapshot',c.candidate_snapshot)
 INTO row_json FROM public.extcalc_review_candidate c
 WHERE c.tenant_id=t AND c.analysis_id=p_analysis_id AND c.offer_id=p_offer_id
 AND c.offer_revision=p_offer_revision;
 RETURN row_json;
END $load$;
REVOKE ALL ON FUNCTION public.extcalc_load_review_candidate_v0(text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.extcalc_load_review_candidate_v0(text,text,integer) TO authenticated;

-- Staging audit-only decision. DOES NOT INSERT into extcalc_offer_revision.
-- No claim of VALID for quote/simulation until a separate trusted C01 authority gate.
CREATE FUNCTION public.extcalc_persist_review_result_v0(p_reviewed jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $record$
DECLARE t uuid; candidate jsonb; source_id text; revision integer; final_revision integer;
 aid text;oid text;decision text;final_outcome text;is_material boolean;current_actor text;
 existing jsonb; existing_id uuid; appended_id uuid; permitted boolean;
BEGIN
 t:=privado.fn_tenant_atual();
 current_actor:=auth.uid()::text;
 IF auth.uid() IS NULL OR t IS NULL OR privado.fn_papel_atual() IS DISTINCT FROM 'dono'
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='C01_REVIEW_UNAUTHORIZED'; END IF;
 IF p_reviewed IS NULL OR pg_catalog.jsonb_typeof(p_reviewed)<>'object'
 THEN RAISE EXCEPTION 'C01_REVIEW_RESULT_INVALID'; END IF;
 aid:=pg_catalog.nullif(pg_catalog.btrim(p_reviewed->>'analysis_id'),'');
 oid:=pg_catalog.nullif(pg_catalog.btrim(p_reviewed->>'offer_id'),'');
 source_id:=pg_catalog.nullif(pg_catalog.btrim(p_reviewed->>'source_id'),'');
 revision:=pg_catalog.coalesce(pg_catalog.nullif(p_reviewed#>>'{review,original_offer_revision}','')::integer,
  pg_catalog.nullif(p_reviewed->>'offer_revision','')::integer);
 final_revision:=pg_catalog.nullif(p_reviewed->>'offer_revision','')::integer;
 decision:=p_reviewed#>>'{review,decision}';
 final_outcome:=p_reviewed->>'domain_outcome';
 is_material:=pg_catalog.coalesce((p_reviewed#>>'{review,material_change}')::boolean,false);
 IF aid IS NULL OR oid IS NULL OR source_id IS NULL OR revision IS NULL
 OR final_revision IS NULL OR revision<1 OR final_revision<1
 OR decision IS NULL OR decision NOT IN ('ACCEPT','EDIT','EXCLUDE','INVALIDATE')
 OR p_reviewed#>>'{review,reviewer_ref}' IS DISTINCT FROM current_actor
 OR pg_catalog.nullif(p_reviewed#>>'{review,reviewed_at}','') IS NULL
 OR p_reviewed ? 'tenant_id' OR p_reviewed ? 'actor_id'
 OR p_reviewed->>'contract_version' IS DISTINCT FROM 'external-calc-c01-readonly/v1'
 OR p_reviewed->>'execution_status' IS DISTINCT FROM 'SUCCEEDED'
 OR p_reviewed->>'freshness_status' IS DISTINCT FROM 'CURRENT'
 THEN RAISE EXCEPTION 'C01_REVIEW_RESULT_IDENTITY_OR_STATE_INVALID'; END IF;
 -- Never allow untrusted claim of changed materiality to bypass exact comparison.
 SELECT c.candidate_snapshot INTO candidate
 FROM public.extcalc_review_candidate c
 WHERE c.tenant_id=t AND c.analysis_id=aid AND c.offer_id=oid AND c.offer_revision=revision
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'C01_REVIEW_CANDIDATE_NOT_FOUND'; END IF;
 IF candidate->>'source_id' IS DISTINCT FROM source_id
 OR candidate->>'contract_version' IS DISTINCT FROM 'external-calc-c01-readonly/v1'
 OR candidate->>'execution_status' IS DISTINCT FROM 'SUCCEEDED'
 OR candidate->>'offer_identity_fingerprint' IS NULL
 OR candidate->>'offer_value_fingerprint' IS NULL
 OR candidate->>'domain_outcome' IS DISTINCT FROM 'REVIEW_REQUIRED'
 OR candidate->>'freshness_status' IS DISTINCT FROM 'CURRENT'
 THEN RAISE EXCEPTION 'C01_REVIEW_CANDIDATE_LINEAGE_INVALID'; END IF;
 IF EXISTS(SELECT 1 FROM public.extcalc_offer_revision rev
           WHERE rev.tenant_id=t AND rev.analysis_id=aid AND rev.offer_id=oid)
 THEN RAISE EXCEPTION 'C01_REVIEW_ALREADY_PROMOTED'; END IF;
 IF decision='ACCEPT' THEN
  permitted:= final_outcome='VALID' AND NOT is_material AND final_revision=revision
   AND p_reviewed->'reviewed_offer'=candidate->'interpreted_offer'
   AND p_reviewed->>'offer_value_fingerprint'=candidate->>'offer_value_fingerprint'
   AND p_reviewed->>'offer_identity_fingerprint'=candidate->>'offer_identity_fingerprint';
 ELSIF decision='EDIT' THEN
  permitted:= final_outcome='VALID' AND is_material AND final_revision=revision+1
   AND p_reviewed->'reviewed_offer' IS DISTINCT FROM candidate->'interpreted_offer'
   AND pg_catalog.jsonb_typeof(p_reviewed->'reviewed_offer')='object'
   AND p_reviewed#>>'{reviewed_offer,supplier_id}'=candidate#>>'{interpreted_offer,supplier_id}';
 ELSE
  permitted:=final_outcome=CASE decision WHEN 'EXCLUDE' THEN 'EXCLUDED' ELSE 'INVALID' END
   AND NOT is_material AND final_revision=revision
   AND p_reviewed->'reviewed_offer'='null'::jsonb;
 END IF;
 IF permitted IS DISTINCT FROM true THEN RAISE EXCEPTION 'C01_REVIEW_DECISION_MISMATCH';END IF;
 -- Never allow 'human reviewed' to override a quarantined/revoked original source.
 IF decision IN ('ACCEPT','EDIT')
 AND EXISTS (SELECT 1 FROM privado.extcalc_original_source_state_event_v0 ev
             WHERE ev.tenant_id=t AND ev.source_ref=source_id
             AND ev.event_type IN ('QUARANTINED','REVOKED'))
 THEN RAISE EXCEPTION 'C01_REVIEW_ORIGINAL_SOURCE_UNAVAILABLE'; END IF;
 SELECT d.reviewed_snapshot,d.review_id INTO existing,existing_id
 FROM privado.extcalc_c01_review_decision_stage_v0 d
 WHERE d.tenant_id=t AND d.analysis_id=aid AND d.offer_id=oid
 AND d.original_offer_revision=revision;
 IF FOUND THEN
  IF existing IS DISTINCT FROM p_reviewed THEN RAISE EXCEPTION 'C01_REVIEW_DECISION_CONFLICT'; END IF;
  RETURN pg_catalog.jsonb_build_object('ok',true,'idempotent',true,
   'review_id',existing_id,'decision_status','RECORDED_AWAITING_C01_AUTHORITY',
   'analysis_id',aid,'offer_id',oid,'offer_revision',final_revision);
 END IF;
 INSERT INTO privado.extcalc_c01_review_decision_stage_v0 (
  tenant_id,analysis_id,offer_id,original_offer_revision,reviewer_id,decision,reviewed_snapshot)
 VALUES(t,aid,oid,revision,auth.uid(),decision,p_reviewed)
 RETURNING review_id INTO appended_id;
 RETURN pg_catalog.jsonb_build_object('ok',true,'idempotent',false,
  'review_id',appended_id,'decision_status','RECORDED_AWAITING_C01_AUTHORITY',
  'analysis_id',aid,'offer_id',oid,'offer_revision',final_revision);
END $record$;
REVOKE ALL ON FUNCTION public.extcalc_persist_review_result_v0(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.extcalc_persist_review_result_v0(jsonb) TO authenticated;

DO $post$
DECLARE n text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger tg
  WHERE tg.tgrelid='public.extcalc_offer_revision'::regclass
  AND tg.tgname='extcalc_c01_no_promotion_after_review_v0' AND NOT tg.tgisinternal)
 THEN RAISE EXCEPTION 'VS53N_PROMOTION_FENCE_MISSING';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
  WHERE ns.nspname='privado' AND c.relname='extcalc_c01_review_decision_stage_v0'
  AND c.relrowsecurity AND c.relforcerowsecurity)
 THEN RAISE EXCEPTION 'VS53N_RLS_FORCE_INVALID';END IF;
 IF pg_catalog.has_table_privilege('authenticated',
     'privado.extcalc_c01_review_decision_stage_v0','SELECT')
 OR pg_catalog.has_table_privilege('authenticated',
     'privado.extcalc_c01_review_decision_stage_v0','INSERT')
 OR pg_catalog.has_function_privilege('anon',
     'public.extcalc_persist_review_result_v0(jsonb)','EXECUTE')
 OR pg_catalog.has_function_privilege('anon',
     'public.extcalc_load_review_candidate_v0(text,text,integer)','EXECUTE')
 OR pg_catalog.has_function_privilege('anon',
     'public.extcalc_list_pending_review_candidates_v0(integer)','EXECUTE')
 THEN RAISE EXCEPTION 'VS53N_PERMISSIONS_INVALID'; END IF;
 FOREACH n IN ARRAY ARRAY['extcalc_persist_review_result_v0','extcalc_list_pending_review_candidates_v0','extcalc_load_review_candidate_v0'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
        JOIN pg_roles r ON r.oid=p.proowner
        WHERE ns.nspname='public' AND p.proname=n AND p.prosecdef
          AND r.rolname='postgres' AND r.rolbypassrls)
  THEN RAISE EXCEPTION 'VS53N_OWNER_AUTHORITY_INVALID %',n; END IF;
 END LOOP;
END $post$;
-- This entire exercise is still under the migration's BEGIN, and ends ROLLBACK.
INSERT INTO public.extcalc_supplier(tenant_id,supplier_id,name) VALUES
('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','VS53N SYNTHETIC A');
INSERT INTO privado.extcalc_original_source_v0(tenant_id,source_ref,filename,created_by,content_bytes)
VALUES('11111111-1111-4111-8111-111111111111','vs53n-review-a','VS53N_SYNTHETIC_A.txt',
 (SELECT user_id FROM privado.extcalc_staging_membership_v0
  WHERE tenant_id='11111111-1111-4111-8111-111111111111' AND active),
 pg_catalog.convert_to(E'iPhone 17 Pro 256GB\nAzul R$ 6.900,00','UTF8'));
SELECT pg_catalog.set_config('vs53n.qa_user_a',
 (SELECT user_id::text FROM privado.extcalc_staging_membership_v0
  WHERE tenant_id='11111111-1111-4111-8111-111111111111' AND active),true);
SELECT pg_catalog.set_config('vs53n.qa_user_b',
 (SELECT user_id::text FROM privado.extcalc_staging_membership_v0
  WHERE tenant_id='22222222-2222-4222-8222-222222222222' AND active),true);
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',current_setting('vs53n.qa_user_a'),true);
DO $vs53n_test$
DECLARE candidate jsonb;reviewed jsonb;autopromo jsonb;rec jsonb;one jsonb;
BEGIN
 IF current_user IS DISTINCT FROM 'authenticated' THEN
  RAISE EXCEPTION 'VS53N_TEST_NOT_AUTHENTICATED'; END IF;
 PERFORM public.extcalc_bind_source_supplier_v0(
  'vs53n-review-a','33333333-3333-4333-8333-333333333333');
 candidate:=pg_catalog.jsonb_build_object(
  'contract_version','external-calc-c01-readonly/v1',
  'analysis_id','analysis_vs53n_a','source_id','vs53n-review-a',
  'offer_id','offer_vs53n_a','offer_revision',1,
  'offer_identity_fingerprint','vs53n_identity_a','offer_value_fingerprint','vs53n_value_a',
  'interpretation_run_id','vs53n_run_a','stage','REVIEW',
  'execution_status','SUCCEEDED','domain_outcome','REVIEW_REQUIRED','freshness_status','CURRENT',
  'reviewed_offer','null'::jsonb,'review','null'::jsonb,
  'interpreted_offer',pg_catalog.jsonb_build_object(
    'supplier_id','33333333-3333-4333-8333-333333333333',
    'model',pg_catalog.jsonb_build_object('id','iphone-17-pro','label','iPhone 17 Pro'),
    'capacity_gb',256,'color','Azul',
    'price',pg_catalog.jsonb_build_object('amount_minor',690000,'currency','BRL')),
  'review_evidence',pg_catalog.jsonb_build_object(
    'field_sources',pg_catalog.jsonb_build_object('model',pg_catalog.jsonb_build_array(1),
      'price',pg_catalog.jsonb_build_array(2),'color',pg_catalog.jsonb_build_array(2)),
    'source_lines',pg_catalog.jsonb_build_array(
     pg_catalog.jsonb_build_object('line_number',1,'raw','iPhone 17 Pro 256GB'),
     pg_catalog.jsonb_build_object('line_number',2,'raw','Azul R$ 6.900,00'))));
 PERFORM public.extcalc_persist_review_candidate_v0(candidate);
 IF (SELECT count(*) FROM public.extcalc_list_pending_review_candidates_v0(50))<>1
 THEN RAISE EXCEPTION 'VS53N_A_QUEUE_NOT_ONE'; END IF;
 one:=public.extcalc_load_review_candidate_v0('analysis_vs53n_a','offer_vs53n_a',1);
 IF one->'candidate_snapshot' IS DISTINCT FROM candidate
 THEN RAISE EXCEPTION 'VS53N_LOAD_CANDIDATE_MISMATCH'; END IF;
 PERFORM pg_catalog.set_config('request.jwt.claim.sub',current_setting('vs53n.qa_user_b'),true);
 IF (SELECT count(*) FROM public.extcalc_list_pending_review_candidates_v0(50))<>0
 THEN RAISE EXCEPTION 'VS53N_CROSS_TENANT_QUEUE_LEAK'; END IF;
 IF public.extcalc_load_review_candidate_v0('analysis_vs53n_a','offer_vs53n_a',1) IS NOT NULL
 THEN RAISE EXCEPTION 'VS53N_CROSS_TENANT_CANDIDATE_LEAK'; END IF;
 PERFORM pg_catalog.set_config('request.jwt.claim.sub',current_setting('vs53n.qa_user_a'),true);
 reviewed:=candidate||pg_catalog.jsonb_build_object(
   'stage','READY','domain_outcome','VALID','reviewed_offer',candidate->'interpreted_offer',
   'review',pg_catalog.jsonb_build_object('decision','ACCEPT',
     'reviewer_ref',auth.uid()::text,'reviewed_at',pg_catalog.clock_timestamp()::text,
     'material_change',false,'original_offer_revision',1));
 -- Reject forged actor even when candidate identity and source are correct.
 BEGIN
  PERFORM public.extcalc_persist_review_result_v0(
   pg_catalog.jsonb_set(reviewed,'{review,reviewer_ref}','"different-user"'::jsonb));
  RAISE EXCEPTION 'VS53N_NEGATIVE_FORGED_REVIEWER_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM IS DISTINCT FROM 'C01_REVIEW_RESULT_IDENTITY_OR_STATE_INVALID' THEN RAISE; END IF;
 END;
 rec:=public.extcalc_persist_review_result_v0(reviewed);
 IF rec->>'decision_status' IS DISTINCT FROM 'RECORDED_AWAITING_C01_AUTHORITY'
 OR rec->>'idempotent' IS DISTINCT FROM 'false'
 THEN RAISE EXCEPTION 'VS53N_AUDIT_WRITE_FAILED';END IF;
 rec:=public.extcalc_persist_review_result_v0(reviewed);
 IF rec->>'idempotent' IS DISTINCT FROM 'true'
 THEN RAISE EXCEPTION 'VS53N_REVIEW_IDEMPOTENCE_FAILED'; END IF;
 IF (SELECT count(*) FROM public.extcalc_list_pending_review_candidates_v0(50))<>0
 THEN RAISE EXCEPTION 'VS53N_QUEUE_STILL_SHOWS_REVIEWED';END IF;
 -- No reviewed result may become quoteable via existing auto-promotion.
 autopromo:=candidate||pg_catalog.jsonb_build_object(
   'stage','READY','domain_outcome','VALID','reviewed_offer',candidate->'interpreted_offer',
   'review','null'::jsonb,'auto_promotion',pg_catalog.jsonb_build_object(
     'decision','AUTO_PROMOTE','authority_version','external-calc-c01-auto-promotion/v0'));
 BEGIN
  PERFORM public.extcalc_persist_auto_promoted_c01_v0(autopromo);
  RAISE EXCEPTION 'VS53N_NEGATIVE_AUTO_PROMOTION_AFTER_REVIEW_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM IS DISTINCT FROM 'C01_REVIEWED_OFFER_REQUIRES_AUTHORITY_GATE' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'VS53N_C01_REVIEW_STAGING_SYNTHETIC_RPC=PASS';
END $vs53n_test$;
SET LOCAL ROLE postgres;
DO $counts$
BEGIN
 IF (SELECT count(*) FROM privado.extcalc_c01_review_decision_stage_v0)<>1
 OR (SELECT count(*) FROM public.extcalc_offer_revision)<>0
 OR (SELECT count(*) FROM public.extcalc_review_candidate)<>1
 THEN RAISE EXCEPTION 'VS53N_FINAL_COUNTERS_MISMATCH'; END IF;
END $counts$;
SELECT 'PASS'::text AS "VS53N_C01_HUMAN_REVIEW_RESULT",
 'A/B isolamento, decisão, idempotência e bloqueio de promoção'::text AS "testes",
 'ROLLBACK descarta todos os dados sintéticos'::text AS "limpeza";
ROLLBACK;
