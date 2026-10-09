'use strict';
// Private read-only integrated proof. No supplier registration, RPC, C01 writes or promotion.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {auditIntegratedShadow}=require('./shadow-integrated-readonly-v1');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function runPrivateIntegratedCorpus({directory,suppliers=[]}={}){
 if(typeof directory!=='string'||!fs.statSync(directory).isDirectory())
  throw new Error('CORPUS_DIRECTORY_REQUIRED');
 if(!Array.isArray(suppliers))throw new Error('SUPPLIER_CATALOG_INVALID');
 const filenames=fs.readdirSync(directory).filter(name=>name.toLowerCase().endsWith('.txt')).sort();
 if(!filenames.length)throw new Error('EMPTY_CORPUS');
 const files=filenames.map(filename=>{
  const full=path.join(directory,filename);
  const stat=fs.lstatSync(full);
  if(!stat.isFile()||stat.isSymbolicLink())throw new Error('UNSAFE_CORPUS_ENTRY');
  const bytes=fs.readFileSync(full);
  const text=bytes.toString('utf8');
  const audit=auditIntegratedShadow({filename,content:text,suppliers});
  const reasons={};
  for(const entry of audit.decisions){
   for(const reason of entry.reasons)reasons[reason]=(reasons[reason]||0)+1;
  }
  if(audit.summary.blocked!==audit.summary.interpreted
     ||audit.summary.persisted!==0||audit.summary.auto_promoted!==0
     ||audit.summary.c01_candidates_created!==0||audit.ready_for_c01_persistence!==false)
   throw new Error('INTEGRATED_SHADOW_NOT_FAIL_CLOSED');
  return {
   file_sha256:digest(bytes),
   file_label_sha256:digest(filename),
   supplier_state:audit.supplier.state,
   interpreted:audit.summary.interpreted,
   blocked:audit.summary.blocked,
   persisted:0,auto_promoted:0,
   reasons
  };
 });
 return {
  contract_version:'external-calc-private-integrated-shadow-corpus/v1',
  files_seen:files.length,
  known_supplier_matches:files.filter(x=>x.supplier_state==='MATCHED_EXISTING_REVIEW_ONLY').length,
  unknown_supplier_matches:files.filter(x=>x.supplier_state==='UNKNOWN_REVIEW_ONLY').length,
  ambiguous_supplier_matches:files.filter(x=>x.supplier_state==='AMBIGUOUS_REVIEW_ONLY').length,
  interpreted:files.reduce((n,x)=>n+x.interpreted,0),
  blocked:files.reduce((n,x)=>n+x.blocked,0),
  persisted:0,auto_promoted:0,c01_candidates_created:0,
  source_level_truth_verified:false,
  operational_batch_verified:false,
  release_status:'NO_GO',
  files
 };
}
if(require.main===module){
 const dir=process.argv[2],catalog=process.argv[3];
 if(!dir)throw new Error('Usage: node private-integrated-shadow-corpus-v1.js <private-txt-directory> [private-supplier-catalog.json]');
 const suppliers=catalog?JSON.parse(fs.readFileSync(catalog,'utf8')):[];
 console.log(JSON.stringify(runPrivateIntegratedCorpus({directory:path.resolve(dir),suppliers}),null,2));
}
module.exports={runPrivateIntegratedCorpus};
