'use strict';
// Composite proof only. This module has no write dependencies and returns NO_GO.
const {resolveShadowSupplier}=require('./shadow-supplier-resolution-preflight-v1');
const {buildShadowReviewPreflight}=require('./shadow-c01-review-preflight-v1');
const {auditShadowAuthority}=require('./shadow-authority-gate-v1');
const CONTRACT='external-calc-shadow-integrated-readonly/v1';
function auditIntegratedShadow({filename,content,suppliers=[]}={}){
 const supplier=resolveShadowSupplier({filename,content,suppliers});
 const preflight=buildShadowReviewPreflight({filename,content});
 const authority=auditShadowAuthority(preflight);
 if(preflight.total!==authority.blocked || authority.auto_promoted!==0 || authority.persisted!==0)
  throw new Error('SHADOW_AUTHORITY_INVARIANT_FAILED');
 return {
  contract_version:CONTRACT,
  source_id:preflight.source_id,
  supplier:{
   state:supplier.state,matched_supplier_id:supplier.matched_supplier_id,
   supplier_create_authorized:false,confidence:supplier.confidence
  },
  summary:{
   interpreted:preflight.total,blocked:authority.blocked,
   persisted:0,auto_promoted:0,c01_candidates_created:0
  },
  decisions:authority.entries,
  review_preflight:preflight.entries,
  c01_persistence_authorized:false,
  ready_for_c01_persistence:false,
  status:'NO_GO'
 };
}
module.exports={auditIntegratedShadow,CONTRACT};
