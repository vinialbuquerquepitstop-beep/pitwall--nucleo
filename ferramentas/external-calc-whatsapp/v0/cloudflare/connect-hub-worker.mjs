// Isolated Meta sandbox ingress. Deliberately has no database writes or accepted business events.
// DOES NOT belong to the existing Pitwall/External Calc/Pitsquad worker.
const LIMIT=256*1024;
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
// Stop here until tenant authorization and atomic inbox/outbox are E2E proven.
// 503 is intentional; do not connect the Meta callback to this skeleton.
return plain("Ingress Not Enabled",503);
}};
