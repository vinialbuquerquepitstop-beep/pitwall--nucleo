'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { applySupplierProfiles } = require('../../interpreter-core/v1/supplier-profile-adapter');
const { scoreRoles, normalizeLine, extractFieldCandidates } = require('../../interpreter-core/v1/core');
const { parseTextSource } = require('./text-adapter');
const { interpretCanonical } = require('./canonical-interpreter-bridge');
const { assertCriticalProvenance } = require('./provenance-resolver');
const { applyUnknownSupplierBoundaryFallback } = require('./unknown-supplier-boundary');
const { compareUnknownSupplier } = require('./u4-unknown-supplier-metrics');

const rawPath = process.argv[2];
const supplierProfilesPath = process.argv[3];
if (!rawPath || !supplierProfilesPath) {
  throw new Error('uso: node prova_u4_real_unknown_supplier.js <raw.txt> <supplier-profiles.json>');
}

const content = fs.readFileSync(rawPath, 'utf8');
const supplierProfiles = JSON.parse(fs.readFileSync(supplierProfilesPath, 'utf8'));
const baseSchema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', 'interpreter-core', 'v1', 'domains', 'apple-iphone-v0.schema.json'),
  'utf8'
));
const knowledge = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', 'interpreter-core', 'v1', 'domains', 'apple-iphone-v0.knowledge.json'),
  'utf8'
));

const canonical = parseTextSource({
  filename: 'u4-private-corpus.txt',
  mime_type: 'text/plain',
  content_ref: 'private-readonly-u4-benchmark',
  content
}, { idFactory: () => 'u4-real-canonical' });

const baseline = interpretCanonical({
  document: canonical,
  schema: applySupplierProfiles(baseSchema, supplierProfiles),
  knowledge
}, { documentId: 'u4-real-known' });

const unknown = interpretCanonical({
  document: canonical,
  schema: applyUnknownSupplierBoundaryFallback(baseSchema, canonical),
  knowledge
}, { documentId: 'u4-real-unknown' });

assertCriticalProvenance(unknown, canonical);

const metrics = compareUnknownSupplier(baseline, unknown);

function traceSource(record, field) {
  const item = (record.trace || []).find(entry => entry.field === field);
  return item?.sources?.find(value => Number.isInteger(value)) || null;
}

function multiset(records) {
  const map = new Map();
  for (const record of records || []) {
    const model = record.fields?.model?.id || record.fields?.model || null;
    const signature = JSON.stringify({
      model,
      capacity_gb: record.fields?.capacity_gb ?? null,
      condition: record.fields?.condition ?? null,
      color: record.fields?.color ?? null,
      price: record.fields?.price ?? null
    });
    if (!map.has(signature)) map.set(signature, []);
    map.get(signature).push(record);
  }
  return map;
}

const baselineBuckets = multiset(baseline.records);
const extras = [];
for (const record of unknown.records || []) {
  const model = record.fields?.model?.id || record.fields?.model || null;
  const signature = JSON.stringify({
    model,
    capacity_gb: record.fields?.capacity_gb ?? null,
    condition: record.fields?.condition ?? null,
    color: record.fields?.color ?? null,
    price: record.fields?.price ?? null
  });
  const bucket = baselineBuckets.get(signature) || [];
  if (bucket.length) bucket.pop();
  else extras.push(record);
}

const baselineSegments = new Map((baseline.segments || []).map(segment => [segment.line_number, segment]));
const unknownSegments = new Map((unknown.segments || []).map(segment => [segment.line_number, segment]));
const criticalContext = ['model', 'capacity_gb', 'condition', 'color'];
const contextDrift = Object.fromEntries(criticalContext.map(field => [field, 0]));
let extrasUnderKnownSupplierContext = 0;
let extrasWithInheritedCritical = 0;
let extrasWithDirectPrice = 0;

for (const record of extras) {
  const priceLine = traceSource(record, 'price');
  const baselineSegment = baselineSegments.get(priceLine);
  const unknownSegment = unknownSegments.get(priceLine);

  if (baselineSegment?.inherited_context?.supplier) {
    extrasUnderKnownSupplierContext += 1;
  }

  let inherited = false;
  for (const field of criticalContext) {
    const before = JSON.stringify(baselineSegment?.inherited_context?.[field] ?? null);
    const after = JSON.stringify(unknownSegment?.inherited_context?.[field] ?? null);
    if (before !== after) contextDrift[field] += 1;

    const trace = (record.trace || []).find(item => item.field === field);
    if ((trace?.rules || []).some(rule => rule === 'context_inheritance' || rule.startsWith('anchor_precedence:'))) {
      inherited = true;
    }
  }
  if (inherited) extrasWithInheritedCritical += 1;

  const priceTrace = (record.trace || []).find(item => item.field === 'price');
  if ((priceTrace?.rules || []).includes('direct_extraction')) {
    extrasWithDirectPrice += 1;
  }
}

