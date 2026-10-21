'use strict';
// VS5.2: INTERNAL preview-only Service contract, NOT C01 authoritative.
// No database, API route, persistence, review acceptance or execution C02-C05.
const crypto=require('node:crypto');
const {shadowAsC01ReadOnlyPreview}=require('./c01-compatibility-shadow.cjs');
const VERSION='external-calc-vs52-service-preview/v0';
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const nonempty=(v,k)=>{
 if(typeof v!=='string'||!v.trim())throw Object.assign(new Error(k+' required'),{code:'INVALID_TRUSTED_CONTEXT'});
 return v.trim();
};
const safeRef=v=>typeof v==='string'&&/^line:[1-9]\d*$/.test(v);
function createVS52PreviewService({trustedInputResolver}={}){
 if(!trustedInputResolver||typeof trustedInputResolver.resolve!=='function')
   throw new Error('TRUSTED_INPUT_RESOLVER_REQUIRED');
 return Object.freeze({
  version:VERSION,
  async preview({trusted_input_ref,context}={}){
   // Never trust tenant / actor / capabilities provided inside the client
   // request. Context MUST be created by a server-side auth boundary.
   const ref=nonempty(trusted_input_ref,'trusted_input_ref');
   const tenant=nonempty(context?.tenant_id,'context.tenant_id');
   const actor=nonempty(context?.subject,'context.subject');
   if(context?.can_execute_external_calc!==true)
      throw Object.assign(new Error('Forbidden'),{code:'FORBIDDEN'});
   const resolved=await trustedInputResolver.resolve({
      trusted_input_ref:ref,tenant_id:tenant,actor_ref:actor
   });
   if(!resolved||resolved.tenant_id!==tenant||resolved.trusted_input_ref!==ref||
      typeof resolved.content!=='string'||!resolved.content.trim())
      throw Object.assign(new Error('TRUSTED_INPUT_SCOPE_MISMATCH'),{code:'TRUSTED_INPUT_SCOPE_MISMATCH'});
   const preview=shadowAsC01ReadOnlyPreview({
      filename:typeof resolved.filename==='string'?resolved.filename:'trusted-input.txt',
      content:resolved.content
   });
   if(preview.production_queue!==false||preview.auto_promoted!==0||preview.persisted!==0)
      throw new Error('PREVIEW_AUTHORITY_BREACH');
   for(const candidate of preview.candidates){
     if(candidate.contract_version!==null||candidate.offer_id!==null||
        candidate.offer_revision!==null||candidate.reviewed_offer!==null||
        candidate.domain_outcome!=='REVIEW_REQUIRED'||
        Object.values(candidate.authorization||{}).some(x=>x!==true)||
        Object.keys(candidate.authorization||{}).length!==4)
       throw new Error('C01_AUTHORITY_IMPERSONATION');
     if(!Object.values(candidate.review_evidence?.field_sources||{}).flat()
       .every(n=>Number.isSafeInteger(n)&&n>0))
       throw new Error('MISSING_OR_INVALID_PROVENANCE');
     if(!Array.isArray(candidate.provenance_refs)||!candidate.provenance_refs.every(safeRef))
       throw new Error('INVALID_SOURCE_REFS');
   }
   const snapshot=digest(JSON.stringify({
     contract_version:VERSION,source_hash:preview.source_hash,
     tenant,actor,ref,candidates:preview.candidates.map(c=>({
       proposal_id:c.proposal_id,offer:c.interpreted_offer,
       evidence:c.review_evidence?.field_sources,review_reasons:c.review_reasons
     })),risks:preview.global_risks
   }));
   return {
     contract_version:VERSION,
     mode:'READ_ONLY_PREVIEW',
     tenant_id:tenant,actor_ref:actor,
     trusted_input_ref:ref,source_hash:preview.source_hash,
     preview_fingerprint:'sha256:'+snapshot,
     execution_status:'SUCCEEDED',domain_outcome:'REVIEW_REQUIRED',
     stage:'REVIEW',freshness_status:'PREVIEW_ONLY',
     candidates:preview.candidates,
     unresolved_ambiguities:preview.unresolved,
     global_risks:preview.global_risks,
     review_summary:preview.review_summary,
     authorization:{accept:false,persist:false,quote:false,publish:false},
     // This preview never becomes the existing canonical C01 contract.
     analysis_id:null,offer_id:null,offer_revision:null,
     authorized_offers:[],persisted_count:0,
     lifecycle:'NOT_REGISTERED',
     limitations:'No C01 authority; runtime integration and E2E tests are still required.'
   };
  }
 });
}
module.exports={VERSION,createVS52PreviewService};
