'use strict';
// Read-only tenant-scoped supplier authorization. RLS in extcalc_supplier
// enforces fn_tenant_atual() + papel 'dono' for authenticated requests.
// Never use service_role; do not trust supplier ID from AI JSON.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function rejected(code,status,message){return Object.assign(new Error(message),{code,status})}
function validateSupplierId(value){
 if(typeof value!=='string'||!UUID.test(value))
  throw rejected('AI_SUPPLIER_ID_INVALID',422,'Selecione um fornecedor cadastrado');
 return value.toLowerCase();
}
async function checkSupplierAuthority({env,token,supplier_id,fetchImpl=fetch}){
 const id=validateSupplierId(supplier_id);
 if(!token||typeof token!=='string')throw rejected('UNAUTHENTICATED',401,'Sessao obrigatoria');
 if(!env?.SUPABASE_URL||!env?.SUPABASE_ANON_KEY)throw rejected('AI_SUPPLIER_AUTH_CONFIG',503,'Configuracao ausente');
 const url=String(env.SUPABASE_URL).replace(/\/+$/,'')+
  '/rest/v1/extcalc_supplier?select=supplier_id,name&supplier_id=eq.'+encodeURIComponent(id)+'&limit=2';
 const r=await fetchImpl(url,{method:'GET',headers:{
  apikey:env.SUPABASE_ANON_KEY,authorization:'Bearer '+token,accept:'application/json'
 }});
 if(!r.ok)throw rejected('AI_SUPPLIER_AUTH_UNAVAILABLE',r.status>=500?503:403,'Fornecedor nao acessivel nesta sessao');
 const rows=await r.json();
 if(!Array.isArray(rows)||rows.length!==1||rows[0]?.supplier_id!==id||
   typeof rows[0]?.name!=='string')
  throw rejected('AI_SUPPLIER_FORBIDDEN',403,'Fornecedor indisponivel nesta organizacao');
 return {supplier_id:id,name:rows[0].name,authority:'RLS_AUTHENTICATED_READ',write_allowed:false};
}
module.exports={validateSupplierId,checkSupplierAuthority};