const supplierBoundaryLines = new Set(
  (baseline.segments || [])
    .filter(segment => (segment.context_events || []).some(event => event.reason === 'supplier_boundary'))
    .map(segment => segment.line_number)
);

const blocks = canonical.blocks.map((block, index) => ({
  line: index + 1,
  text: block.text,
  top_role: scoreRoles(block.text)[0]?.role || 'none'
}));

function nextNonEmpty(startIndex, limit) {
  const out = [];
  for (let i = startIndex + 1; i < blocks.length && out.length < limit; i += 1) {
    if (blocks[i].text.trim() !== '') out.push(blocks[i]);
  }
  return out;
}

function evaluateCandidateSet(lines) {
  let hits = 0;
  for (const line of lines) if (supplierBoundaryLines.has(line)) hits += 1;
  return {
    candidates: lines.length,
    hits,
    precision: lines.length ? hits / lines.length : 1,
    recall: supplierBoundaryLines.size ? hits / supplierBoundaryLines.size : 1
  };
}

function structuralCandidates(windowSize) {
  const lines = [];
  for (let i = 0; i < blocks.length; i += 1) {
    if (blocks[i].top_role !== 'unknown') continue;
    const next = nextNonEmpty(i, windowSize);
    const firstProductIndex = next.findIndex(item => item.top_role === 'product_header');
    if (firstProductIndex < 0) continue;
    const beforeProduct = next.slice(0, firstProductIndex);
    if (beforeProduct.some(item => item.top_role === 'price_line')) continue;
    lines.push(blocks[i].line);
  }
  return lines;
}

function fieldNamesForBlock(block) {
  const segment = {
    segment_id: 'diag-' + block.line,
    line_number: block.line,
    raw: block.text,
    normalized: normalizeLine(block.text),
    role_candidates: scoreRoles(block.text)
  };
  return new Set(extractFieldCandidates(segment, baseSchema).map(candidate => candidate.field));
}

const blockFieldNames = new Map(blocks.map(block => [block.line, fieldNamesForBlock(block)]));

function boundaryLikeCandidates(windowSize) {
  const lines = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const role = blocks[i].top_role;
    if (!['product_header', 'unknown', 'note'].includes(role)) continue;

    const ownFields = blockFieldNames.get(blocks[i].line) || new Set();
    if (ownFields.has('model') || ownFields.has('price')) continue;

    const next = nextNonEmpty(i, windowSize);
    const nextHasModel = next.some(item => (blockFieldNames.get(item.line) || new Set()).has('model'));
    if (!nextHasModel) continue;

    lines.push(blocks[i].line);
  }
  return lines;
}


const supplierRoleCounts = {};
for (const line of supplierBoundaryLines) {
  const role = blocks[line - 1]?.top_role || 'missing';
  supplierRoleCounts[role] = (supplierRoleCounts[role] || 0) + 1;
}

const sortedSupplierBoundaries = Array.from(supplierBoundaryLines).sort((a, b) => a - b);
const extraPrecedingSupplierRoles = {};
for (const record of extras) {
  const priceLine = traceSource(record, 'price');
  let preceding = null;
  for (const line of sortedSupplierBoundaries) {
    if (line > priceLine) break;
    preceding = line;
  }
  const role = preceding == null ? 'none' : (blocks[preceding - 1]?.top_role || 'missing');
  extraPrecedingSupplierRoles[role] = (extraPrecedingSupplierRoles[role] || 0) + 1;
}

const badBoundaryLines = new Set();
for (const record of extras) {
  const priceLine = traceSource(record, 'price');
  let preceding = null;
  for (const line of sortedSupplierBoundaries) {
    if (line > priceLine) break;
    preceding = line;
  }
  if (preceding != null) badBoundaryLines.add(preceding);
}

function coverage(lines, targetSet) {
  const lineSet = new Set(lines);
  let hits = 0;
  for (const line of targetSet) if (lineSet.has(line)) hits += 1;
  return {
    target: targetSet.size,
    hits,
    recall: targetSet.size ? hits / targetSet.size : 1
  };
}

function safeBoundaryFeatures(line) {
  const block = blocks[line - 1];
  const ownFields = Array.from(blockFieldNames.get(line) || []).sort();
  const roles = scoreRoles(block?.text || '').map(item => item.role);
  const previous = line > 1 ? blocks[line - 2] : null;
  const next = line < blocks.length ? blocks[line] : null;

  return {
    top_role: block?.top_role || 'missing',
    roles,
    field_names: ownFields,
    length_bucket: !block ? 'missing'
      : block.text.length <= 20 ? '0-20'
      : block.text.length <= 40 ? '21-40'
      : block.text.length <= 80 ? '41-80'
      : '81+',
    has_digits: !!block && /\d/.test(block.text),
    previous_blank: previous ? previous.text.trim() === '' : true,
    next_blank: next ? next.text.trim() === '' : true,
    next_top_role: next?.top_role || 'none',
    next_field_names: next ? Array.from(blockFieldNames.get(next.line) || []).sort() : []
  };
}

