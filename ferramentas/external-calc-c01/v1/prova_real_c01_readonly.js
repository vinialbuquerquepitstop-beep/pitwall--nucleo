'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { runC01ReadOnlySlice } = require('./c01-readonly-bridge');

const rawPath = process.argv[2];
if (!rawPath) throw new Error('uso: node prova_real_c01_readonly.js <raw.txt>');

const schema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../interpreter-core/v1/domains/apple-iphone-v0.schema.json'),
  'utf8'
));
const knowledge = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../interpreter-core/v1/domains/apple-iphone-v0.knowledge.json'),
  'utf8'
));
const raw = fs.readFileSync(rawPath, 'utf8');

const queue = runC01ReadOnlySlice({
  analysis_id: 'ana_real_shadow_readonly',
  source_id: 'src_real_shadow_readonly',
  currency: 'BRL',
  document: {
    contract_version: 'raw-document/v1',
    document_id: 'real-shadow-c01',
    content: raw,
    source: { kind: 'plain_text' }
  },
  schema,
  knowledge
});

assert.ok(queue.metrics.interpreter_records > 0);
assert.strictEqual(queue.metrics.review_candidates, queue.metrics.interpreter_records);
assert.strictEqual(new Set(queue.candidates.map(item => item.offer_id)).size, queue.candidates.length);

for (const candidate of queue.candidates) {
  assert.strictEqual(candidate.execution_status, 'SUCCEEDED');
  assert.strictEqual(candidate.domain_outcome, 'REVIEW_REQUIRED');
  assert.strictEqual(candidate.freshness_status, 'CURRENT');
  assert.strictEqual(candidate.reviewed_offer, null);
  assert.ok(Number.isSafeInteger(candidate.interpreted_offer.price.amount_minor));
  assert.ok(candidate.interpreted_offer.price.amount_minor > 0);
  assert.strictEqual(candidate.interpreted_offer.price.currency, 'BRL');
  assert.ok(candidate.provenance_refs.length >= 2);
}

console.log('C01_REAL_READONLY_GATE=PASS');
console.log(`C01_REAL_CANDIDATES=${queue.candidates.length}`);
console.log(`C01_REAL_AMBIGUITIES=${queue.unresolved_ambiguities.length}`);
console.log(`C01_REAL_INVALID=${queue.invalid_items.length}`);
