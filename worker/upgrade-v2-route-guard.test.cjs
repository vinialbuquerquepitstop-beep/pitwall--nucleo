'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createUpgradeV2Gate}=require('./upgrade-v2-route-guard.cjs');
const origin='https://flat-resonance-09ba.pitstopimports.workers.dev';
const req=(path='/api/upgrade/v1/lead')=>new Request(origin+path,{method:'POST'});
test('existing Worker never imports or runs the legacy Calc Upgrade capture',()=>{
 const file=fs.readFileSync(path.join(__dirname,'external-calc-worker.mjs'),'utf8');
 assert(file.includes('createUpgradeV2Gate'));
 assert(!file.includes('createUpgradeV1HyperdriveApplication'));
 assert(!file.includes('upgrade-hyperdrive-composition'));
 assert(file.includes("env.UPGRADE_V2_PUBLIC_ENABLED === 'true'"));
 assert(file.includes('createUpgradeV2ServiceBridge'));
 assert(file.includes('env.UPGRADE_V2_INGRESS_SERVICE'));
 assert(file.includes('env.UPGRADE_V2_BRIDGE_SECRET'));
 assert(file.includes('createUpgradeV2EdgeAbuseGate'));
 assert(file.includes('env.UPGRADE_V2_RATE_LIMITER'));
 assert(file.includes('env.UPGRADE_V2_IP_HMAC_SECRET'));
 assert(!file.includes('createUpgradeV1HyperdriveApplication'));

});
test('default OFF rejects every Upgrade public route with no provider execution',async()=>{
 const gate=createUpgradeV2Gate();let called=false;
 const paths=['/api/upgrade/v1/lead','/api/upgrade/v1/catalog','/api/upgrade/v1/quote'];
 for(const p of paths){
  assert(gate.matches(p));const result=await gate.handle(req(p));
  assert.equal(result.status,404);
  assert.equal((await result.json()).code,'NOT_FOUND');
 }
 assert.equal(called,false);
});
test('even an enabled flag cannot accept data without an approved V2 handler',async()=>{
 const gate=createUpgradeV2Gate({enabled:true});
 const lead=await gate.handle(req());
 assert.equal(lead.status,503);
 assert.equal((await lead.json()).code,'UPGRADE_V2_NOT_CONNECTED');
 assert.equal(lead.headers.get('cache-control'),'no-store');
});
test('V2 injection cannot route quote or catalog to an unrelated backend',async()=>{
 let calls=0;const gate=createUpgradeV2Gate({enabled:true,handleV2:async()=>{calls++;return new Response('ok')},authorizeRequest:async()=>null});
 for(const p of ['/api/upgrade/v1/catalog','/api/upgrade/v1/quote']){
  const x=await gate.handle(req(p));assert.equal(x.status,503);
 }
 assert.equal(calls,0);
});
test('explicit V2 provider is the sole route for lead after authorization',async()=>{
 let calls=0;const gate=createUpgradeV2Gate({enabled:true,authorizeRequest:async()=>null,handleV2:async(request)=>{
  calls++;assert.equal(new URL(request.url).pathname,'/api/upgrade/v1/lead');
  return new Response(JSON.stringify({ok:true,reference:'upg_8b624ef6229b459daed035f9a749d131',status:'RECEIVED'}),{status:202});
 }});
 const result=await gate.handle(req());assert.equal(result.status,202);
 assert.equal((await result.json()).status,'RECEIVED');assert.equal(calls,1);
});
test('provider failure and unrecognized paths never expose internals',async()=>{
 const gate=createUpgradeV2Gate({enabled:true,authorizeRequest:async()=>null,handleV2:async()=>{throw Error('secret SQL connection')}});
 const result=await gate.handle(req());assert.equal(result.status,503);
 assert(!JSON.stringify(await result.json()).includes('secret'));
 assert.equal((await gate.handle(req('/api/upgrade/v1/unknown'))).status,404);
});

test('public V2 forwarding requires an operational abuse gate, not only a provider',async()=>{
 let called=0;
 const gate=createUpgradeV2Gate({enabled:true,handleV2:async()=>{called++;return Response.json({ok:true})}});
 const result=await gate.handle(req());assert.equal(result.status,503);
 assert.equal((await result.json()).code,'UPGRADE_V2_ABUSE_PROTECTION_UNAVAILABLE');
 assert.equal(called,0);
});
test('rate limiter rejects before forwarding, including invalid gate behavior',async()=>{
 let calls=0;
 for(const authorizeRequest of [async()=>Response.json({ok:false},{status:429}),async()=>({}),async()=>{throw Error('failure')}]){
  const gate=createUpgradeV2Gate({enabled:true,handleV2:async()=>{calls++;},authorizeRequest});
  const res=await gate.handle(req());assert([429,503].includes(res.status));
 }
 assert.equal(calls,0);
});
