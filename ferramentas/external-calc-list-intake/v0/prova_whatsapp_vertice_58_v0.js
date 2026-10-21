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
console.log('WHATSAPP_VERTICE_AMBIGUITY_DETAILS='+JSON.stringify(result.queue.unresolved_ambiguities).slice(0,12000));
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
console.log('EXTERNAL_CALC_WHATSAPP_VERTICE_58_V0=PASS');
