'use strict';
// Shadow supplier resolution is advisory; it NEVER writes a supplier or C01 record.
const {resolveExistingSupplier,candidateSupplierHeader}=require('../../external-calc-batch-intake/v0/batch-list-intake-api');
const CONTRACT='external-calc-shadow-supplier-preflight/v1';
function resolveShadowSupplier({filename,content,suppliers=[]}={}){
 if(typeof filename!=='string'||!filename.trim())throw new Error('FILENAME_REQUIRED');
 if(typeof content!=='string'||!content.trim())throw new Error('CONTENT_REQUIRED');
 if(!Array.isArray(suppliers))throw new Error('SUPPLIER_CATALOG_INVALID');
 // Explicitly project trusted catalog fields and forbid supplier writes in this module.
 const catalog=suppliers.filter(s=>s&&typeof s.supplier_id==='string'&&s.supplier_id.trim()
   &&typeof s.name==='string'&&s.name.trim()).map(s=>({
    supplier_id:s.supplier_id,name:s.name,phone:s.phone??null,city:s.city??null
   }));
 const result=resolveExistingSupplier({filename,content,suppliers:catalog});
 const candidate=result.state==='NOT_FOUND'?candidateSupplierHeader(content):null;
 const state=result.state==='MATCHED_EXISTING'?'MATCHED_EXISTING_REVIEW_ONLY'
   :result.state==='AMBIGUOUS'?'AMBIGUOUS_REVIEW_ONLY':'UNKNOWN_REVIEW_ONLY';
 return {
  contract_version:CONTRACT,filename,
  state,
  matched_supplier_id:result.state==='MATCHED_EXISTING'?result.supplier?.supplier_id??null:null,
  proposed_supplier:result.state==='NOT_FOUND'&&candidate?
   {name:candidate.name,confidence:candidate.confidence}:null,
  alternatives:result.alternatives||[],
  confidence:result.confidence,
  supplier_create_authorized:false,
  c01_persistence_authorized:false,
  auto_promotion_authorized:false,
  requires_human_review:true,
  release_status:'NO_GO'
 };
}
module.exports={resolveShadowSupplier,CONTRACT};
