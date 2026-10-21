#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {runIsolationMatrix}=require('./staging-rls-readonly-matrix.cjs');
const cfg={tenant_a:'tenant-A',tenant_b:'tenant-B',source_a:'original-A',
 source_b:'original-B',absent_ref:'missing-source'};
function row(ref,tenant){return {source_ref:ref,tenant_id:tenant,
 source_contract_version:'external-calc-original-supplier-source/v0',
 source_type:'ORIGINAL_SUPPLIER_TEXT',immutability:'APPEND_ONLY',
 state:'AVAILABLE',content_sha256:'sha256:'+'a'.repeat(64)}}
const base=(arg)=>{
 if(arg.actor==='A'&&arg.source_ref===cfg.source_a)return {status:'FOUND',record:row(cfg.source_a,cfg.tenant_a)};
 if(arg.actor==='B'&&arg.source_ref===cfg.source_b)return {status:'FOUND',record:row(cfg.source_b,cfg.tenant_b)};
 return {status:'NOT_FOUND'};
};
let checks=0;
async function test(name,fn){await fn();console.log('VS53G_OK '+(++checks)+' '+name)}
const run=probe=>runIsolationMatrix({probe,config:cfg});
async function rejectsVector(probe,id,reason){
 const report=await run(probe);
 assert.equal(report.decision,'FAIL_CLOSED');
 assert.equal(report.real_rls_verified,false);
 assert.equal(report.production_gate,'NO_GO');
 assert.equal(report.cases.find(v=>v.id===id)?.reason,reason);
}
await test('8 read-only A/B own foreign anon missing probes pass in memory only',async()=>{
 const result=await run(base);
 assert.equal(result.passed,8);assert.equal(result.total,8);
 assert.equal(result.decision,'SIMULATED_MATRIX_PASS_REAL_RLS_NOT_RUN');
 assert.equal(result.real_rls_verified,false);
 assert.equal(result.sql_policies_inspected,false);
 assert.equal(result.physical_immutability_verified,false);
});
await test('foreign tenant visible must fail closed',async()=>{
 await rejectsVector(q=>q.actor==='A'&&q.source_ref===cfg.source_b?
  {status:'FOUND',record:row(cfg.source_b,cfg.tenant_b)}:base(q),
  'A_FOREIGN','CROSS_TENANT_OR_DENIAL_LEAK');
});
await test('anonymous source visible must fail closed',async()=>{
 await rejectsVector(q=>q.actor==='ANON'&&q.source_ref===cfg.source_a?
  {status:'FOUND',record:row(cfg.source_a,cfg.tenant_a)}:base(q),
  'ANON_A','CROSS_TENANT_OR_DENIAL_LEAK');
});
await test('own source wrong tenant rejected',async()=>{
 await rejectsVector(q=>q.actor==='A'&&q.source_ref===cfg.source_a?
  {status:'FOUND',record:row(cfg.source_a,cfg.tenant_b)}:base(q),
  'A_OWN','FOUND_ROW_SCOPE_INTEGRITY_OR_DATA_LEAK');
});
await test('own source malformed digest rejected',async()=>{
 await rejectsVector(q=>q.actor==='A'&&q.source_ref===cfg.source_a?
  {status:'FOUND',record:{...row(cfg.source_a,cfg.tenant_a),content_sha256:'bad'}}:base(q),
  'A_OWN','FOUND_ROW_SCOPE_INTEGRITY_OR_DATA_LEAK');
});
await test('own source not found is a failure, not proof of isolation',async()=>{
 await rejectsVector(q=>q.actor==='A'&&q.source_ref===cfg.source_a?
  {status:'NOT_FOUND'}:base(q),'A_OWN','EXPECTED_OWN_SOURCE_MISSING_OR_AMBIGUOUS');
});
await test('transport errors never count as denied rows',async()=>{
 await rejectsVector(q=>q.actor==='B'&&q.source_ref===cfg.source_a?
  Promise.reject(Error('network')):base(q),'B_FOREIGN','TRANSPORT_ERROR_NOT_AUTHORIZATION_DENIAL');
});
await test('same-tenant config and overlapping refs rejected',async()=>{
 await assert.rejects(runIsolationMatrix({probe:base,config:{...cfg,tenant_b:cfg.tenant_a}}),/MATRIX_CONFIG_INVALID/);
 await assert.rejects(runIsolationMatrix({probe:base,config:{...cfg,source_b:cfg.source_a}}),/MATRIX_CONFIG_INVALID/);
});
await test('plaintext or byte payload never leaves metadata-only probe',async()=>{
 await rejectsVector(q=>q.actor==='B'&&q.source_ref===cfg.source_b?
  {status:'FOUND',record:{...row(cfg.source_b,cfg.tenant_b),content:'supplier-private'}}:base(q),
  'B_OWN','FOUND_ROW_SCOPE_INTEGRITY_OR_DATA_LEAK');
});
await test('denial cannot secretly include record',async()=>{
 await rejectsVector(q=>q.actor==='ANON'&&q.source_ref===cfg.source_b?
  {status:'FORBIDDEN',record:row(cfg.source_b,cfg.tenant_b)}:base(q),
  'ANON_B','CROSS_TENANT_OR_DENIAL_LEAK');
});
await test('mutable or quarantined source cannot be accepted as valid own row',async()=>{
 await rejectsVector(q=>q.actor==='A'&&q.source_ref===cfg.source_a?
  {status:'FOUND',record:{...row(cfg.source_a,cfg.tenant_a),state:'QUARANTINED',immutability:'MUTABLE'}}:base(q),
  'A_OWN','FOUND_ROW_SCOPE_INTEGRITY_OR_DATA_LEAK');
});
await test('probe receives no client-supplied tenant field or write operation',async()=>{
 let calls=0;
 const result=await run(q=>{calls++;assert.deepEqual(Object.keys(q).sort(),['actor','source_ref']);return base(q)});
 assert.equal(calls,8);assert.equal(result.passed,8);
 assert.equal(result.writes_by_harness,0);
});
console.log('EXTERNAL_CALC_VS53G_STAGING_MATRIX=PASS checks='+checks+' live_rls=NOT_RUN');
