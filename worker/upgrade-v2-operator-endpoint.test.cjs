'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeV2OperatorEndpoint,PATH}=require('./upgrade-v2-operator-endpoint.cjs');
const {CHECK}=require('./upgrade-v2-core/upgrade-db-scope.cjs');
const {SQL}=require('./upgrade-v2-core/upgrade-delivery-store.cjs');
const origin='https://flat-resonance-09ba.pitstopimports.workers.dev';
const org='5212679b-8b2e-459f-a2ba-7ae8db558ba1',user='d71c03a5-c98d-4fe9-ad8c-ea4c20d18591';
const id='8b624ef6-229b-459d-aed0-35f9a749d131',lead='930e39e4-6ee4-414a-861a-99c318bf40a6';
const token='operator-jwt-mocked-but-nonproduction-12345';
const conn='postgresql://test-only-operator@v2.invalid/db';
const env={
 UPGRADE_V2_OPERATOR_ENABLED:'true',
 UPGRADE_V2_DB_OPERATOR:{connectionString:conn},
 UPGRADE_V2_DB_INGRESS:{connectionString:'postgresql://test-only-ingress@v2.invalid/db'},
 UPGRADE_V2_ORGANIZATION_ID:org,
 UPGRADE_V2_OPERATOR_LOGIN_ROLE:'pw_upgrade_operator_backend_login',
 UPGRADE_EXPECTED_ORIGIN:origin,
 PITWALL_V2_SUPABASE_URL:'https://v2.invalid/',
 PITWALL_V2_PUBLISHABLE_KEY:'publishable-testing-key'
};
const request=(body={request_id:id},headers={})=>new Request(origin+PATH,{method:'POST',
 headers:{authorization:'Bearer '+token,'content-type':'application/json',...headers},
 body:JSON.stringify(body)});
