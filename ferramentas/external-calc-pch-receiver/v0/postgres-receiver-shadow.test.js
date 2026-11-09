'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPostgresPchReceiverRepository}=require('./postgres-receiver-shadow');
const prepared={tenantId:'tenant-A',producer:'PCH',idempotencyKey:'tenant-A:scope:e1',eventId:'e1',providerScope:'scope',providerMessageId:'m1',sourceKind:'META_PRIVATE',sourceId:'s1',senderId:'sender1',contentSha256:'a'.repeat(64),encryptedPayloadRef:'encrypted:1',occurredAt:'2026-11-09T15:00:00Z'};
function mockPool({stored=null,failAt=null}={}){
 const queries=[], state={stored, released:0};
 return {queries,state,connect:async()=>({query:async(sql,values)=>{
  const command=sql.trim().split(/\s/)[0];
  queries.push(command);
  if(failAt===command)throw Error('INJECTED_'+command);
  if(command==='INSERT'&&!state.stored){const p=JSON.parse(values[4]);state.stored={tenant_id:p.tenantId,idempotency_key:p.idempotencyKey,event_id:p.eventId,content_sha256:p.contentSha256,event_snapshot:p,receipt_id:'receipt-1',state:'ACCEPTED'};}
  if(command==='SELECT')return {rowCount:state.stored?1:0,rows:state.stored?[state.stored]:[]};
  return {rowCount:1,rows:[]};
 },release:()=>{state.released++}})};
}
test('G6 inserts then verifies under lock and commits',async()=>{
 const pool=mockPool();const repo=createPostgresPchReceiverRepository({pool});const r=await repo.acceptAtomic(prepared);
 assert.equal(r.record.receiptId,'receipt-1');assert.deepEqual(pool.queries,['BEGIN','INSERT','SELECT','COMMIT']);assert.equal(pool.state.released,1);
});
test('G6 same identity reuses durable receipt',async()=>{
 const pool=mockPool();const repo=createPostgresPchReceiverRepository({pool});const r1=await repo.acceptAtomic(prepared);const r2=await repo.acceptAtomic(prepared);
 assert.equal(r1.record.receiptId,r2.record.receiptId);
});
test('G6 changed metadata rejects and rolls back',async()=>{
 const pool=mockPool();const repo=createPostgresPchReceiverRepository({pool});await repo.acceptAtomic(prepared);
 const result=await repo.acceptAtomic({...prepared,senderId:'different'});
 assert.equal(result.conflict,true);assert.deepEqual(pool.queries.slice(-4),['BEGIN','INSERT','SELECT','ROLLBACK']);
});
test('G6 INSERT failure rolls back and releases connection',async()=>{
 const pool=mockPool({failAt:'INSERT'});await assert.rejects(createPostgresPchReceiverRepository({pool}).acceptAtomic(prepared),/INJECTED_INSERT/);
 assert.deepEqual(pool.queries,['BEGIN','INSERT','ROLLBACK']);assert.equal(pool.state.released,1);
});
test('G6 SELECT failure rolls back and releases connection',async()=>{
 const pool=mockPool({failAt:'SELECT'});await assert.rejects(createPostgresPchReceiverRepository({pool}).acceptAtomic(prepared),/INJECTED_SELECT/);
 assert.deepEqual(pool.queries,['BEGIN','INSERT','SELECT','ROLLBACK']);assert.equal(pool.state.released,1);
});
test('G6 COMMIT uncertainty does not emit receipt',async()=>{
 const pool=mockPool({failAt:'COMMIT'});await assert.rejects(createPostgresPchReceiverRepository({pool}).acceptAtomic(prepared),/INJECTED_COMMIT/);
 assert.equal(pool.queries.at(-1),'ROLLBACK');assert.equal(pool.state.released,1);
});
test('G6 cannot use repository without scoped pool',()=>assert.throws(()=>createPostgresPchReceiverRepository({}),/PCH_POOL_REQUIRED/));
