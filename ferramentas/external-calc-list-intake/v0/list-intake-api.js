'use strict';

const crypto = require('node:crypto');
const { parseTextSource } = require('../../external-calc-universal-input/v1/text-adapter');
const { parseCsvSource } = require('../../external-calc-universal-input/v1/csv-adapter');
const { canonicalToRawDocument } = require('../../external-calc-universal-input/v1/canonical-interpreter-bridge');
const { runC01ReadOnlySlice } = require('../../external-calc-c01/v1/c01-readonly-bridge');
const schema = require('../../interpreter-core/v1/domains/apple-iphone-v0.schema.json');
const knowledge = require('../../interpreter-core/v1/domains/apple-iphone-v0.knowledge.json');

const LIST_INTAKE_PATH='/api/external-calc/v0/list-intake';
const API_VERSION='external-calc-list-intake-api/v0';
const MAX_TEXT_BYTES=2*1024*1024;

function allowedOrigin(origin,env){
 if(!origin)return null;
 const configured=new Set(String(env?.EXTCALC_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean));
 if(configured.has(origin))return origin;
 if(/^https:\/\/external-calc-frontend-v1-preview(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin))return origin;
 if(origin==='http://localhost:3000'||origin==='http://127.0.0.1:3000')return origin;
 return null;
}
function headers(origin){return {'content-type':'application/json; charset=utf-8','cache-control':'no-store',...(origin?{'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,content-type','vary':'Origin'}:{})};}
function out(status,body,origin){return new Response(JSON.stringify(body),{status,headers:headers(origin)});}
function bearer(request){const m=/^Bearer\s+(.+)$/i.exec(request.headers.get('authorization')||'');return m?m[1].trim():'';}
function stableHash(value){return crypto.createHash('sha256').update(value,'utf8').digest('hex');}
function normalizedFilename(value,type){
 const name=typeof value==='string'&&value.trim()?value.trim():(type==='csv'?'lista.csv':'lista.txt');
 if(name.length>180)throw Object.assign(new Error('filename muito longo'),{code:'LIST_INTAKE_INVALID'});
 return name;
}
function normalizeBody(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error('body invalido'),{code:'LIST_INTAKE_INVALID'});
 const allowed=new Set(['filename','mime_type','content']);
 for(const k of Object.keys(value))if(!allowed.has(k))throw Object.assign(new Error('campo nao permitido: '+k),{code:'LIST_INTAKE_INVALID'});
 if(typeof value.content!=='string'||!value.content.trim())throw Object.assign(new Error('lista vazia'),{code:'LIST_INTAKE_INVALID'});
 if(Buffer.byteLength(value.content,'utf8')>MAX_TEXT_BYTES)throw Object.assign(new Error('lista excede 2 MB'),{code:'LIST_INTAKE_TOO_LARGE'});
 return value;
}
function sourceType(filename,mime){
 const lower=filename.toLowerCase();
 if(lower.endsWith('.csv')||String(mime||'').toLowerCase().split(';')[0].trim()==='text/csv')return 'csv';
 if(lower.endsWith('.xlsx'))throw Object.assign(new Error('XLSX ainda nao esta semanticamente habilitado; use CSV/TXT ou cole a lista'),{code:'XLSX_NOT_ACTIVATED'});
 return 'txt';
}
async function rpc(env,token,name,payload){
 const r=await fetch(String(env.SUPABASE_URL).replace(/\/+$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:String(env.SUPABASE_ANON_KEY),authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(payload)});
 const text=await r.text();let data=null;try{data=text?JSON.parse(text):null;}catch{}
 if(!r.ok){const e=new Error(data?.message||data?.error||name+' failed');e.code=data?.message||data?.code||'LIST_INTAKE_PERSIST_FAILED';e.status=r.status;throw e;}
 return data;
}
function buildQueue(body){
 const tentative=normalizedFilename(body.filename,'txt');
 const type=sourceType(tentative,body.mime_type);
 const filename=normalizedFilename(body.filename,type);
 const source={filename,mime_type:body.mime_type||(type==='csv'?'text/csv':'text/plain'),content:body.content};
 const canonical=type==='csv'?parseCsvSource(source):parseTextSource(source);
 const raw=canonicalToRawDocument(canonical);
 const hash=canonical.source.content_hash.replace(/^sha256:/,'');
 const analysis_id='analysis_'+hash.slice(0,24);
 const source_id='source_'+hash.slice(0,24);
 const queue=runC01ReadOnlySlice({analysis_id,source_id,currency:'BRL',document:raw,schema,knowledge});
 return {type,filename,canonical,queue,analysis_id,source_id};
}
function createListIntakeApiV0({env}={}){
 if(!env)throw new Error('env obrigatorio');
 return {
  matches(path){return path===LIST_INTAKE_PATH;},
  async handle(request){
   const origin=allowedOrigin(request.headers.get('origin'),env);
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
   if(request.method!=='POST')return out(405,{error:{code:'METHOD_NOT_ALLOWED',message:'use POST'}},origin);
   try{
    const token=bearer(request);if(!token)return out(401,{error:{code:'UNAUTHENTICATED',message:'autenticacao obrigatoria'}},origin);
    let raw;try{raw=await request.json();}catch{throw Object.assign(new Error('JSON invalido'),{code:'LIST_INTAKE_INVALID'});}
    const command=normalizeBody(raw);
    const built=buildQueue(command);
    let persisted=0,idempotent=0;
    for(const candidate of built.queue.candidates){
      const saved=await rpc(env,token,'extcalc_persist_review_candidate_v0',{p_candidate:candidate});
      persisted+=1;if(saved?.idempotent===true)idempotent+=1;
    }
    return out(200,{
      api_version:API_VERSION,
      intake:{
        analysis_id:built.analysis_id,
        source_id:built.source_id,
        source_type:built.type,
        filename:built.filename,
        content_hash:built.canonical.source.content_hash,
        candidates:built.queue.candidates.length,
        persisted,
        idempotent,
        unresolved_ambiguities:built.queue.unresolved_ambiguities.length,
        invalid_items:built.queue.invalid_items.length,
        warnings:built.queue.warnings
      }
    },origin);
   }catch(e){
    const code=e?.code||'LIST_INTAKE_FAILED';
    const status=e?.status===401||e?.status===403||String(e?.message||'').includes('FORBIDDEN')?403:code==='LIST_INTAKE_TOO_LARGE'?413:code==='XLSX_NOT_ACTIVATED'?422:400;
    return out(status,{error:{code,message:e instanceof Error?e.message:'falha na entrada da lista'}},origin);
   }
  }
 };
}
module.exports={LIST_INTAKE_PATH,API_VERSION,buildQueue,createListIntakeApiV0};
