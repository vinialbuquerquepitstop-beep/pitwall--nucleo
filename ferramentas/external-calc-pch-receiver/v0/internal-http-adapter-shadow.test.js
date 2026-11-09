'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPchInternalAdapter}=require('./internal-http-adapter-shadow');
const {signRequestForTest,REQUEST_PATH,RECEIPT_PATH}=require('./m2m-auth-shadow');
const tenantId='11111111-1111-4111-8111-111111111111';
const secret=Buffer.alloc(32,0x33),keyId='key-g11',time=1794251000000;
const event={eventId:'event-G11',tenantId,providerScope:'meta-test',providerMessageId:'wamid-test',sourceKind:'META_PRIVATE',sourceId:'private-test',senderId:'sender-test',contentSha256:'a'.repeat(64),encryptedPayloadRef:'encrypted:blob-test',occurredAt:'2026-11-09T15:00:00Z'};
function fixtures(){
 const used=new Set(),data=new Map();
 const nonceLedger={async reserveOnce({tenantId:t,keyId:k,nonce}){const key=t+k+nonce;if(used.has(key))return false;used.add(key);return true}};
 const repository={async acceptAtomic(p){const old=data.get(p.idempotencyKey);if(old){if(JSON.stringify(old.p)!==JSON.stringify(p))return {conflict:true};return {record:old.record}}const record={state:'ACCEPTED',receiptId:'receipt-id',tenantId:p.tenantId,idempotencyKey:p.idempotencyKey,eventId:p.eventId,contentSha256:p.contentSha256};data.set(p.idempotencyKey,{p,record});return {record}},async findReceipt(p){const old=data.get(p.idempotencyKey);if(!old)return {record:null};if(JSON.stringify(old.p)!==JSON.stringify(p))return {conflict:true};return {record:old.record}}};
 const keyring={getKeyById:id=>id===keyId?{producer:'PCH',tenantId,enabled:true,permissions:['INGRESS_WRITE'],secret}:null};
 const handler=createPchInternalAdapter({keyring,nonceLedger,repository,nowMs:()=>time});
 const make=(path=REQUEST_PATH,value=event,nonce='a'.repeat(32))=>{const body=JSON.stringify(value);return {method:'POST',path,body,headers:signRequestForTest({keyId,tenantId,secret,body,nonce,timestamp:time,path})}};
 return {handler,make};
}
test('G11 signed HTTP accepts inbound without commercial processing',async()=>{const x=fixtures(),r=await x.handler(x.make());assert.equal(r.status,200);assert.equal(JSON.parse(r.body).status,'ACCEPTED_NOT_PROCESSED')});
test('G11 receipt lookup returns same durable receipt with a fresh nonce',async()=>{const x=fixtures();await x.handler(x.make());const r=await x.handler(x.make(RECEIPT_PATH,event,'b'.repeat(32)));assert.equal(r.status,200);assert.equal(JSON.parse(r.body).receiptId,'receipt-id')});
test('G11 exact replay is unauthorized',async()=>{const x=fixtures(),req=x.make();await x.handler(req);const r=await x.handler(req);assert.equal(r.status,401)});
test('G11 invalid signature is unauthorized',async()=>{const x=fixtures(),req=x.make();req.headers['x-pch-signature']='0'.repeat(64);assert.equal((await x.handler(req)).status,401)});
test('G11 unsigned event cannot bypass service authentication',async()=>{const x=fixtures(),req=x.make();req.headers={};assert.equal((await x.handler(req)).status,401)});
test('G11 tampered body denied',async()=>{const x=fixtures(),req=x.make();req.body+=' ';assert.equal((await x.handler(req)).status,401)});
test('G11 invalid JSON signed but invalid is rejected',async()=>{const x=fixtures(),req=x.make();const body='{bad';req.body=body;req.headers=signRequestForTest({keyId,tenantId,secret,body,timestamp:time,nonce:'c'.repeat(32)});assert.equal((await x.handler(req)).status,400)});
test('G11 event tenant mismatch rejected',async()=>{const x=fixtures(),req=x.make(REQUEST_PATH,{...event,tenantId:'22222222-2222-4222-8222-222222222222'});assert.equal((await x.handler(req)).status,422)});
test('G11 conflict cannot overwrite existing event',async()=>{const x=fixtures();await x.handler(x.make());const r=await x.handler(x.make(REQUEST_PATH,{...event,senderId:'changed'},'d'.repeat(32)));assert.equal(r.status,409)});
test('G11 receipt not found remains unconfirmed',async()=>{const x=fixtures(),r=await x.handler(x.make(RECEIPT_PATH,event,'e'.repeat(32)));assert.equal(JSON.parse(r.body).accepted,false)});
test('G11 duplicate casefold header is rejected',async()=>{const x=fixtures(),req=x.make();req.headers['X-PCH-KEY-ID']=keyId;assert.equal((await x.handler(req)).status,401)});
test('G11 oversized input rejected',async()=>{const x=fixtures(),req=x.make();req.body='a'.repeat(2*1024*1024+1);assert.equal((await x.handler(req)).status,413)});
test('G11 disabled dependency fails closed at construction',()=>assert.throws(()=>createPchInternalAdapter({}),/PCH_INTERNAL_DEPENDENCIES_REQUIRED/));
