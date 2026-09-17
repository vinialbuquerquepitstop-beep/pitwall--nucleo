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
      price: Number.isFinite(Number(record.fields?.price)) ? Number(record.fields.price) : null
    },
    trace: record.trace || []
  })).filter(offer => offer.fields.model?.id && offer.fields.price != null);
}

function offerKey(fields, options = {}) {
  const includeColor = options.include_color !== false;
  const pieces = [
    fields.model?.id || null,
    fields.capacity_gb == null ? null : Number(fields.capacity_gb),
    canonicalCondition(fields.condition),
    includeColor ? normalizeKey(fields.color) || null : undefined,
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

  return {
    contract_version: 'semantic-shadow-report/v1',
    version: SEMANTIC_SHADOW_VERSION,
    options: { include_color: options.include_color !== false },
    metrics: {
      legacy_supported_offers: legacyN,
      core_offers: coreN,
      matched_offers: diff.matched,
      missing_offers: diff.missing.reduce((n, x) => n + x.count, 0),
      extra_offers: diff.extra.reduce((n, x) => n + x.count, 0),
      exact_multiset: exact,
      agreement_ratio: Math.round((diff.matched / denominator) * 10000) / 10000,
      core_ambiguities: Array.isArray(coreBundle.ambiguities) ? coreBundle.ambiguities.length : 0,
      core_learning_proposals: Array.isArray(coreBundle.learning_proposals) ? coreBundle.learning_proposals.length : 0
    },
    gates: {
      no_silent_wrong_price: diff.extra.every(x => !diff.missing.some(y => y.fields?.model?.id === x.fields?.model?.id && y.fields?.price !== x.fields?.price)),
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
  coreOffers,
  offerKey,
  countOffers,
  diffCounts,
  compareSemanticShadow
};
