'use strict';

const { normalizeKey } = require('./core');

const SEMANTIC_SHADOW_VERSION = 'semantic-shadow/0.1.0';

function canonicalCondition(value) {
  const key = normalizeKey(value);
  const map = new Map([
    ['lacrado', 'Lacrado'], ['lacrados', 'Lacrado'],
    ['novo', 'Novo'], ['novos', 'Novo'],
    ['cpo', 'CPO'],
    ['seminovo', 'Seminovo'], ['seminovos', 'Seminovo'],
    ['usado', 'Usado'], ['usados', 'Usado']
  ]);
  return map.get(key) || (value == null ? null : String(value).trim());
}

function canonicalColor(value, options = {}) {
  if (value == null) return null;
  const raw = String(value).trim();
  const aliases = options.color_aliases;
  if (!aliases || typeof aliases !== 'object') return raw;

  const key = normalizeKey(raw);
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (normalizeKey(alias) === key) return String(canonical).trim();
  }
  return raw;
}

function coreOffers(bundle) {
  if (!bundle || bundle.contract_version !== 'interpretation-bundle/v1') {
    throw new Error('bundle invalido: interpretation-bundle/v1 esperado');
  }
  return (bundle.records || []).map(record => ({
    core_record_id: record.record_id,
    fields: {
      model: record.fields?.model ?? null,
      capacity_gb: record.fields?.capacity_gb ?? null,
      condition: canonicalCondition(record.fields?.condition),
      color: record.fields?.color == null ? null : String(record.fields.color).trim(),
      supplier: record.fields?.supplier == null ? null : String(record.fields.supplier).trim(),
      price: Number.isFinite(Number(record.fields?.price)) ? Number(record.fields.price) : null
    },
    trace: record.trace || []
  })).filter(offer => offer.fields.model?.id && offer.fields.price != null);
}

function offerKey(fields, options = {}) {
  const includeColor = options.include_color !== false;
  const includeSupplier = options.include_supplier === true;
  const pieces = [
    fields.model?.id || null,
    fields.capacity_gb == null ? null : Number(fields.capacity_gb),
    canonicalCondition(fields.condition),
    includeColor ? normalizeKey(canonicalColor(fields.color, options)) || null : undefined,
    includeSupplier ? normalizeKey(fields.supplier) || null : undefined,
    fields.price == null ? null : Number(fields.price)
  ];
  return JSON.stringify(pieces);
}

function countOffers(offers, options = {}) {
  const counts = new Map();
  for (const offer of offers || []) {
    const key = offerKey(offer.fields || {}, options);
    const entry = counts.get(key) || { key, fields: offer.fields, count: 0, records: [] };
    entry.count += 1;
    entry.records.push(offer);
    counts.set(key, entry);
  }
  return counts;
}

function diffCounts(leftCounts, rightCounts) {
  const keys = new Set([...leftCounts.keys(), ...rightCounts.keys()]);
  const missing = [];
  const extra = [];
  let matched = 0;

  for (const key of [...keys].sort()) {
    const left = leftCounts.get(key);
    const right = rightCounts.get(key);
    const leftN = left?.count || 0;
    const rightN = right?.count || 0;
    matched += Math.min(leftN, rightN);
    if (leftN > rightN) missing.push({ key, fields: left.fields, count: leftN - rightN });
    if (rightN > leftN) extra.push({ key, fields: right.fields, count: rightN - leftN });
  }

  return { matched, missing, extra };
}

function summarizeFieldMismatch(legacyOffers, interpretedOffers) {
  const byModelLegacy = new Map();
  const byModelCore = new Map();
  const put = (map, offer) => {
    const id = offer.fields?.model?.id;
    if (!id) return;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(offer);
  };
  legacyOffers.forEach(o => put(byModelLegacy, o));
  interpretedOffers.forEach(o => put(byModelCore, o));

  const models = new Set([...byModelLegacy.keys(), ...byModelCore.keys()]);
  const summary = [];
  for (const model of [...models].sort()) {
    const legacy = byModelLegacy.get(model) || [];
    const core = byModelCore.get(model) || [];
    const legacyPrices = [...new Set(legacy.map(o => o.fields.price).filter(v => v != null))].sort((a,b)=>a-b);
    const corePrices = [...new Set(core.map(o => o.fields.price).filter(v => v != null))].sort((a,b)=>a-b);
    summary.push({ model, legacy_count: legacy.length, core_count: core.length, legacy_prices: legacyPrices, core_prices: corePrices });
  }
  return summary;
}

