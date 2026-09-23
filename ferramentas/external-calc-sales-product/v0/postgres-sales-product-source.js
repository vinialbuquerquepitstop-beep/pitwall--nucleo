'use strict';
function req(v,f){if(typeof v!=='string'||!v.trim())throw new Error(f+' obrigatorio');return v.trim();}
function url(base,path){return req(base,'supabaseUrl').replace(/\/+$/,'')+path;}
function headers(key,token){return {apikey:req(key,'anonKey'),authorization:'Bearer '+req(token,'accessToken'),'content-type':'application/json'};}
async function json(r){const t=await r.text();return t?JSON.parse(t):null;}
function createPostgresSalesProductSource(options={}){
 const base=req(options.supabaseUrl,'supabaseUrl'),key=req(options.anonKey,'anonKey'),token=req(options.accessToken,'accessToken'),fetchImpl=options.fetchImpl||globalThis.fetch;
 if(typeof fetchImpl!=='function')throw new Error('fetchImpl obrigatorio');
 async function rpc(name,body={}){const r=await fetchImpl(url(base,'/rest/v1/rpc/'+name),{method:'POST',headers:headers(key,token),body:JSON.stringify(body)});const p=await json(r);if(!r.ok){const e=new Error(p?.message||name+' failed');e.code=p?.code||'PRODUCT_SOURCE_FAILED';throw e;}return p;}
 return {
  async loadMembership({auth_user_id}){const p=new URLSearchParams({id:'eq.'+req(auth_user_id,'auth_user_id'),select:'id,tenant_id,papel,ativo',limit:'2'});const r=await fetchImpl(url(base,'/rest/v1/app_usuario?'+p),{headers:headers(key,token)});const rows=await json(r);return r.ok&&Array.isArray(rows)&&rows.length===1?rows[0]:null;},
  async loadCurrentOffers(){const p=await rpc('extcalc_product_current_offers_v0');return Array.isArray(p)?p:[];},
  async loadActiveTradeInPolicy(){return await rpc('extcalc_product_trade_in_policy_v0');},
  async loadActiveRateProfile(){return await rpc('extcalc_product_store_rate_profile_v0');}
 };
}
module.exports={createPostgresSalesProductSource};
