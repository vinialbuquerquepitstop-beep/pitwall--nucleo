'use strict';
// Authority gate for experimental source review. No database or C01 API imports.
// This gate NEVER authorizes persistence: the C01 candidate factory is not yet connected.
const {buildShadowReviewPreflight}=require('./shadow-c01-review-preflight-v1');
const VERSION='external-calc-shadow-authority-gate/v1';
const EXPECTED='external-calc-shadow-c01-preflight/v1';
function auditShadowAuthority(preflight){
 if(!preflight||preflight.contract_version!==EXPECTED||!Array.isArray(preflight.entries))
  throw new Error('SHADOW_PREFLIGHT_CONTRACT_INVALID');
 const rows=preflight.entries.map(entry=>{
  const reasons=new Set(['SHADOW_NOT_C01_CONTRACT','NO_PERSISTENCE_AUTHORITY']);
  if(preflight.supplier_resolution!=='VERIFIED')reasons.add('SUPPLIER_IDENTITY_UNVERIFIED');
  if(!Number.isSafeInteger(entry?.display?.amount_minor)||entry.display.amount_minor<=0)
   reasons.add('PRICE_MISSING_OR_INVALID');
  if(!Number.isSafeInteger(entry?.source_lines?.model)||!Number.isSafeInteger(entry?.source_lines?.price))
   reasons.add('SOURCE_LINE_MISSING');
  if(typeof entry?.source_fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(entry.source_fingerprint))
   reasons.add('SOURCE_FINGERPRINT_INVALID');
  if(entry?.decision!=='REVIEW_REQUIRED'||entry?.c01_candidate!==null||entry?.auto_promotion_authorized!==false||entry?.persistence_authorized!==false)
   reasons.add('UNSAFE_SHADOW_PREFLIGHT');
  for(const reason of entry?.reasons||[])reasons.add(reason);
  return {preflight_id:entry?.preflight_id??null,decision:'BLOCKED',reasons:[...reasons].sort(),
   c01_candidate:null,persistence_authorized:false,auto_promotion_authorized:false};
 });
 return {contract_version:VERSION,source_id:preflight.source_id,
  entries:rows,review_items:rows.length,blocked:rows.length,
  c01_candidates_created:0,persisted:0,auto_promoted:0,
  ready_for_c01_persistence:false,gate_status:'NO_GO'};
}
function auditShadowSource(input){return auditShadowAuthority(buildShadowReviewPreflight(input));}
module.exports={VERSION,auditShadowAuthority,auditShadowSource};
