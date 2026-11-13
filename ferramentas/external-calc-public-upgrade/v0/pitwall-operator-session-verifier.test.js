'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPitwallOperatorSessionVerifier,DENIED}=require('./pitwall-operator-session-verifier');
const organizationId='e7f2deaf-cc16-4df7-921a-539b6a27c8c0';
const userId='d71c03a5-c98d-4fe9-ad8c-ea4c20d18591';
const token='operator-auth-jwt-placeholder-for-isolated-test';
const valid={organization_id:organizationId,user_id:userId,role:'operator',active:true};
const deny=e=>e.code===DENIED;
function fixture({user={id:userId},memberships=[valid],authStatus=200,
 membershipStatus=200,accessToken=token}={}){
 const calls=[];
 const verify=createPitwallOperatorSessionVerifier({
  enabled:true,supabaseUrl:'https://pitwall-v2.supabase.co/',publishableKey:'publishable-key',
  getOperatorAccessToken:async()=>accessToken,
  fetchImpl:async(url,options)=>{
   calls.push({url,options});
   if(url.endsWith('/auth/v1/user'))return {ok:authStatus===200,json:async()=>user};
   if(url.includes('/rest/v1/pw_memberships?'))return {ok:membershipStatus===200,json:async()=>memberships};
   throw Error('unexpected route');
  }
 });
 return {verify,calls};
}
test('default off never reaches provider',async()=>{
 await assert.rejects(createPitwallOperatorSessionVerifier()({organizationId}),deny);
});
test('validates identity with Auth and independently checks active membership',async()=>{
 const f=fixture();
 const result=await f.verify({organizationId});
 assert.deepEqual(result,{verified:true,user_id:userId,organization_id:organizationId,
  role:'operator',access_token:token});
 assert.equal(f.calls.length,2);
 assert.equal(f.calls[0].url,'https://pitwall-v2.supabase.co/auth/v1/user');
 assert.equal(f.calls[1].options.headers.authorization,'Bearer '+token);
 const url=new URL(f.calls[1].url);
 assert.equal(url.searchParams.get('organization_id'),'eq.'+organizationId);
 assert.equal(url.searchParams.get('user_id'),'eq.'+userId);
 assert.equal(url.searchParams.get('active'),'eq.true');
 assert.equal(url.searchParams.get('limit'),'2');
});
test('owner and manager accepted, inactive/foreign/unauthorized roles denied',async()=>{
 for(const role of ['owner','manager'])assert.equal(
  (await fixture({memberships:[{...valid,role}]}).verify({organizationId})).role,role);
 for(const change of [
  {role:'admin'},{role:'viewer'},{active:false},
  {user_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'},
  {organization_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'}
 ])await assert.rejects(
  fixture({memberships:[{...valid,...change}]}).verify({organizationId}),deny);
});
test('rejects missing, multiple or unreadable membership',async()=>{
 for(const f of [fixture({memberships:[]}),fixture({memberships:[valid,valid]}),
  fixture({membershipStatus:403})])
  await assert.rejects(f.verify({organizationId}),deny);
});
test('never authorizes an anonymous user or an unavailable Auth endpoint',async()=>{
 for(const f of [
  fixture({user:{id:userId,is_anonymous:true}}),
  fixture({user:{id:'invalid'}}),fixture({authStatus:401})
 ]){
  await assert.rejects(f.verify({organizationId}),deny);
  assert.equal(f.calls.length,1);
 }
});
test('invalid org and missing token fail before network',async()=>{
 for(const [opts,org] of [[{},'bad'],[{accessToken:''},organizationId]]){
  const f=fixture(opts);
  await assert.rejects(f.verify({organizationId:org}),deny);
  assert.equal(f.calls.length,0);
 }
});
test('credentials and internal errors never escape',async()=>{
 const f=fixture();
 await assert.rejects(f.verify({organizationId:'invalid'}),deny);
 const v=createPitwallOperatorSessionVerifier({enabled:true,
  supabaseUrl:'https://pitwall-v2.supabase.co/',publishableKey:'publishable-key',
  getOperatorAccessToken:async()=>token,
  fetchImpl:async()=>{throw Error('private credentials');}});
 await assert.rejects(v({organizationId}),deny);
});
