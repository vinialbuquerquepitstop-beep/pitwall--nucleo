'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeCatalogPublicationOperator,SQL,DENIED}=require('./upgrade-catalog-publication-operator');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const actor='d71c03a5-c98d-4fe9-ad8c-ea4c20d18591';
const now=Date.now();
const command={publicId:'pub1',priceRevision:'rev1',analysisId:'analysis1',offerId:'sale1',offerRevision:1,expiresAtMs:now+86400000};
function offer(id,model,label,cap,condition,price,supplier){
 return {contract_version:'external-calc-c01-readonly/v1',tenant_id:tenant,
  analysis_id:'analysis1',source_id:'source1',offer_id:id,offer_revision:1,
  offer_identity_fingerprint:'i'+id,offer_value_fingerprint:'v'+id,
  execution_status:'SUCCEEDED',domain_outcome:'VALID',freshness_status:'CURRENT',
  provenance_refs:[],reviewed_offer:{supplier_id:supplier,model:{id:model,label},capacity_gb:cap,
   color:'Silver',condition,price:{amount_minor:price,currency:'BRL'}}};
}
const sale=offer('sale1','iphone17pro','iPhone 17 Pro',256,'lacrado',600000,'s1');
const used=offer('used1','iphone14pro','iPhone 14 Pro',128,'seminovo',300000,'s2');
const calculationProfile={profile_id:'calc1',profile_version:'v1',currency:'BRL',
 cash_margin_minor:90000,installment_margin_minor:100000,freight_minor:2000,freight_mode:'STORE',
 installment_base_addon_minor:0,entry_minor:0,installment_coefficients:{12:1.14}};
const activeRateProfile={tenant_id:tenant,status:'ACTIVE',currency:'BRL',profile_id:'rate1',
 version:3,fingerprint:'fp1',rate_scale:10000,entries:[{installment_count:12,rate_units:90000}]};
const tradeInPolicy={tenant_id:tenant,status:'ACTIVE',currency:'BRL',policy_id:'tp1',version:1,
 deduction_amount_minor:30000,fingerprint:'trade1'};
