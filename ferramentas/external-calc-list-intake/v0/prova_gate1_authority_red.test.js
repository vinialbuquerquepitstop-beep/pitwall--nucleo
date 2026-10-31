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

test('intake without supplier id never invokes automatic C01 promotion RPC',async()=>{
 const {processListIntakeCommand}=require('./list-intake-api');
 const previousFetch=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(url,request)=>{
  const name=String(url).split('/rpc/')[1];
  calls.push(name);
  return {ok:true,status:200,text:async()=>JSON.stringify({idempotent:false})};
 };
 try{
  const result=await processListIntakeCommand({
   env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'synthetic'},
   token:'synthetic-token',
   rawCommand:{filename:'gate1-unknown-supplier.txt',content:[
    'iPhone 16 Pro 256GB',
    'Preto',
    'R$ 4.000,00'
   ].join('\\n')}
  });
  assert.ok(result.candidates>=1,'fixture must produce at least one candidate');
  assert.equal(result.auto_promoted,0);
  assert.equal(result.review_required,result.candidates);
  assert.equal(result.review_reasons.SUPPLIER_NOT_RESOLVED,result.candidates);
  assert.ok(!calls.includes('extcalc_persist_auto_promoted_c01_v0'));
  assert.ok(!calls.includes('extcalc_bind_source_supplier_v0'));
 }finally{globalThis.fetch=previousFetch;}
});

test('unverified supplier RPC receipt must abort before any candidate persistence',async()=>{
 const {processListIntakeCommand}=require('./list-intake-api');
 const previousFetch=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(url)=>{
  const name=String(url).split('/rpc/')[1];
  calls.push(name);
  return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,source_id:'source_wrong',supplier_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})};
 };
 try{
  await assert.rejects(
   processListIntakeCommand({
    env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'synthetic'},
    token:'synthetic-token',
    rawCommand:{supplier_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',filename:'supplier-confirmation.txt',content:'iPhone 16 Pro 256GB\\nPreto\\nR$ 4.000,00'}
   }),
   e=>e.code==='EXTCALC_SUPPLIER_BINDING_UNVERIFIED'
  );
  assert.deepEqual(calls,['extcalc_bind_source_supplier_v0']);
 }finally{globalThis.fetch=previousFetch;}
});
