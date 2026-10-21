#!/usr/bin/env node
// First-attempt VS4 adversarial evaluator; oracle is immutable and created
// without reading parser results. Tests both wrongful associations and
// unwarranted abstentions, preserving each synthetic case.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parseTextSource}=require('../../external-calc-universal-input/v1/text-adapter');
const {evaluateReview}=require('./review-shadow.cjs');
const opt={};for(let i=2;i<process.argv.length;i+=2)opt[process.argv[i]]=process.argv[i+1];
if(!opt['--corpus']||!opt['--report'])throw Error('Usage: node evaluate-adversarial.mjs --corpus folder --report file');
const dir=resolve(opt['--corpus']),sha=s=>createHash('sha256').update(s).digest('hex');
const truth=JSON.parse(readFileSync(join(dir,'oracle.json'),'utf8'));
const manifest=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
if(!truth.synthetic||!truth.independent_of_parser||!truth.count||
 sha(JSON.stringify(truth,null,2)+'\n')!==manifest.oracle_sha256)
 throw Error('INVALID_INDEPENDENT_ORACLE');
const norm=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f\uFE0E\uFE0F]/gu,'').toLowerCase().trim();
let unsafe=0,valid=0,correctAbstentions=0,unsafeProposals=0,
 correctValid=0,missingValid=0,unexpectedValid=0,invalidLineage=0,
 falseApproval=0,criticalSilent=0;
const results=[];
for(const spec of truth.cases){
 const content=readFileSync(join(dir,spec.filename),'utf8');
 if(sha(content)!==spec.source_sha256)throw Error('SOURCE_TAMPERING '+spec.id);
 const doc=parseTextSource({filename:spec.filename,content},{idFactory:()=> 'vs4-'+spec.id});
 const {association,review}=evaluateReview(doc);
 if(review.authorized_offers.length||review.auto_approvable_count)falseApproval++;
 const proposals=association.proposals;
 const result={id:spec.id,type:spec.type,oracle_kind:spec.oracle_kind,
  expected_reason:spec.expected_reason,proposals:proposals.length,
  abstentions:association.abstentions.map(a=>a.reason),
  severities:review.candidate_assessments.map(a=>a.severity)};
 if(spec.oracle_kind==='MUST_ABSTAIN'){
   unsafe++;
   unsafeProposals+=proposals.length;
   const flagged=association.abstentions.some(a=>a.reason===spec.expected_reason);
   if(proposals.length===0&&flagged&&review.global_risks.some(r=>r.reason==='MATERIAL_ABSTENTION'))correctAbstentions++;
   else if(proposals.length>0&&!review.candidate_assessments.some(a=>a.severity==='CRITICAL'))
    criticalSilent+=proposals.length;
   result.correct_abstention=proposals.length===0&&flagged;
 }else{
   valid++;
   if(proposals.length!==1){
     missingValid+=(proposals.length===0?1:0);
     unexpectedValid+=(proposals.length>1?proposals.length-1:0);
   }
   const p=proposals[0],e=spec.expected_offer;
   const fields=p&&norm(p.model)===norm(e.model)&&p.capacity_gb===e.capacity_gb&&
      norm(p.color)===norm(e.color)&&norm(p.condition)===norm(e.condition)&&
      p.price_minor===e.price_minor&&p.decision==='PROPOSED_REVIEW';
   const expectedLines=content.trimEnd().split('\n');
   const srcValid=p&&['model','condition','color','price'].every(field=>{
     const refs=p.source_spans?.[field]||[];
     return refs.length>0&&refs.every(ref=>{
       const line=Number(ref.replace('line:',''));
       return Number.isInteger(line)&&line>0&&line<=expectedLines.length;
     });
   });
   const accepted=proposals.length===1&&fields&&srcValid&&
     review.summary.critical_candidates===0;
   if(accepted)correctValid++;
   else{
     if(p&&!fields&&!review.candidate_assessments.some(a=>a.severity==='CRITICAL'))criticalSilent++;
     if(p&&!srcValid)invalidLineage++;
   }
   result.correct_offer=Boolean(accepted);
 }
 results.push(result);
}
const report={contract_version:'external-calc-vs4-adversarial-evaluation/v1',
 partition:'SYNTHETIC_POST_FREEZE',generator_oracle_sha256:manifest.oracle_sha256,
 cases:truth.count,unsafe,valid,correct_abstentions:correctAbstentions,
 unsafe_proposals:unsafeProposals,valid_exact:correctValid,missing_valid:missingValid,
 unexpected_valid:unexpectedValid,invalid_lineage:invalidLineage,
 critical_silent_errors:criticalSilent,false_approvals:falseApproval,
 unsafe_abstention_recall:unsafe?correctAbstentions/unsafe:null,
 valid_coverage:valid?correctValid/valid:null,production_gate:'NO_GO',results};
 report.decision=correctAbstentions===unsafe&&unsafeProposals===0&&
   correctValid===valid&&!criticalSilent&&!falseApproval?'SYNTHETIC_ADVERSARIAL_PASS':'FAIL';
writeFileSync(resolve(opt['--report']),JSON.stringify(report,null,2)+'\n');
console.log('VS4_ADVERSARIAL='+report.decision+' unsafe_abstained='+correctAbstentions+
 '/'+unsafe+' unsafe_proposals='+unsafeProposals+' valid_exact='+correctValid+
 '/'+valid+' critical_silent='+criticalSilent+' authorized='+falseApproval);
if(report.decision!=='SYNTHETIC_ADVERSARIAL_PASS')process.exitCode=1;
