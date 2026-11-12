'use strict';
const crypto=require('node:crypto');
const {mapBundleToC01ReviewQueue}=require('../../external-calc-c01/v1/c01-readonly-bridge');
const {resolvePortableOfferStates}=require('./canonical-model-resolver');

// This is a READ-ONLY staging bridge. AI does not assign catalog model IDs,
// authoritatively approve prices or choose a tenant. C01 remains REVIEW_REQUIRED.
const sha=x=>crypto.createHash('sha256').update(x,'utf8').digest('hex');
const id=(prefix,x)=>prefix+'_'+sha(x).slice(0,24);

function previewExternalAiC01(extraction){
 if(!extraction||extraction.valid!==true||extraction.authority!=='STAGING_ONLY')throw new Error('VALIDATED_AI_EXTRACTION_REQUIRED');
 const sourceFingerprint=sha(extraction.sources.map(s=>s.source_ref+'\x1f'+s.text).join('\x1e'));
 const modelStates=resolvePortableOfferStates(extraction);
 const stateByRef=new Map(modelStates.map(x=>[x.offer_ref,x]));
 const analysis_id=id('analysis','ai-preview|'+sourceFingerprint);
 const source_id=id('source','ai-preview|'+sourceFingerprint);
 const run_id='ai-preview-'+sourceFingerprint.slice(0,24);
 const records=[],segments=[],reviewOnly=[],sourceRefsByRecord=[];
 let line=0;
 const sourceIds=new Set(extraction.sources.map(s=>s.source_ref));
 const issueRefs=new Set(extraction.issues.map(i=>i.offer_ref));
 for(const offer of extraction.offers){
  if(!offer.model||!offer.price||!sourceIds.size){
   reviewOnly.push({offer_ref:offer.offer_ref,reason:'MISSING_MODEL_OR_PRICE'});
   continue;
  }
  const trace=[];
  for(const [field,evidences] of Object.entries(offer.field_evidence)){
   const refs=[];
   for(const e of evidences){
    const source=extraction.sources.find(s=>s.source_ref===e.source_ref);
    if(!source)throw new Error('AI_EVIDENCE_SOURCE_INVALID');
    line++;
    segments.push({line_number:line,raw:e.quote,source_ref:e.source_ref,filename:source.filename});
    refs.push(line);
   }
   if(field==='raw_model'||field==='brand'||field==='supplier_ref')continue;
   trace.push({field,rules:['external_ai:quoted_source_untrusted'],score:null,sources:refs,alternatives:[],derived_from:refs});
  }
  // Retain a human-readable model but never fabricate a catalog model.id.
  sourceRefsByRecord.push(offer.source_refs.slice());
  const resolution=stateByRef.get(offer.offer_ref);
  records.push({
   record_id:'ai-'+sha(offer.offer_ref+'|'+sourceFingerprint).slice(0,24),
   state:'REVIEW_REQUIRED',
   fields:{
    supplier:null,
    model:resolution?.model_entity||String(offer.model),
    capacity_gb:offer.capacity_gb,
    color:offer.color,
    condition:offer.condition,
    price:offer.price.amount_minor/100
   },
   trace
  });
  if(issueRefs.has(offer.offer_ref))reviewOnly.push({offer_ref:offer.offer_ref,reason:'FIELD_ISSUES'});
 }
 const bundle={
  contract_version:'interpretation-bundle/v1',
  run:{run_id,engine_version:'external-ai-staging/v0'},
  records,segments,ambiguities:[],invalid:[],warnings:[]
 };
 const queue=mapBundleToC01ReviewQueue(bundle,{analysis_id,source_id,currency:'BRL'});
 for(let i=0;i<queue.candidates.length;i++){
  queue.candidates[i].provenance_refs.push(...sourceRefsByRecord[i].map(ref=>'external_ai_source:'+ref));
 }
 // Restrict all output to manual review. The model.id is null and trace has
 // no internal authority score. Never call auto-promotion from this bridge.
 if(queue.candidates.some(x=>x.domain_outcome!=='REVIEW_REQUIRED'))
  throw new Error('AI_STAGING_MUST_REQUIRE_C01_REVIEW');
 return {
  source_id,analysis_id,
  total_offers:extraction.offers.length,
  c01_review_candidates:queue.candidates.length,
  pre_c01_review_only:reviewOnly.length,
  invalid_or_unmapped:extraction.offers.length-queue.candidates.length,
  coverage_complete:extraction.coverage_complete,
  catalog_resolved:modelStates.filter(x=>x.state==='CATALOG_RESOLVED_PREVIEW').length,
  catalog_needs_review:modelStates.filter(x=>x.state==='REVIEW_REQUIRED').length,
  auto_promoted:0,
  persistence_allowed:false,
  authority:'C01_PREVIEW_ONLY',
  queue,model_states:modelStates
 };
}
module.exports={previewExternalAiC01};
