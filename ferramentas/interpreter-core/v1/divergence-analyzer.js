'use strict';

const { canonicalCondition } = require('./semantic-shadow');
const { normalizeKey } = require('./core');

const ANALYZER_VERSION = 'divergence-analyzer/0.3.0';

function normFields(offer) {
  const f = offer?.fields || {};
  return {
    model: f.model?.id || null,
    capacity_gb: f.capacity_gb == null ? null : Number(f.capacity_gb),
    condition: canonicalCondition(f.condition),
    color: normalizeKey(f.color) || null,
    price: f.price == null || !Number.isFinite(Number(f.price)) ? null : Number(f.price)
  };
}

function fullKey(offer) {
  return JSON.stringify(normFields(offer));
}

function removeExactMatches(legacyOffers, coreOffers) {
  const coreBuckets = new Map();
  coreOffers.forEach((offer, index) => {
    const key = fullKey(offer);
    if (!coreBuckets.has(key)) coreBuckets.set(key, []);
    coreBuckets.get(key).push({ offer, index });
  });

  const matchedCore = new Set();
  const remainingLegacy = [];
  let exact = 0;

  for (const legacy of legacyOffers) {
    const bucket = coreBuckets.get(fullKey(legacy)) || [];
    const candidate = bucket.find(x => !matchedCore.has(x.index));
    if (candidate) {
      matchedCore.add(candidate.index);
      exact += 1;
    } else {
      remainingLegacy.push(legacy);
    }
  }

  const remainingCore = coreOffers.filter((_, index) => !matchedCore.has(index));
  return { exact, remainingLegacy, remainingCore };
}

function fieldDiffs(left, right) {
  const a = normFields(left);
  const b = normFields(right);
  return ['capacity_gb', 'condition', 'color', 'price'].filter(field => a[field] !== b[field]);
}

function pairWithinModel(legacyOffers, coreOffers) {
  const usedCore = new Set();
  const pairs = [];
  const unpairedLegacy = [];

  for (const legacy of legacyOffers) {
    const model = normFields(legacy).model;
    let best = null;

    coreOffers.forEach((core, index) => {
      if (usedCore.has(index)) return;
      if (normFields(core).model !== model) return;
      const diffs = fieldDiffs(legacy, core);
      const score = diffs.length;
      if (!best || score < best.score || (score === best.score && index < best.index)) {
        best = { core, index, diffs, score };
      }
    });

    if (!best) {
      unpairedLegacy.push(legacy);
      continue;
    }

    usedCore.add(best.index);
    pairs.push({ legacy, core: best.core, diffs: best.diffs });
  }

  const unpairedCore = coreOffers.filter((_, index) => !usedCore.has(index));
  return { pairs, unpairedLegacy, unpairedCore };
}

function increment(obj, key, n = 1) {
  obj[key] = (obj[key] || 0) + n;
}

