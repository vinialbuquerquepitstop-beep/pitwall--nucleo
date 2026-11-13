'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradePublicationRuntime,MEMBER_SQL,DENIED}=require('./upgrade-publication-runtime');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const user='d71c03a5-c98d-4fe9-ad8c-ea4c20d18591';
function fixture({verified=true,role='dono',active=true,memberTenant=tenant,
 memberRows=1,authenticateError=false,queryError=false}={}){
 const calls=[];let released=0;
 const client={async query(sql,values){
  calls.push({sql,values});
  if(sql===MEMBER_SQL){
   if(queryError)throw Error('internal secret');
   return {rows:Array.from({length:memberRows},()=>({id:user,tenant_id:memberTenant,papel:role,ativo:active}))};
  }
  if(sql==='BEGIN ISOLATION LEVEL SERIALIZABLE'||sql==='ROLLBACK'||sql==='COMMIT')return {rows:[]};
  throw Error('QUERY_AFTER_AUTH');
 },release(){released++;}};
 const pool={async connect(){return client;}};
 const authenticateOperator=async()=>{if(authenticateError)throw Error('auth provider secret');return {verified,user_id:user};};
 const runtime=createUpgradePublicationRuntime({
  enabled:true,pool,authenticateOperator,
  loadCalculationProfile:async()=>({currency:'BRL'}),
  loadTradeInCandidates:async()=>[]
 });
 return {runtime,calls,get released(){return released;}};
}
const command={publicId:'pub1',priceRevision:'rev1',analysisId:'analysis1',offerId:'sale1',
 offerRevision:1,expiresAtMs:Date.now()+86400000};
async function denied(fn){await assert.rejects(fn,e=>e.code===DENIED);}
test('publication runtime is default-off, without connection or identity',async()=>{
 const disabled=createUpgradePublicationRuntime();
 assert.equal(disabled.enabled,false);
 await assert.rejects(disabled.stage(command),e=>e.code==='UPGRADE_PUBLICATION_NOT_AUTHORIZED');
});
test('private runtime will not enable without a dedicated PG pool and identity verifier',()=>{
 assert.throws(()=>createUpgradePublicationRuntime({enabled:true}),/PRIVATE_PUBLICATION_RUNTIME_DEPENDENCIES_REQUIRED/);
});
test('stage and approve authenticate before any source read or mutation',async()=>{
 for(const action of ['stage','approve']){
  const x=fixture({verified:false});
  await denied(x.runtime[action](command));
  assert.deepEqual(x.calls.map(c=>c.sql),['BEGIN ISOLATION LEVEL SERIALIZABLE','ROLLBACK']);
  assert.equal(x.released,1);
 }
});
test('membership is read within the serializable transaction before touching source',async()=>{
 const x=fixture({verified:true});
 await denied(x.runtime.stage(command)); // mocked SQL intentionally stops after membership
 assert.deepEqual(x.calls.map(c=>c.sql),[
  'BEGIN ISOLATION LEVEL SERIALIZABLE',MEMBER_SQL,
  // the approved source revision is the first operation after membership
  require('./upgrade-catalog-publication-operator').SQL.SOURCE_SQL,
  'ROLLBACK'
 ]);
 assert.deepEqual(x.calls[1].values,[user]);
 assert.equal(x.released,1);
});
test('inactive, seller, cross-tenant and duplicate membership fail closed',async()=>{
 for(const opts of [{role:'vendedor'},{active:false},{memberRows:2},{memberTenant:'invalid'}]){
  const x=fixture(opts);
  await denied(x.runtime.stage(command));
  assert.equal(x.calls.some(c=>c.sql.includes('extcalc_offer_revision')),false);
  assert.equal(x.released,1);
 }
});
test('database and auth failures rollback without revealing details',async()=>{
 for(const opts of [{authenticateError:true},{queryError:true}]){
  const x=fixture(opts);
  await denied(x.runtime.approve(command));
  assert(x.calls.some(c=>c.sql==='ROLLBACK'));
  assert.equal(x.released,1);
 }
});

test('real Calc Auth session verified before publishing transaction authorizes DB membership',async()=>{
 const calls=[],user='d71c03a5-c98d-4fe9-ad8c-ea4c20d18591';
 const client={async query(sql,values){
  calls.push(sql);
  if(sql==='BEGIN ISOLATION LEVEL SERIALIZABLE'||sql==='ROLLBACK'||sql==='COMMIT')return {rows:[]};
  if(sql===MEMBER_SQL){
   assert.deepEqual(values,[user]);
   return {rows:[{id:user,tenant_id:tenant,papel:'dono',ativo:true}]};
  }
  throw Error('NO_SOURCE_IMPLEMENTED');
 },release(){calls.push('RELEASE');}};
 const http=[];
 const service=createUpgradePublicationRuntime({
  enabled:true,pool:{connect:async()=>client},calcSupabaseUrl:'https://calc.supabase.co/',
  calcPublishableKey:'publishable-test-key',getOperatorAccessToken:async()=> 'verified-operator-user-token-placeholder',
  fetchImpl:async(url,params)=>{http.push({url,params});return {ok:true,json:async()=>({id:user})};}
 });
 await denied(service.stage(command));
 assert.equal(http.length,1);
 assert.equal(http[0].url,'https://calc.supabase.co/auth/v1/user');
 assert.equal(http[0].params.headers.apikey,'publishable-test-key');
 assert.deepEqual(calls,[
  'BEGIN ISOLATION LEVEL SERIALIZABLE',MEMBER_SQL,
  require('./upgrade-catalog-publication-operator').SQL.SOURCE_SQL,'ROLLBACK','RELEASE']);
});
test('Calc Auth 401, invalid user and anonymous identity cannot access publication tables',async()=>{
 for(const response of [
  {ok:false,json:async()=>({message:'NOT_ALLOWED'})},
  {ok:true,json:async()=>({id:'invalid'})},
  {ok:true,json:async()=>({id:'d71c03a5-c98d-4fe9-ad8c-ea4c20d18591',is_anonymous:true})}
 ]){
  const calls=[];
  const runtime=createUpgradePublicationRuntime({
   enabled:true,pool:{connect:async()=>({query:async(sql)=>{calls.push(sql);return {rows:[]};},
    release:()=>calls.push('RELEASE')})},
   calcSupabaseUrl:'https://calc.supabase.co/',calcPublishableKey:'publishable-test-key',
   getOperatorAccessToken:async()=> 'verified-operator-user-token-placeholder',
   fetchImpl:async()=>response
  });
  await denied(runtime.stage(command));
  assert.deepEqual(calls,['BEGIN ISOLATION LEVEL SERIALIZABLE','ROLLBACK','RELEASE']);
 }
});
test('missing Calc Auth session token fails before DB membership lookup',async()=>{
 let called=false;
 const runtime=createUpgradePublicationRuntime({
  enabled:true,pool:{connect:async()=>({query:async()=>({rows:[]}),release:()=>{}})},
  calcSupabaseUrl:'https://calc.supabase.co/',calcPublishableKey:'publishable-test-key',
  getOperatorAccessToken:async()=> '',
  fetchImpl:async()=>{called=true;throw Error('MUST_NOT_FETCH');}
 });
 await denied(runtime.approve(command));
 assert.equal(called,false);
});
