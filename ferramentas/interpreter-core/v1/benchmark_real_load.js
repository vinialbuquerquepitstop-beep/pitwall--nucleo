'use strict';

const fs = require('fs');
const path = require('path');
const { interpretResolved, isFieldOnlySegment, uniqueFieldCandidates, normalizeKey } = require('./core');
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
  condition_residual_topology_diagnostic: conditionResidualTopologyDiagnostic,
  pure_condition_residual_topology_diagnostic: pureConditionResidualTopologyDiagnostic,
  pure_color_residual_topology_diagnostic: pureColorResidualTopologyDiagnostic,
  pure_supplier_residual_topology_diagnostic: pureSupplierResidualTopologyDiagnostic,
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
  promotion_ready:
    report.gates.no_silent_wrong_price === true &&
    report.gates.price_attribution_resolved === true &&
    report.gates.exact_multiset === true,
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
  console.log('BLOQUEIO: o multiconjunto de ofertas ainda diverge; detalhes sensiveis nao sao impressos.');
}

console.log('BENCHMARK_CONCLUIDO=1');
