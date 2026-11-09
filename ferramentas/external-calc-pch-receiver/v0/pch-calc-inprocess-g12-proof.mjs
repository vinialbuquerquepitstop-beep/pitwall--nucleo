import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createPchCalcTransport} from '/tmp/pch-g12/pch-calc-transport-shadow.mjs';
const require=createRequire(import.meta.url);
const {createPchInternalAdapter}=require('/vercel/sandbox/ferramentas/external-calc-pch-receiver/v0/internal-http-adapter-shadow.js');
const tenantId='11111111-1111-4111-8111-111111111111';
const keyId='pch-real-integrated',secret=new Uint8Array(32).fill(41);
const now=1794252000000;
let seq=0,missAck=true,inboxCommits=0,lookupCalls=0;
const records=new Map(),nonces=new Set();
const keyring={getKeyById:id=>id===keyId?{enabled:true,producer:'PCH',tenantId,permissions:['INGRESS_WRITE'],secret:Buffer.from(secret)}:null};
const nonceLedger={async reserveOnce({keyId,tenantId,nonce}){const key=tenantId+keyId+nonce;if(nonces.has(key))return false;nonces.add(key);return true}};
const repository={
 async acceptAtomic(p){const old=records.get(p.idempotencyKey);if(old){if(JSON.stringify(old.p)!==JSON.stringify(p))return {conflict:true};return {record:old.record}}
 const record={state:'ACCEPTED',tenantId:p.tenantId,idempotencyKey:p.idempotencyKey,eventId:p.eventId,contentSha256:p.contentSha256,receiptId:'receipt-'+(++inboxCommits)};
 records.set(p.idempotencyKey,{p,record});return {record}},
 async findReceipt(p){lookupCalls++;const old=records.get(p.idempotencyKey);if(!old)return {record:null};return JSON.stringify(old.p)===JSON.stringify(p)?{record:old.record}:{conflict:true}}
};
const adapter=createPchInternalAdapter({keyring,nonceLedger,repository,nowMs:()=>now});
const fetchImpl=async(url,request)=>{
 const path=new URL(url).pathname;
 const response=await adapter({method:request.method,path,headers:request.headers,body:request.body});
 // Simulate reverse-proxy disconnect AFTER durable receiver acceptance.
 if(path.endsWith('/inbox')&&missAck){missAck=false;throw Error('LOST_RESPONSE_AFTER_COMMIT')}
 return {status:response.status,text:async()=>response.body};
};
const client=createPchCalcTransport({baseUrl:'https://calc.example.com',tenantId,keyId,secret,now:()=>now,randomBytes:()=>new Uint8Array(16).fill(++seq),fetchImpl});
const event={eventId:'event-e2e-1',tenantId,providerScope:'meta-private',providerMessageId:'wamid.e2e',sourceKind:'META_PRIVATE',sourceId:'source-e2e',senderId:'sender-e2e',contentSha256:'a'.repeat(64),encryptedPayloadRef:'cipher-ref',occurredAt:'2026-11-09T15:00:00Z'};
let first=await client.dispatchAndReconcile(event);assert.equal(first.decision,'RECONCILE');assert.equal(inboxCommits,1);console.log('PASS lost send ACK after persistence cannot confirm');
let restored=await client.reconcile(event);assert.equal(restored.decision,'CONFIRM');assert.equal(restored.receipt.receiptId,'receipt-1');assert.equal(inboxCommits,1);console.log('PASS read-only signed lookup reconciles committed receipt without repeat send');
let duplicate=await client.dispatchAndReconcile(event);assert.equal(duplicate.decision,'CONFIRM');assert.equal(inboxCommits,1);console.log('PASS independent nonce resend remains idempotent and non-commercial');
let altered=await client.dispatchAndReconcile({...event,senderId:'different'});assert.equal(altered.decision,'HOLD');assert.equal(inboxCommits,1);console.log('PASS immutable identity mismatch HOLD');
assert.equal(lookupCalls,2);console.log('PASS exactly two successful receipt lookups');
console.log('TOTAL 5 PASS 0 FAIL');

