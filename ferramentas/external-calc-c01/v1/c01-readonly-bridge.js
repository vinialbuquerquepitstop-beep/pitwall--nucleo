'use strict';

const crypto = require('crypto');
const { interpretResolved } = require('../../interpreter-core/v1/core');

const CONTRACT_VERSION = 'external-calc-c01-readonly/v1';
const MATERIAL_FIELDS = ['model', 'capacity_gb', 'condition', 'color', 'price'];

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} obrigatorio`);
  return value.trim();
}

function normalizeCurrency(currency) {
  const value = assertNonEmpty(currency, 'currency').toUpperCase();
  if (!/^[A-Z]{3}$/.test(value)) throw new Error('currency deve ser ISO 4217 de 3 letras');
  return value;
}

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function stableId(prefix, ...parts) {
  return `${prefix}_${stableHash(parts.join('\x1f')).slice(0, 24)}`;
}

function moneyFromMajorUnits(value, currency) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('price interpretado invalido');
  }
  const amountMinor = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('price nao cabe em amount_minor seguro');
  }
  return { amount_minor: amountMinor, currency: normalizeCurrency(currency) };
}

function validateMoney(value, expectedCurrency = null) {
  if (!value || !Number.isSafeInteger(value.amount_minor) || value.amount_minor <= 0) {
    throw new Error('Money invalido: amount_minor deve ser inteiro positivo');
  }
  const currency = normalizeCurrency(value.currency);
  if (expectedCurrency && currency !== expectedCurrency) {
    throw new Error('review nao pode trocar currency nesta fatia');
  }
  return { amount_minor: value.amount_minor, currency };
}

function normalizeModel(value) {
  if (value && typeof value === 'object' && typeof value.id === 'string') {
    return {
      id: value.id,
      label: value.label == null ? null : String(value.label),
      attributes: value.attributes && typeof value.attributes === 'object' ? { ...value.attributes } : {}
    };
  }
  if (typeof value === 'string' && value.trim()) {
    return { id: null, label: value.trim(), attributes: {} };
  }
  throw new Error('model interpretado ausente ou invalido');
}

function interpretationConfidence(record) {
  const byField = {};
  for (const item of record.trace || []) {
    if (!item || typeof item.field !== 'string') continue;
    byField[item.field] = typeof item.score === 'number' ? item.score : null;
  }
  const scored = Object.values(byField).filter(value => typeof value === 'number');
  return {
    overall: scored.length ? Math.min(...scored) : null,
    by_field: byField,
    record_state: record.state
  };
}

function interpretedOfferFromRecord(record, currency) {
  const fields = record.fields || {};
  return {
    model: normalizeModel(fields.model),
    capacity_gb: Number.isInteger(fields.capacity_gb) ? fields.capacity_gb : null,
    condition: fields.condition == null ? null : String(fields.condition),
    color: fields.color == null ? null : String(fields.color),
    price: moneyFromMajorUnits(fields.price, currency)
  };
}

function offerIdentityFingerprint(offer) {
  return stableHash(JSON.stringify({
    model: offer.model?.id || offer.model?.label || null,
    capacity_gb: offer.capacity_gb,
    condition: offer.condition,
    color: offer.color
  }));
}

function offerValueFingerprint(offer) {
  return stableHash(JSON.stringify(offer));
}

function candidateFromRecord(record, bundle, context) {
  const interpretedOffer = interpretedOfferFromRecord(record, context.currency);
  const offerId = stableId('off', context.analysis_id, context.source_id, record.record_id);

  return {
    contract_version: CONTRACT_VERSION,
    analysis_id: context.analysis_id,
    source_id: context.source_id,
    offer_id: offerId,
    offer_revision: 1,
    stage: 'REVIEW',
    execution_status: 'SUCCEEDED',
    domain_outcome: 'REVIEW_REQUIRED',
    freshness_status: 'CURRENT',
    interpretation_run_id: bundle.run.run_id,
    interpretation_engine_version: bundle.run.engine_version,
    interpretation_confidence: interpretationConfidence(record),
    offer_identity_fingerprint: offerIdentityFingerprint(interpretedOffer),
    offer_value_fingerprint: offerValueFingerprint(interpretedOffer),
    interpreted_offer: interpretedOffer,
    reviewed_offer: null,
    review: null,
    provenance_refs: [
      `interpretation_run:${bundle.run.run_id}`,
      `interpreter_record:${record.record_id}`
    ],
    trace: Array.isArray(record.trace) ? record.trace.map(item => ({ ...item })) : []
  };
}

function mapBundleToC01ReviewQueue(bundle, context) {
  if (!bundle || bundle.contract_version !== 'interpretation-bundle/v1') {
    throw new Error('InterpretationBundle v1 obrigatorio');
  }
  const normalized = {
    analysis_id: assertNonEmpty(context?.analysis_id, 'analysis_id'),
    source_id: assertNonEmpty(context?.source_id, 'source_id'),
    currency: normalizeCurrency(context?.currency)
  };
  const candidates = (bundle.records || []).map(record => candidateFromRecord(record, bundle, normalized));

  return {
    contract_version: `${CONTRACT_VERSION}/queue`,
    analysis_id: normalized.analysis_id,
    source_id: normalized.source_id,
    interpretation_run_id: bundle.run.run_id,
    execution_status: 'SUCCEEDED',
    stage: 'REVIEW',
    candidates,
    unresolved_ambiguities: (bundle.ambiguities || []).map(item => ({ ...item })),
    invalid_items: (bundle.invalid || []).map(item => ({ ...item })),
    warnings: [...(bundle.warnings || [])],
    metrics: {
      interpreter_records: bundle.records?.length || 0,
      review_candidates: candidates.length,
      unresolved_ambiguities: bundle.ambiguities?.length || 0,
      invalid_items: bundle.invalid?.length || 0
    }
  };
}

function runC01ReadOnlySlice(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');
  const analysisId = assertNonEmpty(request.analysis_id, 'analysis_id');
  const sourceId = assertNonEmpty(request.source_id, 'source_id');
  const currency = normalizeCurrency(request.currency);
  const bundle = interpretResolved({
    document: request.document,
    schema: request.schema,
    knowledge: request.knowledge || null
  });
  return mapBundleToC01ReviewQueue(bundle, {
    analysis_id: analysisId,
    source_id: sourceId,
    currency
  });
}

function cloneOffer(offer) {
  return {
    model: offer.model ? {
      id: offer.model.id ?? null,
      label: offer.model.label ?? null,
      attributes: { ...(offer.model.attributes || {}) }
    } : null,
    capacity_gb: offer.capacity_gb ?? null,
    condition: offer.condition ?? null,
    color: offer.color ?? null,
    price: offer.price ? { ...offer.price } : null
  };
}

function applyPatch(baseOffer, patch = {}) {
  const unknown = Object.keys(patch).filter(key => !MATERIAL_FIELDS.includes(key));
  if (unknown.length) throw new Error(`campos de review nao permitidos: ${unknown.join(',')}`);

  const next = cloneOffer(baseOffer);
  if (Object.prototype.hasOwnProperty.call(patch, 'model')) next.model = normalizeModel(patch.model);
  if (Object.prototype.hasOwnProperty.call(patch, 'capacity_gb')) {
    if (patch.capacity_gb !== null && (!Number.isInteger(patch.capacity_gb) || patch.capacity_gb <= 0)) {
      throw new Error('capacity_gb de review invalida');
    }
    next.capacity_gb = patch.capacity_gb;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'condition')) {
    next.condition = patch.condition == null ? null : String(patch.condition);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'color')) {
    next.color = patch.color == null ? null : String(patch.color);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'price')) {
    next.price = validateMoney(patch.price, baseOffer.price.currency);
  }
  return next;
}

function applyHumanReview(candidate, review) {
  if (!candidate || candidate.contract_version !== CONTRACT_VERSION) {
    throw new Error('candidate C01 invalido');
  }
  if (candidate.domain_outcome !== 'REVIEW_REQUIRED') {
    throw new Error('candidate nao esta aguardando review');
  }
  const decision = assertNonEmpty(review?.decision, 'review.decision').toUpperCase();
  const reviewerRef = assertNonEmpty(review?.reviewer_ref, 'review.reviewer_ref');
  const reviewedAt = assertNonEmpty(review?.reviewed_at, 'review.reviewed_at');
  if (Number.isNaN(Date.parse(reviewedAt))) throw new Error('review.reviewed_at deve ser ISO date-time');

  if (decision === 'EXCLUDE' || decision === 'INVALIDATE') {
    return {
      ...candidate,
      domain_outcome: decision === 'EXCLUDE' ? 'EXCLUDED' : 'INVALID',
      reviewed_offer: null,
      review: {
        decision,
        reviewer_ref: reviewerRef,
        reviewed_at: reviewedAt,
        reason: review.reason == null ? null : String(review.reason),
        material_change: false
      }
    };
  }

  if (decision !== 'ACCEPT' && decision !== 'EDIT') {
    throw new Error('review.decision deve ser ACCEPT, EDIT, EXCLUDE ou INVALIDATE');
  }

  const reviewedOffer = decision === 'EDIT'
    ? applyPatch(candidate.interpreted_offer, review.patch || {})
    : cloneOffer(candidate.interpreted_offer);
  const materialChange = offerValueFingerprint(reviewedOffer) !== candidate.offer_value_fingerprint;
  const nextRevision = candidate.offer_revision + (materialChange ? 1 : 0);

  return {
    ...candidate,
    offer_revision: nextRevision,
    domain_outcome: 'VALID',
    reviewed_offer: reviewedOffer,
    offer_identity_fingerprint: offerIdentityFingerprint(reviewedOffer),
    offer_value_fingerprint: offerValueFingerprint(reviewedOffer),
    review: {
      decision,
      reviewer_ref: reviewerRef,
      reviewed_at: reviewedAt,
      reason: review.reason == null ? null : String(review.reason),
      material_change: materialChange,
      original_offer_revision: candidate.offer_revision
    },
    provenance_refs: [
      ...candidate.provenance_refs,
      `human_review:${reviewerRef}:${reviewedAt}`
    ]
  };
}

module.exports = {
  CONTRACT_VERSION,
  moneyFromMajorUnits,
  mapBundleToC01ReviewQueue,
  runC01ReadOnlySlice,
  applyHumanReview
};
