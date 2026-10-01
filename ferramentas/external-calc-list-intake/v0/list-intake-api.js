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

const COLOR_TEXT_ALIASES=[
 ['CINZA ESPACIAL','Cinza espacial'],['SPACE GRAY','Cinza espacial'],['SPACEGRAY','Cinza espacial'],
 ['ROSE GOLD','Rose Gold'],['ROSEGOLD','Rose Gold'],['MEIA NOITE','Meia-noite'],['MEIA-NOITE','Meia-noite'],
 ['STARLIGHT','Starlight'],['MIDNIGHT','Meia-noite'],['GRAFITE','Grafite'],['GRAPHITE','Grafite'],
 ['NATURAL','Natural'],['SILVER','Prata'],['PRATA','Prata'],['BRANCO','Branco'],['WHITE','Branco'],
 ['PRETO','Preto'],['BLACK','Preto'],['AZUL','Azul'],['BLUE','Azul'],['ROXO','Roxo'],['PURPLE','Roxo'],
 ['LILÁS','Lilás'],['LILAS','Lilás'],['VERMELHO','Vermelho'],['RED','Vermelho'],['VERDE','Verde'],
 ['GREEN','Verde'],['ROSA','Rosa'],['PINK','Rosa'],['AMARELO','Gold'],['YELLOW','Gold'],
 ['DOURADO','Gold'],['GOLD','Gold'],['DESERTO','Desert'],['DESERT','Desert'],['BLUSH','Blush'],
 ['CINZA','Cinza'],['SPACE','Cinza espacial']
];

const COLOR_EMOJI_ALIASES=[
 ['⚫','Preto'],['⚪','Branco'],['🔵','Azul'],['🟣','Roxo'],['🟡','Gold'],['🟢','Verde'],
 ['🔴','Vermelho'],['🩷','Rosa'],['💛','Gold'],['🌹','Rosa'],['🔘','Natural'],['🩶','Cinza']
];

function normalizeColorSearch(value){
 return String(value??'')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .toLocaleUpperCase('pt-BR')
  .replace(/[^A-Z0-9]+/g,' ')
  .replace(/\s+/g,' ')
  .trim();
}

function colorKey(value){
 return normalizeColorSearch(value).toLocaleLowerCase('pt-BR').replace(/\s+/g,'');
}

function findTextColorHits(value){
 const normalized=normalizeColorSearch(value);
 const hits=[];
 const sorted=[...COLOR_TEXT_ALIASES].sort((a,b)=>normalizeColorSearch(b[0]).length-normalizeColorSearch(a[0]).length);
 const occupied=[];
 for(const [alias,color] of sorted){
   const needle=normalizeColorSearch(alias);
   if(!needle)continue;
   let from=0;
   while(true){
     const idx=normalized.indexOf(needle,from);
     if(idx<0)break;
     const before=idx===0?' ':normalized[idx-1];
     const after=idx+needle.length>=normalized.length?' ':normalized[idx+needle.length];
     const boundaryBefore=before===' ';
     const boundaryAfter=after===' ';
     const range=[idx,idx+needle.length];
     const overlaps=occupied.some(([a,b])=>range[0]<b&&range[1]>a);
     if(boundaryBefore&&boundaryAfter&&!overlaps){
       occupied.push(range);
       hits.push({color,index:idx,score:0.98,via:'text'});
     }
     from=idx+Math.max(needle.length,1);
   }
 }
 return hits.sort((a,b)=>a.index-b.index);
}

function findEmojiColorHits(value){
 const line=String(value??'');
 const hits=[];
 for(const [emoji,color] of COLOR_EMOJI_ALIASES){
   let from=0;
   while(true){
     const idx=line.indexOf(emoji,from);
     if(idx<0)break;
     hits.push({color,index:idx,score:0.92,via:'emoji'});
     from=idx+emoji.length;
   }
 }
 return hits.sort((a,b)=>a.index-b.index);
}

