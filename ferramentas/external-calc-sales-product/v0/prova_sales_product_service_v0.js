'use strict';
const assert=require('assert');
const {listProductOptions,resolveVariant,resolveTradeIn,resolveSimulation}=require('./sales-product-service');
const offer=(id,supplier,model,label,cap,color,price)=>({contract_version:'external-calc-c01-readonly/v1',analysis_id:'a',offer_id:id,offer_revision:1,execution_status:'SUCCEEDED',domain_outcome:'VALID',freshness_status:'CURRENT',offer_identity_fingerprint:'i'+id,offer_value_fingerprint:'v'+id,reviewed_offer:{supplier_id:supplier,model:{id:model,label,attributes:{display_label:label}},capacity_gb:cap,color,price:{amount_minor:price,currency:'BRL'}}});
const offers=[
 offer('purple','S1','iphone14pm','iPhone 14 Pro Max',256,'Deep Purple',310000),
 offer('silver','S2','iphone14pm','iPhone 14 Pro Max',256,'Silver',300000),
 offer('sale-silver','OUT','iphone17pm','iPhone 17 Pro Max',256,'Silver',600000),
 offer('sale-blue','OUT','iphone17pm','iPhone 17 Pro Max',256,'Blue',610000)
];
const policy={policy_id:'p1',version:3,status:'ACTIVE',currency:'BRL',deduction_amount_minor:30000,fingerprint:'pf'};
const rate={profile_id:'r1',version:4,status:'ACTIVE',currency:'BRL',rate_scale:10000,fingerprint:'rf',entries:[{installment_count:12,rate_units:90000}]};

const catalog=listProductOptions(offers,{query:'14 pro',limit:10});
assert.strictEqual(catalog.catalog_version,'external-calc-product-options/v0');
assert.strictEqual(catalog.items.length,1);
assert.deepStrictEqual(catalog.items[0],{model_id:'iphone14pm',label:'iPhone 14 Pro Max',capacities_gb:[256],colors:['Deep Purple','Silver'],offer_count:2});
assert.strictEqual('price' in catalog.items[0],false);
assert.strictEqual('offer_id' in catalog.items[0],false);
assert.throws(()=>listProductOptions(offers,{limit:101}),e=>e.code==='PRODUCT_OPTIONS_INVALID');

assert.throws(()=>resolveVariant(offers,{supplier_id:'OUT',model_id:'iphone17pm',capacity_gb:256}),e=>e.code==='VARIANT_COLOR_REQUIRED');
const v=resolveVariant(offers,{supplier_id:'OUT',model_id:'iphone17pm',capacity_gb:256,color:'Silver'});
assert.strictEqual(v.offer_id,'sale-silver');assert.strictEqual(v.price.amount_minor,600000);

const t=resolveTradeIn(offers,policy,{model_id:'iphone14pm',capacity_gb:256});
assert.strictEqual(t.source_offer.offer_id,'silver');assert.strictEqual(t.source_offer.price.amount_minor,300000);assert.strictEqual(t.estimated_credit.amount_minor,270000);
const tc=resolveTradeIn(offers,policy,{model_id:'iphone14pm',capacity_gb:256,color:'Deep Purple'});
assert.strictEqual(tc.source_offer.offer_id,'purple');assert.strictEqual(tc.estimated_credit.amount_minor,280000);

const s=resolveSimulation(offers,policy,rate,{analysis_id:'a',offer_id:'sale-silver',offer_revision:1,sale_amount:{amount_minor:690000,currency:'BRL'},installment_count:12,trade_in_estimate_id:t.estimate_id});
assert.strictEqual(s.cash_difference.direction,'CUSTOMER_PAYS');assert.strictEqual(s.cash_difference.amount.amount_minor,420000);assert.strictEqual(s.financed_base.amount_minor,420000);assert.strictEqual(s.total.amount_minor,457800);assert.strictEqual(s.installment_amount.amount_minor,38150);
assert.throws(()=>resolveSimulation(offers,{...policy,version:4,fingerprint:'new'},rate,{analysis_id:'a',offer_id:'sale-silver',offer_revision:1,sale_amount:{amount_minor:690000,currency:'BRL'},installment_count:12,trade_in_estimate_id:t.estimate_id}),e=>e.code==='TRADE_IN_ESTIMATE_STALE');
const storePays=resolveSimulation(offers,policy,rate,{analysis_id:'a',offer_id:'sale-silver',offer_revision:1,sale_amount:{amount_minor:200000,currency:'BRL'},installment_count:12,trade_in_estimate_id:t.estimate_id});
assert.strictEqual(storePays.cash_difference.direction,'STORE_PAYS');assert.strictEqual(storePays.cash_difference.amount.amount_minor,70000);assert.strictEqual(storePays.financed_base.amount_minor,0);assert.strictEqual(storePays.total.amount_minor,0);

for(const bad of [
 {model_id:'iphone14pm',capacity_gb:256,deduction_amount_minor:1},
 {model_id:'iphone14pm',capacity_gb:256,estimated_credit:1}
])assert.throws(()=>resolveTradeIn(offers,policy,bad),e=>e.code==='TRADE_IN_SELECTION_INVALID');
assert.throws(()=>resolveSimulation(offers,policy,rate,{analysis_id:'a',offer_id:'sale-silver',offer_revision:1,sale_amount:{amount_minor:690000,currency:'BRL'},installment_count:12,rate_units:1}),e=>e.code==='SALE_SIMULATION_INVALID');

console.log('EXTERNAL_CALC_SALES_PRODUCT_T04_DOMAIN=PASS');
