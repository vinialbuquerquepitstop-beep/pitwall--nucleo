'use strict';
// Private input projection: authoritative External Calc C01 + C02 -> unapproved
// commercial draft. Never writes or publishes a price, never reads browser data.
const {resolveVariant,listProductOptions}=require('../../external-calc-sales-product/v0/sales-product-service');
const {calculateC02}=require('../../external-calc-c02/v1/c02-calculator');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REF=/^[A-Za-z0-9_-]{1,100}$/;
const CAP=new Map([[64,'64 GB'],[128,'128 GB'],[256,'256 GB'],[512,'512 GB'],[1024,'1 TB'],[2048,'2 TB']]);
const DENIED='EXTERNAL_CALC_PUBLICATION_DRAFT_UNAVAILABLE';
const deny=()=>{throw Object.assign(new Error(DENIED),{code:DENIED});};
function createExternalCalcUpgradePublicationDraft({
 tenantId,publicId,priceRevision,reviewedCandidate,calculationProfile,
 calculationRunId,tradeInCandidates,activeRateProfile,expiresAtMs,
 clock=()=>Date.now()
}={}){
 try{
  if(!UUID.test(tenantId||'')||!REF.test(publicId||'')||!REF.test(priceRevision||'')||
   !Array.isArray(tradeInCandidates)||tradeInCandidates.length===0||tradeInCandidates.length>100||
   !Number.isSafeInteger(expiresAtMs)||expiresAtMs<=clock()||expiresAtMs>clock()+30*86400000)deny();
  if(!activeRateProfile||activeRateProfile.status!=='ACTIVE'||
    activeRateProfile.tenant_id!==tenantId||activeRateProfile.currency!=='BRL'||
    !REF.test(activeRateProfile.profile_id||'')||!Number.isSafeInteger(activeRateProfile.version)||
    activeRateProfile.version<1||typeof activeRateProfile.fingerprint!=='string'||
    !activeRateProfile.fingerprint||!Array.isArray(activeRateProfile.entries)||
    !activeRateProfile.entries.length)deny();
  const c=reviewedCandidate,o=c?.reviewed_offer,model=o?.model;
  const label=typeof model?.label==='string'&&model.label.trim()?model.label.trim():null;
  const capacity=CAP.get(o?.capacity_gb);
  const condition=o?.condition;
  if(!c||!o||!label||label.length>100||!capacity||!['lacrado','seminovo'].includes(condition)||
   !REF.test(c.offer_id||'')||!REF.test(c.analysis_id||'')||!REF.test(c.offer_value_fingerprint||'')||
   !Number.isInteger(c.offer_revision)||c.offer_revision<1||
   c.tenant_id!==tenantId||!REF.test(o?.supplier_id||'')||!REF.test(model?.id||''))deny();
  const selected=resolveVariant([c],{supplier_id:o.supplier_id,model_id:model.id,
   capacity_gb:o.capacity_gb,color:o.color||null});
  if(selected.offer_value_fingerprint!==c.offer_value_fingerprint||
    selected.offer_id!==c.offer_id||selected.offer_revision!==c.offer_revision)deny();
  const calculated=calculateC02({calculation_run_id:calculationRunId,
   c01_candidate:c,calculation_profile:calculationProfile});
  const sale=calculated.normal_sale_price?.amount_minor;
  if(calculated.freshness_status!=='CURRENT'||calculated.execution_status!=='SUCCEEDED'||
   calculated.offer_id!==c.offer_id||calculated.offer_revision!==c.offer_revision||
   calculated.normal_sale_price?.currency!=='BRL'||!Number.isSafeInteger(sale)||
   sale<=0||sale>100000000||!REF.test(calculated.output_fingerprint||''))deny();
  const options=listProductOptions(tradeInCandidates,{limit:100}).items;
  const used=[];
  for(const x of options){
   if(!REF.test(x.model_id||'')||typeof x.label!=='string'||!x.label.trim()||
     x.label.length>100)deny();
   for(const gb of x.capacities_gb){
    const text=CAP.get(gb);
    if(!text)deny();
    used.push({model:x.label,capacity:text,capacity_gb:gb,device_model_id:x.model_id});
   }
  }
  if(!used.length||used.length>200||new Set(used.map(x=>x.model+'|'+x.capacity)).size!==used.length)deny();
  if(tradeInCandidates.some(x=>x.tenant_id!==tenantId))deny();
  // Only a private publication workflow may persist/approve this object.
  return Object.freeze({
   publication:Object.freeze({
    tenant_id:tenantId,public_id:publicId,price_revision:priceRevision,
    status:'draft',sale_price_minor:sale,expires_at_ms:expiresAtMs,
    offer_revision:c.offer_revision,analysis_id:c.analysis_id,offer_id:c.offer_id,
    offer_value_fingerprint:c.offer_value_fingerprint,
    approved_at:null,approved_by:null
   }),
   catalog:Object.freeze({tenant_id:tenantId,public_id:publicId,price_revision:priceRevision,
    desired_model:label,desired_capacity:capacity,desired_condition:condition,
    trade_in_models:used.map(x=>Object.freeze(x))}),
   source:Object.freeze({source:'external-calc-c01-c02',calculation_input_fingerprint:calculated.calculation_input_fingerprint,
    calculation_output_fingerprint:calculated.output_fingerprint,
    calculation_profile_id:calculated.calculation_profile_id,
    calculation_profile_version:calculated.calculation_profile_version,
    rate_profile_id:activeRateProfile.profile_id,
    rate_profile_version:activeRateProfile.version,
    rate_profile_fingerprint:activeRateProfile.fingerprint})
  });
 }catch(_){deny();}
}
module.exports={createExternalCalcUpgradePublicationDraft,DENIED};
