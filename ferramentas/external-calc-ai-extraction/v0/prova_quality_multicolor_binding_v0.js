'use strict';
const assert=require('node:assert/strict');
const {verifyPortableAiInput}=require('./original-source-verifier');
const source='iPhone 17 256GB\nAzul - R$ 5.399,99\nPreto - R$ 5.499,99';
function makeOffer(ref,color,price){
 const p='R$ '+(price===539999?'5.399,99':'5.499,99');
 return {offer_ref:ref,raw_model:'iPhone 17 256GB',brand:null,model:'iPhone 17',
 capacity_gb:256,color,condition:null,price:{amount_minor:price,currency:'BRL'},supplier_ref:null,
 source_refs:['quality-chat'],field_evidence:{
 raw_model:[{source_ref:'quality-chat',quote:'iPhone 17 256GB'}],
 brand:[],model:[{source_ref:'quality-chat',quote:'iPhone 17 256GB'}],
 capacity_gb:[{source_ref:'quality-chat',quote:'256GB'}],
 color:[{source_ref:'quality-chat',quote:color}],
 condition:[],price:[{source_ref:'quality-chat',quote:p}],supplier_ref:[]},
 extraction_confidence:0.95,issues:[]};
}
const doc={schema_version:'external-calc-extraction/v0',
 sources:[{source_ref:'quality-chat',filename:'lista.txt',kind:'TEXT',text:source}],
 offers:[makeOffer('azul','Azul',539999),makeOffer('preto','Preto',549999)],
 unresolved:[],coverage:{source_items_total:2,processed_items:2,unprocessed_items:0}};
const verify=input=>verifyPortableAiInput({extraction:input,original_sources:[{source_ref:'quality-chat',text:source}]});
const valid=verify(doc);
assert.equal(valid.accepted_for_staging,2);
assert.equal(valid.needs_review,0);
const crossed=JSON.parse(JSON.stringify(doc));
crossed.offers[0].field_evidence.price[0].quote='R$ 5.499,99';
crossed.offers[0].price.amount_minor=549999;
const uncertain=verify(crossed);
assert.equal(uncertain.needs_review,2,'price conflict flags both same-variant color offers?');
assert.ok(uncertain.issues.some(x=>x.offer_ref==='azul'&&x.reason==='COLOR_PRICE_ROW_MISMATCH'));
console.log('EXTERNAL_AI_QUALITY_MULTICOLOR_END_TO_END=PASS',4);
