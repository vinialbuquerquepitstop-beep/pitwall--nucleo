'use strict';
const {createPublicUpgradeApi}=require('./public-upgrade-api');
const {createUpgradeCaptureRepository}=require('./upgrade-capture-repository');
const {createAuthorizedUpgradeQuote}=require('./authorized-upgrade-quote');
// Single, default-off server composition: the caller supplies a trusted tenant,
// restricted PostgreSQL query function and a service-identity internal invoker.
// No caller/browser can select a tenant, public price, publication or supplier.
function createUpgradeV1PublicApplication({
 enabled=false,tenantId,query,quote,loadApprovedCatalog,invokeInternal,clock,expectedOrigin
}={}){
 if(enabled!==true)return createPublicUpgradeApi();
 const pricing=typeof quote==='function'
  ?quote
  :createAuthorizedUpgradeQuote({enabled:true,loadApprovedCatalog,invokeInternal,clock});
 const capture=createUpgradeCaptureRepository({enabled:true,tenantId,query});
 return createPublicUpgradeApi({enabled:true,capture,quote:pricing,expectedOrigin});
}
module.exports={createUpgradeV1PublicApplication};
