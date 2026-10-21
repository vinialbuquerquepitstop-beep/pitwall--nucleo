'use strict';
// VS5.3f: exact-byte preflight adapter. Offline proof only: not a Postgres
// implementation, RLS policy, storage writer, or runtime registration.
const {createHash}=require('node:crypto');
const {TextDecoder}=require('node:util');
const {VERSION}=require('./trusted-original-source.cjs');
const HASH_RE=/^sha256:[a-f0-9]{64}$/;
const originalHash=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const error=()=>new Error('VS53F_ORIGINAL_BYTES_INVALID_OR_SCOPE_FAIL');
function createTrustedOriginalByteRepository({reader,maxBytes}={}){
 if(typeof reader?.loadTenantOriginalBytes!=='function')throw Error('VS53F_READER_REQUIRED');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<=0)throw Error('VS53F_EXPLICIT_BYTES_LIMIT_REQUIRED');
 return Object.freeze({
  async loadTenantOriginalSource({source_ref,tenant_id,actor_ref}){
   // Authorization, grants, JWT and RLS must be proven in an external staging
   // reader. This adapter does NOT authenticate the caller by itself.
   const row=await reader.loadTenantOriginalBytes({source_ref,tenant_id,actor_ref});
   if(row==null)return null;
   if(row.source_ref!==source_ref||row.tenant_id!==tenant_id||
      row.source_type!=='ORIGINAL_SUPPLIER_TEXT'||
      row.source_contract_version!==VERSION||
      row.immutability!=='APPEND_ONLY'||row.state!=='AVAILABLE'||
      !Buffer.isBuffer(row.content_bytes)||row.content_bytes.byteLength===0||
      row.content_bytes.byteLength>maxBytes||
      typeof row.content_sha256!=='string'||!HASH_RE.test(row.content_sha256)||
      row.content_sha256!==originalHash(row.content_bytes)||
      Object.hasOwn(row,'content'))throw error();
   let content;
   try{
    content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(row.content_bytes);
   }catch{throw error();}
   if(content.includes('\u0000')||!content.trim()||
      !Buffer.from(content,'utf8').equals(row.content_bytes))throw error();
   // Only validated plaintext crosses the parser boundary. Keep original
   // bytes elsewhere under independently proven append-only storage.
   const {content_bytes,...metadata}=row;
   return {...metadata,content};
  }
 });
}
module.exports={createTrustedOriginalByteRepository,originalHash};
