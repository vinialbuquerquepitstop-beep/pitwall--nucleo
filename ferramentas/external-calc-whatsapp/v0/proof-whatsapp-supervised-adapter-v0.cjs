'use strict';
const assert=require('node:assert/strict');
const {normalizeSupervised,MAX_BYTES}=require('./whatsapp-supervised-source-adapter-v0.cjs');
const base=()=>({trustedContext:{tenant_id:'tenant-A',operator_id:'operator-1',intake_id:'intake-1',captured_at:'2026-10-28T19:00:00Z',authorized_suppliers:{'supplier-1':'tenant-A','supplier-foreign':'tenant-B'},authorized_groups:{'group-1':'tenant-A','group-foreign':'tenant-B'}},submission:{supplier_id:'supplier-1',group_alias:'group-1',capture_method:'operator_forward',original_text:'iPhone 16 128GB R$ 3900'}});
let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name);}
check('T01 valid approved group yields review-only event',()=>{const r=normalizeSupervised(base());assert.equal(r.ok,true);assert.equal(r.events.length,1);assert.equal(r.events[0].review_state,'REVIEW_REQUIRED');});
check('T02 unknown supplier rejected',()=>{const x=base();x.submission.supplier_id='other';assert.equal(normalizeSupervised(x).code,'UNAUTHORIZED_SOURCE');});
check('T03 unknown group rejected',()=>{const x=base();x.submission.group_alias='other';assert.equal(normalizeSupervised(x).code,'UNAUTHORIZED_SOURCE');});
check('T04 cross-tenant supplier and group rejected',()=>{for(const key of ['supplier_id','group_alias']){const x=base();x.submission[key]=key==='supplier_id'?'supplier-foreign':'group-foreign';assert.equal(normalizeSupervised(x).code,'CROSS_TENANT_SOURCE');}});
check('T05 blank or oversized text rejected',()=>{for(const t of ['   ','x'.repeat(MAX_BYTES+1)]){const x=base();x.submission.original_text=t;const r=normalizeSupervised(x);assert.equal(r.code,'INVALID_TEXT');assert.deepEqual(r.events,[]);}});
check('T06 key uses trusted intake id not text hash',()=>{const r=normalizeSupervised(base()).events[0];assert.equal(r.source_event_key,'supervised:intake-1');assert.notEqual(r.source_event_key,r.original_sha256);});
check('T07 identical text separate ids have different source keys',()=>{const a=base(),b=base();b.trustedContext.intake_id='intake-2';assert.notEqual(normalizeSupervised(a).events[0].source_event_key,normalizeSupervised(b).events[0].source_event_key);});
check('T08 same intake id yields deterministic source key',()=>{assert.equal(normalizeSupervised(base()).events[0].source_event_key,normalizeSupervised(base()).events[0].source_event_key);});
check('T09 submitted tenant and operator spoofing ignored',()=>{const x=base();x.submission.tenant_id='tenant-B';x.submission.operator_id='hacker';const e=normalizeSupervised(x).events[0];assert.equal(e.tenant_id,'tenant-A');assert.equal(e.operator_id,'operator-1');});
check('T10 no commercial offer authority emitted',()=>{const e=normalizeSupervised(base()).events[0];assert.equal('offer_id' in e,false);assert.equal('auto_promoted' in e,false);});
check('T11 only supported methods accepted',()=>{const x=base();x.submission.capture_method='cloud_webhook';assert.equal(normalizeSupervised(x).code,'UNSUPPORTED_METHOD');});
check('T12 provenance operator asserted only',()=>{const x=base();x.submission.provenance_confidence='provider_verified';assert.equal(normalizeSupervised(x).events[0].provenance_confidence,'operator_asserted');});
console.log('WM02 SUPERVISED ADAPTER PASS '+count+'/'+count);
