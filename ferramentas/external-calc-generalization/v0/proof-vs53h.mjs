#!/usr/bin/env node
// VS5.3h tests use unsigned FAKE JWT payloads and injected fetch only.
// No secret, network, account or Supabase project is contacted.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createGuardedStagingReadProbe}=require('./guarded-staging-read-transport.cjs');
const {runIsolationMatrix}=require('./staging-rls-readonly-matrix.cjs');
const project='stagingprojectabcdef';
const cfg={tenant_a:'tenant-A',tenant_b:'tenant-B',source_a:'original-A',
 source_b:'original-B',absent_ref:'missing-source'};
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const fakeJwt=(sub,overrides={})=>{
 const head=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
 const payload=Buffer.from(JSON.stringify({sub,role:'authenticated',
  iss:'https://'+project+'.supabase.co/auth/v1',exp:2000000000,...overrides})).toString('base64url');
 return head+'.'+payload+'.signature';
};
const row=(ref,tenant)=>({tenant_id:tenant,source_ref:ref,
 source_contract_version:'external-calc-original-supplier-source/v0',
 source_type:'ORIGINAL_SUPPLIER_TEXT',immutability:'APPEND_ONLY',
 state:'AVAILABLE',content_sha256:'sha256:'+'a'.repeat(64)});
const base={project_ref:project,approved_staging_ref:project,
 table_name:'extcalc_original_source_probe_v0',
 publishable_key:'sb_publishable_FAKE_ONLY_NOT_A_KEY',
 jwt_a:fakeJwt(A),jwt_b:fakeJwt(B),nowSeconds:1900000000};
let checks=0;
const test=async(name,fn)=>{await fn();console.log('VS53H_OK '+(++checks)+' '+name)};
const mock=(handler)=>async(url,options)=>{
 assert.equal(options.method,'GET');
 assert.equal(options.redirect,'error');
 assert.equal(options.cache,'no-store');
 assert.equal(options.body,undefined);
 const uri=new URL(url);
 assert.equal(uri.hostname,project+'.supabase.co');
 assert.equal(uri.pathname,'/rest/v1/extcalc_original_source_probe_v0');
 assert.equal(uri.searchParams.get('select'),'tenant_id,source_ref,source_contract_version,source_type,immutability,state,content_sha256');
 assert.equal(uri.searchParams.get('limit'),'2');
 assert.deepEqual([...uri.searchParams.keys()].sort(),['limit','select','source_ref']);
 assert.equal(options.headers.apikey,base.publishable_key);
 const actor=options.headers.authorization===('Bearer '+base.jwt_a)?'A':
   options.headers.authorization===('Bearer '+base.jwt_b)?'B':'ANON';
 if(actor==='ANON')assert.equal(options.headers.authorization,undefined);
 return handler({actor,ref:uri.searchParams.get('source_ref')?.slice(3),uri,options});
};
const response=(status,rows)=>({status,async json(){return rows}});
const normal=({actor,ref})=>{
 if(actor==='A'&&ref===cfg.source_a)return response(200,[row(cfg.source_a,cfg.tenant_a)]);
 if(actor==='B'&&ref===cfg.source_b)return response(200,[row(cfg.source_b,cfg.tenant_b)]);
 return response(200,[]);
};
const create=(handler=normal,overrides={})=>createGuardedStagingReadProbe({
 ...base,fetchImpl:mock(handler),...overrides});
