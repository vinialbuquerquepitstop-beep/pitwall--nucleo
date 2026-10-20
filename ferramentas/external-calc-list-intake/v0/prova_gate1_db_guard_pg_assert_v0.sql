-- Ephemeral PostgreSQL integration tests. NO real supplier data or Supabase credentials.
CREATE FUNCTION public.gate1_assert_reject(p_promoted jsonb, expected text)
RETURNS void LANGUAGE plpgsql AS $assert$
DECLARE reported text;
BEGIN
  BEGIN
    PERFORM public.extcalc_persist_auto_promoted_c01_v0(p_promoted);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS reported = MESSAGE_TEXT;
    IF reported IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'EXPECTED %, ACTUAL %', expected, reported;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'UNEXPECTED_AUTO_PROMOTION for %', expected;
END;
$assert$;

DO $gate1$
DECLARE
  tenant uuid := '22222222-2222-4222-8222-222222222222';
  other_tenant uuid := '55555555-5555-4555-8555-555555555555';
  supplier uuid := '33333333-3333-4333-8333-333333333333';
  other_supplier uuid := '44444444-4444-4444-8444-444444444444';
  candidate jsonb;
  promoted jsonb;
  changed_candidate jsonb;
  changed_promoted jsonb;
  receipt jsonb;
