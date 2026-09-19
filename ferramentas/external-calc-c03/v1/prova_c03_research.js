'use strict';

const assert = require('assert');
const {
  CONTRACT_VERSION,
  deriveResearchSubject,
  runC03Research
} = require('./c03-research-core');

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
  const offer = {
    supplier_id: 'SUP_TESTE',
    model: {
      id: 'iphone-17-pro-256',
      label: 'iPhone 17 Pro 256GB',
      attributes: { family: 'iphone' }
    },
    capacity_gb: 256,
    condition: 'LACRADO',
    color: 'PRETO',
    price: { amount_minor: 650000, currency: 'BRL' },
    ...(overrides.reviewed_offer || {})
  };

  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_research_001',
    source_id: 'src_research_001',
    offer_id: 'off_research_001',
    offer_revision: 1,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-research-v1',
    offer_value_fingerprint: 'value-research-v1',
    reviewed_offer: offer,
    provenance_refs: [
      'interpretation_run:int_research_001',
      'human_review:fixture:2026-09-19T18:00:00.000Z'
    ],
    ...overrides,
    reviewed_offer: offer
  };
}

function profile(overrides = {}) {
  return {
    profile_id: 'market-br-fixture',
    profile_version: '1',
    required_match_fields: ['model_id', 'capacity_gb', 'condition'],
    min_evidence_confidence: 0.7,
    max_age_seconds: 60 * 60 * 24 * 30,
    ...overrides
  };
}

function evidence(id, overrides = {}) {
  return {
    evidence_id: id,
    source_ref: `fixture-source:${id}`,
    source_url: `https://example.invalid/${id}`,
    title: `Oferta ${id}`,
    observed_at: '2026-09-10T12:00:00.000Z',
    product: {
      model_id: 'iphone-17-pro-256',
      model_label: 'iPhone 17 Pro 256GB',
      capacity_gb: 256,
      condition: 'LACRADO',
      color: 'AZUL'
    },
    normalized_price: 680000,
    currency: 'BRL',
    confidence: 0.9,
    ...overrides
  };
}

function run(overrides = {}) {
  return runC03Research({
    research_run_id: 'research_run_001',
    c01_candidate: c01Candidate(),
    research_profile: profile(),
    as_of: '2026-09-19T18:00:00.000Z',
    market_context: { country: 'BR' },
    evidence: [
      evidence('ev_1'),
      evidence('ev_2', { normalized_price: 700000, confidence: 0.8 })
    ],
    ...overrides
  });
}

check('ResearchSubject nasce do C01 revisado, nao do C02', () => {
  const candidate = c01Candidate();
  const subject = deriveResearchSubject(candidate, { country: 'BR' });
  assert.deepStrictEqual(subject, {
    model_id: 'iphone-17-pro-256',
    model_label: 'iPhone 17 Pro 256GB',
    capacity_gb: 256,
    condition: 'LACRADO',
    color: 'PRETO',
    currency: 'BRL',
    market_context: { country: 'BR' }
  });
});

check('C03 produz envelope current e preserva revisao C01', () => {
  const result = run();
  assert.strictEqual(result.contract_version, CONTRACT_VERSION);
  assert.strictEqual(result.contract_id, 'C03');
  assert.strictEqual(result.offer_revision, 1);
  assert.strictEqual(result.stage, 'RESEARCH');
  assert.strictEqual(result.execution_status, 'SUCCEEDED');
  assert.strictEqual(result.freshness_status, 'CURRENT');
});

check('evidencia comparavel fica elegivel', () => {
  const result = run();
  assert.strictEqual(result.evidence.length, 2);
  assert.strictEqual(result.evidence[0].eligible, true);
  assert.deepStrictEqual(result.evidence[0].exclusion_reasons, []);
  assert.deepStrictEqual(result.eligible_evidence_ids, ['ev_1', 'ev_2']);
});

check('preco normalizado usa minor units e moeda separada', () => {
  const result = run();
  assert.strictEqual(result.evidence[0].normalized_price, 680000);
  assert.strictEqual(result.evidence[0].currency, 'BRL');
  assert.strictEqual(typeof result.evidence[0].normalized_price, 'number');
});

check('modelo diferente e excluido deterministicamente', () => {
  const result = run({
    evidence: [
      evidence('ev_model', {
        product: {
          model_id: 'iphone-16-pro-256',
          model_label: 'iPhone 16 Pro 256GB',
          capacity_gb: 256,
          condition: 'LACRADO',
          color: 'PRETO'
        }
      })
    ]
  });
  assert.strictEqual(result.evidence[0].eligible, false);
  assert.ok(result.evidence[0].exclusion_reasons.includes('MISMATCH_MODEL_ID'));
});

check('capacidade diferente e excluida', () => {
  const ev = evidence('ev_capacity');
  ev.product.capacity_gb = 512;
  const result = run({ evidence: [ev] });
  assert.strictEqual(result.evidence[0].eligible, false);
  assert.ok(result.evidence[0].exclusion_reasons.includes('MISMATCH_CAPACITY_GB'));
});

