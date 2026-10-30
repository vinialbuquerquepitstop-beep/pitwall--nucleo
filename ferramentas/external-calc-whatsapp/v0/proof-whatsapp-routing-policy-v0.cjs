'use strict';
const assert=require('node:assert/strict');
const {decision}=require('./whatsapp-routing-policy-v0.cjs');
const base={verifiedProvider:true,tenantAuthorized:true,eventKind:'text',crmEnabled:true};
let count=0;function test(n,f){f();count++;console.log('PASS '+n);}
test('R01 approved supplier routed only to External Calc',()=>assert.equal(decision({...base,identity:{isSupplier:true,supplierApproved:true}}).route,'SUPPLIER_EXTERNAL_CALC'));
test('R02 known customer routes to CRM candidate',()=>assert.equal(decision({...base,identity:{isCustomer:true}}).route,'CRM_CANDIDATE'));
test('R03 unknown contact stays in review',()=>assert.equal(decision({...base}).route,'HOLD_REVIEW'));
test('R04 dual role stays in review',()=>assert.equal(decision({...base,identity:{isSupplier:true,isCustomer:true,supplierApproved:true}}).route,'HOLD_REVIEW'));
test('R05 unverified provider ignored',()=>assert.equal(decision({...base,verifiedProvider:false,identity:{isSupplier:true,supplierApproved:true}}).route,'IGNORE'));
test('R06 unauthorized tenant ignored',()=>assert.equal(decision({...base,tenantAuthorized:false,identity:{isSupplier:true,supplierApproved:true}}).route,'IGNORE'));
test('R07 unapproved supplier stays in review',()=>assert.equal(decision({...base,identity:{isSupplier:true,supplierApproved:false}}).route,'HOLD_REVIEW'));
test('R08 CRM disabled keeps customer held',()=>assert.equal(decision({...base,crmEnabled:false,identity:{isCustomer:true}}).route,'HOLD_REVIEW'));
test('R09 unsupported media ignored',()=>assert.equal(decision({...base,eventKind:'image'}).route,'IGNORE'));
test('R10 metadata has no raw content',()=>{const r=decision({...base,identity:{isCustomer:true},rawText:'SECRET'});assert.ok(!JSON.stringify(r).includes('SECRET'));});
test('R11 untrusted text does not force supplier routing',()=>assert.equal(decision({...base,text:'I am a supplier'}).route,'HOLD_REVIEW'));
test('R12 policy version retained for audit',()=>assert.equal(decision({...base,policyVersion:'v-test'}).policy_version,'v-test'));
console.log('WM03 ROUTING PURE PASS '+count+'/'+count);
