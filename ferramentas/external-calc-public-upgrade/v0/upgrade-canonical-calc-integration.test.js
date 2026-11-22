'use strict';
// Isolated integration of the real Calc resolvers with the public Upgrade
// HTTP contract. No network, migration, service token or commercial write.
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeV1HyperdriveApplication}=require('./upgrade-hyperdrive-composition');
const {createInternalUpgradePort}=require('./internal-port');
const {createCanonicalUpgradeDomainAdapter}=require('./canonical-domain-adapter');
const {resolveTradeIn,resolveSimulation}=require('../../external-calc-sales-product/v0/sales-product-service');
const {SQL}=require('./approved-catalog-repository');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const origin='https://upgrade.example.test';
const now=Date.now();
const publication={tenant_id:tenant,public_id:'pub17pro256',price_revision:'rev1',status:'published',
 sale_price_minor:690000,expires_at_ms:now+900000,offer_revision:1,analysis_id:'a',
 offer_id:'sale-silver',offer_value_fingerprint:'vsale-silver'};
const offer=(id,supplier,model,cap,color,price)=>({tenant_id:tenant,analysis_id:'a',offer_id:id,
 offer_revision:1,execution_status:'SUCCEEDED',domain_outcome:'VALID',freshness_status:'CURRENT',
 offer_identity_fingerprint:'i'+id,offer_value_fingerprint:'v'+id,
 reviewed_offer:{supplier_id:supplier,model:{id:model,label:model},capacity_gb:cap,color,
 price:{amount_minor:price,currency:'BRL'}}});
const sale=offer('sale-silver','SUPPLIER_PRIVATE','iphone17pro',256,'Silver',600000);
const trade=offer('trade-silver','USED_PRIVATE','iphone14pro',128,'Silver',300000);
const policy={policy_id:'p1',version:3,status:'ACTIVE',currency:'BRL',deduction_amount_minor:30000,fingerprint:'pf'};
const rate={profile_id:'r1',version:4,status:'ACTIVE',currency:'BRL',rate_scale:10000,
 fingerprint:'rf',entries:[{installment_count:12,rate_units:90000}]};
const context={tenant_id:tenant,public_id:publication.public_id,offer_revision:1,
 offers:[sale],tradeInCandidates:[trade],tradeInPolicy:policy,rateProfile:rate};
const selection={desired:{model:'iPhone 17 Pro',capacity:'256 GB',condition:'lacrado'},
 trade_in:{model:'iPhone 14 Pro',capacity:'128 GB',condition:'bom'},installments:12};
const catalogRow={tenant_id:tenant,public_id:publication.public_id,price_revision:'rev1',
 status:'published',expires_at_ms:String(now+900000),desired_model:selection.desired.model,
 desired_capacity:selection.desired.capacity,desired_condition:selection.desired.condition,
 trade_in_models:[{model:selection.trade_in.model,capacity:'128 GB',capacity_gb:128,
 device_model_id:'iphone14pro'}]};
function fixture(override={}){
 const visits=[];
 class FakeClient {
  async connect(){visits.push('connect');}
  async end(){visits.push('end');}
  async query({text,values}){
   visits.push(text);
   if(text==='SELECT current_user AS db_role')return {rows:[{db_role:'upv1_cf_public'}]};
   if(text===SQL){assert.deepEqual(values,[tenant]);return {rows:[catalogRow]};}
   throw new Error('DB_QUERY_NOT_ALLOWED');
  }
 }
 const port=createInternalUpgradePort({enabled:true,clock:()=>now,
  verifyService:async({requiredScope})=>({verified:true,principal:'pitstop-upgrade-service',
   tenant_id:tenant,scopes:[requiredScope],not_before_ms:now-1000,expires_at_ms:now+60000}),
  loadApprovedPublication:async()=>override.publication||publication,
  loadTenantScopedContext:async()=>override.context||context,
  domain:createCanonicalUpgradeDomainAdapter()});
 const invokeInternal=async({action,command})=>port.execute({
  action,command,credential:'trusted-test-credential'});
 const env={UPGRADE_PUBLIC_ENABLED:'true',UPGRADE_DB:{connectionString:'postgres://dummy:dummy@example.invalid/db'},
  UPGRADE_TENANT_ID:tenant,UPGRADE_EXPECTED_ORIGIN:origin};
 const app=createUpgradeV1HyperdriveApplication({env,Client:FakeClient,invokeInternal});
 const get=()=>new Request(origin+'/api/upgrade/v1/quote',{method:'POST',
  headers:{'content-type':'application/json'},body:JSON.stringify(selection)});
 return {app,get,visits};
}
test('public Upgrade price comes from approved publication and canonical Calc trade-in resolver',async()=>{
 // Production quote checks publication against real time; in this test we
 // choose a publication expiry in the future relative to current date.
 const {app,get,visits}=fixture();
 const response=await app.handle(get());
 const estimate=resolveTradeIn([trade],policy,{model_id:'iphone14pro',capacity_gb:128,color:null});
 const expected=estimate.estimated_credit.amount_minor;
 const installment=resolveSimulation([sale,trade],policy,rate,{
  analysis_id:'a',offer_id:'sale-silver',offer_revision:1,
  sale_amount:{amount_minor:690000,currency:'BRL'},
  installment_count:12,trade_in_estimate_id:estimate.estimate_id
 }).installment_amount.amount_minor;
 assert.equal(response.status,200);
 const body=await response.json();
 assert.deepEqual(body,{ok:true,quote:{sale_amount_minor:690000,trade_in_credit_minor:expected,
  amount_due_minor:690000-expected,currency:'BRL',installment_count:12,installment_amount_minor:installment}});
 assert(!JSON.stringify(body).includes('SUPPLIER_PRIVATE'));
 assert(!JSON.stringify(body).includes('rate_units'));
 assert(!JSON.stringify(body).includes('600000'));
 assert(visits.includes(SQL));
});
test('stale Calc offer fingerprint cannot produce public amount',async()=>{
 const {app,get}=fixture({context:{...context,offers:[{...sale,offer_value_fingerprint:'changed'}]}});
 const response=await app.handle(get());
 assert.equal(response.status,503);
 assert.deepEqual(await response.json(),{ok:false,code:'QUOTE_UNAVAILABLE'});
});
test('wrong-tenant internal publication cannot produce public amount',async()=>{
 const {app,get}=fixture({publication:{...publication,tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'}});
 const response=await app.handle(get());
 assert.equal(response.status,503);
 assert.deepEqual(await response.json(),{ok:false,code:'QUOTE_UNAVAILABLE'});
});
test('public caller cannot inject price or tenant to override Calc',async()=>{
 const {app}=fixture();
 const input={...selection,price_minor:1,tenant_id:tenant};
 const response=await app.handle(new Request(origin+'/api/upgrade/v1/quote',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}));
 assert.equal(response.status,400);
 assert.equal((await response.json()).code,'INVALID_SELECTION');
});
