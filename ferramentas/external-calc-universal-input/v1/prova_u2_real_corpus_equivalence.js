'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { interpretResolved } = require('../../interpreter-core/v1/core');
const { applySupplierProfiles } = require('../../interpreter-core/v1/supplier-profile-adapter');
const { parseTextSource } = require('./text-adapter');
const { interpretCanonical, canonicalToRawDocument } = require('./canonical-interpreter-bridge');

const rawPath = process.argv[2];
const supplierProfilesPath = process.argv[3];

if (!rawPath || !supplierProfilesPath) {
  throw new Error('uso: node prova_u2_real_corpus_equivalence.js <raw.txt> <supplier-profiles.json>');
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
const schema = applySupplierProfiles(baseSchema, supplierProfiles);
const documentId = 'u2-real-corpus';

function semanticSnapshot(bundle) {
  const metrics = { ...(bundle.metrics || {}) };
  delete metrics.parse_ms;
  return {
    segments: bundle.segments,
    records: bundle.records,
    ambiguities: bundle.ambiguities,
    invalid: bundle.invalid,
    learning_proposals: bundle.learning_proposals,
    warnings: bundle.warnings,
    metrics
  };
}

function priceSignatures(bundle) {
  return (bundle.records || []).map(record => JSON.stringify({
    model: record.fields?.model?.id || record.fields?.model || null,
    capacity_gb: record.fields?.capacity_gb ?? null,
    condition: record.fields?.condition ?? null,
    color: record.fields?.color ?? null,
    price: record.fields?.price ?? null
  })).sort();
}

const legacy = interpretResolved({
  document: {
    contract_version: 'raw-document/v1',
    document_id: documentId,
    content,
    source: { kind: 'u2_real_legacy_readonly' }
  },
  schema,
  knowledge
});

const canonical = parseTextSource({
  filename: 'real-corpus.txt',
  mime_type: 'text/plain',
  content_ref: 'private-readonly-benchmark',
  content
}, {
  idFactory: () => 'canonical-u2-real'
});

const bridged = canonicalToRawDocument(canonical, { documentId });
assert.strictEqual(bridged.content, content);

const modern = interpretCanonical({
  document: canonical,
  schema,
  knowledge
}, { documentId });

assert.deepStrictEqual(semanticSnapshot(modern), semanticSnapshot(legacy));

const legacyPrices = priceSignatures(legacy);
const modernPrices = priceSignatures(modern);
assert.deepStrictEqual(modernPrices, legacyPrices);

const legacySet = new Set(legacyPrices);
const newSilentWrongPrice = modernPrices.filter(signature => !legacySet.has(signature)).length;
assert.strictEqual(newSilentWrongPrice, 0);

console.log(JSON.stringify({
  corpus_bytes: Buffer.byteLength(content, 'utf8'),
  legacy_records: legacy.records.length,
  modern_records: modern.records.length,
  legacy_ambiguities: legacy.ambiguities.length,
  modern_ambiguities: modern.ambiguities.length,
  price_signatures: modernPrices.length,
  new_silent_wrong_price: newSilentWrongPrice
}));
console.log(
  'EXTERNAL_CALC_UNIVERSAL_INPUT_U2_REAL=PASS'
  + ' records=' + modern.records.length
  + ' new_silent_wrong_price=' + newSilentWrongPrice
);
