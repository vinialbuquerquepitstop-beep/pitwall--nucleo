'use strict';
// Server-side binding of browser selections to an approved, revisioned publication.
// No prices, tenant IDs, supplier IDs or offer IDs may originate from the browser.
// Authorized readers are injected by the runtime; all ambiguous selections fail closed.
const {validateSelection}=require('./public-upgrade-api');
const REF=/^[A-Za-z0-9_-]{1,100}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AMOUNT=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const CAPACITY=new Map([['64 GB',64],['128 GB',128],['256 GB',256],['512 GB',512],['1024 GB',1024],['2048 GB',2048],['1 TB',1024],['2 TB',2048]]);
class UpgradeQuoteUnavailable extends Error {constructor(){super('QUOTE_UNAVAILABLE');this.code='QUOTE_UNAVAILABLE';}}
const deny=()=>{throw new UpgradeQuoteUnavailable();};
function assertPublicResult(r,action,pub){
 if(!r||r.schema_version!=='pitstop-internal-upgrade/v1'||r.action!==action||
 r.public_id!==pub.public_id||r.price_revision!==pub.price_revision||r.currency!=='BRL'||!AMOUNT(r.amount_minor))deny();
 return r.amount_minor;
}
function sameDesired(actual,desired){
 return !!actual&&actual.model===desired.model&&actual.capacity===desired.capacity&&actual.condition===desired.condition;
}
function sameUsed(actual,used){
 return !!actual&&actual.model===used.model&&actual.capacity===used.capacity;
}
function createAuthorizedUpgradeQuote({enabled=false,loadApprovedCatalog,invokeInternal,clock=()=>Date.now()}={}){
 if(enabled!==true)return async()=>deny();
 if(typeof loadApprovedCatalog!=='function'||typeof invokeInternal!=='function')throw Error('TRUSTED_QUOTE_DEPENDENCIES_REQUIRED');
 return async function quote(selection){
  if(!validateSelection(selection))deny();
  let catalog;
  try{catalog=await loadApprovedCatalog();}catch(_){deny();}
  if(!Array.isArray(catalog)||catalog.length===0||catalog.length>500)deny();
  const now=clock();
  const found=catalog.filter(p=>sameDesired(p.desired,selection.desired));
  // No cheapest/most expensive arbitrary selection: one precise active publication per variant.
  if(found.length!==1)deny();
  const pub=found[0];
  if(!REF.test(pub.public_id||'')||!REF.test(pub.price_revision||'')||
     !UUID.test(pub.tenant_id||'')||pub.status!=='published'||
     !Number.isSafeInteger(pub.expires_at_ms)||pub.expires_at_ms<=now||
     pub.approved!==true)deny();
  if(!Array.isArray(pub.trade_in_models)||pub.trade_in_models.length>200)deny();
  const used=pub.trade_in_models.filter(x=>sameUsed(x,selection.trade_in));
  if(used.length!==1||!REF.test(used[0].device_model_id||'')||
     !Number.isInteger(used[0].capacity_gb)||
     used[0].capacity_gb!==CAPACITY.get(selection.trade_in.capacity))deny();
  // A consumer's self-assessed condition is not proof of credit eligibility.
  // Only a canonical estimate based on the trusted catalog may become visible.
  const base={public_id:pub.public_id,price_revision:pub.price_revision};
  let sale,credit;
  try{
   sale=assertPublicResult(await invokeInternal({
    action:'resolveVariant',command:base
   }),'resolveVariant',pub);
   credit=assertPublicResult(await invokeInternal({
    action:'estimateTradeIn',command:{...base,device_model_id:used[0].device_model_id,capacity_gb:used[0].capacity_gb}
   }),'estimateTradeIn',pub);
  }catch(_){deny();}
  if(credit>sale)deny();
  return Object.freeze({sale_amount_minor:sale,trade_in_credit_minor:credit,amount_due_minor:sale-credit,currency:'BRL'});
 };
}
module.exports={createAuthorizedUpgradeQuote,UpgradeQuoteUnavailable};
