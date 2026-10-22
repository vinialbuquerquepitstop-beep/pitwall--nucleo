#!/usr/bin/env node
// VS5.3L staging signed-JWT smoke test: rejection and tenant separation ONLY.
// NO data writes, no GitHub Actions, no production, no access tokens in logs.
import assert from 'node:assert/strict';

const FIXED_URL='https://mfsshvckclnmftpaprxk.supabase.co';
const suppliedUrl=process.env.C01_STAGING_URL||FIXED_URL;
assert.equal(new URL(suppliedUrl).origin, FIXED_URL,'Refusing wrong Supabase project');
assert.equal(new URL(suppliedUrl).pathname,'/','Refusing unexpected base API path');
const key=process.env.C01_SUPABASE_PUBLISHABLE_KEY;
const tokens={A:process.env.C01_QA_JWT_A,B:process.env.C01_QA_JWT_B};
for (const [name,value] of Object.entries({C01_SUPABASE_PUBLISHABLE_KEY:key,C01_QA_JWT_A:tokens.A,C01_QA_JWT_B:tokens.B})) {
  assert.ok(typeof value==='string'&&value.trim(),name+' must be set locally; never paste secrets into chat or Git');
}
function jwtPayload(jwt) {
  const parts=jwt.split('.');
  assert.equal(parts.length,3,'Need an actual signed JWT, not an anon key or refresh token');
  const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  assert.equal(payload.role,'authenticated','QA token must be authenticated');
  assert.ok(typeof payload.sub==='string'&&payload.sub.length>20,'Missing user subject');
  assert.ok(Number(payload.exp)*1000>Date.now()+60000,'JWT expired or expires in under a minute');
  return payload;
}
const A=jwtPayload(tokens.A), B=jwtPayload(tokens.B);
assert.notEqual(A.sub,B.sub,'QA A/B must be different signed-in users');

async function rpc(name, body, jwt) {
  const headers={'apikey':key,'Content-Type':'application/json'};
  if(jwt)headers.authorization='Bearer '+jwt;
  const response=await fetch(FIXED_URL+'/rest/v1/rpc/'+name,{
    method:'POST',headers,body:JSON.stringify(body),
    redirect:'error',signal:AbortSignal.timeout(15000)});
  let result={};
  try {result=await response.json();}catch { /* status remains inspectable */ }
  // Never echo response bodies, even on failure; protect PII and input data.
  return {status:response.status,code:String(result?.code||''),message:String(result?.message||''),ok:response.ok};
}
let passed=0;
async function expectReject(label,name,body,token,reason) {
  const v=await rpc(name,body,token);
  assert.ok(!v.ok&&v.status>=400&&v.status<500,label+': expected an HTTP rejection, got '+v.status);
  if(reason)assert.equal(v.message,reason,label+': unexpected business rule (HTTP '+v.status+', code '+v.code+')');
  console.log('PASS '+label+' (rejected '+v.status+')');
  passed++;
}
const bind='extcalc_bind_source_supplier_v0';
const candidate='extcalc_persist_review_candidate_v0';
const promote='extcalc_persist_auto_promoted_c01_v0';
const bSource={p_source_id:'original-B',p_supplier_id:'44444444-4444-4444-8444-444444444444'};
await expectReject('ANON_BIND_DENIED',bind,bSource,null,null);
await expectReject('ANON_CANDIDATE_DENIED',candidate,{p_candidate:{}},null,null);
await expectReject('ANON_PROMOTE_DENIED',promote,{p_promoted:{}},null,null);
await expectReject('A_CANNOT_BIND_B_SOURCE',bind,bSource,tokens.A,'C01_STAGING_SOURCE_UNAVAILABLE');
await expectReject('B_SEES_OWN_SOURCE_BUT_NO_SUPPLIER',bind,bSource,tokens.B,'C01_STAGING_SUPPLIER_UNKNOWN');
await expectReject('A_QUARANTINED_SOURCE_DENIED',bind,{
  p_source_id:'original-A',
  p_supplier_id:'33333333-3333-4333-8333-333333333333'
},tokens.A,'C01_STAGING_SOURCE_UNAVAILABLE');
await expectReject('A_EMPTY_CANDIDATE_DENIED',candidate,{p_candidate:{}},tokens.A,'C01_STAGING_IDENTITY_INVALID');
await expectReject('B_EMPTY_CANDIDATE_DENIED',candidate,{p_candidate:{}},tokens.B,'C01_STAGING_IDENTITY_INVALID');
await expectReject('A_EMPTY_PROMOTION_DENIED',promote,{p_promoted:{}},tokens.A,'EXTCALC_AUTO_PROMOTION_INCOMPLETE');
await expectReject('B_EMPTY_PROMOTION_DENIED',promote,{p_promoted:{}},tokens.B,'EXTCALC_AUTO_PROMOTION_INCOMPLETE');
console.log('VS53L_C01_SIGNED_JWT_NEGATIVE_AB='+passed+'/10 PASS; FULL_E2E_POSITIVE=NOT_TESTED; PRODUCTION=NO_GO');
// All calls use deliberately invalid requests, guaranteeing no successful persistent writes.
