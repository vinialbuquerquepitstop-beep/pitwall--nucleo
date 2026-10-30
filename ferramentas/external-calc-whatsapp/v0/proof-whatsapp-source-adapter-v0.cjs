'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {parseInbound, verifyChallenge, verifySignature} = require('./whatsapp-source-adapter-v0.cjs');
const SECRET = 'synthetic-test-secret';
const allowlist = {'phone-123': {'5511990001111': {tenant_id:'tenant-A',supplier_id:'supplier-1'}}};
function body({sender='5511990001111',msgId='wamid.001',text='iPhone 16 128GB R$ 3900',type='text', phone='phone-123'}={}) {
 return {object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{
  messaging_product:'whatsapp',metadata:{phone_number_id:phone},
  messages:[{from:sender,id:msgId,timestamp:'1793224800',type,text:{body:text}}]
 }}]}]};
}
function sign(buf){return 'sha256='+crypto.createHmac('sha256',SECRET).update(buf).digest('hex');}
function run(payload,opts={}) {const rawBody=Buffer.from(JSON.stringify(payload));return parseInbound({
 rawBody,signature:opts.signature ?? sign(rawBody),appSecret:SECRET,allowlist:opts.allowlist ?? allowlist
});}
let count=0;
function check(name,fn){fn();count++;process.stdout.write('PASS '+name+'
');}
check('authorized supplier text yields transport record only',()=>{
 const r=run(body());assert.equal(r.events.length,1);assert.equal(r.events[0].state,'TRANSPORT_VALIDATED_REVIEW_ONLY');
 assert.equal(r.events[0].supplier_id,'supplier-1');assert.equal(r.events[0].original_text,'iPhone 16 128GB R$ 3900');
 assert.equal('offer_id' in r.events[0],false);
});
check('client is ignored with no text leakage',()=>{const r=run(body({sender:'5511888888888'}));assert.deepEqual(r.events,[]);});
check('cross-tenant spoofing in payload ignored',()=>{
 const p=body();p.entry[0].changes[0].value.messages[0].tenant_id='tenant-B';
 assert.equal(run(p).events[0].tenant_id,'tenant-A');
});
check('wrong phone id denies source',()=>{assert.equal(run(body({phone:'foreign-phone'})).events.length,0);});
check('media unsupported',()=>{assert.equal(run(body({type:'image'})).events.length,0);});
check('status update ignored',()=>{
 const p=body();p.entry[0].changes[0].value={messaging_product:'whatsapp',statuses:[{id:'test'}]};
 assert.equal(run(p).events.length,0);
});
check('duplicate delivery within same payload ignored',()=>{
 const p=body();p.entry[0].changes[0].value.messages.push({...p.entry[0].changes[0].value.messages[0]});
 assert.equal(run(p).events.length,1);
});
check('same text different message id different keys',()=>{
 const a=run(body({msgId:'wamid.001'})).events[0];
 const b=run(body({msgId:'wamid.002'})).events[0];
 assert.notEqual(a.source_event_key,b.source_event_key);assert.equal(a.original_sha256,b.original_sha256);
});
check('encoded Meta message id accepted',()=>{
 const r=run(body({msgId:'wamid.HBgMNTUxMTk5MDAwMTExMRUCABIYFjNFQkM=/+'}));
 assert.equal(r.events.length,1);
});
check('invalid signature denied',()=>{assert.equal(run(body(),{signature:'sha256='+('0'.repeat(64))}).code,'INVALID_SIGNATURE');});
check('tampered bytes rejected',()=>{
 const original=Buffer.from(JSON.stringify(body()));
 const changed=Buffer.from(JSON.stringify(body({text:'R$ 1'})));
 assert.equal(parseInbound({rawBody:changed,signature:sign(original),appSecret:SECRET,allowlist}).code,'INVALID_SIGNATURE');
});
check('malformed json after valid signature rejected',()=>{
 const rawBody=Buffer.from('{bad');
 assert.equal(parseInbound({rawBody,signature:sign(rawBody),appSecret:SECRET,allowlist}).code,'INVALID_JSON');
});
check('too large payload rejected before signature',()=>{
 const rawBody=Buffer.alloc(256*1024+1);
 assert.equal(parseInbound({rawBody,signature:'no',appSecret:SECRET,allowlist}).code,'INVALID_BODY_SIZE');
});
check('GET challenge allowed only with matching token',()=>{
 assert.equal(verifyChallenge({'hub.mode':'subscribe','hub.verify_token':'token','hub.challenge':'123'},'token'),'123');
 assert.equal(verifyChallenge({'hub.mode':'subscribe','hub.verify_token':'wrong','hub.challenge':'123'},'token'),null);
});
check('signature helper uses exact raw bytes',()=>{
 const raw=Buffer.from('abc');assert.equal(verifySignature(raw,sign(raw),SECRET),true);
 assert.equal(verifySignature(Buffer.from('abcd'),sign(raw),SECRET),false);
});
console.log('WM01 PURE ADAPTER PASS '+count+'/'+count);
