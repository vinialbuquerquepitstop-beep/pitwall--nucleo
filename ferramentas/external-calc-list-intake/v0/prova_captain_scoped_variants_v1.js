'use strict';
const assert=require('node:assert/strict');
const {extractCaptainScopedVariants:parse}=require('./experimental-captain-scoped-variants-v1');
const sample=[
 '📳18 PRO MAX 512 LL/A',
 '⚓️BORDO / 💲12.000 - 1 pc',
 '⚓️GLACIER/ 💲10.500',
 '⚓️PRETO/ 💲10.200',
 '📳18 PRO MAX 256 LL/A',
 '⚓️BURGUNDY/ 💲10.150',
 '⚓️GLACIER/ 💲9.300',
 '⚓️BLACK / 💲8.700',
 '⚓️SILVER/ 💲8.950',
 '🚨Acessorios, MacBook, iPad, Magic Mouse',
 '🖱️MAGIC MOUSE',
 '⚓️PRETO/ 💲500',
 '💻 MACBOOK NEO 8/256',
 '⚓️AZUL / 💲4.500',
 '⚓️AMARELO/ 💲4.400',
 '🔌 CABO USB-C PARA USB-C',
 '⚓️BRANCO/ 💲120'
].join('\n');
const rows=parse(sample);
assert.equal(rows.length,9);
assert.deepStrictEqual(rows.map(r=>r.price),[12000,10500,10200,10150,9300,8700,8950,4500,4400]);
assert.deepStrictEqual(rows.slice(0,3).map(r=>r.color),['BORDO','GLACIER','PRETO']);
assert.deepStrictEqual(rows.slice(0,3).map(r=>r.model),Array(3).fill('18 PRO MAX 512 LL/A'));
assert.ok(rows.slice(3,7).every(r=>r.model==='18 PRO MAX 256 LL/A'));
assert.ok(rows.slice(7).every(r=>r.model==='MACBOOK NEO 8/256'));
assert.equal(rows[0].quantity,1);
assert.ok(rows.every(r=>r.autoPromote===false));
assert.ok(rows.every(r=>r.modelLine<r.variantLine && r.variantLine===r.priceLine));
assert.equal(parse('📳18 PRO MAX 512 LL/A\n🖱️MAGIC MOUSE\n⚓️PRETO/ 💲500').length,0);
assert.equal(parse('⚓️PRETO/ 💲500\n📳18 PRO MAX 512 LL/A\n⚓️PRETO/ 💲10.200').length,1);
assert.equal(parse('📳18 PRO MAX 512 LL/A\n⚓️PRETO/ 💲500\n📳OTHER PRODUCT\n⚓️AZUL/ 💲350').length,1);
console.log('EXTERNAL_CALC_CAPTAIN_SCOPED_V1=PASS pairs=9 negatives=3 auto_promotion=false');
