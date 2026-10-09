'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {benchmarkCorpus}=require('./private-corpus-benchmark-v1');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'calc-corpus-proof-'));
try{
 const source='Fornecedor Alpha — ATACADO\n'+'iPhone 15 128GB\n'+'🎨 Preto\n'+'💵 R$ 4.500,00';
 fs.writeFileSync(path.join(tmp,'supplier-fixture.txt'),source);
 const r=benchmarkCorpus(tmp);
 assert.equal(r.files_seen,1);
 assert.ok(r.total_candidates>=1);
 assert.equal(r.files[0].sha256.length,64);
 assert.equal(r.files[0].filename,'supplier-fixture.txt');
 assert.equal(r.files[0].candidates,r.files[0].auto_eligible+r.files[0].review_required);
 assert.equal(r.source_level_ground_truth_reconciled,false);
 assert.equal(r.integrated_batch_proven,false);
 assert.equal(r.unseen_suppliers_gate_proven,false);
 assert.equal(r.release_status,'NO_GO');
 const exported=JSON.stringify(r);
 assert.ok(!exported.includes('Fornecedor Alpha'));
 assert.ok(!exported.includes('4.500'));
 assert.ok(!exported.includes('iPhone 15'));
 assert.throws(()=>benchmarkCorpus(path.join(tmp,'none'))); 
 console.log('EXTERNAL_CALC_PRIVATE_CORPUS_BENCHMARK_V1=PASS privacy=PASS release=NO_GO');
} finally {fs.rmSync(tmp,{recursive:true,force:true});}
