'use strict';
// UP-CRM-01: private Cloudflare service-binding transport to Pitwall V2.
// Never accepts a destination URL, organization, or secret from a browser.
// No legacy External Calc DB path. A missing binding or secret denies requests.
const MAX=8192,WINDOW=60;
const RESP=(status,code)=>new Response(JSON.stringify({ok:false,code}),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const encoder=new TextEncoder();
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function hash(bytes){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));}
async function keyFor(secret){return crypto.subtle.importKey('raw',encoder.encode(secret),
 {name:'HMAC',hash:'SHA-256'},false,['sign']);}
function createUpgradeV2ServiceBridge({binding,secret,publicOrigin,now=()=>Date.now()}={}){
 if(typeof binding?.fetch!=='function'||typeof secret!=='string'||secret.length<32||
  typeof publicOrigin!=='string'||!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(publicOrigin))return null;
 return async function forward(request){
  let url;try{url=new URL(request.url);}catch{return RESP(400,'BAD_REQUEST');}
  if(url.origin!==publicOrigin||url.pathname!=='/api/upgrade/v1/lead'||url.search||
   request.method!=='POST')return RESP(403,'UPGRADE_V2_FORBIDDEN');
  const size=request.headers.get('content-length');
  if(size!==null&&(!/^\d+$/.test(size)||Number(size)>MAX))return RESP(413,'PAYLOAD_TOO_LARGE');
  const body=await request.arrayBuffer();
  if(body.byteLength===0||body.byteLength>MAX)return RESP(413,'PAYLOAD_TOO_LARGE');
  const ts=String(Math.floor(now()/1000));
  const digest=await hash(body);
  const signature=hex(new Uint8Array(await crypto.subtle.sign('HMAC',await keyFor(secret),
   encoder.encode(['POST','/api/upgrade/v1/lead',ts,digest].join('\n')))));
  const headers=new Headers({'content-type':'application/json',
   'origin':publicOrigin,'x-pw-upgrade-timestamp':ts,'x-pw-upgrade-signature':signature});
  try{
   const response=await binding.fetch(new Request(request.url,{method:'POST',headers,body}));
   if(!(response instanceof Response))return RESP(503,'UPGRADE_V2_UNAVAILABLE');
   // Forward only the V2 approved response shape and statuses.
   if(response.status===202){
    let reply;try{reply=await response.json();}catch{return RESP(503,'UPGRADE_V2_BAD_RECEIPT');}
    if(reply?.ok!==true||reply?.status!=='RECEIVED'||!/^upg_[a-f0-9]{32}$/i.test(reply.reference||''))
     return RESP(503,'UPGRADE_V2_BAD_RECEIPT');
    return new Response(JSON.stringify({ok:true,reference:reply.reference,status:'RECEIVED'}),{
     status:202,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
   }
   if([400,409,429,503].includes(response.status)){
    const allowed={400:'UPGRADE_INTAKE_INVALID',409:'UPGRADE_INTAKE_CONFLICT',
     429:'UPGRADE_INTAKE_REJECTED',503:'UPGRADE_INTAKE_UNAVAILABLE'};
    return RESP(response.status,allowed[response.status]);
   }
   return RESP(503,'UPGRADE_V2_UNAVAILABLE');
  }catch{return RESP(503,'UPGRADE_V2_UNAVAILABLE');}
 };
}
module.exports={createUpgradeV2ServiceBridge,MAX,WINDOW};
