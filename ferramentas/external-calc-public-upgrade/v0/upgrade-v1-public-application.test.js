'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeV1PublicApplication}=require('./upgrade-v1-public-application');
const {INSERT,RECHECK}=require('./upgrade-capture-repository');
const origin='https://upgrade.example.test',tenantId='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const request_key='d71c03a5-c98d-4fe9-ad8c-ea4c20d18591',id='930e39e4-6ee4-414a-861a-99c318bf40a6';
const selection={desired:{model:'iPhone 17 Pro',capacity:'256 GB',condition:'lacrado'},trade_in:{model:'iPhone 14 Pro',capacity:'128 GB',condition:'bom'},installments:12};
const body={request_key,selection,contact:{name:'Synthetic Tester',whatsapp:'(21) 99999-9999'},consent:true};
const request=()=>new Request(origin+'/api/upgrade/v1/lead',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
test('default-off public app returns 404 without dependencies',async()=>assert.equal((await createUpgradeV1PublicApplication().handle(request())).status,404));
test('enabled app requires authorized quote provider and tenant-bound source',()=>assert.throws(()=>createUpgradeV1PublicApplication({enabled:true}),/AUTHORIZED_QUOTE_SERVICE_REQUIRED/));
test('end-to-end public HTTP → scoped INSERT → one receipt (no price)',async()=>{
 let called=0;
 const app=createUpgradeV1PublicApplication({enabled:true,tenantId,expectedOrigin:origin,quote:async()=>{throw Error('quote unavailable');},query:async(sql,p)=>{called++;assert.equal(sql,INSERT);assert.equal(p[0],tenantId);assert.equal(p[1],request_key);return {rows:[{id}]};}});
 const r=await app.handle(request());assert.equal(r.status,202);assert.deepEqual(await r.json(),{ok:true,reference:'upg_'+id.replaceAll('-','')});assert.equal(called,1);
});
test('idempotent HTTP retry returns original receipt',async()=>{
 let calls=0;
 const app=createUpgradeV1PublicApplication({enabled:true,tenantId,expectedOrigin:origin,quote:async()=>null,query:async(sql)=>{calls++;return {rows:sql===INSERT?[]:[{id}]};}});
 const r=await app.handle(request());assert.equal(r.status,202);assert.equal((await r.json()).reference,'upg_'+id.replaceAll('-',''));assert.equal(calls,2);
});
test('source failure does not claim received lead',async()=>{
 const app=createUpgradeV1PublicApplication({enabled:true,tenantId,expectedOrigin:origin,quote:async()=>null,query:async()=>{throw Error('server secret');}});
 const r=await app.handle(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false,code:'CAPTURE_UNAVAILABLE'});
});
