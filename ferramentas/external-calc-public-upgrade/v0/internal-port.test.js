'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createInternalUpgradePort}=require('./internal-port');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const base={public_id:'p_123',price_revision:'v1'};
const identity={verified:true,principal:'pitstop-upgrade-service',tenant_id:tenant,scopes:['product:resolve-variant'],not_before_ms:1000,expires_at_ms:90000};
const publication={tenant_id:tenant,public_id:'p_123',price_revision:'v1',status:'published',offer_revision:5,sale_price_minor:500000,expires_at_ms:80000};
function fixture(overrides={}){
 const calls={verify:0,publish:0,context:0,domain:0};
 const opts={enabled:true,clock:()=>2000,verifyService:async({requiredScope})=>{calls.verify++;return {...identity,scopes:[requiredScope]}},loadApprovedPublication:async()=>{calls.publish++;return publication},loadTenantScopedContext:async()=>{calls.context++;return {tenant_id:tenant,public_id:'p_123',offer_revision:5}},domain:{resolveVariant:async()=>{calls.domain++;return {public_amount_minor:500000,supplier_id:'SECRET'}},estimateTradeIn:async()=>({public_amount_minor:200000,policy_id:'SECRET'}),simulateSale:async()=>({public_amount_minor:80000,installment_count:12,rate_profile_id:'SECRET'})},...overrides};
 return {port:createInternalUpgradePort(opts),calls};
}
async function rejects(port,input,code){await assert.rejects(port.execute(input),e=>e.code===code);}
const request=(action='resolveVariant',command=base)=>({action,credential:'signed-opaque-token',command});
test('disabled by default; no downstream calls',async()=>{const {port,calls}=fixture({enabled:false});await rejects(port,request(),'PUBLIC_UPGRADE_DISABLED');assert.equal(calls.verify,0);});
test('public variant projection strips private fields',async()=>{const {port}=fixture();assert.deepEqual(await port.execute(request()),{schema_version:'pitstop-internal-upgrade/v1',public_id:'p_123',price_revision:'v1',action:'resolveVariant',amount_minor:500000,currency:'BRL'});});
test('rejects broad scopes and another tenant',async()=>{for(const x of [{scopes:['product:resolve-variant','product:sales-simulation']},{tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'}]){const {port}=fixture({verifyService:async()=>({...identity,...x})});await rejects(port,request(),'SERVICE_IDENTITY_DENIED');}});
test('rejects expired, unbounded or forged time claims',async()=>{for(const x of [{expires_at_ms:1999},{expires_at_ms:undefined},{expires_at_ms:400000},{not_before_ms:undefined}]){const {port}=fixture({verifyService:async()=>({...identity,...x})});await rejects(port,request(),'SERVICE_TOKEN_STALE');}});
test('blocks user-supplied authority fields',async()=>{const {port,calls}=fixture();for(const key of ['tenant_id','price_minor','supplier_id','offer_id'])await rejects(port,request('resolveVariant',{...base,[key]:'hack'}),'COMMAND_INVALID');assert.equal(calls.verify,0);});
test('blocks stale publication, wrong tenant and revision',async()=>{for(const x of [{price_revision:'v2'},{tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'},{expires_at_ms:1000},{offer_revision:0}]){const {port}=fixture({loadApprovedPublication:async()=>({...publication,...x})});await rejects(port,request(),'PUBLICATION_NOT_AUTHORIZED');}});
test('blocks cross-tenant context',async()=>{const {port}=fixture({loadTenantScopedContext:async()=>({tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731',public_id:'p_123',offer_revision:5})});await rejects(port,request(),'CONTEXT_MISMATCH');});
test('requires canonical trade-in input',async()=>{const {port}=fixture();await rejects(port,request('estimateTradeIn',base),'DEVICE_INVALID');const result=await port.execute(request('estimateTradeIn',{...base,device_model_id:'iphone14pro',capacity_gb:128}));assert.equal(result.amount_minor,200000);assert.equal(JSON.stringify(result).includes('policy_id'),false);});
test('validates installments and no rate-profile leakage',async()=>{const {port}=fixture();await rejects(port,request('simulateSale',base),'INSTALLMENTS_INVALID');await rejects(port,request('simulateSale',{...base,installment_count:19}),'INSTALLMENTS_INVALID');const result=await port.execute(request('simulateSale',{...base,installment_count:12}));assert.equal(result.installment_count,12);assert.equal(JSON.stringify(result).includes('rate_profile'),false);});
test('rejects publication price mismatch and result overflow',async()=>{for(const value of [499999,500001]){const {port}=fixture({domain:{resolveVariant:async()=>({public_amount_minor:value}),estimateTradeIn:async()=>({public_amount_minor:100}),simulateSale:async()=>({public_amount_minor:100,installment_count:12})}});await rejects(port,request(),'PUBLISHED_PRICE_MISMATCH');}const {port}=fixture({domain:{resolveVariant:async()=>({public_amount_minor:Number.MAX_SAFE_INTEGER}),estimateTradeIn:async()=>({public_amount_minor:100}),simulateSale:async()=>({public_amount_minor:100,installment_count:12})}});await rejects(port,request(),'DOMAIN_RESULT_INVALID');});
