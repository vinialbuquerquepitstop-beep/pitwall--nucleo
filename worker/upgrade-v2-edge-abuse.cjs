'use strict';
// UP-CRM-01: Cloudflare public-edge abuse gate, before the signed V2 bridge.
// Requires a platform-managed rate limiter; never trusts a client-provided
// arbitrary IP header outside the Cloudflare edge environment.
// No fallbacks to in-memory limits (not reliable across Worker isolates).
const RESPONSE=(status,code)=>new Response(JSON.stringify({ok:false,code}),{
 status,headers:{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store','x-content-type-options':'nosniff'}
});
const IP=/^(?:[0-9a-f:.]{2,45}|(?:\d{1,3}\.){3}\d{1,3})$/i;
function createUpgradeV2EdgeAbuseGate({limiter,origin,hashIp}={}){
 if(typeof limiter?.limit!=='function'||typeof origin!=='string'||
  !/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(origin)||typeof hashIp!=='function')
  return null;
 return Object.freeze({async authorize(request){
  let url;
  try{url=new URL(request.url);}catch{return RESPONSE(400,'BAD_REQUEST');}
  if(request.method!=='POST'||url.pathname!=='/api/upgrade/v1/lead'||url.search||
   url.origin!==origin||request.headers.get('origin')!==origin)
   return RESPONSE(403,'UPGRADE_V2_FORBIDDEN');
  // CF metadata and CF-Connecting-IP are controlled by the Cloudflare edge
  // on the deployed Worker; an isolated browser/test without CF metadata
  // must be denied, never allowed by a forged IP header.
  const colo=request.cf?.colo;
  const ip=request.headers.get('cf-connecting-ip');
  if(typeof colo!=='string'||!/^[A-Z]{3}$/.test(colo)||
   typeof ip!=='string'||!IP.test(ip))
   return RESPONSE(503,'UPGRADE_V2_ABUSE_PROTECTION_UNAVAILABLE');
  let key;
  try{key=await hashIp(ip);}catch{return RESPONSE(503,'UPGRADE_V2_ABUSE_PROTECTION_UNAVAILABLE');}
  if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))
   return RESPONSE(503,'UPGRADE_V2_ABUSE_PROTECTION_UNAVAILABLE');
  try{
   // "limit" is the Cloudflare Workers Rate Limiting binding API.
   // Stable key is HMAC(IP), not raw IP, never logged or sent to CRM.
   const result=await limiter.limit({key});
   if(result?.success===true)return null;
   if(result?.success===false)return RESPONSE(429,'UPGRADE_INTAKE_REJECTED');
  }catch{}
  return RESPONSE(503,'UPGRADE_V2_ABUSE_PROTECTION_UNAVAILABLE');
 }});
}
function createUpgradeV2EdgeIpHasher(secret){
 if(typeof secret!=='string'||secret.length<32)return null;
 let cachedKey;
 const enc=new TextEncoder();
 return async ip=>{
  if(!cachedKey)cachedKey=crypto.subtle.importKey('raw',enc.encode(secret),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=await crypto.subtle.sign('HMAC',await cachedKey,enc.encode(ip));
  return Array.from(new Uint8Array(signed),n=>n.toString(16).padStart(2,'0')).join('');
 };
}
module.exports={createUpgradeV2EdgeAbuseGate,createUpgradeV2EdgeIpHasher};
