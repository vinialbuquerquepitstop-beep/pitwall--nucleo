'use strict';
const assert=require('node:assert/strict');
const {verifyPortableAiInput}=require('./original-source-verifier');
const original='iPhone 17 256GB Azul - R$ 5.399,99';
const extraction={schema_version:'external-calc-extraction/v0',
 sources:[{source_ref:'s1',filename:'lista.txt',kind:'TEXT',text:original}],
 offers:[{offer_ref:'o1',raw_model:'iPhone 17 256GB',brand:null,model:'iPhone 17',capacity_gb:256,color:'Azul',
 condition:null,price:{amount_minor:539999,currency:'BRL'},supplier_ref:null,source_refs:['s1'],field_evidence:{
 raw_model:[{source_ref:'s1',quote:'iPhone 17 256GB'}],brand:[],model:[{source_ref:'s1',quote:'iPhone 17'}],
 capacity_gb:[{source_ref:'s1',quote:'256GB'}],color:[{source_ref:'s1',quote:'Azul'}],condition:[],
 price:[{source_ref:'s1',quote:'R$ 5.399,99'}],supplier_ref:[]},extraction_confidence:0.99,issues:[]}],
 unresolved:[],coverage:{source_items_total:1,processed_items:1,unprocessed_items:0}};
const raw=()=>JSON.parse(JSON.stringify(extraction));
const envelope=(v=raw(),text=original)=>({extraction:v,original_sources:[{source_ref:'s1',text}]});
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS',name)}
function negative(name,data,code){check(name,()=>assert.throws(()=>verifyPortableAiInput(data),e=>e.code===code))}
check('independent exact source accepted',()=>{const r=verifyPortableAiInput(envelope());assert.equal(r.original_sources_verified,true);assert.equal(r.original_source_count,1)});
negative('missing originals',{extraction:raw(),original_sources:[]},'AI_ORIGINAL_SOURCE_REQUIRED');
negative('missing envelope',{...raw()},'AI_ORIGINAL_SOURCE_REQUIRED');
negative('operator text differs from AI',envelope(raw(),'iPhone 17 256GB Azul - R$ 9.399,99'),'AI_ORIGINAL_SOURCE_MISMATCH');
negative('AI truncates original',envelope({...raw(),sources:[{source_ref:'s1',filename:'lista.txt',kind:'TEXT',text:'iPhone 17 256GB Azul'}]}),'AI_EXTRACTION_EVIDENCE_MISMATCH');
negative('duplicate originals',{extraction:raw(),original_sources:[{source_ref:'s1',text:original},{source_ref:'s1',text:original}]},'AI_ORIGINAL_SOURCE_REQUIRED');
const bad=raw();bad.offers[0].price.amount_minor=939999;
check('price changed without quote flagged for review',()=>{const r=verifyPortableAiInput(envelope(bad));assert.equal(r.needs_review,1);assert.ok(r.issues.some(x=>x.reason==='EVIDENCE_VALUE_MISMATCH'))});
const falseModel=raw();falseModel.offers[0].model='iPhone 18';
check('wrong variant model is flagged for review',()=>{const r=verifyPortableAiInput(envelope(falseModel));assert.equal(r.needs_review,1)});
const wrongCapacity=raw();wrongCapacity.offers[0].capacity_gb=512;
check('wrong capacity is flagged for review',()=>{const r=verifyPortableAiInput(envelope(wrongCapacity));assert.equal(r.needs_review,1)});
console.log('EXTERNAL_AI_INDEPENDENT_ORIGINAL=PASS',passed);
