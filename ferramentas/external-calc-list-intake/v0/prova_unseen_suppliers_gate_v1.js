'use strict';
const assert = require('node:assert/strict');
const {checkEvidence} = require('./gate_unseen_suppliers_v1');
const sha = 'a'.repeat(64);
const base = {
  contract_version: 'external-calc-unseen-suppliers-gate/v1',
  freeze_sha256: sha,
  parser_commit: 'b'.repeat(40),
  run_at: '2026-10-08T00:00:00Z',
  evidence_uri: 'isolated://redacted-proof',
  ground_truth_reviewed: true,
  review_queue_verified: true,
  cross_tenant_isolation_verified: true,
  critical_errors: {wrong_price_silent:0,wrong_supplier_silent:0,wrong_variant_silent:0,missing_offer_silent:0,unsafe_auto_promotion:0},
  suppliers: ['new-1','new-2','new-3'].map(source_id=>({
    source_id,sha256:sha,seen_during_development:false,ground_truth_count:2,reconciled_count:2
  }))
};
assert.equal(checkEvidence(base).passed,true);
assert.ok(checkEvidence({...base,suppliers:[{...base.suppliers[0],seen_during_development:true}]}).issues.includes('FEWER_THAN_THREE_BLIND_SUPPLIERS'));
assert.ok(checkEvidence({...base,suppliers:base.suppliers.map((s,i)=>i===0?{...s,seen_during_development:true}:s)}).issues.includes('SOURCE_NOT_BLIND'));
assert.ok(checkEvidence({...base,critical_errors:{...base.critical_errors,wrong_price_silent:1}}).issues.includes('CRITICAL_ERROR_wrong_price_silent'));
assert.ok(checkEvidence({...base,suppliers:base.suppliers.map((s,i)=>i===1?{...s,reconciled_count:1}:s)}).issues.includes('OFFERS_NOT_RECONCILED'));
assert.ok(checkEvidence({...base,cross_tenant_isolation_verified:false}).issues.includes('TENANT_ISOLATION_UNVERIFIED'));
assert.ok(checkEvidence({...base,review_queue_verified:false}).issues.includes('REVIEW_QUEUE_UNVERIFIED'));
console.log('UNSEEN_SUPPLIERS_GATE_V1=PASS positive=1 negative=6');
