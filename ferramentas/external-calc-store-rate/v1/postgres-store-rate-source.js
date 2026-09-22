'use strict';

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(field+' obrigatorio');
  return value.trim();
}
function joinUrl(base,path){return assertNonEmpty(base,'supabaseUrl').replace(/\/+$/,'')+path;}
function headers(anonKey,token){return {apikey:assertNonEmpty(anonKey,'anonKey'),authorization:'Bearer '+assertNonEmpty(token,'accessToken'),'content-type':'application/json'};}
async function json(response){const t=await response.text(); return t?JSON.parse(t):null;}

function createPostgresStoreRateQuoteSource(options={}){
 const supabaseUrl=assertNonEmpty(options.supabaseUrl,'supabaseUrl');
 const anonKey=assertNonEmpty(options.anonKey,'anonKey');
 const accessToken=assertNonEmpty(options.accessToken,'accessToken');
 const fetchImpl=options.fetchImpl||globalThis.fetch;
 const authoritySource=options.authoritySource;
 if(typeof fetchImpl!=='function') throw new Error('fetchImpl obrigatorio');
 if(!authoritySource) throw new Error('authoritySource obrigatorio');
 async function select(path,code){
  const r=await fetchImpl(joinUrl(supabaseUrl,path),{method:'GET',headers:headers(anonKey,accessToken)});
  const p=await json(r); if(!r.ok) {const e=new Error(code+': '+(p?.message||p?.error||r.status));e.code=code;throw e;} return p;
 }
 return {
  async loadMembership({auth_user_id}){
   const p=new URLSearchParams({id:'eq.'+assertNonEmpty(auth_user_id,'auth_user_id'),select:'id,tenant_id,papel,ativo',limit:'2'});
   const rows=await select('/rest/v1/app_usuario?'+p,'RATE_PROFILE_FORBIDDEN');
   return Array.isArray(rows)&&rows.length===1?rows[0]:null;
  },
  async loadC01(identity){return authoritySource.loadC01(identity);},
  async loadBaseCalculationProfile(identity){return authoritySource.loadCalculationProfile(identity);},
  async loadActiveStoreRateProfile({tenant_id}){
   const p=new URLSearchParams({tenant_id:'eq.'+assertNonEmpty(tenant_id,'tenant_id'),status:'eq.ACTIVE',select:'profile_id,tenant_id,version,status,currency,rate_scale,fingerprint',limit:'2'});
   const rows=await select('/rest/v1/extcalc_store_rate_profiles?'+p,'RATE_PROFILE_INVALID');
   if(!Array.isArray(rows)||rows.length===0)return null;
   if(rows.length!==1){const e=new Error('mais de um perfil ACTIVE');e.code='RATE_PROFILE_CONFLICT';throw e;}
   const profile=rows[0];
   const ep=new URLSearchParams({profile_id:'eq.'+profile.profile_id,select:'installment_count,rate_units',order:'installment_count.asc'});
   const entries=await select('/rest/v1/extcalc_store_rate_profile_entries?'+ep,'RATE_PROFILE_INVALID');
   return {...profile,entries:Array.isArray(entries)?entries:[]};
  }
 };
}
module.exports={createPostgresStoreRateQuoteSource};
