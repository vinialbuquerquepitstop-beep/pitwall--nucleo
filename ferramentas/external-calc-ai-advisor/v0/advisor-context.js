'use strict';

const crypto = require('crypto');

const CONTRACT_VERSION = 'external-calc-ai-advisor-context/v0';
const VALIDATOR_VERSION = 'external-calc-ai-advisor-candidate-validator/v0';
const C05_CONTRACT_VERSION = 'external-calc-c05/v1';

const AUTHORIZED_ROLES = new Set(['dono', 'validador']);
const ALLOWED_INSIGHT_TYPES = new Set([
  'MARKET_POSITION',
  'NEGOTIATION_OPPORTUNITY',
  'SUPPLIER_COMPETITIVENESS',
  'ANOMALY',
  'SPREAD',
  'TREND',
  'PROMOTION_POTENTIAL'
]);
const ALLOWED_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH']);

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(field + ' obrigatorio');
  }
  return value.trim();
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' deve ser objeto');
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(label + ' possui campos nao permitidos');
  }
}

function assertAuthorityContext(authority) {
  if (!authority || typeof authority !== 'object') {
    throw new Error('authority_context obrigatorio');
  }

  const tenantId = assertNonEmpty(authority.tenant_id, 'authority_context.tenant_id');
  const resourceTenantId = assertNonEmpty(
    authority.resource_tenant_id,
    'authority_context.resource_tenant_id'
  );
  const actorRole = assertNonEmpty(authority.actor_role, 'authority_context.actor_role');

  if (tenantId !== resourceTenantId) {
    throw new Error('TENANT_MISMATCH: recurso nao pertence ao tenant autenticado');
  }
  if (!AUTHORIZED_ROLES.has(actorRole)) {
    const error = new Error('ADVISOR_FORBIDDEN: papel sem projecao segura do Advisor V0');
    error.code = 'FORBIDDEN';
    throw error;
  }

  return { tenant_id: tenantId, actor_role: actorRole };
}

function assertExpectedIdentity(c05, expected) {
  const analysisId = assertNonEmpty(expected && expected.analysis_id, 'expected.analysis_id');
  const offerId = assertNonEmpty(expected && expected.offer_id, 'expected.offer_id');
  if (!Number.isInteger(expected && expected.offer_revision) || expected.offer_revision < 1) {
    throw new Error('expected.offer_revision invalida');
  }

  if (
    c05.analysis_id !== analysisId ||
    c05.offer_id !== offerId ||
    c05.offer_revision !== expected.offer_revision
  ) {
    throw new Error('ADVISOR_SOURCE_MISMATCH: C05 nao corresponde a oferta selecionada');
  }
}

function normalizeC05(c05, expected) {
  if (!c05 || c05.contract_version !== C05_CONTRACT_VERSION) {
    throw new Error('C05 invalido para Advisor');
  }
  if (c05.execution_status !== 'SUCCEEDED') {
    throw new Error('C05 precisa estar SUCCEEDED');
  }
  if (c05.freshness_status !== 'CURRENT') {
    throw new Error('C05 precisa estar CURRENT');
  }
  assertExpectedIdentity(c05, expected);
  assertNonEmpty(c05.decision_output_id, 'C05 decision_output_id');
  assertNonEmpty(c05.output_fingerprint, 'C05 output_fingerprint');

  if (!c05.reviewed_offer || !c05.reviewed_offer.price || !c05.reviewed_offer.model) {
    throw new Error('C05 reviewed_offer incompleto');
  }
  if (!c05.research || !c05.price_indicator || !c05.calculation) {
    throw new Error('C05 incompleto para Advisor');
  }

  return c05;
}

function selectedIdentity(c05) {
  return {
    model_id: c05.reviewed_offer.model && c05.reviewed_offer.model.id != null
      ? String(c05.reviewed_offer.model.id)
      : null,
    model_label: c05.reviewed_offer.model && c05.reviewed_offer.model.label != null
      ? String(c05.reviewed_offer.model.label)
      : null,
    capacity_gb: Number.isInteger(c05.reviewed_offer.capacity_gb)
      ? c05.reviewed_offer.capacity_gb
      : null,
    condition: c05.reviewed_offer.condition == null
      ? null
      : String(c05.reviewed_offer.condition),
    color: c05.reviewed_offer.color == null
      ? null
      : String(c05.reviewed_offer.color),
    currency: String(c05.reviewed_offer.price.currency)
  };
}

function sameModel(selected, product) {
  if (selected.model_id && product.model_id) return selected.model_id === product.model_id;
  return Boolean(
    selected.model_label &&
    product.model_label &&
    selected.model_label === product.model_label
  );
}

