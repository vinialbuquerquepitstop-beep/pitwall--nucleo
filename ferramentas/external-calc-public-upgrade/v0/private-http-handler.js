'use strict';
// UP-06Z: server-to-server HTTP adapter. Does not install routes or secrets.
const PATH='/internal/upgrade/v1/execute';
const ACTIONS=new Set(['resolveVariant','estimateTradeIn','simulateSale']);
const JSON_HEADERS=Object.freeze({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
function answer(status,body){return new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});}
function createUpgradePrivateHttpHandler({enabled=false,execute,expectedHost}={}){
 if(enabled!==true)return Object.freeze({matches:path=>path===PATH,handle:async()=>answer(404,{ok:false,code:'NOT_FOUND'})});
 if(typeof execute!=='function'||typeof expectedHost!=='string'||!expectedHost.trim())throw new Error('INTERNAL_RUNTIME_DEPENDENCIES_REQUIRED');
 return Object.freeze({
  matches:path=>path===PATH,
  async handle(request){
   let url;
   try{url=new URL(request.url);}catch(_){return answer(400,{ok:false,code:'BAD_REQUEST'});}
   if(url.pathname!==PATH)return answer(404,{ok:false,code:'NOT_FOUND'});
   if(url.hostname!==expectedHost||url.protocol!=='https:')return answer(404,{ok:false,code:'NOT_FOUND'});
   if(request.method!=='POST')return answer(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
   if(url.search)return answer(400,{ok:false,code:'BAD_REQUEST'});
   if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return answer(415,{ok:false,code:'UNSUPPORTED_MEDIA_TYPE'});
   const length=request.headers.get('content-length');
   if(length!==null&&(!/^[0-9]{1,7}$/.test(length)||Number(length)>2048))return answer(413,{ok:false,code:'PAYLOAD_TOO_LARGE'});
   const authorization=request.headers.get('authorization')||'';
   if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)||authorization.length>4103)return answer(401,{ok:false,code:'UNAUTHORIZED'});
   let raw;
   try{raw=await request.text();}catch(_){return answer(400,{ok:false,code:'BAD_REQUEST'});}
   if(Buffer.byteLength(raw,'utf8')>2048)return answer(413,{ok:false,code:'PAYLOAD_TOO_LARGE'});
   let input;
   try{input=JSON.parse(raw);}catch(_){return answer(400,{ok:false,code:'BAD_REQUEST'});}
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==2||!Object.hasOwn(input,'action')||!Object.hasOwn(input,'command')||!ACTIONS.has(input.action)||!input.command||typeof input.command!=='object'||Array.isArray(input.command))return answer(400,{ok:false,code:'BAD_REQUEST'});
   try{
    const result=await execute({action:input.action,command:input.command,credential:authorization.slice(7)});
    if(!result||result.schema_version!=='pitstop-internal-upgrade/v1'||result.action!==input.action||!Number.isSafeInteger(result.amount_minor)||result.amount_minor<0||result.currency!=='BRL')throw new Error('INVALID_PUBLIC_RESULT');
    return answer(200,{ok:true,data:result});
   }catch(_){return answer(403,{ok:false,code:'NOT_AUTHORIZED'});}
  }
 });
}
module.exports={createUpgradePrivateHttpHandler,PATH};
