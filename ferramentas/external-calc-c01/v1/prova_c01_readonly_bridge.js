'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  CONTRACT_VERSION,
  runC01ReadOnlySlice,
  applyHumanReview
} = require('./c01-readonly-bridge');

const schema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../interpreter-core/v1/domains/apple-iphone-v0.schema.json'),
  'utf8'
));
const knowledge = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../interpreter-core/v1/domains/apple-iphone-v0.knowledge.json'),
  'utf8'
));

function run(documentId, content, supplierProfiles = null) {
  return runC01ReadOnlySlice({
    analysis_id: 'ana_fixture_001',
    source_id: 'src_fixture_001',
    currency: 'BRL',
    document: {
      contract_version: 'raw-document/v1',
      document_id: documentId,
      content,
      source: { kind: 'plain_text' }
    },
    schema,
    knowledge,
    supplier_profiles: supplierProfiles
  });
}

const queue = run('c01-direct', 'iPhone 17 512GB Preto Lacrado - 8.100');
assert.strictEqual(queue.contract_version, `${CONTRACT_VERSION}/queue`);
assert.strictEqual(queue.metrics.interpreter_records, 1);
assert.strictEqual(queue.metrics.review_candidates, 1);

const candidate = queue.candidates[0];
assert.strictEqual(candidate.domain_outcome, 'REVIEW_REQUIRED');
assert.strictEqual(candidate.execution_status, 'SUCCEEDED');
assert.strictEqual(candidate.freshness_status, 'CURRENT');
assert.strictEqual(candidate.offer_revision, 1);
assert.strictEqual(candidate.interpreted_offer.model.id, 'iphone_17_512gb');
assert.deepStrictEqual(candidate.interpreted_offer.price, { amount_minor: 810000, currency: 'BRL' });
assert.strictEqual(candidate.reviewed_offer, null);
assert.ok(candidate.trace.some(item => item.field === 'price'));
assert.ok(candidate.provenance_refs.some(ref => ref.startsWith('interpreter_record:')));

const accepted = applyHumanReview(candidate, {
  decision: 'ACCEPT',
  reviewer_ref: 'human_fixture',
  reviewed_at: '2026-09-19T12:00:00.000Z'
});
assert.strictEqual(accepted.domain_outcome, 'VALID');
assert.strictEqual(accepted.offer_revision, 1);
assert.deepStrictEqual(accepted.reviewed_offer, candidate.interpreted_offer);
assert.strictEqual(accepted.review.material_change, false);

const edited = applyHumanReview(candidate, {
  decision: 'EDIT',
  reviewer_ref: 'human_fixture',
  reviewed_at: '2026-09-19T12:01:00.000Z',
  reason: 'preco conferido na fonte',
  patch: { price: { amount_minor: 799900, currency: 'BRL' } }
});
assert.strictEqual(edited.domain_outcome, 'VALID');
assert.strictEqual(edited.offer_revision, 2);
assert.strictEqual(edited.review.material_change, true);
assert.deepStrictEqual(edited.interpreted_offer.price, { amount_minor: 810000, currency: 'BRL' });
assert.deepStrictEqual(edited.reviewed_offer.price, { amount_minor: 799900, currency: 'BRL' });

const excluded = applyHumanReview(candidate, {
  decision: 'EXCLUDE',
  reviewer_ref: 'human_fixture',
  reviewed_at: '2026-09-19T12:02:00.000Z',
  reason: 'nao e oferta comercial valida'
});
assert.strictEqual(excluded.domain_outcome, 'EXCLUDED');
assert.strictEqual(excluded.reviewed_offer, null);


const supplierQueue = run(
  'c01-supplier',
  'LOJA TESTE\niPhone 17 512GB Preto Lacrado - 8.100',
  {
    contract_version: 'supplier-profiles/v1',
    profiles: [{ id: 'SUP_TESTE', label: 'Loja Teste', aliases: ['LOJA TESTE'] }]
  }
);
assert.strictEqual(supplierQueue.candidates.length, 1);
assert.strictEqual(supplierQueue.candidates[0].interpreted_offer.supplier_id, 'SUP_TESTE');
assert.strictEqual(
  supplierQueue.candidates[0].reviewed_offer,
  null
);

const unresolved = run('c01-unresolved', 'iPhone 18 256GB Preto Lacrado - 9.999');
assert.strictEqual(unresolved.candidates.length, 0);
assert.ok(unresolved.unresolved_ambiguities.some(item => item.field === 'model'));

assert.throws(() => applyHumanReview(candidate, {
  decision: 'EDIT',
  reviewer_ref: 'human_fixture',
  reviewed_at: '2026-09-19T12:03:00.000Z',
  patch: { price: { amount_minor: 700000, currency: 'USD' } }
}), /currency/);

assert.throws(() => applyHumanReview(candidate, {
  decision: 'EDIT',
  reviewer_ref: 'human_fixture',
  reviewed_at: '2026-09-19T12:03:00.000Z',
  patch: { supplier_id: 'inventado' }
}), /nao permitidos/);

console.log('C01_READONLY_FIXTURES=PASS');
console.log(`C01_CANDIDATES=${queue.candidates.length}`);
console.log(`C01_UNRESOLVED=${unresolved.unresolved_ambiguities.length}`);