function analyzeDivergences({ legacy, coreBundle }) {
  if (!legacy || legacy.contract_version !== 'legacy-semantic-offers/v1') {
    throw new Error('legacy invalido');
  }
  if (!coreBundle || coreBundle.contract_version !== 'interpretation-bundle/v1') {
    throw new Error('core bundle invalido');
  }

  const coreOffers = (coreBundle.records || [])
    .map(record => ({
      fields: record.fields || {},
      core_record_id: record.record_id,
      trace: record.trace || []
    }))
    .filter(offer => offer.fields?.model?.id && Number.isFinite(Number(offer.fields?.price)));

  const base = removeExactMatches(legacy.offers || [], coreOffers);
  const paired = pairWithinModel(base.remainingLegacy, base.remainingCore);

  const categories = {
    exact_matches: base.exact,
    wrong_price_only: 0,
    capacity_only: 0,
    condition_only: 0,
    color_only: 0,
    multi_field_mismatch: 0,
    missing_offer_same_model: 0,
    extra_offer_same_model: 0,
    missing_model: 0,
    extra_model: 0
  };

  const mismatchSignatures = {};
  const conditionPairs = {};
  const conditionPairProvenance = {};
  const conditionScopeDiagnostics = {};
  const wrongPriceDiagnostics = {};
  const multiMismatchDiagnostics = {};
  const modelSummary = new Map();
  const touchModel = model => {
    if (!modelSummary.has(model)) {
      modelSummary.set(model, {
        model,
        legacy: 0,
        core: 0,
        exact: 0,
        wrong_price_only: 0,
        field_mismatches: 0,
        missing: 0,
        extra: 0
      });
    }
    return modelSummary.get(model);
  };

  (legacy.offers || []).forEach(o => { const m = normFields(o).model; if (m) touchModel(m).legacy += 1; });
  coreOffers.forEach(o => { const m = normFields(o).model; if (m) touchModel(m).core += 1; });

  for (const pair of paired.pairs) {
    const model = normFields(pair.legacy).model;
    const row = touchModel(model);
    if (pair.diffs.length === 1) {
      const field = pair.diffs[0];
      const key = field === 'price' ? 'wrong_price_only' : `${field.replace('_gb', '')}_only`;
      increment(categories, key);
      if (field === 'condition') {
        const legacyCondition = normFields(pair.legacy).condition ?? '(null)';
        const coreCondition = normFields(pair.core).condition ?? '(null)';
        const pairKey = `${legacyCondition} -> ${coreCondition}`;
        increment(conditionPairs, pairKey);
        const conditionTrace = (pair.core.trace || []).find(trace => trace.field === 'condition');
        const rules = Array.isArray(conditionTrace?.rules) && conditionTrace.rules.length
          ? conditionTrace.rules.join('+')
          : '(no-trace)';
        increment(conditionPairProvenance, `${pairKey} | ${rules}`);

        const modelTrace = (pair.core.trace || []).find(trace => trace.field === 'model');
        const conditionSource = Array.isArray(conditionTrace?.sources) ? conditionTrace.sources[0] : null;
        const modelSource = Array.isArray(modelTrace?.sources) ? modelTrace.sources[0] : null;
        const recordMatch = /line-(\d+)/.exec(String(pair.core.core_record_id || ''));
        const recordLine = recordMatch ? Number(recordMatch[1]) : null;
        const start = Number.isFinite(Number(modelSource)) ? Number(modelSource) : recordLine;
        const end = Number.isFinite(Number(recordLine)) ? Number(recordLine) : start;
        const scopeSegments = (coreBundle.segments || []).filter(segment =>
          start != null && end != null &&
          segment.line_number >= Math.min(start, end) &&
          segment.line_number <= Math.max(start, end)
        );
        const cpoInScope = scopeSegments.some(segment =>
          (segment.field_candidates || []).some(candidate =>
            candidate.field === 'condition' && canonicalCondition(candidate.value) === 'CPO'
          )
        );
        const conditionBeforeModel =
          conditionSource != null && modelSource != null &&
          Number(conditionSource) < Number(modelSource);
        increment(
          conditionScopeDiagnostics,
          `${pairKey} | cpo_in_scope=${cpoInScope ? 'yes' : 'no'} | condition_before_model=${conditionBeforeModel ? 'yes' : 'no'}`
        );
      }
      if (field === 'price') {
        row.wrong_price_only += 1;
        const colorTrace = (pair.core.trace || []).find(trace => trace.field === 'color');
        const priceTrace = (pair.core.trace || []).find(trace => trace.field === 'price');
        const colorSource = Array.isArray(colorTrace?.sources) ? Number(colorTrace.sources[0]) : null;
        const priceSource = Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null;
        const delta =
          Number.isFinite(colorSource) && Number.isFinite(priceSource)
            ? priceSource - colorSource
            : null;
        const direction = delta == null ? 'unknown' : delta > 0 ? 'color_before_price' : delta < 0 ? 'color_after_price' : 'same_line';
        const distance = delta == null ? 'unknown' : Math.abs(delta);
        const colorRule = Array.isArray(colorTrace?.rules) && colorTrace.rules.length
          ? colorTrace.rules.join('+')
          : '(no-color-trace)';
        const priceRule = Array.isArray(priceTrace?.rules) && priceTrace.rules.length
          ? priceTrace.rules.join('+')
          : '(no-price-trace)';
        increment(
          wrongPriceDiagnostics,
          `${model} | ${colorRule} | ${direction} | distance=${distance} | price_rule=${priceRule}`
        );
      } else row.field_mismatches += 1;
    } else if (pair.diffs.length > 1) {
      categories.multi_field_mismatch += 1;
      row.field_mismatches += 1;
      const signature = pair.diffs.slice().sort().join('+');
      increment(mismatchSignatures, signature);

      const legacyNorm = normFields(pair.legacy);
      const coreNorm = normFields(pair.core);
      const colorTrace = (pair.core.trace || []).find(trace => trace.field === 'color');
      const conditionTrace = (pair.core.trace || []).find(trace => trace.field === 'condition');
      const priceTrace = (pair.core.trace || []).find(trace => trace.field === 'price');
      const colorRule = Array.isArray(colorTrace?.rules) && colorTrace.rules.length
        ? colorTrace.rules.join('+')
        : '(no-color-trace)';
      const conditionRule = Array.isArray(conditionTrace?.rules) && conditionTrace.rules.length
        ? conditionTrace.rules.join('+')
        : '(no-condition-trace)';
      const priceRule = Array.isArray(priceTrace?.rules) && priceTrace.rules.length
        ? priceTrace.rules.join('+')
        : '(no-price-trace)';
      const conditionPair = `${legacyNorm.condition ?? '(null)'}->${coreNorm.condition ?? '(null)'}`;

      increment(
        multiMismatchDiagnostics,
        `${model} | ${signature} | condition=${conditionPair} | color_rule=${colorRule} | condition_rule=${conditionRule} | price_rule=${priceRule}`
      );
    } else {
      categories.exact_matches += 1;
      row.exact += 1;
    }
  }

  const coreModels = new Set(coreOffers.map(o => normFields(o).model));
  const legacyModels = new Set((legacy.offers || []).map(o => normFields(o).model));

  for (const offer of paired.unpairedLegacy) {
    const model = normFields(offer).model;
    if (coreModels.has(model)) categories.missing_offer_same_model += 1;
    else categories.missing_model += 1;
    touchModel(model).missing += 1;
  }

  for (const offer of paired.unpairedCore) {
    const model = normFields(offer).model;
    if (legacyModels.has(model)) categories.extra_offer_same_model += 1;
    else categories.extra_model += 1;
    touchModel(model).extra += 1;
  }

  const ambiguitiesByCause = {};
  const ambiguitiesByField = {};
  for (const amb of coreBundle.ambiguities || []) {
    increment(ambiguitiesByCause, amb.cause || 'unknown');
    increment(ambiguitiesByField, amb.field || '(structural)');
  }

  const topModelGaps = [...modelSummary.values()]
    .map(row => ({
      ...row,
      gap: Math.abs(row.legacy - row.core)
    }))
    .filter(row => row.gap || row.wrong_price_only || row.field_mismatches)
    .sort((a, b) =>
      (b.wrong_price_only - a.wrong_price_only) ||
      (b.gap - a.gap) ||
      (b.field_mismatches - a.field_mismatches) ||
      a.model.localeCompare(b.model)
    )
    .slice(0, 12);

  return {
    contract_version: 'divergence-analysis/v1',
    version: ANALYZER_VERSION,
    metrics: {
      legacy_offers: (legacy.offers || []).length,
      core_offers: coreOffers.length,
      unmatched_legacy_after_exact: base.remainingLegacy.length,
      unmatched_core_after_exact: base.remainingCore.length,
      core_ambiguities: (coreBundle.ambiguities || []).length
    },
    categories,
    mismatch_signatures: mismatchSignatures,
    condition_pairs: conditionPairs,
    condition_pair_provenance: conditionPairProvenance,
    condition_scope_diagnostics: conditionScopeDiagnostics,
    wrong_price_diagnostics: wrongPriceDiagnostics,
    multi_mismatch_diagnostics: multiMismatchDiagnostics,
    ambiguities_by_cause: ambiguitiesByCause,
    ambiguities_by_field: ambiguitiesByField,
    top_model_gaps: topModelGaps
  };
}

module.exports = {
  ANALYZER_VERSION,
  normFields,
  fullKey,
  removeExactMatches,
  fieldDiffs,
  pairWithinModel,
  analyzeDivergences
};
