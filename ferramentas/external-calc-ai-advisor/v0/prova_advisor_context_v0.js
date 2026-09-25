'use strict';

const assert = require('assert');
const { calculateC02 } = require('../../external-calc-c02/v1/c02-calculator');
const { runC03Research } = require('../../external-calc-c03/v1/c03-research-core');
const { runC04PriceIndicator } = require('../../external-calc-c04/v1/c04-price-indicator');
const { composeDecisionOutput } = require('../../external-calc-c05/v1/c05-decision-output');
const {
  CONTRACT_VERSION,
  buildAdvisorContext,
  validateAdvisorCandidate
} = require('./advisor-context');

let ok = 0;

function check(name, fn) {
  try {
    fn();
    ok += 1;
    console.log('OK ' + ok + ' - ' + name);
  } catch (error) {
    console.error('FALHOU - ' + name);
    throw error;
  }
}

function c01Candidate(options = {}) {
  const color = options.color || 'PRETO';
  const priceMinor = options.priceMinor || 650000;
  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_advisor_001',
    source_id: 'src_advisor_001',
    offer_id: 'off_advisor_001',
    offer_revision: 3,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-advisor-001',
    offer_value_fingerprint: 'value-advisor-001-r3-p' + priceMinor + '-' + color,
    reviewed_offer: {
      supplier_id: 'SUP_ADVISOR',
      model: {
        id: 'iphone-17-pro-256',
        label: 'iPhone 17 Pro',
        attributes: {}
      },
      capacity_gb: 256,
      condition: 'LACRADO',
      color,
      price: { amount_minor: priceMinor, currency: 'BRL' }
    },
    provenance_refs: ['human_review:off_advisor_001:r3']
  };
}

function evidence(id, price, options = {}) {
  const modelId = options.modelId || 'iphone-17-pro-256';
  const color = options.color || 'PRETO';
  const capacityGb = options.capacityGb || 256;
  return {
    evidence_id: id,
    source_ref: 'fixture:' + id,
    source_url: 'https://example.invalid/' + id,
    observed_at: '2026-09-24T12:00:00.000Z',
    product: {
      model_id: modelId,
      model_label: modelId === 'iphone-17-pro-256' ? 'iPhone 17 Pro' : 'Outro modelo',
      capacity_gb: capacityGb,
      condition: 'LACRADO',
      color
    },
    normalized_price: price,
    currency: 'BRL',
    confidence: 0.94
  };
}

