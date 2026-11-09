'use strict';
/**
 * UP-06T: reuse authoritative domain resolvers, never source prices in public projections.
 * No Worker route or database access. Caller must supply tenant-scoped domain context.
 */
const {resolveVariant,resolveTradeIn,resolveSimulation}=require('../../external-calc-sales-product/v0/sales-product-service');
class DomainBridgeDenied extends Error{constructor(code){super(code);this.code=code;}}
const deny=c=>{throw new DomainBridgeDenied(c)};
const money=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const safeRef=s=>typeof s==='string'&&s.length>0&&s.length<=200;
function assertContext(context,publication){
 if(!context||!publication||!Array.isArray(context.offers)||!context.offers.length||
 context.offers.length>500||context.tenant_id!==publication.tenant_id||
 context.public_id!==publication.public_id||context.offer_revision!==publication.offer_revision)deny('CONTEXT_MISMATCH');
 if(!safeRef(publication.analysis_id)||!safeRef(publication.offer_id)||
 !Number.isSafeInteger(publication.offer_revision)||publication.offer_revision<1||
 !money(publication.sale_price_minor))deny('PUBLICATION_INVALID');
 const matches=context.offers.filter(x=>x.analysis_id===publication.analysis_id&&x.offer_id===publication.offer_id&&x.offer_revision===publication.offer_revision);
 if(matches.length!==1||!matches[0]?.reviewed_offer||!safeRef(matches[0].reviewed_offer.supplier_id))deny('OFFER_BINDING_INVALID');
 if(publication.offer_value_fingerprint!==matches[0].offer_value_fingerprint)deny('OFFER_FINGERPRINT_STALE');
 return matches[0];
}
function createCanonicalUpgradeDomainAdapter(){
 return Object.freeze({
  resolveVariant:async({context,publication})=>{
   const o=assertContext(context,publication);
   let result;
   try{result=resolveVariant(context.offers,{supplier_id:o.reviewed_offer.supplier_id,model_id:o.reviewed_offer.model?.id,capacity_gb:o.reviewed_offer.capacity_gb,color:o.reviewed_offer.color});}
   catch(_){deny('CANONICAL_VARIANT_FAILED');}
   if(result.analysis_id!==publication.analysis_id||result.offer_id!==publication.offer_id||result.offer_revision!==publication.offer_revision||
    result.offer_value_fingerprint!==publication.offer_value_fingerprint)deny('CANONICAL_VARIANT_MISMATCH');
   return {public_amount_minor:publication.sale_price_minor};
  },
  estimateTradeIn:async({context,publication,command})=>{
   assertContext(context,publication);
   if(!context.tradeInPolicy||!Array.isArray(context.tradeInCandidates))deny('TRADE_IN_CONTEXT_MISSING');
   let result;
   try{result=resolveTradeIn(context.tradeInCandidates,context.tradeInPolicy,{model_id:command.device_model_id,capacity_gb:command.capacity_gb,color:command.color??null});}
   catch(_){deny('CANONICAL_TRADE_IN_FAILED');}
   if(!money(result?.estimated_credit?.amount_minor)||result.estimated_credit.currency!=='BRL')deny('CANONICAL_TRADE_IN_INVALID');
   return {public_amount_minor:result.estimated_credit.amount_minor};
  },
  simulateSale:async({context,publication,command})=>{
   assertContext(context,publication);
   if(!context.rateProfile||!context.tradeInPolicy||!Array.isArray(context.tradeInCandidates))deny('SIMULATION_CONTEXT_MISSING');
   let result;
   try{result=resolveSimulation(context.offers.concat(context.tradeInCandidates),context.tradeInPolicy,context.rateProfile,{
    analysis_id:publication.analysis_id,offer_id:publication.offer_id,offer_revision:publication.offer_revision,
    sale_amount:{amount_minor:publication.sale_price_minor,currency:'BRL'},
    installment_count:command.installment_count,trade_in_estimate_id:command.estimate_ref||null
   });}catch(_){deny('CANONICAL_SIMULATION_FAILED');}
   if(result?.offer_reference?.offer_value_fingerprint!==publication.offer_value_fingerprint||
    !money(result?.installment_amount?.amount_minor)||result.installment_amount.currency!=='BRL'||
    result.installment_count!==command.installment_count)deny('CANONICAL_SIMULATION_INVALID');
   return {public_amount_minor:result.installment_amount.amount_minor,installment_count:result.installment_count};
  }
 });
}
module.exports={createCanonicalUpgradeDomainAdapter,DomainBridgeDenied};
