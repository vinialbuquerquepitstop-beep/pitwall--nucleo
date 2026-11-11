'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeV2ServiceBridge}=require('./upgrade-v2-service-bridge.cjs');
const origin='https://flat-resonance-09ba.pitstopimports.workers.dev';
const secret='test-only-private-signing-secret-0123456789012345';
const reference='upg_8b624ef6229b459daed035f9a749d131';
const post=(path='/api/upgrade/v1/lead',body='{"request_key":"abc"}')=>new Request(origin+path,{
 method:'POST',headers:{origin,'content-type':'application/json'},body});
test('cannot configure a public client-selected or missing V2 service binding',()=>{
 assert.equal(createUpgradeV2ServiceBridge({secret,publicOrigin:origin}),null);
 assert.equal(createUpgradeV2ServiceBridge({binding:{fetch:async()=>{}},secret:'short',publicOrigin:origin}),null);
 assert.equal(createUpgradeV2ServiceBridge({binding:{fetch:async()=>{}},secret,publicOrigin:'http://insecure.test'}),null);
});
test('private service binding receives signed bytes, never a DB key or user-supplied destination',async()=>{
 const calls=[];const binding={fetch:async req=>{
  calls.push(req);
  assert.equal(req.headers.get('origin'),origin);
  assert.match(req.headers.get('x-pw-upgrade-timestamp'),/^\d+$/);
  assert.match(req.headers.get('x-pw-upgrade-signature'),/^[0-9a-f]{64}$/);
  assert.equal(await req.text(),'{"request_key":"abc"}');
  return Response.json({ok:true,reference,status:'RECEIVED'},{status:202});
 }};
 const bridge=createUpgradeV2ServiceBridge({binding,secret,publicOrigin:origin,now:()=>1794438000000});
 const response=await bridge(post());
 assert.equal(response.status,202);assert.equal((await response.json()).reference,reference);
 assert.equal(calls.length,1);
});
test('no binding call for wrong origin/path or oversized stream',async()=>{
 let calls=0;
 const bridge=createUpgradeV2ServiceBridge({binding:{fetch:async()=>{calls++;}},secret,publicOrigin:origin});
 assert.equal((await bridge(new Request('https://untrusted.test/api/upgrade/v1/lead',{method:'POST',body:'{}'}))).status,403);
 assert.equal((await bridge(post('/api/upgrade/v1/quote'))).status,403);
 assert.equal((await bridge(post('/api/upgrade/v1/lead','x'.repeat(8200)))).status,413);
 assert.equal(calls,0);
});
test('never announces 202 for forged or malformed downstream response',async()=>{
 for(const malformed of [Response.json({ok:true,reference:'bad',status:'RECEIVED'},{status:202}),
  Response.json({ok:true,reference,status:'LINKED'},{status:202}),
  new Response('oops',{status:202})]){
  const bridge=createUpgradeV2ServiceBridge({binding:{fetch:async()=>malformed.clone()},secret,publicOrigin:origin});
  const result=await bridge(post());
  assert.equal(result.status,503);
  assert.equal((await result.json()).code,'UPGRADE_V2_BAD_RECEIPT');
 }
});
test('maps only approved failure statuses without leaking upstream content',async()=>{
 for(const status of [400,409,429,503]){
  const bridge=createUpgradeV2ServiceBridge({binding:{fetch:async()=>new Response('private DB error',{status})},secret,publicOrigin:origin});
  const result=await bridge(post());assert.equal(result.status,status);
  assert(!JSON.stringify(await result.json()).includes('private DB error'));
 }
});
test('network and unexpected response fail closed',async()=>{
 for(const binding of [{fetch:async()=>{throw Error('SQL private')}} ,{fetch:async()=>Response.json({err:'secret'},{status:500})}]){
  const bridge=createUpgradeV2ServiceBridge({binding,secret,publicOrigin:origin});
  const result=await bridge(post());assert.equal(result.status,503);
  assert(!JSON.stringify(await result.json()).includes('secret'));
 }
});
