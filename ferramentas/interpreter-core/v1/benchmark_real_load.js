'use strict';

const fs = require('fs');
const path = require('path');
const { interpretResolved, isFieldOnlySegment, uniqueFieldCandidates, normalizeKey, matchesRecordSuppressionRule } = require('./core');
const { adaptLegacyCalcV2 } = require('./legacy-calc-v2-adapter');
const { compareSemanticShadow, offerKey, coreOffers } = require('./semantic-shadow');
const { analyzeDivergences } = require('./divergence-analyzer');
const { normalizeProfiles, applySupplierProfiles } = require('./supplier-profile-adapter');

function die(message, code = 1) {
  console.error(`FALHOU: ${message}`);
  process.exit(code);
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (err) { die(`nao foi possivel ler ${file}: ${err.message}`); }
}

function readJson(file) {
  try { return JSON.parse(readText(file)); }
  catch (err) { die(`JSON invalido em ${file}: ${err.message}`); }
}

const rawPath = process.argv[2];
const legacyPath = process.argv[3];
const supplierProfilesPath = process.argv[4] || null;
if (!rawPath || !legacyPath) {
  die('uso: node benchmark_real_load.js <raw.txt> <legacy-bench.json> [supplier-profiles.json]');
}

const baseSchema = readJson(path.join(__dirname, 'domains', 'apple-iphone-v0.schema.json'));
const knowledge = readJson(path.join(__dirname, 'domains', 'apple-iphone-v0.knowledge.json'));
const supplierProfileDocument = supplierProfilesPath ? readJson(supplierProfilesPath) : { profiles: [] };
const supplierProfiles = normalizeProfiles(supplierProfileDocument);
const schema = applySupplierProfiles(baseSchema, supplierProfileDocument);
const raw = readText(rawPath);
const legacyBench = readJson(legacyPath);

if (!raw.trim()) die('documento bruto vazio');
if (legacyBench.guarda_conservacao?.ok !== true) {
  die('guarda de conservacao do leitor legado nao esta verde');
}

const legacy = adaptLegacyCalcV2(legacyBench, knowledge);

const supplierTermIndex = new Map();
for (const profile of supplierProfiles) {
  for (const term of profile.terms || []) {
    const key = normalizeKey(term);
    if (key && !supplierTermIndex.has(key)) supplierTermIndex.set(key, profile.id);
  }
}
let legacySupplierMapped = 0;
let legacySupplierUnmapped = 0;
const legacySupplierAware = {
  ...legacy,
  offers: (legacy.offers || []).map(offer => {
    const rawSupplier = offer?.metadata?.supplier;
    const supplierId = rawSupplier == null ? null : supplierTermIndex.get(normalizeKey(rawSupplier)) || null;
    if (rawSupplier != null) {
      if (supplierId) legacySupplierMapped += 1;
      else legacySupplierUnmapped += 1;
    }
    return {
      ...offer,
      fields: {
        ...(offer.fields || {}),
        supplier: supplierId
      }
    };
  })
};
if (legacy.offers.length === 0) {
  die('snapshot legado nao produziu nenhuma oferta suportada pelo dominio Apple V0');
}

const coreBundle = interpretResolved({
  document: {
    contract_version: 'raw-document/v1',
    document_id: 'real-load-shadow',
    content: raw,
    source: { kind: 'plain_text' }
  },
  schema,
  knowledge
});

const report = compareSemanticShadow({ legacy, coreBundle });
const reportNoColor = compareSemanticShadow({ legacy, coreBundle, options: { include_color: false } });

const conditionTimestampSchema = JSON.parse(JSON.stringify(schema));
conditionTimestampSchema.context_policy = conditionTimestampSchema.context_policy || {};
conditionTimestampSchema.context_policy.preserve_on_timestamp = Array.from(new Set(
  (conditionTimestampSchema.context_policy.preserve_on_timestamp || []).concat(['condition'])
));
const conditionTimestampBundle = interpretResolved({
  document: {
    contract_version: 'raw-document/v1',
    document_id: 'real-load-shadow-condition-timestamp-simulation',
    content: raw,
    source: { kind: 'plain_text' }
  },
  schema: conditionTimestampSchema,
  knowledge
});
const conditionTimestampReport = compareSemanticShadow({
  legacy: legacySupplierAware,
  coreBundle: conditionTimestampBundle,
  options: { include_supplier: true }
});

const capacityFromResolvedModelBundle = JSON.parse(JSON.stringify(coreBundle));
let capacityFromResolvedModelFilled = 0;
for (const record of capacityFromResolvedModelBundle.records || []) {
  if (record?.fields?.capacity_gb != null) continue;
  const modelId = record?.fields?.model?.id;
  const match = typeof modelId === 'string' ? /_(64|128|256|512)gb$/.exec(modelId) : null;
  if (!match) continue;
  record.fields.capacity_gb = Number(match[1]);
  record.trace = Array.isArray(record.trace) ? record.trace : [];
  record.trace.push({
    field: 'capacity_gb',
    chosen: Number(match[1]),
    sources: [],
    derived_from: [],
    rules: ['diagnostic:resolved_model_identity_capacity'],
    alternatives: [],
    score: 1
  });
  capacityFromResolvedModelFilled += 1;
}
const capacityFromResolvedModelReport = compareSemanticShadow({
  legacy: legacySupplierAware,
  coreBundle: capacityFromResolvedModelBundle,
  options: { include_supplier: true }
});

const adjacentColorBundle = JSON.parse(JSON.stringify(coreBundle));
let adjacentColorFilled = 0;
let adjacentColorRejectedModelConflict = 0;
let adjacentColorRejectedBoundary = 0;
const adjacentSegmentsByLine = new Map(
  (adjacentColorBundle.segments || []).map(segment => [Number(segment.line_number), segment])
);

for (const record of adjacentColorBundle.records || []) {
  if (record?.fields?.color != null) continue;
  const priceTrace = (record.trace || []).find(item => item.field === 'price');
  const priceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
    ? Number(priceTrace.sources[0])
    : null;
  if (!Number.isFinite(priceLine)) continue;

  const sourceSegment = adjacentSegmentsByLine.get(priceLine - 1);
  const targetSegment = adjacentSegmentsByLine.get(priceLine);
  if (!sourceSegment || !targetSegment) continue;

  const hardBoundary = [sourceSegment, targetSegment].some(segment =>
    (segment.context_events || []).some(event =>
      event.reason === 'timestamp_boundary' ||
      event.reason === 'domain_boundary' ||
      event.reason === 'supplier_boundary'
    )
  );
  if (hardBoundary) {
    adjacentColorRejectedBoundary += 1;
    continue;
  }

  const colors = (sourceSegment.field_candidates || []).filter(candidate => candidate.field === 'color');
  const uniqueColors = new Map();
  for (const candidate of colors) {
    const key = normalizeKey(candidate.value);
    if (!key) continue;
    const prior = uniqueColors.get(key);
    if (!prior || (candidate.score || 0) > (prior.score || 0)) uniqueColors.set(key, candidate);
  }
  if (uniqueColors.size !== 1) continue;
  if ((sourceSegment.field_candidates || []).some(candidate => candidate.field === 'price')) continue;

  const semanticModels = (sourceSegment.semantic_candidates || []).filter(candidate =>
    candidate.field === 'model' &&
    (candidate.state === 'interpreted' || candidate.state === 'inferred') &&
    candidate.entity_id
  );
  if (semanticModels.length > 0) {
    const recordModel = record?.fields?.model?.id || null;
    if (semanticModels.length !== 1 || semanticModels[0].entity_id !== recordModel) {
      adjacentColorRejectedModelConflict += 1;
      continue;
    }
  }

  const sourceSupplier =
    sourceSegment?.inherited_context?.supplier?.value ||
    (sourceSegment.field_candidates || []).find(candidate => candidate.field === 'supplier')?.value ||
    null;
  const recordSupplier = record?.fields?.supplier || null;
  if (sourceSupplier != null && recordSupplier != null &&
      normalizeKey(sourceSupplier) !== normalizeKey(recordSupplier)) {
    continue;
  }

  const candidate = [...uniqueColors.values()][0];
  const competingSegment = adjacentSegmentsByLine.get(priceLine - 2);
  if (competingSegment) {
    const competingPrices = (competingSegment.field_candidates || [])
      .filter(item => item.field === 'price');
    const competingColors = (competingSegment.field_candidates || [])
      .filter(item => item.field === 'color');
    if (competingPrices.length === 1 && competingColors.length === 0) continue;
  }

  const sourceIsFieldOnly = isFieldOnlySegment(sourceSegment, 'color');
  const topRole = sourceSegment.role_candidates?.[0]?.role || 'unknown';
  const normalizedSource = String(sourceSegment.normalized || '').trim();
  const capturedSource = String(candidate.evidence?.captured || candidate.value || '');
  const normalizedLower = normalizedSource.toLocaleLowerCase('pt-BR');
  const capturedLower = capturedSource.toLocaleLowerCase('pt-BR');
  const capturedIndex = capturedLower ? normalizedLower.indexOf(capturedLower) : -1;
  const leftoverSource = capturedIndex >= 0
    ? (normalizedSource.slice(0, capturedIndex) + ' ' + normalizedSource.slice(capturedIndex + capturedSource.length)).trim()
    : normalizedSource;
  const leftoverTokenCount = leftoverSource
    ? leftoverSource.split(/\s+/).filter(Boolean).length
    : 0;
  const sourceShapeAllowed =
    sourceIsFieldOnly ||
    (topRole === 'product_header' && leftoverTokenCount >= 2);
  if (!sourceShapeAllowed) continue;

  record.fields.color = candidate.value;
  record.trace = Array.isArray(record.trace) ? record.trace : [];
  record.trace.push({
    field: 'color',
    chosen: candidate.value,
    sources: [sourceSegment.line_number],
    derived_from: [sourceSegment.line_number],
    rules: ['diagnostic:adjacent_unique_color_before_price'],
    alternatives: [],
    score: candidate.score ?? null
  });
  adjacentColorFilled += 1;
}

const adjacentColorReport = compareSemanticShadow({
  legacy: legacySupplierAware,
  coreBundle: adjacentColorBundle,
  options: { include_supplier: true }
});

// Diagnostic simulation: remove only inherited condition values whose provenance
// crosses a domain boundary. Price/model/supplier/pairing remain untouched.
const conditionDomainGuardBundle = JSON.parse(JSON.stringify(coreBundle));
const conditionDomainSegments = conditionDomainGuardBundle.segments || [];
let conditionDomainGuardCleared = 0;
const conditionDomainGuardByModel = {};

const hasDomainBoundaryBetween = (fromLine, toLine) => {
  if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return false;
  const lo = Math.min(fromLine, toLine);
  const hi = Math.max(fromLine, toLine);
  return conditionDomainSegments.some(segment => {
    const line = Number(segment.line_number);
    if (!(line > lo && line <= hi)) return false;
    return (segment.context_events || []).some(event => event.reason === 'domain_boundary');
  });
};

for (const record of conditionDomainGuardBundle.records || []) {
  if (record?.fields?.condition == null) continue;
  const conditionTrace = (record.trace || []).find(item => item.field === 'condition');
  if (!conditionTrace || !(conditionTrace.rules || []).includes('context_inheritance')) continue;

  const conditionLine = Array.isArray(conditionTrace.sources) && conditionTrace.sources.length
    ? Number(conditionTrace.sources[0])
    : null;
  const priceTrace = (record.trace || []).find(item => item.field === 'price');
  const modelTrace = (record.trace || []).find(item => item.field === 'model');
  const targetLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
    ? Number(priceTrace.sources[0])
    : Array.isArray(modelTrace?.sources) && modelTrace.sources.length
      ? Number(modelTrace.sources[0])
      : null;

  if (!hasDomainBoundaryBetween(conditionLine, targetLine)) continue;

  const modelId = record.fields?.model?.id || '(unknown)';
  conditionDomainGuardByModel[modelId] = (conditionDomainGuardByModel[modelId] || 0) + 1;
  record.fields.condition = null;
  record.trace = (record.trace || []).filter(item => item.field !== 'condition');
  conditionDomainGuardCleared += 1;
}

const conditionDomainGuardReport = compareSemanticShadow({
  legacy: legacySupplierAware,
  coreBundle: conditionDomainGuardBundle,
  options: { include_supplier: true }
});

// Post-composition confidence-horizon simulations for inherited condition.
// These never alter segmentation, pairing, price, model, supplier, or color.
const conditionConfidenceHorizonPolicies = [
  { id: 'domain_d48_a4', max_distance: 48, max_model_anchors: 4 },
  { id: 'domain_d36_a4', max_distance: 36, max_model_anchors: 4 },
  { id: 'domain_d24_a3', max_distance: 24, max_model_anchors: 3 },
  { id: 'domain_d18_a2', max_distance: 18, max_model_anchors: 2 },
  { id: 'domain_d12_a1', max_distance: 12, max_model_anchors: 1 },
  { id: 'domain_d8_a1', max_distance: 8, max_model_anchors: 1 }
];

const conditionConfidenceHorizonSimulations = conditionConfidenceHorizonPolicies.map(policy => {
  const bundle = JSON.parse(JSON.stringify(coreBundle));
  const segments = bundle.segments || [];
  let cleared = 0;
  const clearedByModel = {};

  const pathShape = (fromLine, toLine) => {
    const out = { domain: false, model_anchors: 0 };
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return out;
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      if ((segment.field_candidates || []).some(candidate => candidate.field === 'model')) {
        out.model_anchors += 1;
      }
      if ((segment.context_events || []).some(event => event.reason === 'domain_boundary')) {
        out.domain = true;
      }
    }
    return out;
  };

  for (const record of bundle.records || []) {
    if (record?.fields?.condition == null) continue;
    const conditionTrace = (record.trace || []).find(item => item.field === 'condition');
    if (!conditionTrace || !(conditionTrace.rules || []).includes('context_inheritance')) continue;

    const conditionLine = Array.isArray(conditionTrace.sources) && conditionTrace.sources.length
      ? Number(conditionTrace.sources[0])
      : null;
    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    const modelTrace = (record.trace || []).find(item => item.field === 'model');
    const targetLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
      ? Number(priceTrace.sources[0])
      : Array.isArray(modelTrace?.sources) && modelTrace.sources.length
        ? Number(modelTrace.sources[0])
        : null;
    if (!Number.isFinite(conditionLine) || !Number.isFinite(targetLine)) continue;

    const distance = Math.abs(targetLine - conditionLine);
    const shape = pathShape(conditionLine, targetLine);

    // Conservative horizon: crossing a domain boundary is necessary, and both
    // distance and intervening model-anchor thresholds must be exceeded.
    const lowConfidence =
      shape.domain &&
      distance > policy.max_distance &&
      shape.model_anchors > policy.max_model_anchors;
    if (!lowConfidence) continue;

    const modelId = record.fields?.model?.id || '(unknown)';
    clearedByModel[modelId] = (clearedByModel[modelId] || 0) + 1;
    record.fields.condition = null;
    record.trace = (record.trace || []).filter(item => item.field !== 'condition');
    cleared += 1;
  }

  const report = compareSemanticShadow({
    legacy: legacySupplierAware,
    coreBundle: bundle,
    options: { include_supplier: true }
  });

  return { policy, bundle, report, cleared, cleared_by_model: clearedByModel };
});

const longHeaderFallbackPriceBundle = JSON.parse(JSON.stringify(coreBundle));
const longHeaderSegments = new Map(
  (longHeaderFallbackPriceBundle.segments || []).map(segment => [Number(segment.line_number), segment])
);
let longHeaderFallbackPriceDropped = 0;
longHeaderFallbackPriceBundle.records = (longHeaderFallbackPriceBundle.records || []).filter(record => {
  const priceTrace = (record.trace || []).find(item => item.field === 'price');
  const priceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
    ? Number(priceTrace.sources[0])
    : null;
  if (!Number.isFinite(priceLine)) return true;

  const segment = longHeaderSegments.get(priceLine);
  if (!segment) return true;
  const role = segment?.role_candidates?.[0]?.role || 'unknown';
  if (role !== 'product_header') return true;

  const normalized = String(segment.normalized || '');
  if (/R\$|\$/.test(normalized)) return true;

  const candidates = segment.field_candidates || [];
  if (candidates.some(candidate => candidate.field === 'model')) return true;
  if (candidates.some(candidate => candidate.field === 'color')) return true;

  const tokens = normalized.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 6) return true;

  const priceCandidates = candidates.filter(candidate => candidate.field === 'price');
  if (priceCandidates.length !== 1) return true;
  const candidate = priceCandidates[0];
  const pattern = String(candidate.evidence?.pattern || '');
  const candidateScore = Number(candidate.score);
  if (!(pattern.includes('💰') || pattern.includes('💵'))) return true;
  if (!Number.isFinite(candidateScore) || Math.abs(candidateScore - 0.995) > 0.0001) return true;

  longHeaderFallbackPriceDropped += 1;
  return false;
});

const longHeaderFallbackPriceReport = compareSemanticShadow({
  legacy: legacySupplierAware,
  coreBundle: longHeaderFallbackPriceBundle,
  options: { include_supplier: true }
});

const inheritedModelDistance2Bundle = JSON.parse(JSON.stringify(coreBundle));
const inheritedModelDistance2Segments = new Map(
  (inheritedModelDistance2Bundle.segments || []).map(segment => [Number(segment.line_number), segment])
);
let inheritedModelDistance2Dropped = 0;
inheritedModelDistance2Bundle.records = (inheritedModelDistance2Bundle.records || []).filter(record => {
  const priceTrace = (record.trace || []).find(item => item.field === 'price');
  const modelTrace = (record.trace || []).find(item => item.field === 'model');
  const priceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
    ? Number(priceTrace.sources[0])
    : null;
  const modelLine = Array.isArray(modelTrace?.sources) && modelTrace.sources.length
    ? Number(modelTrace.sources[0])
    : null;
  if (!Number.isFinite(priceLine) || !Number.isFinite(modelLine)) return true;
  if (priceLine - modelLine !== 2) return true;

  const segment = inheritedModelDistance2Segments.get(priceLine);
  if (!segment) return true;
  if ((segment.role_candidates?.[0]?.role || 'unknown') !== 'price_line') return true;

  const normalized = String(segment.normalized || '');
  if (!(/R\$|\$/.test(normalized))) return true;
  const candidates = segment.field_candidates || [];
  if (candidates.some(candidate => candidate.field === 'model')) return true;
  if (candidates.some(candidate => candidate.field === 'color')) return true;
  const priceCandidates = candidates.filter(candidate => candidate.field === 'price');
  if (priceCandidates.length !== 1) return true;

  const tokenCount = normalized.trim()
    ? normalized.trim().split(/\s+/).filter(Boolean).length
    : 0;
  if (tokenCount < 3 || tokenCount > 5) return true;

  inheritedModelDistance2Dropped += 1;
  return false;
});

const inheritedModelDistance2Report = compareSemanticShadow({
  legacy: legacySupplierAware,
  coreBundle: inheritedModelDistance2Bundle,
  options: { include_supplier: true }
});
const reportSupplierAware = supplierProfiles.length
  ? compareSemanticShadow({
      legacy: legacySupplierAware,
      coreBundle,
      options: { include_supplier: true }
    })
  : null;
const divergence = analyzeDivergences({ legacy, coreBundle });

function supplierAwareResidualDiagnostics(reportSupplierAware) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extra = expand(reportSupplierAware.extra);
  const usedExtra = new Set();
  const signatures = {};
  const byModel = {};

  const norm = offer => {
    const fields = offer?.fields || {};
    return {
      model: fields.model?.id || null,
      supplier: fields.supplier || null,
      capacity: fields.capacity_gb == null ? null : Number(fields.capacity_gb),
      condition: normalizeKey(fields.condition) || null,
      color: normalizeKey(fields.color) || null,
      price: fields.price == null ? null : Number(fields.price)
    };
  };

  const diffFields = (left, right) => {
    const a = norm(left);
    const b = norm(right);
    return ['supplier', 'capacity', 'condition', 'color', 'price']
      .filter(field => a[field] !== b[field]);
  };

  let paired = 0;
  let unpairedMissing = 0;
  const fieldDirections = {
    supplier: {},
    capacity: {},
    condition: {},
    color: {},
    price: {}
  };
  const addDirection = (field, left, right) => {
    const classify = value => value == null || value === '' ? 'null' : 'value';
    const direction =
      classify(left) === 'null' && classify(right) === 'value' ? 'legacy_null_core_value' :
      classify(left) === 'value' && classify(right) === 'null' ? 'legacy_value_core_null' :
      classify(left) === 'value' && classify(right) === 'value' ? 'both_values_different' :
      'both_null';
    fieldDirections[field][direction] = (fieldDirections[field][direction] || 0) + 1;
  };

  for (const miss of missing) {
    const model = norm(miss).model;
    let best = null;
    for (let index = 0; index < extra.length; index += 1) {
      if (usedExtra.has(index)) continue;
      if (norm(extra[index]).model !== model) continue;
      const diffs = diffFields(miss, extra[index]);
      const score = diffs.length;
      if (!best || score < best.score || (score === best.score && index < best.index)) {
        best = { index, diffs, score };
      }
    }

    if (!best) {
      unpairedMissing += 1;
      continue;
    }

    usedExtra.add(best.index);
    paired += 1;
    const core = extra[best.index];
    const a = norm(miss);
    const b = norm(core);
    for (const field of best.diffs) addDirection(field, a[field], b[field]);

    const signature = best.diffs.length ? best.diffs.slice().sort().join('+') : 'exact_residual';
    signatures[signature] = (signatures[signature] || 0) + 1;
    if (!byModel[model]) byModel[model] = {};
    byModel[model][signature] = (byModel[model][signature] || 0) + 1;
  }

  return {
    paired_residuals: paired,
    unpaired_missing: unpairedMissing,
    unpaired_extra: extra.length - usedExtra.size,
    field_directionality: fieldDirections,
    mismatch_signatures: Object.entries(signatures)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {}),
    by_model: byModel
  };
}

const supplierAwareResidualDiagnostic = supplierAwareResidualDiagnostics(reportSupplierAware);

function pureModelResidualTopologyDiagnostics(reportSupplierAware) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extra = expand(reportSupplierAware.extra);
  const usedExtra = new Set();

  const norm = offer => {
    const fields = offer?.fields || {};
    return {
      model: fields.model?.id || null,
      supplier: fields.supplier || null,
      capacity: fields.capacity_gb == null ? null : Number(fields.capacity_gb),
      condition: normalizeKey(fields.condition) || null,
      color: normalizeKey(fields.color) || null,
      price: fields.price == null ? null : Number(fields.price)
    };
  };

  const sameExceptModel = (a, b) =>
    a.model !== b.model &&
    a.supplier === b.supplier &&
    a.capacity === b.capacity &&
    a.condition === b.condition &&
    a.color === b.color &&
    a.price === b.price;

  const pairs = {};
  let cases = 0;
  for (const miss of missing) {
    const a = norm(miss);
    let chosen = -1;
    for (let index = 0; index < extra.length; index += 1) {
      if (usedExtra.has(index)) continue;
      const b = norm(extra[index]);
      if (!sameExceptModel(a, b)) continue;
      chosen = index;
      break;
    }
    if (chosen < 0) continue;
    usedExtra.add(chosen);
    cases += 1;
    const b = norm(extra[chosen]);
    const key = String(a.model) + ' -> ' + String(b.model);
    pairs[key] = (pairs[key] || 0) + 1;
  }

  return {
    cases,
    model_pairs: Object.entries(pairs)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
  };
}

const pureModelResidualTopologyDiagnostic =
  pureModelResidualTopologyDiagnostics(reportSupplierAware);

function pureModelResidualEvidenceDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extras = expand(reportSupplierAware.extra);
  const usedExtra = new Set();

  const norm = offer => {
    const fields = offer?.fields || {};
    return {
      model: fields.model?.id || null,
      supplier: fields.supplier || null,
      capacity: fields.capacity_gb == null ? null : Number(fields.capacity_gb),
      condition: normalizeKey(fields.condition) || null,
      color: normalizeKey(fields.color) || null,
      price: fields.price == null ? null : Number(fields.price)
    };
  };
  const sameExceptModel = (a, b) =>
    a.model !== b.model &&
    a.supplier === b.supplier &&
    a.capacity === b.capacity &&
    a.condition === b.condition &&
    a.color === b.color &&
    a.price === b.price;

  const coreBuckets = new Map();
  for (const record of coreOffers(bundle)) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreBuckets.has(key)) coreBuckets.set(key, []);
    coreBuckets.get(key).push(record);
  }
  const consumed = new Map();
  const segmentByLine = new Map(
    (bundle.segments || []).map(segment => [Number(segment.line_number), segment])
  );

  const signatures = {};
  let cases = 0;
  let explicitProMax = 0;
  let explicitPro = 0;
  let inferredModelTrace = 0;

  for (const miss of missing) {
    const expected = norm(miss);
    let chosen = -1;
    for (let index = 0; index < extras.length; index += 1) {
      if (usedExtra.has(index)) continue;
      const actual = norm(extras[index]);
      if (!sameExceptModel(expected, actual)) continue;
      chosen = index;
      break;
    }
    if (chosen < 0) continue;
    usedExtra.add(chosen);
    cases += 1;

    const extra = extras[chosen];
    const extraKey = offerKey(extra.fields || {}, { include_supplier: true });
    const bucket = coreBuckets.get(extraKey) || [];
    const offset = consumed.get(extraKey) || 0;
    const record = bucket[offset] || null;
    consumed.set(extraKey, offset + 1);
    if (!record) continue;

    const modelTrace = (record.trace || []).find(item => item.field === 'model');
    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    const modelLine = Array.isArray(modelTrace?.sources) && modelTrace.sources.length
      ? Number(modelTrace.sources[0])
      : null;
    const priceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
      ? Number(priceTrace.sources[0])
      : null;
    const segment = Number.isFinite(modelLine) ? segmentByLine.get(modelLine) : null;
    const normalized = String(segment?.normalized || '');
    const proMax = /\bpro\s*max\b/i.test(normalized);
    const pro = /\bpro\b/i.test(normalized);
    const iphone = /\biphone\b/i.test(normalized);
    const generation16 = /\b16\b/i.test(normalized);
    const capacity256 = /\b256(?:\s*gb)?\b/i.test(normalized);
    const directModelCount = (segment?.field_candidates || [])
      .filter(candidate => candidate.field === 'model').length;
    const semanticIds = [...new Set(
      (segment?.semantic_candidates || [])
        .filter(candidate => candidate.field === 'model' && candidate.entity_id)
        .map(candidate => candidate.entity_id)
    )].sort();

    if (proMax) explicitProMax += 1;
    if (pro) explicitPro += 1;
    if ((modelTrace?.rules || []).some(rule => String(rule).includes('alias') || String(rule).includes('inferred'))) {
      inferredModelTrace += 1;
    }

    const signature = [
      'expected=' + expected.model,
      'core=' + norm(extra).model,
      'role=' + (segment?.role_candidates?.[0]?.role || 'unknown'),
      'explicit_pro_max=' + (proMax ? 'yes' : 'no'),
      'explicit_pro=' + (pro ? 'yes' : 'no'),
      'explicit_iphone=' + (iphone ? 'yes' : 'no'),
      'generation16=' + (generation16 ? 'yes' : 'no'),
      'capacity256=' + (capacity256 ? 'yes' : 'no'),
      'direct_model_candidates=' + directModelCount,
      'semantic_ids=' + (semanticIds.join(',') || 'none'),
      'model_rule=' + ((modelTrace?.rules || []).join('+') || 'none'),
      'model_to_price_distance=' + (
        Number.isFinite(modelLine) && Number.isFinite(priceLine)
          ? Math.abs(priceLine - modelLine)
          : 'unknown'
      )
    ].join('|');
    signatures[signature] = (signatures[signature] || 0) + 1;
  }

  return {
    cases,
    explicit_pro_max: explicitProMax,
    explicit_pro: explicitPro,
    inferred_model_trace: inferredModelTrace,
    signatures
  };
}

const pureModelResidualEvidenceDiagnostic =
  pureModelResidualEvidenceDiagnostics(reportSupplierAware, coreBundle);

function missingPriceSourceTopologyDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const targetModels = new Set(['iphone_16_256gb', 'iphone_17_512gb']);
  const missing = (reportSupplierAware.missing || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  ).filter(item => targetModels.has(item.fields?.model?.id || null));

  const segments = bundle.segments || [];
  const records = coreOffers(bundle);
  const ambiguities = bundle.ambiguities || [];
  const signatures = {};
  const byModel = {};
  let cases = 0;

  const supplierAtSegment = segment => {
    const direct = (segment.field_candidates || [])
      .filter(candidate => candidate.field === 'supplier');
    const directValues = [...new Set(direct.map(candidate => String(candidate.value)))];
    if (directValues.length === 1) return directValues[0];
    const inherited = segment.inherited_context?.supplier?.value;
    return inherited == null ? null : String(inherited);
  };

  const priceValuesAtSegment = segment => [...new Set(
    (segment.field_candidates || [])
      .filter(candidate => candidate.field === 'price')
      .map(candidate => Number(candidate.value))
      .filter(Number.isFinite)
  )];

  for (const item of missing) {
    const expectedModel = item.fields?.model?.id || null;
    const expectedSupplier = item.fields?.supplier == null ? null : String(item.fields.supplier);
    const expectedPrice = Number(item.fields?.price);
    if (!expectedModel || !Number.isFinite(expectedPrice)) continue;
    cases += 1;

    const candidateSegments = segments.filter(segment => {
      const prices = priceValuesAtSegment(segment);
      if (!prices.includes(expectedPrice)) return false;
      const supplier = supplierAtSegment(segment);
      return supplier === expectedSupplier;
    });

    const emitted = records.filter(record =>
      Number(record.fields?.price) === expectedPrice &&
      String(record.fields?.supplier ?? '') === String(expectedSupplier ?? '')
    );

    const segmentStates = candidateSegments.map(segment => {
      const line = Number(segment.line_number);
      const emittedFromLine = emitted.filter(record =>
        (record.trace || []).some(trace =>
          trace.field === 'price' &&
          Array.isArray(trace.sources) &&
          trace.sources.map(Number).includes(line)
        )
      );
      const ambiguityCauses = [...new Set(
        ambiguities
          .filter(item => Array.isArray(item.sources) && item.sources.map(Number).includes(line))
          .map(item => item.cause)
      )].sort();

      const directSemanticModels = [...new Set(
        (segment.semantic_candidates || [])
          .filter(candidate => candidate.field === 'model' && candidate.entity_id)
          .map(candidate => candidate.entity_id)
      )].sort();

      const emittedModels = [...new Set(
        emittedFromLine.map(record => record.fields?.model?.id || '(unknown)')
      )].sort();

      return [
        'role=' + (segment.role_candidates?.[0]?.role || 'unknown'),
        'direct_model_candidates=' + (segment.field_candidates || []).filter(candidate => candidate.field === 'model').length,
        'semantic_models=' + (directSemanticModels.join(',') || 'none'),
        'inherited_model=' + (segment.inherited_context?.model ? 'yes' : 'no'),
        'emitted=' + emittedFromLine.length,
        'emitted_models=' + (emittedModels.join(',') || 'none'),
        'ambiguities=' + (ambiguityCauses.join(',') || 'none')
      ].join('|');
    });

    const signature = [
      'expected=' + expectedModel,
      'price_source_segments=' + candidateSegments.length,
      'same_supplier_price_records=' + emitted.length,
      'states=' + (segmentStates.join(' || ') || 'none')
    ].join('|');

    signatures[signature] = (signatures[signature] || 0) + 1;
    if (!byModel[expectedModel]) {
      byModel[expectedModel] = {
        cases: 0,
        with_price_source: 0,
        with_same_supplier_price_record: 0,
        without_price_source: 0
      };
    }
    byModel[expectedModel].cases += 1;
    if (candidateSegments.length) byModel[expectedModel].with_price_source += 1;
    else byModel[expectedModel].without_price_source += 1;
    if (emitted.length) byModel[expectedModel].with_same_supplier_price_record += 1;
  }

  return {
    cases,
    by_model: byModel,
    signatures
  };
}

const missingPriceSourceTopologyDiagnostic =
  missingPriceSourceTopologyDiagnostics(reportSupplierAware, coreBundle);

function missingOnlyModelAnchorEvidenceDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const missing = (reportSupplierAware.missing || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  ).filter(item => item.fields?.model?.id === 'iphone_16_256gb');

  const records = coreOffers(bundle);
  const segmentByLine = new Map(
    (bundle.segments || []).map(segment => [Number(segment.line_number), segment])
  );
  const signatures = {};
  let cases = 0;
  let allCandidateRecordsExplicitProMax = 0;
  let candidateRecords = 0;

  for (const item of missing) {
    const supplier = String(item.fields?.supplier ?? '');
    const price = Number(item.fields?.price);
    if (!Number.isFinite(price)) continue;
    cases += 1;

    const sameSupplierPriceRecords = records.filter(record =>
      String(record.fields?.supplier ?? '') === supplier &&
      Number(record.fields?.price) === price
    );

    const local = [];
    for (const record of sameSupplierPriceRecords) {
      candidateRecords += 1;
      const modelTrace = (record.trace || []).find(trace => trace.field === 'model');
      const modelLine = Array.isArray(modelTrace?.sources) && modelTrace.sources.length
        ? Number(modelTrace.sources[0])
        : null;
      const segment = Number.isFinite(modelLine) ? segmentByLine.get(modelLine) : null;
      const normalized = String(segment?.normalized || '');
      const semanticModels = [...new Set(
        (segment?.semantic_candidates || [])
          .filter(candidate => candidate.field === 'model' && candidate.entity_id)
          .map(candidate => candidate.entity_id)
      )].sort();
      const explicitProMax = /\bpro\s*max\b/i.test(normalized);
      if (explicitProMax) allCandidateRecordsExplicitProMax += 1;

      local.push([
        'emitted_model=' + (record.fields?.model?.id || 'unknown'),
        'explicit_pro_max=' + (explicitProMax ? 'yes' : 'no'),
        'direct_model_candidates=' + (segment?.field_candidates || []).filter(candidate => candidate.field === 'model').length,
        'semantic_models=' + (semanticModels.join(',') || 'none'),
        'model_rule=' + ((modelTrace?.rules || []).join('+') || 'none')
      ].join('|'));
    }

    const signature = [
      'expected=iphone_16_256gb',
      'same_supplier_price_records=' + sameSupplierPriceRecords.length,
      'records=' + (local.join(' || ') || 'none')
    ].join('|');
    signatures[signature] = (signatures[signature] || 0) + 1;
  }

  return {
    cases,
    candidate_records: candidateRecords,
    candidate_records_explicit_pro_max: allCandidateRecordsExplicitProMax,
    all_candidate_records_explicit_pro_max:
      candidateRecords > 0 && candidateRecords === allCandidateRecordsExplicitProMax,
    signatures
  };
}

const missingOnlyModelAnchorEvidenceDiagnostic =
  missingOnlyModelAnchorEvidenceDiagnostics(reportSupplierAware, coreBundle);