function normalizeEvidenceRecords(c05, evidenceRecords) {
  const eligibleIds = Array.isArray(c05.research.eligible_evidence_ids)
    ? c05.research.eligible_evidence_ids.map(String)
    : [];
  const byId = new Map();

  for (const item of Array.isArray(evidenceRecords) ? evidenceRecords : []) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.evidence_id !== 'string' || !item.evidence_id.trim()) continue;
    byId.set(item.evidence_id, item);
  }

  const selected = selectedIdentity(c05);
  const safe = [];

  for (const evidenceId of eligibleIds) {
    const item = byId.get(evidenceId);
    if (!item) {
      throw new Error('ADVISOR_EVIDENCE_MISSING: ' + evidenceId);
    }
    const product = item.product && typeof item.product === 'object' ? item.product : {};
    const exactMatch =
      sameModel(selected, product) &&
      product.capacity_gb === selected.capacity_gb &&
      product.condition === selected.condition &&
      product.color === selected.color &&
      item.currency === selected.currency;

    if (!exactMatch) {
      throw new Error('ADVISOR_EVIDENCE_MISMATCH: ' + evidenceId);
    }
    if (!Number.isSafeInteger(item.normalized_price) || item.normalized_price <= 0) {
      throw new Error('ADVISOR_EVIDENCE_PRICE_INVALID: ' + evidenceId);
    }

    safe.push({
      evidence_id: evidenceId,
      source_ref: item.source_ref == null ? null : String(item.source_ref),
      source_url: item.source_url == null ? null : String(item.source_url),
      observed_at: item.observed_at == null ? null : String(item.observed_at),
      product: clone(product),
      normalized_price: item.normalized_price,
      currency: item.currency,
      confidence: typeof item.confidence === 'number' ? item.confidence : null
    });
  }

  return safe;
}

function sourceRefs(c05, evidence) {
  const refs = [
    'decision_output:' + c05.decision_output_id,
    'offer_revision:' + c05.offer_id + ':' + c05.offer_revision,
    'research_run:' + c05.research.research_run_id,
    'price_signal_run:' + c05.price_indicator.price_signal_run_id,
    ...evidence.map(item => 'evidence:' + item.evidence_id)
  ];
  return [...new Set(refs.filter(Boolean))];
}

function buildAdvisorContext(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');

  const authority = assertAuthorityContext(request.authority_context);
  const c05 = normalizeC05(request.c05_decision_output, request.expected);
  const base = {
    contract_version: CONTRACT_VERSION,
    analysis_id: c05.analysis_id,
    offer_id: c05.offer_id,
    offer_revision: c05.offer_revision,
    decision_output_id: c05.decision_output_id,
    decision_output_fingerprint: c05.output_fingerprint,
    tenant_id: authority.tenant_id,
    actor_role: authority.actor_role
  };

  if (c05.decision_outcome === 'INSUFFICIENT_DATA' || c05.domain_outcome === 'INSUFFICIENT_DATA') {
    return {
      ...base,
      advisor_status: 'BLOCKED_INSUFFICIENT_DATA',
      blocking_reason: 'C05_INSUFFICIENT_DATA',
      model_input: null,
      context_fingerprint: stableHash(JSON.stringify({
        decision_output_id: c05.decision_output_id,
        output_fingerprint: c05.output_fingerprint,
        status: 'BLOCKED_INSUFFICIENT_DATA'
      }))
    };
  }

  if (c05.decision_outcome !== 'READY' || c05.domain_outcome !== 'READY') {
    throw new Error(
      'ADVISOR_NOT_ELIGIBLE: C05 outcome ' +
      (c05.decision_outcome || c05.domain_outcome)
    );
  }

  const evidence = normalizeEvidenceRecords(c05, request.evidence_records);
  const refs = sourceRefs(c05, evidence);
  const facts = {
    offer: {
      supplier_id: c05.reviewed_offer.supplier_id == null
        ? null
        : String(c05.reviewed_offer.supplier_id),
      model: clone(c05.reviewed_offer.model),
      capacity_gb: c05.reviewed_offer.capacity_gb,
      condition: c05.reviewed_offer.condition,
      color: c05.reviewed_offer.color,
      supplier_offer_price: clone(c05.reviewed_offer.price)
    },
    market: {
      price_signal: c05.price_indicator.price_signal,
      market_reference_price: clone(c05.price_indicator.market_reference_price),
      market_delta_amount: clone(c05.price_indicator.market_delta_amount),
      market_delta_percent: c05.price_indicator.market_delta_percent,
      price_signal_confidence: c05.price_indicator.price_signal_confidence,
      comparable_evidence_count: c05.price_indicator.comparable_evidence_count,
      reason: c05.price_indicator.reason,
      evidence
    },
    commercial: {
      store_cost: clone(c05.calculation.store_cost),
      normal_sale_price: clone(c05.calculation.normal_sale_price),
      installment_base_price: clone(c05.calculation.installment_base_price),
      estimated_margin: clone(c05.calculation.estimated_margin),
      estimated_margin_percent: c05.calculation.estimated_margin_percent,
      promo_price: c05.calculation.promo_price == null
        ? null
        : clone(c05.calculation.promo_price),
      promotion_floor: c05.calculation.promotion_floor == null
        ? null
        : clone(c05.calculation.promotion_floor),
      promotion_range: c05.calculation.promotion_range == null
        ? null
        : clone(c05.calculation.promotion_range)
    }
  };

  const modelInput = {
    task: 'EXPLAIN_SELECTED_OFFER_AND_SUPPORT_NEGOTIATION',
    facts,
    allowed_evidence_refs: refs,
    guardrails: {
      max_insights: 3,
      insights_are_advisory: true,
      operational_data_is_read_only: true,
      may_override_price: false,
      may_override_provenance: false,
      may_invent_missing_values: false,
      allowed_insight_types: [...ALLOWED_INSIGHT_TYPES]
    }
  };

  return {
    ...base,
    advisor_status: 'READY_FOR_MODEL',
    blocking_reason: null,
    model_input: modelInput,
    context_fingerprint: stableHash(JSON.stringify(modelInput))
  };
}