function priceIdentityKey(fields, options = {}) {
  const includeColor = options.include_color !== false;
  const includeSupplier = options.include_supplier === true;
  return JSON.stringify([
    fields.model?.id || null,
    fields.capacity_gb == null ? null : Number(fields.capacity_gb),
    canonicalCondition(fields.condition),
    includeColor ? normalizeKey(canonicalColor(fields.color, options)) || null : undefined,
    includeSupplier ? normalizeKey(fields.supplier) || null : undefined
  ]);
}

function priceSubstitutionDiagnostics(legacyOffers, interpretedOffers, options = {}) {
  const group = offers => {
    const byIdentity = new Map();
    for (const offer of offers || []) {
      const fields = offer.fields || {};
      const key = priceIdentityKey(fields, options);
      if (!byIdentity.has(key)) byIdentity.set(key, new Map());
      const price = fields.price == null || !Number.isFinite(Number(fields.price))
        ? null
        : Number(fields.price);
      const counts = byIdentity.get(key);
      counts.set(price, (counts.get(price) || 0) + 1);
    }
    return byIdentity;
  };

  const left = group(legacyOffers);
  const right = group(interpretedOffers);
  const identities = new Set([...left.keys(), ...right.keys()]);
  let substitutions = 0;
  let identitiesWithSubstitution = 0;
  const byModel = {};
  const surplusTraceByRule = {};
  const supplierCardinalityByModel = {};
  let substitutionsSingleSupplierIdentity = 0;
  let substitutionsMultiSupplierIdentity = 0;
  let substitutionsUnknownSupplierIdentity = 0;

  const firstSource = trace => Array.isArray(trace?.sources) && trace.sources.length
    ? Number(trace.sources[0])
    : null;
  const ruleName = trace => Array.isArray(trace?.rules) && trace.rules.length
    ? trace.rules.join('+')
    : '(no-trace)';
  const safeTraceSignature = (offer, model) => {
    const traces = Array.isArray(offer?.trace) ? offer.trace : [];
    const priceTrace = traces.find(trace => trace.field === 'price');
    const colorTrace = traces.find(trace => trace.field === 'color');
    const conditionTrace = traces.find(trace => trace.field === 'condition');
    const priceLine = firstSource(priceTrace);
    const colorLine = firstSource(colorTrace);
    let relation = 'color_source_unknown';
    if (Number.isFinite(priceLine) && Number.isFinite(colorLine)) {
      const delta = priceLine - colorLine;
      relation = delta === 0
        ? 'same_line'
        : delta > 0
          ? `color_before_price:d${Math.abs(delta)}`
          : `color_after_price:d${Math.abs(delta)}`;
    } else if (Number.isFinite(priceLine)) {
      relation = 'no_color_trace';
    }
    return [
      model,
      `color=${ruleName(colorTrace)}`,
      `condition=${ruleName(conditionTrace)}`,
      `price=${ruleName(priceTrace)}`,
      relation
    ].join(' | ');
  };

  for (const identity of identities) {
    if (!left.has(identity) || !right.has(identity)) continue;
    const legacyPrices = left.get(identity);
    const corePrices = right.get(identity);
    const prices = new Set([...legacyPrices.keys(), ...corePrices.keys()]);
    let missing = 0;
    let extra = 0;

    for (const price of prices) {
      const l = legacyPrices.get(price) || 0;
      const r = corePrices.get(price) || 0;
      if (l > r) missing += l - r;
      if (r > l) extra += r - l;
    }

    const replaced = Math.min(missing, extra);
    if (replaced > 0) {
      substitutions += replaced;
      identitiesWithSubstitution += 1;
      const model = JSON.parse(identity)[0] || '(unknown)';
      byModel[model] = (byModel[model] || 0) + replaced;

      const suppliers = new Set(
        (legacyOffers || [])
          .filter(offer => priceIdentityKey(offer.fields || {}, options) === identity)
          .map(offer => offer?.metadata?.supplier)
          .filter(value => value != null && String(value).trim() !== '')
          .map(value => String(value).trim())
      );
      const supplierCount = suppliers.size;
      const bucketKey = supplierCount === 0 ? 'unknown' : supplierCount === 1 ? 'single' : 'multi';
      supplierCardinalityByModel[model] = supplierCardinalityByModel[model] || {
        substitution_identities: 0,
        single_supplier_identities: 0,
        multi_supplier_identities: 0,
        unknown_supplier_identities: 0
      };
      supplierCardinalityByModel[model].substitution_identities += 1;
      supplierCardinalityByModel[model][`${bucketKey}_supplier_identities`] += 1;
      if (supplierCount === 0) substitutionsUnknownSupplierIdentity += replaced;
      else if (supplierCount === 1) substitutionsSingleSupplierIdentity += replaced;
      else substitutionsMultiSupplierIdentity += replaced;

      const legacyCountByPrice = legacyPrices;
      const seenCoreByPrice = new Map();
      let remainingDiagnosticSlots = replaced;
      for (const offer of interpretedOffers || []) {
        if (remainingDiagnosticSlots <= 0) break;
        if (priceIdentityKey(offer.fields || {}, options) !== identity) continue;
        const price = offer.fields?.price == null || !Number.isFinite(Number(offer.fields.price))
          ? null
          : Number(offer.fields.price);
        const seen = (seenCoreByPrice.get(price) || 0) + 1;
        seenCoreByPrice.set(price, seen);
        const legacyCount = legacyCountByPrice.get(price) || 0;
        if (seen <= legacyCount) continue;
        const signature = safeTraceSignature(offer, model);
        surplusTraceByRule[signature] = (surplusTraceByRule[signature] || 0) + 1;
        remainingDiagnosticSlots -= 1;
      }
    }
  }

  return {
    substitutions,
    identities_with_substitution: identitiesWithSubstitution,
    by_model: byModel,
    surplus_trace_by_rule: surplusTraceByRule,
    supplier_cardinality_by_model: supplierCardinalityByModel,
    substitutions_single_supplier_identity: substitutionsSingleSupplierIdentity,
    substitutions_multi_supplier_identity: substitutionsMultiSupplierIdentity,
    substitutions_unknown_supplier_identity: substitutionsUnknownSupplierIdentity
  };
}

