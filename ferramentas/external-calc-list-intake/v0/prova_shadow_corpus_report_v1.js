'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {reportShadowCorpus}=require('./shadow-corpus-report-v1');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shadow-corpus-'));
try{
 fs.writeFileSync(path.join(dir,'supplier-test.txt'),[
  '🎧 AirPods Pro Max 2USB-C','💲(2900)','❇️PURPLE',
  '📳18 PRO MAX 512 LL/A','⚓️BORDO / 💲12.000 - 1 pc',
  '🖱️MAGIC MOUSE','⚓️PRETO/ 💲500'].join('\n'));
 const report=reportShadowCorpus(dir);
 assert.equal(report.files_seen,1);
 assert.ok(report.total_shadow_candidates>=3);
 assert.equal(report.auto_promoted,0);
 assert.equal(report.release_status,'NO_GO');
 assert.equal(report.ground_truth_reconciled,false);
 assert.equal(report.batch_integrated,false);
 assert.equal(report.files[0].sha256.length,64);
 assert.equal(report.files[0].auto_promoted,0);
 assert.ok(report.files[0].engines.MEGA_SCOPED>=1);
 assert.ok(report.files[0].engines.CAPTAIN_VARIANTS>=1);
 assert.ok(report.files[0].engines.CAPTAIN_STANDALONE>=1);
 const serialized=JSON.stringify(report);
 assert.ok(!serialized.includes('BORDO'));
 assert.ok(!serialized.includes('MAGIC MOUSE'));
 assert.ok(!serialized.includes('2900'));
 console.log('EXTERNAL_CALC_SHADOW_CORPUS_V1=PASS no_auto_promotion=true no_source_leak=true');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
