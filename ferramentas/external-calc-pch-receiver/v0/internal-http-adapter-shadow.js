'use strict';
// G11 isolated adapter. NOT imported by deployed Worker/router.
// Trusted caller must supply the original raw UTF-8 request body and only
// server-controlled keyring, Pg nonceLedger and receiver repository.
const {authenticateOnce,REQUEST_PATH,RECEIPT_PATH}=require('./m2m-auth-shadow');
const {acceptIngress,reconcileIngress}=require('./receiver-shadow');
function createPchInternalAdapter({keyring,nonceLedger,repository,nowMs=()=>Date.now()}={}){
 if(!keyring||!nonceLedger||!repository||typeof nowMs!=='function')throw Error('PCH_INTERNAL_DEPENDENCIES_REQUIRED');
 return async function handle({method,path,headers,body}={}){
  const out=(status,data)=>({status,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(data)});
  // Reject oversized body before any authentication / nonce consumption.
  if(typeof body!=='string'||Buffer.byteLength(body,'utf8')>2*1024*1024)return out(413,{error:'REQUEST_TOO_LARGE'});
  const lowerHeaders={};
  if(!headers||typeof headers!=='object'||Array.isArray(headers))return out(401,{error:'UNAUTHORIZED_SERVICE'});
  for(const [k,v] of Object.entries(headers)){
   if(typeof v!=='string'||Object.hasOwn(lowerHeaders,k.toLowerCase()))return out(401,{error:'UNAUTHORIZED_SERVICE'});
   lowerHeaders[k.toLowerCase()]=v;
  }
  let actor;
  try {
   actor=await authenticateOnce({method,path,headers:lowerHeaders,body,keyring,nowMs:nowMs()},{nonceLedger});
  }catch{return out(401,{error:'UNAUTHORIZED_SERVICE'})}
  // Only the exact domain actor contract crosses the authentication boundary.
  // The verified keyId is transport metadata, never a domain permission.
  const domainActor=Object.freeze({authenticated:actor.authenticated,producer:actor.producer,tenantId:actor.tenantId,permissions:actor.permissions});
  let event;
  try{event=JSON.parse(body)}catch{return out(400,{error:'INVALID_JSON'})}
  try{
   const result=path===REQUEST_PATH
    ?await acceptIngress({actor:domainActor,event,repository})
    :path===RECEIPT_PATH
      ?await reconcileIngress({actor:domainActor,event,repository})
      :null;
   return out(200,result);
  }catch(error){
   if(error?.code==='INGRESS_IDEMPOTENCY_CONFLICT'||error?.code==='RECEIPT_CONFLICT')return out(409,{error:'INGRESS_CONFLICT'});
   if(['INVALID_INGRESS_EVENT','INVALID_TENANT_ID','TENANT_MISMATCH'].includes(error?.code))return out(422,{error:'INVALID_EVENT'});
   if(error?.code==='UNAUTHORIZED_PRODUCER')return out(403,{error:'UNAUTHORIZED_PRODUCER'});
   return out(503,{error:'RECEIVER_UNAVAILABLE'});
  }
 };
}
module.exports={createPchInternalAdapter};
