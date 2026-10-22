'use strict';
// STAGING ONLY: owner-scoped original source via SECURITY DEFINER RPC.
// Never expose this source body in client API responses, analytics or logs.
const crypto=require('node:crypto');
const knowledge=require('../../interpreter-core/v1/domains/apple-iphone-v0.knowledge.json');
const ORIGIN='https://mfsshvckclnmftpaprxk.supabase.co';
const RPC='/rest/v1/rpc/extcalc_resolve_manual_recovery_source_v0';
function fail(code){throw Object.assign(new Error(code),{code,status:503})}
const digest=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
function trustedModels(){
 const dedup=new Map();
 for(const m of knowledge.entities||[]){
  if(m?.kind!=='model')continue;
  const label=m?.attributes?.display_label;
  const capacity=m?.attributes?.capacity_gb;
  if(typeof label!=='string'||!label.trim()||!Number.isSafeInteger(capacity))continue;
  const id=label.trim().toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  // This is the only format currently admitted by the strict staging C01 guard.
  if(!id||!/(?:iphone)/.test(id))continue;
  const previous=dedup.get(id);
  if(previous){previous.capacities_gb.push(capacity);}
  else dedup.set(id,{id,label:label.trim(),capacities_gb:[capacity]});
 }
 return [...dedup.values()].map(x=>({...x,capacities_gb:[...new Set(x.capacities_gb)]}));
}
function createPostgresManualRecoverySourceV0({supabaseUrl,anonKey,accessToken,fetchImpl=fetch}={}){
 if(typeof fetchImpl!=='function')fail('RECOVERY_FETCH_REQUIRED');
 let origin;
 try{origin=new URL(supabaseUrl).origin;}catch{fail('RECOVERY_STAGING_ORIGIN_REQUIRED');}
 if(origin!==ORIGIN||String(supabaseUrl).replace(/\/$/,'')!==ORIGIN)
  fail('RECOVERY_ONLY_PERMITTED_IN_STAGING');
 if(typeof anonKey!=='string'||!anonKey||typeof accessToken!=='string'||!accessToken)
  fail('RECOVERY_AUTH_REQUIRED');
 return {
  async resolve({trusted_input_ref,actor_ref}={}){
   if(typeof actor_ref!=='string'||!actor_ref.trim())fail('RECOVERY_ACTOR_REQUIRED');
   if(typeof trusted_input_ref!=='string'||!(/^[A-Za-z0-9_.:-]{3,160}$/).test(trusted_input_ref))
    fail('RECOVERY_REF_INVALID');
   const response=await fetchImpl(ORIGIN+RPC,{
    method:'POST',cache:'no-store',
    headers:{'apikey':anonKey,'authorization':'Bearer '+accessToken,
      'content-type':'application/json','accept':'application/json'},
    body:JSON.stringify({p_source_ref:trusted_input_ref})
   });
   // Do not log/rethrow server response bodies: original source contains private business data.
   if(!response.ok)fail('RECOVERY_ORIGINAL_NOT_AUTHORIZED_OR_UNAVAILABLE');
   let src;
   try{src=await response.json();}catch{fail('RECOVERY_BAD_ORIGINAL_RESPONSE');}
   if(!src||typeof src!=='object'||Array.isArray(src)||
     src.trusted_input_ref!==trusted_input_ref||src.source_id!==trusted_input_ref||
     !/^[0-9a-f]{64}$/.test(String(src.original_sha256))||
     typeof src.original_text!=='string'||!src.original_text||
     Buffer.byteLength(src.original_text,'utf8')>1048576||
     src.is_immutable!==true||src.is_authorized!==true||
     src.is_supplier_bound!==true||src.is_quarantined!==false||
     typeof src.analysis_id!=='string'||!src.analysis_id.startsWith('analysis_')||
     typeof src.supplier_id!=='string'||!/^[0-9a-f-]{36}$/.test(src.supplier_id)||
     digest(src.original_text)!==src.original_sha256)
    fail('RECOVERY_ORIGINAL_INTEGRITY_INVALID');
   const models=trustedModels();
   if(!models.length)fail('RECOVERY_CANONICAL_CATALOG_UNAVAILABLE');
   return {...src,models};
  }
 };
}
module.exports={ORIGIN,RPC,trustedModels,createPostgresManualRecoverySourceV0};
