'use strict';
// Environment-neutral Fetch Request adapter. Must only be mounted by the
// existing authorized V2 server. Does not create a public endpoint by itself.
const MAX_BODY_BYTES=8192;
const JSON_HEADERS=Object.freeze({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
function reply(status,body){return new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});}
async function limitedJson(request){
 const type=request.headers.get('content-type')||'';
 if(!/^application\/json(?:\s*;|\s*$)/i.test(type))throw Object.assign(new Error('TYPE'),{status:415});
 const size=request.headers.get('content-length');
 if(size!==null&&(!/^\d+$/.test(size)||Number(size)>MAX_BODY_BYTES))throw Object.assign(new Error('SIZE'),{status:413});
 const reader=request.body?.getReader();
 if(!reader)throw Object.assign(new Error('EMPTY'),{status:400});
 let total=0,chunks=[];
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>MAX_BODY_BYTES)throw Object.assign(new Error('SIZE'),{status:413});
   chunks.push(value);
  }
 }finally{try{await reader.cancel();}catch{}}
 if(!total)throw Object.assign(new Error('EMPTY'),{status:400});
 const bytes=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw Object.assign(new Error('JSON'),{status:400});}
}
function createUpgradeV2HttpIngress({enabled=false,intake,publicOrigin}={}){
 if(enabled!==true)return Object.freeze({handle:async()=>reply(503,{ok:false,code:'UPGRADE_INTAKE_DISABLED'})});
 if(typeof intake?.accept!=='function')throw Error('UPGRADE_HTTP_INTAKE_REQUIRED');
 let origin;
 try{const uri=new URL(publicOrigin);if(uri.protocol!=='https:'||uri.username||uri.password||
    uri.search||uri.hash||uri.pathname!=='/'||uri.origin!==publicOrigin.replace(/\/$/,''))
    throw Error('BAD_ORIGIN');origin=uri.origin;}catch{throw Error('UPGRADE_HTTP_ORIGIN_REQUIRED');}
 return Object.freeze({async handle(request){
  if(!(request instanceof Request))return reply(400,{ok:false,code:'UPGRADE_INVALID_REQUEST'});
  let uri;
  try{uri=new URL(request.url);}catch{return reply(400,{ok:false,code:'UPGRADE_INVALID_REQUEST'});}
  if(uri.pathname!=='/api/upgrade/v1/lead'||uri.search||uri.hash)return reply(404,{ok:false,code:'NOT_FOUND'});
  if(request.method!=='POST')return reply(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  if(request.headers.get('origin')!==origin||uri.origin!==origin)
   return reply(403,{ok:false,code:'UPGRADE_ORIGIN_DENIED'});
  let data;
  try{data=await limitedJson(request);}
  catch(e){return reply(e.status||400,{ok:false,code:'UPGRADE_INVALID_REQUEST'});}
  try{
   const received=await intake.accept({body:data,signal:request.signal});
   if(received?.ok!==true||received.status!=='RECEIVED'||
      !/^upg_[a-f0-9]{32}$/i.test(received.reference||''))
    throw Error('INVALID_RECEIPT');
   return reply(202,{ok:true,reference:received.reference,status:'RECEIVED'});
  }catch(e){
   const code=e?.code;
   if(code==='UPGRADE_INTAKE_INVALID')return reply(400,{ok:false,code});
   if(code==='UPGRADE_INTAKE_CONFLICT')return reply(409,{ok:false,code});
   if(code==='UPGRADE_INTAKE_REJECTED')return reply(429,{ok:false,code});
   return reply(503,{ok:false,code:'UPGRADE_INTAKE_UNAVAILABLE'});
  }
 }});
}
module.exports={createUpgradeV2HttpIngress,MAX_BODY_BYTES};
