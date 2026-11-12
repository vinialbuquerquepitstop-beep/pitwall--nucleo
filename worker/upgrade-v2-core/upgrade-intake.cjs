'use strict';
// Server-only Pitwall V2 upgrade ingress. No External Calc dependency.
// Do not mount on a public route without network-level abuse controls and a
// private, tenant-scoped DB identity. This module intentionally has no CRM token.
const {createHash}=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAP=/^(64|128|256|512) GB$|^(1|2) TB$/;
const NEW=new Set(['lacrado','seminovo']);
const USED=new Set(['excelente','bom','marcas','reparo']);
const PAYMENTS=new Set([1,6,10,12,18]);
const ORIGIN='instagram_upgrade';
const fail=(code)=>{throw Object.assign(new Error(code),{code});};
const string=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=max;
const own=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).every(k=>keys.includes(k))&&Object.keys(o).length===keys.length;
function normalizePhone(x){
 if(typeof x!=='string'||x.length>32)return null;
 let digits=x.replace(/\D/g,'');
 if([10,11].includes(digits.length))digits='55'+digits;
 return /^55[0-9]{10,11}$/.test(digits)?digits:null;
}
function normalize(body){
 if(!own(body,['request_key','selection','contact','consent'])||
   body.consent!==true||!UUID.test(body.request_key||'')||
   !own(body.selection,['desired','trade_in','installments'])||
   !own(body.selection.desired,['model','capacity','condition'])||
   !(body.selection.trade_in===null||own(body.selection.trade_in,['model','capacity','condition']))||
   !own(body.contact,['name','whatsapp']))fail('UPGRADE_INTAKE_INVALID');
 const {desired,trade_in,installments}=body.selection;
 if(!string(desired.model,100)||!CAP.test(desired.capacity)||!NEW.has(desired.condition)||
    (trade_in!==null&&(!string(trade_in.model,100)||!CAP.test(trade_in.capacity)||!USED.has(trade_in.condition)))||
    !PAYMENTS.has(installments)||!string(body.contact.name,80)||
    body.contact.name.trim().length<2)fail('UPGRADE_INTAKE_INVALID');
 const phone=normalizePhone(body.contact.whatsapp);
 if(!phone)fail('UPGRADE_INTAKE_INVALID');
 return {
  request_key:body.request_key.toLowerCase(),
  selection:{desired:{model:desired.model.trim(),capacity:desired.capacity,condition:desired.condition},
   trade_in:trade_in===null?null:{model:trade_in.model.trim(),capacity:trade_in.capacity,condition:trade_in.condition},
   installments},
  contact:{name:body.contact.name.trim(),whatsapp:phone},consent:true
 };
}
function digest(normalized){return createHash('sha256').update(JSON.stringify({
 selection:normalized.selection,contact:normalized.contact,consent:true
})).digest('hex');}
function createPitwallUpgradeIntake({organizationId,checkAbuse,store}={}){
 if(!UUID.test(organizationId||'')||typeof checkAbuse!=='function'||typeof store!=='function')
  throw Error('UPGRADE_V2_TRUSTED_INGRESS_REQUIRED');
 return Object.freeze({
  async accept({body,signal}={}){
   const payload=normalize(body);
   let allowed=false;
   try{allowed=await checkAbuse({signal});}catch(_){fail('UPGRADE_INTAKE_UNAVAILABLE');}
   if(allowed!==true)fail('UPGRADE_INTAKE_REJECTED');
   let receipt;
   try{receipt=await store({
    organizationId,requestKey:payload.request_key,
    payloadHash:digest(payload),selection:payload.selection,contact:payload.contact,
    consent:true,source:ORIGIN
   });}catch(e){
    if(e?.code==='UPGRADE_INTAKE_CONFLICT')fail(e.code);
    fail('UPGRADE_INTAKE_UNAVAILABLE');
   }
   if(receipt?.accepted!==true||!UUID.test(receipt.id||''))fail('UPGRADE_INTAKE_UNAVAILABLE');
   return Object.freeze({ok:true,reference:'upg_'+receipt.id.replace(/-/g,''),status:'RECEIVED'});
  }
 });
}
module.exports={createPitwallUpgradeIntake,normalize,digest,ORIGIN};
