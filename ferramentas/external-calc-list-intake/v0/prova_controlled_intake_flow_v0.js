'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {processListIntakeCommand,buildQueue}=require('./list-intake-api');
const source=[
 'Fornecedor Alpha — ATACADO',
 'iPhone 15 128GB',
 '🎨 Preto',
 '💵 R$ 4.500,00',
 'Outra linha isolada R$ 5.990,00'
].join('\n');
const filename='lista.txt',supplier_id='33333333-3333-4333-8333-333333333333';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'staging-fixture'};
(async()=>{
 const built=buildQueue({filename,mime_type:'text/plain',supplier_id,content:source});
 assert.ok(built.queue.candidates.length>=1,'the fixture must contain a genuine parse candidate');
 assert.equal(built.price_coverage.can_auto_promote,false);
 assert.equal(built.price_coverage.source_truth_verified,false);
 const calls=[];
 const original=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{
   const name=String(url).split('/rpc/')[1];
   calls.push({name,body:JSON.parse(init.body)});
   if(name==='extcalc_bind_source_supplier_v0')
     return new Response(JSON.stringify({ok:true}),{status:200});
   if(name==='extcalc_persist_review_candidate_v0'){
     assert.equal(init.headers.authorization,'Bearer signed-in-QA-fixture');
     assert.equal(calls.at(-1).body.p_candidate.domain_outcome,'REVIEW_REQUIRED');
     return new Response(JSON.stringify({ok:true,idempotent:false}),{status:200});
   }
   throw new Error('UNEXPECTED_RPC '+name);
 };
 try{
  const result=await processListIntakeCommand({
    env,token:'signed-in-QA-fixture',
    rawCommand:{supplier_id,filename,mime_type:'text/plain',content:source}
  });
  assert.equal(result.review_mode,'HUMAN_REVIEW_REQUIRED');
  assert.equal(result.auto_promoted,0);
  assert.equal(result.review_required,result.candidates);
  assert.equal(result.persisted,result.candidates);
  assert.equal(result.manual_recovery_required,
    result.price_coverage.unmatched_price_signal_lines>0 ||
    result.price_coverage.unverified_candidate_price_spans>0);
  assert.ok(result.price_coverage.detected_price_signal_lines>=1);
  assert.equal(result.review_reasons.CONTROLLED_V0_REVIEW_ONLY,result.candidates);
  assert.equal(calls[0].name,'extcalc_bind_source_supplier_v0');
  assert.equal(calls.filter(x=>x.name==='extcalc_persist_review_candidate_v0').length,result.candidates);
  assert.equal(calls.some(x=>x.name==='extcalc_persist_auto_promoted_c01_v0'),false);
  const sourceCode=fs.readFileSync(path.join(__dirname,'list-intake-api.js'),'utf8');
  const chunk=sourceCode.split('async function processListIntakeCommand(')[1].split('function createListIntakeApiV0(')[0];
  assert.ok(!/rpc\(env,token,'extcalc_persist_auto_promoted_c01_v0'/.test(chunk));
  console.log('C01_CONTROLLED_INTAKE_FLOW_V0=PASS candidates='+result.candidates+' unmatched='+result.price_coverage.unmatched_price_signal_lines);
 }finally{globalThis.fetch=original;}
})().catch(error=>{console.error(error);process.exitCode=1;});
