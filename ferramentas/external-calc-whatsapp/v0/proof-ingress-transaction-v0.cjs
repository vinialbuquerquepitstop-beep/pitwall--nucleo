'use strict';
const assert=require('node:assert/strict');
const {acceptIngress}=require('./ingress-transaction-v0.cjs');
const sample={id:'11111111-1111-4111-8111-111111111111',provider_scope_id:'scope-test',phone_number_id:'phone-test',provider_message_id:'wamid.test',tenant_binding_ref:'tenant-verified',routing_policy_version:'v1',route:'SUPPLIER_EXTERNAL_CALC',original_sha256:'a'.repeat(64),encrypted_original:{ciphertext:Buffer.alloc(32,7),iv:Buffer.alloc(12,8)}};
function mock({existing=false,failOutbox=false,conflict=false}={}){
 const calls=[];let released=false;
 const client={async query(sql,args){calls.push(sql.trim().split(/\s+/).slice(0,3).join(' '));if(sql.startsWith('INSERT INTO ingress_events'))return {rows:existing?[]:[{id:sample.id}]};if(sql.startsWith('SELECT id')){assert.equal(sql.includes('FOR UPDATE'),false,'ingest role lacks UPDATE grant');return {rows:[{...sample,...(conflict?{original_sha256:'b'.repeat(64)}:{})}]};}if(sql.startsWith('INSERT INTO ingress_outbox')&&failOutbox)throw Error('DB_DOWN');return {rows:[]};},release(){released=true;}};
 return {pool:{async connect(){return client;}},calls,get released(){return released;}};
}
let n=0;async function check(label,fn){await fn();console.log('PASS '+label);n++;}
(async()=>{
 await check('A01 insert inbox and outbox in one transaction',async()=>{const m=mock();assert.equal((await acceptIngress(m.pool,sample)).status,'INSERTED');assert.equal(m.calls.filter(x=>x.startsWith('INSERT INTO')).length,3);assert.ok(m.calls.includes('COMMIT'));assert.equal(m.released,true);});
 await check('A02 duplicate identity no second outbox',async()=>{const m=mock({existing:true});assert.equal((await acceptIngress(m.pool,sample)).status,'DUPLICATE');assert.equal(m.calls.filter(x=>x.startsWith('INSERT INTO ingress_outbox')).length,0);});
 await check('A03 conflict changed original hash rolls back',async()=>{const m=mock({existing:true,conflict:true});await assert.rejects(()=>acceptIngress(m.pool,sample),/IDENTITY_CONTENT_CONFLICT/);assert.ok(m.calls.includes('ROLLBACK'));});
 await check('A04 outbox failure rolls back transaction',async()=>{const m=mock({failOutbox:true});await assert.rejects(()=>acceptIngress(m.pool,sample),/DB_DOWN/);assert.ok(m.calls.includes('ROLLBACK'));assert.ok(!m.calls.includes('COMMIT'));});
 await check('A05 ignored event has no outbox',async()=>{const m=mock();await acceptIngress(m.pool,{...sample,route:'IGNORE'});assert.equal(m.calls.filter(x=>x.startsWith('INSERT INTO ingress_outbox')).length,0);});
 await check('A06 invalid event fails before database',async()=>{const m=mock();await assert.rejects(()=>acceptIngress(m.pool,{...sample,route:'INVALID'}),/INVALID_AUTHORIZED_EVENT/);assert.equal(m.calls.length,0);});
 console.log('WM034B TRANSACTION MOCK PASS '+n+'/'+n);
})().catch(e=>{console.error(e);process.exitCode=1;});
