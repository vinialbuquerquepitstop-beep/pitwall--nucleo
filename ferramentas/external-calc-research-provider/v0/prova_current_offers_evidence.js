'use strict';

const assert = require('assert');
const {
  EVIDENCE_SOURCE_VERSION,
  buildCurrentOfferEvidence
} = require('./current-offers-evidence');
const { runC03Research } = require('../../external-calc-c03/v1/c03-research-core');

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

function candidate({
  analysisId,
  offerId,
  revision = 1,
  modelId = 'iphone-17-pro-256',
  modelLabel = 'iPhone 17 Pro 256GB',
  capacityGb = 256,
  condition = 'LACRADO',
  color = 'PRETO',
  priceMinor = 650000,
  confidence = 0.95,
  reviewedAt = '2026-09-24T12:00:00.000Z',
  domainOutcome = 'VALID',
  freshnessStatus = 'CURRENT'
}) {
  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: analysisId,
    source_id: 'src_' + offerId,
    offer_id: offerId,
    offer_revision: revision,
    execution_status: 'SUCCEEDED',
    domain_outcome: domainOutcome,
    freshness_status: freshnessStatus,
    offer_identity_fingerprint: 'identity_' + offerId,
    offer_value_fingerprint: 'value_' + offerId + '_' + priceMinor,
    reviewed_offer: {
      supplier_id: 'SUP_' + offerId,
      model: {
        id: modelId,
        label: modelLabel,
        attributes: {}
      },
      capacity_gb: capacityGb,
      condition,
      color,
      price: {
        amount_minor: priceMinor,
        currency: 'BRL'
      }
    },
    review: {
      decision: 'ACCEPT',
      reviewer_ref: 'reviewer',
      reviewed_at: reviewedAt
    },
    interpretation_confidence: {
      overall: confidence,
      by_field: {},
      record_state: 'resolved'
    },
    provenance_refs: ['human_review:' + offerId]
  };
}

const selected = () => candidate({
  analysisId: 'ana_selected',
  offerId: 'off_selected'
});

check('gera Evidence[] a partir de C01 current revisado', () => {
  const peer = candidate({
    analysisId: 'ana_peer',
    offerId: 'off_peer',
    priceMinor: 630000
  });
  const result = buildCurrentOfferEvidence({
    c01_candidate: selected(),
    current_offers: [selected(), peer]
  });

  assert.strictEqual(result.evidence_source_version, EVIDENCE_SOURCE_VERSION);
  assert.strictEqual(result.evidence.length, 1);
  assert.strictEqual(result.evidence[0].normalized_price, 630000);
  assert.strictEqual(result.evidence[0].currency, 'BRL');
});

check('oferta avaliada e excluida para evitar referencia circular', () => {
  const result = buildCurrentOfferEvidence({
    c01_candidate: selected(),
    current_offers: [selected()]
  });
  assert.deepStrictEqual(result.evidence, []);
});

check('preco e identidade sao copiados sem recalculo', () => {
  const peer = candidate({
    analysisId: 'ana_peer_identity',
    offerId: 'off_peer_identity',
    color: 'AZUL',
    priceMinor: 641234
  });
  const result = buildCurrentOfferEvidence({
    c01_candidate: selected(),
    current_offers: [peer]
  });
  const ev = result.evidence[0];

  assert.strictEqual(ev.product.model_id, 'iphone-17-pro-256');
  assert.strictEqual(ev.product.capacity_gb, 256);
  assert.strictEqual(ev.product.condition, 'LACRADO');
  assert.strictEqual(ev.product.color, 'AZUL');
  assert.strictEqual(ev.normalized_price, 641234);
});

check('confidence vem do C01 e nao recebe default inventado', () => {
  const peer = candidate({
    analysisId: 'ana_conf',
    offerId: 'off_conf',
    confidence: 0.87
  });
  const result = buildCurrentOfferEvidence({
    c01_candidate: selected(),
    current_offers: [peer]
  });
  assert.strictEqual(result.evidence[0].confidence, 0.87);

  const missing = candidate({
    analysisId: 'ana_missing_conf',
    offerId: 'off_missing_conf'
  });
  delete missing.interpretation_confidence;
  const absent = buildCurrentOfferEvidence({
    c01_candidate: selected(),
    current_offers: [missing]
  });
  assert.deepStrictEqual(absent.evidence, []);
});

