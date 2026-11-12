'use strict';
const assert=require('node:assert/strict');
const {createAiExtractionValidationApiV0}=require('./portable-extraction-api');
const api=createAiExtractionValidationApiV0({env:{SUPABASE_URL:'https://fake.invalid',SUPABASE_ANON_KEY:'fake-key',EXTCALC_ALLOWED_ORIGINS:'https://example.com'}});
const oldFetch=globalThis.fetch;
const original='iPhone 17 256GB Azul R$ 5399,99';
const valid={schema_version:'external-calc-extraction/v0',sources:[{source_ref:'s1',filename:'list.txt',kind:'TEXT',text:original}],offers:[{offer_ref:'o1',raw_model:'iPhone 17',brand:null,model:'iPhone 17',capacity_gb:256,color:'Azul',condition:null,price:{amount_minor:539999,currency:'BRL'},supplier_ref:null,source_refs:['s1'],field_evidence:{raw_model:[{source_ref:'s1',quote:'iPhone 17'}],brand:[],model:[{source_ref:'s1',quote:'iPhone 17'}],capacity_gb:[{source_ref:'s1',quote:'256GB'}],color:[{source_ref:'s1',quote:'Azul'}],condition:[],price:[{source_ref:'s1',quote:'5399,99'}],supplier_ref:[]},extraction_confidence:0.95,issues:[]}],unresolved:[],coverage:{source_items_total:1,processed_items:1,unprocessed_items:0}};
const request=(token,data)=>new Request('https://calc.test/api/external-calc/v0/ai-extraction/validate',{method:'POST',headers:{'content-type':'application/json',...(token?{'authorization':'Bearer '+token}:{})},body:JSON.stringify(data)});
(async()=>{
try{
 globalThis.fetch=async()=>({ok:true});
 let r=await api.handle(request(null,valid));
 assert.equal(r.status,401);
 globalThis.fetch=async()=>({ok:false});
 r=await api.handle(request('wrong',valid));assert.equal(r.status,401);
 globalThis.fetch=async()=>({ok:true});
 r=await api.handle(request('owner',valid));assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.validation.accepted_for_staging,1);
 assert.equal(body.validation.persistence_allowed,false);
 assert.equal(body.validation.c01_import_ready,false);
 assert.equal(body.validation.authority,'STAGING_ONLY');
 assert.equal(JSON.stringify(body).includes(original),false);
 const broken=JSON.parse(JSON.stringify(valid));
 broken.offers[0].field_evidence.price[0].quote='R$ 1,00';
 r=await api.handle(request('owner',broken));assert.equal(r.status,422);
 assert.equal((await r.json()).error.code,'AI_EXTRACTION_EVIDENCE_MISMATCH');
 console.log('EXTERNAL_AI_EXTRACTION_API_READONLY=PASS',4);
}finally{globalThis.fetch=oldFetch}
})().catch(e=>{console.error(e);process.exitCode=1});
