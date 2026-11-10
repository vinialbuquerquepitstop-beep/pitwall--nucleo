'use strict';
const {createPublicUpgradeApi}=require('./public-upgrade-api');
const {createUpgradeCaptureRepository}=require('./upgrade-capture-repository');
// Wires the two server adapters; the caller supplies an authenticated tenant authority.
// This module NEVER derives tenantId from a browser request.
function createUpgradeV1PublicApplication({enabled=false,tenantId,query,quote,expectedOrigin}={}){
 if(enabled!==true)return createPublicUpgradeApi();
 if(typeof quote!=='function')throw Error('AUTHORIZED_QUOTE_SERVICE_REQUIRED');
 const capture=createUpgradeCaptureRepository({enabled:true,tenantId,query});
 return createPublicUpgradeApi({enabled:true,capture,quote,expectedOrigin});
}
module.exports={createUpgradeV1PublicApplication};
