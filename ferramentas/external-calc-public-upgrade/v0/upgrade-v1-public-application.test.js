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
test('enabled app requires authorized quote provider and tenant-bound source',()=>assert.throws(()=>createUpgradeV1PublicApplication({enabled:true}),/TRUSTED_QUOTE_DEPENDENCIES_REQUIRED/));
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

test('one public journey resolves authorized publication + trade-in without supplier price',async()=>{
 const pub={tenant_id:tenantId,public_id:'public17pro256',price_revision:'rev1',status:'published',approved:true,expires_at_ms:1762000000000,
  desired:selection.desired,trade_in_models:[{model:selection.trade_in.model,capacity:selection.trade_in.capacity,capacity_gb:128,device_model_id:'iphone14pro'}]};
 const calls=[];
 const app=createUpgradeV1PublicApplication({enabled:true,tenantId,expectedOrigin:origin,clock:()=>1760000000000,
  query:async(sql)=>({rows:sql===INSERT?[{id}]:[]}),
  loadApprovedCatalog:async()=>[pub],
  invokeInternal:async({action,command})=>{
   calls.push({action,command});
   return {schema_version:'pitstop-internal-upgrade/v1',public_id:pub.public_id,price_revision:pub.price_revision,action,amount_minor:action==='resolveVariant'?690000:260000,currency:'BRL'};
  }});
 const lead=await app.handle(request());
 assert.equal(lead.status,202);
 const quote=await app.handle(new Request(origin+'/api/upgrade/v1/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(selection)}));
 assert.equal(quote.status,200);
 assert.deepEqual(await quote.json(),{ok:true,quote:{sale_amount_minor:690000,trade_in_credit_minor:260000,amount_due_minor:430000,currency:'BRL'}});
 assert.deepEqual(calls.map(c=>c.action),['resolveVariant','estimateTradeIn']);
 assert(!JSON.stringify(calls[0].command).includes('supplier'));
});
test('without approved publication client gets no guessed price, even after lead capture',async()=>{
 const app=createUpgradeV1PublicApplication({enabled:true,tenantId,expectedOrigin:origin,clock:()=>1760000000000,
  query:async()=>({rows:[{id}]}),loadApprovedCatalog:async()=>[],invokeInternal:async()=>{throw Error('SHOULD_NOT_RUN')}});
 const captured=await app.handle(request());assert.equal(captured.status,202);
 const pricing=await app.handle(new Request(origin+'/api/upgrade/v1/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(selection)}));
 assert.equal(pricing.status,503);
 assert.deepEqual(await pricing.json(),{ok:false,code:'QUOTE_UNAVAILABLE'});
});
