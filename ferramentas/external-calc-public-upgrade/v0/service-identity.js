'use strict';
// UP-06L: server-only verifier. No Worker route or DB grants.
const {createPublicKey, verify, KeyObject}=require('node:crypto');
const SCOPES=new Set(['product:resolve-variant','product:trade-in-estimate','product:sales-simulation']);
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const B64=/^[A-Za-z0-9_-]+$/;
class IdentityDenied extends Error{constructor(code='SERVICE_IDENTITY_DENIED'){super(code);this.name='IdentityDenied';this.code=code;}}
function fail(){throw new IdentityDenied();}
function decode(x,limit){
 if(typeof x!=='string'||!x||x.length>limit||!B64.test(x)||x.length%4===1)fail();
 const b=Buffer.from(x,'base64url');if(b.toString('base64url')!==x)fail();return b;
}
function obj(x){const v=JSON.parse(x);if(!v||typeof v!=='object'||Array.isArray(v))fail();return v;}
const exact=(v,keys)=>Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
/**
 * keyRegistry(kid) must return {publicKey,active:true}.
 * consumeNonce MUST atomically insert-if-absent across all Worker instances,
 * return true only once, and durably retain the nonce until token expiry.
 * A process-local Set does NOT meet this production contract.
 */
function createUpgradeServiceIdentityVerifier({issuer,audience,tenantId,keyRegistry,consumeNonce,clock=()=>Date.now()}={}){
 if(typeof issuer!=='string'||!issuer||typeof audience!=='string'||!audience||!UUID.test(tenantId||'')||typeof keyRegistry!=='function'||typeof consumeNonce!=='function')throw new Error('SERVICE_IDENTITY_DEPENDENCIES_REQUIRED');
 return async function verifyService({credential,requiredScope}={}){
  if(!SCOPES.has(requiredScope)||typeof credential!=='string'||credential.length<20||credential.length>4096)fail();
  const parts=credential.split('.');if(parts.length!==3)fail();
  let h,p,sig;
  try{h=obj(decode(parts[0],512).toString('utf8'));p=obj(decode(parts[1],2048).toString('utf8'));sig=decode(parts[2],128);}catch(_){fail();}
  if(!exact(h,['alg','typ','kid'])||h.alg!=='EdDSA'||h.typ!=='JWT'||typeof h.kid!=='string'||!/^[a-zA-Z0-9_-]{3,80}$/.test(h.kid)||sig.length!==64)fail();
  if(!exact(p,['iss','aud','sub','tenant_id','scopes','iat','nbf','exp','jti']))fail();
  if(p.iss!==issuer||p.aud!==audience||p.sub!=='pitstop-upgrade-service'||p.tenant_id!==tenantId||!UUID.test(p.tenant_id)||!Array.isArray(p.scopes)||p.scopes.length!==1||p.scopes[0]!==requiredScope||typeof p.jti!=='string'||!/^[a-zA-Z0-9_-]{16,128}$/.test(p.jti))fail();
  if(!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.nbf)||!Number.isSafeInteger(p.exp))fail();
  const now=Math.floor(clock()/1000);if(p.iat>now+5||p.nbf>now+5||p.exp<=now||p.exp-p.iat>300||p.exp-p.iat<1||p.nbf<p.iat-5)fail();
  let key;try{key=await keyRegistry(h.kid);}catch(_){fail();}
  if(!key||key.active!==true||!key.publicKey)fail();
  let valid=false;
  try{const k=key.publicKey instanceof KeyObject?key.publicKey:createPublicKey(key.publicKey);if(k.asymmetricKeyType!=='ed25519')fail();valid=verify(null,Buffer.from(parts[0]+'.'+parts[1],'ascii'),k,sig);}catch(_){fail();}
  if(!valid)fail();
  let consumed=false;
  try{consumed=await consumeNonce({jti:p.jti,issuer:p.iss,subject:p.sub,tenantId:p.tenant_id,expiresAtMs:p.exp*1000});}catch(_){fail();}
  if(consumed!==true)fail();
  return Object.freeze({verified:true,principal:p.sub,tenant_id:p.tenant_id,scopes:[requiredScope],not_before_ms:p.nbf*1000,expires_at_ms:p.exp*1000});
 };
}
module.exports={createUpgradeServiceIdentityVerifier,IdentityDenied};
