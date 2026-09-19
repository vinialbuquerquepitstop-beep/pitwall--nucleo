'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { executeExternalCalcService } = require('./external-calc-service');
const { calculateC02 } = require('../../external-calc-c02/v1/c02-calculator');
const { runC03Research } = require('../../external-calc-c03/v1/c03-research-core');
const { runC04PriceIndicator } = require('../../external-calc-c04/v1/c04-price-indicator');
const { composeDecisionOutput } = require('../../external-calc-c05/v1/c05-decision-output');

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
    analysis_id: 'ana_service_001',
    source_id: 'src_service_001',
    offer_id: 'off_service_001',
    offer_revision: 1,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-service-001',
    offer_value_fingerprint: 'value-service-001-r1',
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
    provenance_refs: ['human_review:service-fixture'],
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
      calculation_run_id: 'calc_service_001',
      research_run_id: 'research_service_001',
      price_signal_run_id: 'signal_service_001',
      decision_output_id: 'decision_service_001'
    },
    c01_candidate: c01Candidate(),
    calculation_profile: {
      profile_id: 'calc-service-fixture',
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
      profile_id: 'research-service-fixture',
      profile_version: '1',
      required_match_fields: ['model_id', 'capacity_gb', 'condition'],
      min_evidence_confidence: 0.7,
      max_age_seconds: 60 * 60 * 24 * 30
    },
    indicator_profile: {
      profile_id: 'indicator-service-fixture',
      profile_version: '1',
      min_evidence_count: 3,
      cheap_at_or_below_percent: -5,
      expensive_at_or_above_percent: 5
    },
    as_of: '2026-09-19T18:00:00.000Z',
    market_context: { country: 'BR' },
    evidence: [
      evidence('ev_service_1', 600000),
      evidence('ev_service_2', 650000),
      evidence('ev_service_3', 700000)
    ],
    ...overrides
  };
}

function runDirect(r) {
  const c02 = calculateC02({
    calculation_run_id: r.run_ids.calculation_run_id,
    c01_candidate: r.c01_candidate,
    calculation_profile: r.calculation_profile
  });

  const c03 = runC03Research({
    research_run_id: r.run_ids.research_run_id,
    c01_candidate: r.c01_candidate,
    research_profile: r.research_profile,
    as_of: r.as_of,
    market_context: r.market_context || null,
    evidence: Array.isArray(r.evidence) ? r.evidence : []
  });

  const c04 = runC04PriceIndicator({
    price_signal_run_id: r.run_ids.price_signal_run_id,
    c01_candidate: r.c01_candidate,
    c03_research: c03,
    indicator_profile: r.indicator_profile
  });

  const c05 = composeDecisionOutput({
    decision_output_id: r.run_ids.decision_output_id,
    c01_candidate: r.c01_candidate,
    c02_calculation: c02,
    c03_research: c03,
    c04_price_signal: c04
  });

  return { c02, c03, c04, c05 };
}

check('service executa C02-C05 sobre C01 VALID sem persistencia', () => {
  const result = executeExternalCalcService(request());
  assert.strictEqual(result.execution_status, 'SUCCEEDED');
  assert.strictEqual(result.outputs.c02.contract_id, 'C02');
  assert.strictEqual(result.outputs.c03.contract_id, 'C03');
  assert.strictEqual(result.outputs.c04.contract_id, 'C04');
  assert.strictEqual(result.outputs.c05.contract_id, 'C05');
});

check('service produz exatamente os mesmos outputs da execucao direta', () => {
  const r = request();
  const viaService = executeExternalCalcService(r);
  const direct = runDirect(r);
  assert.deepStrictEqual(viaService.outputs, direct);
});

check('paridade tambem vale para INSUFFICIENT_DATA', () => {
  const r = request({
    evidence: [
      evidence('ev_service_small_1', 620000),
      evidence('ev_service_small_2', 680000)
    ]
  });
  const viaService = executeExternalCalcService(r);
  const direct = runDirect(r);
  assert.deepStrictEqual(viaService.outputs, direct);
  assert.strictEqual(viaService.outputs.c05.decision_outcome, 'INSUFFICIENT_DATA');
});

check('service preserva as validacoes canonicas de C01', () => {
  const r = request({
    c01_candidate: c01Candidate({ domain_outcome: 'REVIEW_REQUIRED' })
  });
  assert.throws(() => executeExternalCalcService(r), /C01 precisa estar VALID/);
});

check('service nao altera o request recebido', () => {
  const r = request();
  const before = JSON.stringify(r);
  executeExternalCalcService(r);
  assert.strictEqual(JSON.stringify(r), before);
});

check('mesmo input preserva fingerprints deterministas do core', () => {
  const a = executeExternalCalcService(request());
  const b = executeExternalCalcService(request());
  assert.strictEqual(
    a.core_pipeline.input_fingerprint,
    b.core_pipeline.input_fingerprint
  );
  assert.strictEqual(
    a.core_pipeline.output_fingerprint,
    b.core_pipeline.output_fingerprint
  );
});

check('service e uma fronteira fina sem regras, banco, frontend ou interpreter', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'external-calc-service.js'),
    'utf8'
  ).toLowerCase();

  const forbidden = [
    'interpreter-core',
    'supabase',
    'postgres',
    'database_url',
    'tenant_id',
    'fetch(',
    'http://',
    'https://',
    'document.',
    'window.',
    'localstorage',
    'external-calc-c02',
    'external-calc-c03',
    'external-calc-c04',
    'external-calc-c05'
  ];

  for (const token of forbidden) {
    assert.strictEqual(
      source.includes(token),
      false,
      `dependencia proibida no Service V0: ${token}`
    );
  }

  assert.ok(
    source.includes('external-calc-pipeline/v1/core-pipeline'),
    'Service V0 deve delegar ao core pipeline canonico'
  );
});

console.log(`EXTERNAL_CALC_SERVICE_V0=PASS checks=${ok}`);