function cleanCompositeColor(value){
 let out=String(value??'').normalize('NFKC');
 out=out.replace(/(?:💰|💵).*$/u,' ');
 out=out.replace(/\s*[-–—]\s*\d+%.*$/u,' ');
 out=out.replace(/[🎨🫟*]+/gu,' ');
 for(const [emoji] of COLOR_EMOJI_ALIASES)out=out.split(emoji).join(' ');
 return out.replace(/\s+/g,' ').trim();
}

function extractColorTokens(raw){
 const line=String(raw??'').normalize('NFKC').replace(/(?:💰|💵).*$/u,' ');
 const explicitAlternative=/[\/|]/u.test(line);
 const parts=explicitAlternative?line.split(/[\/|]/u):[line];
 const all=[];

 for(const part of parts){
   if(!part.trim())continue;
   const textHits=findTextColorHits(part);
   const emojiHits=findEmojiColorHits(part);

   if(textHits.length>1&&!explicitAlternative){
     const composite=cleanCompositeColor(part);
     if(composite){
       all.push({color:composite,index:0,score:0.97,via:'text_composite'});
       continue;
     }
   }

   if(textHits.length===1&&emojiHits.length<=1){
     all.push(textHits[0]);
     continue;
   }

   if(textHits.length){
     all.push(...textHits);
     for(const emojiHit of emojiHits){
       if(!textHits.some(textHit=>colorKey(textHit.color)===colorKey(emojiHit.color))){
         all.push(emojiHit);
       }
     }
     continue;
   }

   all.push(...emojiHits);
 }

 all.sort((a,b)=>a.index-b.index||b.score-a.score);
 const seen=new Set(),out=[];
 for(const hit of all){
   const key=colorKey(hit.color);
   if(!key||seen.has(key))continue;
   seen.add(key);
   out.push(hit);
 }
 return out;
}
function sanitizeModelLabel(value){
 let label=String(value??'').normalize('NFKC');
 label=label.replace(/🇺🇸/gu,' ');
 label=label.replace(/\*?\bA\b\*?/giu,' ');
 label=label.replace(/\b(?:CPO|LACRADOS?|SEMINOVOS?)\b/giu,' ');
 label=label.replace(/\(\s*(?:gold|dourado|amarelo)\s*\)/giu,' ');
 for(const [emoji] of COLOR_EMOJI_ALIASES)label=label.split(emoji).join(' ');
 label=label.replace(/[‼🔥]+/gu,' ');
 label=label.replace(/\*+/g,' ');
 label=label.replace(/\s+/g,' ').trim();
 if(/^(?:11|12|13|14|15|16|17)(?:\s|$)/i.test(label)&&!/^iphone\b/i.test(label)){
   label='iPhone '+label;
 }
 return label;
}

function traceLine(record,field){
 const item=(record.trace||[]).find(entry=>entry?.field===field);
 return (item?.sources||[]).find(Number.isSafeInteger)??null;
}

function cloneRecord(record){
 return JSON.parse(JSON.stringify(record));
}

