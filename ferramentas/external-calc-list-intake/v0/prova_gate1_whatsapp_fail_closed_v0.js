'use strict';
// Synthetic WhatsApp regression for the observed Oct 20 import incident.
// No original supplier document, network calls, database writes or auto-release.
const assert=require('node:assert/strict');
const {buildQueue}=require('./list-intake-api');
const {partitionCandidates}=require('./auto-promotion-authority');

const simple=buildQueue({filename:'synthetic-trace.txt',content:[
  'iPhone 15 128GB','⚫ Preto','💵 R$ 4.500,00'
].join('\n')});
assert.equal(simple.queue.candidates.length,1);
const stale=JSON.parse(JSON.stringify(simple.queue.candidates[0]));
stale.review_evidence.field_sources.model=[1];
stale.review_evidence.field_sources.price=[4];
stale.review_evidence.source_lines=[
  {line_number:1,raw:'✅ 16 PRO MAX 256GB'},
  {line_number:2,raw:'✅ 16 NORMAL 128GB'},
  {line_number:4,raw:'💵 R$ 4.500,00'}
];
const blocked=partitionCandidates({candidates:[stale],unresolved_ambiguities:[]},
  {supplierVerified:true});
assert.equal(blocked.auto.length,0);
assert(blocked.review[0].assessment.reasons.includes('MODEL_CONTEXT_CROSSES_PRODUCT_HEADER'));

const colors=buildQueue({filename:'synthetic-colors.txt',content:[
  'iPhone 18 Pro Max 512GB',
  '🟣 Bordô — R$ 11.599,99',
  'iPhone 17 Pro 256GB',
  '🟠 Laranja — R$ 6.699,99',
  'iPhone 17 Air 256GB',
  '🔵 Azul + ⚫ Preto — R$ 5.449,99 cada'
].join('\n')});
const found=colors.queue.candidates.map(x=>({
  model:x.interpreted_offer?.model?.label,
  color:x.interpreted_offer?.color,
  cents:x.interpreted_offer?.price?.amount_minor
}));
assert(found.some(x=>x.color==='Bordô'&&x.cents===1159999),
  'Bordô should be distinct from generic purple');
assert(found.some(x=>x.color==='Laranja'&&x.cents===669999),
  'Laranja should not disappear');
assert(found.some(x=>x.color==='Azul'&&x.cents===544999),
  'shared price: Azul must be a discrete offer');
assert(found.some(x=>x.color==='Preto'&&x.cents===544999),
  'shared price: Preto must be a discrete offer');
assert(!found.some(x=>String(x.color).includes('R$')),
  'color must never contain raw price text');
console.log('EXTERNAL_CALC_WHATSAPP_CONTEXT_GUARD_V0=PASS');
