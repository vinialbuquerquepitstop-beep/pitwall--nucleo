'use strict';

const TRACKED_MODELS_PATH='/api/external-calc/v0/tracked-models';
const TRACKED_MODELS_REMOVE_PATH='/api/external-calc/v0/tracked-models/remove';

function json(status,body){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
function bearer(request){const m=/^Bearer\s+(.+)$/i.exec(request.headers.get('authorization')||'');return m?m[1].trim():'';}
async function body(request){try{const x=await request.json();if(!x||typeof x!=='object'||Array.isArray(x))throw new Error();return x;}catch{const e=new Error('request invalido');e.code='INVALID_REQUEST';throw e;}}
async function rpc(env,token,name,payload={}){
 const r=await fetch(String(env.SUPABASE_URL).replace(/\/+$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:String(env.SUPABASE_ANON_KEY),authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(payload)});
 const text=await r.text();let data=null;try{data=text?JSON.parse(text):null;}catch{}
 if(!r.ok){const e=new Error(data?.message||name+' failed');e.code=data?.message||data?.code||'TRACKED_MODEL_SOURCE_FAILED';e.status=r.status;throw e;}
 return data;
}
function errorStatus(e){if(e?.status===401||e?.status===403||e?.code==='EXTCALC_PRODUCT_FORBIDDEN')return 403;if(e?.code==='TRACKED_MODEL_NOT_FOUND')return 404;return 400;}
function createTrackedModelApiV0({env}={}){
 if(!env)throw new Error('env obrigatorio');
 return {matches(path){return path===TRACKED_MODELS_PATH||path===TRACKED_MODELS_REMOVE_PATH;},async handle(request){
  try{
   const url=new URL(request.url),path=url.pathname,method=request.method.toUpperCase();
   if(!this.matches(path)||!['GET','POST'].includes(method)||method==='GET'&&path!==TRACKED_MODELS_PATH)return json(404,{error:{code:'NOT_FOUND',message:'rota nao encontrada'}});
   const token=bearer(request);if(!token)return json(401,{error:{code:'UNAUTHENTICATED',message:'autenticacao obrigatoria'}});
   if(method==='GET')return json(200,{api_version:'external-calc-tracked-model-api/v0',result:{tracking_version:'external-calc-tracked-model/v0',items:await rpc(env,token,'extcalc_product_tracked_models_v0')}});
   const command=await body(request);
   if(path===TRACKED_MODELS_PATH){
    const allowed=new Set(['model_id','capacity_gb','condition','customer_name','customer_phone']);for(const k of Object.keys(command))if(!allowed.has(k))throw Object.assign(new Error('campo proibido: '+k),{code:'TRACKED_MODEL_INVALID'});
    if(typeof command.model_id!=='string'||!command.model_id.trim()||(command.capacity_gb!=null&&(!Number.isInteger(command.capacity_gb)||command.capacity_gb<=0))||typeof command.customer_name!=='string'||!command.customer_name.trim()||command.customer_name.trim().length>120||typeof command.customer_phone!=='string'||!command.customer_phone.trim()||command.customer_phone.trim().length>40)throw Object.assign(new Error('modelo ou cliente invalido'),{code:'TRACKED_MODEL_INVALID'});
    const result=await rpc(env,token,'extcalc_product_track_model_v1',{p_model_id:command.model_id.trim(),p_customer_name:command.customer_name.trim(),p_customer_phone:command.customer_phone.trim(),p_capacity_gb:command.capacity_gb??null,p_condition:command.condition??null});
    return json(200,{api_version:'external-calc-tracked-model-api/v0',result});
   }
   if(Object.keys(command).length!==1||typeof command.tracked_model_id!=='string'||!command.tracked_model_id.trim())throw Object.assign(new Error('tracked_model_id obrigatorio'),{code:'TRACKED_MODEL_INVALID'});
   const result=await rpc(env,token,'extcalc_product_untrack_model_v0',{p_tracked_model_id:command.tracked_model_id.trim()});
   return json(200,{api_version:'external-calc-tracked-model-api/v0',result});
  }catch(e){const code=e?.code||'INVALID_REQUEST';return json(errorStatus(e),{error:{code,message:e instanceof Error?e.message:'request invalido'}});}
 }};
}
module.exports={TRACKED_MODELS_PATH,TRACKED_MODELS_REMOVE_PATH,createTrackedModelApiV0};
