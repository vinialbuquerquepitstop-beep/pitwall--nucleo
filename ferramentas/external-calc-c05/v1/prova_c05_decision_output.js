'use strict';

const assert = require('assert');
const { calculateC02 } = require('../../external-calc-c02/v1/c02-calculator');
const { runC03Research } = require('../../external-calc-c03/v1/c03-research-core');
const { runC04PriceIndicator } = require('../../external-calc-c04/v1/c04-price-indicator');
const {
  CONTRACT_VERSION,
  composeDecisionOutput,
  aggregateAnalysis
} = require('./c05-decision-output');

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

function c01Candidate({
  priceMinor = 650000,
  offerId = 'off_decision_001',
  revision = 1,
  domainOutcome = 'VALID',
  freshnessStatus = 'CURRENT'
} = {}) {
  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_decision_001',
    source_id: 'src_decision_001',
    offer_id: offerId,
    offer_revision: revision,
    execution_status: 'SUCCEEDED',
    domain_outcome: domainOutcome,
    freshness_status: freshnessStatus,
    offer_identity_fingerprint: `identity-${offerId}`,
    offer_value_fingerprint: `value-${offerId}-r${revision}-p${priceMinor}`,
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
      price: { amount_minor: priceMinor, currency: 'BRL' }
    },
    provenance_refs: [`human_review:${offerId}:r${revision}`]
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

function pipeline({
  priceMinor = 650000,
  evidencePrices = [600000, 650000, 700000],
  offerId = 'off_decision_001',
  revision = 1
} = {}) {
  const c01 = c01Candidate({ priceMinor, offerId, revision });

  const c02 = calculateC02({
    calculation_run_id: `calc_${offerId}_r${revision}`,
    c01_candidate: c01,
    calculation_profile: {
      profile_id: 'calc-decision-fixture',
      profile_version: '1',
      currency: 'BRL',
      cash_margin_minor: 55000,
      installment_margin_minor: 65000,
      freight_minor: 0,
      freight_mode: 'STORE',
      installment_base_addon_minor: 10000,
      entry_minor: 0,
      installment_coefficients: { 12: 1.1, 18: 1.2 }
    }
  });

  const c03 = runC03Research({
    research_run_id: `research_${offerId}_r${revision}`,
    c01_candidate: c01,
    research_profile: {
      profile_id: 'research-decision-fixture',
      profile_version: '1',
      required_match_fields: ['model_id', 'capacity_gb', 'condition'],
      min_evidence_confidence: 0.7,
      max_age_seconds: 60 * 60 * 24 * 30
    },
    as_of: '2026-09-19T18:00:00.000Z',
    market_context: { country: 'BR' },
    evidence: evidencePrices.map((price, index) =>
      evidence(`${offerId}_ev_${index + 1}`, price)
    )
  });

  const c04 = runC04PriceIndicator({
    price_signal_run_id: `signal_${offerId}_r${revision}`,
    c01_candidate: c01,
    c03_research: c03,
    indicator_profile: {
      profile_id: 'indicator-decision-fixture',
      profile_version: '1',
      min_evidence_count: 3,
      cheap_at_or_below_percent: -5,
      expensive_at_or_above_percent: 5
    }
  });

  return { c01, c02, c03, c04 };
}

function compose(parts, decisionOutputId = 'decision_001') {
  return composeDecisionOutput({
    decision_output_id: decisionOutputId,
    c01_candidate: parts.c01,
    c02_calculation: parts.c02,
    c03_research: parts.c03,
    c04_price_signal: parts.c04
  });
}

check('C05 compoe pipeline atual em READY', () => {
  const result = compose(pipeline());
  assert.strictEqual(result.contract_version, CONTRACT_VERSION);
  assert.strictEqual(result.execution_status, 'SUCCEEDED');
  assert.strictEqual(result.freshness_status, 'CURRENT');
  assert.strictEqual(result.domain_outcome, 'READY');
  assert.strictEqual(result.decision_outcome, 'READY');
});

check('CHEAP permanece literal no C05 e continua READY', () => {
  const result = compose(pipeline({ priceMinor: 600000 }));
  assert.strictEqual(result.domain_outcome, 'READY');
  assert.strictEqual(result.price_indicator.price_signal, 'CHEAP');
});

check('EXPENSIVE permanece literal no C05 e continua READY', () => {
  const result = compose(pipeline({ priceMinor: 700000 }));
  assert.strictEqual(result.domain_outcome, 'READY');
  assert.strictEqual(result.price_indicator.price_signal, 'EXPENSIVE');
});

