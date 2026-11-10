'use strict';
// Operator-only reconciliation against the ACTUAL Pitwall V2 contract:
// public.pw_s01_create_lead(p_org_id, p_name, p_phone, p_notes,
//                          p_context, p_acquisition, ...)
// Never exposed by public Upgrade endpoints. The operator identity and org
// must be checked by Pitwall V2 itself; no service_role or anonymous insert.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class CrmReconcileDenied extends Error{constructor(code){super(code);this.code=code;}}
const deny=code=>{throw new CrmReconcileDenied(code)};
const safe=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
function mapUpgradeRequestToCrm(request,organizationId){
 if(!request||typeof request!=='object'||!UUID.test(organizationId||'')||
  request.tenant_id!==organizationId||!UUID.test(request.id||'')||
  !safe(request.customer_name,160)||request.customer_name.trim().length<2||
  !/^55[0-9]{10,11}$/.test(request.whatsapp_digits||'')||
  !request.consent_at||request.source!=='instagram_upgrade'||request.status!=='RECEIVED')deny('UPGRADE_REQUEST_INVALID');
 const s=request.selection;
 const {validateSelection}=require('./public-upgrade-api');
 if(!validateSelection(s))deny('UPGRADE_SELECTION_INVALID');
 const d=s.desired,t=s.trade_in;
 const notes=['Pitstop Upgrade V1','Solicitacao: '+request.id,
  'Novo: '+d.model+' / '+d.capacity+' / '+d.condition,
  'Usado: '+t.model+' / '+t.capacity+' / '+t.condition,
  'Parcelamento solicitado: '+s.installments+'x',
  'Consentimento recebido'].join(' | ');
 if(notes.length>1200)deny('UPGRADE_SELECTION_INVALID');
 const context={
  desired_product:d.model+' / '+d.capacity+' / '+d.condition,
  payment_preference:s.installments===1?'undecided':'card',
  trade_intent:'yes',trade_model:t.model,trade_storage:t.capacity,
  trade_condition_declared:t.condition,next_action:'Conferir aparelho usado e proposta de upgrade'
 };
 return Object.freeze({
  p_org_id:organizationId,p_name:request.customer_name.trim(),
  p_phone:request.whatsapp_digits,p_notes:notes,
  p_context:context,p_acquisition:{source_channel:'instagram'},
  p_initial_stage:'new'
 });
}
function createUpgradeCrmReconciler({enabled=false,organizationId,loadRequest,findExistingLeads,authenticatedOperatorRpc,markLinked}={}){
 if(enabled!==true)return async()=>deny('CRM_RECONCILE_DISABLED');
 if(!UUID.test(organizationId||'')||typeof loadRequest!=='function'||
 typeof findExistingLeads!=='function'||typeof authenticatedOperatorRpc!=='function'||typeof markLinked!=='function')
  throw Error('CRM_V2_OPERATOR_DEPENDENCIES_REQUIRED');
 return async function reconcile({requestId}={}){
  if(!UUID.test(requestId||''))deny('UPGRADE_REQUEST_INVALID');
  let row;
  try{row=await loadRequest({tenantId:organizationId,requestId});}catch(_){deny('CRM_SOURCE_UNAVAILABLE');}
  if(!row||row.tenant_id!==organizationId||row.id!==requestId)deny('UPGRADE_REQUEST_NOT_FOUND');
  if(row.status==='LINKED'&&UUID.test(row.lead_id||''))return Object.freeze({linked:true,lead_id:row.lead_id,already_linked:true});
  if(row.status!=='RECEIVED')deny('UPGRADE_REQUEST_NOT_PENDING');
  const command=mapUpgradeRequestToCrm(row,organizationId);
  // Current Pitwall RPC has no built-in WhatsApp deduplication. An operator
  // must handle existing contacts instead of silently creating another lead.
  let existing;
  try{existing=await findExistingLeads({organizationId,whatsapp:row.whatsapp_digits});}catch(_){deny('CRM_LOOKUP_UNAVAILABLE');}
  if(!Array.isArray(existing)||existing.length>0)deny('CRM_DUPLICATE_REQUIRES_REVIEW');
  let result;
  try{result=await authenticatedOperatorRpc('pw_s01_create_lead',command);}catch(_){deny('CRM_RPC_UNAVAILABLE');}
  // Supabase RPC returns the row directly, not a {ok,lead_id} envelope.
  if(!result||!UUID.test(result.id||'')||result.organization_id!==organizationId)deny('CRM_LEAD_NOT_CONFIRMED');
  let linked;
  try{linked=await markLinked({tenantId:organizationId,requestId,leadId:result.id,expectedStatus:'RECEIVED'});}catch(_){deny('CRM_LINK_FAILED');}
  if(linked!==true)deny('CRM_LINK_FAILED');
  return Object.freeze({linked:true,lead_id:result.id,already_linked:false});
 };
}
module.exports={mapUpgradeRequestToCrm,createUpgradeCrmReconciler,CrmReconcileDenied};
