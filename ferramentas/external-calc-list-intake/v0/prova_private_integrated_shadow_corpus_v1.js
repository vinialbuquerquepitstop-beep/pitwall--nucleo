'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {runPrivateIntegratedCorpus:run}=require('./private-integrated-shadow-corpus-v1');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'calc-integrated-private-'));
try{
 const source=[
 'LOJA EXEMPLO ATACADO',
 '📳18 PRO MAX 512 LL/A','⚓️BORDO / 💲12.000 - 1 pc',
 '🖱️MAGIC MOUSE','⚓️PRETO/ 💲500'
 ].join('\n');
 fs.writeFileSync(path.join(dir,'real-private-name.txt'),source);
 const known=run({directory:dir,suppliers:[{supplier_id:'private-supplier-01',name:'Loja Exemplo Atacado'}]});
 assert.equal(known.files_seen,1);
 assert.equal(known.known_supplier_matches,1);
 assert.ok(known.interpreted>=2);
 assert.equal(known.interpreted,known.blocked);
 assert.equal(known.persisted,0);
 assert.equal(known.auto_promoted,0);
 assert.equal(known.c01_candidates_created,0);
 assert.equal(known.release_status,'NO_GO');
 assert.equal(known.source_level_truth_verified,false);
 assert.equal(known.operational_batch_verified,false);
 const exported=JSON.stringify(known);
 assert.ok(!exported.includes('real-private-name'));
 assert.ok(!exported.includes('LOJA EXEMPLO'));
 assert.ok(!exported.includes('private-supplier-01'));
 assert.ok(!exported.includes('12000'));
 const unknown=run({directory:dir,suppliers:[]});
 assert.equal(unknown.unknown_supplier_matches,1);
 assert.equal(unknown.interpreted,unknown.blocked);
 assert.equal(unknown.persisted,0);
 assert.throws(()=>run({directory:dir,suppliers:{}}),/SUPPLIER_CATALOG_INVALID/);
 assert.throws(()=>run({directory:path.join(dir,'absent')})); 
 console.log('EXTERNAL_CALC_PRIVATE_INTEGRATED_SHADOW_CORPUS_V1=PASS safety=NO_GO privacy=PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
