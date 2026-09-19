'use strict';

const crypto = require('crypto');

const CONTRACT_VERSION = 'external-calc-c04/v1';
const ENGINE_VERSION = 'c04-price-indicator/1.0.0';
const C01_CONTRACT_VERSION = 'external-calc-c01-readonly/v1';
const C03_CONTRACT_VERSION = 'external-calc-c03/v1';
const OUTCOMES = new Set([
  'CHEAP',
  'MARKET',
  'EXPENSIVE',
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

function normalizeCurrency(value) {
  const currency = assertNonEmpty(value, 'currency').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('currency invalida');
  return currency;
}

function normalizeC01(candidate) {
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
    throw new Error('C01 reviewed_offer.price obrigatorio');
  }

  const price = candidate.reviewed_offer.price;
  if (!Number.isSafeInteger(price.amount_minor) || price.amount_minor <= 0) {
    throw new Error('C01 reviewed_offer.price invalido');
  }

  if (!Number.isInteger(candidate.offer_revision) || candidate.offer_revision < 1) {
    throw new Error('C01 offer_revision invalida');
  }

  return {
    analysis_id: assertNonEmpty(candidate.analysis_id, 'C01 analysis_id'),
    source_id: assertNonEmpty(candidate.source_id, 'C01 source_id'),
    offer_id: assertNonEmpty(candidate.offer_id, 'C01 offer_id'),
    offer_revision: candidate.offer_revision,
    offer_value_fingerprint: assertNonEmpty(
      candidate.offer_value_fingerprint,
      'C01 offer_value_fingerprint'
    ),
    price: {
      amount_minor: price.amount_minor,
      currency: normalizeCurrency(price.currency)
    },
    provenance_refs: Array.isArray(candidate.provenance_refs)
      ? [...candidate.provenance_refs]
      : []
  };
}

function normalizeC03(research, c01) {
  if (!research || research.contract_version !== C03_CONTRACT_VERSION) {
    throw new Error('C03 research invalido');
  }
  if (research.execution_status !== 'SUCCEEDED') {
    throw new Error('C03 precisa estar SUCCEEDED');
  }
  if (research.freshness_status !== 'CURRENT') {
    throw new Error('C03 precisa estar CURRENT');
  }

  if (
    research.analysis_id !== c01.analysis_id ||
    research.offer_id !== c01.offer_id ||
    research.offer_revision !== c01.offer_revision
  ) {
    throw new Error('UPSTREAM_STALE: C03 nao corresponde a revisao C01 atual');
  }

  if (!research.research_subject || research.research_subject.currency !== c01.price.currency) {
    throw new Error('UPSTREAM_STALE: moeda C03 difere do C01 atual');
  }

  const evidence = Array.isArray(research.evidence) ? research.evidence : [];
  const eligible = evidence.filter(item => item && item.eligible === true);

  for (const item of eligible) {
    if (!Number.isSafeInteger(item.normalized_price) || item.normalized_price <= 0) {
      throw new Error('C03 evidence elegivel com normalized_price invalido');
    }
    if (normalizeCurrency(item.currency) !== c01.price.currency) {
      throw new Error('C03 evidence elegivel com moeda divergente');
    }
    assertNonEmpty(item.evidence_id, 'C03 evidence_id');
  }

  const confidence = research.research_confidence;
  if (
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new Error('C03 research_confidence invalida');
  }

  return {
    research_run_id: assertNonEmpty(research.research_run_id, 'research_run_id'),
    output_fingerprint: assertNonEmpty(
      research.output_fingerprint,
      'C03 output_fingerprint'
    ),
    research_confidence: confidence,
    eligible_evidence: eligible.map(item => ({
      evidence_id: item.evidence_id,
      normalized_price: item.normalized_price,
      currency: item.currency,
      confidence: item.confidence,
      source_ref: item.source_ref ?? null,
      observed_at: item.observed_at ?? null
    })),
    provenance_refs: Array.isArray(research.provenance_refs)
      ? [...research.provenance_refs]
      : []
  };
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('indicator_profile obrigatorio');
  }

  const minEvidenceCount = profile.min_evidence_count;
  if (!Number.isSafeInteger(minEvidenceCount) || minEvidenceCount < 1) {
    throw new Error('min_evidence_count invalido');
  }

  const cheap = profile.cheap_at_or_below_percent;
  const expensive = profile.expensive_at_or_above_percent;

  if (typeof cheap !== 'number' || !Number.isFinite(cheap)) {
    throw new Error('cheap_at_or_below_percent invalido');
  }
  if (typeof expensive !== 'number' || !Number.isFinite(expensive)) {
    throw new Error('expensive_at_or_above_percent invalido');
  }
  if (cheap >= expensive) {
    throw new Error('faixa MARKET invalida: cheap deve ser menor que expensive');
  }

  return {
    profile_id: assertNonEmpty(profile.profile_id, 'profile_id'),
    profile_version: assertNonEmpty(profile.profile_version, 'profile_version'),
    min_evidence_count: minEvidenceCount,
    cheap_at_or_below_percent: cheap,
    expensive_at_or_above_percent: expensive
  };
}

