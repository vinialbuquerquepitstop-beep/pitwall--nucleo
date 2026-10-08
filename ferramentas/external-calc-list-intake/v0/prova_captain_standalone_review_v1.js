'use strict';
const assert=require('node:assert/strict');
const {reconcileStandaloneReview:reconcile}=require('./experimental-captain-standalone-review-v1');
const fixture=[
 '⌚️ULTRA PRETO 4 49MM','💲6.000',
 '🖱️MAGIC MOUSE','⚓️PRETO/ 💲500',
 '🖌️APPLE PINCEL (2 geração)','💲550',
 '🕶️ RAY-BAN META (Gen 2) RW4012','T 150 - S 50',
 '⚓️ SHINY COSMIC BLUE - L TRANSITIONS SAPPHIRE','💲3.000',
 '🕶️ RAY-BAN META (Gen 1) RW4006','T 155 - S 53',
 '⚓️ MATTE BLACK - L POLAR GRADIENT GRAPHITE','💲2.000',
 '⌚ SMART BRACELET','💲200',
 '🔌 FONTE USB-C 20W','✅ Certificada','Varejo',
 '💲85 a unidade','Atacado (acima de 10 peças - caixa fechada)',
 '💲70 a unidade','📦 Caixa com 10: 💲700',
 '🔌 CABO USB-C PARA USB-C (60W - 1M)','Varejo',
 '💲50 a unidade','Atacado (acima de 10 peças - caixa fechada)',
 '💲40 a unidade','📦 Caixa com 10: 💲400'
].join('\n');
const rows=reconcile(fixture);
// Magic Mouse line is intentionally not interpreted by the standalone-price grammar:
// an inline model/variant/price needs a different, separately verified rule.
assert.equal(rows.length,12);
assert.deepStrictEqual(rows.map(r=>r.amount_minor),
 [600000,50000,55000,300000,200000,20000,8500,7000,70000,5000,4000,40000]);
assert.deepStrictEqual(rows.slice(-6).map(r=>r.tier),
 ['RETAIL','WHOLESALE','BOX','RETAIL','WHOLESALE','BOX']);
assert.deepStrictEqual(rows.slice(-6).map(r=>r.units),[1,1,10,1,1,10]);
assert.equal(rows[1].product,'MAGIC MOUSE');
assert.equal(rows[1].variant,'PRETO');
assert.equal(rows[1].reviewReason,'INLINE_ACCESSORY_PRICE_REVIEW');
assert.equal(rows[1].amount_minor,50000);
assert.equal(rows[3].variant,'SHINY COSMIC BLUE - L TRANSITIONS SAPPHIRE');
assert.ok(rows.every(r=>r.review_required===true&&r.autoPromote===false));
assert.ok(rows.every(r=>r.productLine<r.priceLine));
const noBleed=reconcile('⌚️ULTRA PRETO 4 49MM\n💲6.000\n📳18 PRO MAX 512 LL/A\n💲12.000');
assert.equal(noBleed.length,1);
const disconnected=reconcile('💲6.000\n⌚️ULTRA PRETO 4 49MM');
assert.equal(disconnected.length,0);
assert.equal(reconcile('🖱️MAGIC MOUSE\n⚓️PRETO/ 💲500\n📳18 PRO MAX 512 LL/A\n⚓️AZUL / 💲12.000').length,1);
assert.equal(reconcile('⚓️PRETO/ 💲500\n🖱️MAGIC MOUSE').length,0);
console.log('EXTERNAL_CALC_CAPTAIN_STANDALONE_REVIEW_V1=PASS rows=12 negative=4 auto_promotion=false');
