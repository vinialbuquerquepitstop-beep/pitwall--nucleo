'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createPostgresPchReceiverRepository}=require('./postgres-receiver-shadow');
const tenantId='11111111-1111-4111-8111-111111111111';
const p={tenantId,producer:'PCH',idempotencyKey:'idempotency-1',eventId:'event-1',providerScope:'scope',providerMessageId:'message-1',sourceKind:'META_PRIVATE',sourceId:'source-1',senderId:'sender-1',contentSha256:'a'.repeat(64),encryptedPayloadRef:'cipher-1',occurredAt:'2026-11-09T15:00:00Z'};
function poolFixture({failTenantBinding=false}={}){
 const log=[],state={row:null,released:0,connected:0};
 const pool={connect:async()=>{state.connected++;return {release:()=>{state.released++},query:async(sql,args=[])=>{
  log.push({sql,args});
  if(sql.includes('set_config')){
    if(failTenantBinding)throw Error('TENANT_BINDING_FAILED');
    return {rows:[{set_config:args[0]}],rowCount:1};
  }
  if(sql.trimStart().startsWith('INSERT')){
    if(!state.row){
      const d=JSON.parse(args[4]);
      state.row={tenant_id:d.tenantId,idempotency_key:d.idempotencyKey,event_id:d.eventId,content_sha256:d.contentSha256,event_snapshot:d,state:'ACCEPTED',receipt_id:'receipt-persisted'};
    }
    return {rows:[],rowCount:1};
  }
  if(sql.trimStart().startsWith('SELECT')){
    const same=state.row&&state.row.tenant_id===args[0]&&state.row.idempotency_key===args[1];
    return {rows:same?[state.row]:[],rowCount:same?1:0};
  }
  return {rows:[],rowCount:0};
 }};}};
 return {pool,log,state};
}
test('G8 accept transaction binds tenant before any inbox SQL',async()=>{
 const x=poolFixture(),r=createPostgresPchReceiverRepository({pool:x.pool});
 await r.acceptAtomic(p);
 assert.equal(x.log[0].sql,'BEGIN');
 assert.match(x.log[1].sql,/set_config/);
 assert.deepEqual(x.log[1].args,[tenantId]);
 assert.match(x.log[2].sql,/INSERT INTO extcalc_pch_shadow/);
 assert.equal(x.log.at(-1).sql,'COMMIT');
 assert.equal(x.state.released,1);
});
test('G8 lookup is read-only and tenant bound',async()=>{
 const x=poolFixture(),r=createPostgresPchReceiverRepository({pool:x.pool});
 assert.deepEqual(await r.findReceipt(p),{record:null});
 assert.equal(x.log[0].sql,'BEGIN READ ONLY');
 assert.match(x.log[1].sql,/set_config/);
 assert.match(x.log[2].sql,/SELECT tenant_id/);
 assert.equal(x.log.at(-1).sql,'COMMIT');
 assert.equal(x.log.filter(a=>/INSERT|UPDATE|DELETE/.test(a.sql)).length,0);
});
test('G8 failure to bind tenant rolls back and never touches inbox',async()=>{
 const x=poolFixture({failTenantBinding:true});
 await assert.rejects(createPostgresPchReceiverRepository({pool:x.pool}).acceptAtomic(p),/TENANT_BINDING_FAILED/);
 assert.deepEqual(x.log.map(a=>a.sql==='BEGIN'?'BEGIN':a.sql.includes('set_config')?'BIND':a.sql),['BEGIN','BIND','ROLLBACK']);
 assert.equal(x.state.released,1);
});
test('G8 invalid UUID fails before opening DB connection',async()=>{
 const x=poolFixture();
 await assert.rejects(createPostgresPchReceiverRepository({pool:x.pool}).acceptAtomic({...p,tenantId:'tenant-A'}),/PCH_TENANT_UUID_REQUIRED/);
 assert.equal(x.state.connected,0);
});
test('G8 replay with changed immutable metadata is rejected',async()=>{
 const x=poolFixture(),r=createPostgresPchReceiverRepository({pool:x.pool});
 await r.acceptAtomic(p);
 const result=await r.acceptAtomic({...p,senderId:'unauthorized-change'});
 assert.equal(result.conflict,true);
 assert.equal(x.log.at(-1).sql,'ROLLBACK');
});
test('G8 lookup cannot confirm receipt belonging to another tenant',async()=>{
 const x=poolFixture(),r=createPostgresPchReceiverRepository({pool:x.pool});
 await r.acceptAtomic(p);
 const found=await r.findReceipt({...p,tenantId:'22222222-2222-4222-8222-222222222222'});
 assert.equal(found.record,null);
});
