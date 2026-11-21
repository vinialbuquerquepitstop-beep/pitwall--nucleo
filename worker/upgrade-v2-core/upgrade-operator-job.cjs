'use strict';
// Private operator job composition. Calling this from the public intake would
// bypass the intended authorization boundary. The backend operator session
// must be validated on each reconciliation invocation.
const {createUpgradeV2OperatorTransport}=require('./upgrade-operator-transport.cjs');
const {createUpgradeDeliveryStore}=require('./upgrade-delivery-store.cjs');
const {createUpgradeV2CrmDelivery}=require('./upgrade-delivery.cjs');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function createUpgradeV2OperatorJob({
 enabled=false,organizationId,query,withQuery,supabaseUrl,publishableKey,
 getOperatorAccessToken,fetchImpl
}={}){
 if(enabled!==true)return Object.freeze({deliver:async()=>{
  throw Object.assign(new Error('UPGRADE_OPERATOR_DISABLED'),{code:'UPGRADE_OPERATOR_DISABLED'});
 }});
 if(!UUID.test(organizationId||'')||
    (typeof query!=='function'&&typeof withQuery!=='function'))
  throw Error('UPGRADE_OPERATOR_JOB_CONFIG_REQUIRED');
 const auth=createUpgradeV2OperatorTransport({
  supabaseUrl,publishableKey,getOperatorAccessToken,fetchImpl
 });
 return Object.freeze({
  async deliver({requestId}={}){
   if(!UUID.test(requestId||''))throw Error('UPGRADE_INVALID_REQUEST');
   // Authenticate and authorize first. For Worker usage, do not borrow a
   // PostgreSQL connection until the Pitwall V2 membership check succeeds.
   return auth.withOperator({organizationId,run:async({identity,transport})=>{
    const reconcile=async sqlQuery=>{
     const store=createUpgradeDeliveryStore({query:sqlQuery});
     const reconciler=createUpgradeV2CrmDelivery({
      organizationId,authorizeOperator:async()=>identity,
      ...store,findExistingLeads:transport.findExistingLeads,
      createLead:transport.createLead
     });
     return reconciler.deliver({requestId});
    };
    return typeof withQuery==='function'?
     withQuery(({query:sqlQuery})=>reconcile(sqlQuery)):reconcile(query);
   }});
  }
 });
}
module.exports={createUpgradeV2OperatorJob};
