'use strict';
// Private worker/operator job composition, never imported by public Upgrade
// request handlers. The source database and Pitwall sessions must be provisioned
// independently; this module neither elevates the public Hyperdrive role nor
// creates a privileged Supabase client.
const {createUpgradeCrmOperatorRepository}=require('./upgrade-crm-operator-repository');
const {createUpgradeCrmReconciler}=require('./upgrade-crm-reconciler');
const {createPitwallCrmOperatorTransport}=require('./pitwall-crm-operator-transport');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const DENIED='UPGRADE_CRM_OPERATOR_NOT_AUTHORIZED';
const deny=()=>{throw Object.assign(new Error(DENIED),{code:DENIED});};
function createUpgradeCrmOperatorIntegration({
 enabled=false,sourceTenantId,organizationId,query,authenticateOperator,
 pitwallUrl,pitwallPublishableKey,fetchImpl
}={}){
 if(enabled!==true)return Object.freeze({enabled:false,reconcile:async()=>deny()});
 if(!UUID.test(sourceTenantId||'')||!UUID.test(organizationId||'')||
   typeof query!=='function'||typeof authenticateOperator!=='function'||
   typeof pitwallUrl!=='string'||typeof pitwallPublishableKey!=='string')
   throw Error('UPGRADE_CRM_PRIVATE_DEPENDENCIES_REQUIRED');
 const repository=createUpgradeCrmOperatorRepository({enabled:true,tenantId:sourceTenantId,query});
 return Object.freeze({
  enabled:true,
  async reconcile({requestId}={}){
   if(!UUID.test(requestId||''))deny();
   // Only a server-verified Pitwall session may unlock the CRM adapter. Never
   // accept the operator ID, role, org or access token from a public form.
   let operator;
   try{operator=await authenticateOperator();}catch(_){deny();}
   if(!operator||operator.verified!==true||!UUID.test(operator.user_id||'')||
      operator.organization_id!==organizationId||
      !['owner','manager','operator'].includes(operator.role)||
      typeof operator.access_token!=='string'||operator.access_token.length<20||
      operator.access_token.length>8192)deny();
   const transport=createPitwallCrmOperatorTransport({
    enabled:true,supabaseUrl:pitwallUrl,publishableKey:pitwallPublishableKey,
    getOperatorAccessToken:async()=>operator.access_token,fetchImpl
   });
   return createUpgradeCrmReconciler({
    enabled:true,sourceTenantId,organizationId,
    loadRequest:repository.loadRequest,markLinked:repository.markLinked,
    findExistingLeads:transport.findExistingLeads,
    authenticatedOperatorRpc:transport.authenticatedOperatorRpc
   })({requestId});
  }
 });
}
module.exports={createUpgradeCrmOperatorIntegration,DENIED};
