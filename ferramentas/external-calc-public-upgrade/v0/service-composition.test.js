'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {generateKeyPairSync,sign}=require('node:crypto');
const {createUpgradeSecurityBoundary}=require('./service-composition');
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const tenantId='5212679b-8b2e-459f-a2ba-7ae8db558ba1',now=1762710000000;
const params={enabled:true,issuer:'pitstop-upgrade-issuer',audience:'external-calc-upgrade',tenantId,clock:()=>now};
function token(jti='nonce_composition_12345'){
 const p={iss:params.issuer,aud:params.audience,sub:'pitstop-upgrade-service',tenant_id:tenantId,scopes:['product:resolve-variant'],iat:now/1000-1,nbf:now/1000-1,exp:now/1000+60,jti};
 const h=Buffer.from(JSON.stringify({alg:'EdDSA',typ:'JWT',kid:'key_main'})).toString('base64url'),b=Buffer.from(JSON.stringify(p)).toString('base64url');
 return h+'.'+b+'.'+sign(null,Buffer.from(h+'.'+b),privateKey).toString('base64url');
}
function fixtures(overrides={}){
 const claims=new Set(),calls={keys:0,sql:0};
 const boundary=createUpgradeSecurityBoundary({...params,
 keyLoader:async(kid)=>{calls.keys++;return {kid,publicKey,revoked:false,state:'active',valid_from_ms:now-1000,valid_until_ms:now+100000}},
 pgNoncePool:{query:async(sql,[digest])=>{calls.sql++;assert.match(sql,/ON CONFLICT/);if(claims.has(digest))return {rowCount:0,rows:[]};claims.add(digest);return {rowCount:1,rows:[{nonce_digest:digest}]};}},...overrides});
 return {boundary,calls,claims};
}
async function denied(f,credential,code){await assert.rejects(()=>f({credential,requiredScope:'product:resolve-variant'}),e=>!code||e.code===code);}
test('disabled boundary never calls key or database services',async()=>{const b=createUpgradeSecurityBoundary();assert.equal(b.enabled,false);await denied(b.verifyService,token(),'UPGRADE_DISABLED');});
test('enabled boundary rejects missing persistent dependencies',()=>{assert.throws(()=>createUpgradeSecurityBoundary(params),/PERSISTENT_IDENTITY_DEPENDENCIES_REQUIRED/);});
test('valid signed token is accepted once and persisted using parameterized SQL',async()=>{const {boundary,calls}=fixtures();const cred=token();const id=await boundary.verifyService({credential:cred,requiredScope:'product:resolve-variant'});assert.equal(id.verified,true);assert.equal(id.tenant_id,tenantId);await denied(boundary.verifyService,cred,'SERVICE_IDENTITY_DENIED');assert.equal(calls.sql,2);assert.equal(calls.keys,2);});
test('concurrent attempts share a durable-style atomic database contract',async()=>{const {boundary,claims}=fixtures();const cred=token('nonce_parallel_1234567');const out=await Promise.allSettled(Array.from({length:20},()=>boundary.verifyService({credential:cred,requiredScope:'product:resolve-variant'})));assert.equal(out.filter(x=>x.status==='fulfilled').length,1);assert.equal(claims.size,1);});
test('database unavailable fails closed without leaking internal error',async()=>{const {boundary}=fixtures({pgNoncePool:{query:async()=>{throw new Error('PRIVATE_DB_PASSWORD')}}});await denied(boundary.verifyService,token(),'SERVICE_IDENTITY_DENIED');});
test('revoked key rejects request before database access',async()=>{let called=0;const {boundary}=fixtures({keyLoader:async(kid)=>({kid,publicKey,revoked:true,state:'active',valid_from_ms:now-1000,valid_until_ms:now+100000}),pgNoncePool:{query:async()=>{called++;return {rowCount:1,rows:[{}]}}}});await denied(boundary.verifyService,token(),'SERVICE_IDENTITY_DENIED');assert.equal(called,0);});