function compareSemanticShadow({ legacy, coreBundle, options = {} }) {
  if (!legacy || legacy.contract_version !== 'legacy-semantic-offers/v1') {
    throw new Error('legacy invalido: legacy-semantic-offers/v1 esperado');
  }
  const interpreted = coreOffers(coreBundle);
  const left = countOffers(legacy.offers, options);
  const right = countOffers(interpreted, options);
  const diff = diffCounts(left, right);
  const legacyN = legacy.offers.length;
  const coreN = interpreted.length;
  const denominator = Math.max(legacyN, coreN, 1);
  const exact = diff.missing.length === 0 && diff.extra.length === 0;
  const priceDiagnostic = priceSubstitutionDiagnostics(legacy.offers, interpreted, options);

  return {
    contract_version: 'semantic-shadow-report/v1',
    version: SEMANTIC_SHADOW_VERSION,
    options: {
      include_color: options.include_color !== false,
      include_supplier: options.include_supplier === true
    },
    metrics: {
      legacy_supported_offers: legacyN,
      core_offers: coreN,
      matched_offers: diff.matched,
      missing_offers: diff.missing.reduce((n, x) => n + x.count, 0),
      extra_offers: diff.extra.reduce((n, x) => n + x.count, 0),
      exact_multiset: exact,
      agreement_ratio: Math.round((diff.matched / denominator) * 10000) / 10000,
      core_ambiguities: Array.isArray(coreBundle.ambiguities) ? coreBundle.ambiguities.length : 0,
      core_learning_proposals: Array.isArray(coreBundle.learning_proposals) ? coreBundle.learning_proposals.length : 0,
      silent_wrong_price_substitutions: priceDiagnostic.substitutions,
      silent_wrong_price_identities: priceDiagnostic.identities_with_substitution,
      silent_wrong_price_by_model: priceDiagnostic.by_model,
      silent_wrong_price_surplus_trace_by_rule: priceDiagnostic.surplus_trace_by_rule,
      silent_wrong_price_supplier_cardinality_by_model: priceDiagnostic.supplier_cardinality_by_model,
      silent_wrong_price_single_supplier_identity: priceDiagnostic.substitutions_single_supplier_identity,
      silent_wrong_price_multi_supplier_identity: priceDiagnostic.substitutions_multi_supplier_identity,
      silent_wrong_price_unknown_supplier_identity: priceDiagnostic.substitutions_unknown_supplier_identity,
      confirmed_silent_wrong_price: priceDiagnostic.substitutions_single_supplier_identity,
      unresolved_price_attribution:
        priceDiagnostic.substitutions_multi_supplier_identity +
        priceDiagnostic.substitutions_unknown_supplier_identity
    },
    gates: {
      no_silent_wrong_price: priceDiagnostic.substitutions_single_supplier_identity === 0,
      price_attribution_resolved:
        priceDiagnostic.substitutions_multi_supplier_identity === 0 &&
        priceDiagnostic.substitutions_unknown_supplier_identity === 0,
      exact_multiset: exact
    },
    missing: diff.missing,
    extra: diff.extra,
    by_model: summarizeFieldMismatch(legacy.offers, interpreted)
  };
}

module.exports = {
  SEMANTIC_SHADOW_VERSION,
  canonicalCondition,
  canonicalColor,
  coreOffers,
  offerKey,
  countOffers,
  diffCounts,
  priceIdentityKey,
  priceSubstitutionDiagnostics,
  compareSemanticShadow
};
