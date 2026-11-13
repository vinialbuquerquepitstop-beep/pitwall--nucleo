'use strict';
// Production-composition boundary. Feature is disabled even if Hyperdrive exists,
// until a trusted exact origin, tenant and a supported driver are present.
const {createUpgradeV1PublicApplication}=require('./upgrade-v1-public-application');
const {createHyperdriveUpgradeQuery}=require('./hyperdrive-db');
const ORIGIN=/^https:\/\/[a-z0-9.-]+(?::443)?$/i;
function createUpgradeV1HyperdriveApplication({env,Client,invokeInternal}={}){
 if(env?.UPGRADE_PUBLIC_ENABLED!=='true')return createUpgradeV1PublicApplication();
 if(!env?.UPGRADE_DB||!env?.UPGRADE_TENANT_ID||
    !ORIGIN.test(env?.UPGRADE_EXPECTED_ORIGIN||'')||typeof Client!=='function')
  return createUpgradeV1PublicApplication();
 let query;
 try{query=createHyperdriveUpgradeQuery({
  hyperdrive:env.UPGRADE_DB,Client,tenantId:env.UPGRADE_TENANT_ID
 });}catch(_){return createUpgradeV1PublicApplication();}
 // The public PostgreSQL principal may read approved catalog and write captures,
 // but must never receive access to internal supplier costs or rate profiles.
 // A trusted server-side invoker must separately verify identity and replay,
 // then resolve canonical External Calc variables. This Worker currently does
 // NOT inject that invoker; quotes therefore remain unavailable by default.
 return createUpgradeV1PublicApplication({
  enabled:true,tenantId:env.UPGRADE_TENANT_ID,query,catalogQuery:query,
  quote:typeof invokeInternal==='function'?undefined:async()=>{
   throw Error('AUTHORIZED_QUOTE_NOT_CONFIGURED');
  },
  invokeInternal:typeof invokeInternal==='function'?invokeInternal:undefined,
  expectedOrigin:env.UPGRADE_EXPECTED_ORIGIN
 });
}
module.exports={createUpgradeV1HyperdriveApplication};
