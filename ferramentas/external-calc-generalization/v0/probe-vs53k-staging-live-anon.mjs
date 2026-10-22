#!/usr/bin/env node
// VS5.3k: truly live but ANONYMOUS-only, GET-only HTTPS preflight.
// No end-user credentials, JWTs, raw bytes, SQL, writes, or production calls.
// A successful response DOES NOT prove JWT A/B, SQL RLS, or staging release.
import assert from 'node:assert/strict';
const HOST='mfsshvckclnmftpaprxk.supabase.co';
const ORIGIN='https://'+HOST;
const REF='original-A-rls';
const NOW_TIMEOUT_MS=12000;
const ERR='VS53K_LIVE_ANON_PREFLIGHT_FAIL_CLOSED';
function abortFor(){return AbortSignal.timeout(NOW_TIMEOUT_MS)}
function options(apiKey,accept='application/json'){
 return Object.freeze({method:'GET',headers:Object.freeze({
  apikey:apiKey,Accept:accept,'Cache-Control':'no-store'
 }),redirect:'error',cache:'no-store',signal:abortFor()});
}
export async function runPreflight(fetchImpl,apiKey){
 if(typeof fetchImpl!=='function'||typeof apiKey!=='string'||
    !/^sb_publishable_[A-Za-z0-9_-]{10,200}$/.test(apiKey))
  throw Error(ERR+':INVALID_PUBLISHABLE_KEY');
 const steps=[
  {id:'AUTH_HEALTH',url:ORIGIN+'/auth/v1/health',allowed:[200]},
  {id:'ANON_SOURCE_BLOCKED',url:ORIGIN+'/rest/v1/extcalc_original_source_probe_v0?select=source_ref&source_ref=eq.'+REF+'&limit=2',allowed:[401,403]}
 ];
 const facts=[];
 for(const step of steps){
  let response;
  try{response=await fetchImpl(step.url,options(apiKey))}
  catch(e){
   const code=e?.cause?.code??e?.code??e?.name??'NETWORK_ERROR';
   throw Error(ERR+':'+step.id+':'+String(code).slice(0,48));
  }
  const status=response?.status;
  if(!Number.isInteger(status)||!step.allowed.includes(status))
   throw Error(ERR+':'+step.id+':HTTP_'+String(status).slice(0,3));
  // Explicitly don't read body: source content/credential values can never
  // enter logs, files or CI output.
  facts.push(Object.freeze({step:step.id,http_status:status,pass:true}));
 }
 return Object.freeze({project:HOST,method:'GET_ONLY',transport:'LIVE_HTTPS_NO_AUTH_TOKEN',
   auth_health_verified:true,anon_request_blocked:true,
   signed_jwt_a_b_verified:false,real_rls_verified:false,
   cases:facts,production_gate:'NO_GO'});
}
async function proof(){
 let n=0;const goodKey='sb_publishable_SYNTHETIC_TEST_PUBLIC_KEY';
 const ok=async(url,request)=>{n++;assert.equal(new URL(url).hostname,HOST);
  assert.equal(request.method,'GET');assert.equal(request.redirect,'error');
  assert.equal(request.headers.apikey,goodKey);
  assert.equal(Object.hasOwn(request.headers,'Authorization'),false);
  assert.equal('body' in request,false);
  return {status:url.includes('/auth/v1/health')?200:401};
 };
 const result=await runPreflight(ok,goodKey);
 assert.equal(n,2);assert.equal(result.cases.length,2);
 assert.equal(result.signed_jwt_a_b_verified,false);
 assert.equal(result.real_rls_verified,false);
 for(const [label,fn,pattern] of [
  ['401 auth-health is not availability proof',async()=>runPreflight(async()=>({status:401}),goodKey),/AUTH_HEALTH:HTTP_401/],
  ['200 anon metadata is NOT denied',async()=>runPreflight(async()=>({status:200}),goodKey),/ANON_SOURCE_BLOCKED:HTTP_200/],
  ['500 upstream is not denied',async()=>runPreflight(async(url)=>({status:url.includes('health')?200:500}),goodKey),/ANON_SOURCE_BLOCKED:HTTP_500/],
  ['TLS/DNS errors are failures',async()=>runPreflight(async()=>{throw Object.assign(Error('unreachable'),{code:'ENOTFOUND'})},goodKey),/AUTH_HEALTH:ENOTFOUND/],
  ['non-publishable key forbidden',async()=>runPreflight(ok,'service_role_secret'),/INVALID_PUBLISHABLE_KEY/]
 ]){
  await assert.rejects(fn,pattern);
  console.log('VS53K_ANON_PROOF_OK '+label);
 }
 console.log('VS53K_ANON_PREFLIGHT_MOCK=PASS cases=6 real_http=NOT_RUN signed_jwt=NOT_RUN');
}
if(process.argv[2]==='--proof') await proof();
else if(process.argv[2]==='--live'&&process.env.EXTERNAL_CALC_ALLOW_STAGING_ANON_GET==='true'){
 const report=await runPreflight(globalThis.fetch,process.env.EXTERNAL_CALC_STAGING_PUBLISHABLE_KEY);
 for(const c of report.cases)console.log('VS53K_STAGING_LIVE_'+c.step+'=PASS http='+c.http_status);
 console.log('VS53K_STAGING_ANON_HTTP=PASS;SIGNED_JWT_A_B=NOT_RUN;PRODUCTION=NO_GO');
}else{throw Error(ERR+':EXPLICIT_MODE_REQUIRED');}
