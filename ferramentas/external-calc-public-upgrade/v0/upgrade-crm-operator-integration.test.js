'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createUpgradeCrmOperatorIntegration,DENIED}=require('./upgrade-crm-operator-integration');
const {LOAD,MARK}=require('./upgrade-crm-operator-repository');
const organizationId='e7f2deaf-cc16-4df7-921a-539b6a27c8c0';
const sourceTenantId='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const requestId='930e39e4-6ee4-414a-861a-99c318bf40a6';
const leadId='a225c1a5-e844-4f44-8d72-08e31cd51240';
const whatsapp='5521999999999';
const selection={desired:{model:'iPhone 17 Pro',capacity:'256 GB',condition:'lacrado'},
 trade_in:{model:'iPhone 14 Pro',capacity:'128 GB',condition:'bom'},installments:12};
const row={id:requestId,tenant_id:sourceTenantId,customer_name:'Ana',
 whatsapp_digits:whatsapp,selection,consent_at:'2026-11-11T12:00:00Z',
 source:'instagram_upgrade',status:'RECEIVED'};
const marker='Pitstop Upgrade V1 | Solicitacao: '+requestId+' | Novo: iPhone 17 Pro';
const crmLead={id:leadId,organization_id:organizationId,phone:whatsapp,notes:marker};
const operator={verified:true,user_id:'d71c03a5-c98d-4fe9-ad8c-ea4c20d18591',
 organization_id:organizationId,role:'manager',
 access_token:'secure-operator-access-token-long-enough'};
const denied=e=>e.code===DENIED;
function fixture({authenticated=operator,alreadyLinked=false,existing=[],failure=null}={}){
 const calls={sql:[],http:[],auth:0};
 const sourceRow=alreadyLinked?{...row,status:'LINKED',lead_id:leadId}:row;
 const query=async(sql,args)=>{
  calls.sql.push({sql,args});
  if(sql===LOAD)return {rows:[sourceRow]};
  if(sql===MARK){
   if(failure==='link')return {rows:[]};
   return {rows:[{id:requestId,tenant_id:sourceTenantId,lead_id:leadId}]};
  }
  throw Error('UNEXPECTED_SQL');
 };
 const integration=createUpgradeCrmOperatorIntegration({
  enabled:true,sourceTenantId,organizationId,query,pitwallUrl:'https://pitwall-v2.supabase.co/',
  pitwallPublishableKey:'anon-key-for-tests',
  authenticateOperator:async()=>{calls.auth++;return authenticated;},
  fetchImpl:async(url,opts)=>{
   calls.http.push({url,opts});
   if(url.includes('/rest/v1/pw_leads?'))return {ok:true,json:async()=>existing};
   if(url.includes('/rest/v1/rpc/pw_s01_create_lead')){
    if(failure==='rpc')return {ok:false,status:403,json:async()=>({message:'PRIVATE'})};
    return {ok:true,json:async()=>crmLead};
   }
   throw Error('UNEXPECTED_HTTP');
  }
 });
 return {integration,calls};
}
test('off by default does not ask for DB or CRM credentials',async()=>{
 const service=createUpgradeCrmOperatorIntegration();
 assert.equal(service.enabled,false);
 await assert.rejects(service.reconcile({requestId}),denied);
});
test('rejects forged or insufficient Pitwall operator before any source or CRM I/O',async()=>{
 for(const authenticated of [
  {...operator,verified:false},{...operator,role:'viewer'},
  {...operator,organization_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'},
  {...operator,access_token:''}
 ]){
  const f=fixture({authenticated});
  await assert.rejects(f.integration.reconcile({requestId}),denied);
  assert.deepEqual(f.calls.sql,[]);
  assert.deepEqual(f.calls.http,[]);
 }
});
test('captured Upgrade becomes exactly one Pitwall lead with canonical RPC',async()=>{
 const f=fixture();
 const output=await f.integration.reconcile({requestId});
 assert.deepEqual(output,{linked:true,lead_id:leadId,already_linked:false});
 assert.deepEqual(f.calls.sql.map(x=>x.sql),[LOAD,MARK]);
 assert.equal(f.calls.http.length,2);
 assert(f.calls.http[0].url.includes('/rest/v1/pw_leads?'));
 assert(f.calls.http[1].url.endsWith('/rest/v1/rpc/pw_s01_create_lead'));
 assert.equal(f.calls.http[1].opts.headers.authorization,'Bearer '+operator.access_token);
 const params=JSON.parse(f.calls.http[1].opts.body);
 assert.equal(params.p_org_id,organizationId);
 assert.equal(params.p_phone,whatsapp);
 assert.equal(params.p_context.upgrade_request_id,requestId);
 assert(params.p_notes.includes('Solicitacao: '+requestId));
});
test('reconcile idempotent when source already linked, without CRM reads or writes',async()=>{
 const f=fixture({alreadyLinked:true});
 assert.deepEqual(await f.integration.reconcile({requestId}),
  {linked:true,lead_id:leadId,already_linked:true});
 assert.equal(f.calls.http.length,0);
 assert.deepEqual(f.calls.sql.map(x=>x.sql),[LOAD]);
});
test('retry after source link failure identifies matching CRM lead instead of duplicating',async()=>{
 const f=fixture({existing:[crmLead]});
 assert.deepEqual(await f.integration.reconcile({requestId}),
  {linked:true,lead_id:leadId,already_linked:true});
 assert.equal(f.calls.http.length,1);
 assert.deepEqual(f.calls.sql.map(x=>x.sql),[LOAD,MARK]);
});
test('other request on same phone is held for review, not silently attached',async()=>{
 const f=fixture({existing:[{...crmLead,notes:'Unrelated'}]});
 await assert.rejects(f.integration.reconcile({requestId}),
  e=>e.code==='CRM_DUPLICATE_REQUIRES_REVIEW');
 assert.equal(f.calls.http.length,1);
 assert.deepEqual(f.calls.sql.map(x=>x.sql),[LOAD]);
});
test('Pitwall RPC failure never marks source LINKED',async()=>{
 const f=fixture({failure:'rpc'});
 await assert.rejects(f.integration.reconcile({requestId}),e=>e.code==='CRM_RPC_UNAVAILABLE');
 assert.deepEqual(f.calls.sql.map(x=>x.sql),[LOAD]);
});
test('source mark failure refuses success after CRM acknowledgement',async()=>{
 const f=fixture({failure:'link'});
 await assert.rejects(f.integration.reconcile({requestId}),e=>e.code==='CRM_LINK_FAILED');
 assert.deepEqual(f.calls.sql.map(x=>x.sql),[LOAD,MARK]);
});

test('canonical Pitwall owner and operator roles may reconcile, legacy admin role is denied',async()=>{
 for(const role of ['owner','operator']){
  const f=fixture({authenticated:{...operator,role},alreadyLinked:true});
  const result=await f.integration.reconcile({requestId});
  assert.equal(result.already_linked,true);
 }
 const forbidden=fixture({authenticated:{...operator,role:'admin'}});
 await assert.rejects(forbidden.integration.reconcile({requestId}),denied);
 assert.deepEqual(forbidden.calls.sql,[]);
});
