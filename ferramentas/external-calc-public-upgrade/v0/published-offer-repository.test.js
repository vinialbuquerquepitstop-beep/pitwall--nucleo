'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPublishedOfferRepository,QUERY}=require('./published-offer-repository');
const tenantId='5212679b-8b2e-459f-a2ba-7ae8db558ba1',clock=()=>1000;
const data={tenant_id:tenantId,public_id:'p17',price_revision:'rev_1',status:'published',sale_price_minor:690000,expires_at_ms:90000,offer_revision:1,analysis_id:'a',offer_id:'silver',offer_value_fingerprint:'valuefingerprint',supplier_id:'SECRET',internal_cost_minor:600000};
const args={tenantId,publicId:'p17',revision:'rev_1'};
const create=(rows=[data])=>createPublishedOfferRepository({enabled:true,clock,query:async(sql,params)=>{assert.equal(sql,QUERY);assert.deepEqual(params,[tenantId,'p17','rev_1']);return {rows};}});
const rejected=async(fn,code)=>assert.rejects(fn,e=>e.code===code);
test('deny by default and no connection needed',async()=>rejected(()=>createPublishedOfferRepository()({}), 'PUBLICATION_DISABLED'));
test('requires query dependency when active',()=>assert.throws(()=>createPublishedOfferRepository({enabled:true}),/RESTRICTED_QUERY_REQUIRED/));
test('matches tenant and revision server side and strips private source fields',async()=>{const p=await create()(args);assert.equal(p.sale_price_minor,690000);assert.equal(Object.hasOwn(p,'supplier_id'),false);assert.equal(Object.hasOwn(p,'internal_cost_minor'),false);assert(Object.isFrozen(p));});
test('SQL uses tenant bind, excludes draft publication',()=>{assert.match(QUERY,/tenant_id=\$1::uuid/);assert.match(QUERY,/price_revision=\$3/);assert.match(QUERY,/status='published'/);});
test('rejects malformed tenant, ids and revisions before DB',async()=>{let calls=0;const get=createPublishedOfferRepository({enabled:true,clock,query:async()=>{calls++;return {rows:[data]};}});for(const mutation of [{tenantId:'x'},{publicId:"bad' OR 1=1"},{revision:'../../secrets'}])await rejected(()=>get({...args,...mutation}),'PUBLICATION_NOT_AUTHORIZED');assert.equal(calls,0);});
test('rejects cross tenant, draft, expiry, invalid price or fingerprint',async()=>{for(const patch of [{tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'},{status:'draft'},{expires_at_ms:500},{sale_price_minor:-10},{offer_value_fingerprint:null}])await rejected(()=>create([{...data,...patch}])(args),'PUBLICATION_NOT_AUTHORIZED');});
test('rejects zero and duplicate rows',async()=>{for(const rows of [[],[data,data]])await rejected(()=>create(rows)(args),'PUBLICATION_NOT_AUTHORIZED');});
test('fails closed when source query fails',async()=>{const get=createPublishedOfferRepository({enabled:true,clock,query:async()=>{throw new Error('private-password');}});await rejected(()=>get(args),'PUBLICATION_SOURCE_UNAVAILABLE');});

test('PostgreSQL BIGINT decimal strings are safely normalized',async()=>{const p=await create([{...data,sale_price_minor:'690000',expires_at_ms:'90000',offer_revision:'1'}])(args);assert.equal(p.sale_price_minor,690000);assert.equal(p.expires_at_ms,90000);assert.equal(p.offer_revision,1);});
test('unsafe PostgreSQL BIGINT values cannot enter public response',async()=>{for(const invalid of ['9007199254740993','6.9e5','0690000','-1','ABC'])await rejected(()=>create([{...data,sale_price_minor:invalid}])(args),'PUBLICATION_NOT_AUTHORIZED');});
