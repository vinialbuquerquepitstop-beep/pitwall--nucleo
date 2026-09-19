'use strict';

const assert = require('assert');
const { executeExternalCalcService } = require('../../external-calc-service/v0/external-calc-service');
const {
  buildPersistenceBundle,
  validatePersistenceBundle,
  reconstructExecution,
  createInMemoryLifecycleAdapter,
  createLifecycleRepository
} = require('./lifecycle-repository');

const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const EXECUTION_ID = '10000000-0000-4000-8000-000000000001';
const REVIEW_ID = '20000000-0000-4000-8000-000000000001';
const PERSISTED_AT = '2026-09-19T20:30:00.000Z';

let ok = 0;
function check(name, fn) {
  try {
    fn();
    ok += 1;
    console.log(`OK ${ok} - ${name}`);
  } catch (error) {
    console.error(`FALHOU - ${name}`);
    throw error;
  }
}

function c01Candidate() {
  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_persist_001',
    source_id: 'src_persist_001',
    offer_id: 'off_persist_001',
    offer_revision: 2,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-persist-001',
    offer_value_fingerprint: 'value-persist-001-r2',
    reviewed_offer: {
      supplier_id: 'SUP_TESTE',
      model: {
        id: 'iphone-17-pro-256',
        label: 'iPhone 17 Pro 256GB',
        attributes: {}
      },
      capacity_gb: 256,
      condition: 'LACRADO',
      color: 'PRETO',
      price: { amount_minor: 650000, currency: 'BRL' }
    },
    review: {
      decision: 'EDIT',
      reviewer_ref: 'fixture-reviewer',
      reviewed_at: '2026-09-19T18:20:00.000Z',
      reason: 'fixture lifecycle',
      material_change: true,
      original_offer_revision: 1
    },
    provenance_refs: ['human_review:fixture-reviewer:2026-09-19T18:20:00.000Z']
  };
}

function evidence(id, price) {
  return {
    evidence_id: id,
    source_ref: `fixture:${id}`,
    observed_at: '2026-09-19T12:00:00.000Z',
    product: {
      model_id: 'iphone-17-pro-256',
      model_label: 'iPhone 17 Pro 256GB',
      capacity_gb: 256,
      condition: 'LACRADO',
      color: 'AZUL'
    },
    normalized_price: price,
    currency: 'BRL',
    confidence: 0.9
  };
}

function request(overrides = {}) {
  return {
    run_ids: {
      calculation_run_id: 'calc_persist_001',
      research_run_id: 'research_persist_001',
      price_signal_run_id: 'signal_persist_001',
      decision_output_id: 'decision_persist_001'
    },
    c01_candidate: c01Candidate(),
    calculation_profile: {
      profile_id: 'calc-persist-fixture',
      profile_version: '1',
      currency: 'BRL',
      cash_margin_minor: 55000,
      installment_margin_minor: 65000,
      freight_minor: 0,
      freight_mode: 'STORE',
      installment_base_addon_minor: 10000,
      entry_minor: 0,
      installment_coefficients: { 12: 1.1, 18: 1.2 }
    },
    research_profile: {
      profile_id: 'research-persist-fixture',
      profile_version: '1',
      required_match_fields: ['model_id', 'capacity_gb', 'condition'],
      min_evidence_confidence: 0.7,
      max_age_seconds: 60 * 60 * 24 * 30
    },
    indicator_profile: {
      profile_id: 'indicator-persist-fixture',
      profile_version: '1',
      min_evidence_count: 3,
      cheap_at_or_below_percent: -5,
      expensive_at_or_above_percent: 5
    },
    as_of: '2026-09-19T18:30:00.000Z',
    market_context: { country: 'BR' },
    evidence: [
      evidence('ev_persist_1', 600000),
      evidence('ev_persist_2', 650000),
      evidence('ev_persist_3', 700000)
    ],
    ...overrides
  };
}

function fixture() {
  const req = request();
  const result = executeExternalCalcService(req);
  return { req, result };
}

check('bundle materializa Analysis Offer OfferRevision Execution Run Evidence HumanReview', () => {
  const { req, result } = fixture();
  const bundle = buildPersistenceBundle({
    tenant_id: TENANT_ID,
    execution_id: EXECUTION_ID,
    review_id: REVIEW_ID,
    persisted_at: PERSISTED_AT,
    request: req,
    service_result: result
  });

  assert.strictEqual(bundle.analysis.analysis_id, req.c01_candidate.analysis_id);
  assert.strictEqual(bundle.offer.offer_id, req.c01_candidate.offer_id);
  assert.strictEqual(bundle.offer_revision.offer_revision, 2);
  assert.strictEqual(bundle.execution.execution_id, EXECUTION_ID);
  assert.deepStrictEqual(bundle.runs.map(item => item.contract_id), ['C02','C03','C04','C05']);
  assert.strictEqual(bundle.evidence.length, 3);
  assert.strictEqual(bundle.human_review.review_id, REVIEW_ID);
});

