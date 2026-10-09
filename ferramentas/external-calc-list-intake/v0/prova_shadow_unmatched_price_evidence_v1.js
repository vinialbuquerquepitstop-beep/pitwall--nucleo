'use strict';
const assert=require('node:assert/strict');
const {auditUnmatchedPriceEvidence:audit}=require('./shadow-unmatched-price-evidence-v1');
const input=[
 '🖱️MAGIC MOUSE',
 '⚓️PRETO/ 💲500',
 'Observações',
 'R$ 999,00',
 '🎧 AirPods 4',
 '💲(2900)',
 '❇️PRETO'
].join('\n');
const r=audit(input);
assert.equal(r.price_like_lines,3);
assert.equal(r.covered_price_like_lines,2);
assert.equal(r.unmatched_price_like_lines,1);
assert.equal(r.release_status,'NO_GO');
assert.equal(r.source_truth_verified,false);
assert.equal(r.evidence.filter(e=>!e.covered_by_shadow)[0].line,4);
assert.equal(r.evidence.filter(e=>!e.covered_by_shadow)[0].fingerprint.length,64);
const serialized=JSON.stringify(r);
assert.ok(!serialized.includes('999,00'));
assert.ok(!serialized.includes('MAGIC MOUSE'));
assert.ok(!serialized.includes('PRETO'));
assert.deepStrictEqual(r,audit(input));
const noPrices=audit('Fornecedor\nLista em atualização');
assert.equal(noPrices.price_like_lines,0);
assert.equal(noPrices.unmatched_price_like_lines,0);
assert.throws(()=>audit(null),/SOURCE_REQUIRED/);
console.log('EXTERNAL_CALC_SHADOW_UNMATCHED_PRICE_EVIDENCE_V1=PASS no_source_leak=true');