function missing17_512CompositionDiagnostics(reportSupplierAware, bundle, schemaInput) {
  if (!reportSupplierAware) return null;

  const missing = (reportSupplierAware.missing || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  ).filter(item => item.fields?.model?.id === 'iphone_17_512gb');

  const priceField = (schemaInput.fields || []).find(field => field.name === 'price') || {};
  const suppressionRules = Array.isArray(priceField.suppress_record_when)
    ? priceField.suppress_record_when
    : priceField.suppress_record_when ? [priceField.suppress_record_when] : [];
  const segments = bundle.segments || [];
  const segmentByLine = new Map(segments.map(segment => [Number(segment.line_number), segment]));
  const records = coreOffers(bundle);
  const ambiguities = bundle.ambiguities || [];

  const signatures = {};
  let cases = 0;
  let matchingPriceSegments = 0;
  let suppressedPriceSegments = 0;
  let inheritedModel17_512 = 0;
  let otherInheritedModel = 0;

  const supplierAt = segment => {
    const direct = [...new Set(
      (segment.field_candidates || [])
        .filter(candidate => candidate.field === 'supplier')
        .map(candidate => String(candidate.value))
    )];
    if (direct.length === 1) return direct[0];
    return segment.inherited_context?.supplier?.value == null
      ? null
      : String(segment.inherited_context.supplier.value);
  };

  for (const item of missing) {
    const supplier = String(item.fields?.supplier ?? '');
    const price = Number(item.fields?.price);
    if (!Number.isFinite(price)) continue;
    cases += 1;

    const priceSegments = segments.filter(segment =>
      supplierAt(segment) === supplier &&
      (segment.field_candidates || []).some(candidate =>
        candidate.field === 'price' && Number(candidate.value) === price
      )
    );

    const states = [];
    for (const segment of priceSegments) {
      matchingPriceSegments += 1;
      const priceCandidate = (segment.field_candidates || []).find(candidate =>
        candidate.field === 'price' && Number(candidate.value) === price
      );
      const matchedRules = suppressionRules
        .map((rule, index) => matchesRecordSuppressionRule(segment, priceCandidate, rule) ? index : -1)
        .filter(index => index >= 0);
      if (matchedRules.length) suppressedPriceSegments += 1;

      const inheritedRaw = segment.inherited_context?.model || null;
      const inheritedSourceLine = Number(inheritedRaw?.source_line);
      const inheritedSourceSegment = Number.isFinite(inheritedSourceLine)
        ? segmentByLine.get(inheritedSourceLine)
        : null;
      const semanticModels = [...new Set(
        (inheritedSourceSegment?.semantic_candidates || [])
          .filter(candidate => candidate.field === 'model' && candidate.entity_id)
          .map(candidate => candidate.entity_id)
      )].sort();

      if (semanticModels.includes('iphone_17_512gb')) inheritedModel17_512 += 1;
      else otherInheritedModel += 1;

      const line = Number(segment.line_number);
      const emittedFromLine = records.filter(record =>
        (record.trace || []).some(trace =>
          trace.field === 'price' &&
          Array.isArray(trace.sources) &&
          trace.sources.map(Number).includes(line)
        )
      );
      const lineAmbiguities = [...new Set(
        ambiguities
          .filter(ambiguity =>
            Array.isArray(ambiguity.sources) &&
            ambiguity.sources.map(Number).includes(line)
          )
          .map(ambiguity => ambiguity.cause)
      )].sort();

      states.push([
        'role=' + (segment.role_candidates?.[0]?.role || 'unknown'),
        'matched_suppression_rules=' + (matchedRules.join(',') || 'none'),
        'inherited_model_source_distance=' + (
          Number.isFinite(inheritedSourceLine)
            ? Math.abs(line - inheritedSourceLine)
            : 'unknown'
        ),
        'inherited_semantic_models=' + (semanticModels.join(',') || 'none'),
        'emitted_records=' + emittedFromLine.length,
        'emitted_models=' + ([...new Set(emittedFromLine.map(record => record.fields?.model?.id || 'unknown'))].sort().join(',') || 'none'),
        'ambiguities=' + (lineAmbiguities.join(',') || 'none')
      ].join('|'));
    }

    const signature = [
      'price_segments=' + priceSegments.length,
      'states=' + (states.join(' || ') || 'none')
    ].join('|');
    signatures[signature] = (signatures[signature] || 0) + 1;
  }

  return {
    cases,
    matching_price_segments: matchingPriceSegments,
    suppressed_price_segments: suppressedPriceSegments,
    inherited_model_17_512: inheritedModel17_512,
    other_inherited_model: otherInheritedModel,
    signatures
  };
}

const missing17_512CompositionDiagnostic =
  missing17_512CompositionDiagnostics(reportSupplierAware, coreBundle, schema);

function missing17_512AnchorTopologyDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const missing = (reportSupplierAware.missing || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  ).filter(item => item.fields?.model?.id === 'iphone_17_512gb');

  const segments = bundle.segments || [];
  const signatures = {};
  let cases = 0;

  const supplierAt = segment => {
    const direct = [...new Set(
      (segment.field_candidates || [])
        .filter(candidate => candidate.field === 'supplier')
        .map(candidate => String(candidate.value))
    )];
    if (direct.length === 1) return direct[0];
    return segment.inherited_context?.supplier?.value == null
      ? null
      : String(segment.inherited_context.supplier.value);
  };

  const semanticModels = segment => [...new Set(
    (segment?.semantic_candidates || [])
      .filter(candidate => candidate.field === 'model' && candidate.entity_id)
      .map(candidate => candidate.entity_id)
  )].sort();

  for (const item of missing) {
    const supplier = String(item.fields?.supplier ?? '');
    const price = Number(item.fields?.price);
    if (!Number.isFinite(price)) continue;

    const priceSegments = segments.filter(segment =>
      supplierAt(segment) === supplier &&
      (segment.field_candidates || []).some(candidate =>
        candidate.field === 'price' && Number(candidate.value) === price
      )
    );

    for (const priceSegment of priceSegments) {
      cases += 1;
      const priceLine = Number(priceSegment.line_number);
      const priorAnchors = segments
        .filter(segment =>
          Number(segment.line_number) < priceLine &&
          (segment.field_candidates || []).some(candidate => candidate.field === 'model')
        )
        .sort((a, b) => Number(b.line_number) - Number(a.line_number))
        .slice(0, 4)
        .map(segment => {
          const line = Number(segment.line_number);
          const ids = semanticModels(segment);
          const boundaryReasons = [...new Set(
            (segment.context_events || [])
              .map(event => event.reason)
              .filter(Boolean)
          )].sort();
          return [
            'd=' + (priceLine - line),
            'models=' + (ids.join(',') || 'none'),
            'supplier=' + (supplierAt(segment) || 'none'),
            'boundaries=' + (boundaryReasons.join('+') || 'none')
          ].join('|');
        });

      const inherited = priceSegment.inherited_context?.model || null;
      const inheritedLine = Number(inherited?.source_line);
      const inheritedSegment = Number.isFinite(inheritedLine)
        ? segments.find(segment => Number(segment.line_number) === inheritedLine)
        : null;
      const inheritedIds = semanticModels(inheritedSegment);

      const betweenBoundaries = segments
        .filter(segment =>
          Number(segment.line_number) > Math.min(...[
            priceLine,
            ...priorAnchors.map(() => priceLine)
          ]) &&
          Number(segment.line_number) <= priceLine
        );

      const signature = [
        'price_role=' + (priceSegment.role_candidates?.[0]?.role || 'unknown'),
        'inherited_source_distance=' + (
          Number.isFinite(inheritedLine) ? Math.abs(priceLine - inheritedLine) : 'unknown'
        ),
        'inherited_models=' + (inheritedIds.join(',') || 'none'),
        'prior_anchors=' + (priorAnchors.join(' || ') || 'none')
      ].join('|');
      signatures[signature] = (signatures[signature] || 0) + 1;
    }
  }

  return {
    cases,
    signatures
  };
}

const missing17_512AnchorTopologyDiagnostic =
  missing17_512AnchorTopologyDiagnostics(reportSupplierAware, coreBundle);

function missing17_512AnchorShapeDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const missing = (reportSupplierAware.missing || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  ).filter(item => item.fields?.model?.id === 'iphone_17_512gb');

  const segments = bundle.segments || [];
  const signatures = {};
  let cases = 0;
  let anchorsInspected = 0;
  let anchorsResolvingExpected = 0;
  let anchorsResolvingOtherSupported = 0;
  let anchorsUnresolved = 0;

  const supplierAt = segment => {
    const direct = [...new Set(
      (segment.field_candidates || [])
        .filter(candidate => candidate.field === 'supplier')
        .map(candidate => String(candidate.value))
    )];
    if (direct.length === 1) return direct[0];
    return segment.inherited_context?.supplier?.value == null
      ? null
      : String(segment.inherited_context.supplier.value);
  };

  for (const item of missing) {
    const supplier = String(item.fields?.supplier ?? '');
    const price = Number(item.fields?.price);
    if (!Number.isFinite(price)) continue;

    const priceSegments = segments.filter(segment =>
      supplierAt(segment) === supplier &&
      (segment.field_candidates || []).some(candidate =>
        candidate.field === 'price' && Number(candidate.value) === price
      )
    );

    for (const priceSegment of priceSegments) {
      cases += 1;
      const priceLine = Number(priceSegment.line_number);
      const anchors = segments
        .filter(segment =>
          Number(segment.line_number) < priceLine &&
          (segment.field_candidates || []).some(candidate => candidate.field === 'model')
        )
        .sort((a, b) => Number(b.line_number) - Number(a.line_number))
        .slice(0, 4);

      const anchorStates = [];
      for (const segment of anchors) {
        anchorsInspected += 1;
        const directModels = (segment.field_candidates || [])
          .filter(candidate => candidate.field === 'model');
        const semantic = (segment.semantic_candidates || [])
          .filter(candidate => candidate.field === 'model');

        const semanticIds = [...new Set(
          semantic.filter(candidate => candidate.entity_id).map(candidate => candidate.entity_id)
        )].sort();
        if (semanticIds.includes('iphone_17_512gb')) anchorsResolvingExpected += 1;
        else if (semanticIds.length) anchorsResolvingOtherSupported += 1;
        else anchorsUnresolved += 1;

        const candidateShapes = [...new Set(
          directModels.map(candidate => iphoneModelShape(candidate.value) || 'unclassified')
        )].sort();
        const semanticStates = [...new Set(
          semantic.map(candidate => candidate.state || 'unknown')
        )].sort();

        anchorStates.push([
          'd=' + (priceLine - Number(segment.line_number)),
          'candidate_shapes=' + (candidateShapes.join(',') || 'none'),
          'semantic_states=' + (semanticStates.join(',') || 'none'),
          'semantic_ids=' + (semanticIds.join(',') || 'none')
        ].join('|'));
      }

      const signature = anchorStates.join(' || ') || 'none';
      signatures[signature] = (signatures[signature] || 0) + 1;
    }
  }

  return {
    cases,
    anchors_inspected: anchorsInspected,
    anchors_resolving_expected_17_512: anchorsResolvingExpected,
    anchors_resolving_other_supported: anchorsResolvingOtherSupported,
    anchors_unresolved: anchorsUnresolved,
    signatures
  };
}

const missing17_512AnchorShapeDiagnostic =
  missing17_512AnchorShapeDiagnostics(reportSupplierAware, coreBundle);

function sourceContradictedLegacyMissingDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const missing = (reportSupplierAware.missing || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const segments = bundle.segments || [];
  const records = coreOffers(bundle);
  const segmentByLine = new Map(
    segments.map(segment => [Number(segment.line_number), segment])
  );

  const supplierAt = segment => {
    const direct = [...new Set(
      (segment.field_candidates || [])
        .filter(candidate => candidate.field === 'supplier')
        .map(candidate => String(candidate.value))
    )];
    if (direct.length === 1) return direct[0];
    return segment.inherited_context?.supplier?.value == null
      ? null
      : String(segment.inherited_context.supplier.value);
  };

  let contradicted = 0;
  const byReason = {};
  const byModel = {};

  const mark = (model, reason) => {
    contradicted += 1;
    byReason[reason] = (byReason[reason] || 0) + 1;
    byModel[model] = (byModel[model] || 0) + 1;
  };

  for (const item of missing) {
    const model = item.fields?.model?.id || null;
    const supplier = String(item.fields?.supplier ?? '');
    const price = Number(item.fields?.price);
    if (!model || !Number.isFinite(price)) continue;

    if (model === 'iphone_16_256gb') {
      const sameSupplierPriceRecords = records.filter(record =>
        String(record.fields?.supplier ?? '') === supplier &&
        Number(record.fields?.price) === price
      );
      if (!sameSupplierPriceRecords.length) continue;

      const allExplicitProMax = sameSupplierPriceRecords.every(record => {
        const modelTrace = (record.trace || []).find(trace => trace.field === 'model');
        const modelLine = Array.isArray(modelTrace?.sources) && modelTrace.sources.length
          ? Number(modelTrace.sources[0])
          : null;
        const segment = Number.isFinite(modelLine) ? segmentByLine.get(modelLine) : null;
        return /\bpro\s*max\b/i.test(String(segment?.normalized || ''));
      });
      if (allExplicitProMax) {
        mark(model, 'expected_base_but_source_explicit_pro_max');
      }
      continue;
    }

    if (model === 'iphone_17_512gb') {
      const priceSegments = segments.filter(segment =>
        supplierAt(segment) === supplier &&
        (segment.field_candidates || []).some(candidate =>
          candidate.field === 'price' && Number(candidate.value) === price
        )
      );
      if (!priceSegments.length) continue;

      const everyPriceContradicted = priceSegments.every(priceSegment => {
        const priceLine = Number(priceSegment.line_number);
        const nearestAnchor = segments
          .filter(segment =>
            Number(segment.line_number) < priceLine &&
            (segment.field_candidates || []).some(candidate => candidate.field === 'model')
          )
          .sort((a, b) => Number(b.line_number) - Number(a.line_number))[0] || null;
        if (!nearestAnchor) return false;

        const shapes = [...new Set(
          (nearestAnchor.field_candidates || [])
            .filter(candidate => candidate.field === 'model')
            .map(candidate => iphoneModelShape(candidate.value))
            .filter(Boolean)
        )];
        const semanticIds = [...new Set(
          (nearestAnchor.semantic_candidates || [])
            .filter(candidate => candidate.field === 'model' && candidate.entity_id)
            .map(candidate => candidate.entity_id)
        )];

        return shapes.length > 0 &&
          shapes.every(shape => /^17\|(?:pro|pro max)\|(?:256|512)$/.test(shape)) &&
          !semanticIds.includes('iphone_17_512gb');
      });

      if (everyPriceContradicted) {
        mark(model, 'expected_base_after_explicit_unsupported_pro_anchor');
      }
    }
  }

  return {
    raw_missing: missing.length,
    source_contradicted_legacy_missing: contradicted,
    actionable_missing: missing.length - contradicted,
    by_reason: byReason,
    by_model: byModel
  };
}

const sourceContradictedLegacyMissingDiagnostic =
  sourceContradictedLegacyMissingDiagnostics(reportSupplierAware, coreBundle);

function sourceContradictedLegacySupplierResidualDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extra = expand(reportSupplierAware.extra);
  const usedExtra = new Set();
  const segments = bundle.segments || [];
  const records = coreOffers(bundle);
  const coreBuckets = new Map();

  for (const record of records) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreBuckets.has(key)) coreBuckets.set(key, []);
    coreBuckets.get(key).push(record);
  }
  const consumedCore = new Map();

  const norm = offer => {
    const fields = offer?.fields || {};
    return {
      model: fields.model?.id || null,
      supplier: fields.supplier == null ? null : String(fields.supplier),
      capacity: fields.capacity_gb == null ? null : Number(fields.capacity_gb),
      condition: normalizeKey(fields.condition) || null,
      color: normalizeKey(fields.color) || null,
      price: fields.price == null ? null : Number(fields.price)
    };
  };

  const equalExceptSupplier = (a, b) =>
    a.model === b.model &&
    a.capacity === b.capacity &&
    a.condition === b.condition &&
    a.color === b.color &&
    a.price === b.price &&
    a.supplier !== b.supplier;

  const supplierEvidenceLines = supplier => {
    if (!supplier) return [];
    return segments
      .filter(segment =>
        (segment.field_candidates || []).some(candidate =>
          candidate.field === 'supplier' && String(candidate.value) === supplier
        )
      )
      .map(segment => Number(segment.line_number))
      .filter(Number.isFinite);
  };

  const pathBoundaries = (fromLine, toLine) => {
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return new Set();
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    const out = new Set();
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      for (const event of segment.context_events || []) {
        if (event.reason === 'timestamp_boundary') out.add('timestamp');
        if (event.reason === 'domain_boundary') out.add('domain');
        if (event.reason === 'supplier_boundary') out.add('supplier');
      }
    }
    return out;
  };

  let pureSupplierCases = 0;
  let contradicted = 0;
  const signatures = {};

  for (const miss of missing) {
    const expected = norm(miss);
    let match = null;
    for (let i = 0; i < extra.length; i += 1) {
      if (usedExtra.has(i)) continue;
      const actual = norm(extra[i]);
      if (!equalExceptSupplier(expected, actual)) continue;
      match = { index: i, actual };
      break;
    }
    if (!match) continue;

    usedExtra.add(match.index);
    pureSupplierCases += 1;

    const extraOffer = extra[match.index];
    const extraKey = offerKey(extraOffer.fields || {}, { include_supplier: true });
    const bucket = coreBuckets.get(extraKey) || [];
    const consumed = consumedCore.get(extraKey) || 0;
    const record = bucket[consumed] || null;
    consumedCore.set(extraKey, consumed + 1);
    if (!record) continue;

    const supplierTrace = (record.trace || []).find(trace => trace.field === 'supplier');
    const priceTrace = (record.trace || []).find(trace => trace.field === 'price');
    const actualSupplierLine = Array.isArray(supplierTrace?.sources) && supplierTrace.sources.length
      ? Number(supplierTrace.sources[0])
      : null;
    const priceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
      ? Number(priceTrace.sources[0])
      : null;
    if (!Number.isFinite(priceLine)) continue;

    const expectedLines = supplierEvidenceLines(expected.supplier);
    const expectedRanked = expectedLines
      .map(line => ({ line, distance: Math.abs(priceLine - line) }))
      .sort((a, b) => a.distance - b.distance || a.line - b.line);
    const expectedNearest = expectedRanked[0] || null;
    const actualDistance = Number.isFinite(actualSupplierLine)
      ? Math.abs(priceLine - actualSupplierLine)
      : null;
    const actualBoundaries = pathBoundaries(actualSupplierLine, priceLine);
    const expectedBoundaries = pathBoundaries(expectedNearest?.line, priceLine);

    const qualifies =
      expectedNearest &&
      Number.isFinite(actualDistance) &&
      expectedNearest.distance > actualDistance &&
      expectedBoundaries.has('supplier') &&
      expectedBoundaries.has('timestamp') &&
      !actualBoundaries.has('supplier') &&
      !actualBoundaries.has('timestamp');

    if (qualifies) contradicted += 1;

    const signature = [
      'expected_distance=' + (expectedNearest?.distance ?? 'none'),
      'actual_distance=' + (actualDistance ?? 'unknown'),
      'expected_supplier_boundary=' + (expectedBoundaries.has('supplier') ? 'yes' : 'no'),
      'expected_timestamp_boundary=' + (expectedBoundaries.has('timestamp') ? 'yes' : 'no'),
      'actual_supplier_boundary=' + (actualBoundaries.has('supplier') ? 'yes' : 'no'),
      'actual_timestamp_boundary=' + (actualBoundaries.has('timestamp') ? 'yes' : 'no'),
      'source_contradicted=' + (qualifies ? 'yes' : 'no')
    ].join('|');
    signatures[signature] = (signatures[signature] || 0) + 1;
  }

  return {
    pure_supplier_residuals: pureSupplierCases,
    source_contradicted_legacy_supplier_residuals: contradicted,
    actionable_pure_supplier_residuals: pureSupplierCases - contradicted,
    signatures
  };
}

const sourceContradictedLegacySupplierResidualDiagnostic =
  sourceContradictedLegacySupplierResidualDiagnostics(reportSupplierAware, coreBundle);

function priceSupplierResidualEvidenceDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extras = expand(reportSupplierAware.extra);
  const usedExtra = new Set();
  const segments = bundle.segments || [];

  const norm = offer => {
    const fields = offer?.fields || {};
    return {
      model: fields.model?.id || null,
      supplier: fields.supplier == null ? null : String(fields.supplier),
      capacity: fields.capacity_gb == null ? null : Number(fields.capacity_gb),
      condition: normalizeKey(fields.condition) || null,
      color: normalizeKey(fields.color) || null,
      price: fields.price == null ? null : Number(fields.price)
    };
  };
  const diffs = (a, b) =>
    ['supplier', 'capacity', 'condition', 'color', 'price']
      .filter(field => a[field] !== b[field]);

  const coreBuckets = new Map();
  for (const record of coreOffers(bundle)) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreBuckets.has(key)) coreBuckets.set(key, []);
    coreBuckets.get(key).push(record);
  }
  const consumed = new Map();

  const fieldLines = (field, predicate) =>
    segments
      .filter(segment => (segment.field_candidates || []).some(candidate =>
        candidate.field === field && predicate(candidate.value)
      ))
      .map(segment => Number(segment.line_number))
      .filter(Number.isFinite);

  const nearest = (lines, targetLine) =>
    lines
      .map(line => ({ line, distance: Math.abs(line - targetLine) }))
      .sort((a, b) => a.distance - b.distance || a.line - b.line)[0] || null;

  const pathState = (fromLine, toLine) => {
    const out = {
      supplier_boundary: false,
      timestamp_boundary: false,
      domain_boundary: false,
      model_anchors: 0
    };
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return out;
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      if ((segment.field_candidates || []).some(candidate => candidate.field === 'model')) {
        out.model_anchors += 1;
      }
      for (const event of segment.context_events || []) {
        if (event.reason === 'supplier_boundary') out.supplier_boundary = true;
        if (event.reason === 'timestamp_boundary') out.timestamp_boundary = true;
        if (event.reason === 'domain_boundary') out.domain_boundary = true;
      }
    }
    return out;
  };

  let cases = 0;
  let sourceContradicted = 0;
  let unresolvedCoreRecord = 0;
  const signatures = {};

  for (const miss of missing) {
    const expected = norm(miss);
    let chosen = -1;

    for (let index = 0; index < extras.length; index += 1) {
      if (usedExtra.has(index)) continue;
      const actual = norm(extras[index]);
      if (actual.model !== expected.model) continue;
      const d = diffs(expected, actual);
      if (d.length !== 2 || !d.includes('price') || !d.includes('supplier')) continue;
      chosen = index;
      break;
    }
    if (chosen < 0) continue;

    usedExtra.add(chosen);
    cases += 1;
    const extra = extras[chosen];
    const actual = norm(extra);
    const key = offerKey(extra.fields || {}, { include_supplier: true });
    const bucket = coreBuckets.get(key) || [];
    const offset = consumed.get(key) || 0;
    const record = bucket[offset] || null;
    consumed.set(key, offset + 1);
    if (!record) {
      unresolvedCoreRecord += 1;
      continue;
    }

    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    const supplierTrace = (record.trace || []).find(item => item.field === 'supplier');
    const actualPriceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
      ? Number(priceTrace.sources[0])
      : null;
    const actualSupplierLine = Array.isArray(supplierTrace?.sources) && supplierTrace.sources.length
      ? Number(supplierTrace.sources[0])
      : null;
    if (!Number.isFinite(actualPriceLine)) {
      unresolvedCoreRecord += 1;
      continue;
    }

    const expectedPriceNearest = nearest(
      fieldLines('price', value => Number(value) === expected.price),
      actualPriceLine
    );
    const expectedSupplierNearest = nearest(
      fieldLines('supplier', value => String(value) === String(expected.supplier)),
      actualPriceLine
    );
    const actualSupplierPath = pathState(actualSupplierLine, actualPriceLine);
    const expectedSupplierPath = pathState(expectedSupplierNearest?.line, actualPriceLine);
    const expectedPricePath = pathState(expectedPriceNearest?.line, actualPriceLine);

    const actualPriceDirect =
      (priceTrace?.rules || []).includes('direct_extraction') &&
      Number.isFinite(actualPriceLine);

    const actualSupplierLocal =
      Number.isFinite(actualSupplierLine) &&
      Math.abs(actualPriceLine - actualSupplierLine) <= 200 &&
      !actualSupplierPath.supplier_boundary &&
      !actualSupplierPath.timestamp_boundary;

    const expectedPriceUnsupported =
      !expectedPriceNearest ||
      (
        expectedPriceNearest.distance > 3 &&
        (
          expectedPricePath.model_anchors > 0 ||
          expectedPricePath.domain_boundary ||
          expectedPricePath.supplier_boundary ||
          expectedPricePath.timestamp_boundary
        )
      );

    const expectedSupplierUnsupported =
      !expectedSupplierNearest ||
      (
        expectedSupplierNearest.distance > Math.abs(actualPriceLine - actualSupplierLine) &&
        (expectedSupplierPath.supplier_boundary || expectedSupplierPath.timestamp_boundary)
      );

    const contradicted =
      actualPriceDirect &&
      actualSupplierLocal &&
      expectedPriceUnsupported &&
      expectedSupplierUnsupported;

    if (contradicted) sourceContradicted += 1;

    const signature = [
      'actual_price_direct=' + (actualPriceDirect ? 'yes' : 'no'),
      'actual_supplier_distance=' + (
        Number.isFinite(actualSupplierLine) ? Math.abs(actualPriceLine - actualSupplierLine) : 'unknown'
      ),
      'actual_supplier_boundaries=' + [
        actualSupplierPath.supplier_boundary ? 'supplier' : null,
        actualSupplierPath.timestamp_boundary ? 'timestamp' : null,
        actualSupplierPath.domain_boundary ? 'domain' : null
      ].filter(Boolean).join('+'),
      'expected_price_distance=' + (expectedPriceNearest?.distance ?? 'none'),
      'expected_price_model_anchors=' + expectedPricePath.model_anchors,
      'expected_supplier_distance=' + (expectedSupplierNearest?.distance ?? 'none'),
      'expected_supplier_boundaries=' + [
        expectedSupplierPath.supplier_boundary ? 'supplier' : null,
        expectedSupplierPath.timestamp_boundary ? 'timestamp' : null,
        expectedSupplierPath.domain_boundary ? 'domain' : null
      ].filter(Boolean).join('+'),
      'source_contradicted=' + (contradicted ? 'yes' : 'no')
    ].join('|');

    signatures[signature] = (signatures[signature] || 0) + 1;
  }

  return {
    price_supplier_residuals: cases,
    source_contradicted_legacy_price_supplier_residuals: sourceContradicted,
    actionable_price_supplier_residuals: cases - sourceContradicted,
    unresolved_core_record: unresolvedCoreRecord,
    signatures
  };
}

const priceSupplierResidualEvidenceDiagnostic =
  priceSupplierResidualEvidenceDiagnostics(reportSupplierAware, coreBundle);

function supplierTraceSupportDiagnostics(legacyBundle, bundle) {
  const legacyCounts = new Map();
  for (const offer of legacyBundle?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }

  const coreByKey = new Map();
  for (const record of coreOffers(bundle)) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreByKey.has(key)) coreByKey.set(key, []);
    coreByKey.get(key).push(record);
  }

  const segments = bundle.segments || [];
  const pathSignature = (fromLine, toLine) => {
    const kinds = new Set();
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return 'unknown';
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      for (const event of segment.context_events || []) {
        if (event.reason === 'supplier_boundary') kinds.add('supplier');
        if (event.reason === 'timestamp_boundary') kinds.add('timestamp');
        if (event.reason === 'domain_boundary') kinds.add('domain');
      }
    }
    return kinds.size ? [...kinds].sort().join('+') : 'none';
  };

  const bucketDistance = distance => {
    if (!Number.isFinite(distance)) return 'unknown';
    if (distance <= 20) return '0-20';
    if (distance <= 50) return '21-50';
    if (distance <= 100) return '51-100';
    if (distance <= 200) return '101-200';
    if (distance <= 400) return '201-400';
    return '401+';
  };

  const rows = {};
  const bump = (status, signature) => {
    if (!rows[signature]) rows[signature] = { supported: 0, surplus: 0 };
    rows[signature][status] += 1;
  };

  for (const [key, records] of coreByKey.entries()) {
    const supportedSlots = Math.min(legacyCounts.get(key) || 0, records.length);
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const priceTrace = (record.trace || []).find(item => item.field === 'price');
      const supplierTrace = (record.trace || []).find(item => item.field === 'supplier');
      const priceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
        ? Number(priceTrace.sources[0])
        : null;
      const supplierLine = Array.isArray(supplierTrace?.sources) && supplierTrace.sources.length
        ? Number(supplierTrace.sources[0])
        : null;
      const distance =
        Number.isFinite(priceLine) && Number.isFinite(supplierLine)
          ? Math.abs(priceLine - supplierLine)
          : null;
      const signature = [
        'distance=' + bucketDistance(distance),
        'boundaries=' + pathSignature(supplierLine, priceLine),
        'supplier_rule=' + ((supplierTrace?.rules || []).join('+') || '(no-trace)')
      ].join('|');
      bump(index < supportedSlots ? 'supported' : 'surplus', signature);
    }
  }

  return {
    signatures: Object.entries(rows)
      .sort((a, b) =>
        (a[1].supported === 0 ? -1 : 1) - (b[1].supported === 0 ? -1 : 1) ||
        b[1].surplus - a[1].surplus ||
        b[1].supported - a[1].supported ||
        a[0].localeCompare(b[0])
      )
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
  };
}

const supplierTraceSupportDiagnostic =
  supplierTraceSupportDiagnostics(legacySupplierAware, coreBundle);

function sourceSupportedCoreOnlyEModelDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const legacyCounts = new Map();
  for (const offer of legacySupplierAware?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }

  const coreByKey = new Map();
  for (const record of coreOffers(bundle)) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreByKey.has(key)) coreByKey.set(key, []);
    coreByKey.get(key).push(record);
  }

  const segmentByLine = new Map(
    (bundle.segments || []).map(segment => [Number(segment.line_number), segment])
  );
  const segments = bundle.segments || [];
  const targetModels = new Set(['iphone_17e_256gb', 'iphone_16e_128gb']);

  const boundariesBetween = (fromLine, toLine) => {
    const out = new Set();
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return out;
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      for (const event of segment.context_events || []) {
        if (event.reason === 'timestamp_boundary') out.add('timestamp');
        if (event.reason === 'domain_boundary') out.add('domain');
        if (event.reason === 'supplier_boundary') out.add('supplier');
      }
    }
    return out;
  };

  const byModel = {};
  let surplusCases = 0;
  let locallySourceSupported = 0;

  for (const [key, records] of coreByKey.entries()) {
    const supportedSlots = Math.min(legacyCounts.get(key) || 0, records.length);
    for (let index = supportedSlots; index < records.length; index += 1) {
      const record = records[index];
      const modelId = record.fields?.model?.id || null;
      if (!targetModels.has(modelId)) continue;
      surplusCases += 1;

      const modelTrace = (record.trace || []).find(trace => trace.field === 'model');
      const priceTrace = (record.trace || []).find(trace => trace.field === 'price');
      const modelLine = Array.isArray(modelTrace?.sources) && modelTrace.sources.length
        ? Number(modelTrace.sources[0])
        : null;
      const priceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
        ? Number(priceTrace.sources[0])
        : null;
      const modelSegment = Number.isFinite(modelLine) ? segmentByLine.get(modelLine) : null;
      const priceSegment = Number.isFinite(priceLine) ? segmentByLine.get(priceLine) : null;

      const semanticIds = [...new Set(
        (modelSegment?.semantic_candidates || [])
          .filter(candidate => candidate.field === 'model' && candidate.entity_id)
          .map(candidate => candidate.entity_id)
      )];
      const directModelValues = (modelSegment?.field_candidates || [])
        .filter(candidate => candidate.field === 'model')
        .map(candidate => String(candidate.value));
      const explicitE = directModelValues.some(value => /\b(?:16e|17e)\b/i.test(value));
      const directPrice = (priceTrace?.rules || []).includes('direct_extraction');
      const distance = Number.isFinite(modelLine) && Number.isFinite(priceLine)
        ? Math.abs(priceLine - modelLine)
        : null;
      const boundaries = boundariesBetween(modelLine, priceLine);
      const localSupport =
        explicitE &&
        semanticIds.includes(modelId) &&
        directPrice &&
        Number.isFinite(distance) &&
        distance <= 6 &&
        !boundaries.has('domain') &&
        !boundaries.has('supplier') &&
        !boundaries.has('timestamp');

      if (!byModel[modelId]) {
        byModel[modelId] = {
          surplus_cases: 0,
          locally_source_supported: 0,
          not_locally_supported: 0,
          signatures: {}
        };
      }
      const row = byModel[modelId];
      row.surplus_cases += 1;
      if (localSupport) {
        row.locally_source_supported += 1;
        locallySourceSupported += 1;
      } else {
        row.not_locally_supported += 1;
      }

      const signature = [
        'explicit_e=' + (explicitE ? 'yes' : 'no'),
        'semantic_exact=' + (semanticIds.includes(modelId) ? 'yes' : 'no'),
        'direct_price=' + (directPrice ? 'yes' : 'no'),
        'distance=' + (distance ?? 'unknown'),
        'domain_boundary=' + (boundaries.has('domain') ? 'yes' : 'no'),
        'supplier_boundary=' + (boundaries.has('supplier') ? 'yes' : 'no'),
        'timestamp_boundary=' + (boundaries.has('timestamp') ? 'yes' : 'no'),
        'local_support=' + (localSupport ? 'yes' : 'no')
      ].join('|');
      row.signatures[signature] = (row.signatures[signature] || 0) + 1;
    }
  }

  return {
    surplus_e_model_cases: surplusCases,
    locally_source_supported_model_price_cases: locallySourceSupported,
    not_locally_source_supported_cases: surplusCases - locallySourceSupported,
    by_model: byModel
  };
}

const sourceSupportedCoreOnlyEModelDiagnostic =
  sourceSupportedCoreOnlyEModelDiagnostics(reportSupplierAware, coreBundle);

function sourceSupportedCoreOnlyEOfferDiagnostics(bundle) {
  const targetModels = new Set(['iphone_17e_256gb', 'iphone_16e_128gb']);
  const legacyCounts = new Map();
  for (const offer of legacySupplierAware?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }

  const coreByKey = new Map();
  for (const record of coreOffers(bundle)) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreByKey.has(key)) coreByKey.set(key, []);
    coreByKey.get(key).push(record);
  }

  const segments = bundle.segments || [];
  const segmentByLine = new Map(segments.map(segment => [Number(segment.line_number), segment]));

  const boundariesBetween = (fromLine, toLine) => {
    const out = new Set();
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return out;
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      for (const event of segment.context_events || []) {
        if (event.reason === 'timestamp_boundary') out.add('timestamp');
        if (event.reason === 'domain_boundary') out.add('domain');
        if (event.reason === 'supplier_boundary') out.add('supplier');
      }
    }
    return out;
  };

  const firstSource = trace => Array.isArray(trace?.sources) && trace.sources.length
    ? Number(trace.sources[0])
    : null;
  const evidenceStatus = (record, field, priceLine) => {
    const value = record.fields?.[field];
    if (value == null) return { state: 'absent_optional' };
    const trace = (record.trace || []).find(item => item.field === field);
    if (!trace) return { state: 'missing_trace' };
    const sourceLine = firstSource(trace);
    const distance = Number.isFinite(sourceLine) && Number.isFinite(priceLine)
      ? Math.abs(priceLine - sourceLine)
      : null;
    const boundaries = boundariesBetween(sourceLine, priceLine);
    const rules = trace.rules || [];

    let local = false;
    if (field === 'price') {
      local = rules.includes('direct_extraction') && distance === 0;
    } else if (field === 'model') {
      local =
        Number.isFinite(distance) &&
        distance <= 6 &&
        !boundaries.has('domain') &&
        !boundaries.has('supplier') &&
        !boundaries.has('timestamp');
    } else if (field === 'color') {
      local =
        Number.isFinite(distance) &&
        distance <= 3 &&
        !boundaries.has('domain') &&
        !boundaries.has('supplier') &&
        !boundaries.has('timestamp');
    } else if (field === 'condition') {
      local =
        Number.isFinite(distance) &&
        distance <= 6 &&
        !boundaries.has('domain') &&
        !boundaries.has('supplier') &&
        !boundaries.has('timestamp');
    } else if (field === 'supplier') {
      local =
        Number.isFinite(distance) &&
        !boundaries.has('supplier') &&
        !boundaries.has('timestamp');
    }

    return {
      state: local ? 'local' : 'nonlocal',
      distance,
      domain_boundary: boundaries.has('domain'),
      supplier_boundary: boundaries.has('supplier'),
      timestamp_boundary: boundaries.has('timestamp'),
      rules: rules.join('+') || '(no-rule)'
    };
  };

  const byModel = {};
  let cases = 0;
  let fullLocal = 0;
  let modelPriceLocalOnly = 0;

  for (const [key, records] of coreByKey.entries()) {
    const supportedSlots = Math.min(legacyCounts.get(key) || 0, records.length);
    for (let i = supportedSlots; i < records.length; i += 1) {
      const record = records[i];
      const modelId = record.fields?.model?.id || null;
      if (!targetModels.has(modelId)) continue;
      cases += 1;

      const priceTrace = (record.trace || []).find(item => item.field === 'price');
      const priceLine = firstSource(priceTrace);
      const statuses = {};
      for (const field of ['model','price','color','condition','supplier']) {
        statuses[field] = evidenceStatus(record, field, priceLine);
      }

      const mandatoryLocal =
        statuses.model.state === 'local' &&
        statuses.price.state === 'local';
      const optionalLocal =
        ['color','condition'].every(field =>
          statuses[field].state === 'absent_optional' || statuses[field].state === 'local'
        );
      const supplierLocal = statuses.supplier.state === 'local';
      const fullyLocal = mandatoryLocal && optionalLocal && supplierLocal;

      if (!byModel[modelId]) {
        byModel[modelId] = {
          cases: 0,
          fully_local_offer_evidence: 0,
          model_price_local_but_other_nonlocal: 0,
          signatures: {}
        };
      }
      const row = byModel[modelId];
      row.cases += 1;
      if (fullyLocal) {
        row.fully_local_offer_evidence += 1;
        fullLocal += 1;
      } else if (mandatoryLocal) {
        row.model_price_local_but_other_nonlocal += 1;
        modelPriceLocalOnly += 1;
      }

      const signature = [
        'model=' + statuses.model.state + ':d' + (statuses.model.distance ?? 'x'),
        'price=' + statuses.price.state,
        'color=' + statuses.color.state + ':d' + (statuses.color.distance ?? 'x'),
        'condition=' + statuses.condition.state + ':d' + (statuses.condition.distance ?? 'x'),
        'supplier=' + statuses.supplier.state + ':d' + (statuses.supplier.distance ?? 'x'),
        'full_local=' + (fullyLocal ? 'yes' : 'no')
      ].join('|');
      row.signatures[signature] = (row.signatures[signature] || 0) + 1;
    }
  }

  return {
    cases,
    fully_local_offer_evidence: fullLocal,
    model_price_local_but_other_nonlocal: modelPriceLocalOnly,
    by_model: byModel
  };
}

