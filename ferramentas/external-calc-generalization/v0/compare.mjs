#!/usr/bin/env node
// Strict multiset benchmark. Actual results come from the parser, not from the oracle.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const opts={};for(let i=2;i<process.argv.length;i+=2)opts[process.argv[i]]=process.argv[i+1];
if(!opts['--oracle']||!opts['--actual'])throw Error('Usage: node compare.mjs --oracle file --actual file [--report file]');
const oracle=JSON.parse(readFileSync(resolve(opts['--oracle']),'utf8')),input=JSON.parse(readFileSync(resolve(opts['--actual']),'utf8'));
const real=Array.isArray(input.items)?input.items:Array.isArray(input.candidates)?input.candidates:
 Array.isArray(input.queue?.candidates)?input.queue.candidates:null;
if(!real)throw Error('Actual parser result must expose items, candidates or queue.candidates');
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const canonical=a=>({
 model:norm(a.model?.label??a.interpreted_offer?.model?.label??a.model),
 capacity_gb:a.capacity_gb??a.interpreted_offer?.capacity_gb??null,
 color:norm(a.color??a.interpreted_offer?.color),
 condition:norm(a.condition??a.interpreted_offer?.condition),
 price_minor:a.price_minor??a.interpreted_offer?.price?.amount_minor??null
});
const key=v=>JSON.stringify(canonical(v));
const groups=new Map();
real.forEach((a,index)=>{const k=key(a);if(!groups.has(k))groups.set(k,[]);groups.get(k).push({index,a})});
let exact=0,missing=[],lineage_mismatches=[],wrong_fields=[];
for(const exp of oracle.offers){
 const k=key(exp),batch=groups.get(k);
 if(batch?.length){
   const found=batch.pop();exact++;
   const refs=found.a.source_model_lines?{
     model_lines:found.a.source_model_lines,price_lines:found.a.source_price_lines
   }:(found.a.review_evidence?.field_sources?{
     model_lines:found.a.review_evidence.field_sources.model||[],
     price_lines:found.a.review_evidence.field_sources.price||[]
   }:null);
   if(refs&&(!refs.model_lines.some(n=>exp.lineage.model_lines.includes(n))||
    !refs.price_lines.some(n=>exp.lineage.price_lines.includes(n)))){
     lineage_mismatches.push({key:exp.offer_key,expected:exp.lineage,actual:refs});
   }
 }else missing.push({key:exp.offer_key,expected:canonical(exp)});
}
const unexpected=[...groups.values()].flat().map(({index,a})=>({index,actual:canonical(a)}));
const report={
 contract_version:'external-calc-generalization-comparison/v1',
 synthetic:oracle.synthetic,expected:oracle.offer_count,parsed:real.length,exact,
 missing_count:missing.length,unexpected_count:unexpected.length,
 lineage_mismatch_count:lineage_mismatches.length,missing:missing.slice(0,60),
 unexpected:unexpected.slice(0,60),lineage_mismatches:lineage_mismatches.slice(0,60),
 exact_offer_precision:real.length?exact/real.length:null,
 exact_offer_recall:oracle.offer_count?exact/oracle.offer_count:null,
 // Unknown data is never validated by a count-only check.
 decision:(missing.length===0&&unexpected.length===0&&lineage_mismatches.length===0)?'SYNTHETIC_EXACT_PASS':'FAIL'
};
if(opts['--report'])writeFileSync(resolve(opts['--report']),JSON.stringify(report,null,2)+'\n');
console.log('GENERALIZATION_COMPARE='+report.decision+' expected='+report.expected+' parsed='+report.parsed+' exact='+exact+' missing='+missing.length+' unexpected='+unexpected.length+' lineage_mismatch='+lineage_mismatches.length);
if(report.decision!=='SYNTHETIC_EXACT_PASS')process.exitCode=1;
