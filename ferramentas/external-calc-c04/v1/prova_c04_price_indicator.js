'use strict';

const assert = require('assert');
const { runC03Research } = require('../../external-calc-c03/v1/c03-research-core');
const {
  CONTRACT_VERSION,
  medianMinor,
  classify,
  runC04PriceIndicator
} = require('./c04-price-indicator');

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

function candidate(priceMinor = 650000, overrides = {}) {
  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_price_001',
    source_id: 'src_price_001',
    offer_id: 'off_price_001',
    offer_revision: 1,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-price-v1',
    offer_value_fingerprint: `value-price-${priceMinor}`,
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
    provenance_refs: ['human_review:fixture'],
    ...overrides
  };
}

function rawEvidence(id, price, overrides = {}) {
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
    confidence: 0.9,
    ...overrides
  };
}

function research(c01, prices = [600000, 650000, 700000], overrides = {}) {
  return runC03Research({
    research_run_id: 'research_price_001',
    c01_candidate: c01,
    research_profile: {
      profile_id: 'research-price-fixture',
      profile_version: '1',
      required_match_fields: ['model_id', 'capacity_gb', 'condition'],
      min_evidence_confidence: 0.7,
      max_age_seconds: 60 * 60 * 24 * 30
    },
    as_of: '2026-09-19T18:00:00.000Z',
    market_context: { country: 'BR' },
    evidence: prices.map((price, index) => rawEvidence(`ev_${index + 1}`, price)),
    ...overrides
  });
}

function indicatorProfile(overrides = {}) {
  return {
    profile_id: 'indicator-fixture',
    profile_version: '1',
    min_evidence_count: 3,
    cheap_at_or_below_percent: -5,
    expensive_at_or_above_percent: 5,
    ...overrides
  };
}

function run(priceMinor = 650000, prices, overrides = {}) {
  const c01 = overrides.c01_candidate || candidate(priceMinor);
  const c03 = overrides.c03_research || research(c01, prices);
  return runC04PriceIndicator({
    price_signal_run_id: 'signal_run_001',
    c01_candidate: c01,
    c03_research: c03,
    indicator_profile: indicatorProfile(overrides.indicator_profile)
  });
}

check('mediana impar usa o valor central', () => {
  assert.strictEqual(medianMinor([600000, 700000, 650000]), 650000);
});

check('mediana par arredonda para minor unit mais proxima', () => {
  assert.strictEqual(medianMinor([100001, 100002]), 100002);
});

check('thresholds ficam no profile e sao inclusivos', () => {
  const p = indicatorProfile();
  assert.strictEqual(classify(-5, p), 'CHEAP');
  assert.strictEqual(classify(0, p), 'MARKET');
  assert.strictEqual(classify(5, p), 'EXPENSIVE');
});

check('C04 usa explicitamente o preco da oferta revisada C01', () => {
  const result = run(650000);
  assert.strictEqual(result.contract_version, CONTRACT_VERSION);
  assert.deepStrictEqual(result.evaluated_price, {
    amount_minor: 650000,
    currency: 'BRL'
  });
  assert.strictEqual(result.evaluated_price_basis, 'SUPPLIER_OFFER_PRICE');
  assert.strictEqual(result.evaluated_price_source_contract, 'C01');
  assert.strictEqual(result.evaluated_price_source_field, 'reviewed_offer.price');
});

check('mediana V0 vira market_reference_price', () => {
  const result = run(650000);
  assert.deepStrictEqual(result.market_reference_price, {
    amount_minor: 650000,
    currency: 'BRL'
  });
  assert.strictEqual(result.market_delta_amount.amount_minor, 0);
  assert.strictEqual(result.market_delta_percent, 0);
  assert.strictEqual(result.domain_outcome, 'MARKET');
});

check('oferta abaixo da faixa vira CHEAP', () => {
  const result = run(600000);
  assert.strictEqual(result.domain_outcome, 'CHEAP');
  assert.strictEqual(result.price_signal, 'CHEAP');
  assert.strictEqual(result.market_delta_amount.amount_minor, -50000);
  assert.strictEqual(result.market_delta_percent, -7.6923);
});

check('oferta acima da faixa vira EXPENSIVE', () => {
  const result = run(700000);
  assert.strictEqual(result.domain_outcome, 'EXPENSIVE');
  assert.strictEqual(result.market_delta_amount.amount_minor, 50000);
  assert.strictEqual(result.market_delta_percent, 7.6923);
});

check('menos evidencias que o profile exige vira INSUFFICIENT_DATA', () => {
  const result = run(650000, [620000, 680000]);
  assert.strictEqual(result.execution_status, 'SUCCEEDED');
  assert.strictEqual(result.domain_outcome, 'INSUFFICIENT_DATA');
  assert.strictEqual(result.market_reference_price, null);
  assert.strictEqual(result.market_delta_amount, null);
  assert.strictEqual(result.market_delta_percent, null);
});

check('C03 sem evidencia nao vira falha tecnica no C04', () => {
  const result = run(650000, []);
  assert.strictEqual(result.execution_status, 'SUCCEEDED');
  assert.strictEqual(result.domain_outcome, 'INSUFFICIENT_DATA');
  assert.strictEqual(result.comparable_evidence_count, 0);
});

