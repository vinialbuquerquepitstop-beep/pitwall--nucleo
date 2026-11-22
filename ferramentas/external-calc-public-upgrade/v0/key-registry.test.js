'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{generateKeyPairSync}=require('node:crypto');
const {createActiveKeyRegistry}=require('./key-registry');
const {publicKey}=generateKeyPairSync('ed25519');const now=1762710000000;
const record={kid:'key_2026_11',publicKey,state:'active',revoked:false,valid_from_ms:now-1000,valid_until_ms:now+60000};
function loader(p={}){return createActiveKeyRegistry({clock:()=>now,loadRecord:async()=>({...record,...p})});}
test('accepts active and retiring Ed25519 public keys',async()=>{assert((await loader()('key_2026_11')).active);assert((await loader({state:'retiring'})('key_2026_11')).active);});
test('rejects revoked, future, expired, inactive and mismatched keys',async()=>{for(const patch of [{revoked:true},{valid_from_ms:now+1},{valid_until_ms:now},{state:'disabled'},{kid:'other'}])assert.equal(await loader(patch)('key_2026_11'),null);});
test('does not disclose key loader errors',async()=>{const k=createActiveKeyRegistry({clock:()=>now,loadRecord:async()=>{throw Error('SECRET_DB_FAILURE')}});await assert.rejects(()=>k('key_2026_11'),e=>e.code==='KEY_REGISTRY_UNAVAILABLE'&&!e.message.includes('SECRET'));});
test('rejects invalid kid without database call',async()=>{let called=0;const k=createActiveKeyRegistry({clock:()=>now,loadRecord:async()=>{called++;return record}});assert.equal(await k('bad kid'),null);assert.equal(called,0);assert.equal(await k('unknown'),null);});