const sourceSupportedCoreOnlyEOfferDiagnostic =
  sourceSupportedCoreOnlyEOfferDiagnostics(coreBundle);

function sourceSupportedCoreOnlyFullOfferDiagnostics(bundle) {
  const legacyCounts = new Map();
  for (const offer of legacySupplierAware?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }

  const coreByKey = new Map();
  for (const record of coreOffers(bundle)) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreByKey.has(key)) coreByKey.set(key, []);
    coreByKey.get(key).push(record);
  }

  const segments = bundle.segments || [];
  const segmentByLine = new Map(
    segments.map(segment => [Number(segment.line_number), segment])
  );
  const sourceLine = (record, field) => {
    const trace = (record.trace || []).find(item => item.field === field);
    return Array.isArray(trace?.sources) && trace.sources.length
      ? Number(trace.sources[0])
      : null;
  };
  const boundariesBetween = (fromLine, toLine) => {
    const out = new Set();
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return out;
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      for (const event of segment.context_events || []) {
        if (event.reason === 'timestamp_boundary') out.add('timestamp');
        if (event.reason === 'domain_boundary') out.add('domain');
        if (event.reason === 'supplier_boundary') out.add('supplier');
      }
    }
    return out;
  };
  const localField = (record, field, priceLine, maxDistance) => {
    if (record.fields?.[field] == null) return true;
    const line = sourceLine(record, field);
    if (!Number.isFinite(line)) return false;
    const boundaries = boundariesBetween(line, priceLine);
    return Math.abs(priceLine - line) <= maxDistance &&
      !boundaries.has('domain') &&
      !boundaries.has('supplier') &&
      !boundaries.has('timestamp');
  };
  const modelSemanticallySupportsRecord = (record, priceLine) => {
    const modelLine = sourceLine(record, 'model');
    if (!Number.isFinite(modelLine) || Math.abs(priceLine - modelLine) > 6) return false;
    const modelSegment = segmentByLine.get(modelLine);
    const modelId = record.fields?.model?.id || null;
    if (!modelSegment || !modelId) return false;
    return (modelSegment.semantic_candidates || []).some(candidate =>
      candidate.field === 'model' &&
      candidate.entity_id === modelId &&
      (candidate.state === 'interpreted' || candidate.state === 'inferred')
    );
  };

  let surplusCases = 0;
  let fullyLocal = 0;
  const byModel = {};
  const signatures = {};

  for (const [key, records] of coreByKey.entries()) {
    const supportedSlots = Math.min(legacyCounts.get(key) || 0, records.length);
    for (let index = supportedSlots; index < records.length; index += 1) {
      const record = records[index];
      surplusCases += 1;
      const modelId = record.fields?.model?.id || '(unknown)';
      if (!byModel[modelId]) byModel[modelId] = { surplus: 0, fully_local: 0 };
      byModel[modelId].surplus += 1;

      const priceTrace = (record.trace || []).find(item => item.field === 'price');
      const priceLine = sourceLine(record, 'price');
      const supplierLine = sourceLine(record, 'supplier');
      const supplierBoundaries = boundariesBetween(supplierLine, priceLine);
      const priceLocal =
        Number.isFinite(priceLine) &&
        (priceTrace?.rules || []).includes('direct_extraction');
      const modelLocal =
        priceLocal &&
        modelSemanticallySupportsRecord(record, priceLine) &&
        localField(record, 'model', priceLine, 6);
      const colorLocal = priceLocal && localField(record, 'color', priceLine, 3);
      const conditionLocal = priceLocal && localField(record, 'condition', priceLine, 6);
      const supplierLocal =
        priceLocal &&
        Number.isFinite(supplierLine) &&
        !supplierBoundaries.has('supplier') &&
        !supplierBoundaries.has('timestamp');

      const qualifies =
        priceLocal && modelLocal && colorLocal && conditionLocal && supplierLocal;
      if (qualifies) {
        fullyLocal += 1;
        byModel[modelId].fully_local += 1;
      }

      const signature = [
        'price=' + (priceLocal ? 'local' : 'nonlocal'),
        'model=' + (modelLocal ? 'local' : 'nonlocal'),
        'color=' + (colorLocal ? 'local_or_absent' : 'nonlocal'),
        'condition=' + (conditionLocal ? 'local_or_absent' : 'nonlocal'),
        'supplier=' + (supplierLocal ? 'local' : 'nonlocal'),
        'full_local=' + (qualifies ? 'yes' : 'no')
      ].join('|');
      signatures[signature] = (signatures[signature] || 0) + 1;
    }
  }

  return {
    surplus_cases: surplusCases,
    fully_local_core_only_offers: fullyLocal,
    remaining_not_fully_local: surplusCases - fullyLocal,
    by_model: byModel,
    signatures: Object.entries(signatures)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
  };
}

const sourceSupportedCoreOnlyFullOfferDiagnostic =
  sourceSupportedCoreOnlyFullOfferDiagnostics(coreBundle);

function sourceUnsupportedLegacyPureConditionDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extra = expand(reportSupplierAware.extra);
  const usedExtra = new Set();
  const segments = bundle.segments || [];

  const norm = offer => {
    const fields = offer?.fields || {};
    return {
      model: fields.model?.id || null,
      supplier: fields.supplier == null ? null : String(fields.supplier),
      capacity: fields.capacity_gb == null ? null : Number(fields.capacity_gb),
      condition: normalizeKey(fields.condition) || null,
      color: normalizeKey(fields.color) || null,
      price: fields.price == null ? null : Number(fields.price)
    };
  };
  const equalExceptCondition = (a, b) =>
    a.model === b.model &&
    a.supplier === b.supplier &&
    a.capacity === b.capacity &&
    a.color === b.color &&
    a.price === b.price &&
    a.condition !== b.condition;

  const coreBuckets = new Map();
  for (const record of coreOffers(bundle)) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreBuckets.has(key)) coreBuckets.set(key, []);
    coreBuckets.get(key).push(record);
  }
  const consumedCore = new Map();

  let pureCases = 0;
  let unsupported = 0;
  const signatures = {};

  for (const miss of missing) {
    const expected = norm(miss);
    if (!expected.condition) continue;

    let found = null;
    for (let i = 0; i < extra.length; i += 1) {
      if (usedExtra.has(i)) continue;
      const actual = norm(extra[i]);
      if (!equalExceptCondition(expected, actual)) continue;
      if (actual.condition != null) continue;
      found = { index: i, actual };
      break;
    }
    if (!found) continue;

    usedExtra.add(found.index);
    pureCases += 1;

    const extraOffer = extra[found.index];
    const extraKey = offerKey(extraOffer.fields || {}, { include_supplier: true });
    const bucket = coreBuckets.get(extraKey) || [];
    const consumed = consumedCore.get(extraKey) || 0;
    const record = bucket[consumed] || null;
    consumedCore.set(extraKey, consumed + 1);
    if (!record) continue;

    const priceTrace = (record.trace || []).find(trace => trace.field === 'price');
    const modelTrace = (record.trace || []).find(trace => trace.field === 'model');
    const recordLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
      ? Number(priceTrace.sources[0])
      : Array.isArray(modelTrace?.sources) && modelTrace.sources.length
        ? Number(modelTrace.sources[0])
        : null;
    if (!Number.isFinite(recordLine)) continue;

    const matchingConditionLines = [];
    for (const segment of segments) {
      const supplier = segment.inherited_context?.supplier?.value == null
        ? null
        : String(segment.inherited_context.supplier.value);
      const directSupplier = [...new Set(
        (segment.field_candidates || [])
          .filter(candidate => candidate.field === 'supplier')
          .map(candidate => String(candidate.value))
      )];
      const effectiveSupplier = directSupplier.length === 1 ? directSupplier[0] : supplier;
      if (effectiveSupplier !== expected.supplier) continue;

      for (const candidate of segment.field_candidates || []) {
        if (candidate.field !== 'condition') continue;
        const mapped = schema.fields.find(field => field.name === 'condition')?.value_map || {};
        const canonical = mapped[candidate.value] || mapped[String(candidate.value)] || candidate.value;
        if (normalizeKey(canonical) !== expected.condition) continue;
        matchingConditionLines.push(Number(segment.line_number));
      }
    }

    const ranked = matchingConditionLines
      .filter(Number.isFinite)
      .map(line => ({ line, distance: Math.abs(recordLine - line) }))
      .sort((a, b) => a.distance - b.distance || a.line - b.line);
    const nearest = ranked[0] || null;

    let modelAnchorsBetween = 0;
    const boundaries = new Set();
    if (nearest) {
      const lo = Math.min(nearest.line, recordLine);
      const hi = Math.max(nearest.line, recordLine);
      for (const segment of segments) {
        const line = Number(segment.line_number);
        if (!(line > lo && line <= hi)) continue;
        if ((segment.field_candidates || []).some(candidate => candidate.field === 'model')) {
          modelAnchorsBetween += 1;
        }
        for (const event of segment.context_events || []) {
          if (event.reason === 'domain_boundary') boundaries.add('domain');
          if (event.reason === 'supplier_boundary') boundaries.add('supplier');
          if (event.reason === 'timestamp_boundary') boundaries.add('timestamp');
        }
      }
    }

    const qualifies =
      !nearest ||
      (
        nearest.distance >= 100 &&
        modelAnchorsBetween >= 20 &&
        boundaries.has('domain') &&
        boundaries.has('supplier')
      );

    if (qualifies) unsupported += 1;

    const signature = [
      'expected=' + expected.condition,
      'nearest_distance=' + (nearest?.distance ?? 'none'),
      'model_anchors_between=' + modelAnchorsBetween,
      'domain_boundary=' + (boundaries.has('domain') ? 'yes' : 'no'),
      'supplier_boundary=' + (boundaries.has('supplier') ? 'yes' : 'no'),
      'source_unsupported=' + (qualifies ? 'yes' : 'no')
    ].join('|');
    signatures[signature] = (signatures[signature] || 0) + 1;
  }

  return {
    pure_condition_residuals: pureCases,
    source_unsupported_legacy_condition_residuals: unsupported,
    actionable_pure_condition_residuals: pureCases - unsupported,
    signatures
  };
}

const sourceUnsupportedLegacyPureConditionDiagnostic =
  sourceUnsupportedLegacyPureConditionDiagnostics(reportSupplierAware, coreBundle);

function mixedPriceSupplierEvidenceDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extra = expand(reportSupplierAware.extra);
  const usedExtra = new Set();

  const records = coreOffers(bundle);
  const segments = bundle.segments || [];
  const segmentByLine = new Map(segments.map(segment => [Number(segment.line_number), segment]));
  const coreBuckets = new Map();
  for (const record of records) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreBuckets.has(key)) coreBuckets.set(key, []);
    coreBuckets.get(key).push(record);
  }
  const consumedCore = new Map();

  const norm = offer => {
    const fields = offer?.fields || {};
    return {
      model: fields.model?.id || null,
      supplier: fields.supplier == null ? null : String(fields.supplier),
      capacity: fields.capacity_gb == null ? null : Number(fields.capacity_gb),
      condition: normalizeKey(fields.condition) || null,
      color: normalizeKey(fields.color) || null,
      price: fields.price == null ? null : Number(fields.price)
    };
  };
  const diffFields = (a, b) =>
    ['supplier','capacity','condition','color','price'].filter(field => a[field] !== b[field]);

  const sourceLine = (record, field) => {
    const trace = (record.trace || []).find(item => item.field === field);
    return Array.isArray(trace?.sources) && trace.sources.length ? Number(trace.sources[0]) : null;
  };
  const pathBoundaries = (fromLine, toLine) => {
    const out = new Set();
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return out;
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      for (const event of segment.context_events || []) {
        if (event.reason === 'timestamp_boundary') out.add('timestamp');
        if (event.reason === 'domain_boundary') out.add('domain');
        if (event.reason === 'supplier_boundary') out.add('supplier');
      }
    }
    return out;
  };
  const supplierEvidenceLines = supplier => {
    if (!supplier) return [];
    return segments.filter(segment =>
      (segment.field_candidates || []).some(candidate =>
        candidate.field === 'supplier' && String(candidate.value) === supplier
      )
    ).map(segment => Number(segment.line_number)).filter(Number.isFinite);
  };

  let cases = 0;
  let locallySupportedCore = 0;
  let legacyExpectedSupplierStale = 0;
  const signatures = {};

  for (const miss of missing) {
    const expected = norm(miss);
    let best = null;
    for (let i = 0; i < extra.length; i += 1) {
      if (usedExtra.has(i)) continue;
      const actual = norm(extra[i]);
      if (actual.model !== expected.model || actual.capacity !== expected.capacity) continue;
      const diffs = diffFields(expected, actual);
      if (!diffs.includes('price') || !diffs.includes('supplier')) continue;
      if (!best || diffs.length < best.diffs.length) best = { index:i, actual, diffs };
    }
    if (!best) continue;
    usedExtra.add(best.index);
    cases += 1;

    const extraOffer = extra[best.index];
    const key = offerKey(extraOffer.fields || {}, { include_supplier: true });
    const bucket = coreBuckets.get(key) || [];
    const consumed = consumedCore.get(key) || 0;
    const record = bucket[consumed] || null;
    consumedCore.set(key, consumed + 1);
    if (!record) continue;

    const priceLine = sourceLine(record, 'price');
    const supplierLine = sourceLine(record, 'supplier');
    const modelLine = sourceLine(record, 'model');
    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    const directPrice = (priceTrace?.rules || []).includes('direct_extraction');

    const coreSupplierBoundaries = pathBoundaries(supplierLine, priceLine);
    const modelBoundaries = pathBoundaries(modelLine, priceLine);
    const coreLocal =
      directPrice &&
      Number.isFinite(priceLine) &&
      Number.isFinite(modelLine) &&
      Math.abs(priceLine - modelLine) <= 8 &&
      !modelBoundaries.has('domain') &&
      !modelBoundaries.has('supplier') &&
      !modelBoundaries.has('timestamp') &&
      Number.isFinite(supplierLine) &&
      !coreSupplierBoundaries.has('supplier') &&
      !coreSupplierBoundaries.has('timestamp');
    if (coreLocal) locallySupportedCore += 1;

    const expectedSupplierLines = supplierEvidenceLines(expected.supplier)
      .map(line => ({line,distance:Math.abs(priceLine-line)}))
      .sort((a,b)=>a.distance-b.distance || a.line-b.line);
    const nearestExpectedSupplier = expectedSupplierLines[0] || null;
    const expectedSupplierBoundaries = pathBoundaries(nearestExpectedSupplier?.line, priceLine);
    const staleExpectedSupplier =
      nearestExpectedSupplier &&
      expectedSupplierBoundaries.has('supplier') &&
      expectedSupplierBoundaries.has('timestamp') &&
      Number.isFinite(supplierLine) &&
      nearestExpectedSupplier.distance > Math.abs(priceLine - supplierLine);
    if (staleExpectedSupplier) legacyExpectedSupplierStale += 1;

    const signature = [
      'diffs=' + best.diffs.slice().sort().join('+'),
      'direct_price=' + (directPrice?'yes':'no'),
      'model_distance=' + (Number.isFinite(modelLine)&&Number.isFinite(priceLine)?Math.abs(priceLine-modelLine):'unknown'),
      'core_supplier_distance=' + (Number.isFinite(supplierLine)&&Number.isFinite(priceLine)?Math.abs(priceLine-supplierLine):'unknown'),
      'expected_supplier_distance=' + (nearestExpectedSupplier?.distance ?? 'none'),
      'core_local=' + (coreLocal?'yes':'no'),
      'legacy_supplier_stale=' + (staleExpectedSupplier?'yes':'no')
    ].join('|');
    signatures[signature]=(signatures[signature]||0)+1;
  }

  return {
    cases,
    locally_supported_core_cases: locallySupportedCore,
    legacy_expected_supplier_stale_cases: legacyExpectedSupplierStale,
    signatures
  };
}

const mixedPriceSupplierEvidenceDiagnostic =
  mixedPriceSupplierEvidenceDiagnostics(reportSupplierAware, coreBundle);

function adjudicatedMixedPriceSupplierDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extra = expand(reportSupplierAware.extra);
  const usedExtra = new Set();
  const records = coreOffers(bundle);
  const segments = bundle.segments || [];
  const coreBuckets = new Map();

  for (const record of records) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreBuckets.has(key)) coreBuckets.set(key, []);
    coreBuckets.get(key).push(record);
  }
  const consumedCore = new Map();

  const norm = offer => {
    const fields = offer?.fields || {};
    return {
      model: fields.model?.id || null,
      supplier: fields.supplier == null ? null : String(fields.supplier),
      capacity: fields.capacity_gb == null ? null : Number(fields.capacity_gb),
      condition: normalizeKey(fields.condition) || null,
      color: normalizeKey(fields.color) || null,
      price: fields.price == null ? null : Number(fields.price)
    };
  };
  const diffFields = (a, b) =>
    ['supplier','capacity','condition','color','price'].filter(field => a[field] !== b[field]);
  const sourceLine = (record, field) => {
    const trace = (record.trace || []).find(item => item.field === field);
    return Array.isArray(trace?.sources) && trace.sources.length
      ? Number(trace.sources[0])
      : null;
  };
  const pathBoundaries = (fromLine, toLine) => {
    const out = new Set();
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return out;
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      for (const event of segment.context_events || []) {
        if (event.reason === 'timestamp_boundary') out.add('timestamp');
        if (event.reason === 'domain_boundary') out.add('domain');
        if (event.reason === 'supplier_boundary') out.add('supplier');
      }
    }
    return out;
  };
  const supplierEvidenceLines = supplier => {
    if (!supplier) return [];
    return segments
      .filter(segment => (segment.field_candidates || []).some(candidate =>
        candidate.field === 'supplier' && String(candidate.value) === supplier
      ))
      .map(segment => Number(segment.line_number))
      .filter(Number.isFinite);
  };

  let mixedCases = 0;
  let adjudicated = 0;
  let unresolvedCoreRecord = 0;
  const signatures = {};

  for (const miss of missing) {
    const expected = norm(miss);
    let best = null;

    for (let index = 0; index < extra.length; index += 1) {
      if (usedExtra.has(index)) continue;
      const actual = norm(extra[index]);
      if (actual.model !== expected.model || actual.capacity !== expected.capacity) continue;
      const diffs = diffFields(expected, actual);
      if (diffs.length < 3) continue;
      if (!diffs.includes('price') || !diffs.includes('supplier')) continue;
      if (!best || diffs.length < best.diffs.length) best = { index, diffs };
    }
    if (!best) continue;

    usedExtra.add(best.index);
    mixedCases += 1;
    const extraOffer = extra[best.index];
    const key = offerKey(extraOffer.fields || {}, { include_supplier: true });
    const bucket = coreBuckets.get(key) || [];
    const offset = consumedCore.get(key) || 0;
    const record = bucket[offset] || null;
    consumedCore.set(key, offset + 1);
    if (!record) {
      unresolvedCoreRecord += 1;
      continue;
    }

    const priceLine = sourceLine(record, 'price');
    const supplierLine = sourceLine(record, 'supplier');
    const modelLine = sourceLine(record, 'model');
    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    if (!Number.isFinite(priceLine)) {
      unresolvedCoreRecord += 1;
      continue;
    }

    const supplierDistance = Number.isFinite(supplierLine)
      ? Math.abs(priceLine - supplierLine)
      : null;
    const modelDistance = Number.isFinite(modelLine)
      ? Math.abs(priceLine - modelLine)
      : null;
    const supplierBoundaries = pathBoundaries(supplierLine, priceLine);
    const modelBoundaries = pathBoundaries(modelLine, priceLine);
    const expectedSupplierNearest = supplierEvidenceLines(expected.supplier)
      .map(line => ({ line, distance: Math.abs(priceLine - line) }))
      .sort((a, b) => a.distance - b.distance || a.line - b.line)[0] || null;
    const expectedSupplierBoundaries =
      pathBoundaries(expectedSupplierNearest?.line, priceLine);

    const directPrice = (priceTrace?.rules || []).includes('direct_extraction');
    const modelLocal =
      Number.isFinite(modelDistance) &&
      modelDistance <= 6 &&
      !modelBoundaries.has('domain') &&
      !modelBoundaries.has('supplier') &&
      !modelBoundaries.has('timestamp');
    const supplierLocal =
      Number.isFinite(supplierDistance) &&
      !supplierBoundaries.has('supplier') &&
      !supplierBoundaries.has('timestamp');
    const legacySupplierStale =
      expectedSupplierNearest &&
      Number.isFinite(supplierDistance) &&
      expectedSupplierNearest.distance > supplierDistance &&
      (
        expectedSupplierBoundaries.has('supplier') ||
        expectedSupplierBoundaries.has('timestamp')
      );

    const qualifies = directPrice && modelLocal && supplierLocal && legacySupplierStale;
    if (qualifies) adjudicated += 1;

    const signature = [
      'diffs=' + best.diffs.slice().sort().join('+'),
      'direct_price=' + (directPrice ? 'yes' : 'no'),
      'model_distance=' + (modelDistance ?? 'unknown'),
      'core_supplier_distance=' + (supplierDistance ?? 'unknown'),
      'expected_supplier_distance=' + (expectedSupplierNearest?.distance ?? 'none'),
      'legacy_supplier_stale=' + (legacySupplierStale ? 'yes' : 'no'),
      'adjudicated=' + (qualifies ? 'yes' : 'no')
    ].join('|');
    signatures[signature] = (signatures[signature] || 0) + 1;
  }

  return {
    mixed_price_supplier_residuals: mixedCases,
    candidate_source_contradicted_legacy_mixed_price_supplier_pairs: adjudicated,
    remaining_mixed_price_supplier_residuals_before_overlap_resolution: mixedCases - adjudicated,
    unresolved_core_record: unresolvedCoreRecord,
    adjudication_status: 'evidence_only_overlap_not_proven',
    signatures: Object.entries(signatures)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
  };
}

const adjudicatedMixedPriceSupplierDiagnostic =
  adjudicatedMixedPriceSupplierDiagnostics(reportSupplierAware, coreBundle);

function strongMixedResidualEvidenceDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extras = expand(reportSupplierAware.extra);
  const usedExtra = new Set();
  const segments = bundle.segments || [];

  const norm = offer => {
    const fields = offer?.fields || {};
    return {
      model: fields.model?.id || null,
      supplier: fields.supplier == null ? null : String(fields.supplier),
      capacity: fields.capacity_gb == null ? null : Number(fields.capacity_gb),
      condition: normalizeKey(fields.condition) || null,
      color: normalizeKey(fields.color) || null,
      price: fields.price == null ? null : Number(fields.price)
    };
  };
  const diffFields = (a,b) =>
    ['supplier','capacity','condition','color','price'].filter(field => a[field] !== b[field]);

  const coreBuckets = new Map();
  for (const record of coreOffers(bundle)) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreBuckets.has(key)) coreBuckets.set(key, []);
    coreBuckets.get(key).push(record);
  }
  const consumed = new Map();

  const sourceLine = (record, field) => {
    const trace = (record?.trace || []).find(item => item.field === field);
    return Array.isArray(trace?.sources) && trace.sources.length
      ? Number(trace.sources[0])
      : null;
  };
  const traceRules = (record, field) => {
    const trace = (record?.trace || []).find(item => item.field === field);
    return Array.isArray(trace?.rules) ? trace.rules.map(String) : [];
  };
  const pathBoundaries = (fromLine,toLine) => {
    const out = new Set();
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return out;
    const lo=Math.min(fromLine,toLine), hi=Math.max(fromLine,toLine);
    for(const segment of segments){
      const line=Number(segment.line_number);
      if(!(line>lo && line<=hi)) continue;
      for(const event of segment.context_events||[]){
        if(event.reason==='timestamp_boundary') out.add('timestamp');
        if(event.reason==='domain_boundary') out.add('domain');
        if(event.reason==='supplier_boundary') out.add('supplier');
      }
    }
    return out;
  };
  const fieldEvidenceLines = (field, expectedValue) => {
    const canonical = value => {
      if (field === 'condition') {
        const map = schema.fields.find(f => f.name === 'condition')?.value_map || {};
        return normalizeKey(map[value] || map[String(value)] || value) || null;
      }
      return normalizeKey(value) || null;
    };
    return segments
      .filter(segment => (segment.field_candidates || []).some(candidate =>
        candidate.field === field &&
        canonical(candidate.value) === canonical(expectedValue)
      ))
      .map(segment => Number(segment.line_number))
      .filter(Number.isFinite);
  };
  const nearest = (lines,target) =>
    lines.map(line=>({line,distance:Math.abs(target-line)}))
      .sort((a,b)=>a.distance-b.distance || a.line-b.line)[0] || null;

  let cases=0, fullySupportedCore=0, unresolvedCoreRecord=0;
  const signatures={};

  for(const miss of missing){
    const expected=norm(miss);
    let best=null;
    for(let i=0;i<extras.length;i+=1){
      if(usedExtra.has(i)) continue;
      const actual=norm(extras[i]);
      if(actual.model!==expected.model || actual.capacity!==expected.capacity) continue;
      const diffs=diffFields(expected,actual);
      if(diffs.length<3 || !diffs.includes('price') || !diffs.includes('supplier')) continue;
      if(!best || diffs.length<best.diffs.length) best={index:i,diffs,actual};
    }
    if(!best) continue;
    usedExtra.add(best.index);
    cases+=1;

    const extra=extras[best.index];
    const key=offerKey(extra.fields||{}, {include_supplier:true});
    const bucket=coreBuckets.get(key)||[];
    const offset=consumed.get(key)||0;
    const record=bucket[offset]||null;
    consumed.set(key,offset+1);
    if(!record){ unresolvedCoreRecord+=1; continue; }

    const priceLine=sourceLine(record,'price');
    const modelLine=sourceLine(record,'model');
    const supplierLine=sourceLine(record,'supplier');
    if(!Number.isFinite(priceLine)){ unresolvedCoreRecord+=1; continue; }

    const modelPath=pathBoundaries(modelLine,priceLine);
    const supplierPath=pathBoundaries(supplierLine,priceLine);
    const priceDirect=traceRules(record,'price').includes('direct_extraction');
    const modelLocal=Number.isFinite(modelLine) &&
      Math.abs(priceLine-modelLine)<=6 &&
      !modelPath.has('domain') && !modelPath.has('supplier') && !modelPath.has('timestamp');
    const supplierLocal=Number.isFinite(supplierLine) &&
      !supplierPath.has('supplier') && !supplierPath.has('timestamp');

    let differingOptionalFieldsSupported=true;
    const optionalEvidenceParts=[];
    for(const field of ['color','condition']){
      if(!best.diffs.includes(field)) continue;
      const actualLine=sourceLine(record,field);
      const maxDistance=field==='color'?3:6;
      const actualPath=pathBoundaries(actualLine,priceLine);
      const actualLocal=Number.isFinite(actualLine) &&
        Math.abs(priceLine-actualLine)<=maxDistance &&
        !actualPath.has('domain') && !actualPath.has('supplier') && !actualPath.has('timestamp');

      const expectedNearest=nearest(fieldEvidenceLines(field,expected[field]),priceLine);
      const expectedPath=pathBoundaries(expectedNearest?.line,priceLine);
      const expectedUnsupported=!expectedNearest ||
        expectedNearest.distance>maxDistance ||
        expectedPath.has('domain') || expectedPath.has('supplier') || expectedPath.has('timestamp');

      if(!(actualLocal && expectedUnsupported)) differingOptionalFieldsSupported=false;
      optionalEvidenceParts.push(
        field +
        ':core_local='+(actualLocal?'yes':'no') +
        ':legacy_local='+(expectedUnsupported?'no':'yes')
      );
    }

    const qualifies=priceDirect && modelLocal && supplierLocal && differingOptionalFieldsSupported;
    if(qualifies) fullySupportedCore+=1;

    const sig=[
      'diffs='+best.diffs.slice().sort().join('+'),
      'price_direct='+(priceDirect?'yes':'no'),
      'model_local='+(modelLocal?'yes':'no'),
      'supplier_local='+(supplierLocal?'yes':'no'),
      ...optionalEvidenceParts,
      'full_core_evidence='+(qualifies?'yes':'no')
    ].join('|');
    signatures[sig]=(signatures[sig]||0)+1;
  }

  return {
    mixed_residuals: cases,
    fully_source_supported_core_mixed_pairs: fullySupportedCore,
    not_fully_supported_mixed_pairs: cases-fullySupportedCore,
    unresolved_core_record: unresolvedCoreRecord,
    status: 'diagnostic_only_not_promotion_counted',
    signatures:Object.entries(signatures)
      .sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))
      .reduce((acc,[k,v])=>{acc[k]=v; return acc;},{})
  };
}

const strongMixedResidualEvidenceDiagnostic =
  strongMixedResidualEvidenceDiagnostics(reportSupplierAware, coreBundle);

function mixedResidualOverlapCoverageDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extra = expand(reportSupplierAware.extra);
  const usedExtra = new Set();
  const segments = bundle.segments || [];
  const records = coreOffers(bundle);
  const segmentByLine = new Map(segments.map(segment => [Number(segment.line_number), segment]));

  const norm = offer => {
    const fields = offer?.fields || {};
    return {
      model: fields.model?.id || null,
      supplier: fields.supplier == null ? null : String(fields.supplier),
      capacity: fields.capacity_gb == null ? null : Number(fields.capacity_gb),
      condition: normalizeKey(fields.condition) || null,
      color: normalizeKey(fields.color) || null,
      price: fields.price == null ? null : Number(fields.price)
    };
  };
  const diffFields = (a, b) =>
    ['supplier','capacity','condition','color','price'].filter(field => a[field] !== b[field]);
  const sourceLine = (record, field) => {
    const trace = (record.trace || []).find(item => item.field === field);
    return Array.isArray(trace?.sources) && trace.sources.length
      ? Number(trace.sources[0])
      : null;
  };
  const pathBoundaries = (fromLine, toLine) => {
    const out = new Set();
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return out;
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      for (const event of segment.context_events || []) {
        if (event.reason === 'timestamp_boundary') out.add('timestamp');
        if (event.reason === 'domain_boundary') out.add('domain');
        if (event.reason === 'supplier_boundary') out.add('supplier');
      }
    }
    return out;
  };
  const supplierAt = segment => {
    const direct = [...new Set(
      (segment?.field_candidates || [])
        .filter(candidate => candidate.field === 'supplier')
        .map(candidate => String(candidate.value))
    )];
    if (direct.length === 1) return direct[0];
    return segment?.inherited_context?.supplier?.value == null
      ? null
      : String(segment.inherited_context.supplier.value);
  };
  const supplierEvidenceLines = supplier => {
    if (!supplier) return [];
    return segments
      .filter(segment => (segment.field_candidates || []).some(candidate =>
        candidate.field === 'supplier' && String(candidate.value) === supplier
      ))
      .map(segment => Number(segment.line_number))
      .filter(Number.isFinite);
  };

  const coreBuckets = new Map();
  for (const record of records) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreBuckets.has(key)) coreBuckets.set(key, []);
    coreBuckets.get(key).push(record);
  }
  const consumedCore = new Map();

  const missingAlreadyContradicted = item => {
    const model = item.fields?.model?.id || null;
    const supplier = String(item.fields?.supplier ?? '');
    const price = Number(item.fields?.price);
    if (!model || !Number.isFinite(price)) return false;

    if (model === 'iphone_16_256gb') {
      const sameSupplierPriceRecords = records.filter(record =>
        String(record.fields?.supplier ?? '') === supplier &&
        Number(record.fields?.price) === price
      );
      if (!sameSupplierPriceRecords.length) return false;
      return sameSupplierPriceRecords.every(record => {
        const modelTrace = (record.trace || []).find(trace => trace.field === 'model');
        const modelLine = Array.isArray(modelTrace?.sources) && modelTrace.sources.length
          ? Number(modelTrace.sources[0])
          : null;
        const segment = Number.isFinite(modelLine) ? segmentByLine.get(modelLine) : null;
        return /\bpro\s*max\b/i.test(String(segment?.normalized || ''));
      });
    }

    if (model === 'iphone_17_512gb') {
      const priceSegments = segments.filter(segment =>
        supplierAt(segment) === supplier &&
        (segment.field_candidates || []).some(candidate =>
          candidate.field === 'price' && Number(candidate.value) === price
        )
      );
      if (!priceSegments.length) return false;
      return priceSegments.every(priceSegment => {
        const priceLine = Number(priceSegment.line_number);
        const nearestAnchor = segments
          .filter(segment =>
            Number(segment.line_number) < priceLine &&
            (segment.field_candidates || []).some(candidate => candidate.field === 'model')
          )
          .sort((a, b) => Number(b.line_number) - Number(a.line_number))[0] || null;
        if (!nearestAnchor) return false;

        const shapes = [...new Set(
          (nearestAnchor.field_candidates || [])
            .filter(candidate => candidate.field === 'model')
            .map(candidate => iphoneModelShape(candidate.value))
            .filter(Boolean)
        )];
        const semanticIds = [...new Set(
          (nearestAnchor.semantic_candidates || [])
            .filter(candidate => candidate.field === 'model' && candidate.entity_id)
            .map(candidate => candidate.entity_id)
        )];

        return shapes.length > 0 &&
          shapes.every(shape => /^17\|(?:pro|pro max)\|(?:256|512)$/.test(shape)) &&
          !semanticIds.includes('iphone_17_512gb');
      });
    }

    return false;
  };

  const extraAlreadySourceSupportedE = record => {
    const modelId = record?.fields?.model?.id || null;
    if (!['iphone_17e_256gb','iphone_16e_128gb'].includes(modelId)) return false;
    const priceLine = sourceLine(record, 'price');
    if (!Number.isFinite(priceLine)) return false;

    const localField = (field, maxDistance) => {
      const value = record.fields?.[field];
      if (value == null) return true;
      const line = sourceLine(record, field);
      if (!Number.isFinite(line)) return false;
      const distance = Math.abs(priceLine - line);
      const boundaries = pathBoundaries(line, priceLine);
      return distance <= maxDistance &&
        !boundaries.has('domain') &&
        !boundaries.has('supplier') &&
        !boundaries.has('timestamp');
    };

    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    const directPrice =
      (priceTrace?.rules || []).includes('direct_extraction') &&
      sourceLine(record, 'price') === priceLine;
    const supplierLine = sourceLine(record, 'supplier');
    const supplierBoundaries = pathBoundaries(supplierLine, priceLine);
    const supplierLocal =
      Number.isFinite(supplierLine) &&
      !supplierBoundaries.has('supplier') &&
      !supplierBoundaries.has('timestamp');

    return directPrice &&
      localField('model', 6) &&
      localField('color', 3) &&
      localField('condition', 6) &&
      supplierLocal;
  };

  let candidatePairs = 0;
  let missingOverlap = 0;
  let extraOverlap = 0;
  let bothOverlap = 0;
  let additionalMissingCoverage = 0;
  let additionalExtraCoverage = 0;
  let fullyAdditionalPairs = 0;
  let unresolvedCoreRecord = 0;

  for (const miss of missing) {
    const expected = norm(miss);
    let best = null;
    for (let index = 0; index < extra.length; index += 1) {
      if (usedExtra.has(index)) continue;
      const actual = norm(extra[index]);
      if (actual.model !== expected.model || actual.capacity !== expected.capacity) continue;
      const diffs = diffFields(expected, actual);
      if (diffs.length < 3 || !diffs.includes('price') || !diffs.includes('supplier')) continue;
      if (!best || diffs.length < best.diffs.length) best = { index, diffs };
    }
    if (!best) continue;

    usedExtra.add(best.index);
    const extraOffer = extra[best.index];
    const key = offerKey(extraOffer.fields || {}, { include_supplier: true });
    const bucket = coreBuckets.get(key) || [];
    const offset = consumedCore.get(key) || 0;
    const record = bucket[offset] || null;
    consumedCore.set(key, offset + 1);
    if (!record) {
      unresolvedCoreRecord += 1;
      continue;
    }

    const priceLine = sourceLine(record, 'price');
    const supplierLine = sourceLine(record, 'supplier');
    const modelLine = sourceLine(record, 'model');
    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    if (!Number.isFinite(priceLine)) continue;

    const supplierDistance = Number.isFinite(supplierLine)
      ? Math.abs(priceLine - supplierLine)
      : null;
    const modelDistance = Number.isFinite(modelLine)
      ? Math.abs(priceLine - modelLine)
      : null;
    const supplierBoundaries = pathBoundaries(supplierLine, priceLine);
    const modelBoundaries = pathBoundaries(modelLine, priceLine);
    const expectedSupplierNearest = supplierEvidenceLines(expected.supplier)
      .map(line => ({ line, distance: Math.abs(priceLine - line) }))
      .sort((a, b) => a.distance - b.distance || a.line - b.line)[0] || null;
    const expectedSupplierBoundaries =
      pathBoundaries(expectedSupplierNearest?.line, priceLine);

    const directPrice = (priceTrace?.rules || []).includes('direct_extraction');
    const modelLocal =
      Number.isFinite(modelDistance) &&
      modelDistance <= 6 &&
      !modelBoundaries.has('domain') &&
      !modelBoundaries.has('supplier') &&
      !modelBoundaries.has('timestamp');
    const supplierLocal =
      Number.isFinite(supplierDistance) &&
      !supplierBoundaries.has('supplier') &&
      !supplierBoundaries.has('timestamp');
    const legacySupplierStale =
      expectedSupplierNearest &&
      Number.isFinite(supplierDistance) &&
      expectedSupplierNearest.distance > supplierDistance &&
      (
        expectedSupplierBoundaries.has('supplier') ||
        expectedSupplierBoundaries.has('timestamp')
      );

    if (!(directPrice && modelLocal && supplierLocal && legacySupplierStale)) continue;
    candidatePairs += 1;

    const mOverlap = missingAlreadyContradicted(miss);
    const eOverlap = extraAlreadySourceSupportedE(record);
    if (mOverlap) missingOverlap += 1;
    else additionalMissingCoverage += 1;
    if (eOverlap) extraOverlap += 1;
    else additionalExtraCoverage += 1;
    if (mOverlap && eOverlap) bothOverlap += 1;
    if (!mOverlap && !eOverlap) fullyAdditionalPairs += 1;
  }

  return {
    candidate_pairs: candidatePairs,
    overlap_with_source_contradicted_missing: missingOverlap,
    overlap_with_source_supported_e_extra: extraOverlap,
    overlap_on_both_sides: bothOverlap,
    additional_missing_coverage: additionalMissingCoverage,
    additional_extra_coverage: additionalExtraCoverage,
    fully_additional_pairs: fullyAdditionalPairs,
    unresolved_core_record: unresolvedCoreRecord,
    status: 'diagnostic_only_not_promotion_counted'
  };
}

