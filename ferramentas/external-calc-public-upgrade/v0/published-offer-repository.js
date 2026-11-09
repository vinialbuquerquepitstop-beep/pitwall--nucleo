'use strict';
// UP-06U: trusted server-side publication lookup. NOT wired to Worker.
// Requires future restricted DB view/table owned by publishing authority.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REF=/^[A-Za-z0-9_-]{1,100}$/;
const QUERY=`SELECT public_id,price_revision,tenant_id,status,sale_price_minor,
 expires_at_ms,offer_revision,analysis_id,offer_id,offer_value_fingerprint
 FROM privado.extcalc_upgrade_publications_v0
 WHERE tenant_id=$1::uuid AND public_id=$2 AND price_revision=$3 AND status='published'
 LIMIT 2`;
const DENIED='PUBLICATION_NOT_AUTHORIZED';
function createPublishedOfferRepository({query,clock=()=>Date.now(),enabled=false}={}){
 if(enabled!==true) return async()=>{throw Object.assign(new Error('PUBLICATION_DISABLED'),{code:'PUBLICATION_DISABLED'});};
 if(typeof query!=='function') throw new Error('RESTRICTED_QUERY_REQUIRED');
 return async function loadApprovedPublication({tenantId,publicId,revision}={}){
  if(!UUID.test(tenantId||'')||!REF.test(publicId||'')||!REF.test(revision||''))throw Object.assign(new Error(DENIED),{code:DENIED});
  let rows;
  try {const result=await query(QUERY,[tenantId,publicId,revision]); rows=result?.rows;}
  catch(_) {throw Object.assign(new Error('PUBLICATION_SOURCE_UNAVAILABLE'),{code:'PUBLICATION_SOURCE_UNAVAILABLE'});}
  if(!Array.isArray(rows)||rows.length!==1)throw Object.assign(new Error(DENIED),{code:DENIED});
  const p=rows[0];
  if(p.tenant_id!==tenantId||p.public_id!==publicId||p.price_revision!==revision||p.status!=='published'||
   !Number.isSafeInteger(p.sale_price_minor)||p.sale_price_minor<0||p.sale_price_minor>100000000||
   !Number.isSafeInteger(p.expires_at_ms)||p.expires_at_ms<=clock()||
   !Number.isSafeInteger(p.offer_revision)||p.offer_revision<1||
   !REF.test(p.analysis_id||'')||!REF.test(p.offer_id||'')||
   typeof p.offer_value_fingerprint!=='string'||p.offer_value_fingerprint.length<4||p.offer_value_fingerprint.length>256)
    throw Object.assign(new Error(DENIED),{code:DENIED});
  return Object.freeze({public_id:p.public_id,price_revision:p.price_revision,tenant_id:p.tenant_id,
   status:p.status,sale_price_minor:p.sale_price_minor,expires_at_ms:p.expires_at_ms,
   offer_revision:p.offer_revision,analysis_id:p.analysis_id,offer_id:p.offer_id,
   offer_value_fingerprint:p.offer_value_fingerprint});
 };
}
module.exports={createPublishedOfferRepository,QUERY};
