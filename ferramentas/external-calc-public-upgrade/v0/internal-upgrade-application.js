'use strict';
/** UP-06T: server-only composition of pre-existing trusted modules.
 * NO Worker registration. Credentials and connection objects are never accepted
 * from a public request or forwarded to a response.
 */
const {createUpgradeSecurityBoundary}=require('./service-composition');
const {createInternalUpgradePort}=require('./internal-port');
const {createCanonicalUpgradeDomainAdapter}=require('./canonical-domain-adapter');
function createInternalUpgradeApplication({enabled=false,issuer,audience,tenantId,keyLoader,
 pgNoncePool,loadApprovedPublication,loadTenantScopedContext,clock=()=>Date.now(),audit}={}){
 if(enabled!==true){
  return Object.freeze({enabled:false,execute:async()=>{
   throw Object.assign(new Error('PUBLIC_UPGRADE_DISABLED'),{code:'PUBLIC_UPGRADE_DISABLED'});}});
 }
 if(typeof loadApprovedPublication!=='function'||typeof loadTenantScopedContext!=='function')
  throw new Error('TENANT_PUBLICATION_REPOSITORY_REQUIRED');
 const boundary=createUpgradeSecurityBoundary({enabled:true,issuer,audience,tenantId,keyLoader,pgNoncePool,clock});
 const port=createInternalUpgradePort({enabled:true,verifyService:boundary.verifyService,
  loadApprovedPublication,loadTenantScopedContext,domain:createCanonicalUpgradeDomainAdapter(),clock,audit});
 return Object.freeze({enabled:true,execute:port.execute});
}
module.exports={createInternalUpgradeApplication};
