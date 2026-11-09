'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {acceptIngress,reconcileIngress}=require('./receiver-shadow');
const {createPostgresPchReceiverRepository}=require('./postgres-receiver-shadow');
const tenantId='11111111-1111-4111-8111-111111111111';
const actor={authenticated:true,producer:'PCH',tenantId,permissions:['INGRESS_WRITE']};
const event={eventId:'e-1',tenantId,providerScope:'scope',providerMessageId:'m1',sourceKind:'META_PRIVATE',sourceId:'s1',senderId:'sender1',contentSha256:'a'.repeat(64),encryptedPayloadRef:'encrypted:1',occurredAt:'2026-11-09T15:00:00Z'};
function memory(){
 let row=null, released=0;
 const pool={connect:async()=>({query:async(sql,params)=>{
  const cmd=sql.trim().split(/\s/)[0];
  if(cmd==='INSERT' && !row){
   const p=JSON.parse(params[4]);
   row={tenant_id:p.tenantId,idempotency_key:p.idempotencyKey,event_id:p.eventId,content_sha256:p.contentSha256,event_snapshot:p,receipt_id:'receipt-1',state:'ACCEPTED'};
  }
  if(cmd==='SELECT'){
   const matching=row&&row.tenant_id===params[0]&&row.idempotency_key===params[1];
   return {rowCount:matching?1:0,rows:matching?[row]:[]};
  }
  return {rowCount:1,rows:[]};
 },release:()=>{released++}})};
 return {repo:createPostgresPchReceiverRepository({pool}),getReleased:()=>released};
}
test('G7 reconciles previously committed event with exact durable receipt',async()=>{
 const {repo}=memory();
 const saved=await acceptIngress({actor,event,repository:repo});
 const found=await reconcileIngress({actor,event,repository:repo});
 assert.deepEqual(found,saved);
});
test('G7 lookup without accepted event returns not-found, not confirmed',async()=>{
 const {repo}=memory();
 const found=await reconcileIngress({actor,event,repository:repo});
 assert.equal(found.accepted,false);
 assert.equal(found.status,'NOT_FOUND_RECONCILE_REQUIRED');
});
test('G7 receipt lookup rejects altered sender with same key',async()=>{
 const {repo}=memory();await acceptIngress({actor,event,repository:repo});
 await assert.rejects(reconcileIngress({actor,event:{...event,senderId:'attacker'},repository:repo}),{code:'INGRESS_IDEMPOTENCY_CONFLICT'});
});
test('G7 unauthorized actor cannot lookup tenant receipt',async()=>{
 const {repo}=memory();await acceptIngress({actor,event,repository:repo});
 await assert.rejects(reconcileIngress({actor:{...actor,authenticated:false},event,repository:repo}),{code:'UNAUTHORIZED_PRODUCER'});
});
test('G7 other tenant cannot lookup existing event',async()=>{
 const {repo}=memory();await acceptIngress({actor,event,repository:repo});
 const other='22222222-2222-4222-8222-222222222222';
 const found=await reconcileIngress({actor:{...actor,tenantId:other},event:{...event,tenantId:other},repository:repo});
 assert.equal(found.accepted,false);
});
test('G7 rejects invalid UUID tenant',async()=>{
 const {repo}=memory();
 await assert.rejects(acceptIngress({actor:{...actor,tenantId:'tenant-A'},event:{...event,tenantId:'tenant-A'},repository:repo}),{code:'UNAUTHORIZED_PRODUCER'});
});
test('G7 rejects lookup without repository',async()=>{
 await assert.rejects(reconcileIngress({actor,event,repository:{}}),{code:'DURABLE_LOOKUP_REQUIRED'});
});
test('G7 releases pooled connection after lookup',async()=>{
 const m=memory();await reconcileIngress({actor,event,repository:m.repo});assert.equal(m.getReleased(),1);
});