const mixedResidualOverlapCoverageDiagnostic =
  mixedResidualOverlapCoverageDiagnostics(reportSupplierAware, coreBundle);

function residualAdjudicationLedgerDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const expand = (items, prefix) => {
    const out = [];
    for (const item of items || []) {
      const count = Number(item.count || 0);
      for (let i = 0; i < count; i += 1) {
        out.push({ id: prefix + out.length, fields: item.fields || {} });
      }
    }
    return out;
  };

  const missing = expand(reportSupplierAware.missing, 'm');
  const extra = expand(reportSupplierAware.extra, 'e');
  const consumedMissing = new Set();
  const consumedExtra = new Set();
  const segments = bundle.segments || [];
  const records = coreOffers(bundle);
  const segmentByLine = new Map(segments.map(segment => [Number(segment.line_number), segment]));

  const norm = offer => {
    const fields = offer?.fields || {};
    return {
      model: fields.model?.id || null,
      supplier: fields.supplier == null ? null : String(fields.supplier),
      capacity: fields.capacity_gb == null ? null : Number(fields.capacity_gb),
      condition: normalizeKey(fields.condition) || null,
      color: normalizeKey(fields.color) || null,
      price: fields.price == null ? null : Number(fields.price)
    };
  };
  const diffFields = (a, b) =>
    ['supplier','capacity','condition','color','price'].filter(field => a[field] !== b[field]);
  const sourceLine = (record, field) => {
    const trace = (record?.trace || []).find(item => item.field === field);
    return Array.isArray(trace?.sources) && trace.sources.length
      ? Number(trace.sources[0])
      : null;
  };
  const pathBoundaries = (fromLine, toLine) => {
    const out = new Set();
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return out;
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      for (const event of segment.context_events || []) {
        if (event.reason === 'timestamp_boundary') out.add('timestamp');
        if (event.reason === 'domain_boundary') out.add('domain');
        if (event.reason === 'supplier_boundary') out.add('supplier');
      }
    }
    return out;
  };
  const supplierAt = segment => {
    const direct = [...new Set(
      (segment?.field_candidates || [])
        .filter(candidate => candidate.field === 'supplier')
        .map(candidate => String(candidate.value))
    )];
    if (direct.length === 1) return direct[0];
    return segment?.inherited_context?.supplier?.value == null
      ? null
      : String(segment.inherited_context.supplier.value);
  };
  const supplierEvidenceLines = supplier => {
    if (!supplier) return [];
    return segments
      .filter(segment => (segment.field_candidates || []).some(candidate =>
        candidate.field === 'supplier' && String(candidate.value) === String(supplier)
      ))
      .map(segment => Number(segment.line_number))
      .filter(Number.isFinite);
  };
  const nearestSupplier = (supplier, priceLine) =>
    supplierEvidenceLines(supplier)
      .map(line => ({ line, distance: Math.abs(priceLine - line) }))
      .sort((a, b) => a.distance - b.distance || a.line - b.line)[0] || null;

  const legacyCounts = new Map();
  for (const offer of legacySupplierAware?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }
  const coreByKey = new Map();
  for (const record of records) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreByKey.has(key)) coreByKey.set(key, []);
    coreByKey.get(key).push(record);
  }
  const recordForExtra = entry => {
    const key = offerKey(entry.fields || {}, { include_supplier: true });
    const bucket = coreByKey.get(key) || [];
    const supported = Math.min(legacyCounts.get(key) || 0, bucket.length);
    return bucket[supported] || null;
  };

  const categories = {};
  const mark = (name, mId = null, eId = null) => {
    if (!categories[name]) categories[name] = { missing: 0, extra: 0, pairs: 0 };
    if (mId != null) {
      consumedMissing.add(mId);
      categories[name].missing += 1;
    }
    if (eId != null) {
      consumedExtra.add(eId);
      categories[name].extra += 1;
    }
    if (mId != null && eId != null) categories[name].pairs += 1;
  };

  const missingSourceContradicted = entry => {
    const item = entry;
    const model = item.fields?.model?.id || null;
    const supplier = String(item.fields?.supplier ?? '');
    const price = Number(item.fields?.price);
    if (!model || !Number.isFinite(price)) return false;

    if (model === 'iphone_16_256gb') {
      const sameSupplierPriceRecords = records.filter(record =>
        String(record.fields?.supplier ?? '') === supplier &&
        Number(record.fields?.price) === price
      );
      if (!sameSupplierPriceRecords.length) return false;
      return sameSupplierPriceRecords.every(record => {
        const modelLine = sourceLine(record, 'model');
        const segment = Number.isFinite(modelLine) ? segmentByLine.get(modelLine) : null;
        return /\bpro\s*max\b/i.test(String(segment?.normalized || ''));
      });
    }

    if (model === 'iphone_17_512gb') {
      const priceSegments = segments.filter(segment =>
        supplierAt(segment) === supplier &&
        (segment.field_candidates || []).some(candidate =>
          candidate.field === 'price' && Number(candidate.value) === price
        )
      );
      if (!priceSegments.length) return false;
      return priceSegments.every(priceSegment => {
        const priceLine = Number(priceSegment.line_number);
        const nearestAnchor = segments
          .filter(segment =>
            Number(segment.line_number) < priceLine &&
            (segment.field_candidates || []).some(candidate => candidate.field === 'model')
          )
          .sort((a, b) => Number(b.line_number) - Number(a.line_number))[0] || null;
        if (!nearestAnchor) return false;
        const shapes = [...new Set(
          (nearestAnchor.field_candidates || [])
            .filter(candidate => candidate.field === 'model')
            .map(candidate => iphoneModelShape(candidate.value))
            .filter(Boolean)
        )];
        const semanticIds = [...new Set(
          (nearestAnchor.semantic_candidates || [])
            .filter(candidate => candidate.field === 'model' && candidate.entity_id)
            .map(candidate => candidate.entity_id)
        )];
        return shapes.length > 0 &&
          shapes.every(shape => /^17\|(?:pro|pro max)\|(?:256|512)$/.test(shape)) &&
          !semanticIds.includes('iphone_17_512gb');
      });
    }
    return false;
  };

  const fullLocalEExtra = (entry, record) => {
    const modelId = record?.fields?.model?.id || null;
    if (!['iphone_17e_256gb','iphone_16e_128gb'].includes(modelId)) return false;
    const priceLine = sourceLine(record, 'price');
    if (!Number.isFinite(priceLine)) return false;

    const localField = (field, maxDistance) => {
      const value = record.fields?.[field];
      if (value == null) return true;
      const line = sourceLine(record, field);
      if (!Number.isFinite(line)) return false;
      const boundaries = pathBoundaries(line, priceLine);
      return Math.abs(priceLine - line) <= maxDistance &&
        !boundaries.has('domain') &&
        !boundaries.has('supplier') &&
        !boundaries.has('timestamp');
    };
    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    const supplierLine = sourceLine(record, 'supplier');
    const supplierBoundaries = pathBoundaries(supplierLine, priceLine);
    return (priceTrace?.rules || []).includes('direct_extraction') &&
      localField('model', 6) &&
      localField('color', 3) &&
      localField('condition', 6) &&
      Number.isFinite(supplierLine) &&
      !supplierBoundaries.has('supplier') &&
      !supplierBoundaries.has('timestamp');
  };

  for (const miss of missing) {
    if (missingSourceContradicted(miss)) mark('source_contradicted_missing', miss.id, null);
  }
  for (const ex of extra) {
    const record = recordForExtra(ex);
    if (record && fullLocalEExtra(ex, record)) mark('source_supported_core_only_e', null, ex.id);
  }

  const availableMissing = () => missing.filter(item => !consumedMissing.has(item.id));
  const availableExtra = () => extra.filter(item => !consumedExtra.has(item.id));

  const pairAndQualify = (name, pairPredicate, qualifier) => {
    for (const miss of availableMissing()) {
      const expected = norm(miss);
      let chosen = null;
      for (const ex of availableExtra()) {
        const actual = norm(ex);
        if (!pairPredicate(expected, actual)) continue;
        const record = recordForExtra(ex);
        if (!record) continue;
        if (!qualifier({ miss, ex, expected, actual, record })) continue;
        chosen = ex;
        break;
      }
      if (chosen) mark(name, miss.id, chosen.id);
    }
  };

  pairAndQualify(
    'source_contradicted_pure_supplier',
    (a, b) =>
      a.model === b.model &&
      a.capacity === b.capacity &&
      a.condition === b.condition &&
      a.color === b.color &&
      a.price === b.price &&
      a.supplier !== b.supplier,
    ({ expected, actual, record }) => {
      const priceLine = sourceLine(record, 'price');
      const actualSupplierLine = sourceLine(record, 'supplier');
      if (!Number.isFinite(priceLine) || !Number.isFinite(actualSupplierLine)) return false;
      const expectedNearest = nearestSupplier(expected.supplier, priceLine);
      if (!expectedNearest) return false;
      const actualDistance = Math.abs(priceLine - actualSupplierLine);
      const actualBoundaries = pathBoundaries(actualSupplierLine, priceLine);
      const expectedBoundaries = pathBoundaries(expectedNearest.line, priceLine);
      return expectedNearest.distance > actualDistance &&
        expectedBoundaries.has('supplier') &&
        expectedBoundaries.has('timestamp') &&
        !actualBoundaries.has('supplier') &&
        !actualBoundaries.has('timestamp');
    }
  );

  pairAndQualify(
    'source_unsupported_pure_condition',
    (a, b) =>
      a.model === b.model &&
      a.supplier === b.supplier &&
      a.capacity === b.capacity &&
      a.color === b.color &&
      a.price === b.price &&
      a.condition != null &&
      b.condition == null,
    ({ expected, record }) => {
      const priceLine = sourceLine(record, 'price') ?? sourceLine(record, 'model');
      if (!Number.isFinite(priceLine)) return false;
      const matchingLines = [];
      for (const segment of segments) {
        const effectiveSupplier = supplierAt(segment);
        if (effectiveSupplier !== expected.supplier) continue;
        for (const candidate of segment.field_candidates || []) {
          if (candidate.field !== 'condition') continue;
          const mapped = schema.fields.find(field => field.name === 'condition')?.value_map || {};
          const canonical = mapped[candidate.value] || mapped[String(candidate.value)] || candidate.value;
          if (normalizeKey(canonical) === expected.condition) {
            matchingLines.push(Number(segment.line_number));
          }
        }
      }
      const nearest = matchingLines
        .filter(Number.isFinite)
        .map(line => ({ line, distance: Math.abs(priceLine - line) }))
        .sort((a, b) => a.distance - b.distance || a.line - b.line)[0] || null;
      if (!nearest) return true;
      let modelAnchors = 0;
      const boundaries = pathBoundaries(nearest.line, priceLine);
      const lo = Math.min(nearest.line, priceLine);
      const hi = Math.max(nearest.line, priceLine);
      for (const segment of segments) {
        const line = Number(segment.line_number);
        if (line > lo && line <= hi &&
            (segment.field_candidates || []).some(candidate => candidate.field === 'model')) {
          modelAnchors += 1;
        }
      }
      return nearest.distance >= 100 &&
        modelAnchors >= 20 &&
        boundaries.has('domain') &&
        boundaries.has('supplier');
    }
  );

  pairAndQualify(
    'source_contradicted_price_supplier',
    (a, b) => {
      if (a.model !== b.model) return false;
      const diffs = diffFields(a, b);
      return diffs.length === 2 && diffs.includes('price') && diffs.includes('supplier');
    },
    ({ expected, record }) => {
      const priceLine = sourceLine(record, 'price');
      const supplierLine = sourceLine(record, 'supplier');
      if (!Number.isFinite(priceLine) || !Number.isFinite(supplierLine)) return false;
      const priceTrace = (record.trace || []).find(item => item.field === 'price');
      const supplierPath = pathBoundaries(supplierLine, priceLine);
      const expectedSupplier = nearestSupplier(expected.supplier, priceLine);
      const expectedSupplierPath = pathBoundaries(expectedSupplier?.line, priceLine);

      const expectedPriceLines = segments
        .filter(segment => (segment.field_candidates || []).some(candidate =>
          candidate.field === 'price' && Number(candidate.value) === expected.price
        ))
        .map(segment => Number(segment.line_number))
        .filter(Number.isFinite);
      const expectedPrice = expectedPriceLines
        .map(line => ({ line, distance: Math.abs(priceLine - line) }))
        .sort((a, b) => a.distance - b.distance || a.line - b.line)[0] || null;
      const expectedPricePath = pathBoundaries(expectedPrice?.line, priceLine);
      let modelAnchors = 0;
      if (expectedPrice) {
        const lo = Math.min(expectedPrice.line, priceLine);
        const hi = Math.max(expectedPrice.line, priceLine);
        modelAnchors = segments.filter(segment => {
          const line = Number(segment.line_number);
          return line > lo && line <= hi &&
            (segment.field_candidates || []).some(candidate => candidate.field === 'model');
        }).length;
      }

      const actualDistance = Math.abs(priceLine - supplierLine);
      const actualLocal =
        actualDistance <= 200 &&
        !supplierPath.has('supplier') &&
        !supplierPath.has('timestamp');
      const expectedPriceUnsupported =
        !expectedPrice ||
        (
          expectedPrice.distance > 3 &&
          (
            modelAnchors > 0 ||
            expectedPricePath.has('domain') ||
            expectedPricePath.has('supplier') ||
            expectedPricePath.has('timestamp')
          )
        );
      const expectedSupplierUnsupported =
        !expectedSupplier ||
        (
          expectedSupplier.distance > actualDistance &&
          (expectedSupplierPath.has('supplier') || expectedSupplierPath.has('timestamp'))
        );
      return (priceTrace?.rules || []).includes('direct_extraction') &&
        actualLocal &&
        expectedPriceUnsupported &&
        expectedSupplierUnsupported;
    }
  );

  pairAndQualify(
    'source_contradicted_mixed_price_supplier',
    (a, b) => {
      if (a.model !== b.model || a.capacity !== b.capacity) return false;
      const diffs = diffFields(a, b);
      return diffs.length >= 3 && diffs.includes('price') && diffs.includes('supplier');
    },
    ({ expected, record }) => {
      const priceLine = sourceLine(record, 'price');
      const supplierLine = sourceLine(record, 'supplier');
      const modelLine = sourceLine(record, 'model');
      if (!Number.isFinite(priceLine) || !Number.isFinite(supplierLine) || !Number.isFinite(modelLine)) {
        return false;
      }
      const priceTrace = (record.trace || []).find(item => item.field === 'price');
      const supplierDistance = Math.abs(priceLine - supplierLine);
      const modelDistance = Math.abs(priceLine - modelLine);
      const supplierPath = pathBoundaries(supplierLine, priceLine);
      const modelPath = pathBoundaries(modelLine, priceLine);
      const expectedSupplier = nearestSupplier(expected.supplier, priceLine);
      const expectedPath = pathBoundaries(expectedSupplier?.line, priceLine);
      const optionalFieldLocal = (field, maxDistance) => {
        if (record.fields?.[field] == null) return true;
        const line = sourceLine(record, field);
        if (!Number.isFinite(line)) return false;
        const boundaries = pathBoundaries(line, priceLine);
        return Math.abs(priceLine - line) <= maxDistance &&
          !boundaries.has('domain') &&
          !boundaries.has('supplier') &&
          !boundaries.has('timestamp');
      };

      return (priceTrace?.rules || []).includes('direct_extraction') &&
        modelDistance <= 6 &&
        !modelPath.has('domain') &&
        !modelPath.has('supplier') &&
        !modelPath.has('timestamp') &&
        optionalFieldLocal('color', 3) &&
        optionalFieldLocal('condition', 6) &&
        !supplierPath.has('supplier') &&
        !supplierPath.has('timestamp') &&
        expectedSupplier &&
        expectedSupplier.distance > supplierDistance &&
        (expectedPath.has('supplier') || expectedPath.has('timestamp'));
    }
  );

  const remainingMissing = availableMissing();
  const remainingExtra = availableExtra();
  const remainingPairSignatures = {};
  const usedRemainingExtra = new Set();

  for (const miss of remainingMissing) {
    const expected = norm(miss);
    let best = null;
    for (const ex of remainingExtra) {
      if (usedRemainingExtra.has(ex.id)) continue;
      const actual = norm(ex);
      if (actual.model !== expected.model) continue;
      const diffs = diffFields(expected, actual);
      if (!best || diffs.length < best.diffs.length) best = { ex, diffs };
    }
    if (!best) continue;
    usedRemainingExtra.add(best.ex.id);
    const key = best.diffs.slice().sort().join('+') || 'exact';
    remainingPairSignatures[key] = (remainingPairSignatures[key] || 0) + 1;
  }

  return {
    raw: { missing: missing.length, extra: extra.length },
    covered: {
      missing: consumedMissing.size,
      extra: consumedExtra.size
    },
    remaining: {
      missing: remainingMissing.length,
      extra: remainingExtra.length,
      total: remainingMissing.length + remainingExtra.length
    },
    categories,
    remaining_pair_signatures: Object.entries(remainingPairSignatures)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {}),
    promotion_counted: false,
    mixed_offer_locality: 'model<=6,color<=3,condition<=6,price=direct,supplier=no-hard-boundary',
    status: 'global_unique_consumption_diagnostic'
  };
}

const residualAdjudicationLedgerDiagnostic =
  residualAdjudicationLedgerDiagnostics(reportSupplierAware, coreBundle);

