'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync,sign}=require('node:crypto');
const {createInternalUpgradeApplication}=require('./internal-upgrade-application');
const {resolveTradeIn,resolveSimulation}=require('../../external-calc-sales-product/v0/sales-product-service');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const foreign='efbd5c32-e2d4-4adc-964e-40ea0eae9731';
const now=1762710000000;
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
let sequence=0;
const offer=(id,supplier,model,color,amount)=>({
 tenant_id:tenant,analysis_id:'analysis1',offer_id:id,offer_revision:1,
 execution_status:'SUCCEEDED',domain_outcome:'VALID',freshness_status:'CURRENT',
 offer_identity_fingerprint:'identity_'+id,offer_value_fingerprint:'value_'+id,
 reviewed_offer:{supplier_id:supplier,model:{id:model,label:model},capacity_gb:256,
  color,price:{amount_minor:amount,currency:'BRL'}}
});
const sale=offer('sale_silver','SUPPLIER_INTERNAL','iphone17pm','Silver',600000);
const trade=offer('trade_silver','TRADE_SUPPLIER','iphone14pm','Silver',300000);
const policy={tenant_id:tenant,policy_id:'policy1',version:3,status:'ACTIVE',currency:'BRL',deduction_amount_minor:30000,fingerprint:'policyFingerprint'};
const rate={tenant_id:tenant,profile_id:'rate1',version:4,status:'ACTIVE',currency:'BRL',rate_scale:10000,
 fingerprint:'rateFingerprint',entries:[{installment_count:12,rate_units:90000}]};
const publication={tenant_id:tenant,public_id:'iphone17_public',price_revision:'rev_1',
 status:'published',sale_price_minor:'690000',expires_at_ms:String(now+120000),
 offer_revision:'1',analysis_id:'analysis1',offer_id:'sale_silver',offer_value_fingerprint:'value_sale_silver'};
const context={tenant_id:tenant,public_id:'iphone17_public',offer_revision:'1',offers:[sale],
 trade_in_candidates:[trade],trade_in_policy:policy,rate_profile:rate};
