'use strict';
/** Server-only composition. No Worker route, no Supabase privilege changes. */
const {createUpgradeSecurityBoundary}=require('./service-composition');
const {createInternalUpgradePort}=require('./internal-port');
const {createCanonicalUpgradeDomainAdapter}=require('./canonical-domain-adapter');
const {createPublishedOfferRepository}=require('./published-offer-repository');
function createInternalUpgradeApplication({enabled=false,issuer,audience,tenantId,keyLoader,
 pgNoncePool,publicationQuery,loadApprovedPublication,loadTenantScopedContext,clock=()=>Date.now(),audit}={}){
 if(enabled!==true){
  return Object.freeze({enabled:false,execute:async()=>{
   throw Object.assign(new Error('PUBLIC_UPGRADE_DISABLED'),{code:'PUBLIC_UPGRADE_DISABLED'});}});
 }
 if(typeof loadTenantScopedContext!=='function'||(typeof publicationQuery!=='function'&&typeof loadApprovedPublication!=='function'))
  throw new Error('TENANT_PUBLICATION_REPOSITORY_REQUIRED');
 const publicationReader=typeof publicationQuery==='function'
  ?createPublishedOfferRepository({enabled:true,query:publicationQuery,clock})
  :loadApprovedPublication;
 const boundary=createUpgradeSecurityBoundary({enabled:true,issuer,audience,tenantId,keyLoader,pgNoncePool,clock});
 const port=createInternalUpgradePort({enabled:true,verifyService:boundary.verifyService,
  loadApprovedPublication:publicationReader,loadTenantScopedContext,domain:createCanonicalUpgradeDomainAdapter(),clock,audit});
 return Object.freeze({enabled:true,execute:port.execute});
}
module.exports={createInternalUpgradeApplication};
