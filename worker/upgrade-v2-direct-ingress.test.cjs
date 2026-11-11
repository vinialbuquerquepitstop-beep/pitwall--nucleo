'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeV2DirectIngress}=require('./upgrade-v2-direct-ingress.cjs');
const {createUpgradeV2Gate}=require('./upgrade-v2-route-guard.cjs');
const {createUpgradeV2EdgeAbuseGate,createUpgradeV2EdgeIpHasher}=require('./upgrade-v2-edge-abuse.cjs');
const {CHECK}=require('./upgrade-v2-core/upgrade-db-scope.cjs');
const {SQL}=require('./upgrade-v2-core/upgrade-receipt-store.cjs');
const origin='https://flat-resonance-09ba.pitstopimports.workers.dev';
const org='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const key='d71c03a5-c98d-4fe9-ad8c-ea4c20d18591';
const requestId='8b624ef6-229b-459d-aed0-35f9a749d131';
const secret='local-test-only-IP-hmac-key-0123456789012345';
const input={request_key:key,selection:{desired:{model:'iPhone 17 Pro',capacity:'256 GB',condition:'lacrado'},
 trade_in:{model:'iPhone 14 Pro',capacity:'128 GB',condition:'bom'},installments:12},
 contact:{name:'Cliente de Teste',whatsapp:'(21) 99999-9999'},consent:true};
const request=(data=input)=>{const req=new Request(origin+'/api/upgrade/v1/lead',{method:'POST',
 headers:{'content-type':'application/json',origin,'cf-connecting-ip':'198.51.100.20'},
 body:JSON.stringify(data)});Object.defineProperty(req,'cf',{value:{colo:'GIG'}});return req;};
function setup({expectedLogin='pw_upgrade_ingress_backend_login',actualLogin,authenticated=true,
  verifiedBinding=true,rls=true,limiterSuccess=true,dbConnected=true}={}){
 const rows=new Map(),commands=[],calls={opened:0,closed:0,limiter:0};
 class FakePgClient{
  constructor(options){assert.equal(options.connectionString,'postgresql://private-v2-credential@v2.example.invalid/db');}
  async connect(){calls.opened++;if(!dbConnected)throw Error('SQL_AUTH_FAILURE');}
  async end(){calls.closed++;}
  async query(sql,args){
   commands.push(sql);
   if(sql===CHECK)return {rows:[{
    effective_role:authenticated?'pw_upgrade_ingress':'postgres',
    login_role:actualLogin||expectedLogin,
    login_restricted:authenticated,opposite_role_member:false,
    binding_matches:verifiedBinding,rls_active:rls,organization_id:org
   }]};
   if(sql===SQL.INSERT){
    if(rows.has(args[1]))return {rows:[]};
    rows.set(args[1],{id:requestId,payload_hash:args[2]});
    return {rows:[{id:requestId,payload_hash:args[2]}]};
   }
   if(sql===SQL.EXISTING){
    const row=rows.get(args[1]);
    return {rows:row?[{id:row.id,payload_hash:row.payload_hash}]:[]};
   }
   return {rows:[]};
  }
 }
 const env={UPGRADE_EXPECTED_ORIGIN:origin,UPGRADE_V2_ORGANIZATION_ID:org,
  UPGRADE_V2_INGRESS_LOGIN_ROLE:expectedLogin,
  UPGRADE_V2_DB_INGRESS:{connectionString:'postgresql://private-v2-credential@v2.example.invalid/db'}};
 const direct=createUpgradeV2DirectIngress({env,Client:FakePgClient});
 const limiter={limit:async({key:ipHash})=>{
  calls.limiter++;assert.match(ipHash,/^[0-9a-f]{64}$/);
  return {success:limiterSuccess};
 }};
 const abuse=createUpgradeV2EdgeAbuseGate({limiter,origin,hashIp:createUpgradeV2EdgeIpHasher(secret)});
 const gate=createUpgradeV2Gate({enabled:true,handleV2:direct?.handle,authorizeRequest:abuse?.authorize});
 return {gate,rows,commands,calls};
}
test('existing Worker can persist V2 receipt without any second Worker or legacy DB',async()=>{
 const a=setup(),response=await a.gate.handle(request());
 assert.equal(response.status,202);
 assert.deepEqual(await response.json(),{ok:true,reference:'upg_'+requestId.replaceAll('-',''),status:'RECEIVED'});
 assert.equal(a.rows.size,1);
 assert.equal(a.calls.limiter,1);
 assert(a.commands.includes('SET LOCAL ROLE pw_upgrade_ingress'));
 assert.equal(a.calls.opened,1);
});
test('replay is idempotent; conflicting payload returns 409 in the same V2 database',async()=>{
 const a=setup();
 const first=await a.gate.handle(request());
 assert.equal(first.status,202);
 const again=await a.gate.handle(request());
 assert.equal(again.status,202);
 assert.deepEqual(await again.json(),await first.json());
 const changed=await a.gate.handle(request({...input,contact:{...input.contact,name:'Outro cliente'}}));
 assert.equal(changed.status,409);
 assert.equal(a.rows.size,1);
});
test('database denies bad session login, RLS, or tenant binding without INSERT',async()=>{
 for(const invalid of [{actualLogin:'postgres'},{authenticated:false},
  {verifiedBinding:false},{rls:false},{dbConnected:false}]){
  const a=setup(invalid);
  const result=await a.gate.handle(request());
  assert.equal(result.status,503);
  assert.equal(a.rows.size,0);
  assert(!a.commands.includes(SQL.INSERT));
 }
});
test('Cloudflare rate limit denies request before SQL connection is attempted',async()=>{
 const a=setup({limiterSuccess:false});
 const response=await a.gate.handle(request());
 assert.equal(response.status,429);
 assert.equal(a.calls.opened,0);
});
test('no V2 DB, organization or exact SQL login: fail closed, never fallback to old Hyperdrive',async()=>{
 const good={UPGRADE_EXPECTED_ORIGIN:origin,
  UPGRADE_V2_ORGANIZATION_ID:org,
  UPGRADE_V2_INGRESS_LOGIN_ROLE:'pw_upgrade_ingress_backend_login',
  UPGRADE_V2_DB_INGRESS:{connectionString:'postgresql://private-v2-credential@v2.example.invalid/db'}};
 const C=class{};
 for(const missing of Object.keys(good)){
  const env={...good};delete env[missing];
  assert.equal(createUpgradeV2DirectIngress({env,Client:C}),null);
 }
 assert.equal(createUpgradeV2DirectIngress({env:{...good,UPGRADE_V2_INGRESS_LOGIN_ROLE:'postgres'},Client:C}),null);
});
