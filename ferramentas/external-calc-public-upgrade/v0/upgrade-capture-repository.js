'use strict';
// Server-only, tenant authority must be injected from verified runtime identity.
// SQL is evaluated under a dedicated restricted PostgreSQL role, never under anon.
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const INSERT=`INSERT INTO privado.upgrade_requests_v1
 (tenant_id,request_key,customer_name,whatsapp_digits,selection,consent_at,source)
 VALUES ($1::uuid,$2::uuid,$3,$4,$5::jsonb,now(),'instagram_upgrade')
 ON CONFLICT(tenant_id,request_key) DO NOTHING RETURNING id`;
const RECHECK=`SELECT id FROM privado.upgrade_requests_v1
 WHERE tenant_id=$1::uuid AND request_key=$2::uuid
 AND customer_name=$3 AND whatsapp_digits=$4 AND selection=$5::jsonb
 AND source='instagram_upgrade' LIMIT 2`;
const REF=id=>'upg_'+id.replaceAll('-','');
class UpgradeCaptureDenied extends Error{constructor(code){super(code);this.code=code;}}
function fail(code){throw new UpgradeCaptureDenied(code);}
function createUpgradeCaptureRepository({query,tenantId,enabled=false}={}){
 if(enabled!==true)return async()=>fail('CAPTURE_DISABLED');
 if(typeof query!=='function'||!UUID.test(tenantId||''))throw Error('CAPTURE_TRUSTED_DEPENDENCIES_REQUIRED');
 return async function capture({selection,contact,consent,request_key}={}){
  if(!UUID.test(request_key||'')||consent!==true||!selection||typeof selection!=='object'||Array.isArray(selection)||
     !contact||typeof contact!=='object'||typeof contact.name!=='string'||!contact.name.trim()||
     contact.name.trim().length>80||typeof contact.whatsapp!=='string'||!/^55[0-9]{10,11}$/.test(contact.whatsapp))fail('CAPTURE_INVALID');
  const {validateSelection}=require('./public-upgrade-api');
  if(!validateSelection(selection))fail('CAPTURE_INVALID');
  const params=[tenantId,request_key,contact.name.trim(),contact.whatsapp,JSON.stringify(selection)];
  let first;
  try{first=await query(INSERT,params);}catch(_){fail('CAPTURE_STORE_UNAVAILABLE');}
  if(first?.rows?.length===1&&UUID.test(first.rows[0]?.id||''))return {accepted:true,reference:REF(first.rows[0].id)};
  if(first?.rows?.length!==0)fail('CAPTURE_STORE_UNAVAILABLE');
  let second;
  try{second=await query(RECHECK,params);}catch(_){fail('CAPTURE_STORE_UNAVAILABLE');}
  if(!Array.isArray(second?.rows)||second.rows.length!==1||!UUID.test(second.rows[0]?.id||''))fail('CAPTURE_IDEMPOTENCY_CONFLICT');
  return {accepted:true,reference:REF(second.rows[0].id)};
 };
}
module.exports={createUpgradeCaptureRepository,INSERT,RECHECK};
