'use strict';

const AUTO_PROMOTION_VERSION='external-calc-c01-auto-promotion/v0';
const CRITICAL_FIELDS=new Set(['model','price','capacity_gb','condition']);

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
    if(field&& !CRITICAL_FIELDS.has(field))return false;
    return (item?.sources||[]).some(line=>lines.has(line));
  });
}
function hasCapacityToken(label){
  return /(?:\b\d{2,4}\s*GB\b|(?:\/|\b)[124]\s*TB\b|\b\d{1,3}\s*\/\s*\d{2,4}\s*GB\b)/i.test(String(label||''));
}
function evaluateAutoPromotion(candidate,context={}){
  const reasons=[];
  if(!candidate||candidate.contract_version!=='external-calc-c01-readonly/v1')reasons.push('CANDIDATE_CONTRACT_INVALID');
  if(candidate?.execution_status!=='SUCCEEDED')reasons.push('EXECUTION_NOT_SUCCEEDED');
  if(candidate?.freshness_status!=='CURRENT')reasons.push('NOT_CURRENT');
  const offer=candidate?.interpreted_offer||{};
  if(!offer.model?.id||!offer.model?.label)reasons.push('MODEL_IDENTITY_MISSING');
  if(!Number.isSafeInteger(offer.price?.amount_minor)||offer.price.amount_minor<=0||offer.price.currency!=='BRL')reasons.push('PRICE_INVALID');
  if(hasCapacityToken(offer.model?.label)&&!Number.isInteger(offer.capacity_gb))reasons.push('CAPACITY_EXPECTED_BUT_MISSING');

  const trace=traceByField(candidate);
  const modelScore=trace.model?.score;
  const priceScore=trace.price?.score;
  const capacityScore=trace.capacity_gb?.score;
  if(typeof modelScore!=='number'||modelScore<0.95)reasons.push('MODEL_CONFIDENCE_LOW');
  if(typeof priceScore!=='number'||priceScore<0.90)reasons.push('PRICE_CONFIDENCE_LOW');
  if(Number.isInteger(offer.capacity_gb)&&(typeof capacityScore!=='number'||capacityScore<0.90))reasons.push('CAPACITY_CONFIDENCE_LOW');

  const modelRules=Array.isArray(trace.model?.rules)?trace.model.rules:[];
  if(!modelRules.some(rule=>['direct_extraction','list_intake:canonical_model','list_intake:fallback_model_id'].includes(rule))){
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
function partitionCandidates(queue){
  const auto=[];
  const review=[];
  for(const candidate of queue?.candidates||[]){
    const assessment=evaluateAutoPromotion(candidate,{ambiguities:queue?.unresolved_ambiguities||[]});
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
