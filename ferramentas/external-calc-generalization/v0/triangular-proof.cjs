'use strict';
// VS5.1 independent triangular fidelity measurement. NO persistence or promotion.
// Oracle is supplied externally and MUST predate the interpretation.
const crypto=require('node:crypto');
const {buildQueue}=require('../../external-calc-list-intake/v0/list-intake-api');
const {shadowAsC01ReadOnlyPreview}=require('./c01-compatibility-shadow.cjs');
const sha=s=>crypto.createHash('sha256').update(String(s),'utf8').digest('hex');
function norm(v){return String(v??'').normalize('NFKD').replace(/[\u0300-\u036f\uFE0E\uFE0F]/gu,'').replace(/\s+/gu,' ').trim().toLowerCase()}
function material(item){
 const offer=item.interpreted_offer||item;
 return {
   model:offer.model?.label??offer.model??null,
   capacity_gb:offer.capacity_gb??null,
   condition:offer.condition??null,color:offer.color??null,
   price_minor:offer.price?.amount_minor??offer.price_minor??null,
   currency:offer.price?.currency??offer.currency??'BRL'
 };
}
function key(raw){
 const x=material(raw);
 return JSON.stringify([norm(x.model),x.capacity_gb,norm(x.condition),norm(x.color),x.price_minor,x.currency]);
}
function lineNumbers(refs){
 return (Array.isArray(refs)?refs:[]).map(x=>Number(String(x).replace(/^line:/,'')))
  .filter(Number.isSafeInteger).sort((a,b)=>a-b);
}
function proofRefs(candidate,field,kind){
 if(kind==='oracle')return lineNumbers(candidate.lineage?.[field+'_lines']);
 return lineNumbers(candidate.review_evidence?.field_sources?.[field]);
}
function truthCompare(truth,candidates,kind){
 const pool=new Map();
 for(const expected of truth.offers){
   const k=key(expected);
   if(!pool.has(k))pool.set(k,[]);
   pool.get(k).push(expected);
 }
 let fieldMatches=0,exactWithLineage=0;
 const invalidLineage=[],unexpected=[],matched=[];
 for(const candidate of candidates){
   const k=key(candidate),list=pool.get(k)||[];
   if(!list.length){
     unexpected.push({key:k,fields:material(candidate)});
     continue;
   }
   const expected=list.shift();fieldMatches++;
   const failures=[];
   for(const field of ['model','color','condition','price']){
     const expectedRefs=proofRefs(expected,field,'oracle');
     const actualRefs=proofRefs(candidate,field,kind);
     if(actualRefs.length===0||actualRefs.some(n=>!expectedRefs.includes(n)))
       failures.push({field,expected:expectedRefs,actual:actualRefs});
   }
   if(failures.length)invalidLineage.push({offer_key:expected.offer_key,fields:failures});
   else exactWithLineage++;
   matched.push(expected.offer_key);
 }
 const missing=[...pool.values()].flat().map(x=>({offer_key:x.offer_key,fields:material(x)}));
 return {
   expected:truth.offer_count,observed:candidates.length,
   exact_material_fields:fieldMatches,exact_with_lineage:exactWithLineage,
   missing_count:missing.length,extra_count:unexpected.length,
   lineage_mismatch_count:invalidLineage.length,
   material_precision:candidates.length?fieldMatches/candidates.length:null,
   material_recall:truth.offer_count?fieldMatches/truth.offer_count:null,
   missing:missing.slice(0,35),extra:unexpected.slice(0,35),lineage_mismatches:invalidLineage.slice(0,35),
   status:missing.length===0&&unexpected.length===0&&invalidLineage.length===0?'EXACT':'MISMATCH'
 };
}
function measureTriangle({filename='synthetic-supplier.txt',content,oracle}){
 if(typeof content!=='string'||!content.trim())throw Error('VS51_SOURCE_REQUIRED');
 if(!oracle||oracle.synthetic!==true||oracle.independent_of_parser!==true||
    oracle.source_sha256!==sha(content)||oracle.offer_count!==oracle.offers?.length)
   throw Error('VS51_ORACLE_INDEPENDENCE_OR_HASH_INVALID');
 const legacy=buildQueue({filename,content});
 const shadow=shadowAsC01ReadOnlyPreview({filename,content});
 const legacyHash=legacy.canonical.source.content_hash,shadowHash=shadow.source_hash;
 if(legacyHash!==shadowHash||legacyHash!=='sha256:'+oracle.source_sha256)
   throw Error('VS51_SOURCES_NOT_IDENTICAL');
 if(shadow.production_queue||shadow.auto_promoted!==0||shadow.persisted!==0||
    shadow.candidates.some(x=>x.contract_version!==null||
      !x.authorization?.persist_disabled||!x.authorization?.quote_disabled))
   throw Error('VS51_SHADOW_AUTHORITY_VIOLATION');
 const current=truthCompare(oracle,legacy.queue.candidates,'c01');
 const proposed=truthCompare(oracle,shadow.candidates,'shadow');
 return {
   contract_version:'external-calc-vs5-triangular-proof/v0',
   mode:'READ_ONLY',source_sha256:oracle.source_sha256,
   oracle_partition:oracle.partition??'SYNTHETIC',
   frozen_comparison:true,
   legacy_c01:current,shadow_vs2_vs3:proposed,
   absences:{legacy_unresolved_ambiguities:legacy.queue.unresolved_ambiguities.length,
             shadow_abstentions:shadow.unresolved.length,
             shadow_global_risks:shadow.global_risks.length},
   interpretive_conclusion:current.status==='EXACT'&&proposed.status==='EXACT'?'BOTH_MATCH_ORACLE':
     current.status==='EXACT'?'LEGACY_ONLY_MATCHES_ORACLE':
     proposed.status==='EXACT'?'SHADOW_ONLY_MATCHES_ORACLE':'NEITHER_FULLY_MATCHES_ORACLE',
   accepted_offers:0,auto_promotions:0,persisted:0,
   production_gate:'NO_GO',
   limitations:'Synthetic oracle only. C01 value normalization and lineage are compared exactly; no authorization, browser, tenant or external supplier proof.'
 };
}
module.exports={material,key,truthCompare,measureTriangle};
