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
const { validateUnknownSupplierPairing } = require('./unknown-supplier-safety-validator');

const fixtureDir = path.join(__dirname, 'fixtures');
const content = fs.readFileSync(path.join(fixtureDir, 'u4-unknown-supplier.txt'), 'utf8');
const expected = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'u4-unknown-supplier.expected.json'), 'utf8'));
const baseSchema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', 'interpreter-core', 'v1', 'domains', 'apple-iphone-v0.schema.json'),
  'utf8'
));
const knowledge = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', 'interpreter-core', 'v1', 'domains', 'apple-iphone-v0.knowledge.json'),
  'utf8'
));

const canonical = parseTextSource({
  filename: 'u4-unknown-supplier.txt',
  mime_type: 'text/plain',
  content
}, { idFactory: () => 'u4-local' });

const knownSchema = applySupplierProfiles(baseSchema, {
  profiles: [expected.supplier]
});
const unknownSchema = applyUnknownSupplierBoundaryFallback(baseSchema, canonical);

const baseline = interpretCanonical({
  document: canonical,
  schema: knownSchema,
  knowledge
}, { documentId: 'u4-local-known' });

const unknown = validateUnknownSupplierPairing(interpretCanonical({
  document: canonical,
  schema: unknownSchema,
  knowledge
}, { documentId: 'u4-local-unknown' }), unknownSchema);

assertCriticalProvenance(unknown, canonical);

const expectedOffers = new Map(expected.offers.map(item => [item.model, item.price]));
assert.strictEqual(baseline.records.length, expected.offers.length);
assert.strictEqual(unknown.records.length, expected.offers.length);

for (const record of unknown.records) {
  const model = record.fields?.model?.id;
  assert(expectedOffers.has(model), 'modelo inesperado: ' + String(model));
  assert.strictEqual(record.fields.price, expectedOffers.get(model));
  assert.strictEqual(record.fields.supplier, undefined, 'supplier desconhecido nao pode ser inventado');
}

const metrics = compareUnknownSupplier(baseline, unknown);
assert.strictEqual(metrics.recognition_rate, 1);
assert.strictEqual(metrics.core_rate, 1);
assert.strictEqual(metrics.review_rate, 0);
assert.strictEqual(metrics.unresolved, 0);
assert.strictEqual(metrics.silent_missing, 0);
assert.strictEqual(metrics.wrong_price, 0);
assert.strictEqual(metrics.supplier_invented, 0);

console.log(JSON.stringify(metrics));
console.log(
  'EXTERNAL_CALC_UNIVERSAL_INPUT_U4_LOCAL=PASS'
  + ' recognition_rate=' + metrics.recognition_rate.toFixed(3)
  + ' core_rate=' + metrics.core_rate.toFixed(3)
  + ' review_rate=' + metrics.review_rate.toFixed(3)
  + ' unresolved=' + metrics.unresolved
  + ' wrong_price=' + metrics.wrong_price
  + ' silent_missing=' + metrics.silent_missing
  + ' supplier_invented=' + metrics.supplier_invented
);
