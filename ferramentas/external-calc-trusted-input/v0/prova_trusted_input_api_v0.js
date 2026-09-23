'use strict';
const assert=require('assert');
const {createTrustedInputApiV0,INGEST_PATH}=require('./trusted-input-api');
async function main(){
 let received=null, runtimeRef=null;
 const api=createTrustedInputApiV0({
  authenticate:async()=>({tenant_id:'store-a',subject:'user-a',can_execute_external_calc:true}),
  ingestion:{async ingest(v){received=v;return {ingestion_id:'ing_1',status:'READY',accepted:[{source_id:'src_1',trusted_input_ref:'trusted:v0:store-a:src_1'}],rejected:[]};}},
  candidateRuntime:{async execute(v){runtimeRef=v;return {analysis_id:'analysis_1',source_id:'src_1',stage:'REVIEW',execution_status:'SUCCEEDED',candidates:[{offer_id:'offer_1',offer_revision:1,domain_outcome:'REVIEW_REQUIRED'}],persisted_count:1};}}
 });
 const res=await api.handle({method:'POST',path:INGEST_PATH,body:{filename:'lista.txt',content_type:'text/plain',content_base64:Buffer.from('lista').toString('base64')}});
 assert.strictEqual(res.status,201);assert.strictEqual(received.tenant_id,'store-a');assert.strictEqual(received.actor_ref,'user-a');
 assert.deepStrictEqual(runtimeRef,{trusted_input_ref:'trusted:v0:store-a:src_1'});
 assert.strictEqual(res.body.next_stage,'REVIEW');assert.strictEqual(res.body.review_runs[0].persisted_count,1);
 const forged=await api.handle({method:'POST',path:INGEST_PATH,body:{filename:'x.txt',content_base64:'eA==',tenant_id:'evil'}});
 assert.strictEqual(forged.status,400);assert.strictEqual(forged.body.error.code,'CLIENT_AUTHORITY_FIELD');
 console.log('Trusted Input API V0 gate: PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
