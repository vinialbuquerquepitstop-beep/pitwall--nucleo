'use strict';
function req(v,n){if(typeof v!=='string'||!v.trim())throw new Error(n+' obrigatorio');return v.trim();}
function join(b,p){return req(b,'supabaseUrl').replace(/\/+$/,'')+p;}
function headers(key,token){return {apikey:req(key,'serviceKey'),authorization:'Bearer '+req(token,'serviceKey'),'content-type':'application/json',prefer:'return=representation'};}
async function body(r){const t=await r.text();return t?JSON.parse(t):null;}
function createPostgresTrustedInputRepository(options={}){
 const url=req(options.supabaseUrl,'supabaseUrl'), key=req(options.serviceKey,'serviceKey');
 const fetchImpl=options.fetchImpl||globalThis.fetch;if(typeof fetchImpl!=='function')throw new Error('fetchImpl obrigatorio');
 async function call(path,init,code){const r=await fetchImpl(join(url,path),{...init,headers:{...headers(key,key),...(init.headers||{})}});const p=await body(r);if(!r.ok){const e=new Error(code+': '+(p?.message||p?.error||r.status));e.code=code;throw e;}return p;}
 async function insert(table,row){const safe={...row,content_base64:Buffer.from(row.bytes).toString('base64')};delete safe.bytes;const rows=await call('/rest/v1/'+table,{method:'POST',body:JSON.stringify(safe)},'TRUSTED_INPUT_PERSIST_FAILED');return Array.isArray(rows)?rows[0]:rows;}
 return {
  async persistOriginal(row){return insert('extcalc_trusted_input_originals',row);},
  async persistSource(row){return insert('extcalc_trusted_input_sources',row);},
  async resolveSource({tenant_id,source_id}){
   const q=new URLSearchParams({tenant_id:'eq.'+req(tenant_id,'tenant_id'),source_id:'eq.'+req(source_id,'source_id'),select:'*',limit:'1'});
   const rows=await call('/rest/v1/extcalc_trusted_input_sources?'+q,{method:'GET'},'TRUSTED_INPUT_READ_FAILED');
   if(!Array.isArray(rows)||!rows.length)return null;const row=rows[0];return {...row,bytes:Buffer.from(row.content_base64,'base64')};
  },
  async loadOriginal({tenant_id,ingestion_id}){
   const q=new URLSearchParams({tenant_id:'eq.'+req(tenant_id,'tenant_id'),ingestion_id:'eq.'+req(ingestion_id,'ingestion_id'),select:'*',limit:'1'});
   const rows=await call('/rest/v1/extcalc_trusted_input_originals?'+q,{method:'GET'},'TRUSTED_INPUT_READ_FAILED');
   if(!Array.isArray(rows)||!rows.length)return null;const row=rows[0];return {...row,bytes:Buffer.from(row.content_base64,'base64')};
  }
 };
}
module.exports={createPostgresTrustedInputRepository};
