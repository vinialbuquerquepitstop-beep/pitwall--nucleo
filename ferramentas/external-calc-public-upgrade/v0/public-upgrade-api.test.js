'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPublicUpgradeApi,PATHS}=require('./public-upgrade-api');
const origin='https://upgrade.example.test';
const request_key='d71c03a5-c98d-4fe9-ad8c-ea4c20d18591';
const selection={desired:{model:'iPhone 17 Pro',capacity:'256 GB',condition:'lacrado'},trade_in:{model:'iPhone 14 Pro',capacity:'128 GB',condition:'bom'},installments:12};
const quote={sale_amount_minor:690000,trade_in_credit_minor:270000,amount_due_minor:420000,currency:'BRL',installment_count:12,installment_amount_minor:40000};
const request=(path=PATHS.quote,body=selection,extras={})=>new Request(origin+path,{method:'POST',headers:{'content-type':'application/json',...extras.headers},body:JSON.stringify(body)});
const instance=(options={})=>createPublicUpgradeApi({enabled:true,expectedOrigin:origin,quote:async()=>quote,capture:async()=>({accepted:true,reference:'lead_000001'}),catalog:async()=>[{tenant_id:'private',status:'published',approved:true,desired:selection.desired,supplier_id:'PRIVATE'}],...options});
test('disabled by default, no route exposed',async()=>assert.equal((await createPublicUpgradeApi().handle(request())).status,404));
test('enabled requires real handlers',()=>assert.throws(()=>createPublicUpgradeApi({enabled:true}),/DEPENDENCIES_REQUIRED/));
test('returns only a price projection after authorized service',async()=>{const r=await instance().handle(request());assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,quote});assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('access-control-allow-origin'),null);});
test('rejects client-supplied tenant, price or seller values',async()=>{let calls=0;const api=instance({quote:async()=>{calls++;return quote;}});for(const extra of [{tenant_id:'fake'},{sale_price_minor:1},{supplier_id:'x'},{price_revision:'rev'}])assert.equal((await api.handle(request(PATHS.quote,{...selection,...extra}))).status,400);assert.equal(calls,0);});
test('rejects unsupported formats, actions and wrong host',async()=>{const api=instance();const wrong=new Request('https://evil.example'+PATHS.quote,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(selection)});assert.equal((await api.handle(wrong)).status,404);assert.equal((await api.handle(new Request(origin+PATHS.quote))).status,405);assert.equal((await api.handle(request(PATHS.quote,selection,{headers:{origin:'https://evil.example'}}))).status,403);});
test('rejects inconsistent or invalid quote rather than inventing prices',async()=>{for(const q of [{...quote,amount_due_minor:1},{...quote,internal_cost_minor:3,sale_amount_minor:-1}]){const r=await instance({quote:async()=>q}).handle(request());assert.equal(r.status,503);}});
test('rejects unsupported installment count and non-enumerated conditions',async()=>{const api=instance();assert.equal((await api.handle(request(PATHS.quote,{...selection,installments:24}))).status,400);assert.equal((await api.handle(request(PATHS.quote,{...selection,trade_in:{...selection.trade_in,condition:'invented'}}))).status,400);});
test('lead requires consent and normalized whatsapp',async()=>{let seen;const api=instance({capture:async x=>{seen=x;return {accepted:true,reference:'lead_000001'}}});const r=await api.handle(request(PATHS.lead,{request_key,selection,contact:{name:'Ana',whatsapp:'(21) 99999-9999'},consent:true}));assert.equal(r.status,202);assert.equal((await r.json()).reference,'lead_000001');assert.equal(seen.contact.whatsapp,'5521999999999');assert.equal(seen.request_key,request_key);});
test('missing consent and additional fields cannot capture',async()=>{let calls=0;const api=instance({capture:async()=>{calls++;return {accepted:true,reference:'lead_000001'}}});for(const payload of [{request_key,selection,contact:{name:'Ana',whatsapp:'21999999999'},consent:false},{request_key,selection,contact:{name:'Ana',whatsapp:'21999999999'},consent:true,tenant_id:'foreign'},{request_key,selection,contact:{name:'Ana',whatsapp:'123'},consent:true}])assert.equal((await api.handle(request(PATHS.lead,payload))).status,400);assert.equal(calls,0);});
test('capture unavailable never claims success',async()=>{const r=await instance({capture:async()=>{throw Error('private error');}}).handle(request(PATHS.lead,{request_key,selection,contact:{name:'Ana',whatsapp:'21999999999'},consent:true}));assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false,code:'CAPTURE_UNAVAILABLE'});});
test('quote unavailable never claims a price',async()=>{const r=await instance({quote:async()=>{throw Error('private error')}}).handle(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false,code:'QUOTE_UNAVAILABLE'});});

test('lead without valid idempotency key is rejected',async()=>{const api=instance();const base={selection,contact:{name:'Ana',whatsapp:'21999999999'},consent:true};assert.equal((await api.handle(request(PATHS.lead,base))).status,400);assert.equal((await api.handle(request(PATHS.lead,{...base,request_key:'invalid'}))).status,400);});

test('catalog GET returns only published product dimensions',async()=>{
 const api=instance();
 const response=await api.handle(new Request(origin+PATHS.catalog));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{ok:true,offers:[selection.desired]});
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(response.headers.get('access-control-allow-origin'),null);
});
test('catalog rejects POST and foreign origin',async()=>{
 const api=instance();
 assert.equal((await api.handle(request(PATHS.catalog))).status,405);
 assert.equal((await api.handle(new Request(origin+PATHS.catalog,{headers:{origin:'https://evil.example'}}))).status,403);
});
test('catalog refuses private or malformed entries and query failures',async()=>{
 for(const broken of [[{desired:{...selection.desired,condition:'other'},status:'published',approved:true}],
 [{desired:selection.desired,status:'draft',approved:true}],
 [null]]){
  const api=instance({catalog:async()=>broken});
  const r=await api.handle(new Request(origin+PATHS.catalog));
  assert.equal(r.status,503);
 }
 const bad=instance({catalog:async()=>{throw Error('private-password')}});
 const r=await bad.handle(new Request(origin+PATHS.catalog));
 assert.deepEqual(await r.json(),{ok:false,code:'CATALOG_UNAVAILABLE'});
});
test('catalog rejects ambiguous duplicate offers',async()=>{
 const r=await instance({catalog:async()=>[{desired:selection.desired,status:'published',approved:true},{desired:selection.desired,status:'published',approved:true}]}).handle(new Request(origin+PATHS.catalog));
 assert.equal(r.status,503);
});
