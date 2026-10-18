'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  runC01ReadOnlySlice,
  applyHumanReview
} = require('../../external-calc-c01/v1/c01-readonly-bridge');
const { calculateC02 } = require('../../external-calc-c02/v1/c02-calculator');
const { runC03Research } = require('../../external-calc-c03/v1/c03-research-core');
const { runC04PriceIndicator } = require('../../external-calc-c04/v1/c04-price-indicator');
const {
  composeDecisionOutput,
  aggregateAnalysis
} = require('../../external-calc-c05/v1/c05-decision-output');

const schema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../interpreter-core/v1/domains/apple-iphone-v0.schema.json'),
  'utf8'
));
const knowledge = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../interpreter-core/v1/domains/apple-iphone-v0.knowledge.json'),
  'utf8'
));

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

function supplierProfiles() {
  return {
    contract_version: 'supplier-profiles/v1',
    profiles: [{
      id: 'SUP_CHAIN',
      label: 'Loja Chain',
      aliases: ['LOJA CHAIN']
    }]
  };
}

function runEntry() {
  return runC01ReadOnlySlice({
    analysis_id: 'ana_chain_001',
    source_id: 'src_chain_001',
    currency: 'BRL',
    document: {
      contract_version: 'raw-document/v1',
      document_id: 'doc_chain_001',
      content: 'LOJA CHAIN\niPhone 17 512GB Preto Lacrado - 8.100',
      source: { kind: 'plain_text' }
    },
    schema,
    knowledge,
    supplier_profiles: supplierProfiles()
  });
}

function calcProfile() {
  return {
    profile_id: 'chain-calc-profile',
    profile_version: '1',
    currency: 'BRL',
    cash_margin_minor: 55000,
    installment_margin_minor: 65000,
    freight_minor: 0,
    freight_mode: 'STORE',
    installment_base_addon_minor: 10000,
    entry_minor: 0,
    installment_coefficients: {
      12: 1.1,
      18: 1.2
    }
  };
}

function researchProfile() {
  return {
    profile_id: 'chain-research-profile',
    profile_version: '1',
    required_match_fields: ['model_id', 'capacity_gb'],
    min_evidence_confidence: 0.7,
    max_age_seconds: 60 * 60 * 24 * 30
  };
}

function indicatorProfile() {
  return {
    profile_id: 'chain-indicator-profile',
    profile_version: '1',
    min_evidence_count: 3,
    cheap_at_or_below_percent: -5,
    expensive_at_or_above_percent: 5
  };
}

function evidenceFor(c01, id, priceMinor) {
  const offer = c01.reviewed_offer;
  return {
    evidence_id: id,
    source_ref: `chain-fixture:${id}`,
    observed_at: '2026-09-19T12:00:00.000Z',
    product: {
      model_id: offer.model.id,
      model_label: offer.model.label,
      capacity_gb: offer.capacity_gb,
      condition: offer.condition,
      color: offer.color
    },
    normalized_price: priceMinor,
    currency: offer.price.currency,
    confidence: 0.9
  };
}

function runC02(c01, suffix) {
  return calculateC02({
    calculation_run_id: `calc_chain_${suffix}`,
    c01_candidate: c01,
    calculation_profile: calcProfile()
  });
}

function runC03(c01, suffix, prices = [790000, 810000, 830000]) {
  return runC03Research({
    research_run_id: `research_chain_${suffix}`,
    c01_candidate: c01,
    research_profile: researchProfile(),
    as_of: '2026-09-19T18:00:00.000Z',
    market_context: { country: 'BR' },
    evidence: prices.map((price, index) =>
      evidenceFor(c01, `chain_ev_${suffix}_${index + 1}`, price)
    )
  });
}

function runC04(c01, c03, suffix) {
  return runC04PriceIndicator({
    price_signal_run_id: `signal_chain_${suffix}`,
    c01_candidate: c01,
    c03_research: c03,
    indicator_profile: indicatorProfile()
  });
}

function runC05(c01, c02, c03, c04, suffix) {
  return composeDecisionOutput({
    decision_output_id: `decision_chain_${suffix}`,
    c01_candidate: c01,
    c02_calculation: c02,
    c03_research: c03,
    c04_price_signal: c04
  });
}

const queue = runEntry();
const candidate = queue.candidates[0];

check('entrada bruta chega ao C01 com fornecedor e exige review', () => {
  assert.strictEqual(queue.candidates.length, 1);
  assert.strictEqual(candidate.domain_outcome, 'REVIEW_REQUIRED');
  assert.strictEqual(candidate.interpreted_offer.supplier_id, 'SUP_CHAIN');
  assert.strictEqual(candidate.interpreted_offer.model.id, 'iphone_17_512gb');
  assert.deepStrictEqual(candidate.interpreted_offer.price, {
    amount_minor: 810000,
    currency: 'BRL'
  });
});

const c01r1 = applyHumanReview(candidate, {
  decision: 'ACCEPT',
  reviewer_ref: 'chain-reviewer',
  reviewed_at: '2026-09-19T18:01:00.000Z'
});
const c02r1 = runC02(c01r1, 'r1');
const c03r1 = runC03(c01r1, 'r1');
const c04r1 = runC04(c01r1, c03r1, 'r1');
const c05r1 = runC05(c01r1, c02r1, c03r1, c04r1, 'r1');