check('C04 usa apenas evidencias elegiveis do C03', () => {
  const c01 = candidate(650000);
  const c03 = research(c01, undefined, {
    evidence: [
      rawEvidence('eligible_1', 640000),
      rawEvidence('eligible_2', 650000),
      rawEvidence('eligible_3', 660000),
      rawEvidence('wrong_capacity', 100000, {
        product: {
          model_id: 'iphone-17-pro-256',
          model_label: 'iPhone 17 Pro 512GB',
          capacity_gb: 512,
          condition: 'LACRADO',
          color: 'PRETO'
        }
      })
    ]
  });

  const result = runC04PriceIndicator({
    price_signal_run_id: 'signal_eligible_only',
    c01_candidate: c01,
    c03_research: c03,
    indicator_profile: indicatorProfile()
  });

  assert.strictEqual(c03.evidence_summary.total, 4);
  assert.strictEqual(c03.evidence_summary.eligible, 3);
  assert.strictEqual(result.comparable_evidence_count, 3);
  assert.strictEqual(result.market_reference_price.amount_minor, 650000);
  assert.ok(!result.evidence_ids.includes('wrong_capacity'));
});

check('price_signal_confidence fica namespaced e deriva da pesquisa V0', () => {
  const result = run();
  assert.strictEqual(result.price_signal_confidence, 0.9);
  assert.strictEqual(result.confidence_basis, 'C03_RESEARCH_CONFIDENCE_V0');
});

check('C04 reutiliza C03 de revisao anterior quando mudou apenas o preco', () => {
  const c01r1 = candidate(650000);
  const c03r1 = research(c01r1);
  const c01r2 = candidate(640000, {
    offer_revision: 2,
    offer_identity_fingerprint: c01r1.offer_identity_fingerprint,
    offer_value_fingerprint: 'value-price-r2'
  });

  const result = runC04PriceIndicator({
    price_signal_run_id: 'signal_price_revision_2',
    c01_candidate: c01r2,
    c03_research: c03r1,
    indicator_profile: indicatorProfile()
  });

  assert.strictEqual(c03r1.offer_revision, 1);
  assert.strictEqual(result.offer_revision, 2);
  assert.strictEqual(result.evaluated_price.amount_minor, 640000);
  assert.ok(result.provenance_refs.includes('research_run:research_price_001'));
});

check('C04 recusa C03 antigo quando identidade da oferta mudou', () => {
  const c01r1 = candidate(650000);
  const c03r1 = research(c01r1);
  const c01r2 = JSON.parse(JSON.stringify(c01r1));
  c01r2.offer_revision = 2;
  c01r2.offer_identity_fingerprint = 'identity-capacity-r2';
  c01r2.offer_value_fingerprint = 'value-capacity-r2';
  c01r2.reviewed_offer.capacity_gb = 512;

  assert.throws(
    () => runC04PriceIndicator({
      price_signal_run_id: 'signal_identity_revision_2',
      c01_candidate: c01r2,
      c03_research: c03r1,
      indicator_profile: indicatorProfile()
    }),
    /research_subject difere/
  );
});

check('C04 recusa C03 stale', () => {
  const c01 = candidate();
  const c03 = research(c01);
  c03.freshness_status = 'STALE';

  assert.throws(
    () => runC04PriceIndicator({
      price_signal_run_id: 'signal_stale_c03',
      c01_candidate: c01,
      c03_research: c03,
      indicator_profile: indicatorProfile()
    }),
    /C03 precisa estar CURRENT/
  );
});

check('C04 recusa C01 nao validado', () => {
  const c01 = candidate(650000, { domain_outcome: 'REVIEW_REQUIRED' });
  assert.throws(
    () => runC04PriceIndicator({
      price_signal_run_id: 'signal_unreviewed',
      c01_candidate: c01,
      c03_research: research(candidate()),
      indicator_profile: indicatorProfile()
    }),
    /C01 precisa estar VALID/
  );
});

check('moeda divergente em evidencia elegivel e bloqueada', () => {
  const c01 = candidate();
  const c03 = research(c01);
  c03.evidence[0].currency = 'USD';

  assert.throws(
    () => runC04PriceIndicator({
      price_signal_run_id: 'signal_bad_currency',
      c01_candidate: c01,
      c03_research: c03,
      indicator_profile: indicatorProfile()
    }),
    /moeda divergente/
  );
});

check('faixa invalida do indicator profile e rejeitada', () => {
  assert.throws(
    () => run(650000, undefined, {
      indicator_profile: {
        cheap_at_or_below_percent: 10,
        expensive_at_or_above_percent: 5
      }
    }),
    /faixa MARKET invalida/
  );
});

check('fingerprints sao deterministas para o mesmo snapshot', () => {
  const a = run();
  const b = run();
  assert.strictEqual(a.price_signal_input_fingerprint, b.price_signal_input_fingerprint);
  assert.strictEqual(a.output_fingerprint, b.output_fingerprint);
});

check('provenance inclui oferta, research run, evidencias e profile', () => {
  const result = run();
  assert.ok(result.provenance_refs.includes('human_review:fixture'));
  assert.ok(result.provenance_refs.includes('research_run:research_price_001'));
  assert.ok(result.provenance_refs.includes('evidence:ev_1'));
  assert.ok(result.provenance_refs.includes('indicator_profile:indicator-fixture:1'));
});

check('C04 nao altera C01 nem C03 recebidos', () => {
  const c01 = candidate();
  const c03 = research(c01);
  const beforeC01 = JSON.stringify(c01);
  const beforeC03 = JSON.stringify(c03);

  runC04PriceIndicator({
    price_signal_run_id: 'signal_immutability',
    c01_candidate: c01,
    c03_research: c03,
    indicator_profile: indicatorProfile()
  });

  assert.strictEqual(JSON.stringify(c01), beforeC01);
  assert.strictEqual(JSON.stringify(c03), beforeC03);
});

console.log(`C04_FIXTURES=PASS checks=${ok}`);
