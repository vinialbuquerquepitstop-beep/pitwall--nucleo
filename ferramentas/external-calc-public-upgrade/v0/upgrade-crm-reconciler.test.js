'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {mapUpgradeRequestToCrm,createUpgradeCrmReconciler}=require('./upgrade-crm-reconciler');
const sourceTenantId='5212679b-8b2e-459f-a2ba-7ae8db558ba1',organizationId='e7f2deaf-cc16-4df7-921a-539b6a27c8c0';
const foreignOrg='efbd5c32-e2d4-4adc-964e-40ea0eae9731';
const requestId='930e39e4-6ee4-414a-861a-99c318bf40a6',leadId='a225c1a5-e844-4f44-8d72-08e31cd51240';
const selection={desired:{model:'iPhone 17 Pro',capacity:'256 GB',condition:'lacrado'},trade_in:{model:'iPhone 14 Pro',capacity:'128 GB',condition:'bom'},installments:12};
const row={id:requestId,tenant_id:sourceTenantId,customer_name:'Synthetic Tester',whatsapp_digits:'5521999999999',consent_at:'2026-11-10T12:00:00Z',source:'instagram_upgrade',status:'RECEIVED',selection};
const setup=(opts={})=>createUpgradeCrmReconciler({enabled:true,sourceTenantId,organizationId,loadRequest:async()=>row,findExistingLeads:async()=>[],authenticatedOperatorRpc:async()=>({id:leadId,organization_id:organizationId}),markLinked:async()=>true,...opts});
const denied=(fn,code)=>assert.rejects(fn,e=>e.code===code);
test('disabled without credentials',async()=>denied(()=>createUpgradeCrmReconciler()({requestId}),'CRM_RECONCILE_DISABLED'));
test('enabled requires verified organization, source tenant, operator and lookup',()=>assert.throws(()=>createUpgradeCrmReconciler({enabled:true}),/CRM_V2_OPERATOR_DEPENDENCIES_REQUIRED/));
test('maps upgrade to actual Pitwall V2 RPC context and acquisition',()=>{
 const p=mapUpgradeRequestToCrm(row,organizationId,sourceTenantId);
 assert.equal(p.p_org_id,organizationId);assert.equal(p.p_name,'Synthetic Tester');
 assert.equal(p.p_context.trade_intent,'yes');assert.equal(p.p_context.trade_model,'iPhone 14 Pro');
 assert.equal(p.p_context.trade_storage,'128 GB');assert.equal(p.p_context.payment_preference,'card');
 assert.equal(p.p_acquisition.source_channel,'instagram');assert.equal(p.p_initial_stage,'new');
 assert(p.p_notes.includes(requestId));assert(!Object.hasOwn(p,'p_tenant_id'));
});
test('operator flow correctly maps source tenant to destination organization',async()=>{
 let linked;
 const r=setup({loadRequest:async x=>{assert.deepEqual(x,{tenantId:sourceTenantId,requestId});return row;},
 findExistingLeads:async x=>{assert.deepEqual(x,{organizationId,whatsapp:row.whatsapp_digits});return [];},
 authenticatedOperatorRpc:async(name,payload)=>{assert.equal(name,'pw_s01_create_lead');assert.equal(payload.p_org_id,organizationId);return {id:leadId,organization_id:organizationId};},
 markLinked:async x=>{linked=x;return true;}});
 assert.deepEqual(await r({requestId}),{linked:true,lead_id:leadId,already_linked:false});
 assert.deepEqual(linked,{tenantId:sourceTenantId,requestId,leadId,expectedStatus:'RECEIVED'});
});
test('linked is idempotent without another CRM call',async()=>{
 let calls=0;const r=setup({loadRequest:async()=>({...row,status:'LINKED',lead_id:leadId}),findExistingLeads:async()=>{calls++;return[];},authenticatedOperatorRpc:async()=>{calls++;},markLinked:async()=>{calls++;}});
 assert.deepEqual(await r({requestId}),{linked:true,lead_id:leadId,already_linked:true});assert.equal(calls,0);
});
test('reject foreign source tenant without calling CRM',async()=>{
 let calls=0;const r=setup({loadRequest:async()=>({...row,tenant_id:foreignOrg}),authenticatedOperatorRpc:async()=>{calls++;}});
 await denied(()=>r({requestId}),'UPGRADE_REQUEST_NOT_FOUND');assert.equal(calls,0);
});
test('existing WhatsApp requires review rather than duplicate write',async()=>{
 let calls=0;const r=setup({findExistingLeads:async()=>[{id:leadId}],authenticatedOperatorRpc:async()=>{calls++;}});
 await denied(()=>r({requestId}),'CRM_DUPLICATE_REQUIRES_REVIEW');assert.equal(calls,0);
});
test('lookup errors block CRM write',async()=>denied(()=>setup({findExistingLeads:async()=>{throw Error('secret');}})({requestId}),'CRM_LOOKUP_UNAVAILABLE'));
test('reject legacy RPC envelope, wrong organization and invalid IDs',async()=>{
 for(const x of [{ok:true,lead_id:leadId},{id:leadId,organization_id:foreignOrg},{id:'bad',organization_id:organizationId}])
 await denied(()=>setup({authenticatedOperatorRpc:async()=>x})({requestId}),'CRM_LEAD_NOT_CONFIRMED');
});
test('atomic link failure blocks confirmation',async()=>denied(()=>setup({markLinked:async()=>false})({requestId}),'CRM_LINK_FAILED'));
test('invalid or consentless request rejected',async()=>{
 for(const patch of [{consent_at:null},{status:'CANCELLED'},{selection:{...selection,supplier_id:'x'}}])
 await assert.rejects(()=>setup({loadRequest:async()=>({...row,...patch})})({requestId}));
});
test('mismatched trusted tenant mapping denied',()=>assert.throws(()=>mapUpgradeRequestToCrm(row,organizationId,foreignOrg),/UPGRADE_REQUEST_INVALID/));
