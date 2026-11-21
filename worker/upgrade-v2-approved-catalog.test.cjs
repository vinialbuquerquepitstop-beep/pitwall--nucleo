'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeV2ApprovedCatalog}=require('./upgrade-v2-approved-catalog.cjs');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const pub={tenant_id:tenant,public_id:'published17pro',price_revision:'rev07',status:'published',
 approved:true,expires_at_ms:1900000000000,
 desired:{model:'iPhone 17 Pro',capacity:'256 GB',condition:'lacrado'},
 sale_price_minor:940000,supplier_cost_minor:600000,trade_in_models:[{device_model_id:'secret'}]};
const source=(records=[pub],patch={})=>createUpgradeV2ApprovedCatalog({
 enabled:true,sourceTenantId:tenant,clock:()=>1800000000000,
 loadApprovedPublications:async()=>records,...patch
});
const blocked=fn=>assert.rejects(fn,e=>e.code==='UPGRADE_V2_CATALOG_UNAVAILABLE');
test('default OFF never accesses source',async()=>{
 let called=false;
 const catalog=createUpgradeV2ApprovedCatalog({loadApprovedPublications:async()=>{called=true;}});
 await blocked(catalog);assert.equal(called,false);
});
test('active adapter requires an injected trusted source and server-fixed tenant',()=>{
 assert.throws(()=>createUpgradeV2ApprovedCatalog({enabled:true}),/TRUSTED_SOURCE_REQUIRED/);
});
test('published approved current publication exposes only model capacity and condition',async()=>{
 const offers=await source()();
 assert.deepEqual(offers,[{model:'iPhone 17 Pro',capacity:'256 GB',condition:'lacrado'}]);
 assert.equal(JSON.stringify(offers).includes('price'),false);
 assert.equal(JSON.stringify(offers).includes('secret'),false);
 assert.equal(JSON.stringify(offers).includes('tenant'),false);
 assert(Object.isFrozen(offers));assert(Object.isFrozen(offers[0]));
});
test('different approved variants are projected without price or revision IDs',async()=>{
 const items=await source([pub,{...pub,public_id:'published17pro512',
  desired:{model:'iPhone 17 Pro',capacity:'512 GB',condition:'seminovo'}}])();
 assert.equal(items.length,2);
 assert.equal(Object.keys(items[1]).join(','),'model,capacity,condition');
});
test('cross tenant, draft, expired, unapproved, missing revision reject entire result',async()=>{
 const variants=[
  {tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'},
  {status:'draft'},{approved:false},{expires_at_ms:1700000000000},
  {public_id:'../../db'},{price_revision:null},{desired:{...pub.desired,capacity:'3 TB'}},
  {desired:{...pub.desired,model:'  iPhone 17 Pro'}},
 ];
 for(const patch of variants)await blocked(()=>source([{...pub,...patch}])());
});
test('conflicting publications for a single selection are rejected',async()=>{
 await blocked(()=>source([pub,{...pub,public_id:'other'}])());
});
test('no publications, too many publications or reader exception fail closed',async()=>{
 await blocked(()=>source([])());
 await blocked(()=>source(Array.from({length:501},(_,i)=>({...pub,public_id:'p'+i})))());
 await blocked(()=>source(null,{loadApprovedPublications:async()=>{throw Error('db password leak')}})());
});
test('module has no imports from legacy API, DB bindings or browser-controlled tenants',()=>{
 const fs=require('node:fs');
 const body=fs.readFileSync(require('node:path').join(__dirname,'upgrade-v2-approved-catalog.cjs'),'utf8');
 assert.doesNotMatch(body,/require\(.+external-calc|UPGRADE_DB|connectionString|request\.url|service_role/i);
});
