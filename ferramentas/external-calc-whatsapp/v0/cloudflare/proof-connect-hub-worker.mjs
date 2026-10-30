import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import worker from './connect-hub-worker.mjs';
const env={META_VERIFY_TOKEN:'synthetic-token',META_APP_SECRET:'synthetic-secret'};
const url='https://example.invalid/meta/webhook';
let passed=0;async function check(name,fn){await fn();console.log('PASS '+name);passed++;}
await check('W01 unrelated URL 404',async()=>assert.equal((await worker.fetch(new Request('https://example.invalid/'),env)).status,404));
await check('W02 challenge verified',async()=>{const r=await worker.fetch(new Request(url+'?hub.mode=subscribe&hub.verify_token=synthetic-token&hub.challenge=12345'),env);assert.equal(r.status,200);assert.equal(await r.text(),'12345');});
await check('W03 wrong verify token rejected',async()=>assert.equal((await worker.fetch(new Request(url+'?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345'),env)).status,403));
await check('W04 invalid signature rejected',async()=>assert.equal((await worker.fetch(new Request(url,{method:'POST',body:'{}',headers:{'x-hub-signature-256':'sha256='+'0'.repeat(64)}}),env)).status,401));
await check('W05 valid signature does not falsely acknowledge persistence',async()=>{const body=JSON.stringify({object:'whatsapp_business_account'});const sig='sha256='+crypto.createHmac('sha256',env.META_APP_SECRET).update(body).digest('hex');assert.equal((await worker.fetch(new Request(url,{method:'POST',body,headers:{'x-hub-signature-256':sig}}),env)).status,503);});
await check('W06 oversized body rejected',async()=>assert.equal((await worker.fetch(new Request(url,{method:'POST',body:'X'.repeat(256*1024+1)}),env)).status,413));
console.log('CONNECT HUB WORKER SANDBOX-SAFE PASS '+passed+'/'+passed);