check('observed_at usa review real e nao inventa timestamp', () => {
  const peer = candidate({
    analysisId: 'ana_time',
    offerId: 'off_time',
    reviewedAt: '2026-09-23T10:11:12.000Z'
  });
  const result = buildCurrentOfferEvidence({
    c01_candidate: selected(),
    current_offers: [peer]
  });
  assert.strictEqual(result.evidence[0].observed_at, '2026-09-23T10:11:12.000Z');

  const missing = candidate({
    analysisId: 'ana_missing_time',
    offerId: 'off_missing_time'
  });
  delete missing.review.reviewed_at;
  const absent = buildCurrentOfferEvidence({
    c01_candidate: selected(),
    current_offers: [missing]
  });
  assert.deepStrictEqual(absent.evidence, []);
});

check('stale review-required e invalid nao viram evidencia', () => {
  const stale = candidate({
    analysisId: 'ana_stale',
    offerId: 'off_stale',
    freshnessStatus: 'STALE'
  });
  const review = candidate({
    analysisId: 'ana_review',
    offerId: 'off_review',
    domainOutcome: 'REVIEW_REQUIRED'
  });
  const result = buildCurrentOfferEvidence({
    c01_candidate: selected(),
    current_offers: [stale, review]
  });
  assert.deepStrictEqual(result.evidence, []);
});

check('evidence id e deterministico por offer revision e fingerprint', () => {
  const peer = candidate({
    analysisId: 'ana_det',
    offerId: 'off_det',
    revision: 2,
    priceMinor: 620000
  });
  const a = buildCurrentOfferEvidence({
    c01_candidate: selected(),
    current_offers: [peer]
  });
  const b = buildCurrentOfferEvidence({
    c01_candidate: selected(),
    current_offers: [peer]
  });
  assert.strictEqual(a.evidence[0].evidence_id, b.evidence[0].evidence_id);
});

check('source_ref preserva lineage da oferta revisada', () => {
  const peer = candidate({
    analysisId: 'ana_lineage',
    offerId: 'off_lineage',
    revision: 4
  });
  const result = buildCurrentOfferEvidence({
    c01_candidate: selected(),
    current_offers: [peer]
  });
  assert.strictEqual(
    result.evidence[0].source_ref,
    'reviewed_offer:ana_lineage:off_lineage:4'
  );
});

check('Evidence[] entra diretamente no C03 e matching continua autoridade do profile', () => {
  const exact1 = candidate({
    analysisId: 'ana_e1',
    offerId: 'off_e1',
    priceMinor: 610000
  });
  const exact2 = candidate({
    analysisId: 'ana_e2',
    offerId: 'off_e2',
    priceMinor: 630000
  });
  const otherColor = candidate({
    analysisId: 'ana_blue',
    offerId: 'off_blue',
    color: 'AZUL',
    priceMinor: 620000
  });

  const source = buildCurrentOfferEvidence({
    c01_candidate: selected(),
    current_offers: [exact1, exact2, otherColor]
  });

  const c03 = runC03Research({
    research_run_id: 'research_current_offers',
    c01_candidate: selected(),
    research_profile: {
      profile_id: 'fixture-exact',
      profile_version: '1',
      required_match_fields: ['model_id', 'capacity_gb', 'condition', 'color'],
      min_evidence_confidence: 0,
      max_age_seconds: null
    },
    as_of: '2026-09-24T18:00:00.000Z',
    market_context: {},
    evidence: source.evidence
  });

  assert.strictEqual(c03.evidence_summary.total, 3);
  assert.strictEqual(c03.evidence_summary.eligible, 2);
  assert.strictEqual(c03.evidence_summary.excluded, 1);
});

check('source nao altera C01 nem current offers recebidos', () => {
  const peer = candidate({
    analysisId: 'ana_immutable',
    offerId: 'off_immutable'
  });
  const input = {
    c01_candidate: selected(),
    current_offers: [peer]
  };
  const before = JSON.stringify(input);
  buildCurrentOfferEvidence(input);
  assert.strictEqual(JSON.stringify(input), before);
});

console.log('CURRENT_OFFERS_EVIDENCE_FIXTURES=PASS checks=' + ok);
