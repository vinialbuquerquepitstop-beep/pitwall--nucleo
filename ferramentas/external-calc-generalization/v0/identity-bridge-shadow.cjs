'use strict';
// VS5.3b: Reuse real exported Worker identity verifier but keep the preview
// route OUT of production runtime. Network boundary is injected for testing.
const {resolveIdentity}=require('../../external-calc-runtime/v0/runtime');
const {createVS53PreviewApi,PATH}=require('./preview-api-shadow.cjs');
const VERSION='external-calc-vs53b-runtime-identity-bridge/v0';
function createVS53bIdentityBridge({supabaseUrl,anonKey,fetchImpl,trustedInputResolver}={}){
 if(!/^https:\/\//.test(supabaseUrl||'')||
    typeof anonKey!=='string'||!anonKey||
    typeof fetchImpl!=='function'||typeof trustedInputResolver?.resolve!=='function')
   throw new Error('VS53B_CONFIG_REQUIRED');
 const cfg={supabaseUrl,anonKey};
 const api=createVS53PreviewApi({
  authenticate:async req=>{
   // Resolve user against actual runtime auth implementation (Auth /user
   // then app_usuario profile). Caller never supplies tenant or role.
   const identity=await resolveIdentity(req.rawRequest,cfg,fetchImpl);
   if(!identity)return null;
   return {
     tenant_id:identity.tenant_id,
     subject:identity.subject,
     can_execute_external_calc:identity.can_execute_external_calc
   };
  },
  trustedInputResolver
 });
 return Object.freeze({
   version:VERSION,
   registered_in_operational_runtime:false,
   endpoint:PATH,
   async handle({method,path,body,rawRequest}={}){
     if(path!==PATH||method!=='POST')
        return {status:404,headers:{'cache-control':'no-store'},body:{error:{code:'NOT_FOUND'}}};
     if(!rawRequest||typeof rawRequest.headers?.get!=='function')
        return {status:401,headers:{'cache-control':'no-store'},body:{error:{code:'UNAUTHENTICATED'}}};
     return api.handle({path,method,body,rawRequest});
   }
 });
}
module.exports={VERSION,createVS53bIdentityBridge};
