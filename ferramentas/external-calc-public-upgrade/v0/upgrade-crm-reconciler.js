'use strict';
// UP-V1: map a previously persisted, tenant-scoped Upgrade request into
// the existing authenticated CRM cadastrar_lead contract.
// This is NOT callable by the public HTTP capture route.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATES=new Set(['RECEIVED','LINKED']);
class CrmReconcileDenied extends Error{constructor(code){super(code);this.code=code;}}
const deny=(code)=>{throw new CrmReconcileDenied(code);};
const safe=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=max;
function mapUpgradeRequestToCrm(request){
 if(!request||typeof request!=='object'||!UUID.test(request.tenant_id||'')||!UUID.test(request.id||'')||
 !safe(request.customer_name,80)||!/^55[0-9]{10,11}$/.test(request.whatsapp_digits||'')||!request.consent_at||
 request.source!=='instagram_upgrade'||!STATES.has(request.status))deny('UPGRADE_REQUEST_INVALID');
 const s=request.selection;
 const {validateSelection}=require('./public-upgrade-api');
 if(!validateSelection(s))deny('UPGRADE_SELECTION_INVALID');
 const desired=s.desired,used=s.trade_in;
 const details=[
  'Pitstop Upgrade V1',
  'Novo: '+desired.model+' / '+desired.capacity+' / '+desired.condition,
  'Usado: '+used.model+' / '+used.capacity+' / '+used.condition,
  'Parcelas desejadas: '+s.installments,
  'Solicitacao: '+request.id
 ].join(' | ');
 if(details.length>750)deny('UPGRADE_SELECTION_INVALID');
 return Object.freeze({
  p_nome:request.customer_name.trim(),p_whatsapp:request.whatsapp_digits,
  p_produto:(desired.model+' / '+desired.capacity).slice(0,160),
  p_condicao:desired.condition,p_perfil:'consulta',p_origem:'instagram',
  p_indicado_por:null,p_observacoes:details,
  p_upgrade_entrada:true,p_aparelho_entrada:(used.model+' / '+used.capacity).slice(0,160),
  p_consentimento:true
 });
}
function createUpgradeCrmReconciler({enabled=false,tenantId,loadRequest,authenticatedOperatorRpc,markLinked}={}){
 if(enabled!==true)return async()=>deny('CRM_RECONCILE_DISABLED');
 if(!UUID.test(tenantId||'')||typeof loadRequest!=='function'||typeof authenticatedOperatorRpc!=='function'||typeof markLinked!=='function')throw Error('CRM_OPERATOR_DEPENDENCIES_REQUIRED');
 return async function reconcile({requestId}={}){
  if(!UUID.test(requestId||''))deny('UPGRADE_REQUEST_INVALID');
  let row;
  try{row=await loadRequest({tenantId,requestId});}catch(_){deny('CRM_SOURCE_UNAVAILABLE');}
  if(!row||row.tenant_id!==tenantId||row.id!==requestId)deny('UPGRADE_REQUEST_NOT_FOUND');
  if(row.status==='LINKED'&&UUID.test(row.lead_id||''))return Object.freeze({linked:true,lead_id:row.lead_id,already_linked:true});
  if(row.status!=='RECEIVED')deny('UPGRADE_REQUEST_NOT_PENDING');
  const command=mapUpgradeRequestToCrm(row);
  let result;
  try{result=await authenticatedOperatorRpc('cadastrar_lead',command);}catch(_){deny('CRM_RPC_UNAVAILABLE');}
  // Existing CRM may return duplicated=true with a precise matching lead; do not automatically
  // link ambiguous races or mismatched contacts.
  const leadId=result?.ok===true?result.lead_id:result?.duplicado===true?result?.existente?.lead_id:null;
  if(!UUID.test(leadId||''))deny(result?.duplicado===true?'CRM_DUPLICATE_REQUIRES_REVIEW':'CRM_LEAD_NOT_CONFIRMED');
  let linked;
  try{linked=await markLinked({tenantId,requestId,leadId,expectedStatus:'RECEIVED'});}catch(_){deny('CRM_LINK_FAILED');}
  if(linked!==true)deny('CRM_LINK_FAILED');
  return Object.freeze({linked:true,lead_id:leadId,already_linked:false});
 };
}
module.exports={mapUpgradeRequestToCrm,createUpgradeCrmReconciler,CrmReconcileDenied};
