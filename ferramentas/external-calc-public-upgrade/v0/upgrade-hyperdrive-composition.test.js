'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeV1HyperdriveApplication}=require('./upgrade-hyperdrive-composition');
const {SQL}=require('./approved-catalog-repository');
const {INSERT}=require('./upgrade-capture-repository');
const origin='https://upgrade.example.test';
const tenant='00000000-0000-0000-0000-000000000001';
const connectionString='postgres://private:secret@example.invalid/postgres';
const selection={desired:{model:'iPhone 17 Pro',capacity:'256 GB',condition:'lacrado'},trade_in:{model:'iPhone 14 Pro',capacity:'128 GB',condition:'bom'},installments:12};
const catalogRow={tenant_id:tenant,public_id:'p1',price_revision:'rev1',status:'published',expires_at_ms:'1900000000000',desired_model:'iPhone 17 Pro',desired_capacity:'256 GB',desired_condition:'lacrado',trade_in_models:[{model:'iPhone 14 Pro',capacity:'128 GB',capacity_gb:128,device_model_id:'iphone14pro'}]};
const requestKey='d71c03a5-c98d-4fe9-ad8c-ea4c20d18591';
const id='930e39e4-6ee4-414a-861a-99c318bf40a6';
const env={UPGRADE_PUBLIC_ENABLED:'true',UPGRADE_DB:{connectionString},UPGRADE_TENANT_ID:tenant,UPGRADE_EXPECTED_ORIGIN:origin};
let visits=[];
class FakeClient {
 constructor(options){assert.equal(options.connectionString,connectionString);}
 async connect(){visits.push('connect');}
 async query({text,values}){visits.push(text);
  if(text==='SELECT current_user AS db_role')return {rows:[{db_role:'upv1_cf_public'}]};
  if(text===SQL){assert.deepEqual(values,[tenant]);return {rows:[catalogRow]};}
  if(text===INSERT){assert.equal(values[0],tenant);return {rows:[{id}]};}
  throw Error('unexpected SQL');
 }
 async end(){visits.push('end');}
}
const get=(path,method='GET',body)=>new Request(origin+path,{method,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
test('off is HTTP 404 without driver and binding',async()=>{
 const r=await createUpgradeV1HyperdriveApplication().handle(get('/api/upgrade/v1/catalog'));assert.equal(r.status,404);
});
test('no binding, origin or flag does not enable public endpoints',async()=>{
 for(const patch of [{UPGRADE_DB:null},{UPGRADE_EXPECTED_ORIGIN:''},{UPGRADE_PUBLIC_ENABLED:'false'},{UPGRADE_TENANT_ID:'bad'}]){
  const r=await createUpgradeV1HyperdriveApplication({env:{...env,...patch},Client:FakeClient}).handle(get('/api/upgrade/v1/catalog'));
  assert.equal(r.status,404);
 }
});
test('published catalog GET reads via scoped Hyperdrive role',async()=>{
 visits=[];const app=createUpgradeV1HyperdriveApplication({env,Client:FakeClient});
 const response=await app.handle(get('/api/upgrade/v1/catalog'));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{ok:true,offers:[selection.desired]});
 assert.deepEqual(visits,['connect','SELECT current_user AS db_role',SQL,'end']);
});
test('idempotent public lead request writes via same restricted role',async()=>{
 visits=[];const app=createUpgradeV1HyperdriveApplication({env,Client:FakeClient});
 const response=await app.handle(get('/api/upgrade/v1/lead','POST',{request_key:requestKey,selection,contact:{name:'Ana',whatsapp:'(21) 99999-9999'},consent:true}));
 assert.equal(response.status,202);
 assert.deepEqual(await response.json(),{ok:true,reference:'upg_'+id.replaceAll('-','')});
 assert(visits.includes(INSERT));
});
test('quote cannot be fabricated when internal pricing service missing',async()=>{
 const response=await createUpgradeV1HyperdriveApplication({env,Client:FakeClient}).handle(get('/api/upgrade/v1/quote','POST',selection));
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{ok:false,code:'QUOTE_UNAVAILABLE'});
});
test('foreign-origin requests cannot use catalog',async()=>{
 const app=createUpgradeV1HyperdriveApplication({env,Client:FakeClient});
 const response=await app.handle(new Request('https://evil.example/api/upgrade/v1/catalog'));
 assert.equal(response.status,404);
});

test('trusted internal finance invoker is optional and never reads prices from browser',async()=>{
 const commands=[];
 const invokeInternal=async ({action,command})=>{
  commands.push({action,command});
  return {schema_version:'pitstop-internal-upgrade/v1',public_id:'p1',price_revision:'rev1',action,currency:'BRL',amount_minor:action==='resolveVariant'?690000:260000,...(action==='simulateSale'?{installment_count:12}:{})};
 };
 const response=await createUpgradeV1HyperdriveApplication({env,Client:FakeClient,invokeInternal})
  .handle(get('/api/upgrade/v1/quote','POST',selection));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{ok:true,quote:{sale_amount_minor:690000,trade_in_credit_minor:260000,amount_due_minor:430000,currency:'BRL',installment_count:12,installment_amount_minor:260000}});
 assert.deepEqual(commands.map(c=>c.action),['resolveVariant','estimateTradeIn','simulateSale']);
 for(const call of commands){
  assert.equal(call.command.public_id,'p1');
  assert.equal(call.command.price_revision,'rev1');
  for(const k of ['tenant_id','supplier_id','sale_price_minor','rate_profile'])assert.equal(Object.hasOwn(call.command,k),false);
 }
});
test('invalid trusted finance result fails closed without exposing price',async()=>{
 const invokeInternal=async ({action})=>({schema_version:'pitstop-internal-upgrade/v1',public_id:'p1',price_revision:'WRONG',action,currency:'BRL',amount_minor:690000});
 const response=await createUpgradeV1HyperdriveApplication({env,Client:FakeClient,invokeInternal})
  .handle(get('/api/upgrade/v1/quote','POST',selection));
 assert.equal(response.status,503);
 assert.deepEqual(await response.json(),{ok:false,code:'QUOTE_UNAVAILABLE'});
});
