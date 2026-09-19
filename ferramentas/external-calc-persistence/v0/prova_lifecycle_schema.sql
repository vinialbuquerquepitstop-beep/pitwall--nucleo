-- Prova transacional do External Calc Lifecycle / Persistence V0.
-- Nao deixa dados: BEGIN ... ROLLBACK.
-- Deve ser executada apenas depois da migration 20260919_external_calc_lifecycle_persistence_v0.

begin;

do $$
declare
  v_tenant uuid;
  v_execution uuid := '30000000-0000-4000-8000-000000000001'::uuid;
  v_review uuid := '40000000-0000-4000-8000-000000000001'::uuid;
  v_count integer;
  v_bad integer;
  v_response jsonb;
begin
  select id into v_tenant from public.tenant order by id limit 1;
  if v_tenant is null then
    raise exception 'PERSISTENCE_PROOF: tenant ausente';
  end if;

  insert into public.extcalc_analysis (tenant_id, analysis_id)
  values (v_tenant, 'ana_db_proof_001');

  insert into public.extcalc_offer (tenant_id, analysis_id, offer_id, source_id)
  values (v_tenant, 'ana_db_proof_001', 'off_db_proof_001', 'src_db_proof_001');

  insert into public.extcalc_offer_revision (
    tenant_id, analysis_id, offer_id, offer_revision,
    c01_contract_version, c01_snapshot,
    offer_identity_fingerprint, offer_value_fingerprint,
    domain_outcome, freshness_status
  ) values (
    v_tenant, 'ana_db_proof_001', 'off_db_proof_001', 2,
    'external-calc-c01-readonly/v1',
    '{"contract_id":"C01","offer_revision":2}'::jsonb,
    'identity-db-proof', 'value-db-proof-r2',
    'VALID', 'CURRENT'
  );

  insert into public.extcalc_human_review (
    review_id, tenant_id, analysis_id, offer_id, offer_revision,
    decision, reviewer_ref, reviewed_at, review_snapshot
  ) values (
    v_review, v_tenant, 'ana_db_proof_001', 'off_db_proof_001', 2,
    'EDIT', 'db-proof-reviewer', '2026-09-19T20:30:00Z',
    '{"decision":"EDIT","reviewer_ref":"db-proof-reviewer"}'::jsonb
  );

  insert into public.extcalc_execution (
    execution_id, tenant_id, analysis_id, offer_id, offer_revision,
    service_version, service_engine_version,
    core_contract_version, core_engine_version,
    core_input_fingerprint, core_output_fingerprint,
    execution_status, freshness_status,
    request_snapshot, response_snapshot
  ) values (
    v_execution, v_tenant, 'ana_db_proof_001', 'off_db_proof_001', 2,
    'external-calc-service/v0', 'external-calc-service/0.1.0',
    'external-calc-core-pipeline/v1', 'external-calc-core-pipeline/1.0.0',
    'core-input-db-proof', 'core-output-db-proof',
    'SUCCEEDED', 'CURRENT',
    '{"c01_candidate":{"offer_id":"off_db_proof_001","offer_revision":2},"evidence":[{"evidence_id":"ev_db_1"}]}'::jsonb,
    '{"service_version":"external-calc-service/v0","outputs":{"c02":{"contract_id":"C02"},"c03":{"contract_id":"C03"},"c04":{"contract_id":"C04"},"c05":{"contract_id":"C05"}}}'::jsonb
  );

  insert into public.extcalc_run (
    tenant_id, execution_id, analysis_id, offer_id, offer_revision,
    contract_id, run_id, contract_version, engine_version, stage,
    execution_status, domain_outcome, freshness_status,
    input_fingerprint, output_fingerprint, provenance_refs, output_snapshot
  )
  select
    v_tenant, v_execution, 'ana_db_proof_001', 'off_db_proof_001', 2,
    x.contract_id, x.run_id, x.contract_version, x.engine_version, x.stage,
    'SUCCEEDED', x.domain_outcome, 'CURRENT',
    x.input_fingerprint, x.output_fingerprint, '[]'::jsonb,
    jsonb_build_object('contract_id', x.contract_id, 'run_id', x.run_id)
  from (values
    ('C02','calc_db_1','external-calc-c02/v1','c02-calculator/1.0.0','CALCULATION',null,'in-c02','out-c02'),
    ('C03','research_db_1','external-calc-c03/v1','c03-research/1.0.0','RESEARCH',null,'in-c03','out-c03'),
    ('C04','signal_db_1','external-calc-c04/v1','c04-price-indicator/1.0.0','PRICE_INDICATOR','MARKET','in-c04','out-c04'),
    ('C05','decision_db_1','external-calc-c05/v1','c05-decision-output/1.0.1','DECISION_OUTPUT','READY','in-c05','out-c05')
  ) as x(contract_id,run_id,contract_version,engine_version,stage,domain_outcome,input_fingerprint,output_fingerprint);

  insert into public.extcalc_evidence (
    tenant_id, execution_id, analysis_id, offer_id, offer_revision,
    evidence_id, observed_at, evidence_snapshot
  ) values (
    v_tenant, v_execution, 'ana_db_proof_001', 'off_db_proof_001', 2,
    'ev_db_1', '2026-09-19T12:00:00Z',
    '{"evidence_id":"ev_db_1","normalized_price":650000,"currency":"BRL"}'::jsonb
  );

  select count(*) into v_count from public.extcalc_run
  where tenant_id = v_tenant and execution_id = v_execution;
  if v_count <> 4 then
    raise exception 'PERSISTENCE_PROOF: runs %, esperado 4', v_count;
  end if;

  select response_snapshot into v_response
  from public.extcalc_execution
  where tenant_id = v_tenant and execution_id = v_execution;

  if v_response #>> '{outputs,c05,contract_id}' <> 'C05' then
    raise exception 'PERSISTENCE_PROOF: response_snapshot nao reconstruiu C05';
  end if;

  select count(*) into v_count from public.extcalc_evidence
  where tenant_id = v_tenant and execution_id = v_execution;
  if v_count <> 1 then
    raise exception 'PERSISTENCE_PROOF: evidence %, esperado 1', v_count;
  end if;

  select count(*) into v_count from public.extcalc_human_review
  where tenant_id = v_tenant and review_id = v_review;
  if v_count <> 1 then
    raise exception 'PERSISTENCE_PROOF: human review ausente';
  end if;

  select count(*) into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'extcalc_analysis','extcalc_offer','extcalc_offer_revision',
      'extcalc_human_review','extcalc_execution','extcalc_run','extcalc_evidence'
    )
    and c.relrowsecurity is not true;
  if v_bad <> 0 then
    raise exception 'PERSISTENCE_PROOF: tabela extcalc sem RLS';
  end if;

  select count(*) into v_bad
  from pg_policies
  where schemaname = 'public'
    and tablename like 'extcalc_%'
    and (
      cmd <> 'SELECT'
      or 'authenticated' <> all(roles)
      or qual not like '%fn_tenant_atual%'
    );
  if v_bad <> 0 then
    raise exception 'PERSISTENCE_PROOF: policy extcalc fora da fronteira';
  end if;

  select count(*) into v_bad
  from (values
    ('extcalc_analysis'),('extcalc_offer'),('extcalc_offer_revision'),
    ('extcalc_human_review'),('extcalc_execution'),('extcalc_run'),('extcalc_evidence')
  ) as t(name)
  where has_table_privilege('authenticated', 'public.' || t.name, 'INSERT')
     or has_table_privilege('authenticated', 'public.' || t.name, 'UPDATE')
     or has_table_privilege('authenticated', 'public.' || t.name, 'DELETE');
  if v_bad <> 0 then
    raise exception 'PERSISTENCE_PROOF: authenticated ganhou escrita';
  end if;

  select count(*) into v_bad
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_namespace srcn on srcn.oid = src.relnamespace
  join pg_class dst on dst.oid = con.confrelid
  join pg_namespace dstn on dstn.oid = dst.relnamespace
  where con.contype = 'f'
    and srcn.nspname = 'public'
    and src.relname like 'extcalc_%'
    and not (
      dstn.nspname = 'public'
      and (dst.relname = 'tenant' or dst.relname like 'extcalc_%')
    );
  if v_bad <> 0 then
    raise exception 'PERSISTENCE_PROOF: FK extcalc cruza dominio';
  end if;
end
$$;

rollback;