check('INSUFFICIENT_DATA do C04 vira outcome C05 sem falha tecnica', () => {
  const result = compose(pipeline({ evidencePrices: [620000, 680000] }));
  assert.strictEqual(result.execution_status, 'SUCCEEDED');
  assert.strictEqual(result.domain_outcome, 'INSUFFICIENT_DATA');
  assert.strictEqual(result.price_indicator.price_signal, 'INSUFFICIENT_DATA');
});

check('C05 copia calculo sem recalcular', () => {
  const parts = pipeline();
  const result = compose(parts);
  assert.deepStrictEqual(
    result.calculation.normal_sale_price,
    parts.c02.normal_sale_price
  );
  assert.deepStrictEqual(
    result.calculation.installments,
    parts.c02.installments
  );
  assert.strictEqual(
    result.calculation.estimated_margin_percent,
    parts.c02.estimated_margin_percent
  );
});

check('C05 nao inventa promocao', () => {
  const result = compose(pipeline());
  assert.strictEqual(result.promotion.promo_price, null);
  assert.strictEqual(result.promotion.promotion_floor, null);
  assert.strictEqual(result.promotion.promotion_range, null);
});

check('C05 copia resumo de pesquisa sem alterar confidence', () => {
  const parts = pipeline();
  const result = compose(parts);
  assert.strictEqual(
    result.research.research_confidence,
    parts.c03.research_confidence
  );
  assert.deepStrictEqual(
    result.research.evidence_summary,
    parts.c03.evidence_summary
  );
});

check('C05 preserva literalmente o Price Signal', () => {
  const parts = pipeline();
  const result = compose(parts);
  assert.strictEqual(
    result.price_indicator.price_signal,
    parts.c04.price_signal
  );
  assert.deepStrictEqual(
    result.price_indicator.market_reference_price,
    parts.c04.market_reference_price
  );
  assert.strictEqual(
    result.price_indicator.market_delta_percent,
    parts.c04.market_delta_percent
  );
});

check('upstream refs apontam para C02 C03 C04 consumidos', () => {
  const parts = pipeline();
  const result = compose(parts);
  assert.deepStrictEqual(result.upstream_refs, {
    c02_calculation_run_id: parts.c02.calculation_run_id,
    c03_research_run_id: parts.c03.research_run_id,
    c04_price_signal_run_id: parts.c04.price_signal_run_id
  });
});

check('C05 recusa C02 stale', () => {
  const parts = pipeline();
  parts.c02.freshness_status = 'STALE';
  assert.throws(() => compose(parts), /C02 precisa estar CURRENT/);
});

check('C05 recusa C02 de revisao antiga', () => {
  const parts = pipeline();
  parts.c02.offer_revision = 2;
  assert.throws(() => compose(parts), /UPSTREAM_STALE: C02/);
});

check('C05 recusa C03 de revisao antiga', () => {
  const parts = pipeline();
  parts.c03.offer_revision = 2;
  assert.throws(() => compose(parts), /UPSTREAM_STALE: C03/);
});

check('C05 recusa C04 de revisao antiga', () => {
  const parts = pipeline();
  parts.c04.offer_revision = 2;
  assert.throws(() => compose(parts), /UPSTREAM_STALE: C04/);
});

check('C05 recusa custo fornecedor C02 divergente do C01', () => {
  const parts = pipeline();
  parts.c02.supplier_offer_price = {
    amount_minor: 1,
    currency: 'BRL'
  };
  assert.throws(() => compose(parts), /supplier_offer_price difere/);
});

check('C05 recusa C04 com evaluated price sem lineage C01', () => {
  const parts = pipeline();
  parts.c04.evaluated_price = {
    amount_minor: 1,
    currency: 'BRL'
  };
  assert.throws(() => compose(parts), /evaluated_price perdeu lineage/);
});

check('C05 recusa C04 que nao referencia o C03 atual', () => {
  const parts = pipeline();
  parts.c04.provenance_refs = parts.c04.provenance_refs.filter(
    ref => !ref.startsWith('research_run:')
  );
  assert.throws(() => compose(parts), /nao referencia o C03 atual/);
});

check('decision fingerprint e output fingerprint sao deterministas', () => {
  const a = compose(pipeline(), 'decision_a');
  const b = compose(pipeline(), 'decision_b');
  assert.strictEqual(a.decision_input_fingerprint, b.decision_input_fingerprint);
  assert.strictEqual(a.output_fingerprint, b.output_fingerprint);
});

check('C05 nao altera nenhum upstream recebido', () => {
  const parts = pipeline();
  const before = JSON.stringify(parts);
  compose(parts);
  assert.strictEqual(JSON.stringify(parts), before);
});

