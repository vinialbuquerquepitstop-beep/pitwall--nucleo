'use strict';
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {createPostgresPchReceiverRepository}=require('./postgres-receiver-shadow');
if(process.env.PCH_DISPOSABLE_PG17!=='true')throw Error('PCH_DISPOSABLE_PG17_REQUIRED');
const pool=new Pool({host:process.env.PCH_PG_HOST||'/tmp',port:Number(process.env.PCH_PG_PORT||55439),user:'pch_test_login',database:'postgres',max:16});
const repo=createPostgresPchReceiverRepository({pool});
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
let passed=0;async function check(name,fn){try{await fn();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e.code||'',e.message);process.exitCode=1}}
const payload=(id,tenantId=A,extra={})=>({tenantId,producer:'PCH',idempotencyKey:tenantId+':scope:'+id,eventId:id,providerScope:'scope',providerMessageId:'wamid.'+id,sourceKind:'META_PRIVATE',sourceId:'private-1',senderId:'sender-1',contentSha256:'a'.repeat(64),encryptedPayloadRef:'encrypted:ref-1',occurredAt:'2026-11-09T15:00:00Z',...extra});
(async()=>{
 await check('PG17 insert committed and receipt UUID',async()=>{const r=await repo.acceptAtomic(payload('one'));assert.equal(r.record.tenantId,A);assert.match(r.record.receiptId,/^[0-9a-f-]{36}$/)});
 await check('PG17 duplicate returns SAME receipt',async()=>{const a=await repo.acceptAtomic(payload('one'));const b=await repo.acceptAtomic(payload('one'));assert.equal(a.record.receiptId,b.record.receiptId)});
 await check('PG17 immutable conflict rejected',async()=>{const r=await repo.acceptAtomic(payload('one',A,{senderId:'intruder'}));assert.equal(r.conflict,true)});
 await check('PG17 receipt lookup exact event',async()=>{const r=await repo.findReceipt(payload('one'));assert.equal(r.record.eventId,'one')});
 await check('PG17 cross tenant lookup hidden',async()=>{const p=payload('one',B,{idempotencyKey:payload('one').idempotencyKey});const r=await repo.findReceipt(p);assert.equal(r.record,null)});
 await check('PG17 no tenant setting reads zero',async()=>{const c=await pool.connect();try{const r=await c.query('select count(*)::int as n from extcalc_pch_shadow.inbox');assert.equal(r.rows[0].n,0)}finally{c.release()}});
 await check('PG17 role cannot UPDATE/DELETE',async()=>{const c=await pool.connect();try{await assert.rejects(c.query("UPDATE extcalc_pch_shadow.inbox SET state='ACCEPTED'"),/permission denied/);await assert.rejects(c.query('DELETE FROM extcalc_pch_shadow.inbox'),/permission denied/)}finally{c.release()}});
 await check('PG17 parallel identical 12 requests all same receipt',async()=>{const rs=await Promise.all(Array.from({length:12},()=>repo.acceptAtomic(payload('parallel-ok'))));assert.equal(new Set(rs.map(r=>r.record.receiptId)).size,1)});
 await check('PG17 parallel conflicting 8 requests exactly one identity accepted',async()=>{const rs=await Promise.all(Array.from({length:8},(_,i)=>repo.acceptAtomic(payload('parallel-conflict',A,{senderId:'different-'+i}))));assert.equal(rs.filter(r=>r.conflict===true).length,7);assert.equal(rs.filter(r=>r.record).length,1)});
 await check('PG17 rollback before commit leaves no receipt',async()=>{const c=await pool.connect();const p=payload('rollback-only');try{await c.query('BEGIN');await c.query("select set_config('app.pch_tenant_id',$1,true)",[A]);await c.query("INSERT INTO extcalc_pch_shadow.inbox (tenant_id,idempotency_key,event_id,content_sha256,event_snapshot) VALUES ($1,$2,$3,$4,$5::jsonb)",[p.tenantId,p.idempotencyKey,p.eventId,p.contentSha256,JSON.stringify(p)]);await c.query('ROLLBACK')}finally{c.release()}const found=await repo.findReceipt(p);assert.equal(found.record,null)});
 await check('PG17 tenant context cleared between pooled transactions',async()=>{const a=await repo.acceptAtomic(payload('tenant-switch',A));const b=await repo.acceptAtomic(payload('tenant-switch',B));assert.notEqual(a.record.receiptId,b.record.receiptId);const c=await pool.connect();try{const r=await c.query('select count(*)::int as n from extcalc_pch_shadow.inbox');assert.equal(r.rows[0].n,0)}finally{c.release()}});
 await check('PG17 restricted role lacks BYPASSRLS',async()=>{const r=await pool.query("SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user");assert.equal(r.rows[0].rolbypassrls,false)});
 await pool.end();console.log('TOTAL',passed,'FAIL',process.exitCode===1?'YES':'NO');if(process.exitCode)process.exit(process.exitCode);
})().catch(async e=>{console.error(e);await pool.end();process.exit(1)});

