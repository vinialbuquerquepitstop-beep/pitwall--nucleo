'use strict';

/** External AI output is UNTRUSTED. This adapter only validates and stages
 * extraction; it never approves C01, assigns tenant, or writes to the DB.
 * Sources must be supplied again with original text to verify quoted evidence.
 */
const VERSION='external-calc-extraction/v0';
const MAX_OFFERS=300,MAX_SOURCES=100,MAX_JSON_BYTES=1024*1024;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function fail(code,message){throw Object.assign(new Error(message),{code,status:422})}
function object(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)}
function str(x,max=500){return typeof x==='string'&&x.length>0&&x.length<=max}
function optional(x,max=500){return x===null||str(x,max)}
function exact(o,keys,path){if(!object(o))fail('AI_EXTRACTION_SCHEMA_INVALID',path+' deve ser objeto');for(const k of Object.keys(o))if(!keys.includes(k))fail('AI_EXTRACTION_SCHEMA_INVALID',path+'.'+k+' desconhecido');for(const k of keys)if(!own(o,k))fail('AI_EXTRACTION_SCHEMA_INVALID',path+'.'+k+' ausente')}
function normalized(v){return String(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase()}
function citedValue(evidence,value){
 return evidence.some(e=>normalized(e.quote).includes(normalized(value)));
}
function citedMoney(evidence,minor){
 return evidence.some(e=>{
  const matches=e.quote.match(/(?:\d{1,3}(?:\.\d{3})+|\d{4,7})(?:,\d{2})?/g)||[];
  return matches.some(token=>{
   const whole=token.replace(/\./g,'').split(',');
   const value=Number(whole[0])*100+Number((whole[1]||'00').padEnd(2,'0'));
   return Number.isSafeInteger(value)&&value===minor;
  });
 });
}
function citedCapacity(evidence,gb){
 return evidence.some(e=>new RegExp('(^|\\D)'+gb+'\\s*(?:GB|G)(?![a-z])','i').test(e.quote));
}
function parseExternalAiExtraction(input){
 const raw=typeof input==='string'?input:JSON.stringify(input);
 if(Buffer.byteLength(raw,'utf8')>MAX_JSON_BYTES)fail('AI_EXTRACTION_TOO_LARGE','JSON excedeu limite de 1MB');
 let data;try{data=typeof input==='string'?JSON.parse(input):input}catch{fail('AI_EXTRACTION_JSON_INVALID','JSON invalido')}
 exact(data,['schema_version','sources','offers','unresolved','coverage'],'root');
 if(data.schema_version!==VERSION)fail('AI_EXTRACTION_VERSION_INVALID','versao incompatível');
 if(!Array.isArray(data.sources)||!data.sources.length||data.sources.length>MAX_SOURCES)fail('AI_EXTRACTION_SCHEMA_INVALID','sources fora do limite');
 if(!Array.isArray(data.offers)||data.offers.length>MAX_OFFERS)fail('AI_EXTRACTION_SCHEMA_INVALID','offers fora do limite');
 if(!Array.isArray(data.unresolved)||data.unresolved.length>MAX_OFFERS)fail('AI_EXTRACTION_SCHEMA_INVALID','unresolved fora do limite');
 exact(data.coverage,['source_items_total','processed_items','unprocessed_items'],'coverage');
 const counts=['source_items_total','processed_items','unprocessed_items'].map(k=>data.coverage[k]);
 if(counts.some(x=>x!==null&&(!Number.isSafeInteger(x)||x<0)))fail('AI_EXTRACTION_SCHEMA_INVALID','coverage invalido');
 if(counts.every(x=>x!==null)&&counts[0]!==counts[1]+counts[2])fail('AI_EXTRACTION_COVERAGE_CONFLICT','cobertura nao fecha');
 const sources=new Map(),offers=new Set(),issues=[],recognized=[];
 for(const s of data.sources){
  exact(s,['source_ref','filename','kind','text'],'source');
  if(!str(s.source_ref,100)||sources.has(s.source_ref)||!str(s.filename,180)||!['TEXT','MESSAGE','ZIP_ENTRY','CSV'].includes(s.kind)||!str(s.text,200000))
   fail('AI_EXTRACTION_SCHEMA_INVALID','fonte invalida, duplicada ou sem texto original');
  sources.set(s.source_ref,s);
 }
 for(const [i,o] of data.offers.entries()){
  const path='offers['+i+']';
  exact(o,['offer_ref','raw_model','brand','model','capacity_gb','color','condition','price','supplier_ref','source_refs','field_evidence','extraction_confidence','issues'],path);
  if(!str(o.offer_ref,100)||offers.has(o.offer_ref)||!optional(o.raw_model)||!optional(o.brand)||!optional(o.model)||!optional(o.color)||!optional(o.condition)||!optional(o.supplier_ref,100))fail('AI_EXTRACTION_SCHEMA_INVALID',path+' identificacao invalida');
  offers.add(o.offer_ref);
  if(o.capacity_gb!==null&&(!Number.isSafeInteger(o.capacity_gb)||o.capacity_gb<=0))fail('AI_EXTRACTION_SCHEMA_INVALID',path+' capacity_gb invalida');
  if(o.price!==null){exact(o.price,['amount_minor','currency'],'price');if(!Number.isSafeInteger(o.price.amount_minor)||o.price.amount_minor<=0||o.price.currency!=='BRL')fail('AI_EXTRACTION_SCHEMA_INVALID',path+' price invalido')}
  if(!Array.isArray(o.source_refs)||!o.source_refs.length||o.source_refs.some(ref=>!sources.has(ref)))fail('AI_EXTRACTION_SOURCE_MISSING',path+' referencia sem fonte');
  if(!object(o.field_evidence)||!Array.isArray(o.issues)||o.issues.some(x=>!str(x,200))||typeof o.extraction_confidence!=='number'||o.extraction_confidence<0||o.extraction_confidence>1)fail('AI_EXTRACTION_SCHEMA_INVALID',path+' diagnostico invalido');
  const requiredEvidence=['raw_model','brand','model','capacity_gb','color','condition','price','supplier_ref'];
  exact(o.field_evidence,requiredEvidence,path+'.field_evidence');
  let evidenceCount=0;
  for(const field of requiredEvidence){
   const evidence=o.field_evidence[field];
   if(!Array.isArray(evidence))fail('AI_EXTRACTION_SCHEMA_INVALID',path+'.'+field+' evidencias invalidas');
   for(const e of evidence){
    exact(e,['source_ref','quote'],path+'.evidence');
    const s=sources.get(e.source_ref);
    if(!s||!o.source_refs.includes(e.source_ref)||!str(e.quote,500)||!s.text.includes(e.quote))fail('AI_EXTRACTION_EVIDENCE_MISMATCH',path+'.'+field+' evidencia nao confere com fonte');
    evidenceCount++;
   }
   if(o[field]!==null && field!=='supplier_ref' && evidence.length===0)issues.push({offer_ref:o.offer_ref,field,reason:'MISSING_FIELD_PROVENANCE'});
  }
  // Literal substring membership alone can cite the wrong value from the
  // same message. Use local, deterministic semantic cross-checks to mark
  // suspicious values for review without trusting AI confidence.
  for(const field of ['model','color','condition']){
   if(o[field]!==null && !citedValue(o.field_evidence[field],o[field]))
    issues.push({offer_ref:o.offer_ref,field,reason:'EVIDENCE_VALUE_MISMATCH'});
  }
  if(o.capacity_gb!==null&&!citedCapacity(o.field_evidence.capacity_gb,o.capacity_gb))
   issues.push({offer_ref:o.offer_ref,field:'capacity_gb',reason:'EVIDENCE_VALUE_MISMATCH'});
  if(o.price!==null&&!citedMoney(o.field_evidence.price,o.price.amount_minor))
   issues.push({offer_ref:o.offer_ref,field:'price',reason:'EVIDENCE_VALUE_MISMATCH'});
  if(evidenceCount===0)issues.push({offer_ref:o.offer_ref,field:'*',reason:'NO_SOURCE_EVIDENCE'});
  for(const f of ['model','price'])if(o[f]===null)issues.push({offer_ref:o.offer_ref,field:f,reason:'MISSING_CRITICAL_FIELD'});
  if(o.issues.length)issues.push({offer_ref:o.offer_ref,field:'*',reason:'AI_DECLARED_ISSUES'});
  recognized.push(o);
 }
 for(const u of data.unresolved){
  exact(u,['source_ref','reason','quote'],'unresolved');
  if(!sources.has(u.source_ref)||!str(u.reason,250)||!str(u.quote,500)||!sources.get(u.source_ref).text.includes(u.quote))fail('AI_EXTRACTION_EVIDENCE_MISMATCH','unresolved sem proveniencia');
 }
 // A message may update the same model/color/condition price. This needs
 // adjudication, not a silent "take latest" or AI-selected overwrite.
 const priceGroups=new Map();
 for(const offer of recognized){
  if(!offer.model||!offer.price)continue;
  const key=JSON.stringify([
   offer.supplier_ref||offer.source_refs.slice().sort().join(','),
   offer.model.trim().toLowerCase(),offer.capacity_gb,
   offer.color?.trim().toLowerCase()||null,
   offer.condition?.trim().toLowerCase()||null
  ]);
  if(!priceGroups.has(key))priceGroups.set(key,[]);
  priceGroups.get(key).push(offer);
 }
 for(const offers of priceGroups.values()){
  if(offers.length>1&&new Set(offers.map(o=>o.price.amount_minor)).size>1)
   for(const offer of offers)issues.push({offer_ref:offer.offer_ref,field:'price',reason:'CONFLICTING_PRICE_FOR_VARIANT'});
 }
 // Unresolved source messages are evidence of uncertainty, even when the
 // extracted offer fields look complete.
 for(const offer of recognized){
  if(data.unresolved.some(u=>offer.source_refs.includes(u.source_ref)))
   issues.push({offer_ref:offer.offer_ref,field:'*',reason:'UNRESOLVED_SOURCE_CONTEXT'});
 }
 const incomplete=counts.some(x=>x===null)||data.coverage.unprocessed_items!==0;
 const reviewRefs=new Set(issues.map(x=>x.offer_ref));
 // Output JSON is NEVER an authoritative Reviewed Offer. Even fully evidenced
 // entries need an internal C01 authority pass before any promotion.
 return {contract_version:VERSION,valid:true,coverage_complete:!incomplete,
  accepted_for_staging:recognized.length-reviewRefs.size,needs_review:reviewRefs.size,
  issues,offers:recognized,sources:[...sources.values()],unresolved:data.unresolved,
  persistence_allowed:false,authority:'STAGING_ONLY',c01_import_ready:false};
}
module.exports={VERSION,parseExternalAiExtraction};