check('condicao diferente e excluida quando o profile exige', () => {
  const ev = evidence('ev_condition');
  ev.product.condition = 'SEMINOVO';
  const result = run({ evidence: [ev] });
  assert.strictEqual(result.evidence[0].eligible, false);
  assert.ok(result.evidence[0].exclusion_reasons.includes('MISMATCH_CONDITION'));
});

check('moeda diferente nunca entra como comparavel', () => {
  const result = run({
    evidence: [evidence('ev_currency', { currency: 'USD' })]
  });
  assert.strictEqual(result.evidence[0].eligible, false);
  assert.ok(result.evidence[0].exclusion_reasons.includes('CURRENCY_MISMATCH'));
});

check('evidencia antiga e excluida pelo profile', () => {
  const result = run({
    research_profile: profile({ max_age_seconds: 60 * 60 * 24 }),
    evidence: [
      evidence('ev_old', { observed_at: '2026-09-10T12:00:00.000Z' })
    ]
  });
  assert.strictEqual(result.evidence[0].eligible, false);
  assert.ok(result.evidence[0].exclusion_reasons.includes('STALE_EVIDENCE'));
});

check('evidencia observada no futuro e excluida', () => {
  const result = run({
    evidence: [
      evidence('ev_future', { observed_at: '2026-09-20T12:00:00.000Z' })
    ]
  });
  assert.strictEqual(result.evidence[0].eligible, false);
  assert.ok(result.evidence[0].exclusion_reasons.includes('OBSERVED_IN_FUTURE'));
});

check('baixa confianca e excluida sem virar falha tecnica', () => {
  const result = run({
    evidence: [evidence('ev_low', { confidence: 0.2 })]
  });
  assert.strictEqual(result.execution_status, 'SUCCEEDED');
  assert.strictEqual(result.evidence[0].eligible, false);
  assert.ok(result.evidence[0].exclusion_reasons.includes('LOW_CONFIDENCE'));
});

check('pesquisa sem evidencia elegivel continua SUCCEEDED para C04 decidir insuficiencia', () => {
  const result = run({ evidence: [] });
  assert.strictEqual(result.execution_status, 'SUCCEEDED');
  assert.strictEqual(result.evidence_summary.total, 0);
  assert.strictEqual(result.evidence_summary.eligible, 0);
  assert.strictEqual(result.research_confidence, 0);
});

check('research_confidence agrega somente evidencias elegiveis', () => {
  const result = run({
    evidence: [
      evidence('ev_a', { confidence: 0.9 }),
      evidence('ev_b', { confidence: 0.7 }),
      evidence('ev_c', { confidence: 0.1 })
    ]
  });
  assert.strictEqual(result.evidence_summary.eligible, 2);
  assert.strictEqual(result.research_confidence, 0.8);
});

check('preco float e rejeitado na fronteira de MarketEvidence', () => {
  assert.throws(
    () => run({
      evidence: [evidence('ev_float', { normalized_price: 680000.5 })]
    }),
    /minor units/
  );
});

check('C03 recusa C01 aguardando review', () => {
  const candidate = c01Candidate({ domain_outcome: 'REVIEW_REQUIRED' });
  assert.throws(
    () => run({ c01_candidate: candidate }),
    /C01 precisa estar VALID/
  );
});

check('C03 recusa C01 stale', () => {
  const candidate = c01Candidate({ freshness_status: 'STALE' });
  assert.throws(
    () => run({ c01_candidate: candidate }),
    /C01 precisa estar CURRENT/
  );
});

check('provenance preserva C01 e evidencia', () => {
  const result = run();
  assert.ok(result.provenance_refs.includes('interpretation_run:int_research_001'));
  assert.ok(result.provenance_refs.includes('evidence:ev_1'));
  assert.ok(result.provenance_refs.includes('research_profile:market-br-fixture:1'));
});

check('fingerprints sao deterministas para o mesmo snapshot', () => {
  const a = run();
  const b = run();
  assert.strictEqual(a.research_input_fingerprint, b.research_input_fingerprint);
  assert.strictEqual(a.output_fingerprint, b.output_fingerprint);
});

check('C03 nao altera candidate nem evidencias recebidas', () => {
  const candidate = c01Candidate();
  const inputEvidence = [evidence('ev_immut')];
  const beforeCandidate = JSON.stringify(candidate);
  const beforeEvidence = JSON.stringify(inputEvidence);

  run({
    c01_candidate: candidate,
    evidence: inputEvidence
  });

  assert.strictEqual(JSON.stringify(candidate), beforeCandidate);
  assert.strictEqual(JSON.stringify(inputEvidence), beforeEvidence);
});

console.log(`C03_FIXTURES=PASS checks=${ok}`);
