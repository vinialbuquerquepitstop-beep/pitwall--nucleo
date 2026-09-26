'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { applySupplierProfiles } = require('../../interpreter-core/v1/supplier-profile-adapter');
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
  schema: applyUnknownSupplierBoundaryFallback(baseSchema),
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

console.log(JSON.stringify({
  u4_diagnostic: {
    wrong_price: metrics.wrong_price,
    extra_records: extras.length,
    extras_under_known_supplier_context: extrasUnderKnownSupplierContext,
    extras_with_inherited_critical_context: extrasWithInheritedCritical,
    extras_with_direct_price: extrasWithDirectPrice,
    context_drift_counts: contextDrift
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
