'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createTenantContextRepository,SQL}=require('./tenant-context-repository');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const other='efbd5c32-e2d4-4adc-964e-40ea0eae9731';
const publication={tenant_id:tenant,public_id:'product_17',analysis_id:'analysis1',offer_id:'offer1',offer_revision:1,offer_value_fingerprint:'value1'};
const offer={tenant_id:tenant,analysis_id:'analysis1',offer_id:'offer1',offer_revision:1,offer_value_fingerprint:'value1',execution_status:'SUCCEEDED',domain_outcome:'VALID',freshness_status:'CURRENT',reviewed_offer:{supplier_id:'private_supplier',model:{id:'iphone17'},capacity_gb:256,color:'Silver',price:{amount_minor:600000,currency:'BRL'}}};
const row={tenant_id:tenant,public_id:'product_17',offer_revision:'1',offers:[offer],trade_in_candidates:[],trade_in_policy:{tenant_id:tenant,status:'ACTIVE',currency:'BRL'},rate_profile:{tenant_id:tenant,status:'ACTIVE',currency:'BRL'}};
const req={tenantId:tenant,publicId:'product_17',publication};
function load(rows=[row]){return createTenantContextRepository({enabled:true,query:async(sql,params)=>{assert.equal(sql,SQL);assert.deepEqual(params,[tenant,'product_17',1]);return {rows};}});}
async function blocked(fn,code='CONTEXT_UNAVAILABLE'){await assert.rejects(fn,e=>e.code===code);}
test('disabled by default, no DB needed',async()=>blocked(()=>createTenantContextRepository()({}),'CONTEXT_DISABLED'));
test('requires restricted query',()=>assert.throws(()=>createTenantContextRepository({enabled:true}),/TENANT_SCOPED_QUERY_REQUIRED/));
test('returns correctly bound private data only for internal domain',async()=>{const v=await load()(req);assert.equal(v.offers[0].offer_id,'offer1');assert(Object.isFrozen(v));});
test('SQL uses bind placeholders for tenant, public reference, revision',()=>{assert.match(SQL,/tenant_id=\$1::uuid/);assert.match(SQL,/public_id=\$2/);assert.match(SQL,/offer_revision=\$3/);});
test('rejects untrusted tenant and missing publication before query',async()=>{let calls=0;const reader=createTenantContextRepository({enabled:true,query:async()=>{calls++;return {rows:[row]};}});await blocked(()=>reader({...req,tenantId:other}));await blocked(()=>reader({...req,publication:{...publication,analysis_id:''}}));assert.equal(calls,0);});
test('rejects cross-tenant offer, trade-in candidate and policy',async()=>{await blocked(()=>load([{...row,offers:[{...offer,tenant_id:other}]}])(req));await blocked(()=>load([{...row,trade_in_candidates:[{...offer,tenant_id:other}]}])(req));await blocked(()=>load([{...row,rate_profile:{...row.rate_profile,tenant_id:other}}])(req),'CONTEXT_POLICY_UNAVAILABLE');});
test('rejects stale fingerprint, revisions and wrong offer',async()=>{await blocked(()=>load([{...row,offers:[{...offer,offer_value_fingerprint:'old'}]}])(req),'CONTEXT_PUBLICATION_STALE');await blocked(()=>load([{...row,offer_revision:2}])(req));await blocked(()=>load([{...row,offers:[{...offer,offer_id:'other'}]}])(req),'CONTEXT_PUBLICATION_STALE');});
test('rejects empty, duplicate or oversized context',async()=>{await blocked(()=>load([])(req));await blocked(()=>load([row,row])(req));await blocked(()=>load([{...row,trade_in_candidates:Array(101).fill(offer)}])(req));});
test('fails closed on source errors',async()=>{const reader=createTenantContextRepository({enabled:true,query:async()=>{throw new Error('private DB secret');}});await blocked(()=>reader(req));});
