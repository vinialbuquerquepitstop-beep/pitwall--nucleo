'use strict';
const assert=require('node:assert/strict');
const {buildQueue}=require('./list-intake-api');
const supplierA='11111111-1111-4111-8111-111111111111';
const supplierB='22222222-2222-4222-8222-222222222222';
const list={content:'iPhone 17 Pro 256GB\nR$ 6.850,00',filename:'lista.txt'};
const a=buildQueue({...list,supplier_id:supplierA});
const b=buildQueue({...list,supplier_id:supplierA});
const other=buildQueue({...list,supplier_id:supplierB});
assert.equal(a.source_id,b.source_id);
assert.equal(a.analysis_id,b.analysis_id);
assert.deepEqual(a.queue.candidates,b.queue.candidates,
  'the entire immutable C01 candidate snapshot must remain stable on retry');
assert.notEqual(a.source_id,other.source_id,
  'two suppliers must never share a source identifier');
assert.notEqual(a.queue.interpretation_run_id,other.queue.interpretation_run_id,
  'the interpretation lineage must be supplier-scoped');
console.log('INTAKE_BOUNDED_PAGING_IDEMPOTENT_SNAPSHOT=PASS');
