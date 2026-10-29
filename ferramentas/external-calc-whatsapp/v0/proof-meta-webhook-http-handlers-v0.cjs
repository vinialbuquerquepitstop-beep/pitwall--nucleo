'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {handlerFactory}=require('./meta-webhook-http-handlers-v0.cjs');
const SECRET='synthetic-local-secret',TOKEN='synthetic-verify-token',PHONE='phone-test-1',SENDER='551199991111';
const allowlist={[PHONE]:{[SENDER]:{tenant_id:'tenant-test',supplier_id:'supplier-test'}}};
function make(){return handlerFactory({verifyToken:TOKEN,appSecret:SECRET,allowlist,allowedPhoneIds:[PHONE]});}
function payload({sender=SENDER,type='text',phone=PHONE}={}){
return {object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:phone},messages:[{id:'wamid.synthetic001',from:sender,type,timestamp:'1793224800',text:{body:'Synthetic list, not a customer message'}}]}}]}]};
}
function call(p,{tamper=false}={}){const rawBody=Buffer.from(JSON.stringify(p));const signature='sha256='+crypto.createHmac('sha256',SECRET).update(tamper?Buffer.from('other'):rawBody).digest('hex');return make().post({rawBody,signature});}
let passed=0;
function test(label,fn){fn();passed++;console.log('PASS '+label);}
test('H01 matching verification challenge',()=>assert.deepEqual(make().get({'hub.mode':'subscribe','hub.verify_token':TOKEN,'hub.challenge':'abc123'}),{status:200,body:'abc123'}));
test('H02 wrong verification token',()=>assert.equal(make().get({'hub.mode':'subscribe','hub.verify_token':'wrong','hub.challenge':'abc123'}).status,403));
test('H03 authorized supplier yields retryable 503 until durable queue exists',()=>assert.equal(call(payload()).status,503));
test('H04 unknown sender not emitted to supplier sink',()=>assert.equal(call(payload({sender:'551188880000'})).status,200));
test('H05 wrong phone ID not emitted to supplier sink',()=>assert.equal(call(payload({phone:'unmapped'})).status,200));
test('H06 altered bytes rejected',()=>assert.equal(call(payload(),{tamper:true}).status,401));
test('H07 missing signature rejected',()=>assert.equal(make().post({rawBody:Buffer.from(JSON.stringify(payload()))}).status,401));
test('H08 oversized payload rejected',()=>assert.equal(make().post({rawBody:Buffer.alloc(256*1024+1),signature:'x'}).status,413));
test('H09 status-only notification ignored',()=>{const p=payload();p.entry[0].changes[0].value={messaging_product:'whatsapp',statuses:[{id:'wamid.x'}]};assert.equal(call(p).status,200);});
test('H10 unsupported media ignored',()=>assert.equal(call(payload({type:'image'})).status,200));
test('H11 no secrets configured fails closed',()=>assert.throws(()=>handlerFactory({}),/MISSING_SERVER_CONFIGURATION/));
test('H12 handler never returns original text in HTTP body',()=>{for(const r of [call(payload()),call(payload({sender:'551188880000'}))])assert.equal(r.body,'');});
console.log('META03 WEBHOOK EXACT-SOURCE SYNTHETIC PASS '+passed+'/'+passed);
