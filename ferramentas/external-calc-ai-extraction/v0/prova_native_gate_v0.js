'use strict';
// Native Node.js Gate Runner for Portable External AI Ingestion.
// It runs ONLY local pure-function/mocked tests, no authenticated network,
// no database writes, no Cloudflare deploy. Reproducible for review on checkout.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const files=[
 'prova_portable_extraction_v0.js',
 'prova_original_source_verifier_v0.js',
 'prova_variant_price_binding_v0.js',
 'prova_quality_multicolor_binding_v0.js',
 'prova_temporal_offer_diagnostics_v0.js',
 'prova_canonical_model_resolver_v0.js',
 'prova_external_ai_c01_preview_v0.js',
 'prova_supplier_session_authority_v0.js',
 'prova_portable_extraction_api_v0.js',
 'prova_original_zip_unpacked_v0.js'
];
let failures=0;
for(const file of files){
 const result=spawnSync(process.execPath,[path.join(__dirname,file)],{
  encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024,
  env:{...process.env,NO_NETWORK:'1'}
 });
 if(result.status!==0||result.error){
  failures++;
  process.stderr.write('FAIL '+file+'\n'+(result.stderr||'')+'\n'+String(result.error||'')+'\n');
 }else{
  process.stdout.write('PASS '+file+'\n');
 }
}
if(failures){
 process.stderr.write('EXTERNAL_AI_NATIVE_GATE=FAIL '+failures+'/'+files.length+'\n');
 process.exitCode=1;
}else console.log('EXTERNAL_AI_NATIVE_GATE=PASS '+files.length+'/'+files.length);
