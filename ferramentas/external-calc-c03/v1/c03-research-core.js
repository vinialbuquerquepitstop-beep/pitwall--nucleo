'use strict';

const crypto = require('crypto');

const CONTRACT_VERSION = 'external-calc-c03/v1';
const ENGINE_VERSION = 'c03-research-core/1.0.1-selective-staleness';
const C01_CONTRACT_VERSION = 'external-calc-c01-readonly/v1';
const ALLOWED_MATCH_FIELDS = new Set([
  'model_id',
  'capacity_gb',
  'condition',
  'color'
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

function normalizeCurrency(value) {
  const currency = assertNonEmpty(value, 'currency').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('currency invalida');
  return currency;
}

function assertIsoDate(value, field) {
  const text = assertNonEmpty(value, field);
  const time = Date.parse(text);
  if (Number.isNaN(time)) throw new Error(`${field} deve ser ISO date-time`);
  return { text, time };
}

function normalizeCandidate(candidate) {
  if (!candidate || candidate.contract_version !== C01_CONTRACT_VERSION) {
    throw new Error('C01 candidate invalido');
  }
  if (candidate.execution_status !== 'SUCCEEDED') {
    throw new Error('C01 precisa estar SUCCEEDED');
  }
  if (candidate.domain_outcome !== 'VALID') {
    throw new Error('C01 precisa estar VALID');
  }
  if (candidate.freshness_status !== 'CURRENT') {
    throw new Error('C01 precisa estar CURRENT');
  }
  if (!candidate.reviewed_offer || !candidate.reviewed_offer.model) {
    throw new Error('C01 reviewed_offer obrigatorio');
  }

  const price = candidate.reviewed_offer.price;
  if (
    !price ||
    !Number.isSafeInteger(price.amount_minor) ||
    price.amount_minor <= 0
  ) {
    throw new Error('C01 reviewed_offer.price invalido');
  }

  if (!Number.isInteger(candidate.offer_revision) || candidate.offer_revision < 1) {
    throw new Error('candidate.offer_revision invalida');
  }

  return {
    analysis_id: assertNonEmpty(candidate.analysis_id, 'candidate.analysis_id'),
    source_id: assertNonEmpty(candidate.source_id, 'candidate.source_id'),
    offer_id: assertNonEmpty(candidate.offer_id, 'candidate.offer_id'),
    offer_revision: candidate.offer_revision,
    offer_identity_fingerprint: assertNonEmpty(
      candidate.offer_identity_fingerprint,
      'candidate.offer_identity_fingerprint'
    ),
    offer_value_fingerprint: assertNonEmpty(
      candidate.offer_value_fingerprint,
      'candidate.offer_value_fingerprint'
    ),
    reviewed_offer: {
      ...candidate.reviewed_offer,
      price: {
        amount_minor: price.amount_minor,
        currency: normalizeCurrency(price.currency)
      }
    },
    provenance_refs: Array.isArray(candidate.provenance_refs)
      ? [...candidate.provenance_refs]
      : []
  };
}

function deriveResearchSubject(candidate, marketContext = {}) {
  const offer = candidate.reviewed_offer;
  const model = offer.model || {};

  const subject = {
    model_id: model.id == null ? null : String(model.id),
    model_label: model.label == null ? null : String(model.label),
    capacity_gb: Number.isInteger(offer.capacity_gb) ? offer.capacity_gb : null,
    condition: offer.condition == null ? null : String(offer.condition),
    color: offer.color == null ? null : String(offer.color),
    currency: offer.price.currency,
    market_context:
      marketContext && typeof marketContext === 'object' && !Array.isArray(marketContext)
        ? { ...marketContext }
        : {}
  };

  if (!subject.model_id && !subject.model_label) {
    throw new Error('ResearchSubject sem modelo');
  }

  return subject;
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('research_profile obrigatorio');
  }

  const required = Array.isArray(profile.required_match_fields)
    ? [...new Set(profile.required_match_fields.map(String))]
    : ['model_id', 'capacity_gb'];

  if (!required.length) throw new Error('required_match_fields vazio');
  for (const field of required) {
    if (!ALLOWED_MATCH_FIELDS.has(field)) {
      throw new Error(`required_match_field invalido: ${field}`);
    }
  }

  const minConfidence = profile.min_evidence_confidence ?? 0;
  if (
    typeof minConfidence !== 'number' ||
    !Number.isFinite(minConfidence) ||
    minConfidence < 0 ||
    minConfidence > 1
  ) {
    throw new Error('min_evidence_confidence invalido');
  }

  const maxAgeSeconds = profile.max_age_seconds ?? null;
  if (
    maxAgeSeconds !== null &&
    (!Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 0)
  ) {
    throw new Error('max_age_seconds invalido');
  }

  return {
    profile_id: assertNonEmpty(profile.profile_id, 'profile_id'),
    profile_version: assertNonEmpty(profile.profile_version, 'profile_version'),
    required_match_fields: required.sort(),
    min_evidence_confidence: minConfidence,
    max_age_seconds: maxAgeSeconds
  };
}

function normalizeEvidence(raw, index) {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`evidence[${index}] invalida`);
  }

  const observed = assertIsoDate(raw.observed_at, `evidence[${index}].observed_at`);
  const confidence = raw.confidence;
  if (
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new Error(`evidence[${index}].confidence invalida`);
  }

  if (!Number.isSafeInteger(raw.normalized_price) || raw.normalized_price <= 0) {
    throw new Error(`evidence[${index}].normalized_price deve usar minor units`);
  }

  const product = raw.product && typeof raw.product === 'object'
    ? raw.product
    : {};

  return {
    evidence_id: assertNonEmpty(raw.evidence_id, `evidence[${index}].evidence_id`),
    source_ref: assertNonEmpty(raw.source_ref, `evidence[${index}].source_ref`),
    source_url: raw.source_url == null ? null : String(raw.source_url),
    title: raw.title == null ? null : String(raw.title),
    observed_at: observed.text,
    observed_time: observed.time,
    product: {
      model_id: product.model_id == null ? null : String(product.model_id),
      model_label: product.model_label == null ? null : String(product.model_label),
      capacity_gb: Number.isInteger(product.capacity_gb) ? product.capacity_gb : null,
      condition: product.condition == null ? null : String(product.condition),
      color: product.color == null ? null : String(product.color)
    },
    normalized_price: raw.normalized_price,
    currency: normalizeCurrency(raw.currency),
    confidence
  };
}

