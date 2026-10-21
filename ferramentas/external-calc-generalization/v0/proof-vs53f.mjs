#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {VERSION,createTrustedOriginalSourceResolver}=require('./trusted-original-source.cjs');
const {createTrustedOriginalByteRepository,originalHash}=require('./trusted-original-byte-adapter.cjs');
const tenant='tenant-A', actor='owner-A', ref='original-A';
const text='\uFEFF📱 Aurora X 256GB\r\nAzul — R$ 4.500,00\r\n';
const bytes=Buffer.from(text,'utf8');
const row={source_contract_version:VERSION,source_type:'ORIGINAL_SUPPLIER_TEXT',
 immutability:'APPEND_ONLY',state:'AVAILABLE',tenant_id:tenant,source_ref:ref,
 filename:'fixture.txt',content_sha256:originalHash(bytes),content_bytes:bytes};
const args={trusted_input_ref:ref,tenant_id:tenant,actor_ref:actor};
let checks=0;
const test=async(name,fn)=>{await fn();console.log('VS53F_OK '+(++checks)+' '+name)};
function resolverFor(factory,{maxBytes=4096}={}){
 const reader={async loadTenantOriginalBytes(ctx){return factory(ctx)}};
 return createTrustedOriginalSourceResolver({repository:createTrustedOriginalByteRepository({reader,maxBytes})});
}
await test('UTF-8 exact bytes preserved including BOM CRLF emoji and trailing newline',async()=>{
 const output=await resolverFor(()=>({...row,content_bytes:Buffer.from(bytes)})).resolve(args);
 assert.equal(output.content,text);
 assert.equal(output.source_sha256,originalHash(bytes));
 assert.deepEqual(Buffer.from(output.content,'utf8'),bytes);
});
await test('corrupted digest fails closed',async()=>{
 await assert.rejects(resolverFor(()=>({...row,content_sha256:'sha256:'+'f'.repeat(64)})).resolve(args),/VS53F_ORIGINAL_BYTES/);
});
await test('truncation while retaining stored hash fails closed',async()=>{
 await assert.rejects(resolverFor(()=>({...row,content_bytes:bytes.subarray(0,-1)})).resolve(args),/VS53F_ORIGINAL_BYTES/);
});
await test('newline normalization with recalculated digest is distinct original',async()=>{
 const changed=Buffer.from(text.replaceAll('\r\n','\n'),'utf8');
 assert.notEqual(originalHash(bytes),originalHash(changed));
 await assert.rejects(resolverFor(()=>({...row,content_bytes:changed})).resolve(args),/VS53F_ORIGINAL_BYTES/);
});
await test('ill-formed UTF-8 with matching attacker digest is rejected',async()=>{
 const invalid=Buffer.from([0xc3,0x28]);
 await assert.rejects(resolverFor(()=>({...row,content_bytes:invalid,content_sha256:originalHash(invalid)})).resolve(args),/VS53F_ORIGINAL_BYTES/);
});
await test('NUL with matching attacker digest is rejected',async()=>{
 const nul=Buffer.from('A\u0000B','utf8');
 await assert.rejects(resolverFor(()=>({...row,content_bytes:nul,content_sha256:originalHash(nul)})).resolve(args),/VS53F_ORIGINAL_BYTES/);
});
await test('oversized payload denied without silent truncation',async()=>{
 await assert.rejects(resolverFor(()=>({...row}),{maxBytes:bytes.length-1}).resolve(args),/VS53F_ORIGINAL_BYTES/);
});
await test('unbounded byte adapter cannot be constructed',async()=>{
 assert.throws(()=>createTrustedOriginalByteRepository({reader:{loadTenantOriginalBytes:async()=>row}}),/EXPLICIT_BYTES_LIMIT/);
});
await test('tenant leak and forbidden actor denied by scoped reader',async()=>{
 const scoped=resolverFor(({tenant_id,actor_ref})=>tenant_id===tenant&&actor_ref===actor?row:null);
 assert.equal(await scoped.resolve({...args,tenant_id:'tenant-B'}),null);
 assert.equal(await scoped.resolve({...args,actor_ref:'owner-B'}),null);
 await assert.rejects(resolverFor(()=>({...row,tenant_id:'tenant-B'})).resolve(args),/VS53F_ORIGINAL_BYTES/);
});
await test('derived, quarantined, revoked and mutable sources rejected',async()=>{
 for(const overrides of [{source_type:'C01_REVIEW_SNAPSHOT'},{state:'QUARANTINED'},
 {state:'REVOKED'},{immutability:'MUTABLE'},{source_contract_version:'legacy'}]){
  await assert.rejects(resolverFor(()=>({...row,...overrides})).resolve(args),/VS53F_ORIGINAL_BYTES/);
 }
});
await test('row carrying conflicting decoded content rejected',async()=>{
 await assert.rejects(resolverFor(()=>({...row,content:'not-original'})).resolve(args),/VS53F_ORIGINAL_BYTES/);
});
await test('missing source does not become a synthetic source',async()=>{
 assert.equal(await resolverFor(()=>null).resolve(args),null);
});
console.log('EXTERNAL_CALC_VS53F_BYTE_BOUNDARY=PASS checks='+checks);