check('aggregation REVIEW_REQUIRED tem precedencia sobre READY', () => {
  const readyParts = pipeline({ offerId: 'off_ready' });
  const ready = compose(readyParts, 'decision_ready');
  const review = c01Candidate({
    offerId: 'off_review',
    domainOutcome: 'REVIEW_REQUIRED'
  });

  const summary = aggregateAnalysis({
    analysis_id: 'ana_decision_001',
    c01_offers: [readyParts.c01, review],
    decision_outputs: [ready]
  });

  assert.strictEqual(summary.analysis_outcome, 'REVIEW_REQUIRED');
  assert.strictEqual(summary.ready_count, 1);
  assert.strictEqual(summary.review_required_count, 1);
});

check('aggregation READY convive com INVALID e EXCLUDED', () => {
  const readyParts = pipeline({ offerId: 'off_ready_2' });
  const ready = compose(readyParts, 'decision_ready_2');
  const invalid = c01Candidate({
    offerId: 'off_invalid',
    domainOutcome: 'INVALID'
  });
  const excluded = c01Candidate({
    offerId: 'off_excluded',
    domainOutcome: 'EXCLUDED'
  });

  const summary = aggregateAnalysis({
    analysis_id: 'ana_decision_001',
    c01_offers: [readyParts.c01, invalid, excluded],
    decision_outputs: [ready]
  });

  assert.strictEqual(summary.analysis_outcome, 'READY');
  assert.strictEqual(summary.ready_count, 1);
  assert.strictEqual(summary.invalid_count, 1);
  assert.strictEqual(summary.excluded_count, 1);
});

check('aggregation INSUFFICIENT_DATA quando nao ha READY nem REVIEW_REQUIRED', () => {
  const parts = pipeline({
    offerId: 'off_insufficient',
    evidencePrices: [620000, 680000]
  });
  const decision = compose(parts, 'decision_insufficient');

  const summary = aggregateAnalysis({
    analysis_id: 'ana_decision_001',
    c01_offers: [parts.c01],
    decision_outputs: [decision]
  });

  assert.strictEqual(summary.analysis_outcome, 'INSUFFICIENT_DATA');
  assert.strictEqual(summary.insufficient_data_count, 1);
});

check('aggregation INVALID quando restam apenas INVALID e EXCLUDED', () => {
  const invalid = c01Candidate({
    offerId: 'off_invalid_only',
    domainOutcome: 'INVALID'
  });
  const excluded = c01Candidate({
    offerId: 'off_excluded_only',
    domainOutcome: 'EXCLUDED'
  });

  const summary = aggregateAnalysis({
    analysis_id: 'ana_decision_001',
    c01_offers: [invalid, excluded],
    decision_outputs: []
  });

  assert.strictEqual(summary.analysis_outcome, 'INVALID');
  assert.strictEqual(summary.invalid_count, 1);
  assert.strictEqual(summary.excluded_count, 1);
});

check('oferta VALID sem C05 atual bloqueia aggregation', () => {
  const valid = c01Candidate({ offerId: 'off_missing_decision' });
  assert.throws(
    () => aggregateAnalysis({
      analysis_id: 'ana_decision_001',
      c01_offers: [valid],
      decision_outputs: []
    }),
    /INCOMPLETE_ANALYSIS/
  );
});

check('C05 de revisao antiga bloqueia aggregation', () => {
  const parts = pipeline({ offerId: 'off_old_decision' });
  const decision = compose(parts, 'decision_old');
  decision.offer_revision = 2;

  assert.throws(
    () => aggregateAnalysis({
      analysis_id: 'ana_decision_001',
      c01_offers: [parts.c01],
      decision_outputs: [decision]
    }),
    /UPSTREAM_STALE/
  );
});

check('offer_id duplicado e rejeitado na aggregation', () => {
  const a = c01Candidate({ offerId: 'off_duplicate' });
  const b = c01Candidate({ offerId: 'off_duplicate' });

  assert.throws(
    () => aggregateAnalysis({
      analysis_id: 'ana_decision_001',
      c01_offers: [a, b],
      decision_outputs: []
    }),
    /offer_id duplicado/
  );
});

check('C05 orfao e rejeitado na aggregation', () => {
  const parts = pipeline({ offerId: 'off_orphan' });
  const decision = compose(parts, 'decision_orphan');

  assert.throws(
    () => aggregateAnalysis({
      analysis_id: 'ana_decision_001',
      c01_offers: [],
      decision_outputs: [decision]
    }),
    /C05 sem C01 correspondente/
  );
});

console.log(`C05_FIXTURES=PASS checks=${ok}`);
