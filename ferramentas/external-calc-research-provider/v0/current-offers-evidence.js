'use strict';

const crypto = require('crypto');

const EVIDENCE_SOURCE_VERSION = 'external-calc-current-offers-evidence/v0';

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(field + ' obrigatorio');
  }
  return value.trim();
}

function exactComparableIdentity(candidate) {
  const offer = candidate?.reviewed_offer;
  const model = offer?.model || {};

  return {
    model_id: model.id == null ? null : String(model.id),
    model_label: model.label == null ? null : String(model.label),
    capacity_gb: Number.isInteger(offer?.capacity_gb) ? offer.capacity_gb : null,
    condition: offer?.condition == null ? null : String(offer.condition),
    color: offer?.color == null ? null : String(offer.color),
    currency: offer?.price?.currency == null ? null : String(offer.price.currency).toUpperCase()
  };
}

function eligibleCurrentOffer(candidate) {
  return Boolean(
    candidate &&
    candidate.contract_version === 'external-calc-c01-readonly/v1' &&
    candidate.execution_status === 'SUCCEEDED' &&
    candidate.domain_outcome === 'VALID' &&
    candidate.freshness_status === 'CURRENT' &&
    candidate.reviewed_offer &&
    candidate.reviewed_offer.price &&
    Number.isSafeInteger(candidate.reviewed_offer.price.amount_minor) &&
    candidate.reviewed_offer.price.amount_minor > 0 &&
    typeof candidate.reviewed_offer.price.currency === 'string'
  );
}

function evidenceConfidence(candidate) {
  const confidence = candidate?.interpretation_confidence?.overall;
  if (
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    return null;
  }
  return confidence;
}

function observedAt(candidate) {
  const value = candidate?.review?.reviewed_at;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return null;
  }
  return value;
}

function buildCurrentOfferEvidence(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('request obrigatorio');
  }

  const selected = request.c01_candidate;
  if (!eligibleCurrentOffer(selected)) {
    throw new Error('C01 selecionado invalido');
  }

  const selectedAnalysisId = assertNonEmpty(selected.analysis_id, 'c01.analysis_id');
  const selectedOfferId = assertNonEmpty(selected.offer_id, 'c01.offer_id');
  if (!Number.isSafeInteger(selected.offer_revision) || selected.offer_revision < 1) {
    throw new Error('c01.offer_revision invalida');
  }

  const candidates = Array.isArray(request.current_offers)
    ? request.current_offers
    : [];

  const evidence = [];

  for (const candidate of candidates) {
    if (!eligibleCurrentOffer(candidate)) continue;

    if (
      candidate.analysis_id === selectedAnalysisId &&
      candidate.offer_id === selectedOfferId &&
      candidate.offer_revision === selected.offer_revision
    ) {
      continue;
    }

    const confidence = evidenceConfidence(candidate);
    const reviewedAt = observedAt(candidate);
    if (confidence === null || reviewedAt === null) {
      continue;
    }

    const identity = exactComparableIdentity(candidate);
    if (!identity.model_id && !identity.model_label) continue;
    if (!identity.currency) continue;

    const sourceOfferId = assertNonEmpty(candidate.offer_id, 'candidate.offer_id');
    const sourceAnalysisId = assertNonEmpty(candidate.analysis_id, 'candidate.analysis_id');
    if (!Number.isSafeInteger(candidate.offer_revision) || candidate.offer_revision < 1) {
      continue;
    }

    const evidenceIdentity = {
      analysis_id: sourceAnalysisId,
      offer_id: sourceOfferId,
      offer_revision: candidate.offer_revision,
      offer_value_fingerprint: candidate.offer_value_fingerprint || null
    };

    evidence.push({
      evidence_id: 'ev_offer_' + stableHash(JSON.stringify(evidenceIdentity)).slice(0, 24),
      source_ref:
        'reviewed_offer:' +
        sourceAnalysisId + ':' +
        sourceOfferId + ':' +
        candidate.offer_revision,
      source_url: null,
      title: null,
      observed_at: reviewedAt,
      product: {
        model_id: identity.model_id,
        model_label: identity.model_label,
        capacity_gb: identity.capacity_gb,
        condition: identity.condition,
        color: identity.color
      },
      normalized_price: candidate.reviewed_offer.price.amount_minor,
      currency: identity.currency,
      confidence
    });
  }

  evidence.sort((a, b) =>
    a.evidence_id.localeCompare(b.evidence_id)
  );

  return {
    evidence_source_version: EVIDENCE_SOURCE_VERSION,
    selected_offer: {
      analysis_id: selectedAnalysisId,
      offer_id: selectedOfferId,
      offer_revision: selected.offer_revision
    },
    evidence
  };
}

module.exports = {
  EVIDENCE_SOURCE_VERSION,
  exactComparableIdentity,
  eligibleCurrentOffer,
  buildCurrentOfferEvidence
};
