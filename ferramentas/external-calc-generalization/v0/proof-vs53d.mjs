#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {VERSION,sha,createTrustedOriginalSourceResolver}=require('./trusted-original-source.cjs');
const {createVS53PreviewApi,PATH}=require('./preview-api-shadow.cjs');
const content='📱 Quanta X 256GB\n📋 Condição: Lacrado\n🎨 Azul — R$ 4.500,00';
const source={source_contract_version:VERSION,tenant_id:'tenant-A',source_ref:'original-A',
 immutability:'APPEND_ONLY',source_type:'ORIGINAL_SUPPLIER_TEXT',
 state:'AVAILABLE',filename:'synthetic.txt',content,content_sha256:sha(content)};
let reads=0,checks=0;
const repository={async loadTenantOriginalSource({source_ref,tenant_id,actor_ref}){
 reads++;
 if(actor_ref!=='owner-A'||tenant_id!=='tenant-A'||source_ref!=='original-A')return null;
 return structuredClone(source);
}};
const resolver=createTrustedOriginalSourceResolver({repository});
const test=async(name,fn)=>{await fn();checks++;console.log('VS53D_OK '+checks+' '+name)};
await test('valid original text integrity and tenant scope',async()=>{
 const result=await resolver.resolve({trusted_input_ref:'original-A',tenant_id:'tenant-A',actor_ref:'owner-A'});
 assert.equal(result.source_sha256,sha(content));
 assert.equal(result.content,content);
});
await test('tenant isolation and missing source deny',async()=>{
 for(const args of [
  {trusted_input_ref:'original-A',tenant_id:'tenant-B',actor_ref:'owner-A'},
  {trusted_input_ref:'original-A',tenant_id:'tenant-A',actor_ref:'owner-B'},
  {trusted_input_ref:'missing',tenant_id:'tenant-A',actor_ref:'owner-A'}
 ])assert.equal(await resolver.resolve(args),null);
});
await test('rejected cross-tenant record even if repository leaks data',async()=>{
 const unsafe=createTrustedOriginalSourceResolver({repository:{
   async loadTenantOriginalSource(){return {...source,tenant_id:'tenant-B'}}
 }});
 await assert.rejects(unsafe.resolve({trusted_input_ref:'original-A',tenant_id:'tenant-A',actor_ref:'owner-A'}),/INTEGRITY_OR_SCOPE_FAIL/);
});
await test('modified bytes rejected even when metadata hash unchanged',async()=>{
 const unsafe=createTrustedOriginalSourceResolver({repository:{
  async loadTenantOriginalSource(){return {...source,content:content+'\\nR$ 1,00'}}
 }});
 await assert.rejects(unsafe.resolve({trusted_input_ref:'original-A',tenant_id:'tenant-A',actor_ref:'owner-A'}),/INTEGRITY_OR_SCOPE_FAIL/);
});
await test('derived snapshot or mutable source cannot masquerade as original',async()=>{
 for(const difference of [{source_type:'C01_REVIEW_SNAPSHOT'},{immutability:'MUTABLE'},
    {source_contract_version:'external-calc-c01-readonly/v1'},{state:'QUARANTINED'}]){
   const unsafe=createTrustedOriginalSourceResolver({repository:{
     async loadTenantOriginalSource(){return {...source,...difference}}
   }});
   await assert.rejects(unsafe.resolve({trusted_input_ref:'original-A',tenant_id:'tenant-A',actor_ref:'owner-A'}),/INTEGRITY_OR_SCOPE_FAIL/);
 }
});
await test('invalid and missing refs never reach repository',async()=>{
 const before=reads;
 await assert.rejects(resolver.resolve({trusted_input_ref:'../bad',tenant_id:'tenant-A',actor_ref:'owner-A'}),/INVALID_REF/);
 await assert.rejects(resolver.resolve({trusted_input_ref:'original-A',tenant_id:'',actor_ref:'owner-A'}),/INVALID_TENANT/);
 assert.equal(reads,before);
});
await test('existing VS5.3 route consumes trusted original without C01 authority',async()=>{
 const api=createVS53PreviewApi({
  authenticate:async()=>({tenant_id:'tenant-A',subject:'owner-A',can_execute_external_calc:true}),
  trustedInputResolver:resolver
 });
 const r=await api.handle({path:PATH,method:'POST',body:{trusted_input_ref:'original-A'}});
 assert.equal(r.status,200);
 assert.equal(r.body.preview.candidates.length,1);
 assert.equal(r.body.preview.source_hash,sha(content));
 assert.deepEqual(r.body.preview.authorization,{accept:false,persist:false,quote:false,publish:false});
 assert.equal(r.body.preview.persisted_count,0);
});
await test('unresolved actor cannot access even when tenant matches',async()=>{
 const api=createVS53PreviewApi({
  authenticate:async()=>({tenant_id:'tenant-A',subject:'owner-B',can_execute_external_calc:true}),
  trustedInputResolver:resolver
 });
 const r=await api.handle({path:PATH,method:'POST',body:{trusted_input_ref:'original-A'}});
 assert.equal(r.status,404);
});
console.log('EXTERNAL_CALC_VS53D_TRUSTED_ORIGINAL=PASS checks='+checks);
