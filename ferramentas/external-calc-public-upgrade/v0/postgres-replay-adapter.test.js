'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {createPostgresReplayConsumer,CLAIM_SQL}=require('./postgres-replay-adapter');
const now=1762710000000;
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const args={jti:'nonce_unique_test_A1',issuer:'pitstop-internal',subject:'pitstop-upgrade-service',tenantId:tenant,expiresAtMs:now+60000};
test('uses parameterized atomic SQL and hashed nonce',async()=>{
 let sql,params;
 const c=createPostgresReplayConsumer({clock:()=>now,pool:{query:async(q,p)=>{sql=q;params=p;return {rowCount:1,rows:[{nonce_digest:p[0]}]}}}});
 assert.equal(await c(args),true);assert.equal(sql,CLAIM_SQL);
 assert.match(sql,/ON CONFLICT \(nonce_digest\) DO NOTHING/);
 assert.match(params[0],/^[a-f0-9]{64}$/);assert.equal(params[1],tenant);
 assert(!sql.includes(args.jti));
});
test('one claim per nonce across 48 shared adapter instances (simulated store)',async()=>{
 const used=new Set(),pool={query:async(_sql,[key])=>{await Promise.resolve();if(used.has(key))return {rowCount:0,rows:[]};used.add(key);return {rowCount:1,rows:[{nonce_digest:key}]}}};
 const c=Array.from({length:48},()=>createPostgresReplayConsumer({pool,clock:()=>now}));
 const res=await Promise.all(c.map(x=>x(args)));assert.equal(res.filter(Boolean).length,1);
});
test('tenant changes nonce digest',async()=>{
 const keys=[];const c=createPostgresReplayConsumer({clock:()=>now,pool:{query:async(_sql,[key])=>{keys.push(key);return {rowCount:1,rows:[{nonce_digest:key}]}}}});
 await c(args);await c({...args,tenantId:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'});assert.notEqual(keys[0],keys[1]);
});
test('rejects malformed, expired inputs before DB call',async()=>{
 let calls=0;const c=createPostgresReplayConsumer({clock:()=>now,pool:{query:async()=>{calls++;return {rowCount:1,rows:[{}]}}}});
 assert.equal(await c({...args,tenantId:'bad'}),false);assert.equal(await c({...args,expiresAtMs:now}),false);assert.equal(calls,0);
});
test('fails closed without leaking backend errors',async()=>{
 for(const pool of [{query:async()=>{throw Error('PRIVATE_CONNECTION_STRING')}},{query:async()=>({rowCount:2,rows:[{},{}]})},{query:async()=>({rowCount:0,rows:[{}]})}]){
  const c=createPostgresReplayConsumer({clock:()=>now,pool});await assert.rejects(c(args),e=>e.code==='REPLAY_STORE_UNAVAILABLE'&&!e.message.includes('PRIVATE'));
 }
});
test('requires injected dedicated pool',()=>assert.throws(()=>createPostgresReplayConsumer(),/DEDICATED_PG_POOL_REQUIRED/));
