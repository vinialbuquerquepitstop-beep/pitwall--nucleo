'use strict';
// VS5.3 experimental HTTP-shaped handler. Not registered in production runtime.
// All credentials/identity must be supplied by a trusted authenticate() boundary.
const {createVS52PreviewService}=require('./service-preview-contract.cjs');
const VERSION='external-calc-vs53-preview-api/v0';
const PATH='/api/external-calc/v0/experimental/preview';
const MAX_BODY=2048;
function json(status,body){return {status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body}}
function parseBody(value){
 if(typeof value==='string'){
   if(Buffer.byteLength(value,'utf8')>MAX_BODY)throw Object.assign(new Error('BODY_TOO_LARGE'),{code:'BODY_TOO_LARGE'});
   try {value=JSON.parse(value)} catch{throw Object.assign(new Error('INVALID_JSON'),{code:'INVALID_REQUEST'})}
 }
 if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error('BODY_MUST_BE_OBJECT'),{code:'INVALID_REQUEST'});
 const keys=Object.keys(value);
 if(keys.length!==1||keys[0]!=='trusted_input_ref'||typeof value.trusted_input_ref!=='string'
  ||value.trusted_input_ref.length>160||!/^[-:\w.]{3,160}$/.test(value.trusted_input_ref))
   throw Object.assign(new Error('ONLY_TRUSTED_INPUT_REF_ALLOWED'),{code:'CLIENT_AUTHORITY_FIELD'});
 return {trusted_input_ref:value.trusted_input_ref};
}
function assertTrustedIdentity(identity){
 if(!identity||typeof identity.tenant_id!=='string'||!identity.tenant_id.trim()||
    typeof identity.subject!=='string'||!identity.subject.trim())
    throw Object.assign(new Error('UNAUTHENTICATED'),{code:'UNAUTHENTICATED'});
 if(identity.can_execute_external_calc!==true)
    throw Object.assign(new Error('FORBIDDEN'),{code:'FORBIDDEN'});
 return {tenant_id:identity.tenant_id.trim(),subject:identity.subject.trim(),can_execute_external_calc:true};
}
function createVS53PreviewApi({authenticate,trustedInputResolver}={}){
 if(typeof authenticate!=='function')throw Error('VS53_AUTHENTICATE_REQUIRED');
 if(!trustedInputResolver||typeof trustedInputResolver.resolve!=='function')throw Error('VS53_TRUSTED_RESOLVER_REQUIRED');
 const service=createVS52PreviewService({trustedInputResolver});
 return Object.freeze({
  version:VERSION,
  async handle(request){
   // Exact path + method required: never reuse operational execute/review route.
   if(request?.path!==PATH||request?.method!=='POST')
     return json(404,{error:{code:'NOT_FOUND'}});
   try {
     // Authenticate *before* interpreting body or touching source lookup.
     const identity=assertTrustedIdentity(await authenticate(request));
     const data=parseBody(request.body);
     const preview=await service.preview({trusted_input_ref:data.trusted_input_ref,context:identity});
     return json(200,{
       api_version:VERSION,
       preview
     });
   }catch(error){
     const code=error?.code||'PREVIEW_REJECTED';
     if(code==='UNAUTHENTICATED')return json(401,{error:{code}});
     if(code==='FORBIDDEN')return json(403,{error:{code}});
     if(code==='TRUSTED_INPUT_SCOPE_MISMATCH')return json(404,{error:{code:'NOT_FOUND'}});
     if(code==='CLIENT_AUTHORITY_FIELD'||code==='BODY_TOO_LARGE'||code==='INVALID_REQUEST')return json(400,{error:{code}});
     // No raw source, tokens, tenant identifiers or parser details in errors.
     return json(422,{error:{code:'PREVIEW_UNAVAILABLE'}});
   }
  }
 });
}
module.exports={VERSION,PATH,createVS53PreviewApi};