function validateAdvisorCandidate(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');
  const context = request.context;
  if (!context || context.contract_version !== CONTRACT_VERSION) {
    throw new Error('Advisor context invalido');
  }
  if (context.advisor_status !== 'READY_FOR_MODEL' || !context.model_input) {
    throw new Error('Advisor context nao elegivel para candidate output');
  }

  const candidate = request.candidate_output;
  assertExactKeys(candidate, ['insights'], 'candidate_output');
  if (!Array.isArray(candidate.insights)) {
    throw new Error('candidate_output.insights deve ser array');
  }
  if (candidate.insights.length > 3) {
    throw new Error('candidate_output excede max_insights=3');
  }

  const allowedRefs = new Set(context.model_input.allowed_evidence_refs || []);
  const seenIds = new Set();
  const normalized = [];

  for (let index = 0; index < candidate.insights.length; index += 1) {
    const item = candidate.insights[index];
    assertExactKeys(
      item,
      ['insight_id', 'type', 'severity', 'evidence_refs', 'summary', 'confidence'],
      'insights[' + index + ']'
    );

    const insightId = assertNonEmpty(item.insight_id, 'insights[' + index + '].insight_id');
    if (seenIds.has(insightId)) throw new Error('insight_id duplicado');
    seenIds.add(insightId);

    const type = assertNonEmpty(item.type, 'insights[' + index + '].type');
    if (!ALLOWED_INSIGHT_TYPES.has(type)) {
      throw new Error('insight type nao permitido: ' + type);
    }

    const severity = assertNonEmpty(item.severity, 'insights[' + index + '].severity');
    if (!ALLOWED_SEVERITIES.has(severity)) {
      throw new Error('severity invalida: ' + severity);
    }

    const summary = assertNonEmpty(item.summary, 'insights[' + index + '].summary');
    if (summary.length > 800) throw new Error('insight summary excede limite');

    if (
      typeof item.confidence !== 'number' ||
      !Number.isFinite(item.confidence) ||
      item.confidence < 0 ||
      item.confidence > 1
    ) {
      throw new Error('insights[' + index + '].confidence invalida');
    }

    if (!Array.isArray(item.evidence_refs) || item.evidence_refs.length < 1) {
      throw new Error('insights[' + index + '].evidence_refs obrigatorio');
    }
    const evidenceRefs = [...new Set(item.evidence_refs.map(String))];
    for (const ref of evidenceRefs) {
      if (!allowedRefs.has(ref)) {
        throw new Error('evidence_ref nao autorizado: ' + ref);
      }
    }

    normalized.push({
      insight_id: insightId,
      type,
      severity,
      evidence_refs: evidenceRefs,
      summary,
      confidence: item.confidence
    });
  }

  return {
    validator_version: VALIDATOR_VERSION,
    validator_status: 'PASS',
    context_fingerprint: context.context_fingerprint,
    candidate_output: { insights: normalized }
  };
}

module.exports = {
  CONTRACT_VERSION,
  VALIDATOR_VERSION,
  AUTHORIZED_ROLES,
  ALLOWED_INSIGHT_TYPES,
  ALLOWED_SEVERITIES,
  buildAdvisorContext,
  validateAdvisorCandidate
};
