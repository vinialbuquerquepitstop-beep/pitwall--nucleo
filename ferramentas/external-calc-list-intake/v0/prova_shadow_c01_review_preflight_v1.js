'use strict';
const assert=require('node:assert/strict');
const {buildShadowReviewPreflight:build}=require('./shadow-c01-review-preflight-v1');
const lines=[
 '🎧 AirPods Pro Max 2USB-C','💲(2900)','❇️PURPLE','❇️ORANGE',
 '📳18 PRO MAX 512 LL/A','⚓️BORDO / 💲12.000 - 1 pc',
 '🖱️MAGIC MOUSE','⚓️PRETO/ 💲500',
 '⌚️ULTRA PRETO 4 49MM','💲6.000'
].join('\n');
const p=build({content:lines,filename:'test.txt'});
assert.ok(p.total>=5);
assert.equal(p.total,p.review_required);
assert.equal(p.auto_promoted,0);
assert.equal(p.c01_candidates_created,0);
assert.equal(p.ready_for_c01_persistence,false);
assert.equal(p.supplier_resolution,'UNVERIFIED');
assert.equal(p.entries.length,p.total);
assert.ok(p.entries.every(x=>x.c01_candidate===null&&!x.persistence_authorized&&!x.auto_promotion_authorized));
assert.ok(p.entries.every(x=>x.reasons.includes('C01_CONTRACT_UNVERIFIED')&&x.reasons.includes('SUPPLIER_IDENTITY_UNVERIFIED')));
assert.ok(p.entries.every(x=>x.source_lines.model>0 && x.source_fingerprint.length===64));
assert.ok(p.entries.some(x=>x.display.amount_minor===1200000));
assert.ok(p.entries.some(x=>x.display.amount_minor===50000));
assert.deepStrictEqual(build({content:lines,filename:'test.txt'}),p);
assert.throws(()=>build({content:'',filename:'test.txt'}),/SOURCE_REQUIRED/);
assert.throws(()=>build({content:lines,filename:''}),/FILENAME_REQUIRED/);
const unpriced=build({content:'🎧 AirPods 4\n❇️BRANCO',filename:'unpriced.txt'});
assert.equal(unpriced.total,1);
assert.ok(unpriced.entries[0].reasons.includes('PRICE_MISSING_OR_INVALID'));
assert.ok(unpriced.entries[0].reasons.includes('SOURCE_LINE_MISSING'));
assert.equal(unpriced.entries[0].c01_candidate,null);
console.log('EXTERNAL_CALC_SHADOW_C01_PREFLIGHT_V1=PASS no_persistence=true no_auto_promotion=true');
