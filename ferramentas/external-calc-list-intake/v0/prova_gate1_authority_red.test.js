'use strict';
// Gate 1 regression assertions. Deterministic, synthetic, no DB writes.
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {evaluateAutoPromotion}=require('./auto-promotion-authority');

function candidate(priceMinor=400000){
 return {
  contract_version:'external-calc-c01-readonly/v1',
  execution_status:'SUCCEEDED',freshness_status:'CURRENT',
  interpreted_offer:{
   model:{id:'iphone-16-pro',label:'iPhone 16 Pro 256GB'},
   capacity_gb:256,
   condition:'NEW',
   color:'Preto',
   price:{amount_minor:priceMinor,currency:'BRL'}
  },
  trace:[
   {field:'model',score:1,rules:['direct_extraction']},
   {field:'price',score:1,rules:['direct_extraction']},
   {field:'capacity_gb',score:1,rules:['direct_extraction']}
  ],
  review_evidence:{source_lines:[{line_number:1}]}
 };
}

test('unknown supplier must never be eligible for automatic promotion',()=>{
 const decision=evaluateAutoPromotion(candidate(),{supplier_state:'UNKNOWN_REVIEW_ONLY',ambiguities:[]});
 assert.equal(decision.eligible,false,'unknown supplier must route to REVIEW_REQUIRED');
});
test('explicit flagged abnormal price must not be eligible for automatic promotion',()=>{
 const decision=evaluateAutoPromotion(candidate(41500),{price_risk:'OUTLIER_REVIEW_REQUIRED',ambiguities:[]});
 assert.equal(decision.eligible,false,'high-risk/outlier price must route to REVIEW_REQUIRED');
});
test('linked material ambiguity requires review',()=>{
 const decision=evaluateAutoPromotion(candidate(),{ambiguities:[{field:'price',ambiguity_id:'a1',sources:[1]}]});
 assert.equal(decision.eligible,false);
});

test('missing supplier state must fail closed even if all other signals are strong',()=>{
 const decision=evaluateAutoPromotion(candidate(),{ambiguities:[]});
 assert.equal(decision.eligible,false);
 assert.ok(decision.reasons.includes('SUPPLIER_NOT_RESOLVED'));
});
test('resolved supplier and clean synthetic candidate may remain eligible',()=>{
 const decision=evaluateAutoPromotion(candidate(),{supplier_state:'RESOLVED',ambiguities:[]});
 assert.equal(decision.eligible,true);
});
