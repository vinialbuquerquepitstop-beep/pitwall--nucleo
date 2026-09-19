'use strict';

const assert = require('assert');
const { runExternalCalcCorePipeline } = require('./core-pipeline');

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

function c01Candidate(overrides = {}) {
  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_pipeline_001',
    source_id: 'src_pipeline_001',
    offer_id: 'off_pipeline_001',
    offer_revision: 1,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-pipeline-001',
    offer_value_fingerprint: 'value-pipeline-001-r1',
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
    provenance_refs: ['human_review:pipeline-fixture'],
    ...overrides
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
      calculation_run_id: 'calc_pipeline_001',
      research_run_id: 'research_pipeline_001',
      price_signal_run_id: 'signal_pipeline_001',
      decision_output_id: 'decision_pipeline_001'
    },
    c01_candidate: c01Candidate(),
    calculation_profile: {
      profile_id: 'calc-pipeline-fixture',
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
      profile_id: 'research-pipeline-fixture',
      profile_version: '1',
      required_match_fields: ['model_id', 'capacity_gb', 'condition'],
      min_evidence_confidence: 0.7,
      max_age_seconds: 60 * 60 * 24 * 30
    },
    indicator_profile: {
      profile_id: 'indicator-pipeline-fixture',
      profile_version: '1',
      min_evidence_count: 3,
      cheap_at_or_below_percent: -5,
      expensive_at_or_above_percent: 5
    },
    as_of: '2026-09-19T18:00:00.000Z',
    market_context: { country: 'BR' },
    evidence: [
      evidence('ev_pipeline_1', 600000),
      evidence('ev_pipeline_2', 650000),
      evidence('ev_pipeline_3', 700000)
    ],
    ...overrides
  };
}

check('pipeline executa C02 C03 C04 C05 em sequencia', () => {
  const result = runExternalCalcCorePipeline(request());
  assert.strictEqual(result.execution_status, 'SUCCEEDED');
  assert.strictEqual(result.outputs.c02.contract_id, 'C02');
  assert.strictEqual(result.outputs.c03.contract_id, 'C03');
  assert.strictEqual(result.outputs.c04.contract_id, 'C04');
  assert.strictEqual(result.outputs.c05.contract_id, 'C05');
});

check('lineage mantem a mesma oferta e revisao em todos os outputs', () => {
  const result = runExternalCalcCorePipeline(request());
  for (const output of Object.values(result.outputs)) {
    assert.strictEqual(output.offer_id, 'off_pipeline_001');
    assert.strictEqual(output.offer_revision, 1);
  }
});

check('C02 usa exatamente o preco revisado de C01', () => {
  const result = runExternalCalcCorePipeline(request());
  assert.deepStrictEqual(result.outputs.c02.supplier_offer_price, {
    amount_minor: 650000,
    currency: 'BRL'
  });
});

check('C04 avalia exatamente o preco fornecedor vindo de C01', () => {
  const result = runExternalCalcCorePipeline(request());
  assert.strictEqual(result.outputs.c04.evaluated_price_basis, 'SUPPLIER_OFFER_PRICE');
  assert.strictEqual(result.outputs.c04.evaluated_price_source_contract, 'C01');
  assert.strictEqual(result.outputs.c04.evaluated_price_source_field, 'reviewed_offer.price');
  assert.strictEqual(result.outputs.c04.evaluated_price.amount_minor, 650000);
});

check('C05 apenas compoe os outputs upstream', () => {
  const result = runExternalCalcCorePipeline(request());
  assert.deepStrictEqual(
    result.outputs.c05.calculation.normal_sale_price,
    result.outputs.c02.normal_sale_price
  );
  assert.strictEqual(
    result.outputs.c05.research.research_run_id,
    result.outputs.c03.research_run_id
  );
  assert.strictEqual(
    result.outputs.c05.price_indicator.price_signal_run_id,
    result.outputs.c04.price_signal_run_id
  );
});

check('pipeline retorna READY com evidencia suficiente', () => {
  const result = runExternalCalcCorePipeline(request());
  assert.strictEqual(result.outputs.c05.decision_outcome, 'READY');
  assert.strictEqual(result.outputs.c05.price_indicator.price_signal, 'MARKET');
});

check('pipeline preserva INSUFFICIENT_DATA sem falha tecnica', () => {
  const r = request({
    evidence: [
      evidence('ev_pipeline_small_1', 620000),
      evidence('ev_pipeline_small_2', 680000)
    ]
  });
  const result = runExternalCalcCorePipeline(r);
  assert.strictEqual(result.execution_status, 'SUCCEEDED');
  assert.strictEqual(result.outputs.c05.decision_outcome, 'INSUFFICIENT_DATA');
});

check('pipeline recusa C01 ainda em review', () => {
  const r = request({
    c01_candidate: c01Candidate({ domain_outcome: 'REVIEW_REQUIRED' })
  });
  assert.throws(() => runExternalCalcCorePipeline(r), /C01 precisa estar VALID/);
});

check('pipeline recusa C01 stale', () => {
  const r = request({
    c01_candidate: c01Candidate({ freshness_status: 'STALE' })
  });
  assert.throws(() => runExternalCalcCorePipeline(r), /C01 precisa estar CURRENT/);
});

check('pipeline nao altera os inputs recebidos', () => {
  const r = request();
  const before = JSON.stringify(r);
  runExternalCalcCorePipeline(r);
  assert.strictEqual(JSON.stringify(r), before);
});

check('mesmo input produz fingerprints deterministas', () => {
  const a = runExternalCalcCorePipeline(request());
  const b = runExternalCalcCorePipeline(request());
  assert.strictEqual(a.input_fingerprint, b.input_fingerprint);
  assert.strictEqual(a.output_fingerprint, b.output_fingerprint);
});

check('run ids diferentes nao alteram semantica do output', () => {
  const a = runExternalCalcCorePipeline(request());
  const b = runExternalCalcCorePipeline(request({
    run_ids: {
      calculation_run_id: 'calc_pipeline_999',
      research_run_id: 'research_pipeline_999',
      price_signal_run_id: 'signal_pipeline_999',
      decision_output_id: 'decision_pipeline_999'
    }
  }));
  assert.deepStrictEqual(
    a.outputs.c05.price_indicator.market_reference_price,
    b.outputs.c05.price_indicator.market_reference_price
  );
  assert.deepStrictEqual(
    a.outputs.c05.calculation.normal_sale_price,
    b.outputs.c05.calculation.normal_sale_price
  );
  assert.strictEqual(a.outputs.c05.decision_outcome, b.outputs.c05.decision_outcome);
});

console.log(`CORE_PIPELINE_FIXTURES=PASS checks=${ok}`);