function readyFixture(options = {}) {
  const c01 = c01Candidate();
  const evidenceList = options.evidenceRecords || [
    evidence('ev_a', 620000),
    evidence('ev_b', 650000),
    evidence('ev_c', 680000)
  ];
  const requiredMatchFields = options.requiredMatchFields || [
    'model_id',
    'capacity_gb',
    'condition',
    'color'
  ];

  const c02 = calculateC02({
    calculation_run_id: 'calc_advisor_001',
    c01_candidate: c01,
    calculation_profile: {
      profile_id: 'calc-advisor-fixture',
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
    research_run_id: 'research_advisor_001',
    c01_candidate: c01,
    research_profile: {
      profile_id: 'research-advisor-fixture',
      profile_version: '1',
      required_match_fields: requiredMatchFields,
      min_evidence_confidence: 0.7,
      max_age_seconds: 60 * 60 * 24 * 30
    },
    as_of: '2026-09-24T18:00:00.000Z',
    market_context: { country: 'BR' },
    evidence: evidenceList
  });

  const c04 = runC04PriceIndicator({
    price_signal_run_id: 'signal_advisor_001',
    c01_candidate: c01,
    c03_research: c03,
    indicator_profile: {
      profile_id: 'indicator-advisor-fixture',
      profile_version: '1',
      min_evidence_count: 3,
      cheap_at_or_below_percent: -5,
      expensive_at_or_above_percent: 5
    }
  });

  const c05 = composeDecisionOutput({
    decision_output_id: 'decision_advisor_001',
    c01_candidate: c01,
    c02_calculation: c02,
    c03_research: c03,
    c04_price_signal: c04
  });

  return { c01, c02, c03, c04, c05, evidenceList };
}

function requestFrom(fixture, overrides = {}) {
  return {
    authority_context: {
      tenant_id: 'tenant_a',
      resource_tenant_id: 'tenant_a',
      actor_role: 'dono',
      ...(overrides.authority_context || {})
    },
    expected: {
      analysis_id: fixture.c05.analysis_id,
      offer_id: fixture.c05.offer_id,
      offer_revision: fixture.c05.offer_revision,
      ...(overrides.expected || {})
    },
    c05_decision_output: overrides.c05_decision_output || fixture.c05,
    evidence_records: overrides.evidence_records || fixture.evidenceList
  };
}

check('dono recebe contexto READY_FOR_MODEL pos-C05', () => {
  const fixture = readyFixture();
  const context = buildAdvisorContext(requestFrom(fixture));
  assert.strictEqual(context.contract_version, CONTRACT_VERSION);
  assert.strictEqual(context.advisor_status, 'READY_FOR_MODEL');
  assert(context.model_input);
});

check('validador autorizado recebe o mesmo contrato', () => {
  const fixture = readyFixture();
  const context = buildAdvisorContext(requestFrom(fixture, {
    authority_context: { actor_role: 'validador' }
  }));
  assert.strictEqual(context.actor_role, 'validador');
});

check('vendedor permanece bloqueado no Advisor V0', () => {
  const fixture = readyFixture();
  assert.throws(() => buildAdvisorContext(requestFrom(fixture, {
    authority_context: { actor_role: 'vendedor' }
  })), /ADVISOR_FORBIDDEN/);
});

check('tenant divergente falha fechado', () => {
  const fixture = readyFixture();
  assert.throws(() => buildAdvisorContext(requestFrom(fixture, {
    authority_context: { resource_tenant_id: 'tenant_b' }
  })), /TENANT_MISMATCH/);
});

check('analysis divergente e rejeitada', () => {
  const fixture = readyFixture();
  assert.throws(() => buildAdvisorContext(requestFrom(fixture, {
    expected: { analysis_id: 'ana_outra' }
  })), /ADVISOR_SOURCE_MISMATCH/);
});

check('offer divergente e rejeitada', () => {
  const fixture = readyFixture();
  assert.throws(() => buildAdvisorContext(requestFrom(fixture, {
    expected: { offer_id: 'off_outra' }
  })), /ADVISOR_SOURCE_MISMATCH/);
});

check('revision divergente e rejeitada', () => {
  const fixture = readyFixture();
  assert.throws(() => buildAdvisorContext(requestFrom(fixture, {
    expected: { offer_revision: 2 }
  })), /ADVISOR_SOURCE_MISMATCH/);
});

check('C05 stale e rejeitado', () => {
  const fixture = readyFixture();
  const stale = JSON.parse(JSON.stringify(fixture.c05));
  stale.freshness_status = 'STALE';
  assert.throws(() => buildAdvisorContext(requestFrom(fixture, {
    c05_decision_output: stale
  })), /C05 precisa estar CURRENT/);
});

check('C05 failed e rejeitado', () => {
  const fixture = readyFixture();
  const failed = JSON.parse(JSON.stringify(fixture.c05));
  failed.execution_status = 'FAILED';
  assert.throws(() => buildAdvisorContext(requestFrom(fixture, {
    c05_decision_output: failed
  })), /C05 precisa estar SUCCEEDED/);
});

check('INSUFFICIENT_DATA bloqueia modelo sem inventar conclusao', () => {
  const fixture = readyFixture({
    evidenceRecords: [evidence('ev_a', 620000), evidence('ev_b', 680000)]
  });
  const context = buildAdvisorContext(requestFrom(fixture));
  assert.strictEqual(context.advisor_status, 'BLOCKED_INSUFFICIENT_DATA');
  assert.strictEqual(context.model_input, null);
});

check('identidade e preco selecionados sao preservados literalmente', () => {
  const fixture = readyFixture();
  const context = buildAdvisorContext(requestFrom(fixture));
  assert.strictEqual(
    context.model_input.facts.offer.model.id,
    fixture.c05.reviewed_offer.model.id
  );
  assert.strictEqual(context.model_input.facts.offer.capacity_gb, 256);
  assert.strictEqual(context.model_input.facts.offer.color, 'PRETO');
  assert.deepStrictEqual(
    context.model_input.facts.offer.supplier_offer_price,
    fixture.c05.reviewed_offer.price
  );
});

check('calculos internos sao copiados sem recalculo', () => {
  const fixture = readyFixture();
  const context = buildAdvisorContext(requestFrom(fixture));
  assert.deepStrictEqual(
    context.model_input.facts.commercial.store_cost,
    fixture.c05.calculation.store_cost
  );
  assert.deepStrictEqual(
    context.model_input.facts.commercial.normal_sale_price,
    fixture.c05.calculation.normal_sale_price
  );
  assert.strictEqual(
    context.model_input.facts.commercial.estimated_margin_percent,
    fixture.c05.calculation.estimated_margin_percent
  );
});

check('evidencias elegiveis viram refs permitidas e permanecem rastreaveis', () => {
  const fixture = readyFixture();
  const context = buildAdvisorContext(requestFrom(fixture));
  assert(context.model_input.allowed_evidence_refs.includes('evidence:ev_a'));
  assert(
    context.model_input.allowed_evidence_refs.includes(
      'decision_output:' + fixture.c05.decision_output_id
    )
  );
});

check('candidate output aceita ate tres insights somente com refs permitidas', () => {
  const fixture = readyFixture();
  const context = buildAdvisorContext(requestFrom(fixture));
  const validated = validateAdvisorCandidate({
    context,
    candidate_output: {
      insights: [
        {
          insight_id: 'ins_1',
          type: 'MARKET_POSITION',
          severity: 'MEDIUM',
          evidence_refs: [
            'evidence:ev_a',
            'decision_output:' + fixture.c05.decision_output_id
          ],
          summary: 'A oferta esta abaixo da referencia de mercado validada.',
          confidence: 0.9
        }
      ]
    }
  });
  assert.strictEqual(validated.validator_status, 'PASS');
  assert.strictEqual(validated.candidate_output.insights.length, 1);
});

check('perfil amplo de C03 nao permite outra cor alimentar o Advisor', () => {
  const mixed = [
    evidence('ev_a', 620000),
    evidence('ev_b', 640000, { color: 'AZUL' }),
    evidence('ev_c', 660000),
    evidence('ev_d', 680000)
  ];
  const fixture = readyFixture({
    evidenceRecords: mixed,
    requiredMatchFields: ['model_id', 'capacity_gb', 'condition']
  });
  assert.strictEqual(fixture.c05.decision_outcome, 'READY');
  assert(
    fixture.c05.research.eligible_evidence_ids.includes('ev_b'),
    'fixture precisa provar que C03 aceitou a outra cor'
  );
  assert.throws(
    () => buildAdvisorContext(requestFrom(fixture)),
    /ADVISOR_EVIDENCE_MISMATCH/
  );
});

console.log('AI_ADVISOR_A1_FIXTURES=PASS checks=' + ok);
