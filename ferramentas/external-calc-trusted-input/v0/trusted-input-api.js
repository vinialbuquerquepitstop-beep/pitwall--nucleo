'use strict';

const INGEST_PATH='/api/external-calc/v0/ingest';
const VERSION='external-calc-trusted-input-api/v0';

function json(status,body){return {status,headers:{'content-type':'application/json; charset=utf-8'},body};}
function parse(raw){
 if(raw==null)throw new Error('body obrigatorio');
 const v=typeof raw==='string'?JSON.parse(raw):raw;
 if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('body invalido');
 const allowed=new Set(['filename','content_type','content_base64']);
 for(const key of Object.keys(v))if(!allowed.has(key)){const e=new Error('campo nao permitido: '+key);e.code='CLIENT_AUTHORITY_FIELD';throw e;}
 if(typeof v.filename!=='string'||!v.filename.trim())throw new Error('filename obrigatorio');
 if(typeof v.content_base64!=='string'||!v.content_base64.trim())throw new Error('content_base64 obrigatorio');
 return {filename:v.filename.trim(),content_type:typeof v.content_type==='string'?v.content_type:'application/octet-stream',bytes:Buffer.from(v.content_base64,'base64')};
}
function auth(v){
 if(!v||typeof v!=='object'||!v.tenant_id||!v.subject){const e=new Error('autenticacao obrigatoria');e.code='UNAUTHENTICATED';throw e;}
 if(v.can_execute_external_calc!==true){const e=new Error('acesso negado');e.code='FORBIDDEN';throw e;}
 return {tenant_id:String(v.tenant_id),actor_ref:String(v.subject)};
}
function createTrustedInputApiV0(options={}){
 const authenticate=options.authenticate, ingestion=options.ingestion, candidateRuntime=options.candidateRuntime;
 if(typeof authenticate!=='function')throw new Error('authenticate obrigatorio');
 if(!ingestion||typeof ingestion.ingest!=='function')throw new Error('ingestion obrigatorio');
 if(!candidateRuntime||typeof candidateRuntime.execute!=='function')throw new Error('candidateRuntime obrigatorio');
 return {version:VERSION,async handle(request){
  try{
   if(String(request?.method||'').toUpperCase()!=='POST'||String(request?.path||'')!==INGEST_PATH)return json(404,{error:{code:'NOT_FOUND',message:'rota nao encontrada'}});
   const identity=auth(await authenticate(request));
   const input=parse(request.body);
   const ingested=await ingestion.ingest({...identity,...input});
   const runs=[];
   for(const item of ingested.accepted){
    const result=await candidateRuntime.execute({trusted_input_ref:item.trusted_input_ref});
    runs.push({trusted_input_ref:item.trusted_input_ref,analysis_id:result.analysis_id,source_id:result.source_id,stage:result.stage,execution_status:result.execution_status,candidates:result.candidates,persisted_count:result.persisted_count});
   }
   return json(201,{api_version:VERSION,ingestion_id:ingested.ingestion_id,status:ingested.status,accepted:ingested.accepted,rejected:ingested.rejected,review_runs:runs,next_stage:'REVIEW'});
  }catch(error){
   const code=error?.code||'INVALID_INGESTION_REQUEST';
   const status=code==='UNAUTHENTICATED'?401:code==='FORBIDDEN'?403:
    ['UPLOAD_TOO_LARGE','MEMBER_TOO_LARGE','TOO_MANY_MEMBERS','ZIP_BOMB'].includes(code)?413:
    code==='CLIENT_AUTHORITY_FIELD'?400:422;
   return json(status,{error:{code,message:error instanceof Error?error.message:'ingestao invalida'}});
  }
 }};
}
module.exports={INGEST_PATH,VERSION,createTrustedInputApiV0};
