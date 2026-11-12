'use strict';
const assert=require('node:assert/strict');
const {parseExternalAiExtraction}=require('./portable-extraction-validator');
const sourceText='iPhone 17 256GB Azul - R$ 5.399,99';
const evidence={raw_model:[{source_ref:'s1',quote:'iPhone 17 256GB'}],brand:[],model:[{source_ref:'s1',quote:'iPhone 17'}],capacity_gb:[{source_ref:'s1',quote:'256GB'}],color:[{source_ref:'s1',quote:'Azul'}],condition:[],price:[{source_ref:'s1',quote:'R$ 5.399,99'}],supplier_ref:[]};
const valid={schema_version:'external-calc-extraction/v0',
 sources:[{source_ref:'s1',filename:'quality.txt',kind:'TEXT',text:sourceText}],
 offers:[{offer_ref:'o1',raw_model:'iPhone 17 256GB',brand:null,model:'iPhone 17',
   capacity_gb:256,color:'Azul',condition:null,price:{amount_minor:539999,currency:'BRL'},
   supplier_ref:null,source_refs:['s1'],field_evidence:evidence,extraction_confidence:0.91,issues:[]}],
 unresolved:[],coverage:{source_items_total:1,processed_items:1,unprocessed_items:0}};
const clone=()=>JSON.parse(JSON.stringify(valid));
let checks=0;
function pass(name,test){test();checks++;console.log('PASS',name)}
function reject(name,change,code){pass(name,()=>{const v=clone();change(v);assert.throws(()=>parseExternalAiExtraction(v),e=>e.code===code)})}
pass('literal evidence and version',()=>{const r=parseExternalAiExtraction(clone());assert.equal(r.accepted_for_staging,1);assert.equal(r.persistence_allowed,false);assert.equal(r.coverage_complete,true)});
reject('fabricated source quote',v=>v.offers[0].field_evidence.price[0].quote='R$ 1,00','AI_EXTRACTION_EVIDENCE_MISMATCH');
reject('invented source reference',v=>v.offers[0].source_refs=['unseen'],'AI_EXTRACTION_SOURCE_MISSING');
reject('incomplete coverage sum',v=>v.coverage.unprocessed_items=1,'AI_EXTRACTION_COVERAGE_CONFLICT');
reject('unknown schema field',v=>v.offers[0].is_valid=true,'AI_EXTRACTION_SCHEMA_INVALID');
reject('AI tries to mark VALID',v=>v.offers[0].domain_outcome='VALID','AI_EXTRACTION_SCHEMA_INVALID');
reject('duplicate offer ref',v=>v.offers.push({...v.offers[0]}),'AI_EXTRACTION_SCHEMA_INVALID');
pass('missing material field to review',()=>{const v=clone();v.offers[0].price=null;v.offers[0].field_evidence.price=[];const r=parseExternalAiExtraction(v);assert.equal(r.needs_review,1);assert.equal(r.accepted_for_staging,0)});
pass('unknown coverage never complete',()=>{const v=clone();v.coverage.source_items_total=null;const r=parseExternalAiExtraction(v);assert.equal(r.coverage_complete,false)});
pass('uncertainty with verified source quote',()=>{const v=clone();v.unresolved=[{source_ref:'s1',quote:'Azul',reason:'cor possivelmente duplicada'}];const r=parseExternalAiExtraction(v);assert.equal(r.unresolved.length,1)});
console.log('EXTERNAL_AI_EXTRACTION_VALIDATION=PASS',checks);