function expandColorVariants(bundle){
 const segmentByLine=new Map((bundle.segments||[])
  .filter(segment=>Number.isSafeInteger(segment?.line_number))
  .map(segment=>[segment.line_number,segment]));

 const baseRecords=bundle.records||[];
 const modelLines=[...new Set(baseRecords.map(r=>traceLine(r,'model')).filter(Number.isSafeInteger))].sort((a,b)=>a-b);
 const pricesByModel=new Map();

 for(const record of baseRecords){
   const modelLine=traceLine(record,'model');
   const priceLine=traceLine(record,'price');
   if(!Number.isSafeInteger(modelLine)||!Number.isSafeInteger(priceLine))continue;
   if(!pricesByModel.has(modelLine))pricesByModel.set(modelLine,[]);
   pricesByModel.get(modelLine).push(priceLine);
 }
 for(const values of pricesByModel.values())values.sort((a,b)=>a-b);

 const expanded=[];
 for(const record of baseRecords){
   const modelLine=traceLine(record,'model');
   const priceLine=traceLine(record,'price');
   if(!Number.isSafeInteger(modelLine)||!Number.isSafeInteger(priceLine)){
     expanded.push(record);
     continue;
   }

   const sameModelPrices=pricesByModel.get(modelLine)||[priceLine];
   const currentPriceIndex=sameModelPrices.indexOf(priceLine);
   const prevPrice=currentPriceIndex>0?sameModelPrices[currentPriceIndex-1]:null;
   const nextPrice=currentPriceIndex>=0&&currentPriceIndex<sameModelPrices.length-1?sameModelPrices[currentPriceIndex+1]:null;
   const nextModel=modelLines.find(line=>line>modelLine)??Infinity;

   const collect=(start,end)=>{
     const found=[];
     for(let line=start;line<=end;line++){
       const raw=segmentByLine.get(line)?.raw;
       if(raw==null)continue;
       for(const token of extractColorTokens(raw))found.push({...token,line});
     }
     const seen=new Set(),unique=[];
     for(const token of found){
       const key=colorKey(token.color);
       if(seen.has(key))continue;
       seen.add(key);
       unique.push(token);
     }
     return unique;
   };

   let colors=collect(priceLine,priceLine);

   if(!colors.length){
     const start=Number.isSafeInteger(prevPrice)?prevPrice+1:modelLine;
     colors=collect(start,priceLine);
   }

   if(!colors.length){
     const lastSegmentLine=Math.max(priceLine,...segmentByLine.keys());
     const stop=Math.min(
       Number.isSafeInteger(nextPrice)?nextPrice-1:lastSegmentLine,
       Number.isFinite(nextModel)?nextModel-1:lastSegmentLine
     );
     if(stop>=priceLine+1){
       colors=collect(priceLine+1,stop);
     }
   }

   if(!colors.length&&typeof record.fields?.color==='string'&&record.fields.color.trim()){
     colors=extractColorTokens(record.fields.color).map(token=>({
       ...token,
       line:traceLine(record,'color')??priceLine
     }));
     if(!colors.length){
       colors=[{
         color:record.fields.color.trim(),
         line:traceLine(record,'color')??priceLine,
         score:0.9,
         via:'schema'
       }];
     }
   }

   if(!colors.length){
     expanded.push(record);
     continue;
   }

   colors.forEach((token,index)=>{
     const next=cloneRecord(record);
     next.record_id=colors.length>1?record.record_id+'-color-'+(index+1):record.record_id;
     next.fields.color=token.color;
     next.trace=(next.trace||[]).filter(item=>item?.field!=='color');
     next.trace.push({
       field:'color',
       chosen:token.color,
       sources:[token.line],
       derived_from:[],
       rules:['list_intake:color_'+token.via],
       alternatives:[],
       score:token.score
     });
     expanded.push(next);
   });
 }

 bundle.records=expanded;
 bundle.metrics={...(bundle.metrics||{}),n_records:expanded.length};
 return bundle;
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
     const normalizedModel=sanitizeModelLabel(rawModel);
     const modelTrace=(record.trace||[]).find(item=>item.field==='model');
     const resolved=resolveEntityCandidate({
       field:'model',
       value:normalizedModel,
       score:modelTrace?.score??0.97,
       evidence:{line_number:modelTrace?.sources?.[0]??null}
     },resolverField,index);
     record.fields.model=resolved&&resolved.entity_id
       ? {id:resolved.entity_id,label:resolved.value,attributes:resolved.attributes||{}}
       : {id:fallbackModelId(normalizedModel),label:normalizedModel,attributes:{identity_source:'supplier-list-fallback-v0'}};
     if(!Number.isInteger(record.fields.capacity_gb)&&Number.isInteger(record.fields.model?.attributes?.capacity_gb)){
       record.fields.capacity_gb=record.fields.model.attributes.capacity_gb;
       record.trace.push({
         field:'capacity_gb',
         chosen:record.fields.capacity_gb,
         sources:modelTrace?.sources||[],
         derived_from:modelTrace?.sources||[],
         rules:['list_intake:model_capacity_attribute'],
         alternatives:[],
         score:modelTrace?.score??0.96
       });
     }
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
 const bundle=refineInterpreterDiagnostics(expandColorVariants(finalizeBundleIdentity(interpretResolved({document:raw,schema,knowledge:null}))));
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
