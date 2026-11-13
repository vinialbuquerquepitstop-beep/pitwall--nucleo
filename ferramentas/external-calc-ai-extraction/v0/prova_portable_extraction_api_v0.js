'use strict';
const assert=require('node:assert/strict');
const {createAiExtractionValidationApiV0}=require('./portable-extraction-api');
const api=createAiExtractionValidationApiV0({env:{SUPABASE_URL:'https://fake.invalid',SUPABASE_ANON_KEY:'fake-key',EXTCALC_ALLOWED_ORIGINS:'https://example.com'}});
const oldFetch=globalThis.fetch;
const supplierId='55555555-5555-4555-8555-555555555555';
const original='iPhone 17 256GB Azul R$ 5399,99';
const valid={schema_version:'external-calc-extraction/v0',sources:[{source_ref:'s1',filename:'list.txt',kind:'TEXT',text:original}],offers:[{offer_ref:'o1',raw_model:'iPhone 17',brand:null,model:'iPhone 17',capacity_gb:256,color:'Azul',condition:null,price:{amount_minor:539999,currency:'BRL'},supplier_ref:null,source_refs:['s1'],field_evidence:{raw_model:[{source_ref:'s1',quote:'iPhone 17'}],brand:[],model:[{source_ref:'s1',quote:'iPhone 17'}],capacity_gb:[{source_ref:'s1',quote:'256GB'}],color:[{source_ref:'s1',quote:'Azul'}],condition:[],price:[{source_ref:'s1',quote:'5399,99'}],supplier_ref:[]},extraction_confidence:0.95,issues:[]}],unresolved:[],coverage:{source_items_total:1,processed_items:1,unprocessed_items:0}};
const request=(token,data)=>new Request('https://calc.test/api/external-calc/v0/ai-extraction/validate',{method:'POST',headers:{'content-type':'application/json',...(token?{'authorization':'Bearer '+token}:{})},body:JSON.stringify({extraction:data,original_sources:[{source_ref:'s1',text:original}],supplier_id:supplierId})});
(async()=>{
try{
 globalThis.fetch=async(url)=>String(url).includes('/rest/v1/extcalc_supplier')?{ok:true,json:async()=>[{supplier_id:supplierId,name:'Quality'}]}:{ok:true};
 let r=await api.handle(request(null,valid));
 assert.equal(r.status,401);
 globalThis.fetch=async()=>({ok:false});
 r=await api.handle(request('wrong',valid));assert.equal(r.status,401);
 globalThis.fetch=async(url)=>String(url).includes('/rest/v1/extcalc_supplier')?{ok:true,json:async()=>[{supplier_id:supplierId,name:'Quality'}]}:{ok:true};
 r=await api.handle(request('owner',valid));assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.validation.accepted_for_staging,1);
 assert.equal(body.validation.original_sources_verified,true);
 assert.equal(body.validation.original_source_count,1);
 assert.equal(Number.isSafeInteger(body.validation.chronology.unbound_partial_updates),true);
 assert.equal(body.validation.chronology.unbound_partial_updates,0);
 assert.equal(body.validation.supplier_authority.verified,true);
 assert.equal(body.validation.supplier_authority.supplier_id,supplierId);
 assert.equal(body.validation.persistence_allowed,false);
 assert.equal(body.validation.c01_import_ready,false);
 assert.equal(body.validation.review_preview.total_offers,1);
 assert.equal(body.validation.review_preview.shown,1);
 assert.equal(body.validation.review_preview.items.length,1);
 assert.equal(body.validation.review_preview.items[0].model,'iPhone 17');
 assert.equal(body.validation.review_preview.items[0].price_amount_minor,539999);
 assert.equal(body.validation.review_preview.items[0].status,'REVIEW_REQUIRED');
 assert.equal('source_refs' in body.validation.review_preview.items[0],false);
 assert.equal('field_evidence' in body.validation.review_preview.items[0],false);

 assert.equal(body.validation.authority,'STAGING_ONLY');
 assert.equal(JSON.stringify(body).includes(original),false);
 const broken=JSON.parse(JSON.stringify(valid));
 broken.offers[0].field_evidence.price[0].quote='R$ 1,00';
 r=await api.handle(request('owner',broken));assert.equal(r.status,422);
 assert.equal((await r.json()).error.code,'AI_EXTRACTION_EVIDENCE_MISMATCH');
 const mismatch=JSON.parse(JSON.stringify(valid));
 r=await api.handle(new Request('https://calc.test/api/external-calc/v0/ai-extraction/validate',{
   method:'POST',headers:{authorization:'Bearer owner','content-type':'application/json'},
   body:JSON.stringify({extraction:mismatch,original_sources:[{source_ref:'s1',text:'iPhone 17 128GB Azul R$ 5.399,99'}],supplier_id:supplierId})
 }));
 assert.equal(r.status,422);
 assert.equal((await r.json()).error.code,'AI_ORIGINAL_SOURCE_MISMATCH');

 const altered=JSON.parse(JSON.stringify(valid));
 altered.sources[0].text='iPhone 17 256GB Azul R$ 1,00';
 r=await api.handle(request('owner',altered));assert.equal(r.status,422);
 assert.equal((await r.json()).error.code,'AI_EXTRACTION_EVIDENCE_MISMATCH');
 globalThis.fetch=async(url)=>String(url).includes('/rest/v1/extcalc_supplier')?{ok:true,json:async()=>[]}:{ok:true};
 r=await api.handle(request('owner',valid));assert.equal(r.status,403);
 assert.equal((await r.json()).error.code,'AI_SUPPLIER_FORBIDDEN');
 globalThis.fetch=async(url)=>String(url).includes('/rest/v1/extcalc_supplier')?{ok:true,json:async()=>[{supplier_id:supplierId,name:'Quality'}]}:{ok:true};
 const wrong=JSON.parse(JSON.stringify(valid));wrong.offers[0].supplier_ref='Another Dealer';
 r=await api.handle(request('owner',wrong));assert.equal(r.status,422);
 assert.equal((await r.json()).error.code,'AI_SUPPLIER_CLAIM_CONFLICT');
 const privateText='WHATSAPP_PRIVATE_GROUP_PHONE_21999999999';
 r=await api.handle(new Request('https://calc.test/api/external-calc/v0/ai-extraction/validate',{
   method:'POST',headers:{authorization:'Bearer owner','content-type':'application/json'},
   body:'{"extraction":"'+privateText+'" BROKEN'
 }));
 const privateError=await r.json();
 assert.equal(r.status,400);
 assert.equal(privateError.error.code,'AI_EXTRACTION_INVALID');
 assert.equal(JSON.stringify(privateError).includes(privateText),false,'never echo malformed JSON snippets');
 r=await api.handle(new Request('https://calc.test/api/external-calc/v0/ai-extraction/unpack',{
   method:'POST',headers:{authorization:'Bearer owner','content-type':'application/json'},
   body:JSON.stringify({content_base64:'not-a-valid-zip!'+privateText})
 }));
 const zipError=await r.json();
 assert.equal(r.status,422);
 assert.equal(JSON.stringify(zipError).includes(privateText),false,'never echo ZIP upload content');
 console.log('EXTERNAL_AI_EXTRACTION_API_READONLY=PASS',10);
}finally{globalThis.fetch=oldFetch}
})().catch(e=>{console.error(e);process.exitCode=1});
