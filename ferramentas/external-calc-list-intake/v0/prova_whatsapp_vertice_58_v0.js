'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildQueue}=require('./list-intake-api');
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/golden-whatsapp-vertice-58-v0.txt'),'utf8');
const result=buildQueue({filename:'vertice-golden-whatsapp.txt',content:fixture});
const items=result.queue.candidates.map(c=>({
  model:String(c.interpreted_offer?.model?.label||''),
  condition:String(c.interpreted_offer?.condition||''),
  capacity_gb:c.interpreted_offer?.capacity_gb??null,
  color:String(c.interpreted_offer?.color||''),
  price:c.interpreted_offer?.price?.amount_minor||0,
  lines:[c.review_evidence?.field_sources?.model?.[0],c.review_evidence?.field_sources?.price?.[0]]
}));
console.log('WHATSAPP_VERTICE_OBSERVED_COUNT='+items.length);
console.log('WHATSAPP_VERTICE_AMBIGUITIES='+result.queue.unresolved_ambiguities.length);
console.log('WHATSAPP_VERTICE_AMBIGUITY_SUMMARY='+JSON.stringify(result.queue.unresolved_ambiguities.map(a=>({cause:a.cause,line:a.sources?.[0],raw:a.raw}))));
for(let i=0;i<items.length;i++)console.log('C01#'+String(i+1).padStart(2,'0')+' '+JSON.stringify(items[i]));
const airpods4=items.filter(x=>/\bAir\s?Pods\s*4\b/i.test(x.model)&&x.price===89000);
assert(airpods4.length>0,'AirPods 4 890.00 must be recognized');
for(const item of airpods4)assert.notEqual(item.condition.toUpperCase(),'CPO','CPO cannot inherit from distant iPhone 14');
assert(items.some(x=>/iPhone\s*14.*128/i.test(x.model)&&x.condition==='CPO'),
  'Explicit iPhone 14 CPO must be preserved');
const rules={
 'iPhone 18':8,'iPhone 17':10,'iPhone 16/15/14':11,
 'MacBook':4,'iPad':6,'Apple Watch':6,'AirPods':4,
 'Garmin':5,'Accessories':4
};
assert.equal(Object.values(rules).reduce((a,b)=>a+b,0),58,'Human audited 58-offer reference');
assert.equal(items.length,58,
  'GATE1_NO_GO: one commercial color/price must map to one C01 candidate. Review C01 line diagnostics above.');

// Each row is an independently expected commercial offer: model, capacity,
// color, price in BRL cents. This intentionally catches correct count
// with shifted prices/models, and is not derived from parser output.
const expected=String.raw`
iPhone 18 Pro Max 512GB|512|Preto|1075000
iPhone 18 Pro Max 512GB|512|Azul|1099000
iPhone 18 Pro Max 512GB|512|Bordô|1145000
iPhone 18 Pro Max 256GB|256|Prata|905000
iPhone 18 Pro Max 256GB|256|Preto|905000
iPhone 18 Pro Max 256GB|256|Bordô|965000
iPhone 18 Pro 256GB|256|Azul|779000
iPhone 18 Pro 256GB|256|Prata|765000
iPhone 17 Pro Max 256GB|256|Laranja|789000
iPhone 17 Pro Max 256GB|256|Azul|775000
iPhone 17 Pro Max 256GB|256|Prata|769000
iPhone 17 Pro 256GB|256|Prata|689000
iPhone 17 Pro 256GB|256|Laranja|709000
iPhone 17|256|Preto|515000
iPhone 17|256|Verde|515000
iPhone 17|256|Rosa|515000
iPhone 17 Air|256|Preto|539000
iPhone 17 Air|256|Azul|549000
iPhone 16 Pro Max|256|Preto|635000
iPhone 16 Pro Max|256|Natural|649000
iPhone 16|128|Verde|359000
iPhone 16|128|Preto|359000
iPhone 16|256|Branco|385000
iPhone 16|256|Preto|379000
iPhone 15 Pro Max 256GB|256|Natural|589000
iPhone 15|128|Preto|319000
iPhone 15|128|Rosa|325000
iPhone 14 128GB|128|Meia-noite|269000
iPhone 14 128GB|128|Starlight|269000
MacBook Air M5 13" 16/512GB|512|Meia-noite|719000
MacBook Air M5 13" 16/512GB|512|Starlight|709000
MacBook Air M4 13" 16/256GB|256|Cinza espacial|535000
MacBook Pro 14" M5 16/512GB|512|Space Black|1049000
iPad 11a geração 128GB Wi-Fi|128|Rosa|229000
iPad 11a geração 128GB Wi-Fi|128|Azul|229000
iPad 11a geração 128GB Wi-Fi|128|Prata|225000
iPad Air 11" M4 128GB|128|Roxo|415000
iPad Air 11" M4 128GB|128|Starlight|409000
iPad mini 128GB Wi-Fi|128|Cinza espacial|345000
Watch Ultra 3 49mm||Preto|545000
Watch Ultra 3 49mm||Natural|529000
Watch Series 11 46mm||Meia-noite|299000
Watch Series 11 46mm||Rose Gold|305000
Watch SE 3 44mm||Starlight|189000
Watch SE 3 44mm||Meia-noite|189000
AirPods Pro 3|||159000
AirPods 4|||89000
AirPods Max USB-C||Meia-noite|369000
AirPods Max USB-C||Azul|375000
Forerunner 165||Preto|165000
Forerunner 165||Branco|169000
Forerunner 265||Preto|239000
Vivoactive 6||Rosa|215000
Vivoactive 6||Preto|209000
Fonte USB-C 20W Apple Original|||9500
Cabo USB-C 1m Apple Original|||11000
Fone Bluetooth TWS Genérico||Preto|7990
Fone Bluetooth TWS Genérico||Branco|7990
`.trim().split('\n').map(row=>{
  const [model,capacity_gb,color,price]=row.split('|');
  return {model,capacity_gb:capacity_gb?Number(capacity_gb):null,color,price:Number(price)};
});
assert.equal(expected.length,58,'Oracle integrity: exactly 58 independent offers');
for(let i=0;i<expected.length;i++){
  const actual=items[i],wanted=expected[i];
  assert.deepStrictEqual({
    model:actual?.model,capacity_gb:actual?.capacity_gb??null,
    color:actual?.color,price:actual?.price
  },wanted,'GOLDEN OFFER MISMATCH #'+(i+1)+': '+JSON.stringify(wanted));
}
const expectedConditions=[
  [19,'Lacrado'],[20,'Lacrado'],[21,'Lacrado'],[22,'Lacrado'],
  [23,'CPO'],[24,'CPO'],[25,'Caixa aberta'],
  [28,'CPO'],[29,'CPO'],[47,'Lacrado']
];
for(const [n,condition] of expectedConditions){
  assert.equal(items[n-1]?.condition,condition,
    'EXPLICIT CONDITION MISMATCH at candidate '+n);
}
assert.equal(items[46-1].condition,'',
 'AirPods Pro 3 must not inherit condition from iPhone CPO');
assert(result.queue.unresolved_ambiguities.every(a=>a.cause==='structural_role_unknown'),
 'Unexpected field/value ambiguity, fail closed');
console.log('EXTERNAL_CALC_WHATSAPP_58_FIELD_BY_FIELD=PASS model,capacity,color,price,explicit_conditions');

console.log('EXTERNAL_CALC_WHATSAPP_VERTICE_58_V0=PASS');
