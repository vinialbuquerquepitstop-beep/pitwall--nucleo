'use strict';
// Read-only local corpus validation; source text remains on the operator's machine.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {buildQueue}=require('./list-intake-api');
const {partitionCandidates}=require('./auto-promotion-authority');
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
function benchmarkCorpus(dir){
 const stat=fs.statSync(dir);
 if(!stat.isDirectory())throw new Error('Corpus path must be a directory of UTF-8 .txt files');
 let commit=null;
 try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
 const files=fs.readdirSync(dir).filter(f=>f.toLowerCase().endsWith('.txt')).sort();
 if(!files.length)throw new Error('No .txt files found');
 const rows=[];
 for(const filename of files){
  const full=path.join(dir,filename);
  if(!fs.statSync(full).isFile())throw new Error('Not a regular file: '+filename);
  const bytes=fs.readFileSync(full);
  const content=bytes.toString('utf8');
  const result=buildQueue({filename,mime_type:'text/plain',content});
  const candidates=result.queue.candidates||[];
  const partition=partitionCandidates(result.queue);
  rows.push({
   filename,sha256:sha256(bytes),source_lines:content.split(/\r?\n/).length,
   candidates:candidates.length,
   auto_eligible:partition.auto.length,
   review_required:partition.review.length,
   ambiguities:(result.queue.unresolved_ambiguities||[]).length,
   invalid:(result.queue.invalid_items||[]).length,
   // No supplier content, contact details, model names, or price amounts in the report.
   // Counts do not establish accuracy or release eligibility.
  });
 }
 return {contract_version:'external-calc-private-corpus-report/v1',
  code_commit:commit,generated_at:new Date().toISOString(),
  source_directory_redacted:true,
  files_seen:rows.length,total_candidates:rows.reduce((n,r)=>n+r.candidates,0),
  total_auto_eligible:rows.reduce((n,r)=>n+r.auto_eligible,0),
  total_review_required:rows.reduce((n,r)=>n+r.review_required,0),
  files:rows,
  source_level_ground_truth_reconciled:false,
  integrated_batch_proven:false,
  unseen_suppliers_gate_proven:false,
  release_status:'NO_GO'};
}
if(require.main===module){
 const dir=process.argv[2];
 if(!dir)throw new Error('Usage: node private-corpus-benchmark-v1.js <local-private-txt-directory>');
 console.log(JSON.stringify(benchmarkCorpus(path.resolve(dir)),null,2));
}
module.exports={benchmarkCorpus};
