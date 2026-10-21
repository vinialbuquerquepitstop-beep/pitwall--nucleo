'use strict';
// VS5.3d adapter contract for immutable ORIGINAL source bytes.
// No database schema, network route, Supabase or source persistence is created.
const {createHash}=require('node:crypto');
const VERSION='external-calc-original-supplier-source/v0';
function sha(value){return 'sha256:'+createHash('sha256').update(value,'utf8').digest('hex')}
const required=(v,name)=>{
 if(typeof v!=='string'||!v.trim())throw Error('VS53D_INVALID_'+name);
 return v.trim();
};
function createTrustedOriginalSourceResolver({repository}={}){
 if(typeof repository?.loadTenantOriginalSource!=='function')
   throw Error('VS53D_REPOSITORY_REQUIRED');
 return Object.freeze({
  version:VERSION,
  async resolve({trusted_input_ref,tenant_id,actor_ref}={}){
   const ref=required(trusted_input_ref,'REF');
   const tenant=required(tenant_id,'TENANT');
   const actor=required(actor_ref,'ACTOR');
   if(ref.length>160||!/^[\w.:-]+$/.test(ref))throw Error('VS53D_INVALID_REF');
   // This repository MUST enforce authorization at the source; returning a row
   // from an unrelated tenant is never accepted just because it was returned.
   const row=await repository.loadTenantOriginalSource({
      source_ref:ref,tenant_id:tenant,actor_ref:actor
   });
   if(row==null)return null;
   if(row.source_contract_version!==VERSION||
      row.tenant_id!==tenant||row.source_ref!==ref||
      row.immutability!=='APPEND_ONLY'||
      row.source_type!=='ORIGINAL_SUPPLIER_TEXT'||
      row.state!=='AVAILABLE'||
      typeof row.content!=='string'||!row.content.trim()||
      typeof row.content_sha256!=='string'||
      !/^sha256:[a-f0-9]{64}$/.test(row.content_sha256)||
      row.content_sha256!==sha(row.content)||
      typeof row.filename!=='string'||!row.filename.trim()
   )throw Error('VS53D_ORIGINAL_SOURCE_INTEGRITY_OR_SCOPE_FAIL');
   return {
     tenant_id:tenant,trusted_input_ref:ref,filename:row.filename,
     content:row.content,source_sha256:row.content_sha256
   };
  }
 });
}
module.exports={VERSION,sha,createTrustedOriginalSourceResolver};
