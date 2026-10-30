import assert from 'node:assert/strict';
import {durableAck} from './durable-ack-boundary.mjs';
const e={id:'synthetic'};
let n=0;async function test(name,args,expected){const r=await durableAck(args);assert.deepEqual(r,expected);console.log('PASS '+name);n++;}
await test('A01 reject unauthenticated',{event:e,authorized:true,accept:async()=>({status:'INSERTED'})},{status:401,code:'UNAUTHENTICATED'});
await test('A02 reject unauthorized',{authenticated:true,event:e,accept:async()=>({status:'INSERTED'})},{status:403,code:'NOT_AUTHORIZED'});
await test('A03 reject unavailable storage',{authenticated:true,authorized:true,event:e},{status:503,code:'STORAGE_UNAVAILABLE'});
await test('A04 accept durable insert',{authenticated:true,authorized:true,event:e,accept:async()=>({status:'INSERTED'})},{status:200,code:'INSERTED'});
await test('A05 acknowledge durable replay',{authenticated:true,authorized:true,event:e,accept:async()=>({status:'DUPLICATE'})},{status:200,code:'DUPLICATE'});
await test('A06 reject incomplete storage result',{authenticated:true,authorized:true,event:e,accept:async()=>({status:'PENDING'})},{status:503,code:'NO_DURABLE_COMMIT'});
await test('A07 fail closed on storage error',{authenticated:true,authorized:true,event:e,accept:async()=>{throw Error('database secret');}},{status:503,code:'DURABLE_WRITE_FAILED'});
console.log('DURABLE ACK CONTRACT PASS '+n+'/'+n);
