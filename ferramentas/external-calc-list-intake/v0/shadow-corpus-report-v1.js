'use strict';
// Private source stays local. This is a read-only shadow report, never a release PASS.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {reconcileShadowSource}=require('./shadow-source-reconciliation-v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function reportShadowCorpus(directory){
 const names=fs.readdirSync(directory).filter(x=>x.toLowerCase().endsWith('.txt')).sort();
 if(names.length===0)throw new Error('No private TXT sources');
 const files=names.map(filename=>{
  const bytes=fs.readFileSync(path.join(directory,filename));
  const data=reconcileShadowSource(bytes.toString('utf8'));
  const invalid=data.candidates.filter(x=>x.amount_minor!==null&&(!Number.isSafeInteger(x.amount_minor)||x.amount_minor<=0)).length;
  const missing=data.candidates.filter(x=>x.amount_minor===null).length;
  const engines={};
  for(const c of data.candidates)engines[c.engine]=(engines[c.engine]||0)+1;
  return {filename,sha256:sha(bytes),source_lines:data.source_lines,
   shadow_candidates:data.shadow_candidates,overlapping_price_lines:data.overlapping_price_lines,
   invalid_amounts:invalid,unknown_amounts:missing,engines,
   review_required:data.review_required,auto_promoted:data.auto_promoted};
 });
 return {contract_version:'external-calc-shadow-corpus-report/v1',
  files_seen:files.length,total_shadow_candidates:files.reduce((a,f)=>a+f.shadow_candidates,0),
  total_overlap_lines:files.reduce((a,f)=>a+f.overlapping_price_lines,0),
  auto_promoted:0,ground_truth_reconciled:false,batch_integrated:false,
  release_status:'NO_GO',files};
}
if(require.main===module){
 if(!process.argv[2])throw Error('Usage: node shadow-corpus-report-v1.js <private-txt-directory>');
 process.stdout.write(JSON.stringify(reportShadowCorpus(path.resolve(process.argv[2])),null,2)+'\n');
}
module.exports={reportShadowCorpus};
