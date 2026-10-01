'use strict';
const assert=require('assert');
const {buildQueue}=require('./list-intake-api');

const sample=[
  'Fornecedor Alpha — ATACADO',
  'iPhone 15 128GB',
  '🎨 Preto',
  '💵 R$ 4.500,00'
].join('\n');
const first=buildQueue({filename:'lista.txt',mime_type:'text/plain',content:sample});
const second=buildQueue({filename:'lista.txt',mime_type:'text/plain',content:sample});
assert.strictEqual(first.analysis_id,second.analysis_id);
assert.strictEqual(first.source_id,second.source_id);
assert.ok(first.queue.candidates.length>=1);

const real="*👑 REAL COMÉRCIO — ATACADO*\n\n📱*Celular — Lacrado*\n\niPhone 17 pro 256gb\n🎨 Prata\n💵 *R$6.850,00*\n\n📱PocoF8 Pro 5G 12/256GB\n🎨 Blue\n💵 *3280,00*\n\n📱PocoF8 Pro 5G 12/256GB\n🎨 Black\n💵 *3349,00*\n\n📱PocoF8 Pro 5G 12/512gb\n🎨 Blue\n💵 *3639,00*\n\n📱PocoF8 Ultra 5G 12/256gb\n🎨 Black\n💵 *4550,00*\n\n💻 MacBook — Lacrados\n\n💻 MacBook Neo a18 13\" 8/256gb\n🎨 Blush\n💵*4.785,00*\n\n💻 MacBook Air M5 13\" 16/512gb\n🎨 SkyBlue\n💵*8.450,00*\n\n💻 MacBook pro M5 14\" 16/512gb\n🎨 Meia noite\n💵*11.500,00*\n\n💻 MacBook pro M5 14\" 16/1tb\n🎨 Meia noite\n💵*12.649,00*\n\n💻 MacBook pro M5 14\" 24/1tb\n🎨 Meia noite\n💵*14.998,00*\n\n💻 MacBook pro M5 pro 14\" 24/1tb\n🎨 Preto espacial\n💵*16.289,00*\n\n💻 Mac Mini m4 16/512gb\n💵*6.050,00*\n\n⌚Watch lacrados\n\n⌚ Apple Watch SE 3 40mm GPS\n🎨 Starlight Aluminum Case com Sport Band Starligh\n*💵 R$  1.778,00*\n\n⌚ Garmin Forerunner 165\n🎨 Preto e Cinza Ardosia\n*💵 R$ 1.600,00*\n\n📲 iPad — Lacrados\n\n📲 iPad Air 11 M4 128GB Wi-Fi\n🎨 Cinza Espacial\n*💵 R$ 4798,00*\n\n📲 iPad Air 11 M4 128GB Wi-Fi\n🎨 Blue\n*💵 R$ 4950,00*\n\n📲 iPad Air 11 M4 128GB Wi-Fi\n🎨 Starligth\n*💵 R$ 4897,59*\n\n🎧 AirPods — Lacrado\n\n🎧 AirPods Pro 3ª Geração\n*💵 R$ 1.467,00*";
const parsed=buildQueue({filename:'real-comercio.txt',mime_type:'text/plain',content:real});
assert.strictEqual(parsed.queue.candidates.length,18,'lista REAL COMERCIO deve produzir 18 ofertas');
const offers=parsed.queue.candidates.map(c=>c.interpreted_offer);
assert.ok(offers.every(o=>o.model&&o.model.id&&o.model.label),'todo produto precisa de identidade');
assert.ok(offers.every(o=>o.price&&o.price.amount_minor>0&&o.price.currency==='BRL'),'todo produto precisa de preco BRL');
assert.ok(offers.some(o=>o.model.id==='iphone-17-pro-256'),'fallback deve preservar identidade do iPhone 17 Pro existente');
const labels=offers.map(o=>String(o.model.label||'').toLocaleLowerCase('pt-BR'));
const countLabel=(needle)=>labels.filter(label=>label.includes(needle.toLocaleLowerCase('pt-BR'))).length;
assert.strictEqual(countLabel('PocoF8 Pro 5G 12/256GB'),2);
assert.strictEqual(countLabel('PocoF8 Pro 5G 12/512gb'),1);
assert.strictEqual(countLabel('PocoF8 Ultra 5G 12/256gb'),1);
assert.ok(offers.some(o=>o.model.label.includes('MacBook pro M5 14" 24/1tb')&&o.capacity_gb===1024));
assert.strictEqual(countLabel('iPad Air 11 M4 128GB Wi-Fi'),3);
assert.strictEqual(countLabel('AirPods Pro 3ª Geração'),1);
console.log('EXTERNAL_CALC_LIST_INTAKE_V0=PASS candidates='+parsed.queue.candidates.length);
