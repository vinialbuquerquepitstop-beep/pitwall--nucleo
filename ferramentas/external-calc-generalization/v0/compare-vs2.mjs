#!/usr/bin/env node
// VS2 shadow-only evaluator: compares independent generator truth against
// proposed edges and source spans. Cannot publish or authorize C01 offers.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const opt={};for(let i=2;i<process.argv.length;i+=2)opt[process.argv[i]]=process.argv[i+1];
if(!opt['--oracle']||!opt['--shadow']||!opt['--report'])
 throw Error('Usage: node compare-vs2.mjs --oracle file --shadow file --report file');
const oracle=JSON.parse(readFileSync(resolve(opt['--oracle']),'utf8'));
const shadow=JSON.parse(readFileSync(resolve(opt['--shadow']),'utf8'));
if(!oracle.synthetic||!oracle.independent_of_parser||shadow.mode!=='SHADOW_READ_ONLY'
 ||shadow.document_source_hash!=='sha256:'+oracle.source_sha256
 ||shadow.offers?.length!==0)
 throw Error('INVALID_ORACLE_OR_SHADOW_PROVENANCE');
const n=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/gu,'')
 .replace(/\s+/gu,' ').trim().toLowerCase();
const key=x=>JSON.stringify([n(x.model),x.capacity_gb??null,n(x.color),n(x.condition),x.price_minor]);
const pool=new Map();
for(const exp of oracle.offers){
 const k=key(exp);if(!pool.has(k))pool.set(k,[]);
 pool.get(k).push(exp);
}
const errors=[],lineage=[],matched=[],extras=[];
for(const p of shadow.proposals||[]){
 if(p.decision!=='PROPOSED_REVIEW')errors.push({type:'AUTO_APPROVAL_ATTEMPT',proposal_id:p.proposal_id});
 const k=key(p),entries=pool.get(k)||[];
 if(!entries.length){extras.push({proposal_id:p.proposal_id,fields:k,block_id:p.block_id});continue}
 const e=entries.shift();
 matched.push(e.offer_key);
 const spanOk=(field,expectedLines)=>{
  const observed=p.source_spans?.[field]||[];
  return observed.length>0 && observed.every(s=>expectedLines.some(n=>s==='line:'+n));
 };
 for(const field of ['model','color','condition','price']){
   const expected=e.lineage[field+'_lines'];
   if(!spanOk(field,expected))lineage.push({offer_key:e.offer_key,field,
      expected:expected.map(x=>'line:'+x),actual:p.source_spans?.[field]??null});
 }
}
const missing=[...pool.values()].flat().map(e=>({offer_key:e.offer_key,block_id:e.block_id,fields:key(e)}));
const report={
 contract_version:'external-calc-vs2-challenge-report/v0',
 generator_version:oracle.generator_version,
 partition:oracle.partition,
 frozen_source_sha256:oracle.source_sha256,
 expected:oracle.offer_count,proposed:shadow.proposals?.length||0,
 exact_fields:matched.length,
 missing_count:missing.length,extra_count:extras.length,
 lineage_mismatch_count:lineage.length,abstentions:shadow.abstentions?.length??null,
 errors:errors.slice(0,40),missing:missing.slice(0,60),extra:extras.slice(0,60),
 lineage_mismatches:lineage.slice(0,60),
 decision:missing.length||extras.length||lineage.length||errors.length?'FAIL':'SHADOW_EXACT_PASS',
 production_gate:'NO_GO'
};
writeFileSync(resolve(opt['--report']),JSON.stringify(report,null,2)+'\n');
console.log('VS2_CHALLENGE='+report.decision+' expected='+report.expected+
 ' proposed='+report.proposed+' exact='+report.exact_fields+
 ' missing='+report.missing_count+' unexpected='+report.extra_count+
 ' lineage='+report.lineage_mismatch_count+' abstentions='+report.abstentions);
if(report.decision!=='SHADOW_EXACT_PASS')process.exitCode=1;
