-- Only against ephemeral PostgreSQL. Zero real supplier data or credentials.
CREATE FUNCTION public.quarantine_expect_error(p_code text,p_active boolean,p_candidates bigint,p_revisions bigint)
RETURNS void LANGUAGE plpgsql AS $test$
DECLARE v_message text;
BEGIN
  BEGIN
    PERFORM public.extcalc_set_analysis_quarantine_v0(
      'analysis_incident',p_active,'Synthetic Gate 1 incident proof',p_candidates,p_revisions);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    IF v_message IS DISTINCT FROM p_code THEN
      RAISE EXCEPTION 'EXPECTED %, GOT %',p_code,v_message;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'UNEXPECTED QUARANTINE WRITE: expected %',p_code;
END $test$;

DO $run$
DECLARE
  tenant uuid := '22222222-2222-4222-8222-222222222222';
  other_tenant uuid := '55555555-5555-4555-8555-555555555555';
  actor uuid := '11111111-1111-4111-8111-111111111111';
  current_count bigint;
  history_count bigint;
  home_count bigint;
  receipt jsonb;
  error_message text;
BEGIN
  PERFORM set_config('test.user_id',actor::text,false);
  PERFORM set_config('test.tenant_id',tenant::text,false);
  PERFORM set_config('test.papel','dono',false);

  INSERT INTO public.extcalc_analysis(tenant_id,analysis_id)
   VALUES (tenant,'analysis_incident'),(tenant,'analysis_other'),
          (other_tenant,'analysis_incident');
  FOR i IN 1..25 LOOP
    INSERT INTO public.extcalc_review_candidate(
      tenant_id,analysis_id,offer_id,offer_revision,candidate_snapshot
    ) VALUES(tenant,'analysis_incident','off_'||i,1,'{}'::jsonb);
    IF i<=24 THEN
      INSERT INTO public.extcalc_offer_revision(
        tenant_id,analysis_id,offer_id,offer_revision,c01_contract_version,
        c01_snapshot,offer_identity_fingerprint,offer_value_fingerprint,
        domain_outcome,freshness_status)
      VALUES(tenant,'analysis_incident','off_'||i,1,'c01-test/v0',
        jsonb_build_object('execution_status','SUCCEEDED',
          'analysis_id','analysis_incident','reviewed_offer',jsonb_build_object(
            'model',jsonb_build_object('id','iphone-test'),
            'price',jsonb_build_object('amount_minor',450000,'currency','BRL'))),
        'identity_'||i,'value_'||i,'VALID','CURRENT');
    END IF;
  END LOOP;
  FOR i IN 1..39 LOOP
    INSERT INTO public.extcalc_offer_revision(
      tenant_id,analysis_id,offer_id,offer_revision,c01_contract_version,
      c01_snapshot,offer_identity_fingerprint,offer_value_fingerprint,
      domain_outcome,freshness_status)
    VALUES(tenant,'analysis_other','safe_'||i,1,'c01-test/v0',
      jsonb_build_object('execution_status','SUCCEEDED',
        'analysis_id','analysis_other','reviewed_offer',jsonb_build_object(
          'model',jsonb_build_object('id','iphone-safe'))),
      'safe_identity_'||i,'safe_value_'||i,'VALID','CURRENT');
  END LOOP;
  FOR i IN 1..2 LOOP
    INSERT INTO public.extcalc_offer_revision(
      tenant_id,analysis_id,offer_id,offer_revision,c01_contract_version,
      c01_snapshot,offer_identity_fingerprint,offer_value_fingerprint,
      domain_outcome,freshness_status)
    VALUES(other_tenant,'analysis_incident','other_'||i,1,'c01-test/v0',
      jsonb_build_object('execution_status','SUCCEEDED',
        'analysis_id','analysis_incident','reviewed_offer',jsonb_build_object(
          'model',jsonb_build_object('id','iphone-other'))),
      'other_identity_'||i,'other_value_'||i,'VALID','CURRENT');
  END LOOP;

  SELECT count(*) INTO current_count FROM public.extcalc_product_current_offers_v0();
  IF current_count<>63 THEN RAISE EXCEPTION 'BEFORE EXPECTED 63, GOT %',current_count; END IF;
  SELECT count(*) INTO home_count FROM public.extcalc_product_home_context_v1();
  IF home_count<>63 THEN RAISE EXCEPTION 'HOME BEFORE EXPECTED 63, GOT %',home_count; END IF;

  -- Tenant+role permissions, guard against wrong expected counts and no events on failure.
  PERFORM set_config('test.user_id','',false);
  PERFORM public.quarantine_expect_error('EXTCALC_UNAUTHENTICATED',true,25,24);
  PERFORM set_config('test.user_id',actor::text,false);
  PERFORM set_config('test.papel','validador',false);
  PERFORM public.quarantine_expect_error('EXTCALC_FORBIDDEN',true,25,24);
  PERFORM set_config('test.papel','dono',false);
  PERFORM public.quarantine_expect_error('EXTCALC_QUARANTINE_PRECONDITION_MISMATCH',true,25,23);

  receipt:=public.extcalc_set_analysis_quarantine_v0('analysis_incident',true,
    'Synthetic incident: isolate incomplete WhatsApp list',25,24);
  IF receipt->>'ok' IS DISTINCT FROM 'true' OR receipt->>'idempotent' IS DISTINCT FROM 'false'
     OR receipt->>'active' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'INITIAL QUARANTINE FAILED: %',receipt;
  END IF;
  receipt:=public.extcalc_set_analysis_quarantine_v0('analysis_incident',true,
    'Retry same quarantine safely',25,24);
  IF receipt->>'idempotent' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'IDEMPOTENCE FAILED: %',receipt;
  END IF;
  SELECT count(*) INTO current_count FROM public.extcalc_product_current_offers_v0();
  IF current_count<>39 THEN RAISE EXCEPTION 'QUARANTINE EXPECTED 39, GOT %',current_count; END IF;
  SELECT count(*) INTO home_count FROM public.extcalc_product_home_context_v1();
  IF home_count<>39 THEN RAISE EXCEPTION 'QUARANTINE HOME EXPECTED 39, GOT %',home_count; END IF;

  BEGIN
    PERFORM public.extcalc_product_source_execution_v0('analysis_incident','off_1',1);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS error_message=MESSAGE_TEXT;
  END;
  IF error_message IS DISTINCT FROM 'EXTCALC_ANALYSIS_QUARANTINED' THEN
    RAISE EXCEPTION 'DIRECT REFERENCE NOT BLOCKED: %',error_message;
  END IF;

  -- Stale Worker retries must not recreate/update/delete a quarantined revision.
  error_message:=null;
  BEGIN
    INSERT INTO public.extcalc_offer_revision(
      tenant_id,analysis_id,offer_id,offer_revision,c01_contract_version,
      c01_snapshot,offer_identity_fingerprint,offer_value_fingerprint,
      domain_outcome,freshness_status)
    VALUES(tenant,'analysis_incident','stale_retry',1,'c01-test/v0',
      '{"execution_status":"SUCCEEDED","reviewed_offer":{}}'::jsonb,
      'stale-identity','stale-value','VALID','CURRENT');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS error_message=MESSAGE_TEXT;
  END;
  IF error_message IS DISTINCT FROM 'EXTCALC_ANALYSIS_QUARANTINED' THEN
    RAISE EXCEPTION 'STALE INSERT NOT BLOCKED: %',error_message;
  END IF;
  error_message:=null;
  BEGIN
    UPDATE public.extcalc_offer_revision
       SET freshness_status='STALE'
     WHERE tenant_id=tenant AND analysis_id='analysis_incident' AND offer_id='off_1';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS error_message=MESSAGE_TEXT;
  END;
  IF error_message IS DISTINCT FROM 'EXTCALC_ANALYSIS_QUARANTINED' THEN
    RAISE EXCEPTION 'REVISION UPDATE NOT BLOCKED: %',error_message;
  END IF;
  error_message:=null;
  BEGIN
    DELETE FROM public.extcalc_offer_revision
      WHERE tenant_id=tenant AND analysis_id='analysis_incident' AND offer_id='off_1';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS error_message=MESSAGE_TEXT;
  END;
  IF error_message IS DISTINCT FROM 'EXTCALC_ANALYSIS_QUARANTINED' THEN
    RAISE EXCEPTION 'REVISION DELETE NOT BLOCKED: %',error_message;
  END IF;

  IF (SELECT count(*) FROM privado.extcalc_analysis_quarantine_event_v0)<>1 THEN
    RAISE EXCEPTION 'IDEMPOTENT RETRY CREATED EXTRA EVENT';
  END IF;
  IF has_table_privilege('authenticated','privado.extcalc_analysis_quarantine_v0','SELECT')
     OR has_table_privilege('anon','privado.extcalc_analysis_quarantine_v0','INSERT')
     OR has_function_privilege('anon',
       'public.extcalc_set_analysis_quarantine_v0(text,boolean,text,bigint,bigint)','EXECUTE')
     OR NOT has_function_privilege('authenticated',
       'public.extcalc_set_analysis_quarantine_v0(text,boolean,text,bigint,bigint)','EXECUTE')
  THEN
    RAISE EXCEPTION 'UNSAFE TABLE OR FUNCTION ACL';
  END IF;

  PERFORM set_config('test.tenant_id',other_tenant::text,false);
  SELECT count(*) INTO current_count FROM public.extcalc_product_current_offers_v0();
  IF current_count<>2 THEN RAISE EXCEPTION 'CROSS TENANT VISIBILITY LOST'; END IF;
  PERFORM public.quarantine_expect_error('EXTCALC_QUARANTINE_PRECONDITION_MISMATCH',true,25,24);
  PERFORM set_config('test.tenant_id',tenant::text,false);

  receipt:=public.extcalc_set_analysis_quarantine_v0('analysis_incident',false,
    'Rollback after isolated verification, keep full history',25,24);
  IF receipt->>'ok' IS DISTINCT FROM 'true' OR receipt->>'active' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'ROLLBACK FAILED: %',receipt;
  END IF;
  SELECT count(*) INTO current_count FROM public.extcalc_product_current_offers_v0();
  SELECT count(*) INTO home_count FROM public.extcalc_product_home_context_v1();
  SELECT count(*) INTO history_count FROM public.extcalc_offer_revision;
  IF current_count<>63 OR home_count<>63 OR history_count<>65 THEN
    RAISE EXCEPTION 'ROLLBACK COUNTS WRONG: current %,home %,history %',
      current_count,home_count,history_count;
  END IF;
  IF (SELECT count(*) FROM privado.extcalc_analysis_quarantine_event_v0)<>2 THEN
    RAISE EXCEPTION 'AUDIT EVENT HISTORY NOT PRESERVED';
  END IF;
  IF (SELECT count(*) FROM public.extcalc_review_candidate)<>25 THEN
    RAISE EXCEPTION 'CANDIDATE HISTORY MODIFIED';
  END IF;
  RAISE NOTICE 'EXTERNAL_CALC_GATE1_QUARANTINE_POSTGRES_V0=PASS before=63 isolated=39 rollback=63 history=65';
END $run$;
