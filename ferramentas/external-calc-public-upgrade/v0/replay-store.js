'use strict';
const {createHash}=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JTI=/^[a-zA-Z0-9_-]{16,128}$/;
class ReplayStoreUnavailable extends Error { constructor(){ super('REPLAY_STORE_UNAVAILABLE'); this.code='REPLAY_STORE_UNAVAILABLE'; } }
function createReplayConsumer({atomicInsert,clock=()=>Date.now()}={}){
 if(typeof atomicInsert!=='function')throw new Error('ATOMIC_INSERT_REQUIRED');
 return async function consumeNonce({jti,issuer,subject,tenantId,expiresAtMs}={}){
  const now=clock();
  if(typeof jti!=='string'||!JTI.test(jti)||typeof issuer!=='string'||issuer.length<1||issuer.length>128||typeof subject!=='string'||subject!=='pitstop-upgrade-service'||!UUID.test(tenantId||'')||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=now||expiresAtMs>now+301000) return false;
  const digest=createHash('sha256').update(JSON.stringify([issuer,subject,tenantId,jti])).digest('hex');
  try{
   // Must be a durable, atomic insert-if-absent across every Worker instance.
   const value=await atomicInsert({digest,expiresAtMs,tenantId});
   if(value!==true&&value!==false)throw new Error('INVALID_ATOMIC_RESULT');
   return value;
  }catch(_){throw new ReplayStoreUnavailable();}
 };
}
module.exports={createReplayConsumer,ReplayStoreUnavailable};
