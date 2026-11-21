'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeTradeInCandidateSource,SQL,DENIED}=require('./upgrade-trade-in-candidate-source');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const snapshot={contract_version:'external-calc-c01-readonly/v1',
 analysis_id:'analysis1',offer_id:'trade1',offer_revision:2,
 offer_value_fingerprint:'valuefp1',execution_status:'SUCCEEDED',
 domain_outcome:'VALID',freshness_status:'CURRENT',reviewed_offer:{
 supplier_id:'supplier1',model:{id:'iphone15',label:'iPhone 15'},capacity_gb:128,
 color:'Black',condition:'Seminovo',price:{amount_minor:310000,currency:'BRL'}}};
const row={tenant_id:tenant,analysis_id:'analysis1',offer_id:'trade1',
 offer_revision:2,c01_contract_version:'external-calc-c01-readonly/v1',
 offer_value_fingerprint:'valuefp1',c01_snapshot:snapshot,
 domain_outcome:'VALID',freshness_status:'CURRENT'};
const denied=()=>assert.fail('unexpected path');
const bad=async fn=>assert.rejects(fn,e=>e.code===DENIED);
function fixture(rows=[row]){
 const calls=[];
 const tx={query:async(sql,values)=>{
  calls.push({sql,values});
  if(sql!==SQL)throw Error('unexpected SQL');
  return {rows};
 }};
 return {tx,calls};
}
test('default-off reader performs no commercial queries',async()=>{
 await bad(createUpgradeTradeInCandidateSource()({tx:fixture().tx,tenantId:tenant}));
});
test('reads latest C01 Seminovo iPhone offer with tenant bound and intact fingerprint',async()=>{
 const f=fixture();
 const values=await createUpgradeTradeInCandidateSource({enabled:true})({tx:f.tx,tenantId:tenant});
 assert.equal(values.length,1);
 assert.equal(values[0].tenant_id,tenant);
 assert.equal(values[0].offer_value_fingerprint,'valuefp1');
 assert.deepEqual(f.calls[0].values,[tenant]);
 assert(SQL.includes('max(newer.offer_revision)'));
 assert(SQL.includes("='seminovo'"));
});
test('missing eligible trade-in reference never emits invented credit',async()=>{
 await bad(createUpgradeTradeInCandidateSource({enabled:true})({tx:fixture([]).tx,tenantId:tenant}));
});
test('stale, changed-fingerprint and cross-tenant snapshots fail closed',async()=>{
 const changes=[
  {freshness_status:'STALE'},
  {tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'},
  {offer_value_fingerprint:'changed'},
  {c01_snapshot:{...snapshot,offer_value_fingerprint:'changed'}},
  {c01_snapshot:{...snapshot,reviewed_offer:{...snapshot.reviewed_offer,condition:'Lacrado'}}},
  {c01_snapshot:{...snapshot,reviewed_offer:{...snapshot.reviewed_offer,capacity_gb:null}}},
  {c01_snapshot:{...snapshot,reviewed_offer:{...snapshot.reviewed_offer,price:{amount_minor:0,currency:'BRL'}}}},
  {c01_snapshot:{...snapshot,reviewed_offer:{...snapshot.reviewed_offer,model:{id:'ipadpro',label:'iPad Pro'}}}}
 ];
 for(const change of changes){
  await bad(createUpgradeTradeInCandidateSource({enabled:true})({tx:fixture([{...row,...change}]).tx,tenantId:tenant}));
 }
});
test('duplicate and excessive records fail closed',async()=>{
 await bad(createUpgradeTradeInCandidateSource({enabled:true})({tx:fixture([row,row]).tx,tenantId:tenant}));
 await bad(createUpgradeTradeInCandidateSource({enabled:true})({tx:fixture(Array.from({length:101},()=>row)).tx,tenantId:tenant}));
});
test('missing DB or invalid tenant rejected before query',async()=>{
 const f=fixture();
 await bad(createUpgradeTradeInCandidateSource({enabled:true})({tx:f.tx,tenantId:'bad'}));
 assert.equal(f.calls.length,0);
});