function fixture({authorized=true,existing=false,badDbRole=false,dbAvailable=true}={}){
 const db=[],http=[],row={id,organization_id:org,customer_name:'Cliente Sintético',whatsapp_digits:'5521999999999',
  selection:{desired:{model:'iPhone 17 Pro',capacity:'256 GB',condition:'lacrado'},
   trade_in:{model:'iPhone 14 Pro',capacity:'128 GB',condition:'bom'},installments:12},
  consent_at:'2026-11-11T17:00:00Z',source:'instagram_upgrade',status:'RECEIVED',lead_id:null};
 let connections=0;
 class FakeClient{
  constructor(opts){assert.equal(opts.connectionString,conn);}
  async connect(){connections++;if(!dbAvailable)throw Error('DB_DOWN');}
  async end(){}
  async query(sql,args){
   db.push(sql);
   if(sql===CHECK)return {rows:[{effective_role:badDbRole?'postgres':'pw_upgrade_operator',
    login_role:'pw_upgrade_operator_backend_login',login_restricted:!badDbRole,
    opposite_role_member:false,binding_matches:true,organization_id:org,rls_active:true}]};
   if(sql===SQL.CLAIM){if(row.status!=='RECEIVED')return {rows:[]};row.status='PROCESSING';return {rows:[{...row}]};}
   if(sql===SQL.READ)return {rows:[{...row}]};
   if(sql===SQL.LINK){if(row.status!=='PROCESSING')return {rows:[]};row.status='LINKED';row.lead_id=args[2];return {rows:[{id,lead_id:args[2]}]};}
   if(sql===SQL.REVIEW){row.status='REVIEW_REQUIRED';return {rows:[{id}]};}
   return {rows:[]};
  }
 }
 const fetchImpl=async(url,params)=>{
  http.push({url,params});
  if(url.endsWith('/auth/v1/user'))return {ok:true,json:async()=>({id:user})};
  if(url.includes('/pw_memberships?'))return {ok:true,json:async()=>authorized?
   [{organization_id:org,user_id:user,active:true,role:'owner'}]:[]};
  if(url.includes('/pw_leads?'))return {ok:true,json:async()=>existing?
   [{id:lead,organization_id:org,phone:'5521999999999',notes:'Upgrade V2: '+id}]:[]};
  if(url.includes('/rpc/pw_s01_create_lead')){
   assert.equal(params.headers.authorization,'Bearer '+token);
   const command=JSON.parse(params.body);
   assert.equal(command.p_org_id,org);
   assert.deepEqual(command.p_acquisition,{source_channel:'instagram'});
   assert(command.p_notes.includes('Upgrade V2: '+id));
   return {ok:true,json:async()=>({id:lead,organization_id:org})};
  }
  throw Error('unexpected fetch');
 };
 return {endpoint:createUpgradeV2OperatorEndpoint({env,Client:FakeClient,fetchImpl}),
  db,http,row,connections:()=>connections};
}
test('operator route stays OFF independently from the public lead flag',async()=>{
 const h=createUpgradeV2OperatorEndpoint({env:{...env,UPGRADE_V2_OPERATOR_ENABLED:'false'}});
 assert.equal((await h.handle(request())).status,404);
});
test('requires a physically separate operator DB binding and correct V2 Auth origin',async()=>{
 for(const invalid of [{UPGRADE_V2_DB_OPERATOR:env.UPGRADE_V2_DB_INGRESS},
  {PITWALL_V2_SUPABASE_URL:'https://v2.invalid/unsafe-path'},{PITWALL_V2_PUBLISHABLE_KEY:null}]){
  const h=createUpgradeV2OperatorEndpoint({env:{...env,...invalid},Client:class {}});
  assert.equal((await h.handle(request())).status,503);
 }
});
test('authenticated operator reconciles receipt to S01 CRM RPC and returns linkage',async()=>{
 const f=fixture(),res=await f.endpoint.handle(request());
 assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{ok:true,code:'UPGRADE_V2_LINKED',request_id:id,lead_id:lead,already_linked:false});
 assert.equal(f.row.status,'LINKED');
 assert.equal(f.http.filter(x=>x.url.endsWith('/rpc/pw_s01_create_lead')).length,1);
 assert(f.db.includes('SET LOCAL ROLE pw_upgrade_operator'));
 const again=await f.endpoint.handle(request());
 assert.equal(again.status,200);
 assert.equal((await again.json()).already_linked,true);
 assert.equal(f.http.filter(x=>x.url.endsWith('/rpc/pw_s01_create_lead')).length,1);
});
test('existing lead with same upgrade receipt is linked without duplicate CRM create',async()=>{
 const f=fixture({existing:true});
 const res=await f.endpoint.handle(request());
 assert.equal(res.status,200);assert.equal((await res.json()).already_linked,true);
 assert(!f.http.some(x=>x.url.endsWith('/rpc/pw_s01_create_lead')));
});
test('inactive or missing membership cannot create a lead',async()=>{
 const f=fixture({authorized:false}),res=await f.endpoint.handle(request());
 assert.equal(res.status,403);
 assert(!f.db.includes(SQL.CLAIM));
 assert.equal(f.connections(),0,'unauthorized operator must not open a PostgreSQL connection');
 assert(!f.http.some(x=>x.url.endsWith('/rpc/pw_s01_create_lead')));
});
test('missing JWT and invalid request are rejected before DB connection',async()=>{
 const f=fixture();
 const unauthorized=await f.endpoint.handle(request({request_id:id},{authorization:''}));
 assert.equal(unauthorized.status,401);
 const invalid=await f.endpoint.handle(request({request_id:id,organization_id:org}));
 assert.equal(invalid.status,400);
 assert.equal(f.connections(),0);
});
test('SQL role failure is a 503 with no CRM mutation',async()=>{
 const f=fixture({badDbRole:true}),res=await f.endpoint.handle(request());
 assert.equal(res.status,503);
 assert(!f.http.some(x=>x.url.endsWith('/rpc/pw_s01_create_lead')));
 assert(!f.db.includes(SQL.CLAIM));
});
test('DB connectivity failures do not leak connection strings or create CRM leads',async()=>{
 const f=fixture({dbAvailable:false}),res=await f.endpoint.handle(request());
 assert.equal(res.status,503);
 const body=await res.text();
 assert(!body.includes('v2.invalid'));
 assert.equal(f.http.filter(x=>x.url.endsWith('/auth/v1/user')).length,1);
 assert.equal(f.http.filter(x=>x.url.includes('/pw_memberships?')).length,1);
 assert(!f.http.some(x=>x.url.endsWith('/rpc/pw_s01_create_lead')));
 assert(!f.http.some(x=>x.url.includes('/pw_leads?')));
});
