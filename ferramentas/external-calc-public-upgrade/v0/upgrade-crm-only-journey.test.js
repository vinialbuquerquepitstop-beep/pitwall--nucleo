'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createUpgradeV1PublicApplication}=require('./upgrade-v1-public-application');
const {INSERT}=require('./upgrade-capture-repository');
const {mapUpgradeRequestToCrm,createUpgradeCrmReconciler}=require('./upgrade-crm-reconciler');
const tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1';
const org='e7f2deaf-cc16-4df7-921a-539b6a27c8c0';
const key='d71c03a5-c98d-4fe9-ad8c-ea4c20d18591';
const requestId='8b624ef6-229b-459d-aed0-35f9a749d131';
const leadId='930e39e4-6ee4-414a-861a-99c318bf40a6';
const selection={desired:{model:'iPhone 17 Pro',capacity:'256 GB',condition:'lacrado'},
 trade_in:{model:'iPhone 14 Pro',capacity:'128 GB',condition:'bom'},installments:12};
const contact={name:'Cliente de Teste',whatsapp:'5521999999999'};
test('CRM-only public page never advertises obsolete financial engine or invites a quote',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../../public/upgrade/index.html'),'utf8');
 assert(!/External Calc/i.test(html));
 assert.match(html,/cotação automática da Calculadora Pitwall V2 ainda não está disponível/i);
 assert.match(html,/<button[^>]+id="simulate"[^>]+disabled[^>]*>/);
 assert.match(html,/id="submit" type="submit">Solicitar avaliação pelo WhatsApp/);
 assert.match(html,/id="progressCaption"/);
 assert.match(html,/id="outInstallments"/);
 assert.match(html,/function validateContact\(\)/);
 assert.match(html,/id="contactConsent"[^>]*type="checkbox"/);
});
test('no financial provider needed for accepted request and CRM mapping',async()=>{
 const statements=[],origin='https://upgrade.example.test';
 const app=createUpgradeV1PublicApplication({enabled:true,tenantId:tenant,expectedOrigin:origin,
  quote:async()=>{throw Error('QUOTE_NOT_CONFIGURED')},
  query:async(sql,args)=>{statements.push(sql);assert.equal(sql,INSERT);assert.equal(args[0],tenant);
    return {rows:[{id:requestId}]};}});
 const response=await app.handle(new Request(origin+'/api/upgrade/v1/lead',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    request_key:key,selection,contact,consent:true})}));
 assert.equal(response.status,202);
 assert.deepEqual(await response.json(),{ok:true,reference:'upg_'+requestId.replaceAll('-','')});
 assert.deepEqual(statements,[INSERT]);
 const row={id:requestId,tenant_id:tenant,customer_name:contact.name,
  whatsapp_digits:contact.whatsapp,selection,consent_at:'2026-11-11T17:00:00Z',
  source:'instagram_upgrade',status:'RECEIVED'};
 const mapped=mapUpgradeRequestToCrm(row,org,tenant);
 assert.equal(mapped.p_org_id,org);
 assert.equal(mapped.p_context.upgrade_request_id,requestId);
 assert.equal(mapped.p_context.desired_product,'iPhone 17 Pro / 256 GB / lacrado');
 assert.equal(mapped.p_context.trade_model,'iPhone 14 Pro');
 assert.equal(mapped.p_acquisition.source_channel,'instagram');
 assert(!JSON.stringify(mapped).includes('sale_amount_minor'));
 const calls=[];
 const reconcile=createUpgradeCrmReconciler({enabled:true,sourceTenantId:tenant,
  organizationId:org,loadRequest:async()=>row,
  findExistingLeads:async()=>{calls.push('find');return []},
  authenticatedOperatorRpc:async(method,payload)=>{calls.push('rpc');
   assert.equal(method,'pw_s01_create_lead');
   assert.deepEqual(payload,mapped);
   return {id:leadId,organization_id:org};},
  markLinked:async x=>{calls.push('mark');assert.equal(x.leadId,leadId);return true}});
 assert.deepEqual(await reconcile({requestId}),{linked:true,lead_id:leadId,already_linked:false});
 assert.deepEqual(calls,['find','rpc','mark']);
});
test('CRM-only integration refuses duplicate contact without exact request provenance',async()=>{
 const row={id:requestId,tenant_id:tenant,customer_name:contact.name,
  whatsapp_digits:contact.whatsapp,selection,consent_at:'2026-11-11T17:00:00Z',
  source:'instagram_upgrade',status:'RECEIVED'};
 const reconcile=createUpgradeCrmReconciler({enabled:true,sourceTenantId:tenant,
  organizationId:org,loadRequest:async()=>row,
  findExistingLeads:async()=>[{id:leadId,organization_id:org,phone:contact.whatsapp,notes:'Outro lead'}],
  authenticatedOperatorRpc:async()=>{throw Error('must not create')},
  markLinked:async()=>{throw Error('must not link')}});
 await assert.rejects(reconcile({requestId}),{code:'CRM_DUPLICATE_REQUIRES_REVIEW'});
});
