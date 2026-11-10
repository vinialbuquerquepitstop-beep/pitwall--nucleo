'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {mapUpgradeRequestToCrm,createUpgradeCrmReconciler}=require('./upgrade-crm-reconciler');
const tenantId='5212679b-8b2e-459f-a2ba-7ae8db558ba1',otherTenant='efbd5c32-e2d4-4adc-964e-40ea0eae9731';
const requestId='930e39e4-6ee4-414a-861a-99c318bf40a6',leadId='a225c1a5-e844-4f44-8d72-08e31cd51240';
const selection={desired:{model:'iPhone 17 Pro',capacity:'256 GB',condition:'lacrado'},trade_in:{model:'iPhone 14 Pro',capacity:'128 GB',condition:'bom'},installments:12};
const row={id:requestId,tenant_id:tenantId,customer_name:'Synthetic Tester',whatsapp_digits:'5521999999999',
 consent_at:'2026-11-10T12:00:00Z',source:'instagram_upgrade',status:'RECEIVED',selection};
const fail=(fn,code)=>assert.rejects(fn,e=>e.code===code);
test('default off even without DB credentials',async()=>fail(()=>createUpgradeCrmReconciler()({requestId}),'CRM_RECONCILE_DISABLED'));
test('operator-only dependencies are required',()=>assert.throws(()=>createUpgradeCrmReconciler({enabled:true}),/CRM_OPERATOR_DEPENDENCIES_REQUIRED/));
test('maps to existing CRM cadastrar_lead parameters without new origin/condition enums',()=>{
 const c=mapUpgradeRequestToCrm(row);
 assert.equal(c.p_origem,'instagram');assert.equal(c.p_condicao,'lacrado');assert.equal(c.p_perfil,'consulta');
 assert.equal(c.p_upgrade_entrada,true);assert.equal(c.p_consentimento,true);
 assert(c.p_aparelho_entrada.includes('iPhone 14 Pro'));
 assert(c.p_observacoes.includes(requestId));assert(!Object.hasOwn(c,'tenant_id'));
});
test('complete operator flow: load tenant row, call existing RPC, mark linked',async()=>{
 let linked=false,called;
 const f=createUpgradeCrmReconciler({enabled:true,tenantId,
 loadRequest:async args=>{assert.deepEqual(args,{tenantId,requestId});return row;},
 authenticatedOperatorRpc:async(name,cmd)=>{assert.equal(name,'cadastrar_lead');called=cmd;return {ok:true,lead_id:leadId};},
 markLinked:async x=>{assert.deepEqual(x,{tenantId,requestId,leadId,expectedStatus:'RECEIVED'});linked=true;return true;}});
 assert.deepEqual(await f({requestId}),{linked:true,lead_id:leadId,already_linked:false});
 assert.equal(called.p_whatsapp,row.whatsapp_digits);assert(linked);
});
test('already-linked operation is idempotent and does not call RPC',async()=>{
 let called=false;const f=createUpgradeCrmReconciler({enabled:true,tenantId,loadRequest:async()=>({...row,status:'LINKED',lead_id:leadId}),authenticatedOperatorRpc:async()=>{called=true;},markLinked:async()=>{called=true;}});
 assert.deepEqual(await f({requestId}),{linked:true,lead_id:leadId,already_linked:true});assert.equal(called,false);
});
test('rejects cross-tenant request before operator RPC',async()=>{
 let called=0;const f=createUpgradeCrmReconciler({enabled:true,tenantId,loadRequest:async()=>({...row,tenant_id:otherTenant}),authenticatedOperatorRpc:async()=>{called++;},markLinked:async()=>{called++;}});
 await fail(()=>f({requestId}),'UPGRADE_REQUEST_NOT_FOUND');assert.equal(called,0);
});
test('known duplicate can be reused only when existing precise lead_id is supplied',async()=>{
 const f=createUpgradeCrmReconciler({enabled:true,tenantId,loadRequest:async()=>row,authenticatedOperatorRpc:async()=>({ok:false,duplicado:true,existente:{lead_id:leadId}}),markLinked:async()=>true});
 assert.equal((await f({requestId})).lead_id,leadId);
});
test('ambiguous duplicate must go to human review',async()=>{
 const f=createUpgradeCrmReconciler({enabled:true,tenantId,loadRequest:async()=>row,authenticatedOperatorRpc:async()=>({ok:false,duplicado:true}),markLinked:async()=>true});
 await fail(()=>f({requestId}),'CRM_DUPLICATE_REQUIRES_REVIEW');
});
test('fails closed if atomic link does not confirm success',async()=>{
 const f=createUpgradeCrmReconciler({enabled:true,tenantId,loadRequest:async()=>row,authenticatedOperatorRpc:async()=>({ok:true,lead_id:leadId}),markLinked:async()=>false});
 await fail(()=>f({requestId}),'CRM_LINK_FAILED');
});
test('invalid stored request and absence of consent rejected',async()=>{
 for(const changed of [{status:'CANCELLED'},{consent_at:null},{selection:{...selection,tenant_id:'attacker'}}]){
  const f=createUpgradeCrmReconciler({enabled:true,tenantId,loadRequest:async()=>({...row,...changed}),authenticatedOperatorRpc:async()=>({ok:true,lead_id:leadId}),markLinked:async()=>true});
  await assert.rejects(()=>f({requestId}));
 }
});
