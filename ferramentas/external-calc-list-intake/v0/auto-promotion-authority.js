'use strict';
const { linkedPriceHasExactAmount }=require('./source-price-evidence');

const AUTO_PROMOTION_VERSION='external-calc-c01-auto-promotion/v0';
const CRITICAL_FIELDS=new Set(['model','price','capacity_gb','condition','color']);

function traceByField(candidate){
  const out={};
  for(const item of candidate?.trace||[]){
    if(item&&typeof item.field==='string')out[item.field]=item;
  }
  return out;
}
function sourceSet(candidate){
  return new Set((candidate?.review_evidence?.source_lines||[])
    .map(line=>line?.line_number)
    .filter(Number.isSafeInteger));
}
function linkedMaterialAmbiguities(candidate,ambiguities){
  const lines=sourceSet(candidate);
  return (ambiguities||[]).filter(item=>{
    const field=item?.field;
    if(!field || !CRITICAL_FIELDS.has(field))return false;
    return (item?.sources||[]).some(line=>lines.has(line));
  });
}
function hasCapacityToken(label){
  return /(?:\b\d{2,4}\s*GB\b|(?:\/|\b)[124]\s*TB\b|\b\d{1,3}\s*\/\s*\d{2,4}\s*GB\b|\b(?:iPhone\s+)?1[1-8](?:\s+(?:Pro\s+Max|Pro|Plus|Air))?\s+(?:64|128|256|512)\b)/i.test(String(label||''));
}
function hasFieldSourceEvidence(candidate,field){
  const evidence=candidate?.review_evidence;
  const linked=evidence?.field_sources?.[field];
  if(!Array.isArray(linked)||!linked.length)return false;
  const lines=new Map((evidence?.source_lines||[])
    .filter(item=>Number.isSafeInteger(item?.line_number)&&item.line_number>0
      && typeof item.raw==='string'&&item.raw.trim())
    .map(item=>[item.line_number,item.raw]));
  return linked.every(number=>Number.isSafeInteger(number)&&number>0&&lines.has(number));
}
function evaluateAutoPromotion(candidate,context={}){
  const reasons=[];
  if(context.supplierVerified!==true)reasons.push('SUPPLIER_IDENTITY_UNVERIFIED');
  if(context.price_risk==='OUTLIER_REVIEW_REQUIRED')reasons.push('PRICE_OUTLIER_REVIEW_REQUIRED');
  if(!candidate||candidate.contract_version!=='external-calc-c01-readonly/v1')reasons.push('CANDIDATE_CONTRACT_INVALID');
  if(candidate?.execution_status!=='SUCCEEDED')reasons.push('EXECUTION_NOT_SUCCEEDED');
  if(candidate?.freshness_status!=='CURRENT')reasons.push('NOT_CURRENT');
  const offer=candidate?.interpreted_offer||{};
  if(!offer.model?.id||!offer.model?.label)reasons.push('MODEL_IDENTITY_MISSING');
  if(!Number.isSafeInteger(offer.price?.amount_minor)||offer.price.amount_minor<=0||offer.price.currency!=='BRL')reasons.push('PRICE_INVALID');
  if(hasCapacityToken(offer.model?.label)&&!Number.isInteger(offer.capacity_gb))reasons.push('CAPACITY_EXPECTED_BUT_MISSING');
  if(!hasFieldSourceEvidence(candidate,'model'))reasons.push('MODEL_SOURCE_UNVERIFIED');
  if(!hasFieldSourceEvidence(candidate,'price'))reasons.push('PRICE_SOURCE_UNVERIFIED');
  else if(!linkedPriceHasExactAmount(candidate))reasons.push('PRICE_SOURCE_AMOUNT_UNVERIFIED');

  const trace=traceByField(candidate);
  const modelScore=trace.model?.score;
  const priceScore=trace.price?.score;
  const capacityScore=trace.capacity_gb?.score;
  if(typeof modelScore!=='number'||modelScore<0.95)reasons.push('MODEL_CONFIDENCE_LOW');
  if(typeof priceScore!=='number'||priceScore<0.90)reasons.push('PRICE_CONFIDENCE_LOW');
  if(Number.isInteger(offer.capacity_gb)&&(typeof capacityScore!=='number'||capacityScore<0.90))reasons.push('CAPACITY_CONFIDENCE_LOW');

  const modelRules=Array.isArray(trace.model?.rules)?trace.model.rules:[];
  if(!modelRules.some(rule=>['direct_extraction','list_intake:canonical_model','list_intake:fallback_model_id','list_advisor:structured_output'].includes(rule))){
    reasons.push('MODEL_PROVENANCE_NOT_DIRECT');
  }

  const linked=linkedMaterialAmbiguities(candidate,context.ambiguities||[]);
  if(linked.length)reasons.push('MATERIAL_AMBIGUITY_LINKED');

  return {
    authority_version:AUTO_PROMOTION_VERSION,
    eligible:reasons.length===0,
    reasons,
    evidence:{
      model_score:typeof modelScore==='number'?modelScore:null,
      price_score:typeof priceScore==='number'?priceScore:null,
      capacity_score:typeof capacityScore==='number'?capacityScore:null,
      linked_material_ambiguities:linked.map(item=>item.ambiguity_id)
    }
  };
}
function promoteCandidate(candidate,assessment){
  if(!assessment?.eligible)throw new Error('candidate nao elegivel para auto promocao');
  return {
    ...JSON.parse(JSON.stringify(candidate)),
    stage:'READY',
    domain_outcome:'VALID',
    reviewed_offer:JSON.parse(JSON.stringify(candidate.interpreted_offer)),
    review:null,
    auto_promotion:{
      authority_version:assessment.authority_version,
      decision:'AUTO_PROMOTE',
      promoted_at:null,
      reasons:[],
      evidence:assessment.evidence
    },
    provenance_refs:[
      ...(candidate.provenance_refs||[]),
      'auto_promotion:'+assessment.authority_version
    ]
  };
}
function siblingPriceOutliers(candidates){
  const groups=new Map();
  for(const candidate of candidates||[]){
    const offer=candidate?.interpreted_offer||{};
    const price=offer.price?.amount_minor;
    if(!offer.model?.id||!Number.isSafeInteger(price)||price<=0)continue;
    const key=JSON.stringify([offer.model.id,offer.capacity_gb??null,offer.condition??null]);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push({candidate,price});
  }
  const outliers=new Set();
  for(const siblings of groups.values()){
    // At least three independent price observations for the same product identity.
    const prices=[...new Set(siblings.map(x=>x.price))].sort((a,b)=>a-b);
    if(prices.length<3)continue;
    const mid=Math.floor(prices.length/2);
    const median=prices.length%2?prices[mid]:(prices[mid-1]+prices[mid])/2;
    for(const {candidate,price} of siblings){
      if(price*3<median||price>median*3)outliers.add(candidate);
    }
  }
  return outliers;
}
function partitionCandidates(queue,context={}){
  const auto=[];
  const review=[];
  const priceOutliers=siblingPriceOutliers(queue?.candidates);
  for(const candidate of queue?.candidates||[]){
    const assessment=evaluateAutoPromotion(candidate,{...context,ambiguities:queue?.unresolved_ambiguities||[]});
    if(priceOutliers.has(candidate)){
      assessment.eligible=false;
      assessment.reasons.push('SIBLING_PRICE_OUTLIER');
    }
    if(assessment.eligible)auto.push({candidate,promoted:promoteCandidate(candidate,assessment),assessment});
    else review.push({candidate,assessment});
  }
  return {auto,review};
}

module.exports={
  AUTO_PROMOTION_VERSION,
  evaluateAutoPromotion,
  promoteCandidate,
  partitionCandidates
};
