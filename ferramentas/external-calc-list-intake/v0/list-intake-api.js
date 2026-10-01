'use strict';

const crypto = require('node:crypto');
const { parseTextSource } = require('../../external-calc-universal-input/v1/text-adapter');
const { parseCsvSource } = require('../../external-calc-universal-input/v1/csv-adapter');
const { canonicalToRawDocument } = require('../../external-calc-universal-input/v1/canonical-interpreter-bridge');
const { interpretResolved, buildKnowledgeIndex, resolveEntityCandidate } = require('../../interpreter-core/v1/core');
const { mapBundleToC01ReviewQueue } = require('../../external-calc-c01/v1/c01-readonly-bridge');
const { partitionCandidates } = require('./auto-promotion-authority');
const schema = require('./supplier-device-v0.schema.json');
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
function fallbackModelId(label){
 const slug=String(label)
   .normalize('NFD')
   .replace(/[\u0300-\u036f]/g,'')
   .toLocaleLowerCase('pt-BR')
   .replace(/gb\b/g,'')
   .replace(/[^a-z0-9]+/g,'-')
   .replace(/^-+|-+$/g,'')
   .replace(/-+/g,'-');
 if(!slug)throw Object.assign(new Error('modelo sem identidade utilizavel'),{code:'LIST_INTAKE_MODEL_ID_INVALID'});
 return slug.slice(0,96);
}
function finalizeBundleIdentity(bundle){
 const index=buildKnowledgeIndex(knowledge);
 const resolverField={name:'model',resolver:{kind:'entity',entity_kind:'model',match:['alias','label']}};
 for(const record of bundle.records||[]){
   const rawModel=record?.fields?.model;
   if(typeof rawModel==='string'&&rawModel.trim()){
     const modelTrace=(record.trace||[]).find(item=>item.field==='model');
     const resolved=resolveEntityCandidate({
       field:'model',
       value:rawModel.trim(),
       score:modelTrace?.score??0.97,
       evidence:{line_number:modelTrace?.sources?.[0]??null}
     },resolverField,index);
     record.fields.model=resolved&&resolved.entity_id
       ? {id:resolved.entity_id,label:resolved.value,attributes:resolved.attributes||{}}
       : {id:fallbackModelId(rawModel),label:rawModel.trim(),attributes:{identity_source:'supplier-list-fallback-v0'}};
     if(modelTrace){
       modelTrace.chosen=record.fields.model;
       modelTrace.rules=[...(modelTrace.rules||[]),resolved&&resolved.entity_id?'list_intake:canonical_model':'list_intake:fallback_model_id'];
     }
   }
   if(!Number.isInteger(record?.fields?.capacity_gb)&&Number.isInteger(record?.fields?.capacity_tb)&&record.fields.capacity_tb>0){
     record.fields.capacity_gb=record.fields.capacity_tb*1024;
     const tbTrace=(record.trace||[]).find(item=>item.field==='capacity_tb');
     record.trace=(record.trace||[]).filter(item=>item.field!=='capacity_tb');
     record.trace.push({
       field:'capacity_gb',
       chosen:record.fields.capacity_gb,
       sources:tbTrace?.sources||[],
       derived_from:tbTrace?.sources||[],
       rules:['list_intake:tb_to_gb'],
       alternatives:[],
       score:tbTrace?.score??null
     });
   }
   delete record.fields.capacity_tb;
 }
 return bundle;
}
function normalizedDiagnosticLine(value){
 return String(value??'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
}
function isKnownNonCommercialLine(raw){
 const line=normalizedDiagnosticLine(raw);
 if(!line)return true;
 if(/^[━─—_=*•·\-\s]+$/u.test(line))return true;
 if(/^📍\s*/u.test(line))return true;
 if(/^📲\s*\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}\s*$/u.test(line))return true;
 if(/^(?:🛡\s*)?garantia\s*$/iu.test(line))return true;
 if(/^(?:📃\s*)?pol[ií]ticas\s*$/iu.test(line))return true;
 if(/n[aã]o estornamos pix|cr[eé]dito loja|diferen[cç]a entre data de compra e garantia|lacrados?\s*:\s*apple/iu.test(line))return true;
 if(/^(?:📱|💻|⌚|📲|🎧)?\s*\*?(?:celular|macbook|watch|ipad|airpods)\s*[—–-]?\s*(?:lacrado|lacrados)?\*?\s*$/iu.test(line))return true;
 return false;
}
function refineInterpreterDiagnostics(bundle){
 const usedLines=new Set();
 for(const record of bundle.records||[]){
   for(const item of record.trace||[]){
     for(const line of item.sources||[])if(Number.isSafeInteger(line))usedLines.add(line);
   }
 }
 const segmentByLine=new Map((bundle.segments||[])
   .filter(segment=>Number.isSafeInteger(segment?.line_number))
   .map(segment=>[segment.line_number,segment]));

 const suppressedAmbiguities=[];
 bundle.ambiguities=(bundle.ambiguities||[]).filter(item=>{
   if(item?.cause!=='structural_role_unknown')return true;
   const sources=(item.sources||[]).filter(Number.isSafeInteger);
   const used=sources.length>0&&sources.every(line=>usedLines.has(line));
   const metadata=sources.length>0&&sources.every(line=>isKnownNonCommercialLine(segmentByLine.get(line)?.raw));
   if(used||metadata){suppressedAmbiguities.push(item);return false;}
   return true;
 });

 const suppressedInvalid=[];
 bundle.invalid=(bundle.invalid||[]).filter(item=>{
   const sources=(item.sources||[]).filter(Number.isSafeInteger);
   const raw=sources.length?segmentByLine.get(sources[0])?.raw:item.raw;
   if(item?.cause==='empty-line'||item?.cause==='symbols-only'||isKnownNonCommercialLine(raw)){
     suppressedInvalid.push(item);
     return false;
   }
   return true;
 });

 bundle.diagnostics={
   ...(bundle.diagnostics||{}),
   suppressed_structural_ambiguities:suppressedAmbiguities.length,
   suppressed_noncommercial_invalid:suppressedInvalid.length
 };
 bundle.metrics={
   ...(bundle.metrics||{}),
   n_ambiguous:bundle.ambiguities.length,
   n_invalid:bundle.invalid.length
 };
 return bundle;
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
 const bundle=refineInterpreterDiagnostics(finalizeBundleIdentity(interpretResolved({document:raw,schema,knowledge:null})));
 const queue=mapBundleToC01ReviewQueue(bundle,{analysis_id,source_id,currency:'BRL'});
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
    const partition=partitionCandidates(built.queue);
    let persisted=0,idempotent=0,auto_promoted=0,review_required=0;
    const review_reasons={};

    for(const item of partition.auto){
      const candidateSaved=await rpc(env,token,'extcalc_persist_review_candidate_v0',{p_candidate:item.candidate});
      persisted+=1;if(candidateSaved?.idempotent===true)idempotent+=1;
      const promoted=await rpc(env,token,'extcalc_persist_auto_promoted_c01_v0',{p_promoted:item.promoted});
      auto_promoted+=1;
      if(promoted?.idempotent===true)idempotent+=1;
    }

    for(const item of partition.review){
      const saved=await rpc(env,token,'extcalc_persist_review_candidate_v0',{p_candidate:item.candidate});
      persisted+=1;if(saved?.idempotent===true)idempotent+=1;
      review_required+=1;
      for(const reason of item.assessment.reasons){
        review_reasons[reason]=(review_reasons[reason]||0)+1;
      }
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
        auto_promoted,
        review_required,
        review_reasons,
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
