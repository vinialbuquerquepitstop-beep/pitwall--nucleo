#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createVS53bIdentityBridge}=require('./identity-bridge-shadow.cjs');
const {PATH}=require('./preview-api-shadow.cjs');
const records={
 'owner-token':{id:'user-1',tenant:'tenant-A',role:'dono',active:true},
 'beta-token':{id:'user-2',tenant:'tenant-B',role:'validador',active:true},
 'seller-token':{id:'user-3',tenant:'tenant-A',role:'vendedor',active:true},
 'disabled-token':{id:'user-4',tenant:'tenant-A',role:'dono',active:false}
};
let authFetch=0,profileFetch=0,resolverCalls=0,nonGet=0,checks=0;
function response(status,data){return {ok:status>=200&&status<300,status,
 async text(){return JSON.stringify(data)}}}
async function fetchImpl(url,opts={}){
 if((opts.method||'GET').toUpperCase()!=='GET'){nonGet++;throw Error('WRITE_BLOCKED')}
 const token=String(opts.headers?.authorization||'').replace(/^Bearer\s+/i,'');
 const user=records[token];
 if(url.endsWith('/auth/v1/user')){
   authFetch++;
   return user?response(200,{id:user.id}):response(401,{message:'unauthorized'});
 }
 if(url.includes('/rest/v1/app_usuario?')){
   profileFetch++;
   return user?response(200,[{tenant_id:user.tenant,papel:user.role,ativo:user.active}]):response(403,[]);
 }
 throw Error('UNEXPECTED_DESTINATION');
}
const sources=new Map([
 ['source-A',{tenant_id:'tenant-A',trusted_input_ref:'source-A',content:'📚 Loja teste\n📱 Quanta 256GB\n📋 Condição: Lacrado\n🎨 Azul — R$ 4.900,00'}],
 ['source-B',{tenant_id:'tenant-B',trusted_input_ref:'source-B',content:'📚 Loja teste\n📱 Lumia 128GB\n📋 Condição: CPO\n🎨 Branco — R$ 2.900,00'}]
]);
const resolver={async resolve({tenant_id,actor_ref,trusted_input_ref}){
 resolverCalls++;
 const s=sources.get(trusted_input_ref);
 // Simulated row security: tenant must match; RLS real remains unverified.
 if(!s||s.tenant_id!==tenant_id)return null;
 return {...s,filename:'synthetic.txt'};
}};
const api=createVS53bIdentityBridge({supabaseUrl:'https://fixture.invalid',anonKey:'synthetic-anon-key',fetchImpl,trustedInputResolver:resolver});
const request=(token,ref='source-A',body=null)=>({
 method:'POST',path:PATH,body:body??{trusted_input_ref:ref},
 rawRequest:{headers:{get(name){return name.toLowerCase()==='authorization'?(token?'Bearer '+token:null):null}}}
});
async function check(name,fn){await fn();checks++;console.log('VS53B_OK '+checks+' '+name)}
await check('real runtime resolveIdentity validates Auth and profile before preview',async()=>{
 const x=await api.handle(request('owner-token'));
 assert.equal(x.status,200);assert.equal(x.body.preview.tenant_id,'tenant-A');
 assert.equal(x.body.preview.actor_ref,'user-1');
 assert.equal(x.body.preview.candidates.length,1);
 assert(x.body.preview.authorization.accept===false);
 assert.equal(x.body.preview.persisted_count,0);
 assert(authFetch>0&&profileFetch>0);
});
await check('beta validator in tenant-B may access B only',async()=>{
 const own=await api.handle(request('beta-token','source-B'));
 const other=await api.handle(request('beta-token','source-A'));
 assert.equal(own.status,200);assert.equal(own.body.preview.tenant_id,'tenant-B');
 assert.equal(other.status,404);
 assert.equal(other.body.error.code,'NOT_FOUND');
});
await check('role not authorized cannot reach resolver',async()=>{
 const before=resolverCalls;
 const x=await api.handle(request('seller-token'));
 assert.equal(x.status,403);assert.equal(resolverCalls,before);
});
await check('inactive profile and unknown tokens rejected before source lookup',async()=>{
 const before=resolverCalls;
 assert.equal((await api.handle(request('disabled-token'))).status,401);
 assert.equal((await api.handle(request('bad-token'))).status,401);
 assert.equal((await api.handle(request(null))).status,401);
 assert.equal(resolverCalls,before);
});
await check('body cannot spoof tenant, actor, source bytes or C01 acceptance',async()=>{
 const before=resolverCalls;
 for(const body of [
  {trusted_input_ref:'source-A',tenant_id:'tenant-B'},
  {trusted_input_ref:'source-A',subject:'user-2'},
  {trusted_input_ref:'source-A',content:'📱'},
  {trusted_input_ref:'source-A',approved:true}
 ])assert.equal((await api.handle(request('owner-token','source-A',body))).status,400);
 assert.equal(resolverCalls,before);
});
await check('wrong route never reaches authentication or source',async()=>{
 const before=authFetch,resolveBefore=resolverCalls;
 const requestOther={...request('owner-token'),path:'/api/external-calc/v0/review'};
 assert.equal((await api.handle(requestOther)).status,404);
 assert.equal(authFetch,before);assert.equal(resolverCalls,resolveBefore);
});
await check('identical trusted source yields stable fingerprint without writes',async()=>{
 const x=(await api.handle(request('owner-token'))).body.preview;
 const y=(await api.handle(request('owner-token'))).body.preview;
 assert.equal(x.preview_fingerprint,y.preview_fingerprint);
 assert.equal(nonGet,0);
});
await check('token is not returned in preview',async()=>{
 const x=await api.handle(request('owner-token'));
 assert.equal(x.status,200);
 assert(!JSON.stringify(x).includes('owner-token'));
 assert(!JSON.stringify(x).includes('synthetic-anon-key'));
});
await check('bridge is explicitly not operationally registered',async()=>{
 assert.equal(api.registered_in_operational_runtime,false);
 assert.equal(nonGet,0);
});
console.log('EXTERNAL_CALC_VS53B_IDENTITY_BRIDGE=PASS checks='+checks+' write_attempts='+nonGet);
