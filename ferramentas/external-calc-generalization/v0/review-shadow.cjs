'use strict';
// VS3: conservative review classification for VS2 SHADOW. No writes or READY.
// Fail closed on tampered evidence, missing provenance, conflicting links, or
// unresolved product regions. Reviewer decisions are outside this module.
const {validateCanonicalDocument}=require('../../external-calc-universal-input/v1/canonical-document');
const {segmentCanonical}=require('./segment-shadow.cjs');
const {resolveAssociations}=require('./associate-shadow.cjs');
const VERSION='external-calc-review-shadow/v0';
const MATERIAL=new Set([
 'CONDITION_CONFLICT','CONDITION_CONFLICT_INLINE_ROW','CONDITION_NOT_EXPLICIT',
 'UNPARSEABLE_PRICE','TWO_PRICES_NO_COLOR','MULTIPLE_INLINE_COLORS',
 'MULTIPLE_COLORS_PRICE_SCOPE_UNCLEAR','MULTIPLE_COLORS_WITHOUT_EVIDENCE',
 'PRICE_WITH_MULTIPLE_LATER_COLORS','PIPED_ROW_UNRESOLVED',
 'CONTRADICTORY_OR_MULTIPLE_PRICES','INCOMPLETE_VARIANT_OR_PRICE',
 'MISSING_SOURCE_PROVENANCE','UNPAIRED_CONTEXT_BEFORE_INLINE',
 'UNPAIRED_CONTEXT_BEFORE_PIPE_ROW','COMPOUND_COLOR_UNRESOLVED'
]);
const scalar=v=>typeof v==='string'&&v.trim().length>0;
function validateShadow(document,structure,association){
 validateCanonicalDocument(document);
 if(!structure||structure.mode!=='SHADOW_READ_ONLY'||!association||
    association.mode!=='SHADOW_READ_ONLY'||
    structure.document_source_hash!==document.source.content_hash||
    association.document_source_hash!==document.source.content_hash||
    !Array.isArray(structure.product_blocks)||
    !Array.isArray(association.proposals)||
    !Array.isArray(association.abstentions)||
    !Array.isArray(association.edges)||
    !Array.isArray(association.offers)||association.offers.length!==0)
    throw Error('VS3_INVALID_SHADOW_ENVELOPE');
 const blocks=new Map(structure.product_blocks.map(b=>[b.block_id,b]));
 if(blocks.size!==structure.product_blocks.length)throw Error('VS3_DUPLICATE_BLOCK_ID');
 const rows=new Map(document.blocks.map(b=>[b.provenance.source_ref,b.text]));
 const sourceOK=ref=>typeof ref==='string'&&rows.has(ref);
 const expectedEdge=(p,relation,ref)=>association.edges.some(e=>
  e.to===p.proposal_id&&e.relation===relation&&e.from===ref);
 const ids=new Set(),assessments=[],globalRisks=[];
 for(const abstention of association.abstentions){
   if(!blocks.has(abstention.block_id)||!scalar(abstention.reason)||
      !Array.isArray(abstention.source_refs)||!abstention.source_refs.every(sourceOK))
     throw Error('VS3_INVALID_ABSTENTION_SOURCE');
 }
 for(const p of association.proposals){
   if(!scalar(p.proposal_id)||ids.has(p.proposal_id))throw Error('VS3_DUPLICATE_PROPOSAL_ID');
   ids.add(p.proposal_id);
   const block=blocks.get(p.block_id);
   if(!block)throw Error('VS3_PROPOSAL_UNKNOWN_BLOCK');
   const scoped=new Set(block.members.map(m=>m.source_ref));
   const reasons=[];
   if(p.decision!=='PROPOSED_REVIEW')reasons.push('PROMOTION_NOT_AUTHORIZED');
   if(p.currency!=='BRL'||!Number.isSafeInteger(p.price_minor)||p.price_minor<=0)
     reasons.push('INVALID_MONETARY_VALUE');
   if(!scalar(p.model)||!scalar(p.color)||!scalar(p.condition))
     reasons.push('MISSING_MATERIAL_FIELD');
   for(const field of ['model','color','price','condition']){
     const refs=p.source_spans?.[field];
     if(!Array.isArray(refs)||refs.length===0||!refs.every(sourceOK)||
       !refs.every(ref=>scoped.has(ref)))reasons.push('SOURCE_OUTSIDE_PRODUCT_BLOCK_'+field.toUpperCase());
   }
   if(!p.source_spans?.model?.includes(block.model_span.source_ref))
     reasons.push('MODEL_ANCHOR_MISMATCH');
   if(!p.source_spans?.price?.some(ref=>expectedEdge(p,'unit_price',ref)))
     reasons.push('MISSING_PRICE_EDGE');
   if(!p.source_spans?.color?.some(ref=>expectedEdge(p,'variant_color',ref)))
     reasons.push('MISSING_COLOR_EDGE');
   if(!p.source_spans?.model?.some(ref=>expectedEdge(p,'product',ref)))
     reasons.push('MISSING_PRODUCT_EDGE');
   const affected=association.abstentions.filter(a=>a.block_id===p.block_id);
   if(affected.length)reasons.push('UNRESOLVED_CONTEXT_IN_PRODUCT_BLOCK');
   const severity=reasons.length?'CRITICAL':'REVIEW';
   assessments.push({
     proposal_id:p.proposal_id,block_id:p.block_id,
     decision:'REVIEW_REQUIRED',severity,source_spans:p.source_spans,
     reasons:[...new Set(reasons.length?reasons:['NOT_HUMAN_APPROVED'])],
     abstentions:affected.map(a=>({reason:a.reason,source_refs:a.source_refs})),
     allowed_actions:['COMPARE_SOURCE','REQUEST_HUMAN_DECISION'],
     forbidden_actions:['AUTO_APPROVE','PERSIST_OFFER','PUBLISH_QUOTE']
   });
 }
 // An unassigned product-like line is not a harmless heading. It can hide
 // missing offers. Treat as a document-level safety issue, not as READY.
 for(const orphan of structure.unassigned||[]){
   if(['product_candidate','price','variant','condition'].includes(orphan.role)||
      orphan.reason==='unconfirmed_product_anchor'){
     globalRisks.push({reason:'UNASSIGNED_MATERIAL_SOURCE',source_refs:[orphan.source_ref],
       role:orphan.role});
   }
 }
 const blocked=assessments.filter(x=>x.severity==='CRITICAL').length;
 const materialAbstentions=association.abstentions.filter(a=>MATERIAL.has(a.reason));
 for(const a of materialAbstentions)globalRisks.push({
   reason:'MATERIAL_ABSTENTION',code:a.reason,block_id:a.block_id,source_refs:a.source_refs
 });
 return {
   contract_version:VERSION,mode:'SHADOW_READ_ONLY',
   document_source_hash:document.source.content_hash,
   decision:'REVIEW_REQUIRED',auto_approvable_count:0,authorized_offers:[],
   candidate_assessments:assessments,global_risks:globalRisks,
   summary:{
     total_proposals:association.proposals.length,
     review_required:assessments.length,
     critical_candidates:blocked,
     material_abstentions:materialAbstentions.length,
     material_unassigned:globalRisks.filter(r=>r.reason==='UNASSIGNED_MATERIAL_SOURCE').length,
     critical_silent_errors_claim:null
   },
   note:'This gate cannot prove absence of silent mistakes by itself; an independent oracle is required.'
 };
}
function evaluateReview(document){
 const structure=segmentCanonical(document);
 const association=resolveAssociations(document,structure);
 return {structure,association,review:validateShadow(document,structure,association)};
}
module.exports={VERSION,validateShadow,evaluateReview};
