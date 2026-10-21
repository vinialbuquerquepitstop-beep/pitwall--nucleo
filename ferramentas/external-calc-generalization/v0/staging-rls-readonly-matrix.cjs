'use strict';
// VS5.3g: transport-neutral, read-only A/B probe assertions.
// This module DOES NOT authenticate JWT, access Supabase, or prove SQL RLS.
const VERSION='external-calc-vs53g-isolation-matrix/v0';
const SOURCE_VERSION='external-calc-original-supplier-source/v0';
const SHA=/^sha256:[0-9a-f]{64}$/;
const ERROR='VS53G_MATRIX_CONFIG_INVALID';
function validateConfig(cfg){
 if(!cfg||typeof cfg!=='object'||Array.isArray(cfg))throw Error(ERROR);
 const keys=['tenant_a','tenant_b','source_a','source_b','absent_ref'];
 for(const key of keys){
  if(typeof cfg[key]!=='string'||!cfg[key].trim()||cfg[key].length>160||
      !/^[A-Za-z0-9_.:-]+$/.test(cfg[key]))throw Error(ERROR);
 }
 if(cfg.tenant_a===cfg.tenant_b||cfg.source_a===cfg.source_b||
    [cfg.source_a,cfg.source_b].includes(cfg.absent_ref))throw Error(ERROR);
 return Object.freeze(Object.fromEntries(keys.map(k=>[k,cfg[k]])));
}
function inspect(result,expected,ref,tenant){
 if(!result||typeof result!=='object'||Array.isArray(result))return 'INVALID_RESPONSE';
 if(expected==='DENY'){
  if((result.status==='NOT_FOUND'||result.status==='FORBIDDEN')&&
      !Object.hasOwn(result,'record')&&!Object.hasOwn(result,'records'))return null;
  return 'CROSS_TENANT_OR_DENIAL_LEAK';
 }
 if(result.status!=='FOUND'||!result.record||
    typeof result.record!=='object'||Array.isArray(result.record)||
    Object.hasOwn(result,'records'))return 'EXPECTED_OWN_SOURCE_MISSING_OR_AMBIGUOUS';
 const row=result.record;
 if(row.source_ref!==ref||row.tenant_id!==tenant||
    row.state!=='AVAILABLE'||row.source_type!=='ORIGINAL_SUPPLIER_TEXT'||
    row.source_contract_version!==SOURCE_VERSION||
    row.immutability!=='APPEND_ONLY'||!SHA.test(row.content_sha256||'')||
    Object.hasOwn(row,'content')||Object.hasOwn(row,'content_bytes'))
   return 'FOUND_ROW_SCOPE_INTEGRITY_OR_DATA_LEAK';
 return null;
}
async function runIsolationMatrix({probe,config}={}){
 if(typeof probe!=='function')throw Error('VS53G_READ_PROBE_REQUIRED');
 const c=validateConfig(config);
 const vectors=[
  {id:'A_OWN',actor:'A',ref:c.source_a,expected:'FOUND',tenant:c.tenant_a},
  {id:'B_OWN',actor:'B',ref:c.source_b,expected:'FOUND',tenant:c.tenant_b},
  {id:'A_FOREIGN',actor:'A',ref:c.source_b,expected:'DENY'},
  {id:'B_FOREIGN',actor:'B',ref:c.source_a,expected:'DENY'},
  {id:'ANON_A',actor:'ANON',ref:c.source_a,expected:'DENY'},
  {id:'ANON_B',actor:'ANON',ref:c.source_b,expected:'DENY'},
  {id:'A_ABSENT',actor:'A',ref:c.absent_ref,expected:'DENY'},
  {id:'B_ABSENT',actor:'B',ref:c.absent_ref,expected:'DENY'}
 ];
 const results=[];
 for(const vector of vectors){
  let reason=null;
  try{
   // Caller supplies the authenticated read-only transport. No client tenant
   // selector or mutable operation is ever sent by this matrix.
   const result=await probe(Object.freeze({actor:vector.actor,source_ref:vector.ref}));
   reason=inspect(result,vector.expected,vector.ref,vector.tenant);
  }catch{reason='TRANSPORT_ERROR_NOT_AUTHORIZATION_DENIAL'}
  results.push({id:vector.id,pass:reason===null,...(reason?{reason}:{})});
 }
 const passed=results.filter(x=>x.pass).length;
 return Object.freeze({
  version:VERSION,method:'INJECTED_READ_ONLY_PROBE',
  evidence_class:'LOGICAL_ASSERTIONS_ONLY',real_rls_verified:false,
  sql_policies_inspected:false,physical_immutability_verified:false,
  network_calls_by_harness:0,writes_by_harness:0,
  cases:results,passed,total:results.length,
  decision:passed===results.length?'SIMULATED_MATRIX_PASS_REAL_RLS_NOT_RUN':'FAIL_CLOSED',
  production_gate:'NO_GO'
 });
}
module.exports={VERSION,validateConfig,runIsolationMatrix};
