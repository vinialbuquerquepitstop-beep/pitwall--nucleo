'use strict';
const assert=require('assert');
const {buildQueue}=require('./list-intake-api');

const sample=[
  'Fornecedor Alpha',
  'iPhone 15 128GB Preto R$ 4.500',
  'iPhone 15 128GB Azul R$ 4.450'
].join('\n');

const first=buildQueue({filename:'lista.txt',mime_type:'text/plain',content:sample});
const second=buildQueue({filename:'lista.txt',mime_type:'text/plain',content:sample});
assert.strictEqual(first.analysis_id,second.analysis_id);
assert.strictEqual(first.source_id,second.source_id);
assert.strictEqual(first.type,'txt');
assert.ok(Array.isArray(first.queue.candidates));
assert.ok(first.queue.candidates.length>=1);
for(const c of first.queue.candidates){
  assert.strictEqual(c.contract_version,'external-calc-c01-readonly/v1');
  assert.strictEqual(c.domain_outcome,'REVIEW_REQUIRED');
  assert.strictEqual(c.freshness_status,'CURRENT');
}
console.log('EXTERNAL_CALC_LIST_INTAKE_V0=PASS candidates='+first.queue.candidates.length);
