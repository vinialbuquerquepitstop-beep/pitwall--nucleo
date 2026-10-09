'use strict';
const assert=require('node:assert/strict');
const {auditIntegratedShadow:run}=require('./shadow-integrated-readonly-v1');
const content=[
 'LOJA EXEMPLO ATACADO',
 '📳18 PRO MAX 512 LL/A',
 '⚓️BORDO / 💲12.000 - 1 pc',
 '🖱️MAGIC MOUSE',
 '⚓️PRETO/ 💲500',
 '🎧 AirPods Pro Max 2USB-C',
 '💲(2900)',
 '❇️PURPLE'
].join('\n');
const known={supplier_id:'synthetic-supplier',name:'Loja Exemplo Atacado',phone:null};
const matched=run({filename:'synthetic.txt',content,suppliers:[known]});
assert.equal(matched.supplier.state,'MATCHED_EXISTING_REVIEW_ONLY');
assert.equal(matched.supplier.matched_supplier_id,'synthetic-supplier');
assert.ok(matched.summary.interpreted>=3);
assert.equal(matched.summary.interpreted,matched.summary.blocked);
assert.equal(matched.summary.persisted,0);
assert.equal(matched.summary.auto_promoted,0);
assert.equal(matched.summary.c01_candidates_created,0);
assert.equal(matched.status,'NO_GO');
assert.equal(matched.ready_for_c01_persistence,false);
assert.equal(matched.c01_persistence_authorized,false);
assert.ok(matched.decisions.every(x=>x.decision==='BLOCKED'&&x.c01_candidate===null&&!x.persistence_authorized));
assert.ok(matched.review_preflight.every(x=>x.decision==='REVIEW_REQUIRED'&&x.c01_candidate===null));
assert.deepEqual(matched,run({filename:'synthetic.txt',content,suppliers:[known]}));
const unknown=run({filename:'synthetic.txt',content,suppliers:[]});
assert.equal(unknown.supplier.state,'UNKNOWN_REVIEW_ONLY');
assert.equal(unknown.supplier.matched_supplier_id,null);
assert.equal(unknown.summary.persisted,0);
assert.equal(unknown.summary.blocked,unknown.summary.interpreted);
assert.throws(()=>run({filename:'',content,suppliers:[]}),/FILENAME_REQUIRED/);
assert.throws(()=>run({filename:'synthetic.txt',content:'',suppliers:[]}),/CONTENT_REQUIRED/);
console.log('EXTERNAL_CALC_SHADOW_INTEGRATED_READONLY_V1=PASS known_unknown_suppliers=true no_writes=true');
