'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeCalcDadosProfileSource,SQL,DENIED}=require('./upgrade-calc-dados-profile-source');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const args={tenantId:tenant,analysisId:'analysis1',offerId:'sale1',offerRevision:1};
const dados={config:{margens:{iPhone:{av:900,pc:1000},MacBook:{av:1500,pc:1600}},pb:45,taxas:{6:1.08,12:1.15}},bateria:{},tela:{},produtos:[]};
function fixture({model='iphone17pro',row={tenant_id:tenant,dados,atualizado_em:'2026-11-11T12:00:00.000Z'},c01Rows,profileRows}={}){
 const queries=[];
 const tx={query:async(sql,values)=>{
  queries.push({sql,values});
  if(sql===SQL.SOURCE_SQL)return {rows:c01Rows??[{model_id:model}]};
  if(sql===SQL.PROFILE_SQL)return {rows:profileRows??[row]};
  throw Error('UNKNOWN_SQL');
 }};
 return {tx,queries};
}
async function fails(v){await assert.rejects(v,e=>e.code===DENIED);}
test('default disabled without sensitive DB reads',async()=>{
 await fails(createUpgradeCalcDadosProfileSource()({...args,tx:fixture().tx}));
});
test('real Calc dados authority builds iPhone C02 profile without a separate margin table',async()=>{
 const f=fixture();
 const result=await createUpgradeCalcDadosProfileSource({enabled:true})({...args,tx:f.tx});
 assert.equal(result.profile_id,'pitwall-calc-dados:iPhone');
 assert.equal(result.profile_version,'2026-11-11T12:00:00.000Z');
 assert.equal(result.cash_margin_minor,90000);
 assert.equal(result.installment_margin_minor,100000);
 assert.equal(result.installment_base_addon_minor,4500);
 assert.equal(result.installment_coefficients[12],1.15);
 assert.deepEqual(f.queries[0].values,[tenant,'analysis1','sale1',1]);
 assert.deepEqual(f.queries[1].values,[tenant]);
 assert(!JSON.stringify(result).includes('produtos'));
});
test('rejects MacBook and arbitrary source model before querying private margins',async()=>{
 for(const model of ['macbookpro','ipadpro','',null,'17pro']){
  const f=fixture({model});
  await fails(createUpgradeCalcDadosProfileSource({enabled:true})({...args,tx:f.tx}));
  assert.equal(f.queries.length,1);
 }
});
test('missing profile, tenant mismatch, malformed settings fail closed',async()=>{
 for(const patch of [{profileRows:[]},{row:{tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731',dados,atualizado_em:'2026-11-11T12:00:00Z'}},
  {row:{tenant_id:tenant,dados:{config:{margens:{MacBook:{av:100,pc:200}},pb:4,taxas:{12:1.1}}},atualizado_em:'2026-11-11T12:00:00Z'}},
  {row:{tenant_id:tenant,dados,atualizado_em:'INVALID'}}]){
  const f=fixture(patch);
  await fails(createUpgradeCalcDadosProfileSource({enabled:true})({...args,tx:f.tx}));
 }
});
test('ambiguous offers and tenant tampering are rejected',async()=>{
 const f=fixture({c01Rows:[{model_id:'iphone17pro'},{model_id:'iphone17pro'}]});
 await fails(createUpgradeCalcDadosProfileSource({enabled:true})({...args,tx:f.tx}));
 const other=fixture();
 await fails(createUpgradeCalcDadosProfileSource({enabled:true})({...args,tx:other.tx,tenantId:'INVALID'}));
 assert.equal(other.queries.length,0);
});
