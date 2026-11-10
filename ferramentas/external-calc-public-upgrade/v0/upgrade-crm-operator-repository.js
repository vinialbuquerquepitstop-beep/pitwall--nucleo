'use strict';
// Trusted operator-side adapter. query must use authenticated, tenant-scoped DB role;
// never accept tenantId from browser, never grant this role to anon.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOAD=`SELECT id,tenant_id,customer_name,whatsapp_digits,selection,consent_at,source,status,lead_id
 FROM privado.upgrade_requests_v1
 WHERE tenant_id=$1::uuid AND id=$2::uuid LIMIT 2`;
const MARK=`UPDATE privado.upgrade_requests_v1 SET status='LINKED',lead_id=$3::uuid,updated_at=now()
 WHERE tenant_id=$1::uuid AND id=$2::uuid AND status=$4 AND lead_id IS NULL
 RETURNING id,tenant_id,lead_id`;
function createUpgradeCrmOperatorRepository({query,tenantId,enabled=false}={}){
 if(enabled!==true)return Object.freeze({loadRequest:async()=>{throw Error('CRM_RECONCILE_DISABLED');},markLinked:async()=>{throw Error('CRM_RECONCILE_DISABLED');}});
 if(!UUID.test(tenantId||'')||typeof query!=='function')throw Error('CRM_OPERATOR_DB_REQUIRED');
 async function loadRequest({tenantId:verifiedTenant,requestId}={}){
  if(verifiedTenant!==tenantId||!UUID.test(requestId||''))return null;
  let r;try{r=await query(LOAD,[tenantId,requestId]);}catch(_){throw Error('CRM_SOURCE_UNAVAILABLE');}
  if(!Array.isArray(r?.rows)||r.rows.length!==1||r.rows[0].tenant_id!==tenantId||r.rows[0].id!==requestId)return null;
  return r.rows[0];
 }
 async function markLinked({tenantId:verifiedTenant,requestId,leadId,expectedStatus}={}){
  if(verifiedTenant!==tenantId||!UUID.test(requestId||'')||!UUID.test(leadId||'')||expectedStatus!=='RECEIVED')return false;
  let r;try{r=await query(MARK,[tenantId,requestId,leadId,expectedStatus]);}catch(_){return false;}
  return Array.isArray(r?.rows)&&r.rows.length===1&&r.rows[0].id===requestId&&r.rows[0].tenant_id===tenantId&&r.rows[0].lead_id===leadId;
 }
 return Object.freeze({loadRequest,markLinked});
}
module.exports={createUpgradeCrmOperatorRepository,LOAD,MARK};
