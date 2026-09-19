'use strict';

const crypto = require('crypto');

const CONTRACT_VERSION = 'external-calc-c05/v1';
const ENGINE_VERSION = 'c05-decision-output/1.0.1-selective-staleness';

const VERSIONS = {
  C01: 'external-calc-c01-readonly/v1',
  C02: 'external-calc-c02/v1',
  C03: 'external-calc-c03/v1',
  C04: 'external-calc-c04/v1'
};

const DECISION_OUTCOMES = new Set([
  'READY',
  'REVIEW_REQUIRED',
  'INSUFFICIENT_DATA',
  'INVALID'
]);

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} obrigatorio`);
  }
  return value.trim();
}

function assertCurrentSucceeded(value, contract) {
  if (value.execution_status !== 'SUCCEEDED') {
    throw new Error(`${contract} precisa estar SUCCEEDED`);
  }
  if (value.freshness_status !== 'CURRENT') {
    throw new Error(`${contract} precisa estar CURRENT`);
  }
}

function sameOfferRevision(upstream, c01, label) {
  if (
    upstream.analysis_id !== c01.analysis_id ||
    upstream.offer_id !== c01.offer_id ||
    upstream.offer_revision !== c01.offer_revision
  ) {
    throw new Error(`UPSTREAM_STALE: ${label} nao corresponde a revisao C01 atual`);
  }
}

function normalizeC01(candidate) {
  if (!candidate || candidate.contract_version !== VERSIONS.C01) {
    throw new Error('C01 candidate invalido');
  }
  assertCurrentSucceeded(candidate, 'C01');
  if (candidate.domain_outcome !== 'VALID') {
    throw new Error('C01 precisa estar VALID para compor C05');
  }
  if (!candidate.reviewed_offer || !candidate.reviewed_offer.price) {
    throw new Error('C01 reviewed_offer obrigatorio');
  }
  if (!Number.isInteger(candidate.offer_revision) || candidate.offer_revision < 1) {
    throw new Error('C01 offer_revision invalida');
  }

  return {
    raw: candidate,
    analysis_id: assertNonEmpty(candidate.analysis_id, 'C01 analysis_id'),
    source_id: assertNonEmpty(candidate.source_id, 'C01 source_id'),
    offer_id: assertNonEmpty(candidate.offer_id, 'C01 offer_id'),
    offer_revision: candidate.offer_revision,
    offer_value_fingerprint: assertNonEmpty(
      candidate.offer_value_fingerprint,
      'C01 offer_value_fingerprint'
    ),
    reviewed_offer: JSON.parse(JSON.stringify(candidate.reviewed_offer)),
    research_identity: {
      model_id: candidate.reviewed_offer.model?.id == null
        ? null
        : String(candidate.reviewed_offer.model.id),
      model_label: candidate.reviewed_offer.model?.label == null
        ? null
        : String(candidate.reviewed_offer.model.label),
      capacity_gb: Number.isInteger(candidate.reviewed_offer.capacity_gb)
        ? candidate.reviewed_offer.capacity_gb
        : null,
      condition: candidate.reviewed_offer.condition == null
        ? null
        : String(candidate.reviewed_offer.condition),
      color: candidate.reviewed_offer.color == null
        ? null
        : String(candidate.reviewed_offer.color)
    },
    price: {
      amount_minor: candidate.reviewed_offer.price.amount_minor,
      currency: candidate.reviewed_offer.price.currency
    }
  };
}

function normalizeC02(value, c01) {
  if (!value || value.contract_version !== VERSIONS.C02) {
    throw new Error('C02 calculation invalido');
  }
  assertCurrentSucceeded(value, 'C02');
  sameOfferRevision(value, c01, 'C02');
  assertNonEmpty(value.calculation_run_id, 'C02 calculation_run_id');
  assertNonEmpty(value.output_fingerprint, 'C02 output_fingerprint');

  if (
    !value.supplier_offer_price ||
    value.supplier_offer_price.amount_minor !== c01.price.amount_minor ||
    value.supplier_offer_price.currency !== c01.price.currency
  ) {
    throw new Error('UPSTREAM_STALE: C02 supplier_offer_price difere do C01 atual');
  }

  return value;
}

function normalizeC03(value, c01) {
  if (!value || value.contract_version !== VERSIONS.C03) {
    throw new Error('C03 research invalido');
  }
  assertCurrentSucceeded(value, 'C03');
  if (
    value.analysis_id !== c01.analysis_id ||
    value.offer_id !== c01.offer_id
  ) {
    throw new Error('UPSTREAM_STALE: C03 nao pertence a oferta C01 atual');
  }
  assertNonEmpty(value.research_run_id, 'C03 research_run_id');
  assertNonEmpty(value.output_fingerprint, 'C03 output_fingerprint');
  assertNonEmpty(value.research_subject_fingerprint, 'C03 research_subject_fingerprint');

  if (!value.research_subject) {
    throw new Error('UPSTREAM_STALE: C03 sem research_subject');
  }

  const subject = value.research_subject;
  const current = c01.research_identity;
  const sameModel = current.model_id
    ? subject.model_id === current.model_id
    : subject.model_label === current.model_label;

  if (
    !sameModel ||
    subject.capacity_gb !== current.capacity_gb ||
    subject.condition !== current.condition ||
    subject.color !== current.color ||
    subject.currency !== c01.price.currency
  ) {
    throw new Error('UPSTREAM_STALE: C03 research_subject difere da identidade C01 atual');
  }

  if (
    value.research_subject_fingerprint !== stableHash(JSON.stringify(subject))
  ) {
    throw new Error('UPSTREAM_STALE: C03 research_subject_fingerprint invalido');
  }

  return value;
}

function normalizeC04(value, c01, c03) {
  if (!value || value.contract_version !== VERSIONS.C04) {
    throw new Error('C04 price signal invalido');
  }
  assertCurrentSucceeded(value, 'C04');
  sameOfferRevision(value, c01, 'C04');
  assertNonEmpty(value.price_signal_run_id, 'C04 price_signal_run_id');
  assertNonEmpty(value.output_fingerprint, 'C04 output_fingerprint');

  if (
    !value.evaluated_price ||
    value.evaluated_price.amount_minor !== c01.price.amount_minor ||
    value.evaluated_price.currency !== c01.price.currency ||
    value.evaluated_price_basis !== 'SUPPLIER_OFFER_PRICE' ||
    value.evaluated_price_source_contract !== 'C01' ||
    value.evaluated_price_source_field !== 'reviewed_offer.price'
  ) {
    throw new Error('UPSTREAM_STALE: C04 evaluated_price perdeu lineage C01');
  }

  const researchRunRef = `research_run:${c03.research_run_id}`;
  if (
    !Array.isArray(value.provenance_refs) ||
    !value.provenance_refs.includes(researchRunRef)
  ) {
    throw new Error('UPSTREAM_STALE: C04 nao referencia o C03 atual');
  }

  return value;
}

function decisionOutcomeFromC04(c04) {
  if (['CHEAP', 'MARKET', 'EXPENSIVE'].includes(c04.domain_outcome)) {
    return 'READY';
  }
  if (c04.domain_outcome === 'INSUFFICIENT_DATA') {
    return 'INSUFFICIENT_DATA';
  }
  if (c04.domain_outcome === 'INVALID') {
    return 'INVALID';
  }
  throw new Error('C04 domain_outcome nao suportado');
}

function composeDecisionOutput(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');

  const decisionOutputId = assertNonEmpty(
    request.decision_output_id,
    'decision_output_id'
  );
  const c01 = normalizeC01(request.c01_candidate);
  const c02 = normalizeC02(request.c02_calculation, c01);
  const c03 = normalizeC03(request.c03_research, c01);
  const c04 = normalizeC04(request.c04_price_signal, c01, c03);
  const decisionOutcome = decisionOutcomeFromC04(c04);

  const inputFingerprint = stableHash(JSON.stringify({
    c01_offer_value_fingerprint: c01.offer_value_fingerprint,
    c02_output_fingerprint: c02.output_fingerprint,
    c03_output_fingerprint: c03.output_fingerprint,
    c04_output_fingerprint: c04.output_fingerprint,
    offer_id: c01.offer_id,
    offer_revision: c01.offer_revision
  }));

  const outputCore = {
    reviewed_offer: c01.reviewed_offer,
    calculation: {
      supplier_offer_price: c02.supplier_offer_price,
      store_cost: c02.store_cost,
      normal_sale_price: c02.normal_sale_price,
      installment_base_price: c02.installment_base_price,
      estimated_margin: c02.estimated_margin,
      estimated_margin_percent: c02.estimated_margin_percent,
      entry: c02.entry,
      financed_balance: c02.financed_balance,
      installments: Array.isArray(c02.installments)
        ? JSON.parse(JSON.stringify(c02.installments))
        : [],
      promo_price: c02.promo_price ?? null,
      promotion_floor: c02.promotion_floor ?? null,
      promotion_range: c02.promotion_range ?? null
    },
    research: {
      research_run_id: c03.research_run_id,
      research_confidence: c03.research_confidence,
      evidence_summary: c03.evidence_summary,
      eligible_evidence_ids: Array.isArray(c03.eligible_evidence_ids)
        ? [...c03.eligible_evidence_ids]
        : []
    },
    price_indicator: {
      price_signal_run_id: c04.price_signal_run_id,
      price_signal: c04.price_signal,
      market_reference_price: c04.market_reference_price,
      market_delta_amount: c04.market_delta_amount,
      market_delta_percent: c04.market_delta_percent,
      price_signal_confidence: c04.price_signal_confidence,
      comparable_evidence_count: c04.comparable_evidence_count,
      evidence_ids: Array.isArray(c04.evidence_ids) ? [...c04.evidence_ids] : [],
      reason: c04.reason
    },
    promotion: {
      promo_price: c02.promo_price ?? null,
      promotion_floor: c02.promotion_floor ?? null,
      promotion_range: c02.promotion_range ?? null
    },
    decision_outcome: decisionOutcome
  };

  return {
    contract_version: CONTRACT_VERSION,
    decision_output_id: decisionOutputId,
    analysis_id: c01.analysis_id,
    source_id: c01.source_id,
    offer_id: c01.offer_id,
    offer_revision: c01.offer_revision,
    contract_id: 'C05',
    engine_version: ENGINE_VERSION,
    stage: 'DECISION_OUTPUT',
    run_kind: 'INITIAL',
    attempt_no: 1,
    execution_status: 'SUCCEEDED',
    domain_outcome: decisionOutcome,
    freshness_status: 'CURRENT',
    decision_input_fingerprint: inputFingerprint,
    output_fingerprint: stableHash(JSON.stringify(outputCore)),
    ...outputCore,
    upstream_refs: {
      c02_calculation_run_id: c02.calculation_run_id,
      c03_research_run_id: c03.research_run_id,
      c04_price_signal_run_id: c04.price_signal_run_id
    },
    provenance_refs: [
      ...(Array.isArray(c01.raw.provenance_refs) ? c01.raw.provenance_refs : []),
      ...(Array.isArray(c02.provenance_refs) ? c02.provenance_refs : []),
      ...(Array.isArray(c03.provenance_refs) ? c03.provenance_refs : []),
      ...(Array.isArray(c04.provenance_refs) ? c04.provenance_refs : []),
      `offer_revision:${c01.offer_id}:${c01.offer_revision}`,
      `calculation_run:${c02.calculation_run_id}`,
      `research_run:${c03.research_run_id}`,
      `price_signal_run:${c04.price_signal_run_id}`
    ]
  };
}

function aggregateAnalysis(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');

  const analysisId = assertNonEmpty(request.analysis_id, 'analysis_id');
  const offers = Array.isArray(request.c01_offers) ? request.c01_offers : [];
  const decisions = Array.isArray(request.decision_outputs)
    ? request.decision_outputs
    : [];

  const offerMap = new Map();
  for (const offer of offers) {
    if (!offer || offer.contract_version !== VERSIONS.C01) {
      throw new Error('analysis contem C01 invalido');
    }
    if (offer.analysis_id !== analysisId) {
      throw new Error('analysis_id divergente em C01');
    }
    const offerId = assertNonEmpty(offer.offer_id, 'C01 offer_id');
    if (!Number.isInteger(offer.offer_revision) || offer.offer_revision < 1) {
      throw new Error('C01 offer_revision invalida na analysis');
    }
    if (offerMap.has(offerId)) {
      throw new Error('offer_id duplicado na analysis');
    }
    offerMap.set(offerId, offer);
  }

  const decisionMap = new Map();
  for (const decision of decisions) {
    if (!decision || decision.contract_version !== CONTRACT_VERSION) {
      throw new Error('analysis contem C05 invalido');
    }
    if (
      decision.analysis_id !== analysisId ||
      decision.execution_status !== 'SUCCEEDED' ||
      decision.freshness_status !== 'CURRENT'
    ) {
      throw new Error('UPSTREAM_STALE: C05 nao elegivel para aggregation');
    }
    const offerId = assertNonEmpty(decision.offer_id, 'C05 offer_id');
    if (!offerMap.has(offerId)) {
      throw new Error(`C05 sem C01 correspondente: ${offerId}`);
    }
    if (decisionMap.has(offerId)) {
      throw new Error(`C05 duplicado para offer_id: ${offerId}`);
    }
    decisionMap.set(offerId, decision);
  }

  const counts = {
    total_offers: offers.length,
    ready_count: 0,
    review_required_count: 0,
    insufficient_data_count: 0,
    invalid_count: 0,
    excluded_count: 0
  };

  for (const [offerId, offer] of offerMap.entries()) {
    if (offer.domain_outcome === 'REVIEW_REQUIRED') {
      counts.review_required_count += 1;
      continue;
    }
    if (offer.domain_outcome === 'EXCLUDED') {
      counts.excluded_count += 1;
      continue;
    }
    if (offer.domain_outcome === 'INVALID') {
      counts.invalid_count += 1;
      continue;
    }
    if (offer.domain_outcome !== 'VALID') {
      throw new Error(`C01 domain_outcome desconhecido para ${offerId}`);
    }

    const decision = decisionMap.get(offerId);
    if (!decision) {
      throw new Error(`INCOMPLETE_ANALYSIS: oferta VALID sem C05 atual: ${offerId}`);
    }
    if (decision.offer_revision !== offer.offer_revision) {
      throw new Error(`UPSTREAM_STALE: C05 de revisao antiga para ${offerId}`);
    }
    if (!DECISION_OUTCOMES.has(decision.domain_outcome)) {
      throw new Error(`C05 domain_outcome invalido para ${offerId}`);
    }

    if (decision.domain_outcome === 'READY') counts.ready_count += 1;
    else if (decision.domain_outcome === 'REVIEW_REQUIRED') {
      counts.review_required_count += 1;
    } else if (decision.domain_outcome === 'INSUFFICIENT_DATA') {
      counts.insufficient_data_count += 1;
    } else if (decision.domain_outcome === 'INVALID') {
      counts.invalid_count += 1;
    }
  }

  let analysisOutcome;
  if (counts.review_required_count > 0) {
    analysisOutcome = 'REVIEW_REQUIRED';
  } else if (counts.ready_count > 0) {
    analysisOutcome = 'READY';
  } else if (counts.insufficient_data_count > 0) {
    analysisOutcome = 'INSUFFICIENT_DATA';
  } else {
    analysisOutcome = 'INVALID';
  }

  return {
    contract_version: `${CONTRACT_VERSION}/analysis-summary`,
    analysis_id: analysisId,
    ...counts,
    analysis_outcome: analysisOutcome
  };
}

module.exports = {
  CONTRACT_VERSION,
  ENGINE_VERSION,
  composeDecisionOutput,
  aggregateAnalysis
};