function fixture(patch={}){
 const state={pub:null,cat:null,context:null,queries:[],rolledBack:0,committed:0};
 const trusted={reviewedCandidate:sale,calculationProfile,calculationRunId:'run1',
  tradeInCandidates:[used],activeRateProfile,tradeInPolicy,...patch.inputs};
 const auth={authenticated:true,user_id:actor,tenant_id:tenant,role:'dono',...patch.actor};
 const query=async(sql,values)=>{
  state.queries.push(sql);
  if(sql===SQL.SOURCE_SQL)return {rows:[{offer_value_fingerprint:patch.dbFingerprint||'vsale1',domain_outcome:'VALID',freshness_status:'CURRENT'}]};
  if(sql===SQL.LATEST_SQL)return {rows:[{latest_revision:patch.latestRevision??1}]};
  if(sql===SQL.INSERT_PUBLICATION){
   if(state.pub)return {rows:[]};
   state.pub={tenant_id:values[0],public_id:values[1],price_revision:values[2],
    status:'draft',sale_price_minor:values[3],expires_at_ms:values[4],offer_revision:values[5],
    analysis_id:values[6],offer_id:values[7],offer_value_fingerprint:values[8],
    approved_at:null,approved_by:null,revoked_at:null};
   return {rows:[{public_id:values[1]}]};
  }
  if(sql===SQL.INSERT_CATALOG){
   state.cat={desired_model:values[3],desired_capacity:values[4],desired_condition:values[5],
    trade_in_models:JSON.parse(values[6])};
   return {rows:[{public_id:values[1]}]};
  }
  if(sql===SQL.INSERT_CONTEXT){
   state.context={offers:JSON.parse(values[3]),trade_in_candidates:JSON.parse(values[4]),
    trade_in_policy:JSON.parse(values[5]),rate_profile:JSON.parse(values[6])};
   return {rows:[{public_id:values[1]}]};
  }
  if(sql===SQL.LOCK_PUBLICATION)return {rows:state.pub?[state.pub]:[]};
  if(sql===SQL.LOCK_CATALOG)return {rows:state.cat?[state.cat]:[]};
  if(sql===SQL.LOCK_CONTEXT)return {rows:state.context?[state.context]:[]};
  if(sql===SQL.REVOKE_PRIOR)return {rowCount:0,rows:[]};
  if(sql===SQL.APPROVE){
   if(state.pub?.status!=='draft')return {rows:[]};
   state.pub={...state.pub,status:'published',approved_at:new Date().toISOString(),approved_by:values[3]};
   return {rows:[{public_id:values[1]}]};
  }
  throw Error('UNEXPECTED_SQL');
 };
 const operator=createUpgradeCatalogPublicationOperator({
  enabled:true,clock:()=>now,
  authorizeOperator:async()=>auth,
  loadTrustedCalcInputs:async()=>trusted,
  withTransaction:async fn=>{
   const snapshot=JSON.parse(JSON.stringify({pub:state.pub,cat:state.cat,context:state.context}));
   try{const value=await fn({query});state.committed++;return value;}
   catch(e){state.pub=snapshot.pub;state.cat=snapshot.cat;state.context=snapshot.context;state.rolledBack++;throw e;}
  }
 });
 return {operator,state,trusted};
}
async function denied(promise){await assert.rejects(promise,e=>e.code===DENIED);}
test('operator is disabled by default without operational credentials',async()=>{
 const service=createUpgradeCatalogPublicationOperator();
 assert.equal(service.enabled,false);
 await denied(service.stage(command));
 await denied(service.approve(command));
});
test('trusted Calc snapshot stages draft, then explicit operator approval publishes exact snapshot',async()=>{
 const {operator,state}=fixture();
 const draft=await operator.stage(command);
 assert.equal(draft.status,'draft');assert.equal(draft.sale_price_minor,692000);
 assert.equal(state.pub.status,'draft');assert.equal(state.pub.approved_by,null);
 assert.equal(state.cat.desired_model,'iPhone 17 Pro');
 assert.equal(state.context.rate_profile.fingerprint,'fp1');
 assert.equal(state.context.offers[0].offer_value_fingerprint,'vsale1');
 const approval=await operator.approve(command);
 assert.equal(approval.status,'published');assert.equal(approval.approved_by,actor);
 assert.equal(state.pub.status,'published');
 assert(state.queries.includes(SQL.REVOKE_PRIOR));
 assert.equal(state.committed,2);
});
test('only current exact Calc revision can be staged',async()=>{
 for(const patch of [{latestRevision:2},{dbFingerprint:'stale'}]){
  const {operator,state}=fixture(patch);
  await denied(operator.stage(command));
  assert.equal(state.pub,null);assert.equal(state.rolledBack,1);
 }
});
test('rate or margin drift before approval rolls back without publishing or revoking',async()=>{
 const {operator,state,trusted}=fixture();
 await operator.stage(command);
 trusted.calculationProfile={...calculationProfile,cash_margin_minor:120000};
 await denied(operator.approve(command));
 assert.equal(state.pub.status,'draft');
 assert.equal(state.queries.includes(SQL.REVOKE_PRIOR),false);
});
test('active rate profile fingerprint changes invalidate staged publication',async()=>{
 const {operator,state,trusted}=fixture();
 await operator.stage(command);
 trusted.activeRateProfile={...activeRateProfile,fingerprint:'changed'};
 await denied(operator.approve(command));
 assert.equal(state.pub.status,'draft');
});
test('untrusted caller cannot submit prices, modify tenant or approve without authenticated operator',async()=>{
 const {operator,state}=fixture();
 await denied(operator.stage({...command,sale_price_minor:1}));
 assert.equal(state.pub,null);
 const deniedOperator=fixture({actor:{authenticated:false}});
 await denied(deniedOperator.operator.stage(command));
 const foreign=fixture({actor:{tenant_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'}});
 await denied(foreign.operator.stage(command));
});
test('duplicate publication keys never silently overwrite draft',async()=>{
 const {operator,state}=fixture();
 await operator.stage(command);
 await denied(operator.stage(command));
 assert.equal(state.pub.status,'draft');
});
