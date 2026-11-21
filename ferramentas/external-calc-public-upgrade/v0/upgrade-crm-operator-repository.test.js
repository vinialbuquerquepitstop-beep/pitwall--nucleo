'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeCrmOperatorRepository,LOAD,MARK}=require('./upgrade-crm-operator-repository');
const tenantId='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const requestId='930e39e4-6ee4-414a-861a-99c318bf40a6',leadId='0b72438a-60e3-42fc-9f39-bb0d1a80e1de';
test('disabled by default without credentials',async()=>{const r=createUpgradeCrmOperatorRepository();await assert.rejects(()=>r.loadRequest({}),/CRM_RECONCILE_DISABLED/);});
test('cannot activate with untrusted tenant or missing DB',()=>assert.throws(()=>createUpgradeCrmOperatorRepository({enabled:true}),/CRM_OPERATOR_DB_REQUIRED/));
test('loadRequest filters tenant and id at SQL level',async()=>{
 const r=createUpgradeCrmOperatorRepository({enabled:true,tenantId,query:async(sql,params)=>{assert.equal(sql,LOAD);assert.deepEqual(params,[tenantId,requestId]);return {rows:[{id:requestId,tenant_id:tenantId,status:'RECEIVED'}]};}});
 assert.equal((await r.loadRequest({tenantId,requestId})).status,'RECEIVED');
 assert.equal(await r.loadRequest({tenantId:'efbd5c32-e2d4-4adc-964e-40ea0eae9731',requestId}),null);
});
test('markLinked updates RECEIVED only and validates response tenant',async()=>{
 const r=createUpgradeCrmOperatorRepository({enabled:true,tenantId,query:async(sql,params)=>{assert.equal(sql,MARK);assert.deepEqual(params,[tenantId,requestId,leadId,'RECEIVED']);return {rows:[{id:requestId,tenant_id:tenantId,lead_id:leadId}]};}});
 assert.equal(await r.markLinked({tenantId,requestId,leadId,expectedStatus:'RECEIVED'}),true);
 assert.equal(await r.markLinked({tenantId,requestId,leadId,expectedStatus:'LINKED'}),false);
});
test('no match and cross tenant result fail closed',async()=>{
 const r=createUpgradeCrmOperatorRepository({enabled:true,tenantId,query:async()=>({rows:[]})});
 assert.equal(await r.markLinked({tenantId,requestId,leadId,expectedStatus:'RECEIVED'}),false);
 const x=createUpgradeCrmOperatorRepository({enabled:true,tenantId,query:async()=>({rows:[{id:requestId,tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731',lead_id:leadId}]})});
 assert.equal(await x.markLinked({tenantId,requestId,leadId,expectedStatus:'RECEIVED'}),false);
});
test('DB faults do not expose details',async()=>{
 const r=createUpgradeCrmOperatorRepository({enabled:true,tenantId,query:async()=>{throw Error('secret');}});
 assert.equal(await r.markLinked({tenantId,requestId,leadId,expectedStatus:'RECEIVED'}),false);
 await assert.rejects(()=>r.loadRequest({tenantId,requestId}),/CRM_SOURCE_UNAVAILABLE/);
});
