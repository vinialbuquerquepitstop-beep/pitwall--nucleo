'use strict';
// Operator-side delivery from a Pitwall V2 receipt to the existing S01 CRM RPC.
// A real authenticated Pitwall session, not the browser, supplies the caller.
// claimRequest must atomically lease exactly one durable receipt; its implementation
// is a backend-only port. Ambiguous duplicates require human review.
const VALID_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny=code=>{throw Object.assign(new Error(code),{code});};
const compact=s=>typeof s==='string'?s.trim():'';
function mapToCrm(row,organizationId){
 if(!row||!VALID_UUID.test(organizationId||'')||row.organization_id!==organizationId||
   !VALID_UUID.test(row.id||'')||row.status!=='PROCESSING'||
   !row.consent_at||row.source!=='instagram_upgrade'||
   !compact(row.customer_name)||!/^55[0-9]{10,11}$/.test(row.whatsapp_digits||''))
  deny('UPGRADE_DELIVERY_INVALID');
 const s=row.selection,d=s?.desired,t=s?.trade_in;
 if(!d||!(t===null||(t&&compact(t.model)&&compact(t.capacity)&&compact(t.condition)))||!compact(d.model)||!compact(d.capacity)||
  !Number.isInteger(s.installments)||s.installments<1||s.installments>18)
  deny('UPGRADE_DELIVERY_INVALID');
 const identifier='Upgrade V2: '+row.id;
 const notes=[identifier,'Desejado: '+d.model+' / '+d.capacity+' / '+d.condition,
  t===null?'Troca: não possui aparelho para troca':'Troca: '+t.model+' / '+t.capacity+' / '+t.condition,
  'Pagamento pretendido: '+s.installments+'x','Avaliação humana; sem preço aprovado'].join(' | ');
 if(notes.length>1200)deny('UPGRADE_DELIVERY_INVALID');
 return Object.freeze({p_org_id:organizationId,p_name:row.customer_name,
  p_phone:row.whatsapp_digits,p_notes:notes,
  p_context:{desired_product:d.model+' / '+d.capacity+' / '+d.condition,
    payment_preference:s.installments===1?'undecided':'card',
    trade_intent:t===null?'no':'yes',trade_model:t?.model||null,trade_storage:t?.capacity||null,
    trade_condition_declared:t?.condition||null,
    next_action:'Analisar solicitação de Upgrade; confirmar avaliação e cotação na Calculadora V2'},
  // Real pw_lead_acquisition constraint permits platform/acquisition_ref
  // only for paid acquisition. This is organic Instagram Upgrade, not an ad.
  // The stable receipt marker remains in notes for deduplication/recovery.
  p_acquisition:{source_channel:'instagram'},p_initial_stage:'new'});
}
function createUpgradeV2CrmDelivery({
 organizationId,authorizeOperator,claimRequest,findExistingLeads,createLead,markLinked,markReview
}={}){
 if(!VALID_UUID.test(organizationId||'')||
  [authorizeOperator,claimRequest,findExistingLeads,createLead,markLinked,markReview].some(x=>typeof x!=='function'))
  throw Error('UPGRADE_DELIVERY_PORTS_REQUIRED');
 return Object.freeze({async deliver({requestId}={}){
  if(!VALID_UUID.test(requestId||''))deny('UPGRADE_DELIVERY_INVALID');
  let operator;
  try{operator=await authorizeOperator({organizationId});}catch{deny('UPGRADE_DELIVERY_UNAUTHORIZED');}
  if(operator?.verified!==true||operator.organization_id!==organizationId||
    !['owner','manager','operator'].includes(operator.role)||!VALID_UUID.test(operator.user_id||''))
    deny('UPGRADE_DELIVERY_UNAUTHORIZED');
  let row;
  try{row=await claimRequest({organizationId,requestId});}catch{deny('UPGRADE_DELIVERY_UNAVAILABLE');}
  if(row?.status==='LINKED'&&VALID_UUID.test(row.lead_id||''))
   return {linked:true,lead_id:row.lead_id,already_linked:true};
  if(!row||row.status!=='PROCESSING')deny('UPGRADE_DELIVERY_UNAVAILABLE');
  const cmd=mapToCrm(row,organizationId);
  let matches;
  try{matches=await findExistingLeads({organizationId,phone:row.whatsapp_digits});}
  catch{deny('UPGRADE_DELIVERY_UNAVAILABLE');}
  if(!Array.isArray(matches)||matches.length>2)deny('UPGRADE_DELIVERY_UNAVAILABLE');
  const matching=matches.filter(x=>x?.organization_id===organizationId&&
    x.phone===row.whatsapp_digits&&VALID_UUID.test(x.id||'')&&
    typeof x.notes==='string'&&x.notes.split(' | ').includes('Upgrade V2: '+requestId));
  if(matches.length&&! (matches.length===1&&matching.length===1)){
   let reviewed=false;
   try{reviewed=await markReview({organizationId,requestId});}catch{}
   if(reviewed!==true)deny('UPGRADE_DELIVERY_UNAVAILABLE');
   // Return a domain outcome, not an exception: the surrounding SQL scope
   // must COMMIT REVIEW_REQUIRED before HTTP translates it to 409.
   return {linked:false,review_required:true};
  }
  let lead=matching[0],recovered=!!lead;
  if(!lead){
   try{lead=await createLead({organizationId,command:cmd});}
   catch{deny('UPGRADE_DELIVERY_UNAVAILABLE');}
  }
  if(!lead||!VALID_UUID.test(lead.id||'')||lead.organization_id!==organizationId)
   deny('UPGRADE_DELIVERY_UNAVAILABLE');
  let linked;
  try{linked=await markLinked({organizationId,requestId,leadId:lead.id});}
  catch{deny('UPGRADE_DELIVERY_UNAVAILABLE');}
  if(linked!==true)deny('UPGRADE_DELIVERY_UNAVAILABLE');
  return {linked:true,lead_id:lead.id,already_linked:recovered};
 }});
}
module.exports={createUpgradeV2CrmDelivery,mapToCrm};
