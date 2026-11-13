'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {resolveTradeIn,resolveSimulation}=require('../../external-calc-sales-product/v0/sales-product-service');
const {createCanonicalUpgradeDomainAdapter}=require('./canonical-domain-adapter');
const offer=(id,supplier,model,cap,color,price)=>({analysis_id:'a',offer_id:id,offer_revision:1,execution_status:'SUCCEEDED',domain_outcome:'VALID',freshness_status:'CURRENT',offer_identity_fingerprint:'i'+id,offer_value_fingerprint:'v'+id,reviewed_offer:{supplier_id:supplier,model:{id:model,label:model},capacity_gb:cap,color,price:{amount_minor:price,currency:'BRL'}}});
const sale=offer('sale-silver','OUT','iphone17pm',256,'Silver',600000);
const trade=offer('trade-silver','S2','iphone14pm',256,'Silver',300000);
const policy={policy_id:'p1',version:3,status:'ACTIVE',currency:'BRL',deduction_amount_minor:30000,fingerprint:'pf'};
const rate={profile_id:'r1',version:4,status:'ACTIVE',currency:'BRL',rate_scale:10000,fingerprint:'rf',entries:[{installment_count:12,rate_units:90000}]};
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const publication={tenant_id:tenant,public_id:'pub17',offer_revision:1,offer_id:'sale-silver',analysis_id:'a',offer_value_fingerprint:'vsale-silver',sale_price_minor:690000};
const context={tenant_id:tenant,public_id:'pub17',offer_revision:1,offers:[sale],tradeInCandidates:[trade],tradeInPolicy:policy,rateProfile:rate};
const bridge=createCanonicalUpgradeDomainAdapter();
const req={context,publication};
test('variant resolves canonical source but returns only approved public sale price',async()=>{const r=await bridge.resolveVariant(req);assert.deepEqual(r,{public_amount_minor:690000});assert.notEqual(r.public_amount_minor,sale.reviewed_offer.price.amount_minor);assert(!JSON.stringify(r).includes('OUT'));});
test('trade in matches canonical resolver, never returns supplier or policy',async()=>{const command={device_model_id:'iphone14pm',capacity_gb:256};const r=await bridge.estimateTradeIn({...req,command});const t=resolveTradeIn([trade],policy,{model_id:'iphone14pm',capacity_gb:256,color:null});assert.equal(r.public_amount_minor,t.estimated_credit.amount_minor);assert.deepEqual(Object.keys(r),['public_amount_minor']);});
test('simulation uses published sale price, canonical rate and trade-in resolvers',async()=>{const estimate=resolveTradeIn([trade],policy,{model_id:'iphone14pm',capacity_gb:256,color:null});const command={installment_count:12,estimate_ref:estimate.estimate_id};const r=await bridge.simulateSale({...req,command});const expected=resolveSimulation([sale,trade],policy,rate,{analysis_id:'a',offer_id:'sale-silver',offer_revision:1,sale_amount:{amount_minor:690000,currency:'BRL'},installment_count:12,trade_in_estimate_id:estimate.estimate_id});assert.equal(r.public_amount_minor,expected.installment_amount.amount_minor);assert.equal(r.installment_count,12);assert(!JSON.stringify(r).includes('rate_profile'));assert(!JSON.stringify(r).includes('supplier'));});
test('cross-tenant context cannot reach resolvers',async()=>{await assert.rejects(()=>bridge.resolveVariant({context:{...context,tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'},publication}),e=>e.code==='CONTEXT_MISMATCH');});
test('stale offer fingerprint is blocked before calculations',async()=>{await assert.rejects(()=>bridge.resolveVariant({context,publication:{...publication,offer_value_fingerprint:'old'}}),e=>e.code==='OFFER_FINGERPRINT_STALE');});
test('catalog binding rejects incorrect offer and missing private data',async()=>{await assert.rejects(()=>bridge.resolveVariant({context,publication:{...publication,offer_id:'wrong'}}),e=>e.code==='OFFER_BINDING_INVALID');await assert.rejects(()=>bridge.simulateSale({context:{...context,rateProfile:null},publication,command:{installment_count:12}}),e=>e.code==='SIMULATION_CONTEXT_MISSING');});
test('canonical variant refuses stale/unavailable selected offer',async()=>{await assert.rejects(()=>bridge.resolveVariant({context:{...context,offers:[{...sale,freshness_status:'STALE'}]},publication}),e=>e.code==='CANONICAL_VARIANT_FAILED');});

test('canonical simulation derives trade-in credit from server-side device selection',async()=>{
 const command={installment_count:12,device_model_id:'iphone14pm',capacity_gb:256};
 const expectedEstimate=resolveTradeIn([trade],policy,{model_id:'iphone14pm',capacity_gb:256,color:null});
 const expected=resolveSimulation([sale,trade],policy,rate,{
  analysis_id:'a',offer_id:'sale-silver',offer_revision:1,
  sale_amount:{amount_minor:690000,currency:'BRL'},installment_count:12,
  trade_in_estimate_id:expectedEstimate.estimate_id
 });
 const result=await bridge.simulateSale({...req,command});
 assert.equal(result.public_amount_minor,expected.installment_amount.amount_minor);
 assert.equal(result.installment_count,12);
 assert(!JSON.stringify(result).includes('SUPPLIER'));
});
