'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {PATH,createManualMissingOfferRecoveryApiV0}=require('./manual-missing-offer-recovery-api-v0');
const sh=t=>crypto.createHash('sha256').update(t).digest('hex');
const originalText='iPhone 17 Pro 256GB\nAzul R$ 6.900,00';
const original={
 trusted_input_ref:'source-immutable-a',is_immutable:true,is_authorized:true,is_quarantined:false,
 is_supplier_bound:true,source_id:'source-immutable-a',analysis_id:'analysis-original-a',
 supplier_id:'33333333-3333-4333-8333-333333333333',original_text:originalText,
 original_sha256:sh(originalText),models:[{id:'iphone-17-pro',label:'iPhone 17 Pro'}]
};
const command={
 trusted_input_ref:'source-immutable-a',model_line:1,price_line:2,color_line:2,
 model_id:'iphone-17-pro',capacity_gb:256,color:'Azul',price_amount_minor:690000
};
const owner=async()=>({subject:'qa-owner-a',tenant_id:'tenant-qa-a',can_execute_external_calc:true});
const request=body=>({method:'POST',path:PATH,body:JSON.stringify(body)});
async function run(){
 const unavailable=createManualMissingOfferRecoveryApiV0({authenticate:owner});
 let v=await unavailable.handle(request(command));
 assert.equal(v.status,503);
 assert.equal(v.body.error.code,'RECOVERY_TRUSTED_ORIGINAL_NOT_CONFIGURED');
 assert.equal((await unavailable.handle({method:'GET',path:PATH})).status,404);

 const unauth=createManualMissingOfferRecoveryApiV0({authenticate:async()=>null});
 assert.equal((await unauth.handle(request(command))).status,401);

 const forbidden=createManualMissingOfferRecoveryApiV0({authenticate:async()=>({
  subject:'qa',tenant_id:'tenant-other',can_execute_external_calc:false})});
 assert.equal((await forbidden.handle(request(command))).status,403);

 let persisted=0,loadCalled=0;
 const api=createManualMissingOfferRecoveryApiV0({
  authenticate:owner,
  trustedInputResolver:{async resolve({trusted_input_ref,actor_ref}){
   loadCalled++;assert.equal(trusted_input_ref,'source-immutable-a');assert.equal(actor_ref,'qa-owner-a');
   return original;
  }},
  candidateRepository:{async persistCandidate(candidate){
   persisted++;
   assert.equal(candidate.domain_outcome,'REVIEW_REQUIRED');
   return {ok:true,analysis_id:candidate.analysis_id,offer_id:candidate.offer_id,offer_revision:1};
  }}
 });
 v=await api.handle(request(command));
 assert.equal(v.status,200);
 assert.equal(v.body.recovery.status,'REVIEW_REQUIRED');
 assert.equal(v.body.recovery.quoteable,false);
 assert.equal(v.body.recovery.proof.manually_recovered,true);
 assert.equal(loadCalled,1);assert.equal(persisted,1);
 assert.equal((await api.handle(request({...command,tenant_id:'forged'}))).status,422);
 assert.equal(persisted,1,'invalid command never persisted');
 assert.equal((await api.handle(request({...command,price_amount_minor:695000}))).status,422);
 assert.equal(persisted,1,'forged price never persisted');
 assert.equal((await api.handle({...request(command),body:'{broken'})).status,400);
 assert.equal((await api.handle({...request(command),body:'z'.repeat(30000)})).status,413);
 const failedApi=createManualMissingOfferRecoveryApiV0({
  authenticate:owner,
  trustedInputResolver:{resolve:async()=>original},
  candidateRepository:{persistCandidate:async()=>{throw new Error('DB_SECRET_CONNECTION_ERROR')}}
 });
 const failed=await failedApi.handle(request(command));
 assert.equal(failed.status,500);
 assert.equal(failed.body.error.code,'RECOVERY_INTERNAL_FAILURE');
 assert.equal(JSON.stringify(failed.body).includes('DB_SECRET_CONNECTION_ERROR'),false);

 console.log('C01_MANUAL_RECOVERY_API_V0=PASS');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