function buildResidualAdjudicationLedger(reportSupplierAware, bundle, options = {}) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extras = expand(reportSupplierAware.extra);
  const segments = bundle.segments || [];
  const records = coreOffers(bundle);
  const segmentByLine = new Map(
    segments.map(segment => [Number(segment.line_number), segment])
  );

  const norm = offer => {
    const fields = offer?.fields || {};
    return {
      model: fields.model?.id || null,
      supplier: fields.supplier == null ? null : String(fields.supplier),
      capacity: fields.capacity_gb == null ? null : Number(fields.capacity_gb),
      condition: normalizeKey(fields.condition) || null,
      color: normalizeKey(fields.color) || null,
      price: fields.price == null ? null : Number(fields.price)
    };
  };
  const diffFields = (a, b) =>
    ['supplier','capacity','condition','color','price'].filter(field => a[field] !== b[field]);
  const sourceLine = (record, field) => {
    const trace = (record?.trace || []).find(item => item.field === field);
    return Array.isArray(trace?.sources) && trace.sources.length
      ? Number(trace.sources[0])
      : null;
  };
  const pathBoundaries = (fromLine, toLine) => {
    const out = new Set();
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return out;
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      for (const event of segment.context_events || []) {
        if (event.reason === 'timestamp_boundary') out.add('timestamp');
        if (event.reason === 'domain_boundary') out.add('domain');
        if (event.reason === 'supplier_boundary') out.add('supplier');
      }
    }
    return out;
  };
  const supplierAt = segment => {
    const direct = [...new Set(
      (segment?.field_candidates || [])
        .filter(candidate => candidate.field === 'supplier')
        .map(candidate => String(candidate.value))
    )];
    if (direct.length === 1) return direct[0];
    return segment?.inherited_context?.supplier?.value == null
      ? null
      : String(segment.inherited_context.supplier.value);
  };
  const supplierEvidenceLines = supplier => {
    if (!supplier) return [];
    return segments
      .filter(segment => (segment.field_candidates || []).some(candidate =>
        candidate.field === 'supplier' && String(candidate.value) === String(supplier)
      ))
      .map(segment => Number(segment.line_number))
      .filter(Number.isFinite);
  };
  const fieldLines = (field, predicate) =>
    segments
      .filter(segment => (segment.field_candidates || []).some(candidate =>
        candidate.field === field && predicate(candidate.value)
      ))
      .map(segment => Number(segment.line_number))
      .filter(Number.isFinite);
  const nearest = (lines, targetLine) =>
    lines
      .map(line => ({ line, distance: Math.abs(line - targetLine) }))
      .sort((a, b) => a.distance - b.distance || a.line - b.line)[0] || null;

  const legacyCounts = new Map();
  for (const offer of legacySupplierAware?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }
  const coreByKey = new Map();
  for (const record of records) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreByKey.has(key)) coreByKey.set(key, []);
    coreByKey.get(key).push(record);
  }
  const surplusCoreByKey = new Map();
  for (const [key, bucket] of coreByKey.entries()) {
    surplusCoreByKey.set(key, bucket.slice(legacyCounts.get(key) || 0));
  }
  const surplusOffsets = new Map();
  const extraRecord = index => {
    const extra = extras[index];
    if (!extra) return null;
    const key = offerKey(extra.fields || {}, { include_supplier: true });
    const bucket = surplusCoreByKey.get(key) || [];
    const offset = surplusOffsets.get(key) || 0;
    const record = bucket[offset] || null;
    surplusOffsets.set(key, offset + 1);
    return record;
  };
  const extraRecords = extras.map((_, index) => extraRecord(index));

  const claimedMissing = new Set();
  const claimedExtra = new Set();
  const categories = {};
  const claim = (category, missingIndex = null, extraIndex = null) => {
    if (!categories[category]) categories[category] = { missing: 0, extra: 0, pairs: 0 };
    if (missingIndex != null) {
      if (claimedMissing.has(missingIndex)) return false;
      claimedMissing.add(missingIndex);
      categories[category].missing += 1;
    }
    if (extraIndex != null) {
      if (claimedExtra.has(extraIndex)) {
        if (missingIndex != null) {
          claimedMissing.delete(missingIndex);
          categories[category].missing -= 1;
        }
        return false;
      }
      claimedExtra.add(extraIndex);
      categories[category].extra += 1;
    }
    if (missingIndex != null && extraIndex != null) categories[category].pairs += 1;
    return true;
  };

  // 1. Missing legado contradito por modelo explicitamente diferente na fonte.
  for (let missingIndex = 0; missingIndex < missing.length; missingIndex += 1) {
    const item = missing[missingIndex];
    const model = item.fields?.model?.id || null;
    const supplier = String(item.fields?.supplier ?? '');
    const price = Number(item.fields?.price);
    if (!model || !Number.isFinite(price)) continue;

    let qualifies = false;
    if (model === 'iphone_16_256gb') {
      const sameSupplierPriceRecords = records.filter(record =>
        String(record.fields?.supplier ?? '') === supplier &&
        Number(record.fields?.price) === price
      );
      qualifies = sameSupplierPriceRecords.length > 0 &&
        sameSupplierPriceRecords.every(record => {
          const line = sourceLine(record, 'model');
          const segment = Number.isFinite(line) ? segmentByLine.get(line) : null;
          return /\bpro\s*max\b/i.test(String(segment?.normalized || ''));
        });
    } else if (model === 'iphone_17_512gb') {
      const priceSegments = segments.filter(segment =>
        supplierAt(segment) === supplier &&
        (segment.field_candidates || []).some(candidate =>
          candidate.field === 'price' && Number(candidate.value) === price
        )
      );
      qualifies = priceSegments.length > 0 && priceSegments.every(priceSegment => {
        const priceLine = Number(priceSegment.line_number);
        const nearestAnchor = segments
          .filter(segment =>
            Number(segment.line_number) < priceLine &&
            (segment.field_candidates || []).some(candidate => candidate.field === 'model')
          )
          .sort((a, b) => Number(b.line_number) - Number(a.line_number))[0] || null;
        if (!nearestAnchor) return false;
        const shapes = [...new Set(
          (nearestAnchor.field_candidates || [])
            .filter(candidate => candidate.field === 'model')
            .map(candidate => iphoneModelShape(candidate.value))
            .filter(Boolean)
        )];
        const semanticIds = [...new Set(
          (nearestAnchor.semantic_candidates || [])
            .filter(candidate => candidate.field === 'model' && candidate.entity_id)
            .map(candidate => candidate.entity_id)
        )];
        return shapes.length > 0 &&
          shapes.every(shape => /^17\|(?:pro|pro max)\|(?:256|512)$/.test(shape)) &&
          !semanticIds.includes('iphone_17_512gb');
      });
    }
    if (qualifies) claim('source_contradicted_legacy_missing', missingIndex, null);
  }

  // 2. Extras Core-only com oferta completa sustentada localmente pela fonte.
  // Default V1 remains restricted to e-models. Simulation can broaden this
  // using the same strict semantic/locality evidence as the generic diagnostic.
  const targetEModels = new Set(['iphone_17e_256gb', 'iphone_16e_128gb']);
  const modelSemanticallySupportsRecord = (record, priceLine) => {
    const modelLine = sourceLine(record, 'model');
    if (!Number.isFinite(modelLine) || Math.abs(priceLine - modelLine) > 6) return false;
    const modelSegment = segmentByLine.get(modelLine);
    const modelId = record.fields?.model?.id || null;
    if (!modelSegment || !modelId) return false;
    return (modelSegment.semantic_candidates || []).some(candidate =>
      candidate.field === 'model' &&
      candidate.entity_id === modelId &&
      (candidate.state === 'interpreted' || candidate.state === 'inferred')
    );
  };
  const isLocalField = (record, field, priceLine, maxDistance) => {
    const value = record?.fields?.[field];
    if (value == null) return true;
    const line = sourceLine(record, field);
    if (!Number.isFinite(line)) return false;
    const distance = Math.abs(priceLine - line);
    const boundaries = pathBoundaries(line, priceLine);
    return distance <= maxDistance &&
      !boundaries.has('domain') &&
      !boundaries.has('supplier') &&
      !boundaries.has('timestamp');
  };
  for (let extraIndex = 0; extraIndex < extras.length; extraIndex += 1) {
    const record = extraRecords[extraIndex];
    if (!record) continue;
    const modelId = record.fields?.model?.id || null;
    const broadFullLocal = options.includeAllFullyLocalCoreOnly === true;
    if (!broadFullLocal && !targetEModels.has(modelId)) continue;
    const priceLine = sourceLine(record, 'price');
    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    const supplierLine = sourceLine(record, 'supplier');
    const supplierBoundaries = pathBoundaries(supplierLine, priceLine);
    const fullyLocal =
      (priceTrace?.rules || []).includes('direct_extraction') &&
      Number.isFinite(priceLine) &&
      isLocalField(record, 'model', priceLine, 6) &&
      (!broadFullLocal || modelSemanticallySupportsRecord(record, priceLine)) &&
      isLocalField(record, 'color', priceLine, 3) &&
      isLocalField(record, 'condition', priceLine, 6) &&
      Number.isFinite(supplierLine) &&
      !supplierBoundaries.has('supplier') &&
      !supplierBoundaries.has('timestamp');
    if (fullyLocal) claim('source_supported_core_only_full_offers', null, extraIndex);
  }

  const findUnclaimedExtra = predicate => {
    for (let extraIndex = 0; extraIndex < extras.length; extraIndex += 1) {
      if (claimedExtra.has(extraIndex)) continue;
      if (predicate(extraIndex, norm(extras[extraIndex]))) return extraIndex;
    }
    return -1;
  };

  // 3. Pares que diferem apenas em fornecedor, com fornecedor legado stale.
  for (let missingIndex = 0; missingIndex < missing.length; missingIndex += 1) {
    if (claimedMissing.has(missingIndex)) continue;
    const expected = norm(missing[missingIndex]);
    const extraIndex = findUnclaimedExtra((_, actual) =>
      expected.model === actual.model &&
      expected.capacity === actual.capacity &&
      expected.condition === actual.condition &&
      expected.color === actual.color &&
      expected.price === actual.price &&
      expected.supplier !== actual.supplier
    );
    if (extraIndex < 0) continue;
    const record = extraRecords[extraIndex];
    if (!record) continue;
    const priceLine = sourceLine(record, 'price');
    const actualSupplierLine = sourceLine(record, 'supplier');
    if (!Number.isFinite(priceLine) || !Number.isFinite(actualSupplierLine)) continue;
    const expectedNearest = nearest(supplierEvidenceLines(expected.supplier), priceLine);
    const actualDistance = Math.abs(priceLine - actualSupplierLine);
    const expectedBoundaries = pathBoundaries(expectedNearest?.line, priceLine);
    const actualBoundaries = pathBoundaries(actualSupplierLine, priceLine);
    const qualifies =
      expectedNearest &&
      expectedNearest.distance > actualDistance &&
      expectedBoundaries.has('supplier') &&
      expectedBoundaries.has('timestamp') &&
      !actualBoundaries.has('supplier') &&
      !actualBoundaries.has('timestamp');
    if (qualifies) claim('source_contradicted_legacy_supplier_pairs', missingIndex, extraIndex);
  }

  // 4. Condicao pura do legado sem suporte local suficiente.
  for (let missingIndex = 0; missingIndex < missing.length; missingIndex += 1) {
    if (claimedMissing.has(missingIndex)) continue;
    const expected = norm(missing[missingIndex]);
    if (!expected.condition) continue;
    const extraIndex = findUnclaimedExtra((_, actual) =>
      expected.model === actual.model &&
      expected.supplier === actual.supplier &&
      expected.capacity === actual.capacity &&
      expected.color === actual.color &&
      expected.price === actual.price &&
      actual.condition == null
    );
    if (extraIndex < 0) continue;
    const record = extraRecords[extraIndex];
    if (!record) continue;
    const priceLine = sourceLine(record, 'price') ?? sourceLine(record, 'model');
    if (!Number.isFinite(priceLine)) continue;

    const matchingConditionLines = [];
    for (const segment of segments) {
      if (supplierAt(segment) !== expected.supplier) continue;
      for (const candidate of segment.field_candidates || []) {
        if (candidate.field !== 'condition') continue;
        const mapped = schema.fields.find(field => field.name === 'condition')?.value_map || {};
        const canonical = mapped[candidate.value] || mapped[String(candidate.value)] || candidate.value;
        if (normalizeKey(canonical) === expected.condition) {
          matchingConditionLines.push(Number(segment.line_number));
        }
      }
    }
    const nearestCondition = nearest(matchingConditionLines.filter(Number.isFinite), priceLine);
    let modelAnchorsBetween = 0;
    const boundaries = new Set();
    if (nearestCondition) {
      const lo = Math.min(nearestCondition.line, priceLine);
      const hi = Math.max(nearestCondition.line, priceLine);
      for (const segment of segments) {
        const line = Number(segment.line_number);
        if (!(line > lo && line <= hi)) continue;
        if ((segment.field_candidates || []).some(candidate => candidate.field === 'model')) {
          modelAnchorsBetween += 1;
        }
        for (const event of segment.context_events || []) {
          if (event.reason === 'domain_boundary') boundaries.add('domain');
          if (event.reason === 'supplier_boundary') boundaries.add('supplier');
          if (event.reason === 'timestamp_boundary') boundaries.add('timestamp');
        }
      }
    }
    const qualifies =
      !nearestCondition ||
      (
        nearestCondition.distance >= 100 &&
        modelAnchorsBetween >= 20 &&
        boundaries.has('domain') &&
        boundaries.has('supplier')
      );
    if (qualifies) claim('source_unsupported_legacy_pure_condition_pairs', missingIndex, extraIndex);
  }

  // 5. Diferenca pura de preco+fornecedor, com ambos os valores legados sem suporte local.
  for (let missingIndex = 0; missingIndex < missing.length; missingIndex += 1) {
    if (claimedMissing.has(missingIndex)) continue;
    const expected = norm(missing[missingIndex]);
    const extraIndex = findUnclaimedExtra((_, actual) => {
      if (actual.model !== expected.model) return false;
      const diffs = diffFields(expected, actual);
      return diffs.length === 2 && diffs.includes('price') && diffs.includes('supplier');
    });
    if (extraIndex < 0) continue;
    const record = extraRecords[extraIndex];
    if (!record) continue;
    const actualPriceLine = sourceLine(record, 'price');
    const actualSupplierLine = sourceLine(record, 'supplier');
    if (!Number.isFinite(actualPriceLine) || !Number.isFinite(actualSupplierLine)) continue;
    const priceTrace = (record.trace || []).find(item => item.field === 'price');

    const expectedPriceNearest = nearest(
      fieldLines('price', value => Number(value) === expected.price),
      actualPriceLine
    );
    const expectedSupplierNearest = nearest(
      supplierEvidenceLines(expected.supplier),
      actualPriceLine
    );
    const actualSupplierPath = pathBoundaries(actualSupplierLine, actualPriceLine);
    const expectedSupplierPath = pathBoundaries(expectedSupplierNearest?.line, actualPriceLine);
    const expectedPricePath = pathBoundaries(expectedPriceNearest?.line, actualPriceLine);

    let expectedPriceModelAnchors = 0;
    if (expectedPriceNearest) {
      const lo = Math.min(expectedPriceNearest.line, actualPriceLine);
      const hi = Math.max(expectedPriceNearest.line, actualPriceLine);
      for (const segment of segments) {
        const line = Number(segment.line_number);
        if (line > lo && line <= hi &&
            (segment.field_candidates || []).some(candidate => candidate.field === 'model')) {
          expectedPriceModelAnchors += 1;
        }
      }
    }

    const actualPriceDirect = (priceTrace?.rules || []).includes('direct_extraction');
    const actualSupplierLocal =
      Math.abs(actualPriceLine - actualSupplierLine) <= 200 &&
      !actualSupplierPath.has('supplier') &&
      !actualSupplierPath.has('timestamp');
    const expectedPriceUnsupported =
      !expectedPriceNearest ||
      (
        expectedPriceNearest.distance > 3 &&
        (
          expectedPriceModelAnchors > 0 ||
          expectedPricePath.has('domain') ||
          expectedPricePath.has('supplier') ||
          expectedPricePath.has('timestamp')
        )
      );
    const expectedSupplierUnsupported =
      !expectedSupplierNearest ||
      (
        expectedSupplierNearest.distance > Math.abs(actualPriceLine - actualSupplierLine) &&
        (expectedSupplierPath.has('supplier') || expectedSupplierPath.has('timestamp'))
      );
    if (actualPriceDirect && actualSupplierLocal &&
        expectedPriceUnsupported && expectedSupplierUnsupported) {
      claim('source_contradicted_legacy_price_supplier_pairs', missingIndex, extraIndex);
    }
  }

  // 6. SIMULATION ONLY: mixed residuals where every divergent Core field is
  // locally supported and the corresponding legacy value is not locally supported.
  // Disabled by default; this must not affect the promotion gate until explicitly promoted.
  if (options.includeStrongMixed === true) {
    const canonicalCandidateValue = (field, value) => {
      if (value == null) return null;
      if (field === 'condition') {
        const map = schema.fields.find(item => item.name === 'condition')?.value_map || {};
        return normalizeKey(map[value] || map[String(value)] || value) || null;
      }
      return normalizeKey(value) || null;
    };
    const evidenceLinesForValue = (field, value) =>
      segments
        .filter(segment => (segment.field_candidates || []).some(candidate =>
          candidate.field === field &&
          canonicalCandidateValue(field, candidate.value) === canonicalCandidateValue(field, value)
        ))
        .map(segment => Number(segment.line_number))
        .filter(Number.isFinite);

    for (let missingIndex = 0; missingIndex < missing.length; missingIndex += 1) {
      if (claimedMissing.has(missingIndex)) continue;
      const expected = norm(missing[missingIndex]);

      let best = null;
      for (let extraIndex = 0; extraIndex < extras.length; extraIndex += 1) {
        if (claimedExtra.has(extraIndex)) continue;
        const actual = norm(extras[extraIndex]);
        if (actual.model !== expected.model || actual.capacity !== expected.capacity) continue;
        const diffs = diffFields(expected, actual);
        if (diffs.length < 3 || !diffs.includes('price') || !diffs.includes('supplier')) continue;
        if (!best || diffs.length < best.diffs.length || (
          diffs.length === best.diffs.length && extraIndex < best.extraIndex
        )) {
          best = { extraIndex, diffs, actual };
        }
      }
      if (!best) continue;

      const record = extraRecords[best.extraIndex];
      if (!record) continue;
      const priceLine = sourceLine(record, 'price');
      const modelLine = sourceLine(record, 'model');
      const supplierLine = sourceLine(record, 'supplier');
      if (!Number.isFinite(priceLine)) continue;

      const priceTrace = (record.trace || []).find(item => item.field === 'price');
      const modelPath = pathBoundaries(modelLine, priceLine);
      const supplierPath = pathBoundaries(supplierLine, priceLine);
      const priceDirect = (priceTrace?.rules || []).includes('direct_extraction');
      const modelLocal =
        Number.isFinite(modelLine) &&
        Math.abs(priceLine - modelLine) <= 6 &&
        !modelPath.has('domain') &&
        !modelPath.has('supplier') &&
        !modelPath.has('timestamp');
      const supplierLocal =
        Number.isFinite(supplierLine) &&
        !supplierPath.has('supplier') &&
        !supplierPath.has('timestamp');

      let divergentOptionalFieldsSupported = true;
      for (const field of ['color', 'condition']) {
        if (!best.diffs.includes(field)) continue;
        const actualLine = sourceLine(record, field);
        const maxDistance = field === 'color' ? 3 : 6;
        const actualPath = pathBoundaries(actualLine, priceLine);
        const actualLocal =
          Number.isFinite(actualLine) &&
          Math.abs(priceLine - actualLine) <= maxDistance &&
          !actualPath.has('domain') &&
          !actualPath.has('supplier') &&
          !actualPath.has('timestamp');

        const expectedNearest = nearest(
          evidenceLinesForValue(field, expected[field]),
          priceLine
        );
        const expectedPath = pathBoundaries(expectedNearest?.line, priceLine);
        const expectedUnsupported =
          !expectedNearest ||
          expectedNearest.distance > maxDistance ||
          expectedPath.has('domain') ||
          expectedPath.has('supplier') ||
          expectedPath.has('timestamp');

        if (!(actualLocal && expectedUnsupported)) {
          divergentOptionalFieldsSupported = false;
          break;
        }
      }

      if (priceDirect && modelLocal && supplierLocal && divergentOptionalFieldsSupported) {
        claim(
          'source_supported_core_mixed_full_evidence_pairs',
          missingIndex,
          best.extraIndex
        );
      }
    }
  }

  // 7. SIMULATION ONLY: after pair adjudications have consumed their exact
  // instances, classify any remaining Core-only extras with complete local evidence.
  // This ordering preserves pair evidence instead of starving it with extra-only claims.
  if (options.includeAllFullyLocalCoreOnlyLate === true) {
    for (let extraIndex = 0; extraIndex < extras.length; extraIndex += 1) {
      if (claimedExtra.has(extraIndex)) continue;
      const record = extraRecords[extraIndex];
      if (!record) continue;

      const priceLine = sourceLine(record, 'price');
      const priceTrace = (record.trace || []).find(item => item.field === 'price');
      const supplierLine = sourceLine(record, 'supplier');
      const supplierBoundaries = pathBoundaries(supplierLine, priceLine);

      const fullyLocal =
        Number.isFinite(priceLine) &&
        (priceTrace?.rules || []).includes('direct_extraction') &&
        isLocalField(record, 'model', priceLine, 6) &&
        modelSemanticallySupportsRecord(record, priceLine) &&
        isLocalField(record, 'color', priceLine, 3) &&
        isLocalField(record, 'condition', priceLine, 6) &&
        Number.isFinite(supplierLine) &&
        !supplierBoundaries.has('supplier') &&
        !supplierBoundaries.has('timestamp');

      if (fullyLocal) {
        claim('source_supported_core_only_full_offers_late', null, extraIndex);
      }
    }
  }

  // 8. SIMULATION ONLY: a legacy missing offer is source-unsupported when its
  // own expected supplier+price locus cannot support the required model or the
  // expected non-inheritable color inside the same safe locality used by Core.
  // Condition is deliberately excluded because it may be section-scoped.
  if (options.includeSourceUnsupportedMissing === true) {
    const conditionMap = schema.fields.find(item => item.name === 'condition')?.value_map || {};
    const canonicalForField = (field, value) => {
      if (value == null) return null;
      if (field === 'condition') {
        return normalizeKey(conditionMap[value] || conditionMap[String(value)] || value) || null;
      }
      return normalizeKey(value) || null;
    };

    for (let missingIndex = 0; missingIndex < missing.length; missingIndex += 1) {
      if (claimedMissing.has(missingIndex)) continue;
      const expected = norm(missing[missingIndex]);

      const priceSegments = segments.filter(segment =>
        String(supplierAt(segment) ?? '') === String(expected.supplier ?? '') &&
        (segment.field_candidates || []).some(candidate =>
          candidate.field === 'price' && Number(candidate.value) === expected.price
        )
      );

      let modelSupported = false;
      let colorSupported = expected.color == null;

      for (const priceSegment of priceSegments) {
        const priceLine = Number(priceSegment.line_number);

        const localModel = segments.some(segment => {
          const line = Number(segment.line_number);
          if (!Number.isFinite(line) || line > priceLine || priceLine - line > 6) return false;
          const boundaries = pathBoundaries(line, priceLine);
          if (boundaries.has('domain') || boundaries.has('supplier') || boundaries.has('timestamp')) return false;
          return (segment.semantic_candidates || []).some(candidate =>
            candidate.field === 'model' &&
            candidate.entity_id === expected.model &&
            (candidate.state === 'interpreted' || candidate.state === 'inferred')
          );
        });
        if (localModel) modelSupported = true;

        if (expected.color != null) {
          const localColor = segments.some(segment => {
            const line = Number(segment.line_number);
            if (!Number.isFinite(line) || Math.abs(priceLine - line) > 3) return false;
            const boundaries = pathBoundaries(line, priceLine);
            if (boundaries.has('domain') || boundaries.has('supplier') || boundaries.has('timestamp')) return false;
            return (segment.field_candidates || []).some(candidate =>
              candidate.field === 'color' &&
              canonicalForField('color', candidate.value) === canonicalForField('color', expected.color)
            );
          });
          if (localColor) colorSupported = true;
        }
      }

      const unsupported =
        priceSegments.length === 0 ||
        !modelSupported ||
        !colorSupported;

      if (unsupported) {
        claim('source_unsupported_legacy_required_or_color_missing', missingIndex, null);
      }
    }
  }

  // 9. SIMULATION ONLY: claim a remaining missing/extra pair only when
  // every divergent field is locally supported on the Core side and locally
  // unsupported on the legacy side. No ties and no legacy-local wins allowed.
  if (options.includeStrictPairDominance === true) {
    const remainingMissing = () => missing
      .map((item, index) => ({ item, index }))
      .filter(({ index }) => !claimedMissing.has(index));
    const remainingExtra = () => extras
      .map((item, index) => ({ item, index }))
      .filter(({ index }) => !claimedExtra.has(index));

    const actualFieldLocalForPair = (record, field, priceLine) => {
      if (field === 'price') {
        const trace = (record.trace || []).find(item => item.field === 'price');
        return Number.isFinite(priceLine) &&
          (trace?.rules || []).includes('direct_extraction');
      }
      if (field === 'supplier') {
        const line = sourceLine(record, 'supplier');
        const boundaries = pathBoundaries(line, priceLine);
        return Number.isFinite(line) &&
          !boundaries.has('supplier') &&
          !boundaries.has('timestamp');
      }
      if (field === 'color') return isLocalField(record, 'color', priceLine, 3);
      if (field === 'condition') return isLocalField(record, 'condition', priceLine, 6);
      return false;
    };

    const conditionValueMapForPair =
      schema.fields.find(item => item.name === 'condition')?.value_map || {};
    const canonicalPairValue = (field, value) => {
      if (value == null) return null;
      if (field === 'condition') {
        return normalizeKey(
          conditionValueMapForPair[value] ||
          conditionValueMapForPair[String(value)] ||
          value
        ) || null;
      }
      return normalizeKey(value) || null;
    };

    const expectedFieldLocalForPair = (expected, field, priceLine) => {
      if (!Number.isFinite(priceLine)) return false;
      if (field === 'price') {
        return segments.some(segment =>
          supplierAt(segment) === expected.supplier &&
          Number(segment.line_number) === priceLine &&
          (segment.field_candidates || []).some(candidate =>
            candidate.field === 'price' && Number(candidate.value) === expected.price
          )
        );
      }
      if (field === 'supplier') {
        return supplierAt(segmentByLine.get(priceLine)) === expected.supplier;
      }
      if (field !== 'color' && field !== 'condition') return false;

      const maxDistance = field === 'color' ? 3 : 6;
      const expectedValue = expected[field];
      if (expectedValue == null) return true;
      return segments.some(segment => {
        const line = Number(segment.line_number);
        if (!Number.isFinite(line) || Math.abs(priceLine - line) > maxDistance) return false;
        const boundaries = pathBoundaries(line, priceLine);
        if (boundaries.has('domain') || boundaries.has('supplier') || boundaries.has('timestamp')) return false;
        if (supplierAt(segment) !== expected.supplier) return false;
        return (segment.field_candidates || []).some(candidate =>
          candidate.field === field &&
          canonicalPairValue(field, candidate.value) ===
            canonicalPairValue(field, expectedValue)
        );
      });
    };

    const usedExtra = new Set();
    for (const { item: miss, index: missingIndex } of remainingMissing()) {
      const expected = norm(miss);
      let best = null;

      for (const { item: ex, index: extraIndex } of remainingExtra()) {
        if (usedExtra.has(extraIndex)) continue;
        const actual = norm(ex);
        if (actual.model !== expected.model || actual.capacity !== expected.capacity) continue;
        const diffs = diffFields(expected, actual);
        if (!diffs.length || diffs.includes('capacity')) continue;
        if (!best || diffs.length < best.diffs.length || (
          diffs.length === best.diffs.length && extraIndex < best.extraIndex
        )) {
          best = { extraIndex, diffs };
        }
      }
      if (!best) continue;

      const record = extraRecords[best.extraIndex];
      if (!record) continue;
      const priceLine = sourceLine(record, 'price');

      const fullyDominated = best.diffs.every(field =>
        actualFieldLocalForPair(record, field, priceLine) === true &&
        expectedFieldLocalForPair(expected, field, priceLine) === false
      );

      if (!fullyDominated) continue;
      if (claim('source_dominated_legacy_remaining_pair', missingIndex, best.extraIndex)) {
        usedExtra.add(best.extraIndex);
      }
    }
  }

  const expectedCategoryCounts = {
    source_contradicted_legacy_missing:
      sourceContradictedLegacyMissingDiagnostic?.source_contradicted_legacy_missing || 0,
    source_contradicted_legacy_supplier_pairs:
      sourceContradictedLegacySupplierResidualDiagnostic
        ?.source_contradicted_legacy_supplier_residuals || 0,
    source_supported_core_only_full_offers:
      sourceSupportedCoreOnlyEOfferDiagnostic?.fully_local_offer_evidence || 0,
    source_unsupported_legacy_pure_condition_pairs:
      sourceUnsupportedLegacyPureConditionDiagnostic
        ?.source_unsupported_legacy_condition_residuals || 0,
    source_contradicted_legacy_price_supplier_pairs:
      priceSupplierResidualEvidenceDiagnostic
        ?.source_contradicted_legacy_price_supplier_residuals || 0
  };
  const actualCategoryCounts = {
    source_contradicted_legacy_missing:
      categories.source_contradicted_legacy_missing?.missing || 0,
    source_contradicted_legacy_supplier_pairs:
      categories.source_contradicted_legacy_supplier_pairs?.pairs || 0,
    source_supported_core_only_full_offers:
      categories.source_supported_core_only_full_offers?.extra || 0,
    source_unsupported_legacy_pure_condition_pairs:
      categories.source_unsupported_legacy_pure_condition_pairs?.pairs || 0,
    source_contradicted_legacy_price_supplier_pairs:
      categories.source_contradicted_legacy_price_supplier_pairs?.pairs || 0
  };
  const parity = Object.keys(expectedCategoryCounts).every(
    key => expectedCategoryCounts[key] === actualCategoryCounts[key]
  );

  const actionableMissing = missing.length - claimedMissing.size;
  const actionableExtra = extras.length - claimedExtra.size;
  const missingConserved = claimedMissing.size + actionableMissing === missing.length;
  const extraConserved = claimedExtra.size + actionableExtra === extras.length;

  const remainingMissingIndexes = missing
    .map((_, index) => index)
    .filter(index => !claimedMissing.has(index));
  const remainingExtraIndexes = extras
    .map((_, index) => index)
    .filter(index => !claimedExtra.has(index));

  const countByModel = (items, indexes) => {
    const out = {};
    for (const index of indexes) {
      const model = items[index]?.fields?.model?.id || '(unknown)';
      out[model] = (out[model] || 0) + 1;
    }
    return Object.entries(out)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {});
  };

  const canonicalExpectedValue = (field, value) => {
    if (value == null) return null;
    if (field === 'condition') {
      const map = schema.fields.find(item => item.name === 'condition')?.value_map || {};
      return normalizeKey(map[value] || map[String(value)] || value) || null;
    }
    return normalizeKey(value) || null;
  };

  const candidateMatchesExpected = (candidate, field, expectedValue) =>
    candidate.field === field &&
    canonicalExpectedValue(field, candidate.value) === canonicalExpectedValue(field, expectedValue);

  const remainingMissingSourceSupport = {};
  for (const missingIndex of remainingMissingIndexes) {
    const expected = norm(missing[missingIndex]);
    const matchingPriceSegments = segments.filter(segment =>
      supplierAt(segment) === expected.supplier &&
      (segment.field_candidates || []).some(candidate =>
        candidate.field === 'price' && Number(candidate.value) === expected.price
      )
    );

    let fullLocalEvidence = false;
    const priceSupplierEvidence = matchingPriceSegments.length > 0;
    let localModelEvidence = false;
    let localColorEvidence = expected.color == null;
    let localConditionEvidence = expected.condition == null;

    for (const priceSegment of matchingPriceSegments) {
      const priceLine = Number(priceSegment.line_number);
      const modelOk = segments.some(segment => {
        const line = Number(segment.line_number);
        if (!Number.isFinite(line) || line > priceLine || priceLine - line > 6) return false;
        const boundaries = pathBoundaries(line, priceLine);
        if (boundaries.has('domain') || boundaries.has('supplier') || boundaries.has('timestamp')) return false;
        return (segment.semantic_candidates || []).some(candidate =>
          candidate.field === 'model' &&
          candidate.entity_id === expected.model &&
          (candidate.state === 'interpreted' || candidate.state === 'inferred')
        );
      });
      if (modelOk) localModelEvidence = true;

      const nearbyFieldOk = (field, expectedValue, maxDistance) => {
        if (expectedValue == null) return true;
        return segments.some(segment => {
          const line = Number(segment.line_number);
          if (!Number.isFinite(line) || Math.abs(priceLine - line) > maxDistance) return false;
          const boundaries = pathBoundaries(line, priceLine);
          if (boundaries.has('domain') || boundaries.has('supplier') || boundaries.has('timestamp')) return false;
          return (segment.field_candidates || []).some(candidate =>
            candidateMatchesExpected(candidate, field, expectedValue)
          );
        });
      };

      const colorOk = nearbyFieldOk('color', expected.color, 3);
      const conditionOk = nearbyFieldOk('condition', expected.condition, 6);
      if (colorOk) localColorEvidence = true;
      if (conditionOk) localConditionEvidence = true;
      if (modelOk && colorOk && conditionOk) {
        fullLocalEvidence = true;
        break;
      }
    }

    const signature = [
      'model=' + expected.model,
      'price_supplier=' + (priceSupplierEvidence ? 'yes' : 'no'),
      'model_local=' + (localModelEvidence ? 'yes' : 'no'),
      'color_local=' + (localColorEvidence ? 'yes' : 'no'),
      'condition_local=' + (localConditionEvidence ? 'yes' : 'no'),
      'full_local=' + (fullLocalEvidence ? 'yes' : 'no')
    ].join('|');
    remainingMissingSourceSupport[signature] =
      (remainingMissingSourceSupport[signature] || 0) + 1;
  }

  const remainingExtraLocality = {};
  for (const extraIndex of remainingExtraIndexes) {
    const record = extraRecords[extraIndex];
    if (!record) {
      remainingExtraLocality.unresolved_record =
        (remainingExtraLocality.unresolved_record || 0) + 1;
      continue;
    }
    const priceLine = sourceLine(record, 'price');
    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    const supplierLine = sourceLine(record, 'supplier');
    const supplierBoundaries = pathBoundaries(supplierLine, priceLine);
    const priceLocal =
      Number.isFinite(priceLine) &&
      (priceTrace?.rules || []).includes('direct_extraction');
    const modelLocal =
      priceLocal &&
      isLocalField(record, 'model', priceLine, 6) &&
      modelSemanticallySupportsRecord(record, priceLine);
    const colorLocal =
      priceLocal && isLocalField(record, 'color', priceLine, 3);
    const conditionLocal =
      priceLocal && isLocalField(record, 'condition', priceLine, 6);
    const supplierLocal =
      priceLocal &&
      Number.isFinite(supplierLine) &&
      !supplierBoundaries.has('supplier') &&
      !supplierBoundaries.has('timestamp');

    const signature = [
      'model=' + (record.fields?.model?.id || '(unknown)'),
      'price=' + (priceLocal ? 'local' : 'nonlocal'),
      'model_local=' + (modelLocal ? 'yes' : 'no'),
      'color_local=' + (colorLocal ? 'yes' : 'no'),
      'condition_local=' + (conditionLocal ? 'yes' : 'no'),
      'supplier_local=' + (supplierLocal ? 'yes' : 'no')
    ].join('|');
    remainingExtraLocality[signature] =
      (remainingExtraLocality[signature] || 0) + 1;
  }

  const conditionPathShape = (fromLine, toLine) => {
    const boundaries = new Set();
    let modelAnchors = 0;
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) {
      return { boundaries, modelAnchors };
    }
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      if ((segment.field_candidates || []).some(candidate => candidate.field === 'model')) {
        modelAnchors += 1;
      }
      for (const event of segment.context_events || []) {
        if (event.reason === 'domain_boundary') boundaries.add('domain');
        if (event.reason === 'supplier_boundary') boundaries.add('supplier');
        if (event.reason === 'timestamp_boundary') boundaries.add('timestamp');
      }
    }
    return { boundaries, modelAnchors };
  };

  const conditionCandidateLines = (condition, supplier) => {
    if (condition == null) return [];
    return segments
      .filter(segment => {
        const effectiveSupplier = supplierAt(segment);
        if (String(effectiveSupplier ?? '') !== String(supplier ?? '')) return false;
        return (segment.field_candidates || []).some(candidate =>
          candidateMatchesExpected(candidate, 'condition', condition)
        );
      })
      .map(segment => Number(segment.line_number))
      .filter(Number.isFinite);
  };

  const remainingMissingConditionTopology = {};
  for (const missingIndex of remainingMissingIndexes) {
    const expected = norm(missing[missingIndex]);
    const matchingPriceSegments = segments.filter(segment =>
      supplierAt(segment) === expected.supplier &&
      (segment.field_candidates || []).some(candidate =>
        candidate.field === 'price' && Number(candidate.value) === expected.price
      )
    );

    let best = null;
    const conditionLines = conditionCandidateLines(expected.condition, expected.supplier);
    for (const priceSegment of matchingPriceSegments) {
      const priceLine = Number(priceSegment.line_number);
      for (const conditionLine of conditionLines) {
        const distance = Math.abs(priceLine - conditionLine);
        if (!best || distance < best.distance) {
          best = { priceLine, conditionLine, distance };
        }
      }
    }

    const path = best
      ? conditionPathShape(best.conditionLine, best.priceLine)
      : { boundaries: new Set(), modelAnchors: 0 };
    const signature = [
      'model=' + expected.model,
      'condition=' + (expected.condition || 'null'),
      'nearest_same_supplier=' + (best ? 'yes' : 'no'),
      'distance=' + (best?.distance ?? 'none'),
      'model_anchors=' + path.modelAnchors,
      'boundaries=' + ([...path.boundaries].sort().join('+') || 'none')
    ].join('|');
    remainingMissingConditionTopology[signature] =
      (remainingMissingConditionTopology[signature] || 0) + 1;
  }

  const remainingExtraConditionTopology = {};
  for (const extraIndex of remainingExtraIndexes) {
    const record = extraRecords[extraIndex];
    if (!record) continue;
    const priceLine = sourceLine(record, 'price');
    const conditionLine = sourceLine(record, 'condition');
    const path = conditionPathShape(conditionLine, priceLine);
    const distance =
      Number.isFinite(priceLine) && Number.isFinite(conditionLine)
        ? Math.abs(priceLine - conditionLine)
        : null;
    const conditionRules = (record.trace || [])
      .filter(item => item.field === 'condition')
      .flatMap(item => Array.isArray(item.rules) ? item.rules.map(String) : []);
    const conditionSourceSegment = Number.isFinite(conditionLine)
      ? segmentByLine.get(conditionLine)
      : null;
    const conditionSourceFields = new Set(
      (conditionSourceSegment?.field_candidates || []).map(candidate => candidate.field)
    );
    const conditionSourceRole =
      conditionSourceSegment?.role_candidates?.[0]?.role || 'unknown';
    const signature = [
      'model=' + (record.fields?.model?.id || '(unknown)'),
      'condition=' + (normalizeKey(record.fields?.condition) || 'null'),
      'source=' + (Number.isFinite(conditionLine) ? 'yes' : 'no'),
      'source_role=' + conditionSourceRole,
      'source_model=' + (conditionSourceFields.has('model') ? 'yes' : 'no'),
      'source_supplier=' + (conditionSourceFields.has('supplier') ? 'yes' : 'no'),
      'distance=' + (distance ?? 'none'),
      'model_anchors=' + path.modelAnchors,
      'boundaries=' + ([...path.boundaries].sort().join('+') || 'none'),
      'rule=' + (conditionRules.length ? conditionRules.join('+') : 'none')
    ].join('|');
    remainingExtraConditionTopology[signature] =
      (remainingExtraConditionTopology[signature] || 0) + 1;
  }

  const remainingPairEvidence = {};
  {
    const usedExtraForEvidence = new Set();
    for (const missingIndex of remainingMissingIndexes) {
      const expected = norm(missing[missingIndex]);
      let best = null;
      for (const extraIndex of remainingExtraIndexes) {
        if (usedExtraForEvidence.has(extraIndex)) continue;
        const actual = norm(extras[extraIndex]);
        if (actual.model !== expected.model) continue;
        const diffs = diffFields(expected, actual);
        if (!best || diffs.length < best.diffs.length || (
          diffs.length === best.diffs.length && extraIndex < best.extraIndex
        )) {
          best = { extraIndex, diffs, actual };
        }
      }
      if (!best) continue;
      usedExtraForEvidence.add(best.extraIndex);

      const record = extraRecords[best.extraIndex];
      if (!record) continue;
      const priceLine = sourceLine(record, 'price');
      const actualFieldLocal = field => {
        if (field === 'price') {
          const trace = (record.trace || []).find(item => item.field === 'price');
          return Number.isFinite(priceLine) && (trace?.rules || []).includes('direct_extraction');
        }
        if (field === 'supplier') {
          const line = sourceLine(record, 'supplier');
          const boundaries = pathBoundaries(line, priceLine);
          return Number.isFinite(line) &&
            !boundaries.has('supplier') &&
            !boundaries.has('timestamp');
        }
        if (field === 'color') return isLocalField(record, 'color', priceLine, 3);
        if (field === 'condition') return isLocalField(record, 'condition', priceLine, 6);
        return true;
      };

      const expectedFieldLocal = field => {
        if (!Number.isFinite(priceLine)) return false;
        if (field === 'price') {
          return segments.some(segment =>
            supplierAt(segment) === expected.supplier &&
            Number(segment.line_number) === priceLine &&
            (segment.field_candidates || []).some(candidate =>
              candidate.field === 'price' && Number(candidate.value) === expected.price
            )
          );
        }
        if (field === 'supplier') {
          return supplierAt(segmentByLine.get(priceLine)) === expected.supplier;
        }
        const maxDistance = field === 'color' ? 3 : 6;
        const expectedValue = expected[field];
        if (expectedValue == null) return true;
        return segments.some(segment => {
          const line = Number(segment.line_number);
          if (!Number.isFinite(line) || Math.abs(priceLine - line) > maxDistance) return false;
          const boundaries = pathBoundaries(line, priceLine);
          if (boundaries.has('domain') || boundaries.has('supplier') || boundaries.has('timestamp')) return false;
          if (supplierAt(segment) !== expected.supplier) return false;
          return (segment.field_candidates || []).some(candidate =>
            candidateMatchesExpected(candidate, field, expectedValue)
          );
        });
      };

      const evidenceParts = [];
      let coreWins = 0;
      let legacyWins = 0;
      let ties = 0;
      for (const field of best.diffs) {
        const coreLocal = actualFieldLocal(field);
        const legacyLocal = expectedFieldLocal(field);
        if (coreLocal && !legacyLocal) coreWins += 1;
        else if (!coreLocal && legacyLocal) legacyWins += 1;
        else ties += 1;
        evidenceParts.push(
          field + ':core=' + (coreLocal ? 'local' : 'nonlocal') +
          ':legacy=' + (legacyLocal ? 'local' : 'nonlocal')
        );
      }

      const signature = [
        'model=' + expected.model,
        'diffs=' + best.diffs.slice().sort().join('+'),
        'core_wins=' + coreWins,
        'legacy_wins=' + legacyWins,
        'ties=' + ties,
        ...evidenceParts
      ].join('|');
      remainingPairEvidence[signature] = (remainingPairEvidence[signature] || 0) + 1;
    }
  }

  const remainingPairSignatures = {};
  const usedRemainingExtra = new Set();
  const pairedRemainingMissing = new Set();
  for (const missingIndex of remainingMissingIndexes) {
    const expected = norm(missing[missingIndex]);
    let best = null;
    for (const extraIndex of remainingExtraIndexes) {
      if (usedRemainingExtra.has(extraIndex)) continue;
      const actual = norm(extras[extraIndex]);
      if (actual.model !== expected.model) continue;
      const diffs = diffFields(expected, actual);
      if (!best || diffs.length < best.diffs.length || (
        diffs.length === best.diffs.length && extraIndex < best.extraIndex
      )) {
        best = { extraIndex, diffs };
      }
    }
    if (!best) continue;
    pairedRemainingMissing.add(missingIndex);
    usedRemainingExtra.add(best.extraIndex);
    const signature = best.diffs.length
      ? best.diffs.slice().sort().join('+')
      : 'exact';
    remainingPairSignatures[signature] = (remainingPairSignatures[signature] || 0) + 1;
  }

  const unpairedMissingIndexes = remainingMissingIndexes
    .filter(index => !pairedRemainingMissing.has(index));
  const unpairedExtraIndexes = remainingExtraIndexes
    .filter(index => !usedRemainingExtra.has(index));

  const traceRules = (record, field) => {
    const trace = (record?.trace || []).find(item => item.field === field);
    return Array.isArray(trace?.rules) && trace.rules.length
      ? trace.rules.map(String).join('+')
      : 'none';
  };
  const distanceLabel = (fromLine, toLine) =>
    Number.isFinite(fromLine) && Number.isFinite(toLine)
      ? String(Math.abs(fromLine - toLine))
      : 'none';
  const boundariesLabel = (fromLine, toLine) => {
    const found = pathBoundaries(fromLine, toLine);
    return [...found].sort().join('+') || 'none';
  };

  const unpairedExtraForensics = {};
  const unpairedMissingForensics = {};
  if (options.includeUnpairedForensics === true) {
  for (const extraIndex of unpairedExtraIndexes) {
    const record = extraRecords[extraIndex];
    if (!record) {
      unpairedExtraForensics['record=unresolved'] =
        (unpairedExtraForensics['record=unresolved'] || 0) + 1;
      continue;
    }
    const model = record.fields?.model?.id || '(unknown)';
    const priceLine = sourceLine(record, 'price');
    const modelLine = sourceLine(record, 'model');
    const supplierLine = sourceLine(record, 'supplier');
    const colorLine = sourceLine(record, 'color');
    const conditionLine = sourceLine(record, 'condition');
    const priceSegment = Number.isFinite(priceLine) ? segmentByLine.get(priceLine) : null;
    const modelSegment = Number.isFinite(modelLine) ? segmentByLine.get(modelLine) : null;
    const semanticExact = !!(
      modelSegment &&
      (modelSegment.semantic_candidates || []).some(candidate =>
        candidate.field === 'model' &&
        candidate.entity_id === model &&
        (candidate.state === 'interpreted' || candidate.state === 'inferred')
      )
    );

    const signature = [
      'model=' + model,
      'price_role=' + (priceSegment?.role_candidates?.[0]?.role || 'unknown'),
      'price_rule=' + traceRules(record, 'price'),
      'model_rule=' + traceRules(record, 'model'),
      'model_distance=' + distanceLabel(modelLine, priceLine),
      'model_semantic_exact=' + (semanticExact ? 'yes' : 'no'),
      'model_boundaries=' + boundariesLabel(modelLine, priceLine),
      'supplier_rule=' + traceRules(record, 'supplier'),
      'supplier_distance=' + distanceLabel(supplierLine, priceLine),
      'supplier_boundaries=' + boundariesLabel(supplierLine, priceLine),
      'color_rule=' + traceRules(record, 'color'),
      'color_distance=' + distanceLabel(colorLine, priceLine),
      'color_boundaries=' + boundariesLabel(colorLine, priceLine),
      'condition_rule=' + traceRules(record, 'condition'),
      'condition_distance=' + distanceLabel(conditionLine, priceLine),
      'condition_boundaries=' + boundariesLabel(conditionLine, priceLine)
    ].join('|');
    unpairedExtraForensics[signature] =
      (unpairedExtraForensics[signature] || 0) + 1;
  }

  for (const missingIndex of unpairedMissingIndexes) {
    const expected = norm(missing[missingIndex]);
    const sameSupplierPrice = records.filter(record =>
      String(record.fields?.supplier ?? '') === String(expected.supplier ?? '') &&
      Number(record.fields?.price) === expected.price
    );
    const sameModelSupplierPrice = sameSupplierPrice.filter(record =>
      record.fields?.model?.id === expected.model
    );
    const sameModelSupplierPriceColor = sameModelSupplierPrice.filter(record =>
      canonicalExpectedValue('color', record.fields?.color) ===
        canonicalExpectedValue('color', expected.color)
    );
    const sameModelSupplierPriceCondition = sameModelSupplierPrice.filter(record =>
      canonicalExpectedValue('condition', record.fields?.condition) ===
        canonicalExpectedValue('condition', expected.condition)
    );

    const priceSegments = segments.filter(segment =>
      supplierAt(segment) === expected.supplier &&
      (segment.field_candidates || []).some(candidate =>
        candidate.field === 'price' && Number(candidate.value) === expected.price
      )
    );

    let nearestExpectedModelDistance = null;
    let modelLocalAtPrice = false;
    let colorLocalAtPrice = expected.color == null;
    let conditionLocalAtPrice = expected.condition == null;

    for (const priceSegment of priceSegments) {
      const priceLine = Number(priceSegment.line_number);
      for (const segment of segments) {
        const line = Number(segment.line_number);
        if (!Number.isFinite(line)) continue;
        const distance = Math.abs(priceLine - line);
        const boundaries = pathBoundaries(line, priceLine);
        const safePath =
          !boundaries.has('domain') &&
          !boundaries.has('supplier') &&
          !boundaries.has('timestamp');

        const expectedModelHere = (segment.semantic_candidates || []).some(candidate =>
          candidate.field === 'model' &&
          candidate.entity_id === expected.model &&
          (candidate.state === 'interpreted' || candidate.state === 'inferred')
        );
        if (expectedModelHere) {
          nearestExpectedModelDistance = nearestExpectedModelDistance == null
            ? distance
            : Math.min(nearestExpectedModelDistance, distance);
          if (line <= priceLine && distance <= 6 && safePath) modelLocalAtPrice = true;
        }

        if (distance <= 3 && safePath &&
            (segment.field_candidates || []).some(candidate =>
              candidateMatchesExpected(candidate, 'color', expected.color)
            )) {
          colorLocalAtPrice = true;
        }
        if (distance <= 6 && safePath &&
            (segment.field_candidates || []).some(candidate =>
              candidateMatchesExpected(candidate, 'condition', expected.condition)
            )) {
          conditionLocalAtPrice = true;
        }
      }
    }

    const signature = [
      'model=' + expected.model,
      'price_loci=' + priceSegments.length,
      'same_supplier_price_core=' + sameSupplierPrice.length,
      'same_model_supplier_price_core=' + sameModelSupplierPrice.length,
      'same_msp_color_core=' + sameModelSupplierPriceColor.length,
      'same_msp_condition_core=' + sameModelSupplierPriceCondition.length,
      'nearest_expected_model_distance=' + (nearestExpectedModelDistance ?? 'none'),
      'model_local=' + (modelLocalAtPrice ? 'yes' : 'no'),
      'color_local=' + (colorLocalAtPrice ? 'yes' : 'no'),
      'condition_local=' + (conditionLocalAtPrice ? 'yes' : 'no')
    ].join('|');
    unpairedMissingForensics[signature] =
      (unpairedMissingForensics[signature] || 0) + 1;
  }
  }

  return {
    version:
      options.includeStrictPairDominance === true
        ? 'residual-adjudication-ledger/v4'
        : options.includeSourceUnsupportedMissing === true
          ? 'residual-adjudication-ledger/v3'
        : (
            options.includeStrongMixed === true ||
            options.includeAllFullyLocalCoreOnly === true ||
            options.includeAllFullyLocalCoreOnlyLate === true
              ? 'residual-adjudication-ledger/v2'
              : 'residual-adjudication-ledger/v1'
          ),
    raw: {
      missing: missing.length,
      extra: extras.length
    },
    claimed: {
      missing: claimedMissing.size,
      extra: claimedExtra.size
    },
    actionable: {
      missing: actionableMissing,
      extra: actionableExtra,
      total_residual: actionableMissing + actionableExtra
    },
    remaining_diagnostic: {
      missing_by_model: countByModel(missing, remainingMissingIndexes),
      extra_by_model: countByModel(extras, remainingExtraIndexes),
      nearest_same_model_pair_signatures: Object.entries(remainingPairSignatures)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {}),
      missing_source_support_signatures: Object.entries(remainingMissingSourceSupport)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {}),
      extra_locality_signatures: Object.entries(remainingExtraLocality)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {}),
      missing_condition_topology: Object.entries(remainingMissingConditionTopology)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {}),
      extra_condition_topology: Object.entries(remainingExtraConditionTopology)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {}),
      remaining_pair_evidence: Object.entries(remainingPairEvidence)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {}),
      unpaired_counts: {
        missing: unpairedMissingIndexes.length,
        extra: unpairedExtraIndexes.length
      },
      unpaired_missing_forensics: Object.entries(unpairedMissingForensics)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {}),
      unpaired_extra_forensics: Object.entries(unpairedExtraForensics)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
    },
    categories,
    integrity: {
      duplicate_missing_claims: 0,
      duplicate_extra_claims: 0,
      missing_conserved: missingConserved,
      extra_conserved: extraConserved,
      historical_independent_count_parity: parity,
      historical_expected_category_counts: expectedCategoryCounts,
      ledger_category_counts: actualCategoryCounts,
      historical_count_difference_is_informational: true,
      pass: missingConserved && extraConserved
    }
  };
}

