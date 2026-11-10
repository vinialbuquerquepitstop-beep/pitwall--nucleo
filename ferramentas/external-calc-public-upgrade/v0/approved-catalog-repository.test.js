'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createApprovedCatalogRepository,SQL}=require('./approved-catalog-repository');
const tenantId='5212679b-8b2e-459f-a2ba-7ae8db558ba1',foreign='efbd5c32-e2d4-4adc-964e-40ea0eae9731';
const source={tenant_id:tenantId,public_id:'offer17pro',price_revision:'rev01',status:'published',expires_at_ms:'1900000000000',desired_model:'iPhone 17 Pro',desired_capacity:'256 GB',desired_condition:'lacrado',trade_in_models:[{model:'iPhone 14 Pro',capacity:'128 GB',capacity_gb:128,device_model_id:'iphone14pro'}],sale_price_minor:99999999,supplier_id:'SECRET'};
const dep=(rows=[source],patch={})=>createApprovedCatalogRepository({enabled:true,tenantId,clock:()=>1800000000000,query:async(sql,params)=>{assert.equal(sql,SQL);assert.deepEqual(params,[tenantId]);return {rows};},...patch});
const blocked=fn=>assert.rejects(fn,e=>e.code==='CATALOG_UNAVAILABLE');
test('disabled by default',async()=>blocked(()=>createApprovedCatalogRepository()()));
test('enabled needs trusted tenant and restricted query',()=>assert.throws(()=>createApprovedCatalogRepository({enabled:true}),/TRUSTED_CATALOG_DEPENDENCIES_REQUIRED/));
test('returns one safe, approved, tenant-bound catalog projection',async()=>{
 const x=await dep()();assert.equal(x.length,1);assert.equal(x[0].public_id,'offer17pro');
 assert.equal(x[0].desired.condition,'lacrado');assert.equal(x[0].trade_in_models[0].device_model_id,'iphone14pro');
 assert.equal(Object.hasOwn(x[0],'sale_price_minor'),false);assert(!JSON.stringify(x).includes('SECRET'));assert(Object.isFrozen(x[0]));
});
test('SQL requires approval, non-revocation and expiry as well as tenant',()=>{for(const part of ['p.approved_at IS NOT NULL','p.approved_by IS NOT NULL','p.revoked_at IS NULL',"p.status='published'",'c.tenant_id=$1::uuid'])assert(SQL.includes(part));});
test('cross-tenant catalog entry blocks the entire lookup',async()=>blocked(()=>dep([{...source,tenant_id:foreign}])()));
test('duplicate model/capacity/condition across publications fails closed',async()=>blocked(()=>dep([source,{...source,public_id:'another'}])()));
test('stale, draft, malformed and oversized entries fail closed',async()=>{
 for(const patch of [{status:'draft'},{expires_at_ms:'1800000000000'},{trade_in_models:[{...source.trade_in_models[0],capacity_gb:256}]},{desired_capacity:'ABC'},{price_revision:'./etc'}])await blocked(()=>dep([{...source,...patch}])());
});
test('duplicate used mapping rejected without guessing a trade-in',async()=>blocked(()=>dep([{...source,trade_in_models:[...source.trade_in_models,...source.trade_in_models]}])()));
test('query failure is sanitized and empty catalog returns no offers',async()=>{
 await blocked(()=>dep(undefined,{query:async()=>{throw Error('SECRET');}})());
 assert.deepEqual(await dep([])(),[]);
});