const p0BoundaryFeatureCounts = {};
for (const line of badBoundaryLines) {
  const feature = safeBoundaryFeatures(line);
  const key = JSON.stringify(feature);
  p0BoundaryFeatureCounts[key] = (p0BoundaryFeatureCounts[key] || 0) + 1;
}

const nonP0SupplierFeatureCounts = {};
for (const line of supplierBoundaryLines) {
  if (badBoundaryLines.has(line)) continue;
  const feature = safeBoundaryFeatures(line);
  const key = JSON.stringify(feature);
  nonP0SupplierFeatureCounts[key] = (nonP0SupplierFeatureCounts[key] || 0) + 1;
}

const h4 = boundaryLikeCandidates(1);
const h5 = boundaryLikeCandidates(2);
const h6 = boundaryLikeCandidates(3);
function isolatedNonSemanticCandidates(allowedRoles = null) {
  const lines = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!block.text.trim()) continue;
    if (allowedRoles && !allowedRoles.has(block.top_role)) continue;

    const ownFields = blockFieldNames.get(block.line) || new Set();
    if (ownFields.size > 0) continue;

    const previousBlank = i === 0 || blocks[i - 1].text.trim() === '';
    const nextBlank = i === blocks.length - 1 || blocks[i + 1].text.trim() === '';
    if (!previousBlank || !nextBlank) continue;

    lines.push(block.line);
  }
  return lines;
}

const h7 = isolatedNonSemanticCandidates();
const h8 = isolatedNonSemanticCandidates(new Set(['unknown', 'product_header', 'note']));

function normalizedField(record, field) {
  const value = record?.fields?.[field];
  if (field === 'model' && value && typeof value === 'object') return value.id ?? value.label ?? null;
  return value ?? null;
}

function exactSafeMatch(candidate, expected) {
  if (normalizedField(candidate, 'price') !== normalizedField(expected, 'price')) return false;
  return ['model', 'capacity_gb', 'condition', 'color']
    .every(field => normalizedField(candidate, field) === normalizedField(expected, field));
}

function partialSafeMatch(candidate, expected) {
  if (normalizedField(candidate, 'price') !== normalizedField(expected, 'price')) return false;
  let degraded = false;
  for (const field of ['model', 'capacity_gb', 'condition', 'color']) {
    const actual = normalizedField(candidate, field);
    const baselineValue = normalizedField(expected, field);
    if (actual == null) {
      if (baselineValue != null) degraded = true;
      continue;
    }
    if (baselineValue == null || actual !== baselineValue) return false;
  }
  return degraded;
}

const unsafeGroups = {};
const safetyMatched = new Set();
for (const candidate of unknown.records || []) {
  const priceLine = traceSource(candidate, 'price');
  const sameLine = (baseline.records || [])
    .map((record, index) => ({ record, index }))
    .filter(item => !safetyMatched.has(item.index) && traceSource(item.record, 'price') === priceLine);

  let match = sameLine.find(item => exactSafeMatch(candidate, item.record));
  if (!match) match = sameLine.find(item => partialSafeMatch(candidate, item.record));
  if (match) {
    safetyMatched.add(match.index);
    continue;
  }

  const conflictFields = [];
  if (sameLine.length > 0) {
    for (const field of ['model', 'capacity_gb', 'condition', 'color']) {
      const actual = normalizedField(candidate, field);
      if (actual == null) continue;
      const anyEqual = sameLine.some(item => normalizedField(item.record, field) === actual);
      if (!anyEqual) conflictFields.push(field);
    }
    if (normalizedField(candidate, 'price') != null
        && !sameLine.some(item => normalizedField(item.record, 'price') === normalizedField(candidate, 'price'))) {
      conflictFields.push('price');
    }
  }

  let preceding = null;
  for (const line of sortedSupplierBoundaries) {
    if (line > priceLine) break;
    preceding = line;
  }
  const precedingRole = preceding == null ? 'none' : (blocks[preceding - 1]?.top_role || 'missing');
  const candidateColorTrace = (candidate.trace || []).find(item => item.field === 'color');
  const baselineColorTraces = sameLine.map(item =>
    (item.record.trace || []).find(trace => trace.field === 'color')
  ).filter(Boolean);
  const unknownBoundaryEvent = preceding == null ? false : (unknownSegments.get(preceding)?.context_events || [])
    .some(event => event.field === '_unknown_supplier_boundary' && event.reason === 'supplier_boundary');
  const candidateColorLine = candidateColorTrace?.sources?.find(value => Number.isInteger(value)) ?? null;
  const baselineColorLines = baselineColorTraces
    .map(trace => trace.sources?.find(value => Number.isInteger(value)) ?? null)
    .filter(value => value != null);
  const candidateColorRole = candidateColorLine == null
    ? 'none'
    : (blocks[candidateColorLine - 1]?.top_role || 'missing');

  const key = JSON.stringify({
    reason: sameLine.length ? 'identity_conflict' : 'new_price_source',
    conflict_fields: conflictFields.sort(),
    preceding_supplier_role: precedingRole,
    unknown_boundary_event_present: unknownBoundaryEvent,
    price_line_offset_from_boundary: preceding == null || priceLine == null ? null : priceLine - preceding,
    candidate_color_line_offset_from_boundary: preceding == null || candidateColorLine == null ? null : candidateColorLine - preceding,
    candidate_color_role: candidateColorRole,
    candidate_color_rules: (candidateColorTrace?.rules || []).slice().sort(),
    baseline_color_line_offsets_from_boundary: baselineColorLines
      .map(line => preceding == null ? null : line - preceding)
      .sort((a, b) => (a ?? 0) - (b ?? 0)),
    baseline_color_rule_groups: baselineColorTraces
      .map(trace => (trace.rules || []).slice().sort().join('+'))
      .sort()
  });
  unsafeGroups[key] = (unsafeGroups[key] || 0) + 1;
}

