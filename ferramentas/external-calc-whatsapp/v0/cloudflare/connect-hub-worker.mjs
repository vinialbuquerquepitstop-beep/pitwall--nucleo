// Isolated Meta sandbox ingress. Deliberately has no database writes or accepted business events.
// DOES NOT belong to the existing Pitwall/External Calc/Pitsquad worker.
const LIMIT=256*1024;
import {durableAck} from './durable-ack-boundary.mjs';
const plain=(body,status)=>new Response(body,{status,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}});
const safeEqual=(a,b)=>{if(typeof a!=="string"||typeof b!=="string"||!a||!b||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,"0")).join("");
async function verified(bytes,header,secret){if(!secret||!/^sha256=[a-f0-9]{64}$/i.test(header||""))return false;
const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
const signature="sha256="+hex(await crypto.subtle.sign("HMAC",key,bytes));
return safeEqual(signature,header.toLowerCase());}
export default {async fetch(request,env){
const url=new URL(request.url);
if(url.pathname!=="/meta/webhook")return plain("Not Found",404);
if(request.method==="GET"){
const mode=url.searchParams.get("hub.mode"),token=url.searchParams.get("hub.verify_token"),challenge=url.searchParams.get("hub.challenge");
if(mode!=="subscribe"||!safeEqual(token,env.META_VERIFY_TOKEN)||!challenge||challenge.length>512)return plain("Forbidden",403);
return plain(challenge,200);
}
if(request.method!=="POST")return plain("Method Not Allowed",405);
const length=Number(request.headers.get("content-length"));
if(Number.isFinite(length)&&length>LIMIT)return plain("Payload Too Large",413);
const bytes=await request.arrayBuffer();
if(bytes.byteLength===0||bytes.byteLength>LIMIT)return plain("Payload Too Large",413);
if(!await verified(bytes,request.headers.get("x-hub-signature-256"),env.META_APP_SECRET))return plain("Unauthorized",401);
// Explicit opt-in only. Never enable until the Meta sandbox identity is confirmed.
if(env.PCH_STAGING_INGRESS_ENABLED!=='true')return plain("Ingress Not Enabled",503);
let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return plain("Invalid JSON",400);}
if(body?.object!=='whatsapp_business_account'||!Array.isArray(body.entry))return plain("Unsupported Event",503);
const events=[];
for(const entry of body.entry){
 for(const change of entry.changes||[]){
  if(change.field!=='messages')continue;
  const receiver=change.value?.metadata?.phone_number_id;
  if(receiver!==env.PCH_SANDBOX_PHONE_NUMBER_ID)return plain("Unrecognized Receiver",503);
  for(const message of change.value?.messages||[]){
   if(message?.type!=='text'||typeof message?.id!=='string'||typeof message?.from!=='string')return plain("Unsupported Message",503);
   if(message.from!==env.PCH_SANDBOX_ALLOWED_SENDER)return plain("Sender Not Allowed",503);
   events.push({message,receiver});
  }
 }
}
if(events.length===0)return plain("No Ingress Events",503);
if(!env.PCH_SANDBOX_PROVIDER_SCOPE||!env.PCH_STAGING_TENANT_BINDING)return plain("Ingress Not Configured",503);
try{
 const {acceptViaHyperdrive}=await import('./hyperdrive-storage.mjs');
 for(const {message,receiver} of events){
  const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(message))));
  const event={id:crypto.randomUUID(),provider_scope_id:env.PCH_SANDBOX_PROVIDER_SCOPE,phone_number_id:receiver,provider_message_id:message.id,tenant_binding_ref:env.PCH_STAGING_TENANT_BINDING,routing_policy_version:'pch-sandbox-hold-v1',route:'HOLD_REVIEW',original_sha256:digest};
  const outcome=await durableAck({authenticated:true,authorized:true,event,accept:e=>acceptViaHyperdrive(env,e)});
  if(outcome.status!==200)return plain("Durable Ingress Failed",503);
 }
 return plain("Accepted",200);
}catch{return plain("Durable Ingress Failed",503);}
}};