function jwt(scope,changes={}){
 const p={iss:'pitstop-test-issuer',aud:'upgrade-internal-test',sub:'pitstop-upgrade-service',
  tenant_id:tenant,scopes:[scope],iat:now/1000-1,nbf:now/1000-1,exp:now/1000+60,
  jti:'up06x_test_nonce_'+String(++sequence).padStart(16,'0'),...changes};
 const header=Buffer.from(JSON.stringify({alg:'EdDSA',typ:'JWT',kid:'test_key_2026'})).toString('base64url');
 const payload=Buffer.from(JSON.stringify(p)).toString('base64url');
 return header+'.'+payload+'.'+sign(null,Buffer.from(header+'.'+payload),privateKey).toString('base64url');
}
function fixture({pub=publication,ctx=context,unavailable=false}={}){
 const used=new Set(),calls={pub:0,ctx:0,nonce:0};
 const app=createInternalUpgradeApplication({
  enabled:true,issuer:'pitstop-test-issuer',audience:'upgrade-internal-test',tenantId:tenant,
  clock:()=>now,
  keyLoader:async(kid)=>kid==='test_key_2026'?{kid,publicKey,state:'active',revoked:false,valid_from_ms:now-60000,valid_until_ms:now+120000}:null,
  pgNoncePool:{query:async(_sql,[digest])=>{calls.nonce++;if(unavailable)throw Error('private DB is down');if(used.has(digest))return {rowCount:0,rows:[]};used.add(digest);return {rowCount:1,rows:[{nonce_digest:digest}]};}},
  publicationQuery:async(_sql,[tenantId,publicId,rev])=>{calls.pub++;return {rows:pub&&tenantId===pub.tenant_id&&publicId===pub.public_id&&rev===pub.price_revision?[pub]:[]};},
  contextQuery:async(_sql,[tenantId,publicId,revision])=>{calls.ctx++;return {rows:ctx&&tenantId===ctx.tenant_id&&publicId===ctx.public_id&&revision===1?[ctx]:[]};}
 });
 return {app,calls};
}
function cmd(action,extra={}){return {action,credential:jwt({resolveVariant:'product:resolve-variant',estimateTradeIn:'product:trade-in-estimate',simulateSale:'product:sales-simulation'}[action]),command:{public_id:'iphone17_public',price_revision:'rev_1',...extra}};}
test('full contract: variant returns published sale price, not supplier cost',async()=>{
 const {app,calls}=fixture();
 const output=await app.execute(cmd('resolveVariant'));
 assert.deepEqual(output,{schema_version:'pitstop-internal-upgrade/v1',public_id:'iphone17_public',price_revision:'rev_1',action:'resolveVariant',amount_minor:690000,currency:'BRL'});
 assert.equal(calls.pub,1);assert.equal(calls.ctx,1);
 assert(!JSON.stringify(output).includes('SUPPLIER_INTERNAL'));
 assert(!JSON.stringify(output).includes('600000'));
});
test('full contract: trade-in credit equals canonical service and no private fields leave',async()=>{
 const {app}=fixture();
 const output=await app.execute(cmd('estimateTradeIn',{device_model_id:'iphone14pm',capacity_gb:256}));
 const canonical=resolveTradeIn([trade],policy,{model_id:'iphone14pm',capacity_gb:256,color:null});
 assert.equal(output.amount_minor,canonical.estimated_credit.amount_minor);
 assert.deepEqual(Object.keys(output),['schema_version','public_id','price_revision','action','amount_minor','currency']);
});
test('full contract: 12 installment simulation reuses canonical rate and published price',async()=>{
 const {app}=fixture();
 const estimate=resolveTradeIn([trade],policy,{model_id:'iphone14pm',capacity_gb:256,color:null});
 const output=await app.execute(cmd('simulateSale',{installment_count:12,estimate_ref:estimate.estimate_id}));
 const canonical=resolveSimulation([sale,trade],policy,rate,{analysis_id:'analysis1',offer_id:'sale_silver',offer_revision:1,
  sale_amount:{amount_minor:690000,currency:'BRL'},installment_count:12,trade_in_estimate_id:estimate.estimate_id});
 assert.equal(output.amount_minor,canonical.installment_amount.amount_minor);
 assert.equal(output.installment_count,12);
 assert(!JSON.stringify(output).includes('rateFingerprint'));
 assert(!JSON.stringify(output).includes('SUPPLIER_INTERNAL'));
});
test('request is single-use: second use of the same signed token is denied before publication',async()=>{
 const {app,calls}=fixture();
 const x=cmd('resolveVariant');
 await app.execute(x);
 await assert.rejects(()=>app.execute(x),e=>e.code==='SERVICE_IDENTITY_DENIED');
 assert.equal(calls.pub,1);
});
test('expired and draft prices fail closed',async()=>{
 for(const patch of [{expires_at_ms:String(now-1000)},{status:'draft'}]){
  const {app,calls}=fixture({pub:{...publication,...patch}});
  await assert.rejects(()=>app.execute(cmd('resolveVariant')),e=>e.code==='PUBLICATION_NOT_AUTHORIZED');
  assert.equal(calls.ctx,0);
 }
});
test('foreign-tenant publication and context are blocked',async()=>{
 const pubApp=fixture({pub:{...publication,tenant_id:foreign}}).app;
 await assert.rejects(()=>pubApp.execute(cmd('resolveVariant')),e=>e.code==='PUBLICATION_NOT_AUTHORIZED');
 const ctxApp=fixture({ctx:{...context,offers:[{...sale,tenant_id:foreign}]}}).app;
 await assert.rejects(()=>ctxApp.execute(cmd('resolveVariant')),e=>e.code==='CONTEXT_UNAVAILABLE');
});
test('stale offer fingerprint is rejected',async()=>{
 const {app}=fixture({ctx:{...context,offers:[{...sale,offer_value_fingerprint:'value_changed'}]}});
 await assert.rejects(()=>app.execute(cmd('resolveVariant')),e=>e.code==='CONTEXT_PUBLICATION_STALE');
});
test('nonce store failure prevents all publication and private context access',async()=>{
 const {app,calls}=fixture({unavailable:true});
 await assert.rejects(()=>app.execute(cmd('resolveVariant')),e=>e.code==='SERVICE_IDENTITY_DENIED');
 assert.equal(calls.pub,0);assert.equal(calls.ctx,0);
});
test('disabled app rejects requests without loading real stores',async()=>{
 const app=createInternalUpgradeApplication();
 await assert.rejects(()=>app.execute(cmd('resolveVariant')),e=>e.code==='PUBLIC_UPGRADE_DISABLED');
});
