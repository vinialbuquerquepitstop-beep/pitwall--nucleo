'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeTrustedCalcSource,SQL,DENIED}=require('./upgrade-trusted-calc-source');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const candidate={contract_version:'external-calc-c01-readonly/v1',analysis_id:'analysis1',
 offer_id:'sale1',offer_revision:2,offer_value_fingerprint:'vsale1',execution_status:'SUCCEEDED',
 domain_outcome:'VALID',freshness_status:'CURRENT',reviewed_offer:{supplier_id:'source1',
 model:{id:'iphone17pro',label:'iPhone 17 Pro'},capacity_gb:256,condition:'lacrado',
 color:'Silver',price:{amount_minor:600000,currency:'BRL'}}};
const used={...candidate,tenant_id:tenant,offer_id:'used1',
 offer_value_fingerprint:'vused1',reviewed_offer:{...candidate.reviewed_offer,
 supplier_id:'usedsupplier',model:{id:'iphone14pro',label:'iPhone 14 Pro'},
 capacity_gb:128,condition:'seminovo'}};
const profile={profile_id:'calc1',profile_version:'v1',currency:'BRL',
 cash_margin_minor:90000,installment_margin_minor:100000,freight_minor:2000,
 freight_mode:'STORE',installment_coefficients:{12:1.14}};
