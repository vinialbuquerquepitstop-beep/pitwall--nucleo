'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createExternalCalcUpgradePublicationDraft:D}=require('./external-calc-publication-draft');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const now=Date.now();
function offer(id,model,label,cap,condition,price,supplier){
 return {contract_version:'external-calc-c01-readonly/v1',tenant_id:tenant,
  analysis_id:'analysis1',source_id:'source1',offer_id:id,offer_revision:1,
  offer_identity_fingerprint:'i'+id,offer_value_fingerprint:'v'+id,
  execution_status:'SUCCEEDED',domain_outcome:'VALID',freshness_status:'CURRENT',
  provenance_refs:[],reviewed_offer:{supplier_id:supplier,model:{id:model,label},capacity_gb:cap,
   color:'Silver',condition,price:{amount_minor:price,currency:'BRL'}}};
}
const sale=offer('sale1','iphone17pro','iPhone 17 Pro',256,'lacrado',600000,'supplier1');
const used=offer('used1','iphone14pro','iPhone 14 Pro',128,'seminovo',300000,'supplier2');
const calculationProfile={profile_id:'storecal1',profile_version:'v1',currency:'BRL',
 cash_margin_minor:90000,installment_margin_minor:100000,freight_minor:2000,
 freight_mode:'STORE',installment_base_addon_minor:0,entry_minor:0,
 installment_coefficients:{12:1.14}};
const activeRateProfile={tenant_id:tenant,status:'ACTIVE',currency:'BRL',profile_id:'rate1',
 version:3,fingerprint:'fp1',rate_scale:10000,entries:[{installment_count:12,rate_units:90000}]};
const args={tenantId:tenant,publicId:'pub1',priceRevision:'rev1',reviewedCandidate:sale,
 calculationProfile,calculationRunId:'run1',tradeInCandidates:[used],activeRateProfile,
 expiresAtMs:now+86400000,clock:()=>now};
test('sale price derives from canonical C02 margin plus freight, never supplier raw price',()=>{
 const result=D(args);
 assert.equal(result.publication.sale_price_minor,692000);
 assert.notEqual(result.publication.sale_price_minor,sale.reviewed_offer.price.amount_minor);
 assert.equal(result.publication.status,'draft');
 assert.equal(result.publication.approved_by,null);
 assert.equal(result.publication.approved_at,null);
 assert.deepEqual(result.catalog.trade_in_models,[{model:'iPhone 14 Pro',capacity:'128 GB',capacity_gb:128,device_model_id:'iphone14pro'}]);
 assert.equal(result.catalog.desired_model,'iPhone 17 Pro');
 assert.equal(result.source.rate_profile_fingerprint,'fp1');
 assert.equal(result.source.source,'external-calc-c01-c02');
 assert(!JSON.stringify(result.catalog).includes('supplier1'));
 assert(!JSON.stringify(result.catalog).includes('692000'));
});
test('changing C02 margin changes proposed commercial sale, not raw supplier cost',()=>{
 const original=D(args);
 const revised=D({...args,calculationProfile:{...calculationProfile,cash_margin_minor:110000}});
 assert.equal(revised.publication.sale_price_minor-original.publication.sale_price_minor,20000);
 assert.notEqual(revised.source.calculation_output_fingerprint,original.source.calculation_output_fingerprint);
});
test('rejects unreviewed, stale, cross-tenant and unpublished source',()=>{
 for(const candidate of [
  {...sale,freshness_status:'STALE'},
  {...sale,execution_status:'FAILED'},
  {...sale,tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'},
  {...sale,reviewed_offer:{...sale.reviewed_offer,condition:'unknown'}}
 ])assert.throws(()=>D({...args,reviewedCandidate:candidate}),e=>e.code==='EXTERNAL_CALC_PUBLICATION_DRAFT_UNAVAILABLE');
});
test('rejects absent or inactive store rate profile and unreviewed used offers',()=>{
 for(const patch of [
  {activeRateProfile:{...activeRateProfile,status:'INACTIVE'}},
  {activeRateProfile:null},
  {tradeInCandidates:[{...used,freshness_status:'STALE'}]},
  {tradeInCandidates:[{...used,tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'}]}
 ])assert.throws(()=>D({...args,...patch}),e=>e.code==='EXTERNAL_CALC_PUBLICATION_DRAFT_UNAVAILABLE');
});
test('price revision and expiry are server-controlled and bounded',()=>{
 for(const patch of [{priceRevision:'bad revision'},{expiresAtMs:now-1},
  {expiresAtMs:now+35*86400000},{tenantId:'bad'}])
  assert.throws(()=>D({...args,...patch}),e=>e.code==='EXTERNAL_CALC_PUBLICATION_DRAFT_UNAVAILABLE');
});

test('real C01 mixed-case Lacrado and Seminovo map to public catalog enum',()=>{
 for(const [source,expected] of [['Lacrado','lacrado'],['LACRADO','lacrado'],['Seminovo','seminovo']]){
  const snapshot={...sale,reviewed_offer:{...sale.reviewed_offer,condition:source}};
  const result=D({...args,reviewedCandidate:snapshot});
  assert.equal(result.catalog.desired_condition,expected);
  assert.equal(result.publication.status,'draft');
 }
});
test('missing C01 condition fails closed instead of treating it as lacrado',()=>{
 for(const value of [null,undefined,'', 'UNKNOWN']){
  const snapshot={...sale,reviewed_offer:{...sale.reviewed_offer,condition:value}};
  assert.throws(()=>D({...args,reviewedCandidate:snapshot}),
   e=>e.code==='EXTERNAL_CALC_PUBLICATION_DRAFT_UNAVAILABLE');
 }
});