function comparableValue(field, subject, evidenceProduct) {
  if (field === 'model_id') {
    if (!subject.model_id || !evidenceProduct.model_id) return false;
    return subject.model_id === evidenceProduct.model_id;
  }
  return subject[field] != null &&
    evidenceProduct[field] != null &&
    subject[field] === evidenceProduct[field];
}

function classifyEvidence(evidence, subject, profile, asOfTime) {
  const exclusionReasons = [];

  if (evidence.currency !== subject.currency) {
    exclusionReasons.push('CURRENCY_MISMATCH');
  }

  for (const field of profile.required_match_fields) {
    if (!comparableValue(field, subject, evidence.product)) {
      exclusionReasons.push(`MISMATCH_${field.toUpperCase()}`);
    }
  }

  if (evidence.confidence < profile.min_evidence_confidence) {
    exclusionReasons.push('LOW_CONFIDENCE');
  }

  if (evidence.observed_time > asOfTime) {
    exclusionReasons.push('OBSERVED_IN_FUTURE');
  }

  if (profile.max_age_seconds !== null) {
    const ageSeconds = Math.floor((asOfTime - evidence.observed_time) / 1000);
    if (ageSeconds > profile.max_age_seconds) {
      exclusionReasons.push('STALE_EVIDENCE');
    }
  }

  return {
    evidence_id: evidence.evidence_id,
    source_ref: evidence.source_ref,
    source_url: evidence.source_url,
    title: evidence.title,
    observed_at: evidence.observed_at,
    product: evidence.product,
    normalized_price: evidence.normalized_price,
    currency: evidence.currency,
    confidence: evidence.confidence,
    eligible: exclusionReasons.length === 0,
    exclusion_reasons: exclusionReasons
  };
}