const residualAdjudicationLedger =
  buildResidualAdjudicationLedger(
    reportSupplierAware,
    coreBundle,
    {
      includeStrongMixed: true,
      includeAllFullyLocalCoreOnlyLate: true,
      includeSourceUnsupportedMissing: true,
      includeStrictPairDominance: true,
      includeUnpairedForensics: true
    }
  );

const residualAdjudicationLedgerStrictPairDominanceSimulation =
  buildResidualAdjudicationLedger(
    reportSupplierAware,
    coreBundle,
    {
      includeStrongMixed: true,
      includeAllFullyLocalCoreOnlyLate: true,
      includeSourceUnsupportedMissing: true,
      includeStrictPairDominance: true
    }
  );

function exactSupportedConditionTopologyDiagnostics(bundle) {
  const legacyCounts = new Map();
  for (const offer of legacySupplierAware?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }

  const coreByKey = new Map();
  for (const record of coreOffers(bundle)) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreByKey.has(key)) coreByKey.set(key, []);
    coreByKey.get(key).push(record);
  }

  const segments = bundle.segments || [];
  const sourceLine = (record, field) => {
    const trace = (record.trace || []).find(item => item.field === field);
    return Array.isArray(trace?.sources) && trace.sources.length
      ? Number(trace.sources[0])
      : null;
  };
  const pathShape = (fromLine, toLine) => {
    const out = { model_anchors: 0, boundaries: new Set() };
    if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return out;
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    for (const segment of segments) {
      const line = Number(segment.line_number);
      if (!(line > lo && line <= hi)) continue;
      if ((segment.field_candidates || []).some(candidate => candidate.field === 'model')) {
        out.model_anchors += 1;
      }
      for (const event of segment.context_events || []) {
        if (event.reason === 'domain_boundary') out.boundaries.add('domain');
        if (event.reason === 'supplier_boundary') out.boundaries.add('supplier');
        if (event.reason === 'timestamp_boundary') out.boundaries.add('timestamp');
      }
    }
    return out;
  };
  const distanceBucket = distance => {
    if (distance <= 6) return 'd<=6';
    if (distance <= 12) return 'd<=12';
    if (distance <= 18) return 'd<=18';
    if (distance <= 24) return 'd<=24';
    if (distance <= 36) return 'd<=36';
    if (distance <= 48) return 'd<=48';
    if (distance <= 75) return 'd<=75';
    return 'd>75';
  };
  const anchorBucket = anchors => {
    if (anchors <= 1) return 'a<=1';
    if (anchors <= 2) return 'a<=2';
    if (anchors <= 4) return 'a<=4';
    if (anchors <= 8) return 'a<=8';
    return 'a>8';
  };

  let exactRecords = 0;
  let inheritedConditionExact = 0;
  const shapes = {};
  const byModel = {};

  for (const [key, records] of coreByKey.entries()) {
    const supported = Math.min(legacyCounts.get(key) || 0, records.length);
    for (let i = 0; i < supported; i += 1) {
      const record = records[i];
      exactRecords += 1;
      const conditionTrace = (record.trace || []).find(item => item.field === 'condition');
      if (!conditionTrace || !(conditionTrace.rules || []).includes('context_inheritance')) continue;
      const conditionLine = sourceLine(record, 'condition');
      const priceLine = sourceLine(record, 'price');
      if (!Number.isFinite(conditionLine) || !Number.isFinite(priceLine)) continue;

      inheritedConditionExact += 1;
      const distance = Math.abs(priceLine - conditionLine);
      const path = pathShape(conditionLine, priceLine);
      const condition = normalizeKey(record.fields?.condition) || 'null';
      const model = record.fields?.model?.id || '(unknown)';
      const conditionSourceSegment = segments.find(
        segment => Number(segment.line_number) === conditionLine
      ) || null;
      const conditionSourceFields = new Set(
        (conditionSourceSegment?.field_candidates || []).map(candidate => candidate.field)
      );
      const conditionSourceRole =
        conditionSourceSegment?.role_candidates?.[0]?.role || 'unknown';
      const signature = [
        'condition=' + condition,
        'source_role=' + conditionSourceRole,
        'source_model=' + (conditionSourceFields.has('model') ? 'yes' : 'no'),
        'source_supplier=' + (conditionSourceFields.has('supplier') ? 'yes' : 'no'),
        'distance=' + distanceBucket(distance),
        'anchors=' + anchorBucket(path.model_anchors),
        'boundaries=' + ([...path.boundaries].sort().join('+') || 'none')
      ].join('|');
      shapes[signature] = (shapes[signature] || 0) + 1;
      if (!byModel[model]) byModel[model] = { exact: 0, max_distance: 0, max_model_anchors: 0 };
      byModel[model].exact += 1;
      byModel[model].max_distance = Math.max(byModel[model].max_distance, distance);
      byModel[model].max_model_anchors = Math.max(byModel[model].max_model_anchors, path.model_anchors);
    }
  }

  return {
    exact_supported_records: exactRecords,
    exact_with_inherited_condition: inheritedConditionExact,
    shapes: Object.entries(shapes)
      .sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))
      .reduce((acc,[k,v])=>{acc[k]=v; return acc;},{}),
    by_model: byModel
  };
}

const exactSupportedConditionTopologyDiagnostic =
  exactSupportedConditionTopologyDiagnostics(coreBundle);

const conditionConfidenceHorizonDiagnostics = conditionConfidenceHorizonSimulations.map(sim => {
  const ledger = buildResidualAdjudicationLedger(
    sim.report,
    sim.bundle,
    {
      includeStrongMixed: true,
      includeAllFullyLocalCoreOnlyLate: true,
      includeSourceUnsupportedMissing: true,
      includeStrictPairDominance: true
    }
  );
  return {
    policy: sim.policy,
    cleared_conditions: sim.cleared,
    cleared_by_model: sim.cleared_by_model,
    core_offers: sim.report.metrics.core_offers,
    matched_offers: sim.report.metrics.matched_offers,
    missing_offers: sim.report.metrics.missing_offers,
    extra_offers: sim.report.metrics.extra_offers,
    agreement_ratio: sim.report.metrics.agreement_ratio,
    confirmed_silent_wrong_price: sim.report.metrics.confirmed_silent_wrong_price,
    unresolved_price_attribution: sim.report.metrics.unresolved_price_attribution,
    no_silent_wrong_price: sim.report.gates.no_silent_wrong_price,
    price_attribution_resolved: sim.report.gates.price_attribution_resolved,
    actionable_residual: ledger?.actionable?.total_residual ?? null,
    actionable_missing: ledger?.actionable?.missing ?? null,
    actionable_extra: ledger?.actionable?.extra ?? null,
    ledger_integrity: ledger?.integrity?.pass === true
  };
});

const residualAdjudicationLedgerStrongMixedSimulation =
  buildResidualAdjudicationLedger(
    reportSupplierAware,
    coreBundle,
    { includeStrongMixed: true }
  );

const residualAdjudicationLedgerAllFullLocalSimulation =
  buildResidualAdjudicationLedger(
    reportSupplierAware,
    coreBundle,
    { includeAllFullyLocalCoreOnly: true }
  );

const residualAdjudicationLedgerCombinedSimulation =
  buildResidualAdjudicationLedger(
    reportSupplierAware,
    coreBundle,
    {
      includeAllFullyLocalCoreOnly: true,
      includeStrongMixed: true
    }
  );

const residualAdjudicationLedgerLateFullLocalSimulation =
  buildResidualAdjudicationLedger(
    reportSupplierAware,
    coreBundle,
    { includeAllFullyLocalCoreOnlyLate: true }
  );

const residualAdjudicationLedgerLateCombinedSimulation =
  buildResidualAdjudicationLedger(
    reportSupplierAware,
    coreBundle,
    {
      includeStrongMixed: true,
      includeAllFullyLocalCoreOnlyLate: true
    }
  );

const residualAdjudicationLedgerSourceSupportSimulation =
  buildResidualAdjudicationLedger(
    reportSupplierAware,
    coreBundle,
    {
      includeStrongMixed: true,
      includeAllFullyLocalCoreOnlyLate: true,
      includeSourceUnsupportedMissing: true
    }
  );

function adjudicatedResidualSummary() {
  const rawMissing = reportSupplierAware?.metrics?.missing_offers ?? 0;
  const rawExtra = reportSupplierAware?.metrics?.extra_offers ?? 0;

  const contradictedMissing =
    sourceContradictedLegacyMissingDiagnostic?.source_contradicted_legacy_missing || 0;
  const contradictedPureSupplier =
    sourceContradictedLegacySupplierResidualDiagnostic
      ?.source_contradicted_legacy_supplier_residuals || 0;
  const sourceSupportedCoreOnlyFullOffers =
    sourceSupportedCoreOnlyEOfferDiagnostic?.fully_local_offer_evidence || 0;
  const unsupportedPureCondition =
    sourceUnsupportedLegacyPureConditionDiagnostic
      ?.source_unsupported_legacy_condition_residuals || 0;
  const contradictedPriceSupplier =
    priceSupplierResidualEvidenceDiagnostic
      ?.source_contradicted_legacy_price_supplier_residuals || 0;

  const actionableMissing = Math.max(
    0,
    rawMissing
      - contradictedMissing
      - contradictedPureSupplier
      - unsupportedPureCondition
      - contradictedPriceSupplier
  );
  const actionableExtra = Math.max(
    0,
    rawExtra
      - contradictedPureSupplier
      - sourceSupportedCoreOnlyFullOffers
      - unsupportedPureCondition
      - contradictedPriceSupplier
  );

  return {
    raw: {
      missing: rawMissing,
      extra: rawExtra,
      total_residual: rawMissing + rawExtra
    },
    adjudicated_non_core_error: {
      source_contradicted_legacy_missing: contradictedMissing,
      source_contradicted_legacy_supplier_pairs: contradictedPureSupplier,
      source_supported_core_only_full_offers: sourceSupportedCoreOnlyFullOffers,
      source_unsupported_legacy_pure_condition_pairs: unsupportedPureCondition,
      source_contradicted_legacy_price_supplier_pairs: contradictedPriceSupplier
    },
    actionable: {
      missing: actionableMissing,
      extra: actionableExtra,
      total_residual: actionableMissing + actionableExtra
    },
    policy: {
      raw_metrics_unchanged: true,
      promotion_counted: false,
      superseded_by: 'residual-adjudication-ledger/v1',
      independent_category_counts_may_overlap: true,
      mixed_evidence_not_counted_without_overlap_proof: true
    }
  };
}

const adjudicatedResidualDiagnostic = adjudicatedResidualSummary();

function conditionResidualTopologyDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extras = expand(reportSupplierAware.extra);
  const usedExtra = new Set();

  const coreBuckets = new Map();
  for (const record of coreOffers(bundle)) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreBuckets.has(key)) coreBuckets.set(key, []);
    coreBuckets.get(key).push(record);
  }
  const consumedCore = new Map();

  const norm = offer => {
    const fields = offer?.fields || {};
    return {
      model: fields.model?.id || null,
      supplier: fields.supplier || null,
      capacity: fields.capacity_gb == null ? null : Number(fields.capacity_gb),
      condition: normalizeKey(fields.condition) || null,
      color: normalizeKey(fields.color) || null,
      price: fields.price == null ? null : Number(fields.price)
    };
  };
  const diffs = (left, right) => {
    const a = norm(left);
    const b = norm(right);
    return ['supplier', 'capacity', 'condition', 'color', 'price']
      .filter(field => a[field] !== b[field]);
  };
  const firstSource = trace => Array.isArray(trace?.sources) && trace.sources.length
    ? Number(trace.sources[0])
    : null;
  const segments = bundle.segments || [];
  const segmentByLine = new Map(segments.map(segment => [Number(segment.line_number), segment]));
  const hasDirectField = (segment, field) =>
    (segment?.field_candidates || []).some(candidate => candidate.field === field);

  const signatures = {};
  let cases = 0;
  let unresolvedCoreRecord = 0;

  for (const miss of missing) {
    const expected = norm(miss);
    if (!expected.condition) continue;

    let best = null;
    for (let index = 0; index < extras.length; index += 1) {
      if (usedExtra.has(index)) continue;
      const candidate = norm(extras[index]);
      if (candidate.model !== expected.model) continue;
      const fieldDiffs = diffs(miss, extras[index]);
      if (!fieldDiffs.includes('condition')) continue;
      if (candidate.condition != null) continue;
      const score = fieldDiffs.length;
      if (!best || score < best.score || (score === best.score && index < best.index)) {
        best = { index, score };
      }
    }
    if (!best) continue;

    usedExtra.add(best.index);
    cases += 1;
    const extra = extras[best.index];
    const extraKey = offerKey(extra.fields || {}, { include_supplier: true });
    const bucket = coreBuckets.get(extraKey) || [];
    const consumed = consumedCore.get(extraKey) || 0;
    const record = bucket[consumed] || null;
    consumedCore.set(extraKey, consumed + 1);
    if (!record) {
      unresolvedCoreRecord += 1;
      continue;
    }

    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    const modelTrace = (record.trace || []).find(item => item.field === 'model');
    const recordLine = firstSource(priceTrace) || firstSource(modelTrace);
    if (!Number.isFinite(recordLine)) {
      unresolvedCoreRecord += 1;
      continue;
    }

    const matchingConditionLines = [];
    for (const segment of segments) {
      const line = Number(segment.line_number);
      for (const candidate of segment.field_candidates || []) {
        if (candidate.field !== 'condition') continue;
        const mapped = schema.fields.find(field => field.name === 'condition')?.value_map || {};
        const raw = candidate.value;
        const canonical = mapped[raw] || mapped[String(raw)] || raw;
        if (normalizeKey(canonical) === expected.condition) matchingConditionLines.push(line);
      }
    }

    const ranked = matchingConditionLines
      .map(line => ({
        line,
        distance: Math.abs(recordLine - line),
        direction: line < recordLine ? 'before' : line > recordLine ? 'after' : 'same'
      }))
      .sort((a, b) => a.distance - b.distance || a.line - b.line);
    const nearest = ranked[0] || null;

    let boundarySignature = 'none';
    let modelAnchorBetween = false;
    let supplierBoundaryBetween = false;
    if (nearest) {
      const lo = Math.min(nearest.line, recordLine);
      const hi = Math.max(nearest.line, recordLine);
      const boundaryKinds = new Set();
      for (const segment of segments) {
        const line = Number(segment.line_number);
        if (!(line > lo && line <= hi)) continue;
        if (hasDirectField(segment, 'model')) modelAnchorBetween = true;
        for (const event of segment.context_events || []) {
          if (event.reason === 'timestamp_boundary') boundaryKinds.add('timestamp');
          if (event.reason === 'domain_boundary') boundaryKinds.add('domain');
          if (event.reason === 'supplier_boundary') {
            boundaryKinds.add('supplier');
            supplierBoundaryBetween = true;
          }
          if (event.reason === 'new_context_anchor') boundaryKinds.add('anchor');
        }
      }
      boundarySignature = boundaryKinds.size ? [...boundaryKinds].sort().join('+') : 'none';
    }

    const recordSegment = segmentByLine.get(recordLine);
    const supplierContext = recordSegment?.inherited_context?.supplier?.value || record.fields?.supplier || null;
    const sameSupplier = expected.supplier == null || supplierContext == null
      ? 'unknown'
      : normalizeKey(expected.supplier) === normalizeKey(supplierContext) ? 'yes' : 'no';

    const nearestLabel = nearest
      ? nearest.direction + ':d' + nearest.distance
      : 'none';
    const signature = [
      'expected=' + expected.condition,
      'nearest=' + nearestLabel,
      'boundaries=' + boundarySignature,
      'model_anchor_between=' + (modelAnchorBetween ? 'yes' : 'no'),
      'supplier_boundary_between=' + (supplierBoundaryBetween ? 'yes' : 'no'),
      'same_supplier=' + sameSupplier
    ].join('|');
    signatures[signature] = (signatures[signature] || 0) + 1;
  }

  return {
    cases,
    unresolved_core_record: unresolvedCoreRecord,
    signatures: Object.entries(signatures)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
  };
}

const conditionResidualTopologyDiagnostic =
  conditionResidualTopologyDiagnostics(reportSupplierAware, coreBundle);

function pureConditionResidualTopologyDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extras = expand(reportSupplierAware.extra);
  const usedExtra = new Set();

  const identityWithoutCondition = fields => JSON.stringify([
    fields?.model?.id || null,
    normalizeKey(fields?.supplier) || null,
    fields?.capacity_gb == null ? null : Number(fields.capacity_gb),
    normalizeKey(fields?.color) || null,
    fields?.price == null ? null : Number(fields.price)
  ]);

  const coreBuckets = new Map();
  for (const record of coreOffers(bundle)) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreBuckets.has(key)) coreBuckets.set(key, []);
    coreBuckets.get(key).push(record);
  }
  const consumedCore = new Map();
  const segments = bundle.segments || [];
  const conditionField = schema.fields.find(field => field.name === 'condition') || {};
  const valueMap = conditionField.value_map || {};
  const canonicalConditionValue = value => normalizeKey(valueMap[value] || valueMap[String(value)] || value) || null;

  const signatures = {};
  const expectedCounts = {};
  let cases = 0;
  let coreNull = 0;
  let coreDifferent = 0;
  let unresolvedCoreRecord = 0;

  for (const miss of missing) {
    const missFields = miss.fields || {};
    const expectedCondition = canonicalConditionValue(missFields.condition);
    if (!expectedCondition) continue;
    const identity = identityWithoutCondition(missFields);

    let matchIndex = -1;
    for (let index = 0; index < extras.length; index += 1) {
      if (usedExtra.has(index)) continue;
      if (identityWithoutCondition(extras[index].fields || {}) !== identity) continue;
      const coreCondition = canonicalConditionValue(extras[index].fields?.condition);
      if (coreCondition === expectedCondition) continue;
      matchIndex = index;
      break;
    }
    if (matchIndex < 0) continue;

    usedExtra.add(matchIndex);
    cases += 1;
    expectedCounts[expectedCondition] = (expectedCounts[expectedCondition] || 0) + 1;
    const extra = extras[matchIndex];
    const coreCondition = canonicalConditionValue(extra.fields?.condition);
    if (coreCondition == null) coreNull += 1;
    else coreDifferent += 1;

    const extraKey = offerKey(extra.fields || {}, { include_supplier: true });
    const bucket = coreBuckets.get(extraKey) || [];
    const consumed = consumedCore.get(extraKey) || 0;
    const record = bucket[consumed] || null;
    consumedCore.set(extraKey, consumed + 1);
    if (!record) {
      unresolvedCoreRecord += 1;
      continue;
    }

    const sourceLines = (record.trace || [])
      .flatMap(item => Array.isArray(item.sources) ? item.sources : [])
      .map(Number)
      .filter(Number.isFinite);
    const recordLine = sourceLines.length ? Math.max(...sourceLines) : null;
    if (!Number.isFinite(recordLine)) {
      unresolvedCoreRecord += 1;
      continue;
    }

    const supplier = missFields.supplier || null;
    const candidates = [];
    for (const segment of segments) {
      const line = Number(segment.line_number);
      const segmentSupplier =
        segment?.inherited_context?.supplier?.value ||
        (segment.field_candidates || []).find(candidate => candidate.field === 'supplier')?.value ||
        null;
      const sameSupplier = supplier == null || segmentSupplier == null
        ? false
        : normalizeKey(segmentSupplier) === normalizeKey(supplier);
      if (!sameSupplier) continue;

      for (const candidate of segment.field_candidates || []) {
        if (candidate.field !== 'condition') continue;
        if (canonicalConditionValue(candidate.value) !== expectedCondition) continue;
        candidates.push({
          line,
          direction: line < recordLine ? 'before' : line > recordLine ? 'after' : 'same',
          distance: Math.abs(recordLine - line)
        });
      }
    }

    candidates.sort((a, b) => a.distance - b.distance || a.line - b.line);
    const nearest = candidates[0] || null;
    const boundaryKinds = new Set();
    let anchorCount = 0;
    if (nearest) {
      const lo = Math.min(nearest.line, recordLine);
      const hi = Math.max(nearest.line, recordLine);
      for (const segment of segments) {
        const line = Number(segment.line_number);
        if (!(line > lo && line <= hi)) continue;
        if ((segment.field_candidates || []).some(candidate => candidate.field === 'model')) {
          anchorCount += 1;
        }
        for (const event of segment.context_events || []) {
          if (event.reason === 'timestamp_boundary') boundaryKinds.add('timestamp');
          if (event.reason === 'domain_boundary') boundaryKinds.add('domain');
          if (event.reason === 'supplier_boundary') boundaryKinds.add('supplier');
        }
      }
    }

    const signature = [
      'expected=' + expectedCondition,
      'core=' + (coreCondition || 'null'),
      'nearest_same_supplier=' + (nearest ? nearest.direction + ':d' + nearest.distance : 'none'),
      'boundaries=' + (boundaryKinds.size ? [...boundaryKinds].sort().join('+') : 'none'),
      'model_anchors_between=' + anchorCount
    ].join('|');
    signatures[signature] = (signatures[signature] || 0) + 1;
  }

  return {
    cases,
    core_null: coreNull,
    core_different: coreDifferent,
    unresolved_core_record: unresolvedCoreRecord,
    expected_conditions: expectedCounts,
    signatures: Object.entries(signatures)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
  };
}

const pureConditionResidualTopologyDiagnostic =
  pureConditionResidualTopologyDiagnostics(reportSupplierAware, coreBundle);

function pureColorResidualTopologyDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extras = expand(reportSupplierAware.extra);
  const usedExtra = new Set();

  const identityWithoutColor = fields => JSON.stringify([
    fields?.model?.id || null,
    normalizeKey(fields?.supplier) || null,
    fields?.capacity_gb == null ? null : Number(fields.capacity_gb),
    normalizeKey(fields?.condition) || null,
    fields?.price == null ? null : Number(fields.price)
  ]);

  const coreBuckets = new Map();
  for (const record of coreOffers(bundle)) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreBuckets.has(key)) coreBuckets.set(key, []);
    coreBuckets.get(key).push(record);
  }
  const consumedCore = new Map();
  const segments = bundle.segments || [];
  const colorField = schema.fields.find(field => field.name === 'color') || {};
  const valueMap = colorField.value_map || {};
  const canonicalColor = value => normalizeKey(valueMap[value] || valueMap[String(value)] || value) || null;

  const signatures = {};
  const expectedCounts = {};
  let cases = 0;
  let coreNull = 0;
  let coreDifferent = 0;
  let unresolvedCoreRecord = 0;

  for (const miss of missing) {
    const missFields = miss.fields || {};
    const expectedColor = canonicalColor(missFields.color);
    if (!expectedColor) continue;
    const identity = identityWithoutColor(missFields);

    let matchIndex = -1;
    for (let index = 0; index < extras.length; index += 1) {
      if (usedExtra.has(index)) continue;
      if (identityWithoutColor(extras[index].fields || {}) !== identity) continue;
      const coreColor = canonicalColor(extras[index].fields?.color);
      if (coreColor === expectedColor) continue;
      matchIndex = index;
      break;
    }
    if (matchIndex < 0) continue;

    usedExtra.add(matchIndex);
    cases += 1;
    expectedCounts[expectedColor] = (expectedCounts[expectedColor] || 0) + 1;
    const extra = extras[matchIndex];
    const coreColor = canonicalColor(extra.fields?.color);
    if (coreColor == null) coreNull += 1;
    else coreDifferent += 1;

    const extraKey = offerKey(extra.fields || {}, { include_supplier: true });
    const bucket = coreBuckets.get(extraKey) || [];
    const consumed = consumedCore.get(extraKey) || 0;
    const record = bucket[consumed] || null;
    consumedCore.set(extraKey, consumed + 1);
    if (!record) {
      unresolvedCoreRecord += 1;
      continue;
    }

    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    const modelTrace = (record.trace || []).find(item => item.field === 'model');
    const recordLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
      ? Number(priceTrace.sources[0])
      : Array.isArray(modelTrace?.sources) && modelTrace.sources.length
        ? Number(modelTrace.sources[0])
        : null;
    if (!Number.isFinite(recordLine)) {
      unresolvedCoreRecord += 1;
      continue;
    }

    const supplier = missFields.supplier || null;
    const candidates = [];
    for (const segment of segments) {
      const line = Number(segment.line_number);
      const segmentSupplier =
        segment?.inherited_context?.supplier?.value ||
        (segment.field_candidates || []).find(candidate => candidate.field === 'supplier')?.value ||
        null;
      if (supplier == null || segmentSupplier == null) continue;
      if (normalizeKey(segmentSupplier) !== normalizeKey(supplier)) continue;

      for (const candidate of segment.field_candidates || []) {
        if (candidate.field !== 'color') continue;
        if (canonicalColor(candidate.value) !== expectedColor) continue;
        const fieldNames = [...new Set(
          (segment.field_candidates || []).map(item => item.field).filter(Boolean)
        )].sort();
        const otherFields = fieldNames.filter(name => name !== 'color');
        const topRole = segment.role_candidates?.[0]?.role || 'unknown';
        const normalized = String(segment.normalized || '').trim();
        const captured = String(candidate.evidence?.captured || candidate.value || '');
        const lowerNormalized = normalized.toLocaleLowerCase('pt-BR');
        const lowerCaptured = captured.toLocaleLowerCase('pt-BR');
        const capturedIndex = lowerCaptured ? lowerNormalized.indexOf(lowerCaptured) : -1;
        const leftover = capturedIndex >= 0
          ? (normalized.slice(0, capturedIndex) + ' ' + normalized.slice(capturedIndex + captured.length)).trim()
          : normalized;
        const leftoverTokens = leftover
          ? leftover.split(/\s+/).filter(Boolean).length
          : 0;
        candidates.push({
          line,
          direction: line < recordLine ? 'before' : line > recordLine ? 'after' : 'same',
          distance: Math.abs(recordLine - line),
          field_only: isFieldOnlySegment(segment, 'color'),
          other_fields: otherFields,
          top_role: topRole,
          leftover_tokens: leftoverTokens
        });
      }
    }

    candidates.sort((a, b) => a.distance - b.distance || a.line - b.line);
    const nearest = candidates[0] || null;
    const boundaryKinds = new Set();
    let modelAnchorCount = 0;
    if (nearest) {
      const lo = Math.min(nearest.line, recordLine);
      const hi = Math.max(nearest.line, recordLine);
      for (const segment of segments) {
        const line = Number(segment.line_number);
        if (!(line > lo && line <= hi)) continue;
        if ((segment.field_candidates || []).some(candidate => candidate.field === 'model')) {
          modelAnchorCount += 1;
        }
        for (const event of segment.context_events || []) {
          if (event.reason === 'timestamp_boundary') boundaryKinds.add('timestamp');
          if (event.reason === 'domain_boundary') boundaryKinds.add('domain');
          if (event.reason === 'supplier_boundary') boundaryKinds.add('supplier');
        }
      }
    }

    const signature = [
      'expected=' + expectedColor,
      'core=' + (coreColor || 'null'),
      'nearest_same_supplier=' + (nearest ? nearest.direction + ':d' + nearest.distance : 'none'),
      'nearest_field_only=' + (nearest ? (nearest.field_only ? 'yes' : 'no') : 'unknown'),
      'nearest_other_fields=' + (nearest ? (nearest.other_fields.length ? nearest.other_fields.join(',') : 'none') : 'unknown'),
      'nearest_role=' + (nearest ? nearest.top_role : 'unknown'),
      'nearest_leftover_tokens=' + (nearest ? nearest.leftover_tokens : 'unknown'),
      'boundaries=' + (boundaryKinds.size ? [...boundaryKinds].sort().join('+') : 'none'),
      'model_anchors_between=' + modelAnchorCount
    ].join('|');
    signatures[signature] = (signatures[signature] || 0) + 1;
  }

  return {
    cases,
    core_null: coreNull,
    core_different: coreDifferent,
    unresolved_core_record: unresolvedCoreRecord,
    expected_colors: expectedCounts,
    signatures: Object.entries(signatures)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
  };
}

const pureColorResidualTopologyDiagnostic =
  pureColorResidualTopologyDiagnostics(reportSupplierAware, coreBundle);

function pureSupplierResidualTopologyDiagnostics(reportSupplierAware, bundle) {
  if (!reportSupplierAware) return null;

  const expand = items => (items || []).flatMap(item =>
    Array.from({ length: Number(item.count || 0) }, () => ({ fields: item.fields || {} }))
  );
  const missing = expand(reportSupplierAware.missing);
  const extras = expand(reportSupplierAware.extra);
  const usedExtra = new Set();

  const identityWithoutSupplier = fields => JSON.stringify([
    fields?.model?.id || null,
    fields?.capacity_gb == null ? null : Number(fields.capacity_gb),
    normalizeKey(fields?.condition) || null,
    normalizeKey(fields?.color) || null,
    fields?.price == null ? null : Number(fields.price)
  ]);

  const coreBuckets = new Map();
  for (const record of coreOffers(bundle)) {
    const key = offerKey(record.fields || {}, { include_supplier: true });
    if (!coreBuckets.has(key)) coreBuckets.set(key, []);
    coreBuckets.get(key).push(record);
  }
  const consumedCore = new Map();
  const segments = bundle.segments || [];

  const signatures = {};
  let cases = 0;
  let unresolvedCoreRecord = 0;

  const nearestSupplierLine = (supplier, priceLine) => {
    const rows = [];
    for (const segment of segments) {
      const direct = uniqueFieldCandidates(segment.field_candidates || [], 'supplier');
      if (!direct.some(candidate => String(candidate.value) === String(supplier))) continue;
      const line = Number(segment.line_number);
      rows.push({
        line,
        distance: Math.abs(priceLine - line),
        direction: line < priceLine ? 'before' : line > priceLine ? 'after' : 'same'
      });
    }
    return rows.sort((a, b) => a.distance - b.distance || a.line - b.line)[0] || null;
  };

  for (const miss of missing) {
    const expectedSupplier = miss.fields?.supplier || null;
    if (expectedSupplier == null) continue;
    const identity = identityWithoutSupplier(miss.fields || {});

    let matchIndex = -1;
    for (let index = 0; index < extras.length; index += 1) {
      if (usedExtra.has(index)) continue;
      if (identityWithoutSupplier(extras[index].fields || {}) !== identity) continue;
      const actualSupplier = extras[index].fields?.supplier || null;
      if (String(actualSupplier) === String(expectedSupplier)) continue;
      matchIndex = index;
      break;
    }
    if (matchIndex < 0) continue;

    usedExtra.add(matchIndex);
    cases += 1;
    const extra = extras[matchIndex];
    const actualSupplier = extra.fields?.supplier || null;
    const extraKey = offerKey(extra.fields || {}, { include_supplier: true });
    const bucket = coreBuckets.get(extraKey) || [];
    const consumed = consumedCore.get(extraKey) || 0;
    const record = bucket[consumed] || null;
    consumedCore.set(extraKey, consumed + 1);
    if (!record) {
      unresolvedCoreRecord += 1;
      continue;
    }

    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    const supplierTrace = (record.trace || []).find(item => item.field === 'supplier');
    const priceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
      ? Number(priceTrace.sources[0])
      : null;
    const actualSupplierLine = Array.isArray(supplierTrace?.sources) && supplierTrace.sources.length
      ? Number(supplierTrace.sources[0])
      : null;

    if (!Number.isFinite(priceLine)) {
      unresolvedCoreRecord += 1;
      continue;
    }

    const expectedNearest = nearestSupplierLine(expectedSupplier, priceLine);
    const actualNearest = nearestSupplierLine(actualSupplier, priceLine);
    const actualTraceDistance = Number.isFinite(actualSupplierLine)
      ? Math.abs(priceLine - actualSupplierLine)
      : null;

    const betweenBoundaryKinds = (fromLine, toLine) => {
      if (!Number.isFinite(fromLine) || !Number.isFinite(toLine)) return 'unknown';
      const lo = Math.min(fromLine, toLine);
      const hi = Math.max(fromLine, toLine);
      const kinds = new Set();
      for (const segment of segments) {
        const line = Number(segment.line_number);
        if (!(line > lo && line <= hi)) continue;
        for (const event of segment.context_events || []) {
          if (event.reason === 'supplier_boundary') kinds.add('supplier');
          if (event.reason === 'timestamp_boundary') kinds.add('timestamp');
          if (event.reason === 'domain_boundary') kinds.add('domain');
        }
      }
      return kinds.size ? [...kinds].sort().join('+') : 'none';
    };

    const expectedDescriptor = expectedNearest
      ? expectedNearest.direction + ':d' + expectedNearest.distance
      : 'none';
    const actualDescriptor = actualNearest
      ? actualNearest.direction + ':d' + actualNearest.distance
      : 'none';
    const expectedCloser = expectedNearest && actualNearest
      ? expectedNearest.distance < actualNearest.distance
        ? 'expected'
        : expectedNearest.distance > actualNearest.distance
          ? 'actual'
          : 'tie'
      : 'unknown';

    const signature = [
      'expected_nearest=' + expectedDescriptor,
      'actual_nearest=' + actualDescriptor,
      'actual_trace_distance=' + (actualTraceDistance == null ? 'unknown' : actualTraceDistance),
      'closer=' + expectedCloser,
      'expected_path_boundaries=' + (expectedNearest ? betweenBoundaryKinds(expectedNearest.line, priceLine) : 'unknown'),
      'actual_path_boundaries=' + (Number.isFinite(actualSupplierLine) ? betweenBoundaryKinds(actualSupplierLine, priceLine) : 'unknown')
    ].join('|');

    signatures[signature] = (signatures[signature] || 0) + 1;
  }

  return {
    cases,
    unresolved_core_record: unresolvedCoreRecord,
    signatures: Object.entries(signatures)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
  };
}

const pureSupplierResidualTopologyDiagnostic =
  pureSupplierResidualTopologyDiagnostics(reportSupplierAware, coreBundle);

