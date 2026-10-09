'use strict';
const assert=require('node:assert/strict');
const {auditShadowAuthority,auditShadowSource}=require('./shadow-authority-gate-v1');
const source=[
 '🎧 AirPods Pro Max 2USB-C','💲(2900)','❇️PURPLE',
 '📳18 PRO MAX 512 LL/A','⚓️BORDO / 💲12.000 - 1 pc',
 '🖱️MAGIC MOUSE','⚓️PRETO/ 💲500'
].join('\n');
const result=auditShadowSource({content:source,filename:'synthetic.txt'});
assert.ok(result.blocked>=3);
assert.equal(result.blocked,result.review_items);
assert.equal(result.persisted,0);
assert.equal(result.auto_promoted,0);
assert.equal(result.c01_candidates_created,0);
assert.equal(result.ready_for_c01_persistence,false);
assert.equal(result.gate_status,'NO_GO');
assert.ok(result.entries.every(e=>e.decision==='BLOCKED'&&!e.persistence_authorized&&!e.auto_promotion_authorized&&e.c01_candidate===null));
assert.ok(result.entries.every(e=>e.reasons.includes('SUPPLIER_IDENTITY_UNVERIFIED')));
assert.ok(result.entries.every(e=>e.reasons.includes('SHADOW_NOT_C01_CONTRACT')));
assert.ok(result.entries.every(e=>e.reasons.includes('NO_PERSISTENCE_AUTHORITY')));
const malformed=auditShadowAuthority({contract_version:'external-calc-shadow-c01-preflight/v1',
 source_id:'synthetic',supplier_resolution:'VERIFIED',entries:[{
  preflight_id:'bad',display:{amount_minor:null},source_lines:{model:1,price:null},
  source_fingerprint:'invalid',decision:'APPROVED',c01_candidate:{some:'unsafe'},
  auto_promotion_authorized:true,persistence_authorized:true,reasons:[]}]});
assert.equal(malformed.blocked,1);
assert.ok(malformed.entries[0].reasons.includes('PRICE_MISSING_OR_INVALID'));
assert.ok(malformed.entries[0].reasons.includes('SOURCE_LINE_MISSING'));
assert.ok(malformed.entries[0].reasons.includes('SOURCE_FINGERPRINT_INVALID'));
assert.ok(malformed.entries[0].reasons.includes('UNSAFE_SHADOW_PREFLIGHT'));
assert.equal(malformed.entries[0].c01_candidate,null);
assert.equal(malformed.ready_for_c01_persistence,false);
assert.throws(()=>auditShadowAuthority({}),/SHADOW_PREFLIGHT_CONTRACT_INVALID/);
console.log('EXTERNAL_CALC_SHADOW_AUTHORITY_GATE_V1=PASS blocked=true persistence=false');
