'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {createReplayConsumer}=require('./replay-store');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1',now=1762710000000;
const args={jti:'nonce_unique_test_A1',issuer:'pitstop-internal',subject:'pitstop-upgrade-service',tenantId:tenant,expiresAtMs:now+60000};
test('atomic insert allows exactly one of 32 concurrent claims across consumers',async()=>{
 const shared=new Set();const atomicInsert=async({digest})=>{await Promise.resolve();if(shared.has(digest))return false;shared.add(digest);return true;};
 const consumers=Array.from({length:32},()=>createReplayConsumer({atomicInsert,clock:()=>now}));const results=await Promise.all(consumers.map(c=>c(args)));
 assert.equal(results.filter(Boolean).length,1);assert.equal(shared.size,1);
});
test('deduplication key includes issuer and tenant; digest never contains raw jti',async()=>{
 const digests=[];const c=createReplayConsumer({atomicInsert:async({digest})=>{digests.push(digest);return true},clock:()=>now});
 await c(args);await c({...args,issuer:'another-issuer'});await c({...args,tenantId:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'});
 assert.equal(new Set(digests).size,3);assert(digests.every(s=>s.length===64&&!s.includes('nonce')));
});
test('deny expired, oversized, malformed and subject-mismatch claims',async()=>{
 let called=0;const c=createReplayConsumer({atomicInsert:async()=>{called++;return true},clock:()=>now});
 for(const bad of [{expiresAtMs:now},{expiresAtMs:now+400000},{jti:'short'},{subject:'human'},{tenantId:'x'}])assert.equal(await c({...args,...bad}),false);
 assert.equal(called,0);
});
test('throws closed on unavailable store or non-boolean result',async()=>{
 for(const atomicInsert of [async()=>{throw Error('db offline')},async()=>null]){
  const c=createReplayConsumer({atomicInsert,clock:()=>now});await assert.rejects(()=>c(args),e=>e.code==='REPLAY_STORE_UNAVAILABLE');
 }
});
test('does not accept missing atomic implementation',()=>assert.throws(()=>createReplayConsumer(),/ATOMIC_INSERT_REQUIRED/));