const boundaryHeuristics = {
  supplier_boundaries: supplierBoundaryLines.size,
  supplier_top_roles: supplierRoleCounts,
  extra_preceding_supplier_roles: extraPrecedingSupplierRoles,
  p0_boundary_count: badBoundaryLines.size,
  unsafe_assignment_groups: unsafeGroups,
  p0_boundary_feature_groups: p0BoundaryFeatureCounts,
  non_p0_supplier_feature_group_count: Object.keys(nonP0SupplierFeatureCounts).length,
  h1_unknown_then_product: evaluateCandidateSet(structuralCandidates(1)),
  h2_unknown_within_2: evaluateCandidateSet(structuralCandidates(2)),
  h3_unknown_within_3: evaluateCandidateSet(structuralCandidates(3)),
  h4_nonsemantic_header_next_model: {
    ...evaluateCandidateSet(h4),
    p0_coverage: coverage(h4, badBoundaryLines)
  },
  h5_nonsemantic_header_model_within_2: {
    ...evaluateCandidateSet(h5),
    p0_coverage: coverage(h5, badBoundaryLines)
  },
  h6_nonsemantic_header_model_within_3: {
    ...evaluateCandidateSet(h6),
    p0_coverage: coverage(h6, badBoundaryLines)
  },
  h7_isolated_nonsemantic: {
    ...evaluateCandidateSet(h7),
    p0_coverage: coverage(h7, badBoundaryLines)
  },
  h8_isolated_nonsemantic_scoped_roles: {
    ...evaluateCandidateSet(h8),
    p0_coverage: coverage(h8, badBoundaryLines)
  }
};

console.log(JSON.stringify({
  u4_diagnostic: {
    wrong_price: metrics.wrong_price,
    extra_records: extras.length,
    extras_under_known_supplier_context: extrasUnderKnownSupplierContext,
    extras_with_inherited_critical_context: extrasWithInheritedCritical,
    extras_with_direct_price: extrasWithDirectPrice,
    context_drift_counts: contextDrift,
    boundary_heuristics: boundaryHeuristics
  }
}));
assert(metrics.baseline_records > 0, 'baseline real sem records');
assert.strictEqual(metrics.wrong_price, 0, 'supplier desconhecido criou assinatura de preco nova');
assert.strictEqual(metrics.supplier_invented, 0, 'supplier desconhecido foi inventado');
assert.strictEqual(metrics.silent_missing, 0, 'oferta baseline sumiu sem review/ambiguidade explicita');

console.log(JSON.stringify({
  corpus_bytes: Buffer.byteLength(content, 'utf8'),
  ...metrics
}));
console.log(
  'EXTERNAL_CALC_UNIVERSAL_INPUT_U4_REAL=PASS'
  + ' baseline_records=' + metrics.baseline_records
  + ' unknown_records=' + metrics.unknown_records
  + ' recognition_rate=' + metrics.recognition_rate.toFixed(3)
  + ' core_rate=' + metrics.core_rate.toFixed(3)
  + ' review_rate=' + metrics.review_rate.toFixed(3)
  + ' unresolved=' + metrics.unresolved
  + ' wrong_price=' + metrics.wrong_price
  + ' silent_missing=' + metrics.silent_missing
  + ' supplier_invented=' + metrics.supplier_invented
);