function medianMinor(values) {
  if (!Array.isArray(values) || !values.length) {
    throw new Error('median requer valores');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function roundPercent(value) {
  return Math.round(value * 10000) / 10000;
}

function signedMoney(amountMinor, currency) {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error('signed money invalido');
  }
  return {
    amount_minor: amountMinor,
    currency: normalizeCurrency(currency)
  };
}

function classify(deltaPercent, profile) {
  if (deltaPercent <= profile.cheap_at_or_below_percent) return 'CHEAP';
  if (deltaPercent >= profile.expensive_at_or_above_percent) return 'EXPENSIVE';
  return 'MARKET';
}

function priceSignalInputFingerprint(c01, c03, profile) {
  return stableHash(JSON.stringify({
    evaluated_price: c01.price,
    evaluated_price_basis: 'SUPPLIER_OFFER_PRICE',
    offer_id: c01.offer_id,
    offer_revision: c01.offer_revision,
    c01_value_fingerprint: c01.offer_value_fingerprint,
    research_run_id: c03.research_run_id,
    research_output_fingerprint: c03.output_fingerprint,
    indicator_profile: profile
  }));
}

function runC04PriceIndicator(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');

  const priceSignalRunId = assertNonEmpty(
    request.price_signal_run_id,
    'price_signal_run_id'
  );
  const c01 = normalizeC01(request.c01_candidate);
  const c03 = normalizeC03(request.c03_research, c01);
  const profile = normalizeProfile(request.indicator_profile);
  const prices = c03.eligible_evidence.map(item => item.normalized_price);
  const inputFingerprint = priceSignalInputFingerprint(c01, c03, profile);

  let domainOutcome;
  let marketReferencePrice = null;
  let marketDeltaAmount = null;
  let marketDeltaPercent = null;
  let reason;

  if (prices.length < profile.min_evidence_count) {
    domainOutcome = 'INSUFFICIENT_DATA';
    reason =
      `Evidencias comparaveis insuficientes: ${prices.length}/${profile.min_evidence_count}.`;
  } else {
    const referenceMinor = medianMinor(prices);
    const deltaMinor = c01.price.amount_minor - referenceMinor;
    const deltaPercent = roundPercent((deltaMinor / referenceMinor) * 100);

    marketReferencePrice = {
      amount_minor: referenceMinor,
      currency: c01.price.currency
    };
    marketDeltaAmount = signedMoney(deltaMinor, c01.price.currency);
    marketDeltaPercent = deltaPercent;
    domainOutcome = classify(deltaPercent, profile);
    reason =
      `Oferta ${deltaPercent}% vs mediana de ${prices.length} evidencias comparaveis.`;
  }

  if (!OUTCOMES.has(domainOutcome)) {
    throw new Error('price signal outcome invalido');
  }

  const outputCore = {
    evaluated_price: {
      amount_minor: c01.price.amount_minor,
      currency: c01.price.currency
    },
    evaluated_price_basis: 'SUPPLIER_OFFER_PRICE',
    evaluated_price_source_contract: 'C01',
    evaluated_price_source_field: 'reviewed_offer.price',
    market_reference_price: marketReferencePrice,
    market_delta_amount: marketDeltaAmount,
    market_delta_percent: marketDeltaPercent,
    price_signal: domainOutcome,
    price_signal_confidence: c03.research_confidence,
    confidence_basis: 'C03_RESEARCH_CONFIDENCE_V0',
    comparable_evidence_count: prices.length,
    evidence_ids: c03.eligible_evidence.map(item => item.evidence_id),
    reason
  };

  return {
    contract_version: CONTRACT_VERSION,
    price_signal_run_id: priceSignalRunId,
    analysis_id: c01.analysis_id,
    source_id: c01.source_id,
    offer_id: c01.offer_id,
    offer_revision: c01.offer_revision,
    contract_id: 'C04',
    engine_version: ENGINE_VERSION,
    indicator_profile_id: profile.profile_id,
    indicator_profile_version: profile.profile_version,
    stage: 'PRICE_INDICATOR',
    run_kind: 'INITIAL',
    attempt_no: 1,
    execution_status: 'SUCCEEDED',
    domain_outcome: domainOutcome,
    freshness_status: 'CURRENT',
    price_signal_input_fingerprint: inputFingerprint,
    output_fingerprint: stableHash(JSON.stringify(outputCore)),
    ...outputCore,
    provenance_refs: [
      ...c01.provenance_refs,
      ...c03.provenance_refs,
      `offer_revision:${c01.offer_id}:${c01.offer_revision}`,
      `research_run:${c03.research_run_id}`,
      `indicator_profile:${profile.profile_id}:${profile.profile_version}`
    ]
  };
}

module.exports = {
  CONTRACT_VERSION,
  ENGINE_VERSION,
  medianMinor,
  classify,
  runC04PriceIndicator
};
