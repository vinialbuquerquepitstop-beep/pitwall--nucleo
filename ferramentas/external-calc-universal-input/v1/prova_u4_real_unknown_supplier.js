'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { applySupplierProfiles } = require('../../interpreter-core/v1/supplier-profile-adapter');
const { parseTextSource } = require('./text-adapter');
const { interpretCanonical } = require('./canonical-interpreter-bridge');
const { assertCriticalProvenance } = require('./provenance-resolver');
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
  schema: applySupplierProfiles(baseSchema, { profiles: [] }),
  knowledge
}, { documentId: 'u4-real-unknown' });

assertCriticalProvenance(unknown, canonical);

const metrics = compareUnknownSupplier(baseline, unknown);
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
