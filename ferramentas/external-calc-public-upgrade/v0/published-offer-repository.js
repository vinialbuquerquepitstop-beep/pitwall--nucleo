'use strict';
// UP-06V: private, server-only publication reader. Not connected to Worker.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REF=/^[A-Za-z0-9_-]{1,100}$/;
const QUERY=`SELECT public_id,price_revision,tenant_id,status,sale_price_minor,
 expires_at_ms,offer_revision,analysis_id,offer_id,offer_value_fingerprint
 FROM privado.extcalc_upgrade_publications_v0
 WHERE tenant_id=$1::uuid AND public_id=$2 AND price_revision=$3
 AND status='published' AND approved_at IS NOT NULL AND approved_by IS NOT NULL
 AND revoked_at IS NULL AND expires_at_ms > (extract(epoch from clock_timestamp())*1000)::bigint
 LIMIT 2`;
const DENIED='PUBLICATION_NOT_AUTHORIZED';
// PostgreSQL drivers return BIGINT as decimal strings; reject unsafe conversions.
function safeInt(value){
 if(typeof value==='number')return Number.isSafeInteger(value)?value:null;
 if(typeof value==='string'&&/^(0|[1-9][0-9]{0,15})$/.test(value)){
  const n=Number(value);return Number.isSafeInteger(n)?n:null;
 }
 return null;
}
function createPublishedOfferRepository({query,clock=()=>Date.now(),enabled=false}={}){
 if(enabled!==true)return async()=>{throw Object.assign(new Error('PUBLICATION_DISABLED'),{code:'PUBLICATION_DISABLED'});};
 if(typeof query!=='function')throw new Error('RESTRICTED_QUERY_REQUIRED');
 return async function loadApprovedPublication({tenantId,publicId,revision}={}){
  if(!UUID.test(tenantId||'')||!REF.test(publicId||'')||!REF.test(revision||''))throw Object.assign(new Error(DENIED),{code:DENIED});
  let rows;
  try{const result=await query(QUERY,[tenantId,publicId,revision]);rows=result?.rows;}
  catch(_){throw Object.assign(new Error('PUBLICATION_SOURCE_UNAVAILABLE'),{code:'PUBLICATION_SOURCE_UNAVAILABLE'});}
  if(!Array.isArray(rows)||rows.length!==1)throw Object.assign(new Error(DENIED),{code:DENIED});
  const p=rows[0],salePrice=safeInt(p?.sale_price_minor),expiresAt=safeInt(p?.expires_at_ms),offerRevision=safeInt(p?.offer_revision);
  if(p.tenant_id!==tenantId||p.public_id!==publicId||p.price_revision!==revision||p.status!=='published'||
   salePrice===null||salePrice<0||salePrice>100000000||expiresAt===null||expiresAt<=clock()||
   offerRevision===null||offerRevision<1||!REF.test(p.analysis_id||'')||!REF.test(p.offer_id||'')||
   typeof p.offer_value_fingerprint!=='string'||p.offer_value_fingerprint.length<4||p.offer_value_fingerprint.length>256)
   throw Object.assign(new Error(DENIED),{code:DENIED});
  return Object.freeze({public_id:p.public_id,price_revision:p.price_revision,tenant_id:p.tenant_id,
   status:p.status,sale_price_minor:salePrice,expires_at_ms:expiresAt,
   offer_revision:offerRevision,analysis_id:p.analysis_id,offer_id:p.offer_id,
   offer_value_fingerprint:p.offer_value_fingerprint});
 };
}
module.exports={createPublishedOfferRepository,QUERY};
