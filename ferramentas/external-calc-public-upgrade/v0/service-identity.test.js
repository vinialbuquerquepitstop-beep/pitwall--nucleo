'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync,sign}=require('node:crypto');
const {createUpgradeServiceIdentityVerifier}=require('./service-identity');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const other=generateKeyPairSync('ed25519');
const now=1762710000;let seq=0;
const scope='product:resolve-variant';
const payload=()=>({iss:'pitstop-internal',aud:'external-calc-upgrade',sub:'pitstop-upgrade-service',tenant_id:tenant,scopes:[scope],iat:now-1,nbf:now-1,exp:now+60,jti:'nonce_unique_test_'+(++seq)});
function token(p=payload(),h={alg:'EdDSA',typ:'JWT',kid:'current_key'},key=privateKey){
 const a=Buffer.from(JSON.stringify(h)).toString('base64url'),b=Buffer.from(JSON.stringify(p)).toString('base64url');
 return a+'.'+b+'.'+sign(null,Buffer.from(a+'.'+b),key).toString('base64url');
}
function setup(opts={}){
 const used=new Set();
 return createUpgradeServiceIdentityVerifier({issuer:'pitstop-internal',audience:'external-calc-upgrade',tenantId:tenant,clock:()=>now*1000,
 keyRegistry:async kid=>kid==='current_key'?{publicKey,active:true}:null,
 consumeNonce:async({jti})=>{if(used.has(jti))return false;used.add(jti);return true},...opts});
}
async function denied(v,t){await assert.rejects(()=>v({credential:t,requiredScope:scope}),e=>e.code==='SERVICE_IDENTITY_DENIED');}
test('valid signed Ed25519 service identity',async()=>{const r=await setup()({credential:token(),requiredScope:scope});assert.equal(r.tenant_id,tenant);assert.deepEqual(r.scopes,[scope]);});
test('rejects replayed jti',async()=>{const v=setup(),t=token();await v({credential:t,requiredScope:scope});await denied(v,t);});
test('rejects payload mutation',async()=>{const v=setup(),t=token().split('.');const p=JSON.parse(Buffer.from(t[1],'base64url'));p.tenant_id='efbd5c32-e2d4-4adc-964e-40ea0eae9731';t[1]=Buffer.from(JSON.stringify(p)).toString('base64url');await denied(v,t.join('.'));});
test('rejects unknown kid, algorithm and foreign signer',async()=>{const v=setup();await denied(v,token(payload(),{alg:'EdDSA',typ:'JWT',kid:'old_key'}));await denied(v,token(payload(),{alg:'none',typ:'JWT',kid:'current_key'}));await denied(v,token(payload(),undefined,other.privateKey));});
test('rejects wrong issuer, audience, tenant, principal',async()=>{const v=setup();for(const bad of [{iss:'other'},{aud:'other'},{tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'},{sub:'human'}])await denied(v,token({...payload(),...bad}));});
test('rejects excessive permissions',async()=>{const v=setup();for(const scopes of [[scope,'admin'],[],['admin']])await denied(v,token({...payload(),scopes}));});
test('rejects bad time claims',async()=>{const v=setup();for(const bad of [{exp:now-1},{iat:now+60},{nbf:now+60},{exp:now+400},{iat:'bad'}])await denied(v,token({...payload(),...bad}));});
test('rejects extra claims and header features',async()=>{const v=setup();await denied(v,token({...payload(),role:'owner'}));await denied(v,token(payload(),{alg:'EdDSA',typ:'JWT',kid:'current_key',crit:['b64']}));});
test('fails closed without dependencies or key',async()=>{assert.throws(()=>createUpgradeServiceIdentityVerifier(),/DEPENDENCIES/);await denied(setup({keyRegistry:async()=>null}),token());});
test('fails closed when nonce store fails',async()=>{await denied(setup({consumeNonce:async()=>{throw Error('db down')}}),token());});
test('rejects inactive public key',async()=>{await denied(setup({keyRegistry:async()=>({publicKey,active:false})}),token());});
test('rejects malformed and oversized credentials',async()=>{const v=setup();await denied(v,'x'.repeat(5000));await denied(v,'abc.def.ghi');await denied(v,token()+'.');});