function meanConfidence(evidence) {
  if (!evidence.length) return 0;
  const total = evidence.reduce((sum, item) => sum + item.confidence, 0);
  return Math.round((total / evidence.length) * 10000) / 10000;
}

function researchSubjectFingerprint(subject) {
  return stableHash(JSON.stringify(subject));
}

function researchInputFingerprint(candidate, subject, profile, asOf, evidence) {
  return stableHash(JSON.stringify({
    offer_id: candidate.offer_id,
    offer_identity_fingerprint: candidate.offer_identity_fingerprint,
    research_subject_fingerprint: researchSubjectFingerprint(subject),
    subject,
    profile,
    as_of: asOf,
    evidence: evidence.map(item => ({
      evidence_id: item.evidence_id,
      source_ref: item.source_ref,
      observed_at: item.observed_at,
      product: item.product,
      normalized_price: item.normalized_price,
      currency: item.currency,
      confidence: item.confidence
    }))
  }));
}

function runC03Research(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');

  const researchRunId = assertNonEmpty(request.research_run_id, 'research_run_id');
  const candidate = normalizeCandidate(request.c01_candidate);
  const profile = normalizeProfile(request.research_profile);
  const asOf = assertIsoDate(request.as_of, 'as_of');
  const subject = deriveResearchSubject(candidate, request.market_context);

  const rawEvidence = Array.isArray(request.evidence) ? request.evidence : [];
  const normalized = rawEvidence.map(normalizeEvidence);
  const classified = normalized.map(item =>
    classifyEvidence(item, subject, profile, asOf.time)
  );
  const eligible = classified.filter(item => item.eligible);

  const inputFingerprint = researchInputFingerprint(
    candidate,
    subject,
    profile,
    asOf.text,
    normalized
  );

  const outputCore = {
    research_subject: subject,
    research_subject_fingerprint: researchSubjectFingerprint(subject),
    evidence: classified,
    eligible_evidence_ids: eligible.map(item => item.evidence_id),
    research_confidence: meanConfidence(eligible),
    evidence_summary: {
      total: classified.length,
      eligible: eligible.length,
      excluded: classified.length - eligible.length
    }
  };

  return {
    contract_version: CONTRACT_VERSION,
    research_run_id: researchRunId,
    analysis_id: candidate.analysis_id,
    source_id: candidate.source_id,
    offer_id: candidate.offer_id,
    offer_revision: candidate.offer_revision,
    contract_id: 'C03',
    engine_version: ENGINE_VERSION,
    research_profile_id: profile.profile_id,
    research_profile_version: profile.profile_version,
    stage: 'RESEARCH',
    run_kind: 'INITIAL',
    attempt_no: 1,
    execution_status: 'SUCCEEDED',
    freshness_status: 'CURRENT',
    research_input_fingerprint: inputFingerprint,
    output_fingerprint: stableHash(JSON.stringify({ as_of: asOf.text, ...outputCore })),
    as_of: asOf.text,
    ...outputCore,
    provenance_refs: [
      ...candidate.provenance_refs,
      `offer_revision:${candidate.offer_id}:${candidate.offer_revision}`,
      `research_profile:${profile.profile_id}:${profile.profile_version}`,
      ...classified.map(item => `evidence:${item.evidence_id}`)
    ]
  };
}

module.exports = {
  CONTRACT_VERSION,
  ENGINE_VERSION,
  deriveResearchSubject,
  researchSubjectFingerprint,
  classifyEvidence,
  runC03Research
};
