'use strict';
const assert=require('node:assert/strict');
const {checkVariantEvidenceBinding}=require('./variant-price-binding');
const fields=(source_ref,model,price,color=null)=>({
 model:[{source_ref,quote:model}],price:[{source_ref,quote:price}],
 color:color?[{source_ref,quote:color}]:[]
});
const offer=(offer_ref,model,price,color,evidence)=>({offer_ref,model,price:{amount_minor:price==='R$ 5.399,99'?539999:price==='R$ 5.499,99'?549999:550000},color,field_evidence:evidence});
const verify=(name,src,offers,expected)=>{const issues=checkVariantEvidenceBinding({sources:src,offers});assert.deepEqual([...new Set(issues.map(x=>x.reason))],expected,name);console.log('PASS',name)};
verify('single row exact model-color-price',[
 {source_ref:'s',text:'iPhone 17 256GB Azul - R$ 5.399,99'}],
 [offer('a','iPhone 17','R$ 5.399,99','Azul',fields('s','iPhone 17','R$ 5.399,99','Azul'))],[]);
verify('multi color under single model heading',[
 {source_ref:'s',text:'iPhone 17 256GB\nAzul - R$ 5.399,99\nPreto - R$ 5.499,99'}],
 [offer('a','iPhone 17','R$ 5.399,99','Azul',fields('s','iPhone 17','R$ 5.399,99','Azul')),
 offer('b','iPhone 17','R$ 5.499,99','Preto',fields('s','iPhone 17','R$ 5.499,99','Preto'))],[]);
verify('wrong color from other variant row',[
 {source_ref:'s',text:'iPhone 17 256GB\nAzul - R$ 5.399,99\nPreto - R$ 5.499,99'}],
 [offer('a','iPhone 17','R$ 5.399,99','Preto',fields('s','iPhone 17','R$ 5.399,99','Preto'))],
 ['MULTI_PRICE_VARIANT_COLOR_NOT_LINKED']);
verify('intervening new model heading',[
 {source_ref:'s',text:'iPhone 17 256GB\niPhone 17 Pro 256GB\nR$ 5.399,99'}],
 [offer('a','iPhone 17','R$ 5.399,99',null,fields('s','iPhone 17','R$ 5.399,99'))],
 ['DUPLICATED_QUOTE_LOCATION']);
verify('crossed source references',[
 {source_ref:'a',text:'iPhone 17'},{source_ref:'b',text:'R$ 5.399,99'}],
 [offer('a','iPhone 17','R$ 5.399,99',null,{
 model:[{source_ref:'a',quote:'iPhone 17'}],price:[{source_ref:'b',quote:'R$ 5.399,99'}],color:[]})],
 ['MODEL_PRICE_DIFFERENT_SOURCES']);
verify('same line two prices',[
 {source_ref:'s',text:'iPhone 17 256GB Azul R$ 5.399,99 / R$ 5.499,99'}],
 [offer('a','iPhone 17','R$ 5.399,99','Azul',fields('s','iPhone 17','R$ 5.399,99','Azul'))],
 ['MULTIPLE_PRICES_SAME_LINE']);
verify('reused quote without line identity',[
 {source_ref:'s',text:'iPhone 17 256GB Azul R$ 5.399,99\niPhone 17 256GB Preto R$ 5.499,99'}],
 [offer('a','iPhone 17','R$ 5.399,99','Azul',fields('s','iPhone 17','R$ 5.399,99','Azul'))],
 ['DUPLICATED_QUOTE_LOCATION']);
verify('previous price belongs to other item',[
 {source_ref:'s',text:'R$ 5.399,99\niPhone 17 256GB'}],
 [offer('a','iPhone 17','R$ 5.399,99',null,fields('s','iPhone 17','R$ 5.399,99'))],
 ['PRICE_BEFORE_MODEL_CONTEXT']);
verify('paragraph boundary',[
 {source_ref:'s',text:'iPhone 17 256GB\n\nR$ 5.399,99'}],
 [offer('a','iPhone 17','R$ 5.399,99',null,fields('s','iPhone 17','R$ 5.399,99'))],
 ['PRICE_OUTSIDE_MODEL_BLOCK']);
verify('two models same price line',[
 {source_ref:'s',text:'iPhone 17 Pro 256GB / iPhone 17 Air 256GB - R$ 5.399,99'}],
 [offer('a','iPhone 17 Pro','R$ 5.399,99',null,fields('s','iPhone 17 Pro','R$ 5.399,99'))],
 ['MULTIPLE_MODELS_SAME_LINE']);
const capacityOffer=offer('c','iPhone 17','R$ 5.399,99','Azul',
 {...fields('s','iPhone 17 256GB','R$ 5.399,99','Azul'),
 capacity_gb:[{source_ref:'s',quote:'512GB'}]});
capacityOffer.capacity_gb=512;
verify('capacity borrowed from later variant',[
 {source_ref:'s',text:'iPhone 17 256GB Azul - R$ 5.399,99\niPhone 17 Pro 512GB - R$ 7.999,99'}],
 [capacityOffer],['CAPACITY_OUTSIDE_VARIANT_BLOCK']);
const exactCapacity=offer('c','iPhone 17','R$ 5.399,99','Azul',
 {...fields('s','iPhone 17 256GB','R$ 5.399,99','Azul'),
 capacity_gb:[{source_ref:'s',quote:'256GB'}]});
exactCapacity.capacity_gb=256;
verify('capacity quoted in correct model row',[
 {source_ref:'s',text:'iPhone 17 256GB Azul - R$ 5.399,99'}],
 [exactCapacity],[]);
console.log('EXTERNAL_AI_VARIANT_PRICE_BINDING=PASS',12);
