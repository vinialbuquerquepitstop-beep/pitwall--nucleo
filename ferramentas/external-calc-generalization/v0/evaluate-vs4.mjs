#!/usr/bin/env node
// VS4 controlled evaluation; truth originates in generator, never parser.
// Metrics measure exact fields + lineage + review flags + abstentions. 
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const opt={};for(let i=2;i<process.argv.length;i+=2)opt[process.argv[i]]=process.argv[i+1];
if(!opt['--oracle']||!opt['--association']||!opt['--review']||!opt['--report'])throw Error('Usage: node evaluate-vs4.mjs --oracle oracle.json --association association.json --review review.json --report report.json');
const oracle=JSON.parse(readFileSync(resolve(opt['--oracle']),'utf8'));
const a=JSON.parse(readFileSync(resolve(opt['--association']),'utf8'));
const r=JSON.parse(readFileSync(resolve(opt['--review']),'utf8'));
if(oracle.synthetic!==true||oracle.independent_of_parser!==true||
 a.mode!=='SHADOW_READ_ONLY'||r.mode!=='SHADOW_READ_ONLY'||
 a.document_source_hash!=='sha256:'+oracle.source_sha256||
 r.document_source_hash!==a.document_source_hash||
 a.offers?.length!==0||r.authorized_offers?.length!==0||
 r.auto_approvable_count!==0||r.decision!=='REVIEW_REQUIRED')throw Error('VS4_UNSAFE_EVALUATION_INPUT');
const norm=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f\uFE0E\uFE0F]/gu,'').toLowerCase().replace(/\s+/gu,' ').trim();
const key=o=>JSON.stringify([norm(o.model),o.capacity_gb??null,norm(o.color),norm(o.condition),o.price_minor]);
const pools=new Map();
for(const exp of oracle.offers){const k=key(exp);if(!pools.has(k))pools.set(k,[]);pools.get(k).push(exp)}
const decisions=new Map((r.candidate_assessments||[]).map(x=>[x.proposal_id,x]));
const wrong=[],badLineage=[],correct=[],failures=[],ids=new Set();
for(const proposal of a.proposals||[]){
 const assess=decisions.get(proposal.proposal_id);
 if(ids.has(proposal.proposal_id))throw Error('VS4_DUPLICATE_ID');
 ids.add(proposal.proposal_id);
 if(!assess||assess.decision!=='REVIEW_REQUIRED')throw Error('VS4_MISSING_HUMAN_REVIEW');
 if(proposal.decision!=='PROPOSED_REVIEW')throw Error('VS4_UNAUTHORIZED_PROPOSAL');
 const batch=pools.get(key(proposal))||[];
 if(!batch.length){
   wrong.push({id:proposal.proposal_id,block_id:proposal.block_id,reason:'NO_ORACLE_MATCH',
     flagged:assess.severity==='CRITICAL',model:proposal.model,price_minor:proposal.price_minor});
   continue;
 }
 const expected=batch.shift();
 const fields=['model','color','price','condition'];
 const mismatched=fields.filter(field=>{
   const required=expected.lineage[field+'_lines'].map(line=>'line:'+line);
   const refs=proposal.source_spans?.[field]||[];
   return !refs.length||!refs.every(ref=>required.includes(ref));
 });
 if(mismatched.length){
   badLineage.push({id:proposal.proposal_id,offer_key:expected.offer_key,fields:mismatched,
     flagged:assess.severity==='CRITICAL'});
 }else correct.push({id:proposal.proposal_id,offer_key:expected.offer_key});
}
const missing=[...pools.values()].flat().map(o=>o.offer_key);
const flaggedWrong=wrong.filter(x=>x.flagged).length;
const flaggedLineage=badLineage.filter(x=>x.flagged).length;
const silent=wrong.length-flaggedWrong+badLineage.length-flaggedLineage;
const total=oracle.offer_count,extracted=(a.proposals||[]).length;
const report={
 contract_version:'external-calc-generalization-vs4/v0',
 source_sha256:oracle.source_sha256,
 domain:'SYNTHETIC_ONLY',decision:null,production_gate:'NO_GO',
 expected:total,proposed:extracted,exact_with_lineage:correct.length,
 wrong_fields:wrong.length,wrong_lineage:badLineage.length,missing:missing.length,
 critical_silent_errors:silent,flagged_wrong_fields:flaggedWrong,
 flagged_wrong_lineage:flaggedLineage,
 proposal_precision:extracted?correct.length/extracted:null,
 offer_recall:total?correct.length/total:null,
 review_required:r.summary?.review_required??null,
 material_abstentions:r.summary?.material_abstentions??null,
 global_risks:r.global_risks?.length??0,
 authorized_offers:0,
 examples:{wrong:wrong.slice(0,25),lineage:badLineage.slice(0,25),missing:missing.slice(0,25)}
};
report.decision=(!silent&&!wrong.length&&!badLineage.length&&!missing.length&&correct.length===total)?
 'SYNTHETIC_EXACT_REVIEW_PASS':'FAIL';
writeFileSync(resolve(opt['--report']),JSON.stringify(report,null,2)+'\n');
console.log('VS4_METRICS='+report.decision+' expected='+total+' exact='+correct.length+
 ' wrong='+wrong.length+' lineage='+badLineage.length+' missing='+missing.length+
 ' critical_silent='+silent+' abstentions='+report.material_abstentions);
if(report.decision!=='SYNTHETIC_EXACT_REVIEW_PASS')process.exitCode=1;