check('bundle preserva snapshots exatos de request e response', () => {
  const { req, result } = fixture();
  const bundle = buildPersistenceBundle({
    tenant_id: TENANT_ID,
    execution_id: EXECUTION_ID,
    review_id: REVIEW_ID,
    persisted_at: PERSISTED_AT,
    request: req,
    service_result: result
  });

  assert.deepStrictEqual(bundle.execution.request_snapshot, req);
  assert.deepStrictEqual(bundle.execution.response_snapshot, result);
});

check('cada Run preserva id versoes fingerprints output e provenance do contrato', () => {
  const { req, result } = fixture();
  const bundle = buildPersistenceBundle({
    tenant_id: TENANT_ID,
    execution_id: EXECUTION_ID,
    review_id: REVIEW_ID,
    persisted_at: PERSISTED_AT,
    request: req,
    service_result: result
  });

  for (const run of bundle.runs) {
    assert.ok(run.run_id);
    assert.ok(run.contract_version);
    assert.ok(run.engine_version);
    assert.ok(run.input_fingerprint);
    assert.ok(run.output_fingerprint);
    assert.ok(Array.isArray(run.provenance_refs));
    assert.strictEqual(run.output_snapshot.contract_id, run.contract_id);
  }
});

check('reconstrucao devolve exatamente request e Service result originais', () => {
  const { req, result } = fixture();
  const bundle = buildPersistenceBundle({
    tenant_id: TENANT_ID,
    execution_id: EXECUTION_ID,
    review_id: REVIEW_ID,
    persisted_at: PERSISTED_AT,
    request: req,
    service_result: result
  });
  const replay = reconstructExecution(bundle);

  assert.deepStrictEqual(replay.request, req);
  assert.deepStrictEqual(replay.service_result, result);
  assert.strictEqual(replay.lineage.analysis_id, req.c01_candidate.analysis_id);
  assert.strictEqual(replay.lineage.offer_revision, 2);
});

check('Repository persiste fecha carrega e reconstrui sem regra de dominio', () => {
  const { req, result } = fixture();
  const adapter = createInMemoryLifecycleAdapter();
  const repository = createLifecycleRepository(adapter);

  repository.persistExecution({
    tenant_id: TENANT_ID,
    execution_id: EXECUTION_ID,
    review_id: REVIEW_ID,
    persisted_at: PERSISTED_AT,
    request: req,
    service_result: result
  });

  const replay = repository.loadExecution({
    tenant_id: TENANT_ID,
    execution_id: EXECUTION_ID
  });

  assert.deepStrictEqual(replay.request, req);
  assert.deepStrictEqual(replay.service_result, result);
});

check('Repository isola leitura por tenant', () => {
  const { req, result } = fixture();
  const adapter = createInMemoryLifecycleAdapter();
  const repository = createLifecycleRepository(adapter);

  repository.persistExecution({
    tenant_id: TENANT_ID,
    execution_id: EXECUTION_ID,
    review_id: REVIEW_ID,
    persisted_at: PERSISTED_AT,
    request: req,
    service_result: result
  });

  const otherTenant = '00000000-0000-4000-8000-000000000002';
  assert.strictEqual(repository.loadExecution({
    tenant_id: otherTenant,
    execution_id: EXECUTION_ID
  }), null);
});

check('integridade detecta run alterado depois da persistencia', () => {
  const { req, result } = fixture();
  const bundle = buildPersistenceBundle({
    tenant_id: TENANT_ID,
    execution_id: EXECUTION_ID,
    review_id: REVIEW_ID,
    persisted_at: PERSISTED_AT,
    request: req,
    service_result: result
  });

  bundle.runs[0].output_snapshot.output_fingerprint = 'tampered';
  assert.throws(() => validatePersistenceBundle(bundle), /C02 snapshot divergente/);
});

check('integridade detecta Evidence perdida', () => {
  const { req, result } = fixture();
  const bundle = buildPersistenceBundle({
    tenant_id: TENANT_ID,
    execution_id: EXECUTION_ID,
    review_id: REVIEW_ID,
    persisted_at: PERSISTED_AT,
    request: req,
    service_result: result
  });

  bundle.evidence.pop();
  assert.throws(() => validatePersistenceBundle(bundle), /Evidence\[\] contagem divergente/);
});

check('persistencia nao altera request nem Service result', () => {
  const { req, result } = fixture();
  const beforeReq = JSON.stringify(req);
  const beforeResult = JSON.stringify(result);

  buildPersistenceBundle({
    tenant_id: TENANT_ID,
    execution_id: EXECUTION_ID,
    review_id: REVIEW_ID,
    persisted_at: PERSISTED_AT,
    request: req,
    service_result: result
  });

  assert.strictEqual(JSON.stringify(req), beforeReq);
  assert.strictEqual(JSON.stringify(result), beforeResult);
});

console.log(`EXTERNAL_CALC_PERSISTENCE_V0=PASS checks=${ok}`);
