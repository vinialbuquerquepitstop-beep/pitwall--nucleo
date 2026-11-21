'use strict';
const {createPublicKey,KeyObject}=require('node:crypto');
const KID=/^[A-Za-z0-9_-]{3,80}$/;
class KeyRegistryUnavailable extends Error{constructor(){super('KEY_REGISTRY_UNAVAILABLE');this.code='KEY_REGISTRY_UNAVAILABLE';}}
function createActiveKeyRegistry({loadRecord,clock=()=>Date.now()}={}){
 if(typeof loadRecord!=='function')throw new Error('KEY_LOADER_REQUIRED');
 return async function keyRegistry(kid){
  if(typeof kid!=='string'||!KID.test(kid))return null;
  let rec;
  try{rec=await loadRecord(kid);}catch(_){throw new KeyRegistryUnavailable();}
  if(!rec||rec.kid!==kid||!['active','retiring'].includes(rec.state)||rec.revoked===true||!Number.isSafeInteger(rec.valid_from_ms)||!Number.isSafeInteger(rec.valid_until_ms)||rec.valid_until_ms<=clock()||rec.valid_from_ms>clock())return null;
  try{
   const key=rec.publicKey instanceof KeyObject?rec.publicKey:createPublicKey(rec.publicKey);
   if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')return null;
   return Object.freeze({publicKey:key,active:true});
  }catch(_){return null;}
 };
}
module.exports={createActiveKeyRegistry,KeyRegistryUnavailable};
