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
assert.strictEqual(candidate.interpreted_offer.model.label, 'iPhone 17');
assert.strictEqual(candidate.interpreted_offer.capacity_gb, 512);
assert.deepStrictEqual(candidate.interpreted_offer.price, { amount_minor: 810000, currency: 'BRL' });
assert.strictEqual(candidate.reviewed_offer, null);
assert.ok(candidate.trace.some(item => item.field === 'price'));
assert.ok(candidate.provenance_refs.some(ref => ref.startsWith('interpreter_record:')));

const separatedModel = run(
  'c01-model-capacity-separation',
  'iPhone 16 Pro Max 256GB Preto Lacrado - 6.500'
);
assert.strictEqual(separatedModel.candidates.length, 1);
assert.strictEqual(
  separatedModel.candidates[0].interpreted_offer.model.id,
  'iphone_16_pro_max_256gb'
);
assert.strictEqual(
  separatedModel.candidates[0].interpreted_offer.model.label,
  'iPhone 16 Pro Max'
);
assert.strictEqual(
  separatedModel.candidates[0].interpreted_offer.capacity_gb,
  256
);

const sameFamily128 = run(
  'c01-model-family-128',
  'iPhone 16 128GB Preto Lacrado - 4.500'
);
const sameFamily256 = run(
  'c01-model-family-256',
  'iPhone 16 256GB Preto Lacrado - 4.900'
);
assert.strictEqual(sameFamily128.candidates[0].interpreted_offer.model.label, 'iPhone 16');
assert.strictEqual(sameFamily256.candidates[0].interpreted_offer.model.label, 'iPhone 16');
assert.strictEqual(sameFamily128.candidates[0].interpreted_offer.capacity_gb, 128);
assert.strictEqual(sameFamily256.candidates[0].interpreted_offer.capacity_gb, 256);
assert.notStrictEqual(
  sameFamily128.candidates[0].interpreted_offer.model.id,
  sameFamily256.candidates[0].interpreted_offer.model.id
);
assert.notStrictEqual(
  sameFamily128.candidates[0].offer_identity_fingerprint,
  sameFamily256.candidates[0].offer_identity_fingerprint
);

for (const entity of knowledge.entities.filter(item => item.kind === 'model')) {
  assert.ok(entity.attributes?.display_label, 'modelo precisa de display_label');
  assert.strictEqual(/\b\d+(?:GB|TB)$/i.test(entity.attributes.display_label), false);
  assert.ok(Number.isInteger(entity.attributes.capacity_gb));
}

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


const evidenceQueue = run(
  'c01-review-evidence',
  '🔥IPHONE LACRADO 🔥\n📲IPHONE 15 128GB ⚫️\nR$3.790'
);
assert.strictEqual(evidenceQueue.candidates.length, 1);
const evidenceCandidate = evidenceQueue.candidates[0];
assert.ok(evidenceCandidate.review_evidence);
assert.strictEqual(evidenceCandidate.review_evidence.record_id, 'record-line-3');
assert.deepStrictEqual(
  evidenceCandidate.review_evidence.source_lines,
  [
    { line_number: 1, raw: '🔥IPHONE LACRADO 🔥' },
    { line_number: 2, raw: '📲IPHONE 15 128GB ⚫️' },
    { line_number: 3, raw: 'R$3.790' }
  ]
);
assert.deepStrictEqual(evidenceCandidate.review_evidence.field_sources.model, [2]);
assert.deepStrictEqual(evidenceCandidate.review_evidence.field_sources.capacity_gb, [2]);
assert.deepStrictEqual(evidenceCandidate.review_evidence.field_sources.condition, [1]);
assert.deepStrictEqual(evidenceCandidate.review_evidence.field_sources.price, [3]);

const evidenceAccepted = applyHumanReview(evidenceCandidate, {
  decision: 'ACCEPT',
  reviewer_ref: 'human_fixture',
  reviewed_at: '2026-09-19T12:05:00.000Z'
});
assert.deepStrictEqual(evidenceAccepted.review_evidence, evidenceCandidate.review_evidence);

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