const rateId='d71c03a5-c98d-4fe9-ad8c-ea4c20d18591',policyId='930e39e4-6ee4-414a-861a-99c318bf40a6';
function fixture(patch={}){
 const calls=[];
 const tx={async query(sql,args){
  calls.push({sql,args});
  if(sql===SQL.C01_SQL)return {rows:[{c01_snapshot:candidate,
   c01_contract_version:'external-calc-c01-readonly/v1',offer_value_fingerprint:patch.fingerprint??'vsale1',
   domain_outcome:'VALID',freshness_status:'CURRENT'}]};
  if(sql===SQL.RATE_SQL)return {rows:patch.rates??[{
   tenant_id:tenant,profile_id:rateId,version:3,status:'ACTIVE',
   currency:'BRL',rate_scale:10000,fingerprint:'ratefp'}]};
  if(sql===SQL.TRADE_POLICY_SQL)return {rows:patch.policies??[{
   tenant_id:tenant,policy_id:policyId,version:2,status:'ACTIVE',
   currency:'BRL',deduction_amount_minor:'30000',fingerprint:'policyfp'}]};
  if(sql===SQL.ENTRIES_SQL)return {rows:patch.entries??[{installment_count:12,rate_units:'90000'}]};
  throw Error('Unexpected SQL');
 }};
 const source=createUpgradeTrustedCalcSource({enabled:true,
  loadCalculationProfile:async()=>patch.calculationProfile??profile,
  loadTradeInCandidates:async()=>patch.candidates??[used]});
 return {source,tx,calls};
}
const request={tenantId:tenant,analysisId:'analysis1',offerId:'sale1',offerRevision:2};
const denied=async fn=>assert.rejects(fn,e=>e.code===DENIED);
test('disabled default does not perform SQL',async()=>{
 const disabled=createUpgradeTrustedCalcSource();
 await denied(disabled(request));
});
test('reads exact C01, profile entries and trade-in policy using scoped parameters',async()=>{
 const {source,tx,calls}=fixture();
 const r=await source({...request,tx});
 assert.equal(r.reviewedCandidate.tenant_id,tenant);
 assert.equal(r.reviewedCandidate.offer_value_fingerprint,'vsale1');
 assert.equal(r.activeRateProfile.entries[0].rate_units,90000);
 assert.equal(r.tradeInPolicy.deduction_amount_minor,30000);
 assert.equal(r.tradeInCandidates[0].reviewed_offer.model.id,'iphone14pro');
 assert.deepEqual(calls[0].args,[tenant,'analysis1','sale1',2]);
 assert.deepEqual(calls[1].args,[tenant]);
 assert.deepEqual(calls[2].args,[tenant]);
 assert.deepEqual(calls[3].args,[rateId]);
});
test('mismatched C01 fingerprint fails closed',async()=>{
 const {source,tx}=fixture({fingerprint:'STALE'});
 await denied(source({...request,tx}));
});
test('multiple active financial profiles cannot choose arbitrary one',async()=>{
 const rate={tenant_id:tenant,profile_id:rateId,version:3,status:'ACTIVE',
 currency:'BRL',rate_scale:10000,fingerprint:'ratefp'};
 const {source,tx}=fixture({rates:[rate,rate]});
 await denied(source({...request,tx}));
});
test('missing or malformed rate entries are rejected',async()=>{
 for(const entries of [[],[{installment_count:12,rate_units:'-10'}],
  [{installment_count:12,rate_units:'90000'},{installment_count:12,rate_units:'10000'}]]){
  const {source,tx}=fixture({entries});
  await denied(source({...request,tx}));
 }
});
test('cross-tenant or stale trade-in offer is rejected',async()=>{
 for(const candidates of [[{...used,tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'}],
   [{...used,freshness_status:'STALE'}]]){
  const {source,tx}=fixture({candidates});
  await denied(source({...request,tx}));
 }
});
test('no operator-supplied price or tenant overrides are accepted',async()=>{
 const {source,tx}=fixture();
 await denied(source({...request,tx,tenantId:'OTHER',sale_price_minor:1}));
});

test('default private composition loads C01 used references and Calc dados C02 margins end to end',async()=>{
 const {SQL:USED_SQL}=require('./upgrade-trade-in-candidate-source');
 const {SQL:CALC_SQL}=require('./upgrade-calc-dados-profile-source');
 const calls=[];
 const tx={query:async(sql,args)=>{
  calls.push({sql,args});
  if(sql===SQL.C01_SQL)return {rows:[{c01_snapshot:candidate,c01_contract_version:candidate.contract_version,
   offer_value_fingerprint:candidate.offer_value_fingerprint,domain_outcome:'VALID',freshness_status:'CURRENT'}]};
  if(sql===SQL.RATE_SQL)return {rows:[{tenant_id:tenant,profile_id:rateId,version:3,status:'ACTIVE',
   currency:'BRL',rate_scale:100,fingerprint:'ratefp'}]};
  if(sql===SQL.TRADE_POLICY_SQL)return {rows:[{tenant_id:tenant,policy_id:policyId,version:2,status:'ACTIVE',
   currency:'BRL',deduction_amount_minor:30000,fingerprint:'policyfp'}]};
  if(sql===SQL.ENTRIES_SQL)return {rows:[{installment_count:12,rate_units:9}]};
  if(sql===CALC_SQL.SOURCE_SQL)return {rows:[{model_id:'iphone17pro'}]};
  if(sql===CALC_SQL.PROFILE_SQL)return {rows:[{tenant_id:tenant,
   atualizado_em:'2026-11-11T12:00:00Z',dados:{config:{
    margens:{iPhone:{av:900,pc:1000}},pb:45,taxas:{12:1.15}
   }}}]};
  if(sql===USED_SQL)return {rows:[{tenant_id:tenant,analysis_id:'analysis1',offer_id:'used1',
   offer_revision:2,c01_contract_version:'external-calc-c01-readonly/v1',
   offer_value_fingerprint:'vused1',c01_snapshot:{...used,tenant_id:undefined,offer_revision:2},
   domain_outcome:'VALID',freshness_status:'CURRENT'}]};
  throw Error('UNEXPECTED_SQL');
 }};
 const source=createUpgradeTrustedCalcSource({enabled:true});
 const output=await source({...request,tx});
 assert.equal(output.calculationProfile.profile_id,'pitwall-calc-dados:iPhone');
 assert.equal(output.calculationProfile.cash_margin_minor,90000);
 assert.equal(output.calculationProfile.installment_margin_minor,100000);
 assert.equal(output.tradeInCandidates.length,1);
 assert.equal(output.tradeInCandidates[0].tenant_id,tenant);
 assert.equal(output.tradeInCandidates[0].reviewed_offer.model.id,'iphone14pro');
 assert(calls.some(x=>x.sql===CALC_SQL.PROFILE_SQL));
 assert(calls.some(x=>x.sql===USED_SQL));
});
