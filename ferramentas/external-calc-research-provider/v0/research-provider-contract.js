'use strict';

const crypto = require('crypto');
const { deriveResearchSubject } = require('../../external-calc-c03/v1/c03-research-core');

const CONTRACT_VERSION = 'external-calc-research-provider/v0';
const ENGINE_VERSION = 'research-provider-contract/0.1.0';
const C01_CONTRACT_VERSION = 'external-calc-c01-readonly/v1';

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

function validateC01(candidate) {
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
  if (!candidate.reviewed_offer || !candidate.reviewed_offer.price) {
    throw new Error('C01 reviewed_offer obrigatorio');
  }
  return candidate;
}

function normalizeProviderProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('provider_profile obrigatorio');
  }

  const providerId = assertNonEmpty(profile.provider_id, 'provider_id');
  const providerVersion = assertNonEmpty(profile.provider_version, 'provider_version');

  const maxResults = profile.max_results ?? 20;
  if (!Number.isSafeInteger(maxResults) || maxResults < 1 || maxResults > 100) {
    throw new Error('max_results invalido');
  }

  const country = profile.country == null ? null : String(profile.country).trim().toUpperCase();
  const language = profile.language == null ? null : String(profile.language).trim().toLowerCase();

  return {
    provider_id: providerId,
    provider_version: providerVersion,
    max_results: maxResults,
    country,
    language
  };
}

function buildQueryText(subject) {
  const parts = [];
  if (subject.model_label) parts.push(subject.model_label);
  else if (subject.model_id) parts.push(subject.model_id);
  if (subject.capacity_gb) parts.push(`${subject.capacity_gb}GB`);
  if (subject.condition) parts.push(subject.condition);
  if (subject.color) parts.push(subject.color);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function createResearchProviderRequest(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');

  const candidate = validateC01(request.c01_candidate);
  const profile = normalizeProviderProfile(request.provider_profile);
  const subject = deriveResearchSubject(candidate, request.market_context || {});
  const requestId = assertNonEmpty(request.provider_request_id, 'provider_request_id');

  const queryText = buildQueryText(subject);
  if (!queryText) throw new Error('query_text vazio');

  const outputCore = {
    provider_id: profile.provider_id,
    provider_version: profile.provider_version,
    max_results: profile.max_results,
    country: profile.country,
    language: profile.language,
    query_text: queryText,
    research_subject: subject
  };

  return {
    contract_version: CONTRACT_VERSION,
    engine_version: ENGINE_VERSION,
    provider_request_id: requestId,
    analysis_id: candidate.analysis_id,
    source_id: candidate.source_id,
    offer_id: candidate.offer_id,
    offer_revision: candidate.offer_revision,
    stage: 'RESEARCH_PROVIDER_REQUEST',
    execution_status: 'SUCCEEDED',
    freshness_status: 'CURRENT',
    subject_fingerprint: stableHash(JSON.stringify(subject)),
    output_fingerprint: stableHash(JSON.stringify(outputCore)),
    ...outputCore,
    provenance_refs: [
      ...(Array.isArray(candidate.provenance_refs) ? candidate.provenance_refs : []),
      `offer_revision:${candidate.offer_id}:${candidate.offer_revision}`,
      `provider_profile:${profile.provider_id}:${profile.provider_version}`
    ]
  };
}

function normalizeProviderHit(hit, index, context) {
  if (!hit || typeof hit !== 'object') throw new Error(`hit[${index}] invalido`);

  const priceMinor = hit.price_minor;
  if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) {
    throw new Error(`hit[${index}].price_minor invalido`);
  }

  const confidence = hit.confidence ?? 1;
  if (
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new Error(`hit[${index}].confidence invalida`);
  }

  const observedAt = assertNonEmpty(hit.observed_at, `hit[${index}].observed_at`);
  if (Number.isNaN(Date.parse(observedAt))) {
    throw new Error(`hit[${index}].observed_at deve ser ISO date-time`);
  }

  const product = hit.product && typeof hit.product === 'object'
    ? hit.product
    : {};

  const sourceRef = assertNonEmpty(hit.source_ref, `hit[${index}].source_ref`);
  const sourceUrl = hit.source_url == null ? null : String(hit.source_url);
  const title = hit.title == null ? null : String(hit.title);

  const identity = {
    provider_id: context.provider_id,
    source_ref: sourceRef,
    source_url: sourceUrl,
    observed_at: observedAt,
    product,
    price_minor: priceMinor,
    currency: context.currency
  };

  return {
    evidence_id: `ev_${stableHash(JSON.stringify(identity)).slice(0, 24)}`,
    source_ref: `${context.provider_id}:${sourceRef}`,
    source_url: sourceUrl,
    title,
    observed_at: observedAt,
    product: {
      model_id: product.model_id == null ? null : String(product.model_id),
      model_label: product.model_label == null ? null : String(product.model_label),
      capacity_gb: Number.isInteger(product.capacity_gb) ? product.capacity_gb : null,
      condition: product.condition == null ? null : String(product.condition),
      color: product.color == null ? null : String(product.color)
    },
    normalized_price: priceMinor,
    currency: normalizeCurrency(context.currency),
    confidence
  };
}

function normalizeProviderResponse(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');

  const providerRequest = request.provider_request;
  if (!providerRequest || providerRequest.contract_version !== CONTRACT_VERSION) {
    throw new Error('provider_request invalido');
  }
  if (
    providerRequest.execution_status !== 'SUCCEEDED' ||
    providerRequest.freshness_status !== 'CURRENT'
  ) {
    throw new Error('provider_request precisa estar CURRENT e SUCCEEDED');
  }

  const responseId = assertNonEmpty(request.provider_response_id, 'provider_response_id');
  const hits = Array.isArray(request.hits) ? request.hits : [];
  const currency = providerRequest.research_subject?.currency;

  const evidence = hits.map((hit, index) =>
    normalizeProviderHit(hit, index, {
      provider_id: providerRequest.provider_id,
      currency
    })
  );

  const outputCore = {
    provider_request_id: providerRequest.provider_request_id,
    provider_id: providerRequest.provider_id,
    offer_id: providerRequest.offer_id,
    offer_revision: providerRequest.offer_revision,
    evidence
  };

  return {
    contract_version: CONTRACT_VERSION,
    engine_version: ENGINE_VERSION,
    provider_response_id: responseId,
    provider_request_id: providerRequest.provider_request_id,
    analysis_id: providerRequest.analysis_id,
    source_id: providerRequest.source_id,
    offer_id: providerRequest.offer_id,
    offer_revision: providerRequest.offer_revision,
    stage: 'RESEARCH_PROVIDER_RESPONSE',
    execution_status: 'SUCCEEDED',
    freshness_status: 'CURRENT',
    evidence_count: evidence.length,
    output_fingerprint: stableHash(JSON.stringify(outputCore)),
    evidence,
    provenance_refs: [
      ...(Array.isArray(providerRequest.provenance_refs) ? providerRequest.provenance_refs : []),
      `provider_request:${providerRequest.provider_request_id}`,
      ...evidence.map(item => `evidence:${item.evidence_id}`)
    ]
  };
}

module.exports = {
  CONTRACT_VERSION,
  ENGINE_VERSION,
  buildQueryText,
  createResearchProviderRequest,
  normalizeProviderHit,
  normalizeProviderResponse
};
