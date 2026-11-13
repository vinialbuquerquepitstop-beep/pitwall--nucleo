'use strict';

// Resolve untrusted AI labels ONLY against the existing canonical knowledge
// snapshot and Interpreter Core's exact alias/label resolver. No fallback ID,
// no fuzzy match and no authority inferred from AI confidence.
const {buildKnowledgeIndex,resolveEntityCandidate,normalizeKey}=require('../../interpreter-core/v1/core');
const catalog=require('../../interpreter-core/v1/domains/apple-iphone-v0.knowledge.json');
const INDEX=buildKnowledgeIndex(catalog);
const FIELD={name:'model',resolver:{kind:'entity',entity_kind:'model',match:['alias','label']}};

function resolveExternalAiModel(offer){
 if(!offer||typeof offer.model!=='string'||!offer.model.trim())
  return {state:'REVIEW_REQUIRED',reason:'MODEL_MISSING',entity:null};
 const name=offer.model.trim();
 const capacity=offer.capacity_gb;
 if(!Number.isSafeInteger(capacity)||capacity<=0)
  return {state:'REVIEW_REQUIRED',reason:'CAPACITY_MISSING',entity:null};
 // The knowledge snapshot models include capacity. Try only precise variant
 // names. A generic 'iPhone 17' with capacity 256 may match catalog display
 // name + exact capacity if UNIQUE; it is NOT a fuzzy/substring match.
 const withCapacity=name.match(/\b\d{2,4}\s*GB\b/i)?name:name+' '+capacity+'GB';
 const variants=[withCapacity];
 const results=[];
 for(const value of variants){
  const match=resolveEntityCandidate({field:'model',value,score:1,evidence:{line_number:null}},FIELD,INDEX);
  if(match.entity_id && Number(match.attributes?.capacity_gb)===capacity)
   results.push(match);
 }
 const unique=[...new Map(results.map(r=>[r.entity_id,r])).values()];
 if(unique.length!==1)
  return {state:'REVIEW_REQUIRED',reason:unique.length?'MODEL_AMBIGUOUS':'MODEL_NOT_IN_CATALOG',entity:null};
 const r=unique[0];
 return {state:'RESOLVED',reason:null,entity:{id:r.entity_id,label:r.value,attributes:r.attributes||{}},resolver:'interpreter-core/exact-catalog'};
}
function resolvePortableOfferStates(extraction){
 const out=[];
 const issueRefs=new Set((extraction.issues||[]).map(i=>i.offer_ref));
 for(const offer of extraction.offers||[]){
  const model=resolveExternalAiModel(offer);
  const reasons=[];
  if(model.state!=='RESOLVED')reasons.push(model.reason);
  if(issueRefs.has(offer.offer_ref))reasons.push('FIELD_OR_SOURCE_ISSUES');
  if(!offer.price)reasons.push('PRICE_MISSING');
  if(!extraction.original_sources_verified)reasons.push('ORIGINAL_SOURCE_UNVERIFIED');
  if(!extraction.coverage_complete)reasons.push('COVERAGE_INCOMPLETE');
  // In this gate all "resolved" offers are eligible only for a verified C01
  // candidate preview, never an automatic C01 VALID write.
  out.push({offer_ref:offer.offer_ref,
   state:reasons.length?'REVIEW_REQUIRED':'CATALOG_RESOLVED_PREVIEW',
   reasons,model_entity:model.entity,
   persistence_allowed:false,auto_promotion_allowed:false});
 }
 return out;
}
module.exports={resolveExternalAiModel,resolvePortableOfferStates};