BEGIN
  PERFORM set_config('test.user_id','11111111-1111-4111-8111-111111111111',false);
  PERFORM set_config('test.tenant_id',tenant::text,false);
  PERFORM set_config('test.papel','dono',false);

  candidate := jsonb_build_object(
    'contract_version','external-calc-c01-readonly/v1',
    'analysis_id','analysis_gate1',
    'source_id','source_gate1',
    'offer_id','offer_gate1',
    'offer_revision',1,
    'offer_identity_fingerprint','identity_1',
    'offer_value_fingerprint','value_1',
    'interpretation_run_id','run_gate1',
    'stage','REVIEW',
    'execution_status','SUCCEEDED',
    'domain_outcome','REVIEW_REQUIRED',
    'freshness_status','CURRENT',
    'interpreted_offer',jsonb_build_object(
      'supplier_id',supplier::text,
      'model',jsonb_build_object('id','iphone-17-pro','label','iPhone 17 Pro'),
      'capacity_gb',256,
      'color','Azul',
      'price',jsonb_build_object('amount_minor',690000,'currency','BRL')
    ),
    'review_evidence',jsonb_build_object(
      'field_sources',jsonb_build_object('model',jsonb_build_array(1),'price',jsonb_build_array(2)),
      'source_lines',jsonb_build_array(
        jsonb_build_object('line_number',1,'raw','iPhone 17 Pro 256GB'),
        jsonb_build_object('line_number',2,'raw','Azul R$ 6.900,00')
      )
    )
  );
  promoted := candidate || jsonb_build_object(
    'stage','READY','domain_outcome','VALID','reviewed_offer',candidate->'interpreted_offer',
    'review','null'::jsonb,
    'auto_promotion',jsonb_build_object('decision','AUTO_PROMOTE',
       'authority_version','external-calc-c01-auto-promotion/v0')
  );

  PERFORM set_config('test.user_id','',false);
  PERFORM public.gate1_assert_reject(promoted,'EXTCALC_UNAUTHENTICATED');
  PERFORM set_config('test.user_id','11111111-1111-4111-8111-111111111111',false);

  PERFORM set_config('test.papel','validador',false);
  PERFORM public.gate1_assert_reject(promoted,'EXTCALC_FORBIDDEN');
  PERFORM set_config('test.papel','dono',false);

  PERFORM public.gate1_assert_reject(promoted,'EXTCALC_AUTO_PROMOTION_SOURCE_UNBOUND');

  INSERT INTO public.extcalc_source_supplier(tenant_id,source_id,supplier_id)
  VALUES(tenant,'source_gate1',supplier);
  PERFORM public.gate1_assert_reject(promoted,'EXTCALC_AUTO_PROMOTION_CANDIDATE_MISSING');

  INSERT INTO public.extcalc_offer(tenant_id,analysis_id,offer_id,source_id)
  VALUES(tenant,'analysis_gate1','offer_gate1','source_gate1');
  INSERT INTO public.extcalc_review_candidate
  (tenant_id,analysis_id,offer_id,offer_revision,candidate_snapshot)
  VALUES(tenant,'analysis_gate1','offer_gate1',1,candidate);

  PERFORM public.gate1_assert_reject(
    jsonb_set(promoted,'{reviewed_offer,price,amount_minor}','700000'::jsonb),
    'EXTCALC_AUTO_PROMOTION_CANDIDATE_MISMATCH'
  );

  changed_candidate := jsonb_set(candidate,'{offer_id}','"offer_bad_price_ref"'::jsonb);
  changed_candidate := jsonb_set(changed_candidate,'{review_evidence,field_sources,price}','[99]'::jsonb);
  changed_promoted := changed_candidate || jsonb_build_object(
    'stage','READY','domain_outcome','VALID','reviewed_offer',changed_candidate->'interpreted_offer',
    'review','null'::jsonb,
    'auto_promotion',jsonb_build_object('decision','AUTO_PROMOTE',
      'authority_version','external-calc-c01-auto-promotion/v0')
  );
  INSERT INTO public.extcalc_offer(tenant_id,analysis_id,offer_id,source_id)
  VALUES(tenant,'analysis_gate1','offer_bad_price_ref','source_gate1');
  INSERT INTO public.extcalc_review_candidate
  (tenant_id,analysis_id,offer_id,offer_revision,candidate_snapshot)
  VALUES(tenant,'analysis_gate1','offer_bad_price_ref',1,changed_candidate);
  PERFORM public.gate1_assert_reject(changed_promoted,'EXTCALC_AUTO_PROMOTION_SOURCE_EVIDENCE_MISMATCH');

  changed_candidate := jsonb_set(candidate,'{offer_id}','"offer_missing_model_ref"'::jsonb);
  changed_candidate := changed_candidate #- '{review_evidence,field_sources,model}';
  changed_promoted := changed_candidate || jsonb_build_object(
    'stage','READY','domain_outcome','VALID','reviewed_offer',changed_candidate->'interpreted_offer',
    'review','null'::jsonb,
    'auto_promotion',jsonb_build_object('decision','AUTO_PROMOTE',
      'authority_version','external-calc-c01-auto-promotion/v0')
  );
  INSERT INTO public.extcalc_offer(tenant_id,analysis_id,offer_id,source_id)
  VALUES(tenant,'analysis_gate1','offer_missing_model_ref','source_gate1');
  INSERT INTO public.extcalc_review_candidate
  (tenant_id,analysis_id,offer_id,offer_revision,candidate_snapshot)
  VALUES(tenant,'analysis_gate1','offer_missing_model_ref',1,changed_candidate);
  PERFORM public.gate1_assert_reject(changed_promoted,'EXTCALC_AUTO_PROMOTION_SOURCE_EVIDENCE_MISSING');

  changed_candidate := jsonb_set(candidate,'{offer_id}','"offer_wrong_supplier"'::jsonb);
  changed_candidate := jsonb_set(changed_candidate,'{interpreted_offer,supplier_id}',to_jsonb(other_supplier::text));
  changed_promoted := changed_candidate || jsonb_build_object(
    'stage','READY','domain_outcome','VALID','reviewed_offer',changed_candidate->'interpreted_offer',
    'review','null'::jsonb,
    'auto_promotion',jsonb_build_object('decision','AUTO_PROMOTE',
      'authority_version','external-calc-c01-auto-promotion/v0')
  );
  INSERT INTO public.extcalc_offer(tenant_id,analysis_id,offer_id,source_id)
  VALUES(tenant,'analysis_gate1','offer_wrong_supplier','source_gate1');
  INSERT INTO public.extcalc_review_candidate
  (tenant_id,analysis_id,offer_id,offer_revision,candidate_snapshot)
  VALUES(tenant,'analysis_gate1','offer_wrong_supplier',1,changed_candidate);
  PERFORM public.gate1_assert_reject(changed_promoted,'EXTCALC_AUTO_PROMOTION_SUPPLIER_MISMATCH');

  PERFORM set_config('test.tenant_id',other_tenant::text,false);
  PERFORM public.gate1_assert_reject(promoted,'EXTCALC_AUTO_PROMOTION_SOURCE_UNBOUND');
  PERFORM set_config('test.tenant_id',tenant::text,false);

  receipt := public.extcalc_persist_auto_promoted_c01_v0(promoted);
  IF receipt->>'ok' IS DISTINCT FROM 'true' OR receipt->>'idempotent' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'VALID_AUTO_PROMOTION_FAILED: %',receipt;
  END IF;
  receipt := public.extcalc_persist_auto_promoted_c01_v0(promoted);
  IF receipt->>'ok' IS DISTINCT FROM 'true' OR receipt->>'idempotent' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'IDEMPOTENCE_FAILED: %',receipt;
  END IF;
  IF (SELECT count(*) FROM public.extcalc_offer_revision)<>1 THEN
    RAISE EXCEPTION 'INVALID_PROMOTIONS_WERE_PERSISTED';
  END IF;

  RAISE NOTICE 'EXTERNAL_CALC_GATE1_DB_GUARD_POSTGRES_SYNTHETIC_V0=PASS';
END;
$gate1$;
