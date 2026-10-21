'use strict';
// VS5 read-only compatibility view. This is NOT a C01 candidate or persistence API.
// Converts independently validated shadow propositions to the MATERIAL FIELDS
// displayed by C01, with explicit status and evidence. No review ACCEPT operation.
const crypto=require('node:crypto');
const {parseTextSource}=require('../../external-calc-universal-input/v1/text-adapter');
const {buildQueue}=require('../../external-calc-list-intake/v0/list-intake-api');
const {evaluateReview}=require('./review-shadow.cjs');
const VERSION='external-calc-vs5-compatibility-shadow/v0';
const sha=text=>crypto.createHash('sha256').update(String(text),'utf8').digest('hex');
const normalize=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f\uFE0E\uFE0F]/gu,'').replace(/\s+/gu,' ').trim().toLowerCase();
const commercialKey=offer=>JSON.stringify([
 normalize(offer.model?.label??offer.model),
 offer.capacity_gb??null,normalize(offer.color),normalize(offer.condition),
 offer.price?.amount_minor??offer.price_minor??null,offer.price?.currency??offer.currency??'BRL'
]);
function shadowAsC01ReadOnlyPreview({filename='synthetic.txt',content}){
 if(typeof content!=='string'||!content.trim())throw Error('VS5_SOURCE_REQUIRED');
 const document=parseTextSource({filename,content},{idFactory:()=> 'vs5-'+sha(content).slice(0,24)});
 const {association,review}=evaluateReview(document);
 if(review.authorized_offers.length||review.decision!=='REVIEW_REQUIRED')
   throw Error('VS5_AUTO_PROMOTION_BLOCKED');
 const assessmentById=new Map(review.candidate_assessments.map(r=>[r.proposal_id,r]));
 const previews=association.proposals.map(proposal=>{
   const assessment=assessmentById.get(proposal.proposal_id);
   if(!assessment||assessment.decision!=='REVIEW_REQUIRED')throw Error('VS5_REVIEW_MISSING');
   return {
     preview_contract_version:VERSION,
     shadow_only:true,
     contract_version:null, // never impersonate C01 contract!
     proposal_id:proposal.proposal_id,
     domain_outcome:'REVIEW_REQUIRED',
     stage:'REVIEW',
     review_status:assessment.severity,
     interpreted_offer:{
       supplier_id:null,
       model:{id:null,label:proposal.model,attributes:{}},
       capacity_gb:proposal.capacity_gb,
       condition:proposal.condition,
       color:proposal.color,
       price:{amount_minor:proposal.price_minor,currency:proposal.currency}
     },
     reviewed_offer:null,offer_id:null,offer_revision:null,
     review_evidence:{
       source_lines:Object.values(proposal.source_spans).flat()
         .filter(Boolean).flat()
         .filter((ref,i,list)=>list.indexOf(ref)===i)
         .sort((a,b)=>Number(a.replace('line:',''))-Number(b.replace('line:','')))
         .map(ref=>({
           line_number:Number(ref.replace('line:','')),
           raw:document.blocks.find(block=>block.provenance.source_ref===ref)?.text??null
         })),
       field_sources:Object.fromEntries(
        Object.entries(proposal.source_spans).map(([name,refs])=>[name,refs.map(ref=>Number(ref.replace('line:','')))])
       )
     },
     review_reasons:assessment.reasons,
     provenance_refs:Object.values(proposal.source_spans).flat(),
     authorization:{
       accept_disabled:true,persist_disabled:true,quote_disabled:true,
       publish_disabled:true
     }
   };
 });
 return {
   mode:'VS5_SHADOW_C01_PREVIEW',
   source_hash:document.source.content_hash,
   interpretation_run_id:null,
   production_queue:false,
   review_required:previews.length,auto_promoted:0,persisted:0,
   unresolved:association.abstentions,global_risks:review.global_risks,
   candidates:previews,review_summary:review.summary
 };
}
function compareToExistingC01ReadOnly({filename='synthetic.txt',content}){
 const shadow=shadowAsC01ReadOnlyPreview({filename,content});
 const legacy=buildQueue({filename,content});
 const count=new Map();
 for(const candidate of legacy.queue.candidates){
   const key=commercialKey(candidate.interpreted_offer);
   count.set(key,(count.get(key)||0)+1);
 }
 let exact=0;const shadowOnly=[];
 for(const candidate of shadow.candidates){
   const key=commercialKey(candidate.interpreted_offer),n=count.get(key)||0;
   if(n){exact++;count.set(key,n-1)}else shadowOnly.push({
     proposal_id:candidate.proposal_id,
     material_fields:candidate.interpreted_offer,
     field_sources:candidate.review_evidence.field_sources
   });
 }
 const legacyOnly=[...count.values()].reduce((a,b)=>a+b,0);
 const same=shadowOnly.length===0&&legacyOnly===0;
 return {
   comparison_contract_version:'external-calc-vs5-dual-path-diff/v0',
   mode:'READ_ONLY_COMPARISON',
   source_hash:shadow.source_hash,
   same_source_hash:legacy.canonical.source.content_hash===shadow.source_hash,
   shadow_candidates:shadow.candidates.length,
   existing_c01_candidates:legacy.queue.candidates.length,
   exact_material_matches:exact,shadow_only:shadowOnly,existing_only_count:legacyOnly,
   existing_ambiguities:legacy.queue.unresolved_ambiguities.length,
   shadow_abstentions:shadow.unresolved.length,
   equivalence_status:same?'MATCH':'MISMATCH',
   production_gate:'NO_GO',
   warning:'MATCH compares material multiset only; not authority, review approval, tenant, auth or database readiness.'
 };
}
module.exports={VERSION,shadowAsC01ReadOnlyPreview,compareToExistingC01ReadOnly};
