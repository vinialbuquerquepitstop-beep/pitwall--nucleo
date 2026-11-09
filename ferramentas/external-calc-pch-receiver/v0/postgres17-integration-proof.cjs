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
 await check('PG17 no tenant setting reads zero',async()=>{const ...[truncated]