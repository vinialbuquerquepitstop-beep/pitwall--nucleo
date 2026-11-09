'use strict';
// UP-06W — internal-only, fail-closed context repository. No real DB route is wired.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REF=/^[A-Za-z0-9_-]{1,100}$/;
const SQL=`SELECT tenant_id,public_id,offer_revision,offers,trade_in_candidates,trade_in_policy,rate_profile
 FROM privado.extcalc_upgrade_context_v0
 WHERE tenant_id=$1::uuid AND public_id=$2 AND offer_revision=$3
 LIMIT 2`;
class ContextDenied extends Error {constructor(code='CONTEXT_UNAVAILABLE'){super(code);this.code=code;}}
const deny=(code)=>{throw new ContextDenied(code)};
const isObject=(x)=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const num=(v)=>typeof v==='number'&&Number.isSafeInteger(v)?v:(typeof v==='string'&&/^[1-9][0-9]{0,14}$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):null);
function createTenantContextRepository({query,enabled=false}={}){
 if(enabled!==true)return async()=>deny('CONTEXT_DISABLED');
 if(typeof query!=='function')throw new Error('TENANT_SCOPED_QUERY_REQUIRED');
 return async function loadTenantScopedContext({tenantId,publicId,publication}={}){
  if(!UUID.test(tenantId||'')||!REF.test(publicId||'')||!isObject(publication)||publication.tenant_id!==tenantId||publication.public_id!==publicId||!REF.test(publication.analysis_id||'')||!REF.test(publication.offer_id||'')||!REF.test(publication.offer_value_fingerprint||'')||!Number.isSafeInteger(publication.offer_revision)||publication.offer_revision<1)deny();
  let rows;
  try{rows=(await query(SQL,[tenantId,publicId,publication.offer_revision]))?.rows;}catch(_){deny();}
  if(!Array.isArray(rows)||rows.length!==1)deny();
  const r=rows[0];
  if(r.tenant_id!==tenantId||r.public_id!==publicId||num(r.offer_revision)!==publication.offer_revision)deny();
  if(!Array.isArray(r.offers)||r.offers.length!==1||!Array.isArray(r.trade_in_candidates)||r.trade_in_candidates.length>100)deny();
  // Every record must be tenant-stamped by the trusted backend.
  const candidates=[...r.offers,...r.trade_in_candidates];
  if(candidates.some(o=>!isObject(o)||o.tenant_id!==tenantId||!REF.test(o.analysis_id||'')||!REF.test(o.offer_id||'')||!Number.isSafeInteger(o.offer_revision)||o.offer_revision<1||!REF.test(o.offer_value_fingerprint||'')||!isObject(o.reviewed_offer)))deny();
  const offer=r.offers[0];
  if(offer.analysis_id!==publication.analysis_id||offer.offer_id!==publication.offer_id||offer.offer_revision!==publication.offer_revision||offer.offer_value_fingerprint!==publication.offer_value_fingerprint)deny('CONTEXT_PUBLICATION_STALE');
  for(const policy of [r.trade_in_policy,r.rate_profile])if(!isObject(policy)||policy.tenant_id!==tenantId||policy.status!=='ACTIVE'||policy.currency!=='BRL')deny('CONTEXT_POLICY_UNAVAILABLE');
  // Private domain context: never serialize to client. Only the port allowlist may leave.
  return Object.freeze({tenant_id:tenantId,public_id:publicId,offer_revision:publication.offer_revision,
   offers:r.offers,tradeInCandidates:r.trade_in_candidates,tradeInPolicy:r.trade_in_policy,rateProfile:r.rate_profile});
 };
}
module.exports={createTenantContextRepository,ContextDenied,SQL};
