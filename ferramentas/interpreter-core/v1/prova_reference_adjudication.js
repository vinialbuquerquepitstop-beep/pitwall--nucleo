'use strict';

const assert = require('assert');
const { applyReferenceAdjudication } = require('./reference-adjudication');

const knowledge = {
  entities: [
    { kind: 'model', id: 'm1', label: 'Model 1', attributes: {} },
    { kind: 'model', id: 'm2', label: 'Model 2', attributes: {} }
  ]
};

const legacy = {
  offers: [
    { legacy_record_id: 'a', fields: { model: { id: 'm1', label: 'Model 1' }, price: 100 } },
    { legacy_record_id: 'b', fields: { model: { id: 'm1', label: 'Model 1' }, price: 200 } },
    { legacy_record_id: 'c', fields: { model: { id: 'm2', label: 'Model 2' }, price: 300 } }
  ]
};

const reference = {
  contract_version: 'interpreter-reference-adjudication/v1',
  adjudication_id: 'fixture-v1',
  source_load_id: 'load-1',
  status: 'reviewed_reference_v1',
  corrections: [
    { legacy_record_id: 'a', expected_from_model: 'm1', to_model: 'm2', reason: 'fixture' }
  ],
  exclusions: [
    { legacy_record_id: 'b', expected_model: 'm1', reason: 'fixture' }
  ]
};

const result = applyReferenceAdjudication({
  legacyBundle: legacy,
  knowledgeSnapshot: knowledge,
  reference,
  sourceLoadId: 'load-1'
});

assert.strictEqual(result.legacy.offers.length, 2);
assert.strictEqual(result.legacy.offers.find(x => x.legacy_record_id === 'a').fields.model.id, 'm2');
assert.ok(!result.legacy.offers.some(x => x.legacy_record_id === 'b'));
assert.strictEqual(result.audit.correction_count, 1);
assert.strictEqual(result.audit.exclusion_count, 1);
assert.strictEqual(result.audit.total_adjustments, 2);

assert.throws(() => applyReferenceAdjudication({
  legacyBundle: legacy,
  knowledgeSnapshot: knowledge,
  reference,
  sourceLoadId: 'other-load'
}), /source_load_id divergente/);

assert.throws(() => applyReferenceAdjudication({
  legacyBundle: legacy,
  knowledgeSnapshot: knowledge,
  reference: {
    ...reference,
    corrections: [
      { legacy_record_id: 'a', expected_from_model: 'm2', to_model: 'm1' }
    ],
    exclusions: []
  },
  sourceLoadId: 'load-1'
}), /modelo de origem divergente/);

console.log('OK reference adjudication proof');
