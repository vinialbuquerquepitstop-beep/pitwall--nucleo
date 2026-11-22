'use strict';
// SQL for dedicated Pitwall V2 private receipt storage, never in External Calc.
// The injected query must run under a separately authorized backend identity,
// not under anon, browser-provided JWT, or a privileged key exposed to clients.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INSERT=`INSERT INTO pitwall_private.pw_upgrade_requests
 (organization_id,request_key,payload_hash,customer_name,whatsapp_digits,
 selection,consent_at,source,status)
 VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb,now(),$7,'RECEIVED')
 ON CONFLICT (organization_id,request_key) DO NOTHING
 RETURNING id,payload_hash`;
const EXISTING=`SELECT id,payload_hash FROM pitwall_private.pw_upgrade_requests
 WHERE organization_id=$1::uuid AND request_key=$2::uuid LIMIT 2`;
function createUpgradeV2ReceiptStore({query}={}){
 if(typeof query!=='function')throw Error('UPGRADE_V2_DB_REQUIRED');
 return async function store({organizationId,requestKey,payloadHash,selection,contact,consent,source}={}){
  if(!UUID.test(organizationId||'')||!UUID.test(requestKey||'')||
    !/^[a-f0-9]{64}$/.test(payloadHash||'')||consent!==true||
    source!=='instagram_upgrade'||!selection||!contact)throw Error('UPGRADE_INTAKE_INVALID');
  const values=[organizationId,requestKey,payloadHash,contact.name,contact.whatsapp,
   JSON.stringify(selection),source];
  let inserted;
  try{inserted=await query(INSERT,values);}catch{throw Error('UPGRADE_INTAKE_UNAVAILABLE');}
  if(inserted?.rows?.length===1&&UUID.test(inserted.rows[0]?.id||'')&&
    inserted.rows[0].payload_hash===payloadHash)
   return {accepted:true,id:inserted.rows[0].id};
  if(!Array.isArray(inserted?.rows)||inserted.rows.length!==0)
   throw Error('UPGRADE_INTAKE_UNAVAILABLE');
  let existing;
  try{existing=await query(EXISTING,values.slice(0,2));}
  catch{throw Error('UPGRADE_INTAKE_UNAVAILABLE');}
  if(!Array.isArray(existing?.rows)||existing.rows.length!==1||
    !UUID.test(existing.rows[0].id||''))throw Error('UPGRADE_INTAKE_UNAVAILABLE');
  if(existing.rows[0].payload_hash!==payloadHash)
   throw Object.assign(new Error('UPGRADE_INTAKE_CONFLICT'),{code:'UPGRADE_INTAKE_CONFLICT'});
  return {accepted:true,id:existing.rows[0].id};
 };
}
module.exports={createUpgradeV2ReceiptStore,SQL:Object.freeze({INSERT,EXISTING})};
