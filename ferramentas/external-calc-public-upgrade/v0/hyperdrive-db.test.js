'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHyperdriveUpgradeQuery}=require('./hyperdrive-db');
const {SQL}=require('./approved-catalog-repository');
const {INSERT,RECHECK}=require('./upgrade-capture-repository');
const tenantId='00000000-0000-0000-0000-000000000001';
const url='postgres://not-in-logs:very-secret@private.invalid:5432/postgres';
const make=(fake,extra={})=>createHyperdriveUpgradeQuery({hyperdrive:{connectionString:url},tenantId,Client:fake,...extra});
function FakeClient(opts){
 assert.equal(opts.connectionString,url);
 this.connect=async()=>{};
 this.calls=[];
 this.query=async({text,values})=>{
  this.calls.push({text,values});
  return text==='SELECT current_user AS db_role'?
   {rows:[{db_role:'upv1_cf_public'}]}:{rows:[{id:'930e39e4-6ee4-414a-861a-99c318bf40a6'}]};
 };
 this.end=async()=>{this.ended=true;};
 FakeClient.last=this;
}
test('requires binding and explicit valid tenant',()=>{for(const x of [{},{Client:FakeClient},{Client:FakeClient,hyperdrive:{connectionString:url}},{tenantId,Client:FakeClient}])assert.throws(()=>createHyperdriveUpgradeQuery(x),/HYPERDRIVE_TRUSTED_BINDING_REQUIRED/);});
test('catalog read uses parameterized SQL and checks exact database role',async()=>{
 const result=await make(FakeClient)(SQL,[tenantId]);
 assert.equal(result.rows.length,1);assert.deepEqual(FakeClient.last.calls.map(x=>x.text),['SELECT current_user AS db_role',SQL]);
 assert.deepEqual(FakeClient.last.calls[1].values,[tenantId]);assert.equal(FakeClient.last.ended,true);
});
test('capture INSERT and replay recheck are both allowlisted',async()=>{
 for(const statement of [INSERT,RECHECK]){
  const values=[tenantId,'d71c03a5-c98d-4fe9-ad8c-ea4c20d18591','Ana','5521999999999','{}'];
  await make(FakeClient)(statement,values);
  assert.deepEqual(FakeClient.last.calls[1].values,values);
 }
});
test('denies arbitrary SQL, wrong tenant and wrong number of parameters before connecting',async()=>{
 let connected=0;const mock=function(){connected++;return new FakeClient();};
 const query=make(mock);
 for(const [stmt,args] of [
  ['SELECT * FROM auth.users',[tenantId]],['UPDATE privado.upgrade_requests_v1 SET status=\'LINKED\'',[tenantId]],
  [SQL,['efbd5c32-e2d4-4adc-964e-40ea0eae9731']],[SQL,[]],
  [INSERT,[tenantId]],[RECHECK,[tenantId,'x']]
 ])await assert.rejects(()=>query(stmt,args),e=>e.code==='UPGRADE_DATABASE_UNAVAILABLE');
 assert.equal(connected,0);
});
test('wrong connection role denies catalog query and closes client',async()=>{
 function WrongRole(){this.calls=[];this.connect=async()=>{};this.query=async x=>{this.calls.push(x.text);return {rows:[{db_role:'postgres'}]};};this.end=async()=>{WrongRole.closed=true;};}
 await assert.rejects(()=>make(WrongRole)(SQL,[tenantId]),e=>e.code==='UPGRADE_DATABASE_UNAVAILABLE');
 assert.deepEqual(WrongRole.closed,true);
});
test('connection failures never leak credentials',async()=>{
 function Broken(){this.connect=async()=>{throw Error('postgres://secret:password@example.net');};this.end=async()=>{throw Error('other secret');};}
 await assert.rejects(()=>make(Broken)(SQL,[tenantId]),e=>e.message==='UPGRADE_DATABASE_UNAVAILABLE'&&!e.message.includes('secret'));
});
test('SQL failures close the client and sanitize output',async()=>{
 function SqlError(){this.connect=async()=>{};this.query=async x=>{if(x.text==='SELECT current_user AS db_role')return {rows:[{db_role:'upv1_cf_public'}]};throw Error('private table details');};this.end=async()=>{SqlError.closed=true;};}
 await assert.rejects(()=>make(SqlError)(SQL,[tenantId]),e=>e.code==='UPGRADE_DATABASE_UNAVAILABLE');
 assert.equal(SqlError.closed,true);
});
test('invalid response shape fails closed',async()=>{
 function Invalid(){this.connect=async()=>{};this.query=async x=>x.text==='SELECT current_user AS db_role'?{rows:[{db_role:'upv1_cf_public'}]}:{rows:null};this.end=async()=>{};}
 await assert.rejects(()=>make(Invalid)(SQL,[tenantId]),e=>e.code==='UPGRADE_DATABASE_UNAVAILABLE');
});