const run=probe=>runIsolationMatrix({probe,config:cfg});
await test('8 isolated GET-only synthetic HTTP reads use same A/B matrix',async()=>{
 const p=create();
 const report=await run(p.probe);
 assert.equal(report.passed,8);
 assert.equal(report.real_rls_verified,false);
 assert.equal(report.decision,'SIMULATED_MATRIX_PASS_REAL_RLS_NOT_RUN');
 assert.equal(p.production_runtime_registered,false);
});
await test('known production project always rejected',async()=>{
 assert.throws(()=>create(null,{project_ref:'unjzpyexgtbcmjfgcqrx',
   approved_staging_ref:'unjzpyexgtbcmjfgcqrx'}),/VS53H_STAGING_TRANSPORT_DENIED/);
});
await test('approval ref must match project',async()=>{
 assert.throws(()=>create(null,{approved_staging_ref:'otherprojectabcdefg'}),/DENIED/);
});
await test('table cannot contain URL paths or SQL syntax',async()=>{
 for(const table_name of ['public.table','extcalc_original_source_probe_v0?select=*','../private','other']){
  assert.throws(()=>create(null,{table_name}),/DENIED/);
 }
});
await test('service role token refused even if other claims present',async()=>{
 assert.throws(()=>create(null,{jwt_a:fakeJwt(A,{role:'service_role'})}),/DENIED/);
});
await test('missing or non-publishable API key refused',async()=>{
 assert.throws(()=>create(null,{publishable_key:'secret'}),/DENIED/);
});
await test('expired and wrong-issuer token refused',async()=>{
 assert.throws(()=>create(null,{jwt_a:fakeJwt(A,{exp:100})}),/DENIED/);
 assert.throws(()=>create(null,{jwt_a:fakeJwt(A,{iss:'https://evil.example/auth/v1'})}),/DENIED/);
});
await test('same actor subject cannot impersonate two tenants',async()=>{
 assert.throws(()=>create(null,{jwt_b:fakeJwt(A)}),/DENIED/);
});
await test('read-only probe refuses invalid actor and reference before network',async()=>{
 const p=create();
 await assert.rejects(p.probe({actor:'SERVICE_ROLE',source_ref:'original-A'}),/DENIED/);
 await assert.rejects(p.probe({actor:'A',source_ref:'../bad'}),/DENIED/);
});
await test('redirect is not followed and fails the matrix',async()=>{
 const p=create(()=>{throw Error('redirect')});
 const result=await run(p.probe);
 assert.equal(result.passed,0);
 assert.equal(result.decision,'FAIL_CLOSED');
});
await test('500 HTTP errors never become a valid forbidden response',async()=>{
 const p=create(()=>response(500,[]));
 const report=await run(p.probe);
 assert.equal(report.passed,0);
});
await test('cross-tenant result is rejected by matrix even from real HTTP shape',async()=>{
 const p=create(x=>x.actor==='A'&&x.ref===cfg.source_b?
  response(200,[row(cfg.source_b,cfg.tenant_b)]):normal(x));
 const result=await run(p.probe);
 assert.equal(result.cases.find(c=>c.id==='A_FOREIGN').pass,false);
});
await test('extra raw bytes or content is never admitted into metadata projection',async()=>{
 const p=create(x=>x.actor==='A'&&x.ref===cfg.source_a?
  response(200,[{...row(cfg.source_a,cfg.tenant_a),content_bytes:'sensitive'}]):normal(x));
 const result=await run(p.probe);
 assert.equal(result.cases.find(c=>c.id==='A_OWN').pass,false);
});
await test('multiple returned rows fail closed',async()=>{
 const p=create(x=>x.actor==='A'&&x.ref===cfg.source_a?
  response(200,[row(cfg.source_a,cfg.tenant_a),row(cfg.source_a,cfg.tenant_a)]):normal(x));
 const result=await run(p.probe);
 assert.equal(result.cases.find(c=>c.id==='A_OWN').pass,false);
});
await test('own-source missing is not misrepresented as RLS PASS',async()=>{
 const p=create(()=>response(200,[]));
 const result=await run(p.probe);
 assert.equal(result.decision,'FAIL_CLOSED');
});
console.log('EXTERNAL_CALC_VS53H_GUARDED_TRANSPORT=PASS checks='+checks+' network=MOCK_ONLY real_rls=NOT_RUN');
