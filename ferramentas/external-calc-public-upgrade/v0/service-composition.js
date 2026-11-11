'use strict';
const {createActiveKeyRegistry}=require('./key-registry');
const {createPostgresReplayConsumer}=require('./postgres-replay-adapter');
const {createUpgradeServiceIdentityVerifier}=require('./service-identity');
/** Server-only composition root. DISABLED by default; no route or DB grant. */
function createUpgradeSecurityBoundary({enabled=false,issuer,audience,tenantId,
 keyLoader,pgNoncePool,clock=()=>Date.now()}={}){
 if(enabled!==true) return Object.freeze({enabled:false,verifyService:async()=>{
   throw Object.assign(new Error('UPGRADE_DISABLED'),{code:'UPGRADE_DISABLED'});}});
 if(typeof keyLoader!=='function'||!pgNoncePool||typeof pgNoncePool.query!=='function')
   throw new Error('PERSISTENT_IDENTITY_DEPENDENCIES_REQUIRED');
 const keyRegistry=createActiveKeyRegistry({loadRecord:keyLoader,clock});
 const consumeNonce=createPostgresReplayConsumer({pool:pgNoncePool,clock});
 const verifyService=createUpgradeServiceIdentityVerifier({issuer,audience,tenantId,keyRegistry,consumeNonce,clock});
 return Object.freeze({enabled:true,verifyService});
}
module.exports={createUpgradeSecurityBoundary};