function exactSurplusProvenanceDiagnostics(legacyBundle, coreBundleInput) {
  const legacyCounts = new Map();
  for (const offer of legacyBundle?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }

  const coreByKey = new Map();
  for (const offer of coreOffers(coreBundleInput)) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    if (!coreByKey.has(key)) coreByKey.set(key, []);
    coreByKey.get(key).push(offer);
  }

  const byModel = {};
  let surplusOffers = 0;
  let surplusKeys = 0;
  let surplusFromSamePriceSource = 0;
  let surplusFromDistinctPriceSources = 0;

  const traceRule = (offer, field) => {
    const trace = (offer.trace || []).find(item => item.field === field);
    return Array.isArray(trace?.rules) && trace.rules.length
      ? trace.rules.join('+')
      : '(no-trace)';
  };
  const traceSource = (offer, field) => {
    const trace = (offer.trace || []).find(item => item.field === field);
    return Array.isArray(trace?.sources) && trace.sources.length && Number.isFinite(Number(trace.sources[0]))
      ? Number(trace.sources[0])
      : null;
  };

  for (const [key, offers] of coreByKey.entries()) {
    const legacyCount = legacyCounts.get(key) || 0;
    if (offers.length <= legacyCount) continue;

    const surplus = offers.length - legacyCount;
    surplusOffers += surplus;
    surplusKeys += 1;
    const model = offers[0]?.fields?.model?.id || '(unknown)';

    if (!byModel[model]) {
      byModel[model] = {
        surplus_offers: 0,
        surplus_keys: 0,
        keys_with_legacy_support: 0,
        keys_without_legacy_support: 0,
        same_price_source_surplus: 0,
        distinct_price_source_surplus: 0,
        record_shape: {},
        color_rule: {},
        condition_rule: {},
        price_rule: {},
        multiplicity: {}
      };
    }
    const row = byModel[model];
    row.surplus_offers += surplus;
    row.surplus_keys += 1;
    if (legacyCount > 0) row.keys_with_legacy_support += 1;
    else row.keys_without_legacy_support += 1;

    const priceSources = offers
      .map(offer => traceSource(offer, 'price'))
      .filter(Number.isFinite);
    const distinctPriceSources = new Set(priceSources);
    const maxSamePriceSourceMultiplicity = priceSources.reduce((acc, line) => {
      acc.set(line, (acc.get(line) || 0) + 1);
      return acc;
    }, new Map());
    const maxSameSource = Math.max(0, ...maxSamePriceSourceMultiplicity.values());

    const sameSourceExcess = Math.max(0, maxSameSource - Math.max(legacyCount, 1));
    const sameSourceContribution = Math.min(surplus, sameSourceExcess);
    row.same_price_source_surplus += sameSourceContribution;
    row.distinct_price_source_surplus += surplus - sameSourceContribution;
    surplusFromSamePriceSource += sameSourceContribution;
    surplusFromDistinctPriceSources += surplus - sameSourceContribution;

    const multKey = [
      'legacy=' + legacyCount,
      'core=' + offers.length,
      'price_sources=' + distinctPriceSources.size,
      'max_same_price_source=' + maxSameSource
    ].join('|');
    row.multiplicity[multKey] = (row.multiplicity[multKey] || 0) + 1;

    const supportedSlots = legacyCount;
    for (let index = supportedSlots; index < offers.length; index += 1) {
      const offer = offers[index];
      const shape = String(offer.core_record_id || '').includes('-exp-') ? 'expanded' : 'base';
      row.record_shape[shape] = (row.record_shape[shape] || 0) + 1;

      const colorRule = traceRule(offer, 'color');
      const conditionRule = traceRule(offer, 'condition');
      const priceRule = traceRule(offer, 'price');
      row.color_rule[colorRule] = (row.color_rule[colorRule] || 0) + 1;
      row.condition_rule[conditionRule] = (row.condition_rule[conditionRule] || 0) + 1;
      row.price_rule[priceRule] = (row.price_rule[priceRule] || 0) + 1;
    }
  }

  return {
    surplus_offers: surplusOffers,
    surplus_keys: surplusKeys,
    same_price_source_surplus: surplusFromSamePriceSource,
    distinct_price_source_surplus: surplusFromDistinctPriceSources,
    by_model: Object.entries(byModel)
      .sort((a, b) => b[1].surplus_offers - a[1].surplus_offers || a[0].localeCompare(b[0]))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
  };
}

const exactSurplusProvenanceDiagnostic =
  exactSurplusProvenanceDiagnostics(legacySupplierAware, coreBundle);

function eModelSurplusSourceDiagnostics(legacyBundle, coreBundleInput) {
  const targets = new Set(['iphone_16e_128gb', 'iphone_17e_256gb']);
  const legacyCounts = new Map();
  for (const offer of legacyBundle?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }

  const segmentsByLine = new Map(
    (coreBundleInput.segments || []).map(segment => [Number(segment.line_number), segment])
  );
  const coreByKey = new Map();
  for (const offer of coreOffers(coreBundleInput)) {
    const model = offer.fields?.model?.id || null;
    if (!targets.has(model)) continue;
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    if (!coreByKey.has(key)) coreByKey.set(key, []);
    coreByKey.get(key).push(offer);
  }

  const byModel = {};
  const ensure = model => {
    if (!byModel[model]) {
      byModel[model] = {
        surplus_offers: 0,
        explicit_e_source: 0,
        source_without_explicit_e: 0,
        unresolved_source: 0,
        direct_model_on_price_line: 0,
        inherited_model_to_price: 0,
        source_relation: {},
        model_rule: {},
        anchors: {
          distinct_source_lines: 0,
          max_surplus_per_source_line: 0,
          source_lines_with_multiple_surplus: 0
        }
      };
    }
    return byModel[model];
  };

  const sourceCountsByModel = new Map();

  for (const [key, offers] of coreByKey.entries()) {
    const legacyCount = legacyCounts.get(key) || 0;
    if (offers.length <= legacyCount) continue;

    for (let index = legacyCount; index < offers.length; index += 1) {
      const offer = offers[index];
      const model = offer.fields?.model?.id || null;
      const row = ensure(model);
      row.surplus_offers += 1;

      const modelTrace = (offer.trace || []).find(item => item.field === 'model');
      const priceTrace = (offer.trace || []).find(item => item.field === 'price');
      const modelLine = Array.isArray(modelTrace?.sources) && modelTrace.sources.length
        ? Number(modelTrace.sources[0])
        : null;
      const priceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
        ? Number(priceTrace.sources[0])
        : null;
      const modelRule = Array.isArray(modelTrace?.rules) && modelTrace.rules.length
        ? modelTrace.rules.join('+')
        : '(no-trace)';
      row.model_rule[modelRule] = (row.model_rule[modelRule] || 0) + 1;

      if (!Number.isFinite(modelLine)) {
        row.unresolved_source += 1;
        continue;
      }

      const sourceSegment = segmentsByLine.get(modelLine);
      const modelCandidates = (sourceSegment?.field_candidates || [])
        .filter(candidate => candidate.field === 'model')
        .map(candidate => String(candidate.value || ''));
      const targetGeneration = model === 'iphone_16e_128gb' ? '16e' : '17e';
      const explicitPattern = new RegExp('(?:^|[^0-9a-z])' + targetGeneration + '(?=[^0-9a-z]|$)', 'i');
      const explicitE = modelCandidates.some(value => explicitPattern.test(value));
      if (explicitE) row.explicit_e_source += 1;
      else row.source_without_explicit_e += 1;

      const relation = Number.isFinite(priceLine)
        ? modelLine === priceLine
          ? 'same_line'
          : modelLine < priceLine
            ? 'before:d' + (priceLine - modelLine)
            : 'after:d' + (modelLine - priceLine)
        : 'price_source_unknown';
      row.source_relation[relation] = (row.source_relation[relation] || 0) + 1;

      if (Number.isFinite(priceLine) && modelLine === priceLine) {
        row.direct_model_on_price_line += 1;
      } else if (Number.isFinite(priceLine)) {
        row.inherited_model_to_price += 1;
      }

      const bucketKey = model + '|' + modelLine;
      sourceCountsByModel.set(bucketKey, (sourceCountsByModel.get(bucketKey) || 0) + 1);
    }
  }

  for (const model of targets) {
    const row = ensure(model);
    const counts = [...sourceCountsByModel.entries()]
      .filter(([key]) => key.startsWith(model + '|'))
      .map(([, count]) => count);
    row.anchors.distinct_source_lines = counts.length;
    row.anchors.max_surplus_per_source_line = counts.length ? Math.max(...counts) : 0;
    row.anchors.source_lines_with_multiple_surplus = counts.filter(count => count > 1).length;
  }

  return byModel;
}

const eModelSurplusSourceDiagnostic =
  eModelSurplusSourceDiagnostics(legacySupplierAware, coreBundle);

function surplusPriceSourceShapeDiagnostics(legacyBundle, coreBundleInput) {
  const legacyCounts = new Map();
  for (const offer of legacyBundle?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }

  const segmentsByLine = new Map(
    (coreBundleInput.segments || []).map(segment => [Number(segment.line_number), segment])
  );
  const coreByKey = new Map();
  for (const offer of coreOffers(coreBundleInput)) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    if (!coreByKey.has(key)) coreByKey.set(key, []);
    coreByKey.get(key).push(offer);
  }

  const aggregate = {};
  const byModel = {};
  const bump = (bucket, key) => {
    bucket[key] = (bucket[key] || 0) + 1;
  };
  const safeShape = (offer, sourceSegment) => {
    const priceTrace = (offer.trace || []).find(item => item.field === 'price');
    const modelTrace = (offer.trace || []).find(item => item.field === 'model');
    const priceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
      ? Number(priceTrace.sources[0])
      : null;
    const modelLine = Array.isArray(modelTrace?.sources) && modelTrace.sources.length
      ? Number(modelTrace.sources[0])
      : null;
    const normalized = String(sourceSegment?.normalized || '');
    const candidateFields = new Set((sourceSegment?.field_candidates || []).map(candidate => candidate.field));
    const tokenCount = normalized.trim() ? normalized.trim().split(/\s+/).filter(Boolean).length : 0;
    const role = sourceSegment?.role_candidates?.[0]?.role || 'unknown';

    return [
      'role=' + role,
      'currency=' + (/R\$|\$/.test(normalized) ? 'yes' : 'no'),
      'numeric_only=' + (/^[^A-Za-zÀ-ÿ]*[0-9][0-9.,\s]*$/.test(normalized) ? 'yes' : 'no'),
      'installment_hint=' + (/\b(?:x|vezes|parcela|parcelado|cart[aã]o)\b/i.test(normalized) ? 'yes' : 'no'),
      'cash_hint=' + (/\b(?:pix|avista|a\s+vista|dinheiro)\b/i.test(normalized) ? 'yes' : 'no'),
      'promo_hint=' + (/\b(?:promo|promoc|oferta)\b/i.test(normalized) ? 'yes' : 'no'),
      'price_candidates=' + (sourceSegment?.field_candidates || []).filter(candidate => candidate.field === 'price').length,
      'has_color=' + (candidateFields.has('color') ? 'yes' : 'no'),
      'has_condition=' + (candidateFields.has('condition') ? 'yes' : 'no'),
      'has_model=' + (candidateFields.has('model') ? 'yes' : 'no'),
      'tokens=' + (tokenCount <= 2 ? '0-2' : tokenCount <= 5 ? '3-5' : '6+'),
      'model_distance=' + (
        Number.isFinite(priceLine) && Number.isFinite(modelLine)
          ? Math.abs(priceLine - modelLine)
          : 'unknown'
      )
    ].join('|');
  };

  for (const [key, offers] of coreByKey.entries()) {
    const legacyCount = legacyCounts.get(key) || 0;
    if (offers.length <= legacyCount) continue;

    for (let index = legacyCount; index < offers.length; index += 1) {
      const offer = offers[index];
      const priceTrace = (offer.trace || []).find(item => item.field === 'price');
      const priceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
        ? Number(priceTrace.sources[0])
        : null;
      const sourceSegment = Number.isFinite(priceLine) ? segmentsByLine.get(priceLine) : null;
      const shape = safeShape(offer, sourceSegment);
      bump(aggregate, shape);

      const model = offer.fields?.model?.id || '(unknown)';
      if (!byModel[model]) byModel[model] = {};
      bump(byModel[model], shape);
    }
  }

  return {
    aggregate: Object.entries(aggregate)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {}),
    by_model: byModel
  };
}

const surplusPriceSourceShapeDiagnostic =
  surplusPriceSourceShapeDiagnostics(legacySupplierAware, coreBundle);

function priceSourceShapeSupportDiagnostics(legacyBundle, coreBundleInput) {
  const legacyCounts = new Map();
  for (const offer of legacyBundle?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }

  const segmentsByLine = new Map(
    (coreBundleInput.segments || []).map(segment => [Number(segment.line_number), segment])
  );
  const coreByKey = new Map();
  for (const offer of coreOffers(coreBundleInput)) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    if (!coreByKey.has(key)) coreByKey.set(key, []);
    coreByKey.get(key).push(offer);
  }

  const shapeOf = offer => {
    const priceTrace = (offer.trace || []).find(item => item.field === 'price');
    const modelTrace = (offer.trace || []).find(item => item.field === 'model');
    const priceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
      ? Number(priceTrace.sources[0])
      : null;
    const modelLine = Array.isArray(modelTrace?.sources) && modelTrace.sources.length
      ? Number(modelTrace.sources[0])
      : null;
    const segment = Number.isFinite(priceLine) ? segmentsByLine.get(priceLine) : null;
    const normalized = String(segment?.normalized || '');
    const fields = new Set((segment?.field_candidates || []).map(candidate => candidate.field));
    const tokenCount = normalized.trim() ? normalized.trim().split(/\s+/).filter(Boolean).length : 0;
    return [
      'role=' + (segment?.role_candidates?.[0]?.role || 'unknown'),
      'currency=' + (/R\$|\$/.test(normalized) ? 'yes' : 'no'),
      'numeric_only=' + (/^[^A-Za-zÀ-ÿ]*[0-9][0-9.,\s]*$/.test(normalized) ? 'yes' : 'no'),
      'price_candidates=' + (segment?.field_candidates || []).filter(candidate => candidate.field === 'price').length,
      'has_color=' + (fields.has('color') ? 'yes' : 'no'),
      'has_model=' + (fields.has('model') ? 'yes' : 'no'),
      'tokens=' + (tokenCount <= 2 ? '0-2' : tokenCount <= 5 ? '3-5' : '6+'),
      'model_distance=' + (
        Number.isFinite(priceLine) && Number.isFinite(modelLine)
          ? Math.abs(priceLine - modelLine)
          : 'unknown'
      )
    ].join('|');
  };

  const rows = {};
  const ensure = shape => {
    if (!rows[shape]) rows[shape] = { supported: 0, surplus: 0 };
    return rows[shape];
  };

  for (const [key, offers] of coreByKey.entries()) {
    const supportedSlots = Math.min(legacyCounts.get(key) || 0, offers.length);
    for (let i = 0; i < offers.length; i += 1) {
      const row = ensure(shapeOf(offers[i]));
      if (i < supportedSlots) row.supported += 1;
      else row.surplus += 1;
    }
  }

  const ordered = Object.entries(rows)
    .filter(([, value]) => value.surplus > 0)
    .sort((a, b) =>
      (a[1].supported === 0 ? -1 : 1) - (b[1].supported === 0 ? -1 : 1) ||
      b[1].surplus - a[1].surplus ||
      a[0].localeCompare(b[0])
    );

  return {
    surplus_only_shapes: ordered
      .filter(([, value]) => value.supported === 0)
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {}),
    mixed_shapes: ordered
      .filter(([, value]) => value.supported > 0)
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
  };
}

const priceSourceShapeSupportDiagnostic =
  priceSourceShapeSupportDiagnostics(legacySupplierAware, coreBundle);

function surplusLongHeaderPriceEvidenceDiagnostics(legacyBundle, coreBundleInput) {
  const legacyCounts = new Map();
  for (const offer of legacyBundle?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }

  const segmentsByLine = new Map(
    (coreBundleInput.segments || []).map(segment => [Number(segment.line_number), segment])
  );
  const coreByKey = new Map();
  for (const offer of coreOffers(coreBundleInput)) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    if (!coreByKey.has(key)) coreByKey.set(key, []);
    coreByKey.get(key).push(offer);
  }

  const evidence = {};
  let cases = 0;

  for (const [key, offers] of coreByKey.entries()) {
    const supportedSlots = Math.min(legacyCounts.get(key) || 0, offers.length);
    for (let i = supportedSlots; i < offers.length; i += 1) {
      const offer = offers[i];
      const priceTrace = (offer.trace || []).find(item => item.field === 'price');
      const priceLine = Array.isArray(priceTrace?.sources) && priceTrace.sources.length
        ? Number(priceTrace.sources[0])
        : null;
      if (!Number.isFinite(priceLine)) continue;

      const segment = segmentsByLine.get(priceLine);
      if (!segment) continue;
      if ((segment.role_candidates?.[0]?.role || 'unknown') !== 'product_header') continue;

      const normalized = String(segment.normalized || '');
      if (/R\$|\$/.test(normalized)) continue;
      const candidates = segment.field_candidates || [];
      if (candidates.some(candidate => candidate.field === 'model')) continue;
      if (candidates.some(candidate => candidate.field === 'color')) continue;
      const tokenCount = normalized.trim() ? normalized.trim().split(/\s+/).filter(Boolean).length : 0;
      if (tokenCount < 6) continue;

      const priceCandidates = candidates.filter(candidate => candidate.field === 'price');
      if (priceCandidates.length !== 1) continue;
      cases += 1;

      const candidate = priceCandidates[0];
      const pattern = String(candidate.evidence?.pattern || '');
      const patternClass =
        pattern.includes('💰') || pattern.includes('💵') ? 'money_emoji' :
        pattern.includes('PROMO') ? 'suffix_fallback' :
        pattern.includes('(?:R\\$|\\$)') ? 'currency_required' :
        pattern ? 'other_regex' : 'no_pattern';
      const score = Number(candidate.score);
      const scoreKey = Number.isFinite(score) ? score.toFixed(3) : 'unknown';
      const traceScore = Number(priceTrace?.score);
      const traceScoreKey = Number.isFinite(traceScore) ? traceScore.toFixed(3) : 'unknown';
      const keyOut = [
        'candidate_pattern=' + patternClass,
        'candidate_score=' + scoreKey,
        'trace_score=' + traceScoreKey,
        'price_rule=' + ((priceTrace?.rules || []).join('+') || '(no-trace)')
      ].join('|');
      evidence[keyOut] = (evidence[keyOut] || 0) + 1;
    }
  }

  return {
    cases,
    evidence: Object.entries(evidence)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
  };
}

const surplusLongHeaderPriceEvidenceDiagnostic =
  surplusLongHeaderPriceEvidenceDiagnostics(legacySupplierAware, coreBundle);

function distinctFieldValues(segment, field) {
  return [...new Set(
    (segment.field_candidates || [])
      .filter(candidate => candidate.field === field)
      .map(candidate => JSON.stringify(candidate.value))
  )];
}

function modelContextDiagnostics(bundle) {
  const segments = bundle.segments || [];
  let priceSegments = 0;
  let priceWithDirectModel = 0;
  let priceWithInheritedModel = 0;
  let priceWithoutModel = 0;
  let modelCandidateSegments = 0;
  let modelCandidateResolved = 0;
  let modelCandidateUnresolved = 0;
  let modelCandidateAmbiguous = 0;

  for (const segment of segments) {
    const prices = distinctFieldValues(segment, 'price');
    const directModels = (segment.field_candidates || []).filter(candidate => candidate.field === 'model');
    const semanticModels = (segment.semantic_candidates || []).filter(candidate => candidate.field === 'model');

    if (directModels.length) {
      modelCandidateSegments += 1;
      if (semanticModels.some(candidate => candidate.state === 'interpreted' || candidate.state === 'inferred')) {
        modelCandidateResolved += 1;
      } else if (semanticModels.some(candidate => candidate.state === 'ambiguous')) {
        modelCandidateAmbiguous += 1;
      } else {
        modelCandidateUnresolved += 1;
      }
    }

    if (prices.length !== 1) continue;
    priceSegments += 1;
    if (directModels.length) priceWithDirectModel += 1;
    else if (segment.inherited_context?.model) priceWithInheritedModel += 1;
    else priceWithoutModel += 1;
  }

  return {
    price_segments: priceSegments,
    price_with_direct_model: priceWithDirectModel,
    price_with_inherited_model: priceWithInheritedModel,
    price_without_model: priceWithoutModel,
    model_candidate_segments: modelCandidateSegments,
    model_candidate_resolved: modelCandidateResolved,
    model_candidate_unresolved: modelCandidateUnresolved,
    model_candidate_ambiguous: modelCandidateAmbiguous
  };
}

function iphoneModelShape(value) {
  const key = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/promax/g, 'pro max')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const generation = /\biphone\s+(xr|\d{1,2}e?)\b/.exec(key)?.[1] || null;
  if (!generation) return null;

  let variant = 'base';
  if (/\bpro\s+max\b/.test(key)) variant = 'pro max';
  else if (/\bpro\b/.test(key)) variant = 'pro';
  else if (/\bplus\b/.test(key)) variant = 'plus';
  else if (/\bmini\b/.test(key)) variant = 'mini';
  else if (/\bair\b/.test(key)) variant = 'air';

  const gb = /\b(64|128|256|512|1024|2048)\s*gb\b/.exec(key);
  const tb = /\b([12])\s*tb\b/.exec(key);
  let capacity = gb ? Number(gb[1]) : null;
  if (tb) capacity = Number(tb[1]) * 1024;
  if (capacity == null) {
    const bare = /\b(64|128|256|512|1024|2048)\b/.exec(key);
    capacity = bare ? Number(bare[1]) : null;
  }
  if (capacity == null) return null;
  return `${generation}|${variant}|${capacity}`;
}

function orderedPairFallbackDiagnostics(bundle) {
  const segments = bundle.segments || [];
  const blocks = [];
  let current = null;

  const close = end => {
    if (current && end > current.start) blocks.push({ ...current, end });
    current = null;
  };

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const hardBoundary = (segment.context_events || []).some(event =>
      event.reason === 'timestamp_boundary' || event.reason === 'domain_boundary'
    );
    if (hardBoundary) close(index);

    const semanticModels = (segment.semantic_candidates || []).filter(candidate => candidate.field === 'model');
    const hasModelCandidate = (segment.field_candidates || []).some(candidate => candidate.field === 'model');
    if (hasModelCandidate) {
      close(index);
      const resolved = semanticModels.find(candidate =>
        (candidate.state === 'interpreted' || candidate.state === 'inferred') && candidate.entity_id
      );
      if (resolved) current = { start: index, model_id: resolved.entity_id };
    }
  }
  close(segments.length);

  let equalBlocks = 0;
  let mismatchBlocks = 0;
  let mismatchColorRows = 0;
  let mismatchBarePriceRows = 0;
  let uniqueNearestColorRows = 0;
  let tiedNearestColorRows = 0;
  const uniqueNearestByDirectionDistance = {};

  for (const block of blocks) {
    const colors = [];
    const prices = [];
    for (let index = block.start; index < block.end; index += 1) {
      const segment = segments[index];
      const colorCandidates = distinctFieldValues(segment, 'color');
      const priceCandidates = distinctFieldValues(segment, 'price');
      if (colorCandidates.length > 0 && priceCandidates.length === 0 && isFieldOnlySegment(segment, 'color')) {
        colors.push({ index, line: segment.line_number });
      }
      if (priceCandidates.length === 1 && colorCandidates.length === 0) {
        prices.push({ index, line: segment.line_number });
      }
    }

    if (!colors.length || !prices.length) continue;
    if (colors.length === prices.length) {
      equalBlocks += 1;
      continue;
    }

    mismatchBlocks += 1;
    mismatchColorRows += colors.length;
    mismatchBarePriceRows += prices.length;

    for (const color of colors) {
      const distances = prices
        .map(price => Math.abs(price.index - color.index))
        .sort((a, b) => a - b);
      if (!distances.length) continue;
      if (distances.length === 1 || distances[0] < distances[1]) {
        uniqueNearestColorRows += 1;
        const nearest = prices
          .map(price => ({ price, distance: Math.abs(price.index - color.index) }))
          .sort((a, b) => a.distance - b.distance || a.price.index - b.price.index)[0];
        const direction = nearest.price.index > color.index ? 'before_price' : 'after_price';
        const key = `${direction}|distance=${nearest.distance}`;
        uniqueNearestByDirectionDistance[key] = (uniqueNearestByDirectionDistance[key] || 0) + 1;
      } else tiedNearestColorRows += 1;
    }
  }

  return {
    equal_pairable_blocks: equalBlocks,
    mismatched_pair_blocks: mismatchBlocks,
    mismatch_color_rows: mismatchColorRows,
    mismatch_bare_price_rows: mismatchBarePriceRows,
    unique_nearest_color_rows: uniqueNearestColorRows,
    tied_nearest_color_rows: tiedNearestColorRows,
    unique_nearest_by_direction_distance: uniqueNearestByDirectionDistance
  };
}

function supportedBlockDiagnostics(bundle) {
  const segments = bundle.segments || [];
  let currentModelId = null;
  let supportedAnchors = 0;
  let supportedBlockPriceSegments = 0;
  let supportedBlockSinglePriceSegments = 0;
  let supportedBlockMultiPriceSegments = 0;
  let supportedBlockPriceWithDirectColor = 0;
  let supportedBlockPriceWithoutDirectColor = 0;
  const perModel = {};
  const touch = modelId => {
    if (!perModel[modelId]) {
      perModel[modelId] = {
        anchors: 0,
        price_segments: 0,
        price_with_color: 0,
        price_without_color: 0,
        color_only_rows: 0,
        color_candidates_on_color_only_rows: 0,
        materialized_records: 0
      };
    }
    return perModel[modelId];
  };

  for (const record of bundle.records || []) {
    const modelId = record.fields?.model?.id;
    if (modelId) touch(modelId).materialized_records += 1;
  }

  for (const segment of segments) {
    if ((segment.context_events || []).some(event => event.reason === 'timestamp_boundary')) {
      currentModelId = null;
    }

    const modelCandidates = (segment.semantic_candidates || []).filter(candidate =>
      candidate.field === 'model'
    );
    if (modelCandidates.length) {
      const resolved = modelCandidates.find(candidate =>
        (candidate.state === 'interpreted' || candidate.state === 'inferred') && candidate.entity_id
      );
      currentModelId = resolved?.entity_id || null;
      if (currentModelId) {
        supportedAnchors += 1;
        touch(currentModelId).anchors += 1;
      }
    }

    if (!currentModelId) continue;
    const colors = distinctFieldValues(segment, 'color');
    const prices = distinctFieldValues(segment, 'price');

    if (colors.length > 0 && prices.length === 0 && isFieldOnlySegment(segment, 'color')) {
      touch(currentModelId).color_only_rows += 1;
      touch(currentModelId).color_candidates_on_color_only_rows += colors.length;
    }

    if (!prices.length) continue;

    supportedBlockPriceSegments += 1;
    touch(currentModelId).price_segments += 1;
    if (prices.length === 1) supportedBlockSinglePriceSegments += 1;
    else supportedBlockMultiPriceSegments += 1;

    if (colors.length) {
      supportedBlockPriceWithDirectColor += 1;
      touch(currentModelId).price_with_color += 1;
    } else {
      supportedBlockPriceWithoutDirectColor += 1;
      touch(currentModelId).price_without_color += 1;
    }
  }

  return {
    supported_anchors: supportedAnchors,
    supported_block_price_segments: supportedBlockPriceSegments,
    supported_block_single_price_segments: supportedBlockSinglePriceSegments,
    supported_block_multi_price_segments: supportedBlockMultiPriceSegments,
    supported_block_price_with_direct_color: supportedBlockPriceWithDirectColor,
    supported_block_price_without_direct_color: supportedBlockPriceWithoutDirectColor,
    materialized_records: (bundle.records || []).length,
    per_model: perModel
  };
}

function relaxedSupportedHeaderDiagnostics(bundle, knowledgeSnapshot) {
  const supported = new Map();
  for (const entity of knowledgeSnapshot.entities || []) {
    if (entity.kind !== 'model') continue;
    const shape = iphoneModelShape(entity.label);
    if (shape) supported.set(shape, entity.id);
  }

  const byModel = {};
  let candidates = 0;
  let withIphoneToken = 0;
  let withoutIphoneToken = 0;
  let proMaxCompact = 0;

  for (const segment of bundle.segments || []) {
    if ((segment.field_candidates || []).some(candidate => candidate.field === 'model')) continue;
    if (distinctFieldValues(segment, 'price').length > 0) continue;
    const raw = String(segment.normalized || '');
    if (!raw || raw.length > 90) continue;
    const key = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const capMatch = /(?:^|\D)(64|128|256|512)(?:\s*gb)?(?:\D|$)/.exec(key);
    if (!capMatch) continue;
    const capacity = Number(capMatch[1]);

    const genMatch = /(?:iphone\s*)?\b(13|15|16e?|17e?)\b/.exec(key)
      || /\b(13|15|16e?|17e?)(?=(?:pm|p)\b)/.exec(key);
    if (!genMatch) continue;
    const generation = genMatch[1];

    let variant = 'base';
    if (/\bpro\s*max\b|\bpromax\b|\b(?:13|15|16|17)pm\b/.test(key)) {
      variant = 'pro max';
      if (/\b(?:13|15|16|17)pm\b/.test(key)) proMaxCompact += 1;
    } else if (/\bpro\b|\b(?:13|15|16|17)p\b/.test(key)) {
      variant = 'pro';
    } else if (/\bair\b/.test(key)) {
      variant = 'air';
    } else if (/\bplus\b/.test(key)) {
      variant = 'plus';
    } else if (/\bmini\b/.test(key)) {
      variant = 'mini';
    }

    const shape = `${generation}|${variant}|${capacity}`;
    const modelId = supported.get(shape);
    if (!modelId) continue;

    candidates += 1;
    if (/\biphone\b/.test(key)) withIphoneToken += 1;
    else withoutIphoneToken += 1;
    byModel[modelId] = (byModel[modelId] || 0) + 1;
  }

  return {
    relaxed_supported_header_candidates: candidates,
    with_iphone_token: withIphoneToken,
    without_iphone_token: withoutIphoneToken,
    compact_pro_max_candidates: proMaxCompact,
    by_model: byModel
  };
}

function unresolvedModelDiagnostics(bundle, knowledgeSnapshot) {
  const supportedByShape = new Map();
  for (const entity of knowledgeSnapshot.entities || []) {
    if (entity.kind !== 'model') continue;
    const shape = iphoneModelShape(entity.label);
    if (shape) supportedByShape.set(shape, entity.id);
  }

  let unresolvedCandidates = 0;
  let unresolvedNearSupported = 0;
  const nearSupportedByModel = {};

  for (const segment of bundle.segments || []) {
    const semantic = (segment.semantic_candidates || []).filter(candidate =>
      candidate.field === 'model' && candidate.state === 'unresolved'
    );
    for (const candidate of semantic) {
      unresolvedCandidates += 1;
      const shape = iphoneModelShape(candidate.input);
      const modelId = shape ? supportedByShape.get(shape) : null;
      if (!modelId) continue;
      unresolvedNearSupported += 1;
      nearSupportedByModel[modelId] = (nearSupportedByModel[modelId] || 0) + 1;
    }
  }

  return {
    unresolved_model_candidates: unresolvedCandidates,
    unresolved_near_supported: unresolvedNearSupported,
    unresolved_near_supported_by_model: nearSupportedByModel
  };
}

function anchorSpanDiagnostics(bundle) {
  const segments = bundle.segments || [];
  const spans = [];
  let current = null;

  const close = (endIndex, reason) => {
    if (!current) return;
    const endLine = endIndex > current.start_index
      ? (segments[Math.min(endIndex - 1, segments.length - 1)]?.line_number ?? current.start_line)
      : current.start_line;
    spans.push({
      model_id: current.model_id,
      anchor_line: current.start_line,
      end_line: endLine,
      span_lines: Math.max(1, endLine - current.start_line + 1),
      price_segments: current.price_segments,
      materialized_records: current.materialized_records,
      close_reason: reason
    });
    current = null;
  };

  const recordsByAnchorLine = new Map();
  for (const record of bundle.records || []) {
    const modelTrace = (record.trace || []).find(trace => trace.field === 'model');
    const lines = [
      ...(modelTrace?.sources || []),
      ...(modelTrace?.derived_from || [])
    ].filter(Number.isFinite);
    const anchorLine = lines.length ? Math.min(...lines) : null;
    if (anchorLine == null) continue;
    recordsByAnchorLine.set(anchorLine, (recordsByAnchorLine.get(anchorLine) || 0) + 1);
  }

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const boundary = (segment.context_events || []).find(event =>
      event.reason === 'timestamp_boundary' ||
      event.reason === 'domain_boundary' ||
      event.reason === 'supplier_boundary'
    );

    if (boundary && current) close(index, boundary.reason);

    const semanticModels = (segment.semantic_candidates || []).filter(candidate =>
      candidate.field === 'model' &&
      (candidate.state === 'interpreted' || candidate.state === 'inferred') &&
      candidate.entity_id
    );

    const resolved = semanticModels[0] || null;
    if (resolved) {
      if (current) close(index, 'new_model_anchor');
      current = {
        model_id: resolved.entity_id,
        start_index: index,
        start_line: segment.line_number,
        price_segments: 0,
        materialized_records: recordsByAnchorLine.get(segment.line_number) || 0
      };
    }

    if (!current) continue;
    if (distinctFieldValues(segment, 'price').length > 0) {
      current.price_segments += 1;
    }
  }

  if (current) close(segments.length, 'end_of_document');

  const pathological = spans
    .filter(span => span.price_segments >= 4 || span.span_lines >= 12 || span.materialized_records >= 4)
    .sort((a, b) =>
      b.price_segments - a.price_segments ||
      b.materialized_records - a.materialized_records ||
      b.span_lines - a.span_lines ||
      a.anchor_line - b.anchor_line
    );

  const byModel = {};
  for (const span of spans) {
    const bucket = byModel[span.model_id] || {
      anchors: 0,
      price_segments: 0,
      materialized_records: 0,
      max_price_segments_per_anchor: 0,
      max_span_lines: 0
    };
    bucket.anchors += 1;
    bucket.price_segments += span.price_segments;
    bucket.materialized_records += span.materialized_records;
    bucket.max_price_segments_per_anchor = Math.max(bucket.max_price_segments_per_anchor, span.price_segments);
    bucket.max_span_lines = Math.max(bucket.max_span_lines, span.span_lines);
    byModel[span.model_id] = bucket;
  }

  return {
    total_anchor_spans: spans.length,
    pathological_anchor_spans: pathological.length,
    by_model: byModel,
    top_pathological_spans: pathological.slice(0, 30)
  };
}

function supplierBoundaryDiagnostics(bundle) {
  const out = {
    boundary_events: 0,
    supplier_only_segments: 0,
    with_model: 0,
    with_price: 0,
    with_condition: 0,
    with_color: 0,
    with_timestamp: 0,
    by_supplier: {}
  };

  for (const segment of bundle.segments || []) {
    const boundary = (segment.context_events || []).some(event => event.reason === 'supplier_boundary');
    if (!boundary) continue;
    out.boundary_events += 1;

    const supplierCandidates = (segment.field_candidates || []).filter(candidate => candidate.field === 'supplier');
    const suppliers = distinctFieldValues(segment, 'supplier');
    const supplier = suppliers.length === 1 ? JSON.parse(suppliers[0]) : '(ambiguous)';
    out.by_supplier[supplier] = (out.by_supplier[supplier] || 0) + 1;

    out.by_captured_alias = out.by_captured_alias || {};
    for (const candidate of supplierCandidates) {
      const captured = candidate.evidence?.captured || '(unknown)';
      out.by_captured_alias[captured] = (out.by_captured_alias[captured] || 0) + 1;
    }

    const hasModel = distinctFieldValues(segment, 'model').length > 0;
    const hasPrice = distinctFieldValues(segment, 'price').length > 0;
    const hasCondition = distinctFieldValues(segment, 'condition').length > 0;
    const hasColor = distinctFieldValues(segment, 'color').length > 0;
    const hasTimestamp = (segment.context_events || []).some(event => event.reason === 'timestamp_boundary');

    if (hasModel) out.with_model += 1;
    if (hasPrice) out.with_price += 1;
    if (hasCondition) out.with_condition += 1;
    if (hasColor) out.with_color += 1;
    if (hasTimestamp) out.with_timestamp += 1;
    if (!hasModel && !hasPrice && !hasCondition && !hasColor) out.supplier_only_segments += 1;
  }

  return out;
}

function conditionDistributionDiagnostics(legacyBundle, coreBundle) {
  const count = offers => {
    const out = {};
    for (const offer of offers || []) {
      const model = offer?.fields?.model?.id;
      if (!model) continue;
      const condition = offer?.fields?.condition == null ? '(null)' : String(offer.fields.condition);
      out[model] = out[model] || {};
      out[model][condition] = (out[model][condition] || 0) + 1;
    }
    return out;
  };

  return {
    legacy: count(legacyBundle?.offers || []),
    core: count((coreBundle?.records || []).map(record => ({ fields: record.fields || {} })))
  };
}

