'use strict';
const assert=require('assert');
const { createStoreRateQuoteResolver, normalizeCommand, coefficientFromRate }=require('./store-rate-resolver');

function c01(){
 return {contract_version:'external-calc-c01-readonly/v1',analysis_id:'a1',source_id:'s1',offer_id:'o1',offer_revision:1,
 execution_status:'SUCCEEDED',domain_outcome:'VALID',freshness_status:'CURRENT',offer_identity_fingerprint:'id1',
 offer_value_fingerprint:'val1',reviewed_offer:{price:{amount_minor:400000,currency:'BRL'}},provenance_refs:[]};
}
function baseProfile(){return {profile_id:'base',profile_version:'v1',currency:'BRL',cash_margin_minor:55000,
 installment_margin_minor:65000,freight_minor:0,freight_mode:'STORE',installment_base_addon_minor:0,entry_minor:0,
 installment_coefficients:{12:9.99}};}
const profiles={
 t1:{profile_id:'rp1',tenant_id:'t1',version:3,status:'ACTIVE',currency:'BRL',rate_scale:100,
 fingerprint:'fp-t1-v3',entries:[{installment_count:12,rate_units:1050}]},
 t2:{profile_id:'rp2',tenant_id:'t2',version:1,status:'ACTIVE',currency:'BRL',rate_scale:100,
 fingerprint:'fp-t2-v1',entries:[{installment_count:12,rate_units:500}]}
};
const users={owner:{id:'owner',tenant_id:'t1',papel:'dono',ativo:true},validator:{id:'validator',tenant_id:'t1',papel:'validador',ativo:true},
 other:{id:'other',tenant_id:'t2',papel:'dono',ativo:true},seller:{id:'seller',tenant_id:'t1',papel:'vendedor',ativo:true}};
function resolver(profileMap=profiles){
 return createStoreRateQuoteResolver({source:{
  async loadMembership({auth_user_id}){return users[auth_user_id]||null;},
  async loadC01(){return c01();},
  async loadBaseCalculationProfile(){return baseProfile();},
  async loadActiveStoreRateProfile({tenant_id}){return profileMap[tenant_id]||null;}
 }});
}
const command={analysis_id:'a1',offer_id:'o1',offer_revision:1,installment_count:12};
(async()=>{
 assert.strictEqual(coefficientFromRate(1050,100),1.105);
 for(const key of ['tenant_id','profile_id','rate_units','rate_scale','coefficient','total_amount_minor']){
  assert.throws(()=>normalizeCommand({...command,[key]:'spoof'}),e=>e.code==='RATE_PROFILE_FORBIDDEN');
 }
 const a=await resolver().resolveQuote({auth_user_id:'owner',calculation_run_id:'r1',command});
 const b=await resolver().resolveQuote({auth_user_id:'validator',calculation_run_id:'r2',command});
 assert.strictEqual(a.rate_profile_id,'rp1'); assert.strictEqual(b.rate_profile_id,'rp1');
 assert.strictEqual(a.rate_profile_version,3); assert.strictEqual(a.rate_profile_fingerprint,'fp-t1-v3');
 assert.strictEqual(a.applied_rate_units,1050); assert.strictEqual(a.applied_rate_scale,100);
 assert.deepStrictEqual(a.total,b.total);
 const other=await resolver().resolveQuote({auth_user_id:'other',calculation_run_id:'r3',command});
 assert.strictEqual(other.rate_profile_id,'rp2'); assert.notDeepStrictEqual(other.total,a.total);
 await assert.rejects(()=>resolver().resolveQuote({auth_user_id:'seller',calculation_run_id:'r4',command}),e=>e.code==='RATE_PROFILE_FORBIDDEN');
 await assert.rejects(()=>resolver({t2:profiles.t2}).resolveQuote({auth_user_id:'owner',calculation_run_id:'r5',command}),e=>e.code==='RATE_PROFILE_NOT_CONFIGURED');
 const missing={...profiles,t1:{...profiles.t1,entries:[]}};
 await assert.rejects(()=>resolver(missing).resolveQuote({auth_user_id:'owner',calculation_run_id:'r6',command}),e=>e.code==='INSTALLMENT_RATE_NOT_CONFIGURED');
 const invalid={...profiles,t1:{...profiles.t1,tenant_id:'evil'}};
 await assert.rejects(()=>resolver(invalid).resolveQuote({auth_user_id:'owner',calculation_run_id:'r7',command}),e=>e.code==='RATE_PROFILE_INVALID');
 const oneXProfile={...profiles,t1:{...profiles.t1,entries:[{installment_count:1,rate_units:0}]}};
 const one=await resolver(oneXProfile).resolveQuote({auth_user_id:'owner',calculation_run_id:'r8',command:{...command,installment_count:1}});
 assert.strictEqual(one.installment_count,1); assert.strictEqual(one.applied_rate_units,0);
 console.log('EXTERNAL_CALC_STORE_RATE_PROFILE_RESOLVER_C02_G3=PASS');
})().catch(e=>{console.error(e);process.exit(1);});
