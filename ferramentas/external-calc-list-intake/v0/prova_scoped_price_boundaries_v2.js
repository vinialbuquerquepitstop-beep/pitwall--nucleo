'use strict';
const assert=require('node:assert/strict');
const {extractScopedRows:parse}=require('./experimental-scoped-price-boundaries-v2');
const src=[
 '🎧 AirPods Pro Max 2USB-C','💲(2900)','❇️PURPLE','❇️ORANGE','❇️LILAS',
 '💲(3000)','❇️STARLIGHT','❇️MIDNIGHT',
 '🎧 AirPods 4','💲(850)','❇️Branco',
 '🔌 Fonte USB-C','💲(130)','❇️Branco',
 '💻 MACBOOK AIR (M5) 13 16/512 GB','💲(9100)','❇️Midnight',
 '❇️Starlight 💲(8850)','❇️AZUL 💲(8850)','❇️SILVER 💲(8950)'
].join('\n');
const rows=parse(src);
assert.deepStrictEqual(rows.slice(0,5).map(x=>x.price),[2900,2900,2900,3000,3000]);
assert.deepStrictEqual(rows.slice(5).map(x=>x.price),[850,130,9100,8850,8850,8950]);
assert.equal(rows.length,11);
assert.ok(rows.every(x=>x.autoPromote===false));
assert.ok(rows.every(x=>Number.isInteger(x.modelLine)&&Number.isInteger(x.variantLine)&&Number.isInteger(x.priceLine)));
const noPrice=parse('🎧 AirPods 4\n❇️Branco');
assert.equal(noPrice[0].price,null);assert.equal(noPrice[0].needsReview,true);
const blockedSection=parse('🎧 AirPods 4\n💲(850)\n❇️Branco\n🥇 Acessórios Apple Garantia\n💲(150)\n❇️Azul');
assert.equal(blockedSection.length,1);
const reset=parse('💻 MACBOOK AIR M5 13 16/512GB\n💲(9100)\n❇️Midnight\n💻 MACBOOK NEO 8/512GB\n❇️Silver');
assert.deepStrictEqual(reset.map(x=>x.price),[9100,null]);
const noContact=parse('📲 Contato 21999990000\n💲(9000)\n❇️Branco');
assert.equal(noContact.length,0);
console.log('EXTERNAL_CALC_SCOPED_BOUNDARIES_V2=PASS pairs=11 negative=4 no_auto_promotion=true');
