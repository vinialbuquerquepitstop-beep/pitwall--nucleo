import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import worker from './connect-hub-worker.mjs';
const base='https://example.invalid/meta/webhook';
const env={META_APP_SECRET:'only-a-synthetic-secret',META_VERIFY_TOKEN:'verify',PCH_STAGING_INGRESS_ENABLED:'true',PCH_SANDBOX_PHONE_NUMBER_ID:'synthetic_receiver',PCH_SANDBOX_ALLOWED_SENDER:'synthetic_sender',PCH_SANDBOX_PROVIDER_SCOPE:'synthetic_scope',PCH_STAGING_TENANT_BINDING:'pch_app_tenant_a'};
async function signed(body,options={}){const raw=JSON.stringify(body);const sig=crypto.createHmac('sha256',env.META_APP_SECRET).update(raw).digest('hex');return worker.fetch(new Request(base,{method:'POST',headers:{'x-hub-signature-256':'sha256='+sig},body:raw}),{...env,...options});}
const payload=(phone='synthetic_receiver',sender='synthetic_sender')=>({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:phone},messages:[{type:'text',id:'wamid.synthetic',from:sender,text:{body:'synthetic'}}]}}]}]});
let n=0;async function check(name,fn){await fn();console.log('PASS '+name);n++;}
await check('B01 disabled by default',async()=>assert.equal((await signed(payload(),{PCH_STAGING_INGRESS_ENABLED:undefined})).status,503));
await check('B02 reject unknown receiver',async()=>assert.equal((await signed(payload('other_receiver'))).status,503));
await check('B03 reject unknown sender',async()=>assert.equal((await signed(payload('synthetic_receiver','other_sender'))).status,503));
await check('B04 reject unsupported event',async()=>assert.equal((await signed({object:'other',entry:[]})).status,503));
await check('B05 no event not acknowledged',async()=>assert.equal((await signed({object:'whatsapp_business_account',entry:[]})).status,503));
await check('B06 malformed JSON rejected after valid signature',async()=>{const raw='{bad';const sig=crypto.createHmac('sha256',env.META_APP_SECRET).update(raw).digest('hex');const response=await worker.fetch(new Request(base,{method:'POST',headers:{'x-hub-signature-256':'sha256='+sig},body:raw}),env);assert.equal(response.status,400);});
console.log('SANDBOX GUARDS '+n+'/'+n);
