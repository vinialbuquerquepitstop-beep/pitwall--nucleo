#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createVS53PreviewApi,PATH}=require('./preview-api-shadow.cjs');
const source='📚 Catálogo sintético\n📱 NovaX 256GB\n📋 Condição: Lacrado\n🎨 Azul — R$ 4.990,00';
let authCalls=0,resolveCalls=0,writeCalls=0,checks=0;
const identities={
 good:{tenant_id:'tenant-a',subject:'user-1',can_execute_external_calc:true},
 other:{tenant_id:'tenant-b',subject:'user-2',can_execute_external_calc:true},
 denied:{tenant_id:'tenant-a',subject:'user-3',can_execute_external_calc:false}
};
const authenticate=async req=>{authCalls++;return identities[req.authMode]??null};
const resolve=async({tenant_id,actor_ref,trusted_input_ref})=>{
 resolveCalls++;
 if(trusted_input_ref!=='source-a'||tenant_id!=='tenant-a'||actor_ref!=='user-1')return null;
 return {tenant_id:'tenant-a',trusted_input_ref:'source-a',content:source,filename:'synthetic.txt'};
};
const api=createVS53PreviewApi({authenticate,trustedInputResolver:{resolve}});
const req=(body,authMode='good',path=PATH,method='POST')=>({path,method,body,authMode});
async function check(name,fn){await fn();checks++;console.log('VS53_OK '+checks+' '+name)}
await check('only exact path and POST, no accidental operational routing',async()=>{
 const before=authCalls,lookups=resolveCalls;
 assert.equal((await api.handle(req({},'good','/api/external-calc/v0/execute'))).status,404);
 assert.equal((await api.handle(req({},'good',PATH,'GET'))).status,404);
 assert.equal(authCalls,before);assert.equal(resolveCalls,lookups);
});
await check('unauthenticated request denied before source or body inspection',async()=>{
 const before=resolveCalls;const r=await api.handle(req({content:source},'missing'));
 assert.equal(r.status,401);assert.equal(resolveCalls,before);
});
await check('forbidden role never reaches resolver',async()=>{
 const before=resolveCalls;const r=await api.handle(req({trusted_input_ref:'source-a'},'denied'));
 assert.equal(r.status,403);assert.equal(resolveCalls,before);
});
await check('trusted authenticated preview returns non-authoritative material',async()=>{
 const r=await api.handle(req({trusted_input_ref:'source-a'}));
 assert.equal(r.status,200);
 assert.equal(r.body.preview.contract_version,'external-calc-vs52-service-preview/v0');
 assert.equal(r.body.preview.candidates.length,1);
 assert.equal(r.body.preview.candidates[0].interpreted_offer.price.amount_minor,499000);
 assert.equal(r.body.preview.analysis_id,null);
 assert.deepEqual(r.body.preview.authorized_offers,[]);
 assert.deepEqual(r.body.preview.authorization,{accept:false,persist:false,quote:false,publish:false});
 assert.equal(r.body.preview.persisted_count,0);
 assert.equal(r.headers['cache-control'],'no-store');
});
await check('spoofed tenant or actor rejected by strict body allowlist',async()=>{
 const before=resolveCalls;
 for(const body of [
   {trusted_input_ref:'source-a',tenant_id:'tenant-b'},
   {trusted_input_ref:'source-a',actor_id:'other'},
   {trusted_input_ref:'source-a',content:source},
   {trusted_input_ref:'source-a',write:true},
   {trusted_input_ref:'source-a',decision:'ACCEPT'},
   {trusted_input_ref:'source-a',offer_revision:1}
 ]){const r=await api.handle(req(body));assert.equal(r.status,400,JSON.stringify(body))}
 assert.equal(resolveCalls,before);
});
await check('tenant and source mismatches indistinguishable 404',async()=>{
 const a=await api.handle(req({trusted_input_ref:'source-a'},'other'));
 const b=await api.handle(req({trusted_input_ref:'nonexistent'},'good'));
 assert.equal(a.status,404);assert.equal(b.status,404);
 assert.deepEqual(a.body,b.body);
});
await check('malformed body and oversized payload rejected',async()=>{
 assert.equal((await api.handle(req('{invalid'))).status,400);
 assert.equal((await api.handle(req('x'.repeat(2050)))).status,400);
 assert.equal((await api.handle(req({trusted_input_ref:'../../escape'}))).status,400);
});
await check('deterministic trusted replay without write dependencies',async()=>{
 const a=(await api.handle(req({trusted_input_ref:'source-a'}))).body.preview;
 const b=(await api.handle(req({trusted_input_ref:'source-a'}))).body.preview;
 assert.equal(a.preview_fingerprint,b.preview_fingerprint);
 assert.equal(writeCalls,0);
});
await check('preview parser exception returns generic error',async()=>{
 const broken=createVS53PreviewApi({authenticate,trustedInputResolver:{async resolve(){
   throw Error('sensitive pg credential should not leak');
 }}});
 const r=await broken.handle(req({trusted_input_ref:'source-a'}));
 assert.equal(r.status,422);
 assert(!JSON.stringify(r).includes('credential'));
});
console.log('EXTERNAL_CALC_VS53_AUTH_PREVIEW=PASS checks='+checks);
