'use strict';
const assert=require('node:assert/strict');
const {resolveExternalAiModel,resolvePortableOfferStates}=require('./canonical-model-resolver');
const cases=[
 [{model:'iPhone 17',capacity_gb:256},'RESOLVED','iphone_17_256gb'],
 [{model:'iPhone 17',capacity_gb:512},'RESOLVED','iphone_17_512gb'],
 [{model:'iPhone 17 Air',capacity_gb:256},'RESOLVED','iphone_17_air_256gb'],
 [{model:'iPhone 17',capacity_gb:128},'REVIEW_REQUIRED',null],
 [{model:'iPhone 18 Pro Max',capacity_gb:256},'REVIEW_REQUIRED',null],
 [{model:'iPhone 17 Pro',capacity_gb:256},'REVIEW_REQUIRED',null],
 [{model:'iPhone 17',capacity_gb:null},'REVIEW_REQUIRED',null],
 [{model:'iPhone 17 256GB',capacity_gb:512},'REVIEW_REQUIRED',null]
];
let checks=0;
for(const [input,expected,id] of cases){
 const x=resolveExternalAiModel(input);
 assert.equal(x.state,expected);assert.equal(x.entity?.id||null,id);checks++;
}
const base={valid:true,authority:'STAGING_ONLY',original_sources_verified:true,coverage_complete:true,issues:[],offers:[
 {offer_ref:'o1',model:'iPhone 17',capacity_gb:256,price:{amount_minor:539999}},
 {offer_ref:'o2',model:'iPhone 18 Pro Max',capacity_gb:256,price:{amount_minor:1099999}}
]};
const state=resolvePortableOfferStates(base);
assert.equal(state[0].state,'CATALOG_RESOLVED_PREVIEW');
assert.equal(state[0].auto_promotion_allowed,false);
assert.equal(state[1].state,'REVIEW_REQUIRED');
checks+=3;
const uncertain={...base,issues:[{offer_ref:'o1',field:'price',reason:'CONFLICTING_PRICE_FOR_VARIANT'}]};
assert.equal(resolvePortableOfferStates(uncertain)[0].state,'REVIEW_REQUIRED');checks++;
const missingOriginal={...base,original_sources_verified:false};
assert.equal(resolvePortableOfferStates(missingOriginal)[0].state,'REVIEW_REQUIRED');checks++;
const partial={...base,coverage_complete:false};
assert.equal(resolvePortableOfferStates(partial)[0].state,'REVIEW_REQUIRED');checks++;
console.log('EXTERNAL_AI_CANONICAL_MODEL_GATE=PASS',checks);