function supplierAwareExpansionGroupDiagnostics(legacyBundle, coreBundleInput) {
  const legacyCounts = new Map();
  for (const offer of legacyBundle?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }

  const segmentsByLine = new Map(
    (coreBundleInput.segments || []).map(segment => [Number(segment.line_number), segment])
  );
  const groups = new Map();

  for (const offer of coreOffers(coreBundleInput)) {
    const match = /^(.*)-exp-\d+$/.exec(String(offer.core_record_id || ''));
    if (!match) continue;
    const colorTrace = (offer.trace || []).find(trace => trace.field === 'color');
    if (!colorTrace?.rules?.includes('record_expansion:pairing_nearest_unique')) continue;

    const priceTrace = (offer.trace || []).find(trace => trace.field === 'price');
    const colorLine = Array.isArray(colorTrace.sources) ? Number(colorTrace.sources[0]) : null;
    const priceLine = Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null;
    const groupId = match[1];

    if (!groups.has(groupId)) {
      const lo = Number.isFinite(colorLine) && Number.isFinite(priceLine) ? Math.min(colorLine, priceLine) : null;
      const hi = Number.isFinite(colorLine) && Number.isFinite(priceLine) ? Math.max(colorLine, priceLine) : null;
      const between = lo == null ? [] : (coreBundleInput.segments || []).filter(segment =>
        segment.line_number > lo && segment.line_number < hi
      );
      const source = segmentsByLine.get(colorLine);
      const sourceColorCount = source
        ? new Set((source.field_candidates || []).filter(c => c.field === 'color').map(c => JSON.stringify(c.value))).size
        : 0;
      const nearPriceLines = (coreBundleInput.segments || []).filter(segment =>
        Number.isFinite(colorLine) &&
        Math.abs(Number(segment.line_number) - colorLine) <= 3 &&
        new Set((segment.field_candidates || []).filter(c => c.field === 'price').map(c => JSON.stringify(c.value))).size === 1
      ).length;
      const nearColorOnlyLines = (coreBundleInput.segments || []).filter(segment =>
        Number.isFinite(colorLine) &&
        Math.abs(Number(segment.line_number) - colorLine) <= 3 &&
        isFieldOnlySegment(segment, 'color')
      ).length;

      groups.set(groupId, {
        model_id: offer.fields?.model?.id || '(unknown)',
        supplier_id: offer.fields?.supplier || '(unknown)',
        size: 0,
        exact_supported: 0,
        surplus: 0,
        distance: Number.isFinite(colorLine) && Number.isFinite(priceLine) ? Math.abs(priceLine - colorLine) : null,
        direction: Number.isFinite(colorLine) && Number.isFinite(priceLine)
          ? (colorLine < priceLine ? 'before' : colorLine > priceLine ? 'after' : 'same')
          : 'unknown',
        source_color_count: sourceColorCount,
        nearby_price_lines: nearPriceLines,
        nearby_color_only_lines: nearColorOnlyLines,
        between_has_price: between.some(segment =>
          (segment.field_candidates || []).some(candidate => candidate.field === 'price')
        ),
        between_has_color: between.some(segment =>
          (segment.field_candidates || []).some(candidate => candidate.field === 'color')
        ),
        between_has_model: between.some(segment =>
          (segment.field_candidates || []).some(candidate => candidate.field === 'model')
        ),
        between_has_condition: between.some(segment =>
          (segment.field_candidates || []).some(candidate => candidate.field === 'condition')
        ),
        between_unknown_lines: between.filter(segment =>
          (segment.role_candidates || [])[0]?.role === 'unknown'
        ).length,
        color_offsets: [],
        offset_quality: {}
      });
    }

    const row = groups.get(groupId);
    row.size += 1;
    const offset = Number.isFinite(colorLine) && Number.isFinite(priceLine)
      ? colorLine - priceLine
      : null;
    if (offset != null) row.color_offsets.push(offset);

    const key = offerKey(offer.fields || {}, { include_supplier: true });
    const remaining = legacyCounts.get(key) || 0;
    const qualityKey = offset == null
      ? 'offset=unknown'
      : 'offset=' + (offset < 0 ? 'before' : offset > 0 ? 'after' : 'same') + ':d' + Math.abs(offset);
    if (!row.offset_quality[qualityKey]) {
      row.offset_quality[qualityKey] = { total: 0, exact_supported: 0, surplus: 0 };
    }
    row.offset_quality[qualityKey].total += 1;

    if (remaining > 0) {
      row.exact_supported += 1;
      row.offset_quality[qualityKey].exact_supported += 1;
      legacyCounts.set(key, remaining - 1);
    } else {
      row.surplus += 1;
      row.offset_quality[qualityKey].surplus += 1;
    }
  }

  const summary = {};
  const byModel = {};
  const byModelSupplier = {};
  const bySupplierDirection = {};
  const bySupplierMixedOffset = {};
  const directionClass = offsets => {
    const hasBefore = offsets.some(value => value < 0);
    const hasAfter = offsets.some(value => value > 0);
    if (hasBefore && hasAfter) return 'mixed';
    if (hasBefore) return 'before_only';
    if (hasAfter) return 'after_only';
    return 'same_or_unknown';
  };
  for (const row of groups.values()) {
    const signature = [
      'distance=' + row.distance,
      'direction=' + row.direction,
      'group_size=' + row.size,
      'source_colors=' + row.source_color_count,
      'near_prices=' + row.nearby_price_lines,
      'near_color_rows=' + row.nearby_color_only_lines,
      'between_price=' + (row.between_has_price ? 'yes' : 'no'),
      'between_color=' + (row.between_has_color ? 'yes' : 'no'),
      'between_model=' + (row.between_has_model ? 'yes' : 'no'),
      'between_condition=' + (row.between_has_condition ? 'yes' : 'no'),
      'between_unknown=' + row.between_unknown_lines,
      'offsets=' + row.color_offsets.slice().sort((a, b) => a - b).join(',')
    ].join('|');

    const add = (bucket, key) => {
      if (!bucket[key]) bucket[key] = { groups: 0, offers: 0, exact_supported: 0, surplus: 0 };
      bucket[key].groups += 1;
      bucket[key].offers += row.size;
      bucket[key].exact_supported += row.exact_supported;
      bucket[key].surplus += row.surplus;
    };

    add(summary, signature);
    add(byModel, row.model_id + ' | ' + signature);
    add(byModelSupplier, row.model_id + ' | supplier=' + row.supplier_id + ' | ' + signature);

    const direction = directionClass(row.color_offsets);
    const supplierDirectionKey = 'supplier=' + row.supplier_id + '|direction=' + direction;
    add(bySupplierDirection, supplierDirectionKey);

    if (direction === 'mixed') {
      for (const [offsetKey, quality] of Object.entries(row.offset_quality || {})) {
        const key = 'supplier=' + row.supplier_id + '|mixed|' + offsetKey;
        if (!bySupplierMixedOffset[key]) {
          bySupplierMixedOffset[key] = { total: 0, exact_supported: 0, surplus: 0 };
        }
        bySupplierMixedOffset[key].total += quality.total;
        bySupplierMixedOffset[key].exact_supported += quality.exact_supported;
        bySupplierMixedOffset[key].surplus += quality.surplus;
      }
    }
  }
  const supplierDirectionEvidence = {};
  for (const row of groups.values()) {
    const direction = directionClass(row.color_offsets);
    if (direction !== 'before_only' && direction !== 'after_only') continue;
    if (!supplierDirectionEvidence[row.supplier_id]) {
      supplierDirectionEvidence[row.supplier_id] = {
        before_only_groups: 0,
        after_only_groups: 0
      };
    }
    supplierDirectionEvidence[row.supplier_id][direction + '_groups'] += 1;
  }

  const dominanceSimulation = {
    policy: 'min_3_pure_groups_zero_opposite_drop_mixed_opposite_at_max_distance',
    candidates: 0,
    exact_supported_would_drop: 0,
    surplus_would_drop: 0,
    by_supplier: {}
  };

  for (const row of groups.values()) {
    if (directionClass(row.color_offsets) !== 'mixed') continue;
    const evidence = supplierDirectionEvidence[row.supplier_id];
    if (!evidence) continue;

    let dominant = null;
    if (evidence.after_only_groups >= 3 && evidence.before_only_groups === 0) dominant = 'after';
    if (evidence.before_only_groups >= 3 && evidence.after_only_groups === 0) dominant = 'before';
    if (!dominant) continue;

    for (const [offsetKey, quality] of Object.entries(row.offset_quality || {})) {
      const match = /^offset=(before|after):d(\d+)$/.exec(offsetKey);
      if (!match) continue;
      const direction = match[1];
      const distance = Number(match[2]);
      if (direction === dominant || distance < 3) continue;

      dominanceSimulation.candidates += quality.total;
      dominanceSimulation.exact_supported_would_drop += quality.exact_supported;
      dominanceSimulation.surplus_would_drop += quality.surplus;

      const key = row.supplier_id;
      if (!dominanceSimulation.by_supplier[key]) {
        dominanceSimulation.by_supplier[key] = {
          dominant_direction: dominant,
          pure_before_groups: evidence.before_only_groups,
          pure_after_groups: evidence.after_only_groups,
          candidates: 0,
          exact_supported_would_drop: 0,
          surplus_would_drop: 0
        };
      }
      dominanceSimulation.by_supplier[key].candidates += quality.total;
      dominanceSimulation.by_supplier[key].exact_supported_would_drop += quality.exact_supported;
      dominanceSimulation.by_supplier[key].surplus_would_drop += quality.surplus;
    }
  }

  return {
    aggregate: summary,
    by_model: byModel,
    by_model_supplier: byModelSupplier,
    by_supplier_direction: bySupplierDirection,
    by_supplier_mixed_offset: bySupplierMixedOffset,
    supplier_direction_evidence: supplierDirectionEvidence,
    dominance_policy_simulation: dominanceSimulation
  };
}

function supplierAwarePairingTraceDiagnostics(legacyBundle, coreBundleInput) {
  const legacyCounts = new Map();
  for (const offer of legacyBundle?.offers || []) {
    const key = offerKey(offer.fields || {}, { include_supplier: true });
    legacyCounts.set(key, (legacyCounts.get(key) || 0) + 1);
  }

  const out = {};
  const offers = coreOffers(coreBundleInput);
  for (const offer of offers) {
    const colorTrace = (offer.trace || []).find(trace => trace.field === 'color');
    const rules = Array.isArray(colorTrace?.rules) ? colorTrace.rules : [];
    const pairingRule = rules.find(rule =>
      rule === 'pairing:nearest_unique' ||
      rule === 'record_expansion:pairing_nearest_unique'
    );
    if (!pairingRule) continue;

    const priceTrace = (offer.trace || []).find(trace => trace.field === 'price');
    const colorLine = Array.isArray(colorTrace?.sources) ? Number(colorTrace.sources[0]) : null;
    const priceLine = Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null;
    const distance = Number.isFinite(colorLine) && Number.isFinite(priceLine)
      ? Math.abs(priceLine - colorLine)
      : null;
    const signature = pairingRule + '|distance=' + (distance == null ? 'unknown' : distance);

    if (!out[signature]) out[signature] = { total: 0, exact_supported: 0, surplus: 0 };
    out[signature].total += 1;

    const key = offerKey(offer.fields || {}, { include_supplier: true });
    const remaining = legacyCounts.get(key) || 0;
    if (remaining > 0) {
      out[signature].exact_supported += 1;
      legacyCounts.set(key, remaining - 1);
    } else {
      out[signature].surplus += 1;
    }
  }

  return out;
}

function offerExpansionDiagnostics(bundle) {
  const segments = bundle.segments || [];
  let directMultiColorSegments = 0;
  let priceTriggerSegments = 0;
  let priceWithDirectColor = 0;
  let priceWithoutDirectColor = 0;
  let priceWithRecentColorBefore = 0;
  let priceWithContiguousMultiColorBefore = 0;
  let priceWithContiguousMultiColorAfter = 0;
  let expandedRecords = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const colors = distinctFieldValues(segment, 'color');
    const prices = distinctFieldValues(segment, 'price');
    if (colors.length > 1) directMultiColorSegments += 1;
    if (prices.length !== 1) continue;

    priceTriggerSegments += 1;
    if (colors.length > 0) priceWithDirectColor += 1;
    else priceWithoutDirectColor += 1;

    if (colors.length === 0) {
      for (let back = index - 1; back >= 0 && back >= index - 4; back -= 1) {
        const prior = segments[back];
        if ((prior.context_events || []).some(event => event.reason === 'timestamp_boundary')) break;
        if (distinctFieldValues(prior, 'model').length > 0) break;
        if (distinctFieldValues(prior, 'color').length > 0) {
          priceWithRecentColorBefore += 1;
          break;
        }
      }
    }

    const immediateBefore = index > 0 ? distinctFieldValues(segments[index - 1], 'color') : [];
    if (immediateBefore.length > 1) priceWithContiguousMultiColorBefore += 1;

    if (index + 1 < segments.length) {
      const next = segments[index + 1];
      const nextHasBoundary = (next.context_events || []).some(event => event.reason === 'timestamp_boundary');
      const nextHasModel = distinctFieldValues(next, 'model').length > 0;
      const nextHasPrice = distinctFieldValues(next, 'price').length > 0;
      const immediateAfter = distinctFieldValues(next, 'color');
      if (!nextHasBoundary && !nextHasModel && !nextHasPrice && immediateAfter.length > 1) {
        priceWithContiguousMultiColorAfter += 1;
      }
    }
  }

  for (const record of bundle.records || []) {
    if (String(record.record_id || '').includes('-exp-')) expandedRecords += 1;
  }

  return {
    direct_multi_color_segments: directMultiColorSegments,
    price_trigger_segments: priceTriggerSegments,
    price_with_direct_color: priceWithDirectColor,
    price_without_direct_color: priceWithoutDirectColor,
    price_with_recent_color_before: priceWithRecentColorBefore,
    price_with_contiguous_multi_color_before: priceWithContiguousMultiColorBefore,
    price_with_contiguous_multi_color_after: priceWithContiguousMultiColorAfter,
    expanded_records: expandedRecords
  };
}

const expansionDiagnostic = offerExpansionDiagnostics(coreBundle);
const modelContextDiagnostic = modelContextDiagnostics(coreBundle);
const unresolvedModelDiagnostic = unresolvedModelDiagnostics(coreBundle, knowledge);
const relaxedSupportedHeaderDiagnostic = relaxedSupportedHeaderDiagnostics(coreBundle, knowledge);
const supportedBlockDiagnostic = supportedBlockDiagnostics(coreBundle);
const orderedPairFallbackDiagnostic = orderedPairFallbackDiagnostics(coreBundle);
const supplierBoundaryDiagnostic = supplierBoundaryDiagnostics(coreBundle);
const supplierRecordDiagnostic = (() => {
  const withSupplier = (coreBundle.records || []).filter(record => record?.fields?.supplier != null);
  const withoutSupplier = (coreBundle.records || []).filter(record => record?.fields?.supplier == null);
  const withoutByModel = {};
  for (const record of withoutSupplier) {
    const model = record?.fields?.model?.id || '(unknown)';
    withoutByModel[model] = (withoutByModel[model] || 0) + 1;
  }
  return {
    records_with_supplier: withSupplier.length,
    records_without_supplier: withoutSupplier.length,
    records_without_supplier_by_model: withoutByModel
  };
})();

const supplierlessContextDiagnostic = (() => {
  const segments = coreBundle.segments || [];
  const supplierSetLines = [];
  const timestampLines = [];

  for (const segment of segments) {
    for (const event of segment.context_events || []) {
      if (event.type === 'context_set' && event.field === 'supplier') {
        supplierSetLines.push({
          line: Number(segment.line_number),
          supplier: event.value
        });
      }
      if (event.reason === 'timestamp_boundary') {
        timestampLines.push(Number(segment.line_number));
      }
    }
  }

  const summary = {
    total: 0,
    with_prior_supplier: 0,
    with_prior_supplier_and_timestamp_between: 0,
    with_prior_supplier_without_timestamp_between: 0,
    without_prior_supplier: 0,
    by_model: {}
  };

  for (const record of coreBundle.records || []) {
    if (record?.fields?.supplier != null) continue;
    summary.total += 1;

    const model = record?.fields?.model?.id || '(unknown)';
    if (!summary.by_model[model]) {
      summary.by_model[model] = {
        total: 0,
        prior_supplier_with_timestamp: 0,
        prior_supplier_without_timestamp: 0,
        no_prior_supplier: 0
      };
    }
    summary.by_model[model].total += 1;

    const traceLines = (record.trace || [])
      .flatMap(item => Array.isArray(item.sources) ? item.sources : [])
      .map(Number)
      .filter(Number.isFinite);
    const recordLine = traceLines.length ? Math.max(...traceLines) : null;
    if (!Number.isFinite(recordLine)) {
      summary.without_prior_supplier += 1;
      summary.by_model[model].no_prior_supplier += 1;
      continue;
    }

    const prior = supplierSetLines
      .filter(item => item.line < recordLine)
      .sort((a, b) => b.line - a.line)[0] || null;
    if (!prior) {
      summary.without_prior_supplier += 1;
      summary.by_model[model].no_prior_supplier += 1;
      continue;
    }

    summary.with_prior_supplier += 1;
    const timestampBetween = timestampLines.some(line => line > prior.line && line < recordLine);
    if (timestampBetween) {
      summary.with_prior_supplier_and_timestamp_between += 1;
      summary.by_model[model].prior_supplier_with_timestamp += 1;
    } else {
      summary.with_prior_supplier_without_timestamp_between += 1;
      summary.by_model[model].prior_supplier_without_timestamp += 1;
    }
  }

  return summary;
})();

const supplierAwareGapByModel = (() => {
  if (!reportSupplierAware) return null;
  const out = {};
  const touch = model => {
    if (!out[model]) out[model] = { missing: 0, extra: 0 };
    return out[model];
  };
  for (const item of reportSupplierAware.missing || []) {
    const model = item?.fields?.model?.id || '(unknown)';
    touch(model).missing += Number(item.count || 0);
  }
  for (const item of reportSupplierAware.extra || []) {
    const model = item?.fields?.model?.id || '(unknown)';
    touch(model).extra += Number(item.count || 0);
  }
  return Object.values(
    Object.entries(out)
      .sort((a, b) => (b[1].missing + b[1].extra) - (a[1].missing + a[1].extra) || a[0].localeCompare(b[0]))
      .reduce((acc, [model, row]) => {
        acc[model] = { ...row, total_gap: row.missing + row.extra };
        return acc;
      }, {})
  ).length
    ? Object.entries(out)
        .sort((a, b) => (b[1].missing + b[1].extra) - (a[1].missing + a[1].extra) || a[0].localeCompare(b[0]))
        .reduce((acc, [model, row]) => {
          acc[model] = { ...row, total_gap: row.missing + row.extra };
          return acc;
        }, {})
    : {};
})();
const anchorSpanDiagnostic = anchorSpanDiagnostics(coreBundle);
const conditionDistributionDiagnostic = conditionDistributionDiagnostics(legacy, coreBundle);
const supplierAwarePairingTraceDiagnostic = supplierProfiles.length
  ? supplierAwarePairingTraceDiagnostics(legacySupplierAware, coreBundle)
  : null;
const supplierAwareExpansionGroupDiagnostic = supplierProfiles.length
  ? supplierAwareExpansionGroupDiagnostics(legacySupplierAware, coreBundle)
  : null;

const summary = {
  contract_version: 'real-shadow-benchmark-summary/v1',
  mode: 'shadow_read_only',
  scope: 'apple-iphone-v0-supported-models',
  legacy_guard_ok: true,
  legacy_supported_offers: report.metrics.legacy_supported_offers,
  legacy_unsupported_products: legacy.unsupported.length,
  legacy_invalid_supported: legacy.invalid.length,
  supplier_profiles_loaded: supplierProfiles.length,
  legacy_supplier_mapped_offers: legacySupplierMapped,
  legacy_supplier_unmapped_offers: legacySupplierUnmapped,
  supplier_aware_core_offers: reportSupplierAware?.metrics?.core_offers ?? null,
  supplier_aware_matched_offers: reportSupplierAware?.metrics?.matched_offers ?? null,
  supplier_aware_missing_offers: reportSupplierAware?.metrics?.missing_offers ?? null,
  supplier_aware_extra_offers: reportSupplierAware?.metrics?.extra_offers ?? null,
  supplier_aware_agreement_ratio: reportSupplierAware?.metrics?.agreement_ratio ?? null,
  supplier_aware_no_silent_wrong_price: reportSupplierAware?.gates?.no_silent_wrong_price ?? null,
  supplier_aware_confirmed_silent_wrong_price: reportSupplierAware?.metrics?.confirmed_silent_wrong_price ?? null,
  supplier_aware_unresolved_price_attribution: reportSupplierAware?.metrics?.unresolved_price_attribution ?? null,
  supplier_aware_price_attribution_resolved: reportSupplierAware?.gates?.price_attribution_resolved ?? null,
  supplier_boundary_events: supplierBoundaryDiagnostic.boundary_events,
  core_records_with_supplier: supplierRecordDiagnostic.records_with_supplier,
  core_records_without_supplier: supplierRecordDiagnostic.records_without_supplier,
  core_records_without_supplier_by_model: supplierRecordDiagnostic.records_without_supplier_by_model,
  supplierless_context_diagnostic: supplierlessContextDiagnostic,
  supplier_aware_gap_by_model: supplierAwareGapByModel,
  supplier_aware_residual_diagnostic: supplierAwareResidualDiagnostic,
  pure_model_residual_topology_diagnostic: pureModelResidualTopologyDiagnostic,
  pure_model_residual_evidence_diagnostic: pureModelResidualEvidenceDiagnostic,
  missing_price_source_topology_diagnostic: missingPriceSourceTopologyDiagnostic,
  missing_only_model_anchor_evidence_diagnostic: missingOnlyModelAnchorEvidenceDiagnostic,
  missing_17_512_composition_diagnostic: missing17_512CompositionDiagnostic,
  missing_17_512_anchor_topology_diagnostic: missing17_512AnchorTopologyDiagnostic,
  missing_17_512_anchor_shape_diagnostic: missing17_512AnchorShapeDiagnostic,
  source_contradicted_legacy_missing_diagnostic: sourceContradictedLegacyMissingDiagnostic,
  source_contradicted_legacy_supplier_residual_diagnostic: sourceContradictedLegacySupplierResidualDiagnostic,
  price_supplier_residual_evidence_diagnostic: priceSupplierResidualEvidenceDiagnostic,
  supplier_trace_support_diagnostic: supplierTraceSupportDiagnostic,
  source_supported_core_only_e_model_diagnostic: sourceSupportedCoreOnlyEModelDiagnostic,
  source_supported_core_only_e_offer_diagnostic: sourceSupportedCoreOnlyEOfferDiagnostic,
  source_supported_core_only_full_offer_diagnostic: sourceSupportedCoreOnlyFullOfferDiagnostic,
  source_unsupported_legacy_pure_condition_diagnostic: sourceUnsupportedLegacyPureConditionDiagnostic,
  mixed_price_supplier_evidence_diagnostic: mixedPriceSupplierEvidenceDiagnostic,
  adjudicated_mixed_price_supplier_diagnostic: adjudicatedMixedPriceSupplierDiagnostic,
  strong_mixed_residual_evidence_diagnostic: strongMixedResidualEvidenceDiagnostic,
  mixed_residual_overlap_coverage_diagnostic: mixedResidualOverlapCoverageDiagnostic,
  residual_adjudication_ledger_diagnostic: residualAdjudicationLedgerDiagnostic,
  adjudicated_residual_diagnostic: adjudicatedResidualDiagnostic,
  residual_adjudication_ledger: residualAdjudicationLedger,
  residual_adjudication_ledger_strict_pair_dominance_simulation: residualAdjudicationLedgerStrictPairDominanceSimulation,
  condition_confidence_horizon_simulations: conditionConfidenceHorizonDiagnostics,
  exact_supported_condition_topology_diagnostic: exactSupportedConditionTopologyDiagnostic,
  residual_adjudication_ledger_strong_mixed_simulation: residualAdjudicationLedgerStrongMixedSimulation,
  residual_adjudication_ledger_all_full_local_simulation: residualAdjudicationLedgerAllFullLocalSimulation,
  residual_adjudication_ledger_combined_simulation: residualAdjudicationLedgerCombinedSimulation,
  residual_adjudication_ledger_late_full_local_simulation: residualAdjudicationLedgerLateFullLocalSimulation,
  residual_adjudication_ledger_late_combined_simulation: residualAdjudicationLedgerLateCombinedSimulation,
  residual_adjudication_ledger_source_support_simulation: residualAdjudicationLedgerSourceSupportSimulation,
  condition_residual_topology_diagnostic: conditionResidualTopologyDiagnostic,
  pure_condition_residual_topology_diagnostic: pureConditionResidualTopologyDiagnostic,
  pure_color_residual_topology_diagnostic: pureColorResidualTopologyDiagnostic,
  pure_supplier_residual_topology_diagnostic: pureSupplierResidualTopologyDiagnostic,
  exact_surplus_provenance_diagnostic: exactSurplusProvenanceDiagnostic,
  e_model_surplus_source_diagnostic: eModelSurplusSourceDiagnostic,
  surplus_price_source_shape_diagnostic: surplusPriceSourceShapeDiagnostic,
  price_source_shape_support_diagnostic: priceSourceShapeSupportDiagnostic,
  surplus_long_header_price_evidence_diagnostic: surplusLongHeaderPriceEvidenceDiagnostic,
  condition_domain_boundary_guard_simulation: {
    cleared_conditions: conditionDomainGuardCleared,
    cleared_by_model: conditionDomainGuardByModel,
    core_offers: conditionDomainGuardReport.metrics.core_offers,
    matched_offers: conditionDomainGuardReport.metrics.matched_offers,
    missing_offers: conditionDomainGuardReport.metrics.missing_offers,
    extra_offers: conditionDomainGuardReport.metrics.extra_offers,
    agreement_ratio: conditionDomainGuardReport.metrics.agreement_ratio,
    confirmed_silent_wrong_price: conditionDomainGuardReport.metrics.confirmed_silent_wrong_price,
    unresolved_price_attribution: conditionDomainGuardReport.metrics.unresolved_price_attribution,
    no_silent_wrong_price: conditionDomainGuardReport.gates.no_silent_wrong_price,
    price_attribution_resolved: conditionDomainGuardReport.gates.price_attribution_resolved,
    exact_multiset: conditionDomainGuardReport.gates.exact_multiset
  },
  condition_timestamp_preservation_simulation: {
    core_offers: conditionTimestampReport.metrics.core_offers,
    matched_offers: conditionTimestampReport.metrics.matched_offers,
    missing_offers: conditionTimestampReport.metrics.missing_offers,
    extra_offers: conditionTimestampReport.metrics.extra_offers,
    agreement_ratio: conditionTimestampReport.metrics.agreement_ratio,
    confirmed_silent_wrong_price: conditionTimestampReport.metrics.confirmed_silent_wrong_price,
    unresolved_price_attribution: conditionTimestampReport.metrics.unresolved_price_attribution,
    no_silent_wrong_price: conditionTimestampReport.gates.no_silent_wrong_price,
    price_attribution_resolved: conditionTimestampReport.gates.price_attribution_resolved,
    exact_multiset: conditionTimestampReport.gates.exact_multiset
  },
  capacity_from_resolved_model_simulation: {
    filled_records: capacityFromResolvedModelFilled,
    core_offers: capacityFromResolvedModelReport.metrics.core_offers,
    matched_offers: capacityFromResolvedModelReport.metrics.matched_offers,
    missing_offers: capacityFromResolvedModelReport.metrics.missing_offers,
    extra_offers: capacityFromResolvedModelReport.metrics.extra_offers,
    agreement_ratio: capacityFromResolvedModelReport.metrics.agreement_ratio,
    confirmed_silent_wrong_price: capacityFromResolvedModelReport.metrics.confirmed_silent_wrong_price,
    unresolved_price_attribution: capacityFromResolvedModelReport.metrics.unresolved_price_attribution,
    no_silent_wrong_price: capacityFromResolvedModelReport.gates.no_silent_wrong_price,
    price_attribution_resolved: capacityFromResolvedModelReport.gates.price_attribution_resolved,
    exact_multiset: capacityFromResolvedModelReport.gates.exact_multiset
  },
  adjacent_unique_color_simulation: {
    filled_records: adjacentColorFilled,
    rejected_model_conflict: adjacentColorRejectedModelConflict,
    rejected_boundary: adjacentColorRejectedBoundary,
    core_offers: adjacentColorReport.metrics.core_offers,
    matched_offers: adjacentColorReport.metrics.matched_offers,
    missing_offers: adjacentColorReport.metrics.missing_offers,
    extra_offers: adjacentColorReport.metrics.extra_offers,
    agreement_ratio: adjacentColorReport.metrics.agreement_ratio,
    confirmed_silent_wrong_price: adjacentColorReport.metrics.confirmed_silent_wrong_price,
    unresolved_price_attribution: adjacentColorReport.metrics.unresolved_price_attribution,
    no_silent_wrong_price: adjacentColorReport.gates.no_silent_wrong_price,
    price_attribution_resolved: adjacentColorReport.gates.price_attribution_resolved,
    exact_multiset: adjacentColorReport.gates.exact_multiset
  },
  long_product_header_fallback_price_simulation: {
    dropped_records: longHeaderFallbackPriceDropped,
    core_offers: longHeaderFallbackPriceReport.metrics.core_offers,
    matched_offers: longHeaderFallbackPriceReport.metrics.matched_offers,
    missing_offers: longHeaderFallbackPriceReport.metrics.missing_offers,
    extra_offers: longHeaderFallbackPriceReport.metrics.extra_offers,
    agreement_ratio: longHeaderFallbackPriceReport.metrics.agreement_ratio,
    confirmed_silent_wrong_price: longHeaderFallbackPriceReport.metrics.confirmed_silent_wrong_price,
    unresolved_price_attribution: longHeaderFallbackPriceReport.metrics.unresolved_price_attribution,
    no_silent_wrong_price: longHeaderFallbackPriceReport.gates.no_silent_wrong_price,
    price_attribution_resolved: longHeaderFallbackPriceReport.gates.price_attribution_resolved,
    exact_multiset: longHeaderFallbackPriceReport.gates.exact_multiset
  },
  inherited_model_distance2_currency_price_simulation: {
    dropped_records: inheritedModelDistance2Dropped,
    core_offers: inheritedModelDistance2Report.metrics.core_offers,
    matched_offers: inheritedModelDistance2Report.metrics.matched_offers,
    missing_offers: inheritedModelDistance2Report.metrics.missing_offers,
    extra_offers: inheritedModelDistance2Report.metrics.extra_offers,
    agreement_ratio: inheritedModelDistance2Report.metrics.agreement_ratio,
    confirmed_silent_wrong_price: inheritedModelDistance2Report.metrics.confirmed_silent_wrong_price,
    unresolved_price_attribution: inheritedModelDistance2Report.metrics.unresolved_price_attribution,
    no_silent_wrong_price: inheritedModelDistance2Report.gates.no_silent_wrong_price,
    price_attribution_resolved: inheritedModelDistance2Report.gates.price_attribution_resolved,
    exact_multiset: inheritedModelDistance2Report.gates.exact_multiset
  },
  supplier_aware_pairing_trace_diagnostic: supplierAwarePairingTraceDiagnostic,
  supplier_aware_expansion_group_diagnostic: supplierAwareExpansionGroupDiagnostic,
  supplier_aware_silent_wrong_price_by_model:
    reportSupplierAware?.metrics?.silent_wrong_price_by_model ?? null,
  supplier_aware_silent_wrong_price_surplus_trace_by_rule:
    reportSupplierAware?.metrics?.silent_wrong_price_surplus_trace_by_rule ?? null,
  core_offers: report.metrics.core_offers,
  core_ambiguities: report.metrics.core_ambiguities,
  matched_offers: report.metrics.matched_offers,
  missing_offers: report.metrics.missing_offers,
  extra_offers: report.metrics.extra_offers,
  agreement_ratio: report.metrics.agreement_ratio,
  agreement_ratio_without_color: reportNoColor.metrics.agreement_ratio,
  exact_multiset_without_color: reportNoColor.gates.exact_multiset,
  no_silent_wrong_price: report.gates.no_silent_wrong_price,
  confirmed_silent_wrong_price: report.metrics.confirmed_silent_wrong_price,
  unresolved_price_attribution: report.metrics.unresolved_price_attribution,
  price_attribution_resolved: report.gates.price_attribution_resolved,
  silent_wrong_price_substitutions: report.metrics.silent_wrong_price_substitutions,
  silent_wrong_price_identities: report.metrics.silent_wrong_price_identities,
  silent_wrong_price_by_model: report.metrics.silent_wrong_price_by_model,
  silent_wrong_price_surplus_trace_by_rule: report.metrics.silent_wrong_price_surplus_trace_by_rule,
  silent_wrong_price_supplier_cardinality_by_model: report.metrics.silent_wrong_price_supplier_cardinality_by_model,
  silent_wrong_price_single_supplier_identity: report.metrics.silent_wrong_price_single_supplier_identity,
  silent_wrong_price_multi_supplier_identity: report.metrics.silent_wrong_price_multi_supplier_identity,
  silent_wrong_price_unknown_supplier_identity: report.metrics.silent_wrong_price_unknown_supplier_identity,
  exact_multiset: report.gates.exact_multiset,
  raw_exact_multiset: report.gates.exact_multiset,
  source_adjudicated_exact:
    residualAdjudicationLedger?.integrity?.pass === true &&
    residualAdjudicationLedger?.actionable?.total_residual === 0,
  promotion_basis: 'source_adjudicated_ledger_v4',
  promotion_ready:
    (reportSupplierAware?.gates?.no_silent_wrong_price ?? report.gates.no_silent_wrong_price) === true &&
    (reportSupplierAware?.gates?.price_attribution_resolved ?? report.gates.price_attribution_resolved) === true &&
    residualAdjudicationLedger?.integrity?.pass === true &&
    residualAdjudicationLedger?.actionable?.total_residual === 0,
  offer_expansion_diagnostic: expansionDiagnostic,
  model_context_diagnostic: modelContextDiagnostic,
  unresolved_model_diagnostic: unresolvedModelDiagnostic,
  relaxed_supported_header_diagnostic: relaxedSupportedHeaderDiagnostic,
  supported_block_diagnostic: supportedBlockDiagnostic,
  ordered_pair_fallback_diagnostic: orderedPairFallbackDiagnostic,
  supplier_boundary_diagnostic: supplierBoundaryDiagnostic,
  anchor_span_diagnostic: anchorSpanDiagnostic,
  condition_distribution_diagnostic: conditionDistributionDiagnostic
};

const diagnostic = {
  contract_version: divergence.contract_version,
  version: divergence.version,
  categories: divergence.categories,
  mismatch_signatures: divergence.mismatch_signatures,
  condition_pairs: divergence.condition_pairs,
  condition_pair_provenance: divergence.condition_pair_provenance,
  condition_scope_diagnostics: divergence.condition_scope_diagnostics,
  wrong_price_diagnostics: divergence.wrong_price_diagnostics,
  multi_mismatch_diagnostics: divergence.multi_mismatch_diagnostics,
  ambiguities_by_cause: divergence.ambiguities_by_cause,
  ambiguities_by_field: divergence.ambiguities_by_field,
  top_model_gaps: divergence.top_model_gaps
};

console.log('=== REAL SHADOW BENCHMARK — AGREGADO ===');
console.log(JSON.stringify(summary, null, 2));
console.log('=== DIVERGENCE ANALYZER V1 — AGREGADO ===');
console.log(JSON.stringify(diagnostic, null, 2));
console.log(`PROMOTION_READY=${summary.promotion_ready ? 'true' : 'false'}`);

if (!summary.no_silent_wrong_price) {
  console.log('BLOQUEIO: existe divergencia de preco para modelo suportado; detalhes sensiveis nao sao impressos.');
}
if (!summary.exact_multiset) {
  console.log('INFO: o multiconjunto bruto ainda diverge do legado; divergencias adjudicadas permanecem visiveis.');
}
if (!summary.source_adjudicated_exact) {
  console.log(
    'BLOQUEIO: ainda existem residuos acionaveis apos adjudicacao baseada em evidencia: ' +
    String(residualAdjudicationLedger?.actionable?.total_residual ?? 'unknown')
  );
}

console.log('BENCHMARK_CONCLUIDO=1');
