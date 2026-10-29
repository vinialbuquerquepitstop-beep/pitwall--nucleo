'use strict';
/** Concurrent duplicate-delivery contract tests against pg-compatible mock.
 * NOT a substitute for two real PostgreSQL connections and tenant RLS E2E.
 */
const assert=require('node:assert/strict');
const {acceptIngress}=require('./ingress-transaction-v0.cjs');
const root={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',provider_scope_id:'synthetic_scope',phone_number_id:'synthetic_receiver',provider_message_id:'wamid.synthetic.concurrent',tenant_binding_ref:'synthetic_tenant_a',routing_policy_version:'policy-v0',route:'SUPPLIER_EXTERNAL_CALC',original_sha256:'b'.repeat(64)};
let inserts=0,deliveries=0,commits=0,rollbacks=0,locks=0;
const state={event:null,outbox:null};
let queue=Promise.resolve();
function pool(){
 return {async connect(){
  return {async query(sql,values){
   if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'){if(sql==='COMMIT')commits++;if(sql==='ROLLBACK')rollbacks++;return {rows:[]};}
   if(sql.startsWith('INSERT INTO ingress_events')){
    const perform=async()=>{await new Promise(resolve=>setImmediate(resolve));if(state.event)return {rows:[]};
     state.event={id:values[0],tenant_binding_ref:values[4],routing_policy_version:values[5],route:values[6],original_sha256:values[7]};inserts++;return {rows:[{id:values[0]}]};};
    const p=queue.then(perform);queue=p.then(()=>{},()=>{});return p;
   }
   if(sql.startsWith('SELECT id')){locks++;return {rows:[state.event]};}
   if(sql.startsWith('INSERT INTO ingress_outbox')){if(state.outbox)throw Error('OUTBOX_DUPLICATE');state.outbox=values[0];deliveries++;return {rows:[]};}
   throw Error('UNEXPECTED_QUERY');
  },release(){}};
 }};
}
async function main(){
 const p=pool();
 const results=await Promise.all(Array.from({length:12},(_,i)=>acceptIngress(p,{...root,id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(i+1).padStart(12,'0')}`})));
 assert.equal(results.filter(x=>x.status==='INSERTED').length,1);
 assert.equal(results.filter(x=>x.status==='DUPLICATE').length,11);
 assert.equal(inserts,1);assert.equal(deliveries,1);assert.equal(commits,12);assert.equal(rollbacks,0);assert.equal(locks,11);
 console.log('PASS 12 overlapping simulated deliveries: one inbox + one outbox');
 console.log('PASS 11 replays acknowledged with stable original inbox id');
 console.log('PASS all calls committed; no duplicate outbox');
 await assert.rejects(()=>acceptIngress(p,{...root,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',original_sha256:'c'.repeat(64)}),/IDENTITY_CONTENT_CONFLICT/);
 assert.equal(rollbacks,1);assert.equal(inserts,1);assert.equal(deliveries,1);
 console.log('PASS divergent replay rejected and rolled back');
 console.log('WM034B CONCURRENT MODEL PASS 4/4 (MOCK ONLY)');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
