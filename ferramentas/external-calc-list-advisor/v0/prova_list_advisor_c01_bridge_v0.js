'use strict';

const assert=require('assert');
const { bridgeListAdvisorToC01 }=require('./list-advisor-c01-bridge');

const supplierId='7cbb126f-0499-44af-8d0b-55c4547ff701';
const content='17 pro 256gb\nBlue Anatel $ 6.900\n\n12 | 64gb | 128g - 🟦🟪🟩⬛️ *1.350/ 1450*';
const interpretation={
  contract_version:'external-calc-list-advisor/v0',
  supplier_id:supplierId,
  supplier_name:'Fornecedor Teste',
  input_hash:'a'.repeat(64),
  context_fingerprint:'b'.repeat(64),
  offers:[
    {model:'iPhone 17 Pro',capacity_gb:256,color:'Blue',condition:'LACRADO',variant:'Anatel',price_amount_minor:690000,currency:'BRL',confidence:.99,source_excerpt:'Blue Anatel $ 6.900'},
    {model:'iPhone 12',capacity_gb:64,color:null,condition:'GRADE A',variant:null,price_amount_minor:135000,currency:'BRL',confidence:.88,source_excerpt:'12 | 64gb | 128g - 🟦🟪🟩⬛️ *1.350/ 1450*'}
  ],
  ambiguities:[
    {field:'color',source_excerpt:'12 | 64gb | 128g - 🟦🟪🟩⬛️ *1.350/ 1450*',reason:'cores nao atribuiveis com seguranca'}
  ]
};

const result=bridgeListAdvisorToC01({
  interpretation,
  content,
  analysis_id:'analysis_test',
  source_id:'source_test',
  supplier_id:supplierId
});

assert.strictEqual(result.queue.candidates.length,2);
assert.strictEqual(result.queue.candidates[0].interpreted_offer.supplier_id,supplierId);
assert.strictEqual(result.queue.candidates[0].review_evidence.source_lines[0].line_number,2);
assert(result.queue.candidates[0].provenance_refs.includes('supplier_variant:Anatel'));
assert.strictEqual(result.queue.unresolved_ambiguities.length,1);
assert.strictEqual(result.queue.unresolved_ambiguities[0].sources[0],4);
assert.strictEqual(result.partition.review.length>=1,true);
console.log('EXTERNAL_CALC_LIST_ADVISOR_C01_BRIDGE_V0=PASS');
