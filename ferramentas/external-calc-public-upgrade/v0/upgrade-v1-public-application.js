'use strict';
const {createPublicUpgradeApi}=require('./public-upgrade-api');
const {createUpgradeCaptureRepository}=require('./upgrade-capture-repository');
const {createAuthorizedUpgradeQuote}=require('./authorized-upgrade-quote');
const {createApprovedCatalogRepository}=require('./approved-catalog-repository');
// Single, default-off server composition: the caller supplies a trusted tenant,
// restricted PostgreSQL query function and a service-identity internal invoker.
// No caller/browser can select a tenant, public price, publication or supplier.
function createUpgradeV1PublicApplication({
 enabled=false,tenantId,query,quote,loadApprovedCatalog,catalogQuery,invokeInternal,clock,expectedOrigin
}={}){
 if(enabled!==true)return createPublicUpgradeApi();
 const trustedCatalog=typeof loadApprovedCatalog==='function'
  ?loadApprovedCatalog
  :typeof catalogQuery==='function'
   ?createApprovedCatalogRepository({enabled:true,tenantId,query:catalogQuery,clock})
   :async()=>{throw new Error('CATALOG_NOT_CONFIGURED');};
 const pricing=typeof quote==='function'
  ?quote
  :createAuthorizedUpgradeQuote({enabled:true,tenantId,loadApprovedCatalog:trustedCatalog,invokeInternal,clock});
 const capture=createUpgradeCaptureRepository({enabled:true,tenantId,query});
 return createPublicUpgradeApi({enabled:true,capture,quote:pricing,catalog:trustedCatalog,expectedOrigin});
}
module.exports={createUpgradeV1PublicApplication};
