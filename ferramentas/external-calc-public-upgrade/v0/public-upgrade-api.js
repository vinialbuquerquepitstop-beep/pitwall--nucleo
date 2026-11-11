'use strict';
// Public boundary: never accepts arbitrary tenant, price, rate, supplier or authorization from browser.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PATHS=Object.freeze({quote:'/api/upgrade/v1/quote',lead:'/api/upgrade/v1/lead',catalog:'/api/upgrade/v1/catalog'});
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const RESP=(code,data)=>new Response(JSON.stringify(data),{status:code,headers:HEADERS});
const TEXT=s=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=100;
const CAPACITY=/^(64|128|256|512|1024|2048) GB$|^(1|2) TB$/;
const COND=new Set(['excelente','bom','marcas','reparo']);
const NEWCOND=new Set(['lacrado','seminovo']);
const INST=new Set([1,6,10,12,18]);
function validateSelection(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(k=>!['desired','trade_in','installments'].includes(k)))return false;
 const a=payload.desired,b=payload.trade_in;
 return !!a&&!!b&&typeof a==='object'&&!Array.isArray(a)&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(a).length===3&&Object.keys(b).length===3&&
 TEXT(a.model)&&CAPACITY.test(a.capacity)&&NEWCOND.has(a.condition)&&TEXT(b.model)&&CAPACITY.test(b.capacity)&&COND.has(b.condition)&&INST.has(payload.installments);
}
function normalizeWhatsapp(s){
 if(typeof s!=='string'||s.length>32)return null;
 let digits=s.replace(/\D/g,'');
 if(digits.length===10||digits.length===11)digits='55'+digits;
 return /^[0-9]{12,13}$/.test(digits)?digits:null;
}
function validateQuote(q){
 if(!q||typeof q!=='object'||q.currency!=='BRL'||!Number.isSafeInteger(q.sale_amount_minor)||!Number.isSafeInteger(q.trade_in_credit_minor)||!Number.isSafeInteger(q.amount_due_minor)||q.sale_amount_minor<0||q.trade_in_credit_minor<0||q.amount_due_minor<0||q.trade_in_credit_minor>q.sale_amount_minor||q.amount_due_minor!==q.sale_amount_minor-q.trade_in_credit_minor)return false;
 return true;
}
function createPublicUpgradeApi({enabled=false,quote,capture,catalog,expectedOrigin}={}){
 const matches=path=>Object.values(PATHS).includes(path);
 if(enabled!==true)return Object.freeze({matches,handle:async()=>RESP(404,{ok:false,code:'NOT_FOUND'})});
 if(typeof quote!=='function'||typeof capture!=='function'||typeof catalog!=='function'||typeof expectedOrigin!=='string'||!expectedOrigin.startsWith('https://'))throw Error('PUBLIC_UPGRADE_DEPENDENCIES_REQUIRED');
 return Object.freeze({matches,async handle(request){
  let url;try{url=new URL(request.url)}catch{return RESP(400,{ok:false,code:'BAD_REQUEST'})}
  if(!matches(url.pathname))return RESP(404,{ok:false,code:'NOT_FOUND'});
  if(url.origin!==expectedOrigin)return RESP(404,{ok:false,code:'NOT_FOUND'});
  if(url.pathname===PATHS.catalog){
   if(request.method!=='GET')return RESP(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
   if(url.search||(request.headers.get('origin')&&request.headers.get('origin')!==expectedOrigin))return RESP(403,{ok:false,code:'FORBIDDEN'});
   try{
    const raw=await catalog();
    if(!Array.isArray(raw)||raw.length>500)throw Error('CATALOG_INVALID');
    const offers=raw.map(p=>{
     if(!p||!p.desired||typeof p.desired.model!=='string'||!TEXT(p.desired.model)||
        !CAPACITY.test(p.desired.capacity)||!NEWCOND.has(p.desired.condition)||p.status!=='published'||p.approved!==true)throw Error('CATALOG_INVALID');
     return {model:p.desired.model,capacity:p.desired.capacity,condition:p.desired.condition};
    });
    const unique=new Set(offers.map(x=>[x.model,x.capacity,x.condition].join('|')));
    if(unique.size!==offers.length)throw Error('CATALOG_INVALID');
    return RESP(200,{ok:true,offers});
   }catch{return RESP(503,{ok:false,code:'CATALOG_UNAVAILABLE'});}
  }
  if(request.method!=='POST')return RESP(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  if(url.search||request.headers.get('origin')&&request.headers.get('origin')!==expectedOrigin)return RESP(403,{ok:false,code:'FORBIDDEN'});
  if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return RESP(415,{ok:false,code:'UNSUPPORTED_MEDIA_TYPE'});
  const len=request.headers.get('content-length');
  if(len!==null&&(!/^\d{1,6}$/.test(len)||Number(len)>2048))return RESP(413,{ok:false,code:'PAYLOAD_TOO_LARGE'});
  let body;try{const text=await request.text();if(Buffer.byteLength(text)>2048)return RESP(413,{ok:false,code:'PAYLOAD_TOO_LARGE'});body=JSON.parse(text)}catch{return RESP(400,{ok:false,code:'INVALID_JSON'})}
  if(!body||typeof body!=='object'||Array.isArray(body))return RESP(400,{ok:false,code:'INVALID_PAYLOAD'});
  const isLead=url.pathname===PATHS.lead;
  if(isLead){
   if(Object.keys(body).some(k=>!['selection','contact','consent','request_key'].includes(k))||!validateSelection(body.selection)||body.consent!==true||!UUID.test(body.request_key||'')||!body.contact||typeof body.contact!=='object'||Array.isArray(body.contact)||Object.keys(body.contact).some(k=>!['name','whatsapp'].includes(k))||!TEXT(body.contact.name)||body.contact.name.length>80)return RESP(400,{ok:false,code:'INVALID_LEAD'});
   const whatsapp=normalizeWhatsapp(body.contact.whatsapp);
   if(!whatsapp)return RESP(400,{ok:false,code:'INVALID_WHATSAPP'});
   try{
    const result=await capture({request_key:body.request_key,selection:body.selection,contact:{name:body.contact.name.trim(),whatsapp},consent:true});
    if(!result||result.accepted!==true||typeof result.reference!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(result.reference))throw Error('NOT_ACCEPTED');
    return RESP(202,{ok:true,reference:result.reference});
   }catch{return RESP(503,{ok:false,code:'CAPTURE_UNAVAILABLE'})}
  }
  if(!validateSelection(body))return RESP(400,{ok:false,code:'INVALID_SELECTION'});
  try{const result=await quote(body);if(!validateQuote(result))throw Error('INVALID_QUOTE');return RESP(200,{ok:true,quote:{sale_amount_minor:result.sale_amount_minor,trade_in_credit_minor:result.trade_in_credit_minor,amount_due_minor:result.amount_due_minor,currency:'BRL'}})}
  catch{return RESP(503,{ok:false,code:'QUOTE_UNAVAILABLE'})}
 }});
}
module.exports={createPublicUpgradeApi,PATHS,validateSelection,normalizeWhatsapp};
