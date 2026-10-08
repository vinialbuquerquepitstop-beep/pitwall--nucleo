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
// Wider synthetic structure: 12 independent product blocks / 30 variants,
// modeled after but not copying the private supplier document.
const counts=[3,4,3,2,3,3,2,1,2,2,3,2];
const modelNames=['18 PRO MAX 512 LL/A','18 PRO MAX 256 LL/A','18 PRO 256 LL/A',
 '17 PRO MAX 512','17 PRO MAX 256 ESIM','17 PRO 256 LL/A',
 '17 256 JP/A','16 128 HN/A','15 128 HN/A',
 'MACBOOK PRO M5 MAX 36/2TB - 14','MACBOOK NEO 8/512','MACBOOK NEO 8/256'];
const mockLines=[];
for(let i=0;i<modelNames.length;i++){
 mockLines.push((i<9?'📳':'💻 ')+modelNames[i]);
 for(let v=0;v<counts[i];v++){
  mockLines.push('⚓️COR'+(v+1)+'/ 💲'+(i<9?'7.000':'5.000'));
 }
}
mockLines.push('🖱️MAGIC MOUSE','⚓️PRETO/ 💲500');
const coverage=parse(mockLines.join('\n'));
assert.equal(coverage.length,30,'12 distinct models should preserve 30 variants');
assert.equal(new Set(coverage.map(x=>x.modelLine)).size,12);
assert.ok(coverage.every(x=>x.autoPromote===false));
assert.ok(coverage.every(x=>x.price>=5000));
const shortQty=parse('📳15 128 HN/A\n⚓️PRETO / 💲3.600-1');
assert.equal(shortQty.length,1);
assert.equal(shortQty[0].quantity,1);
assert.equal(shortQty[0].price,3600);
// Standalone accessory prices are intentionally *not* interpreted by this
// prototype; they must be recovered only in a separately validated grammar.
assert.equal(parse('⌚️ULTRA PRETO 4 49MM\n💲6.000\n🖱️MAGIC MOUSE\n⚓️PRETO/ 💲500').length,0);
console.log('EXTERNAL_CALC_CAPTAIN_SCOPED_V1=PASS pairs=9 negatives=3 auto_promotion=false');
