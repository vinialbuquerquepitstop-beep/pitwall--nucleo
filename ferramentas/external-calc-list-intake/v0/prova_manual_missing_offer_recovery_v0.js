'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {buildManualRecoveryCandidate,createManualMissingOfferRecoveryV0}=require('./manual-missing-offer-recovery-v0');
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const text=[
 'Fornecedor Alpha',
 'iPhone 17 Pro 256GB',
 'Azul R$ 6.900,00',
 'iPhone 17 256GB',
 'Preto R$ 5.500,00'
].join('\n');
const original={
 trusted_input_ref:'original-secure-001',
 is_immutable:true,is_authorized:true,is_quarantined:false,is_supplier_bound:true,
 analysis_id:'analysis_secure_001',source_id:'original-secure-001',
 supplier_id:'33333333-3333-4333-8333-333333333333',
 original_text:text,original_sha256:sha(text),
 models:[{id:'iphone-17',label:'iPhone 17'},{id:'iphone-17-pro',label:'iPhone 17 Pro'}]
};
const cmd={
 trusted_input_ref:'original-secure-001',model_line:2,price_line:3,color_line:3,
 model_id:'iphone-17-pro',capacity_gb:256,color:'Azul',
 price_amount_minor:690000
};
const a=buildManualRecoveryCandidate(original,cmd);
assert.equal(a.candidate.contract_version,'external-calc-c01-readonly/v1');
assert.equal(a.candidate.domain_outcome,'REVIEW_REQUIRED');
assert.equal(a.candidate.stage,'REVIEW');
assert.equal(a.candidate.review,null);
assert.equal(a.candidate.reviewed_offer,null);
assert.equal(a.candidate.interpreted_offer.price.amount_minor,690000);
assert.equal(a.candidate.interpreted_offer.model.id,'iphone-17-pro');
assert.deepEqual(a.candidate.review_evidence.field_sources.price,[3]);
assert.deepEqual(a.candidate.review_evidence.source_lines.map(x=>x.line_number),[2,3]);
assert.equal(a.proof.auto_promotable,false);
assert.equal(a.proof.review_required,true);
assert.equal(buildManualRecoveryCandidate(original,cmd).candidate.offer_id,a.candidate.offer_id);
function rejects(next,pattern){
 assert.throws(()=>buildManualRecoveryCandidate(original,next),pattern);
}
rejects({...cmd,price_amount_minor:695000},/RECOVERY_PRICE_NOT_IN_ORIGINAL/);
rejects({...cmd,model_id:'iphone-17'},/RECOVERY_LONGER_MODEL_IN_ORIGINAL/);
rejects({...cmd,capacity_gb:512},/RECOVERY_CAPACITY_NOT_IN_ORIGINAL/);
rejects({...cmd,color:'Preto'},/RECOVERY_COLOR_EXACT_SEGMENT_REQUIRED/);
rejects({...cmd,color_line:5},/RECOVERY_STRICT_C01_SOURCE_SCOPE_REQUIRED/);
rejects({...cmd,color_line:3,color:undefined},/RECOVERY_COLOR_LINE_REQUIRED/);
rejects({...cmd,condition_line:2},/RECOVERY_CONDITION_LINE_REQUIRED/);
rejects({...cmd,price_line:5},/RECOVERY_STRICT_C01_SOURCE_SCOPE_REQUIRED/);
rejects({...cmd,price_line:12},/RECOVERY_SOURCE_LINE_INVALID/);
rejects({...cmd,analysis_id:'new-tenant'},/RECOVERY_COMMAND_INVALID/);
rejects({...cmd,tenant_id:'11111111-1111-4111-8111-111111111111'},/RECOVERY_COMMAND_INVALID/);
rejects({...cmd,original_text:'R$ 5,00'},/RECOVERY_COMMAND_INVALID/);
assert.throws(()=>buildManualRecoveryCandidate(
 {...original,original_sha256:'tampered'},cmd),/RECOVERY_TRUSTED_ORIGINAL_UNAVAILABLE/);
assert.throws(()=>buildManualRecoveryCandidate(
 {...original,is_authorized:false},cmd),/RECOVERY_TRUSTED_ORIGINAL_UNAVAILABLE/);
assert.throws(()=>buildManualRecoveryCandidate(
 {...original,is_quarantined:true},cmd),/RECOVERY_TRUSTED_ORIGINAL_UNAVAILABLE/);
assert.throws(()=>buildManualRecoveryCandidate(
 {...original,is_supplier_bound:false},cmd),/RECOVERY_TRUSTED_ORIGINAL_UNAVAILABLE/);
assert.throws(()=>buildManualRecoveryCandidate(
 {...original,original_text:text+'\nR$ 1,00'},cmd),/RECOVERY_TRUSTED_ORIGINAL_UNAVAILABLE/);
const multiple=text.replace('Azul R$ 6.900,00','Azul R$ 5.900,00 ou R$ 6.100,00');
assert.throws(()=>buildManualRecoveryCandidate(
 {...original,original_text:multiple,original_sha256:sha(multiple)},
 {...cmd,price_amount_minor:590000}),/RECOVERY_EXACT_ONE_MONETARY_PRICE_REQUIRED/);
(async()=>{
 let persisted=null;
 const calls=[];
 const engine=createManualMissingOfferRecoveryV0({
  trustedInputResolver:{resolve:async args=>{
   calls.push(args);
   return original;
  }},
  candidateRepository:{persistCandidate:async candidate=>{
   persisted=candidate;
   return {ok:true,analysis_id:candidate.analysis_id,offer_id:candidate.offer_id,offer_revision:1,idempotent:false};
  }}
 });
 const result=await engine.execute({command:cmd,actor_ref:'signed-user'});
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0],{trusted_input_ref:cmd.trusted_input_ref,actor_ref:'signed-user'});
 assert.equal(result.status,'REVIEW_REQUIRED');
 assert.equal(result.quoteable,false);
 assert.equal(result.offer_id,persisted.offer_id);
 assert.equal(result.proof.original_sha256,original.original_sha256);
 assert.equal(result.proof.manually_recovered,true);
 await assert.rejects(()=>engine.execute({command:cmd,actor_ref:''}),
   /RECOVERY_AUTHENTICATED_ACTOR_REQUIRED/);
 const denied=createManualMissingOfferRecoveryV0({
  trustedInputResolver:{resolve:async()=>({...original,is_authorized:false})},
  candidateRepository:{persistCandidate:async()=>{throw new Error('PERSIST_SHOULD_NOT_BE_CALLED')}}
 });
 await assert.rejects(()=>denied.execute({command:cmd,actor_ref:'qa'}),
   /RECOVERY_TRUSTED_ORIGINAL_UNAVAILABLE/);
 const wrongReceipt=createManualMissingOfferRecoveryV0({
  trustedInputResolver:{resolve:async()=>original},
  candidateRepository:{persistCandidate:async()=>({ok:true,offer_id:'forged'})}
 });
 await assert.rejects(()=>wrongReceipt.execute({command:cmd,actor_ref:'qa'}),
   /RECOVERY_PERSISTENCE_NOT_CONFIRMED/);
 console.log('C01_MANUAL_MISSING_OFFER_RECOVERY_V0=PASS scenario_count=20');
})().catch(e=>{console.error(e);process.exitCode=1;});
