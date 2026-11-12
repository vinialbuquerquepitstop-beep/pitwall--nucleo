'use strict';
const assert=require('node:assert/strict');
const {parseExternalAiExtraction}=require('./portable-extraction-validator');
const {previewExternalAiC01}=require('./external-ai-c01-preview');
const source='iPhone 17 256GB Azul Lacrado R$ 5.399,99';
const field_evidence={
 raw_model:[{source_ref:'s1',quote:'iPhone 17 256GB'}],brand:[],
 model:[{source_ref:'s1',quote:'iPhone 17'}],
 capacity_gb:[{source_ref:'s1',quote:'256GB'}],
 color:[{source_ref:'s1',quote:'Azul'}],
 condition:[{source_ref:'s1',quote:'Lacrado'}],
 price:[{source_ref:'s1',quote:'R$ 5.399,99'}],supplier_ref:[]
};
const sample={schema_version:'external-calc-extraction/v0',
 sources:[{source_ref:'s1',filename:'quality.txt',kind:'TEXT',text:source}],
 offers:[{offer_ref:'o1',raw_model:'iPhone 17 256GB',brand:null,model:'iPhone 17',
 capacity_gb:256,color:'Azul',condition:'Lacrado',price:{amount_minor:539999,currency:'BRL'},
 supplier_ref:null,source_refs:['s1'],field_evidence,extraction_confidence:0.99,issues:[]}],
 unresolved:[],coverage:{source_items_total:1,processed_items:1,unprocessed_items:0}};
const validated=parseExternalAiExtraction(sample);
const preview=previewExternalAiC01(validated);
assert.equal(preview.c01_review_candidates,1);
assert.equal(preview.auto_promoted,0);
assert.equal(preview.persistence_allowed,false);
const candidate=preview.queue.candidates[0];
assert.equal(candidate.contract_version,'external-calc-c01-readonly/v1');
assert.equal(candidate.domain_outcome,'REVIEW_REQUIRED');
assert.equal(candidate.interpreted_offer.model.id,null,'untrusted AI must not invent catalog model id');
assert.equal(candidate.interpreted_offer.price.amount_minor,539999);
assert.equal(candidate.review_evidence.source_lines.some(s=>s.raw==='R$ 5.399,99'),true);
assert.equal(candidate.provenance_refs.includes('external_ai_source:s1'),true);
assert.deepEqual(previewExternalAiC01(parseExternalAiExtraction(sample)).queue,preview.queue,'stable ids and snapshots across retries');
const incomplete=JSON.parse(JSON.stringify(sample));
incomplete.offers[0].price=null;incomplete.offers[0].field_evidence.price=[];
const partial=previewExternalAiC01(parseExternalAiExtraction(incomplete));
assert.equal(partial.c01_review_candidates,0);
assert.equal(partial.invalid_or_unmapped,1);
const verified={...validated,original_sources_verified:true};
const resolved=previewExternalAiC01(verified);
assert.equal(resolved.catalog_resolved,1);
assert.equal(resolved.catalog_needs_review,0);
assert.equal(resolved.queue.candidates[0].interpreted_offer.model.id,'iphone_17_256gb');
assert.equal(resolved.queue.candidates[0].domain_outcome,'REVIEW_REQUIRED');
assert.equal(resolved.auto_promoted,0);
assert.equal(resolved.persistence_allowed,false);
console.log('EXTERNAL_AI_C01_PREVIEW=PASS',17);
