'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeV2EdgeAbuseGate,createUpgradeV2EdgeIpHasher}=require('./upgrade-v2-edge-abuse.cjs');
const ORIGIN='https://flat-resonance-09ba.pitstopimports.workers.dev';
const secret='test-only-private-HMAC-secret-01234567890123456789';
const build=(extra={})=>{
 const req=new Request(extra.url||ORIGIN+'/api/upgrade/v1/lead',{
  method:extra.method||'POST',headers:{origin:extra.origin===undefined?ORIGIN:extra.origin,
   'cf-connecting-ip':extra.ip===undefined?'198.51.100.20':extra.ip}});
 if(extra.colo!==null)Object.defineProperty(req,'cf',{value:{colo:extra.colo||'GIG'}});
 return req;
};
function gate(limiter){return createUpgradeV2EdgeAbuseGate({
 limiter,origin:ORIGIN,hashIp:createUpgradeV2EdgeIpHasher(secret)});
}
test('an absent rate-limit binding or HMAC secret is a configuration blocker',()=>{
 assert.equal(createUpgradeV2EdgeAbuseGate({origin:ORIGIN,hashIp:async()=>'',limiter:null}),null);
 assert.equal(createUpgradeV2EdgeIpHasher('short'),null);
 assert.equal(createUpgradeV2EdgeAbuseGate({limiter:{limit:async()=>({success:true})},origin:ORIGIN,hashIp:null}),null);
});
test('Cloudflare authenticated edge request is rate-limited using stable pseudonymous HMAC IP',async()=>{
 const keys=[];
 const limiter={limit:async({key})=>{keys.push(key);return {success:true}}};
 const g=gate(limiter);
 assert.equal(await g.authorize(build()),null);
 assert.equal(await g.authorize(build()),null);
 assert.equal(keys.length,2);
 assert.equal(keys[0],keys[1]);
 assert.match(keys[0],/^[a-f0-9]{64}$/);
 assert(!keys[0].includes('198.51.100.20'));
});
test('rate-limited client receives 429 and cannot proceed',async()=>{
 const result=await gate({limit:async()=>({success:false})}).authorize(build());
 assert.equal(result.status,429);
 assert.equal((await result.json()).code,'UPGRADE_INTAKE_REJECTED');
});
test('deny forged edge IP without cf metadata; no limiter call',async()=>{
 let calls=0;
 const limiter={limit:async()=>{calls++;return {success:true}}};
 const denied=await gate(limiter).authorize(build({colo:null}));
 assert.equal(denied.status,503);assert.equal(calls,0);
});
test('fail closed when limiter throws, times out, or returns unknown data',async()=>{
 for(const limiter of [{limit:async()=>{throw Error('not configured')}},
  {limit:async()=>({})},{limit:async()=>null}]){
  const response=await gate(limiter).authorize(build());
  assert.equal(response.status,503);
  assert.equal((await response.json()).code,'UPGRADE_V2_ABUSE_PROTECTION_UNAVAILABLE');
 }
});
test('origin, method, path must match before acquiring rate limit',async()=>{
 let calls=0;const limiter={limit:async()=>{calls++;return {success:true}}};
 for(const x of [{origin:'https://evil.test'},{url:ORIGIN+'/api/upgrade/v1/quote'},
  {method:'GET'},{url:ORIGIN+'/api/upgrade/v1/lead?tenant=wrong'}]){
  const denied=await gate(limiter).authorize(build(x));
  assert.equal(denied.status,403);
 }
 assert.equal(calls,0);
});
test('valid edge IP with invalid colo is rejected even with supplied client header',async()=>{
 const response=await gate({limit:async()=>({success:true})}).authorize(build({colo:'BAD!'}));
 assert.equal(response.status,503);
});
