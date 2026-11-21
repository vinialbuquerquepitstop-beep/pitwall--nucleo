'use strict';
// Private V2 queue operator SQL adapter. Requires backend-only tenant-limited
// query role; no HTTP handler, service key, or trust in a public browser.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLAIM=`UPDATE pitwall_private.pw_upgrade_requests
 SET status='PROCESSING',attempts=attempts+1,processing_started_at=now(),updated_at=now()
 WHERE organization_id=$1::uuid AND id=$2::uuid AND attempts<5
 AND (status='RECEIVED' OR (status='PROCESSING' AND processing_started_at<now()-interval '5 minutes'))
 RETURNING id,organization_id,customer_name,whatsapp_digits,selection,consent_at,source,status,lead_id`;
const READ=`SELECT id,organization_id,status,lead_id
 FROM pitwall_private.pw_upgrade_requests WHERE organization_id=$1::uuid
 AND id=$2::uuid LIMIT 2`;
const LINK=`UPDATE pitwall_private.pw_upgrade_requests SET
 status='LINKED',lead_id=$3::uuid,processing_started_at=NULL,updated_at=now()
 WHERE organization_id=$1::uuid AND id=$2::uuid AND status='PROCESSING'
 AND lead_id IS NULL RETURNING id,lead_id`;
const REVIEW=`UPDATE pitwall_private.pw_upgrade_requests SET
 status='REVIEW_REQUIRED',processing_started_at=NULL,updated_at=now()
 WHERE organization_id=$1::uuid AND id=$2::uuid AND status='PROCESSING'
 AND lead_id IS NULL RETURNING id`;
function createUpgradeDeliveryStore({query}={}){
 if(typeof query!=='function')throw Error('UPGRADE_V2_DB_REQUIRED');
 const check=(organizationId,requestId)=>{
  if(!UUID.test(organizationId||'')||!UUID.test(requestId||''))
   throw Error('UPGRADE_V2_INVALID_REFERENCE');
 };
 const one=result=>Array.isArray(result?.rows)&&result.rows.length===1?result.rows[0]:null;
 return Object.freeze({
  async claimRequest({organizationId,requestId}={}){
   check(organizationId,requestId);
   const args=[organizationId,requestId];
   const claimed=one(await query(CLAIM,args));
   if(claimed)return claimed.organization_id===organizationId&&claimed.id===requestId?claimed:null;
   const existing=one(await query(READ,args));
   return existing?.organization_id===organizationId&&existing.id===requestId?
    existing:null;
  },
  async markLinked({organizationId,requestId,leadId}={}){
   check(organizationId,requestId);
   if(!UUID.test(leadId||''))return false;
   const row=one(await query(LINK,[organizationId,requestId,leadId]));
   return row?.id===requestId&&row?.lead_id===leadId;
  },
  async markReview({organizationId,requestId}={}){
   check(organizationId,requestId);
   const row=one(await query(REVIEW,[organizationId,requestId]));
   return row?.id===requestId;
  }
 });
}
module.exports={createUpgradeDeliveryStore,SQL:Object.freeze({CLAIM,READ,LINK,REVIEW})};
