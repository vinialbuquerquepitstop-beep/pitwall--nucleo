'use strict';
// This is a human-review PREFLIGHT, not a C01 review-candidate factory.
// It must never call persistence, accept a supplier identity, or promote an offer.
const {reconcileShadowSource}=require('./shadow-source-reconciliation-v1');
const crypto=require('node:crypto');
function fingerprint(x){return crypto.createHash('sha256').update(String(x)).digest('hex');}
function buildShadowReviewPreflight({content,filename}={}){
 if(typeof content!=='string'||!content.trim())throw new Error('SOURCE_REQUIRED');
 if(typeof filename!=='string'||!filename.trim())throw new Error('FILENAME_REQUIRED');
 const shadow=reconcileShadowSource(content);
 const sourceId='shadow_'+fingerprint(content).slice(0,24);
 const entries=shadow.candidates.map((row,index)=>{
  const reasons=new Set(['C01_CONTRACT_UNVERIFIED','SUPPLIER_IDENTITY_UNVERIFIED',...(row.reviewReasons||[])]);
  if(!Number.isSafeInteger(row.amount_minor)||row.amount_minor<=0)reasons.add('PRICE_MISSING_OR_INVALID');
  if(!row.model||typeof row.model!=='string')reasons.add('MODEL_MISSING');
  if(!Number.isSafeInteger(row.modelLine)||!Number.isSafeInteger(row.priceLine))reasons.add('SOURCE_LINE_MISSING');
  return {
   preflight_id:'preflight_'+fingerprint([sourceId,row.engine,row.modelLine,row.variantLine,row.priceLine,index].join('|')).slice(0,24),
   source_id:sourceId,engine:row.engine,
   source_lines:{model:row.modelLine,variant:row.variantLine,price:row.priceLine},
   source_fingerprint:row.source_fingerprint,
   display:{model:row.model,variant:row.variant,amount_minor:row.amount_minor,currency:'BRL'},
   reasons:[...reasons].sort(),
   decision:'REVIEW_REQUIRED',c01_candidate:null,
   persistence_authorized:false,auto_promotion_authorized:false
  };
 });
 return {
  contract_version:'external-calc-shadow-c01-preflight/v1',
  source_id:sourceId,filename,
  total:entries.length,review_required:entries.length,
  auto_promoted:0,c01_candidates_created:0,
  supplier_resolution:'UNVERIFIED',
  ready_for_c01_persistence:false,
  entries
 };
}
module.exports={buildShadowReviewPreflight};
