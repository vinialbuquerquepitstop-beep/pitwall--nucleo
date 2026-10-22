'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {auditDirectory}=require('./auditar_corpus_local_v0');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'external-calc-private-local-fixture-'));
try{
  const raw=['Fornecedor Local Teste — ATACADO','iPhone 15 128GB','🎨 Preto','💵 R$ 4.500,00'].join('\n');
  fs.writeFileSync(path.join(dir,'01-lista.txt'),raw,'utf8');
  const result=auditDirectory(dir);
  assert.equal(result.total_input_files,1);
  assert.equal(result.parsed_files,1);
  assert.equal(result.failed_files,0);
  assert.equal(result.total_candidates,1);
  assert.equal(result.source_price_exact_count,1);
  assert.equal(result.items[0].candidates_detail[0].amount_minor,450000);
  assert.deepEqual(result.items[0].candidates_detail[0].price_source_lines,[4]);
  assert.equal(result.items[0].candidates_detail[0].exact_price_present_on_source_line,true);
  assert.equal(result.items[0].candidates_detail[0].hypothetical_auto_eligible_if_supplier_verified,true);
  assert(!JSON.stringify(result).includes('Fornecedor Local Teste — ATACADO'),
    'full raw source must not leak into the audit report');
  assert.match(result.disclaimer,/No supplier verified/);
  console.log('EXTERNAL_CALC_GATE1_LOCAL_CORPUS_SYNTHETIC_V0=PASS');
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}