check('cadeia C01→C02/C03→C04→C05 fecha READY', () => {
  assert.strictEqual(c01r1.domain_outcome, 'VALID');
  assert.strictEqual(c02r1.execution_status, 'SUCCEEDED');
  assert.strictEqual(c03r1.execution_status, 'SUCCEEDED');
  assert.strictEqual(c04r1.domain_outcome, 'MARKET');
  assert.strictEqual(c05r1.domain_outcome, 'READY');

  const summary = aggregateAnalysis({
    analysis_id: c01r1.analysis_id,
    c01_offers: [c01r1],
    decision_outputs: [c05r1]
  });
  assert.strictEqual(summary.analysis_outcome, 'READY');
  assert.strictEqual(summary.ready_count, 1);
});

check('lineage preserva mesma oferta e revisao em C02 C04 C05', () => {
  assert.strictEqual(c02r1.offer_id, c01r1.offer_id);
  assert.strictEqual(c04r1.offer_id, c01r1.offer_id);
  assert.strictEqual(c05r1.offer_id, c01r1.offer_id);
  assert.strictEqual(c02r1.offer_revision, 1);
  assert.strictEqual(c04r1.offer_revision, 1);
  assert.strictEqual(c05r1.offer_revision, 1);
  assert.strictEqual(c04r1.evaluated_price_basis, 'SUPPLIER_OFFER_PRICE');
  assert.deepStrictEqual(c04r1.evaluated_price, c01r1.reviewed_offer.price);
});

const c01r2Price = applyHumanReview(candidate, {
  decision: 'EDIT',
  reviewer_ref: 'chain-reviewer',
  reviewed_at: '2026-09-19T18:02:00.000Z',
  reason: 'preco conferido na fonte',
  patch: {
    price: { amount_minor: 799000, currency: 'BRL' }
  }
});

check('revisao apenas de preco incrementa revision sem mudar identidade', () => {
  assert.strictEqual(c01r2Price.offer_revision, 2);
  assert.strictEqual(
    c01r2Price.offer_identity_fingerprint,
    c01r1.offer_identity_fingerprint
  );
  assert.notStrictEqual(
    c01r2Price.offer_value_fingerprint,
    c01r1.offer_value_fingerprint
  );
});

check('outputs dependentes da revisao antiga sao rejeitados', () => {
  assert.throws(
    () => runC05(c01r2Price, c02r1, c03r1, c04r1, 'stale'),
    /UPSTREAM_STALE/
  );
});

const c02r2 = runC02(c01r2Price, 'r2');
const c04r2Reuse = runC04(c01r2Price, c03r1, 'r2_reuse');
const c05r2Reuse = runC05(
  c01r2Price,
  c02r2,
  c03r1,
  c04r2Reuse,
  'r2_reuse'
);

check('revisao apenas de preco reutiliza C03 e recompõe C02 C04 C05', () => {
  assert.strictEqual(c03r1.offer_revision, 1);
  assert.strictEqual(c04r2Reuse.offer_revision, 2);
  assert.strictEqual(c05r2Reuse.offer_revision, 2);
  assert.strictEqual(
    c05r2Reuse.research.research_run_id,
    c03r1.research_run_id
  );
  assert.strictEqual(c04r2Reuse.evaluated_price.amount_minor, 799000);
  assert.strictEqual(c05r2Reuse.reviewed_offer.price.amount_minor, 799000);

  const summary = aggregateAnalysis({
    analysis_id: c01r2Price.analysis_id,
    c01_offers: [c01r2Price],
    decision_outputs: [c05r2Reuse]
  });
  assert.strictEqual(summary.analysis_outcome, 'READY');
});

const c01r2Identity = applyHumanReview(candidate, {
  decision: 'EDIT',
  reviewer_ref: 'chain-reviewer',
  reviewed_at: '2026-09-19T18:03:00.000Z',
  reason: 'capacidade corrigida',
  patch: { capacity_gb: 256 }
});

check('mudanca de identidade invalida reutilizacao da pesquisa antiga', () => {
  assert.notStrictEqual(
    c01r2Identity.offer_identity_fingerprint,
    c01r1.offer_identity_fingerprint
  );

  assert.throws(
    () => runC04(c01r2Identity, c03r1, 'identity_changed'),
    /research_subject difere/
  );
});

const c03Insufficient = runC03(c01r1, 'insufficient', [800000, 820000]);
const c04Insufficient = runC04(c01r1, c03Insufficient, 'insufficient');
const c05Insufficient = runC05(
  c01r1,
  c02r1,
  c03Insufficient,
  c04Insufficient,
  'insufficient'
);

check('dados de mercado insuficientes continuam sucesso tecnico e outcome explicito', () => {
  assert.strictEqual(c03Insufficient.execution_status, 'SUCCEEDED');
  assert.strictEqual(c04Insufficient.execution_status, 'SUCCEEDED');
  assert.strictEqual(c04Insufficient.domain_outcome, 'INSUFFICIENT_DATA');
  assert.strictEqual(c05Insufficient.execution_status, 'SUCCEEDED');
  assert.strictEqual(c05Insufficient.domain_outcome, 'INSUFFICIENT_DATA');

  const summary = aggregateAnalysis({
    analysis_id: c01r1.analysis_id,
    c01_offers: [c01r1],
    decision_outputs: [c05Insufficient]
  });
  assert.strictEqual(summary.analysis_outcome, 'INSUFFICIENT_DATA');
});

console.log(`EXTERNAL_CALC_CHAIN=PASS checks=${ok}`);
console.log('CHAIN_ENTRY=RAW_TEXT');
console.log('CHAIN_EXIT=C05_DECISION_OUTPUT');
console.log('CHAIN_SELECTIVE_STALENESS=PASS');
