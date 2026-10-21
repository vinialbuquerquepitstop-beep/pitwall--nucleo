#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createVS52PreviewService}=require('./service-preview-contract.cjs');
const txt='📚 Equipamentos fictícios\n📱 Quanta 256GB\n📋 Condição: Lacrado\n🎨 Azul — R$ 4.900,00';
const trusted={tenant_id:'tenant-a',trusted_input_ref:'ref-a',filename:'synthetic.txt',content:txt};
let calls=[],checks=0;
const resolver={async resolve(args){calls.push(args);return {...trusted}}};
const service=createVS52PreviewService({trustedInputResolver:resolver});
const ctx={tenant_id:'tenant-a',subject:'seller-a',can_execute_external_calc:true};
const check=async(label,fn)=>{await fn();checks++;console.log('VS52_OK '+checks+' '+label)};
await check('preview is NOT a real C01 candidate or authority',async()=>{
 const r=await service.preview({trusted_input_ref:'ref-a',context:ctx});
 assert.equal(r.contract_version,'external-calc-vs52-service-preview/v0');
 assert.equal(r.mode,'READ_ONLY_PREVIEW');
 assert.equal(r.candidates.length,1);
 assert.deepEqual(r.authorization,{accept:false,persist:false,quote:false,publish:false});
 assert.equal(r.persisted_count,0);assert.deepEqual(r.authorized_offers,[]);
 assert.equal(r.offer_id,null);assert.equal(r.analysis_id,null);
 assert.equal(r.domain_outcome,'REVIEW_REQUIRED');
 assert.equal(r.candidates[0].contract_version,null);
 assert.equal(r.candidates[0].reviewed_offer,null);
 assert.equal(r.candidates[0].offer_revision,null);
 assert.equal(r.candidates[0].review_evidence.field_sources.price[0],4);
 assert.deepEqual(calls[0],{trusted_input_ref:'ref-a',tenant_id:'tenant-a',actor_ref:'seller-a'});
});
await check('deterministic fingerprint with exact same context and trusted source',async()=>{
 const a=await service.preview({trusted_input_ref:'ref-a',context:ctx});
 const b=await service.preview({trusted_input_ref:'ref-a',context:ctx});
 assert.equal(a.preview_fingerprint,b.preview_fingerprint);
});
await check('unauthenticated and forbidden requests fail closed',async()=>{
 await assert.rejects(service.preview({trusted_input_ref:'ref-a'}),/context.tenant_id required/);
 await assert.rejects(service.preview({trusted_input_ref:'ref-a',context:{...ctx,can_execute_external_calc:false}}),/Forbidden/);
});
await check('tenant mismatch from resolver never returns offers',async()=>{
 await assert.rejects(service.preview({trusted_input_ref:'ref-a',context:{...ctx,tenant_id:'tenant-b'}}),/TRUSTED_INPUT_SCOPE_MISMATCH/);
});
await check('different ref from resolver never returns offers',async()=>{
 await assert.rejects(service.preview({trusted_input_ref:'ref-b',context:ctx}),/TRUSTED_INPUT_SCOPE_MISMATCH/);
});
await check('empty and absent source do not create C01 identity',async()=>{
 await assert.rejects(service.preview({trusted_input_ref:'',context:ctx}),/trusted_input_ref required/);
 const empty=createVS52PreviewService({trustedInputResolver:{async resolve(){return {...trusted,content:' '}}}});
 await assert.rejects(empty.preview({trusted_input_ref:'ref-a',context:ctx}),/TRUSTED_INPUT_SCOPE_MISMATCH/);
});
await check('cross-tenant fingerprint varies',async()=>{
 const second=createVS52PreviewService({trustedInputResolver:{
   async resolve(){return {...trusted,tenant_id:'tenant-b'}}
 }});
 const a=await service.preview({trusted_input_ref:'ref-a',context:ctx});
 const b=await second.preview({trusted_input_ref:'ref-a',context:{...ctx,tenant_id:'tenant-b'}});
 assert.notEqual(a.preview_fingerprint,b.preview_fingerprint);
});
await check('invalid provenance is not treated as authority',async()=>{
 const result=await service.preview({trusted_input_ref:'ref-a',context:ctx});
 assert(result.candidates.every(x=>x.authorization.accept_disabled));
 assert(result.candidates.every(x=>x.domain_outcome==='REVIEW_REQUIRED'));
 assert(result.candidates.every(x=>x.offer_id===null));
});
console.log('EXTERNAL_CALC_VS52_CONTRACT=PASS checks='+checks);
