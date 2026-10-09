'use strict';
const assert=require('node:assert/strict');
const {reconcileShadowSource:reconcile}=require('./shadow-source-reconciliation-v1');
const text=[
 '🎧 AirPods Pro Max 2USB-C','💲(2900)','❇️PURPLE',
 '📳18 PRO MAX 512 LL/A','⚓️BORDO / 💲12.000 - 1 pc',
 '🖱️MAGIC MOUSE','⚓️PRETO/ 💲500',
 '⌚️ULTRA PRETO 4 49MM','💲6.000'
].join('\n');
const r=reconcile(text);
assert.equal(r.contract_version,'external-calc-shadow-reconciliation/v1');
assert.ok(r.shadow_candidates>=4);
assert.equal(r.review_required,r.shadow_candidates);
assert.equal(r.auto_promoted,0);
assert.ok(r.candidates.some(x=>x.engine==='MEGA_SCOPED'&&x.amount_minor===290000));
assert.ok(r.candidates.some(x=>x.engine==='CAPTAIN_VARIANTS'&&x.amount_minor===1200000));
assert.ok(r.candidates.some(x=>x.engine==='CAPTAIN_STANDALONE'&&x.amount_minor===50000));
assert.ok(r.candidates.some(x=>x.engine==='CAPTAIN_STANDALONE'&&x.amount_minor===600000));
assert.ok(r.candidates.every(x=>x.autoPromote===false&&x.disposition==='REVIEW_REQUIRED'));
assert.ok(r.candidates.every(x=>Number.isInteger(x.modelLine)&&Number.isInteger(x.priceLine)&&x.source_fingerprint.length===64));
const noSource=reconcile('⚓️PRETO / 💲500');
assert.equal(noSource.shadow_candidates,0);
const deterministic=reconcile(text);
assert.deepStrictEqual(r.candidates,deterministic.candidates);
// These results are intentionally NOT persisted, and cannot be passed to C01 as valid candidates.
assert.ok(r.candidates.every(x=>x.reviewReasons.includes('SHADOW_PROTOTYPE_NOT_C01_VALIDATED')));
const shared=reconcile([
 '🎧 AirPods Pro Max 2USB-C',
 '💲(2900)',
 '❇️PURPLE',
 '❇️ORANGE',
 '❇️LILAS',
 '💲(3000)',
 '❇️STARLIGHT'
].join('\n'));
assert.equal(shared.shadow_candidates,4);
assert.equal(shared.shared_price_scope_lines,1);
assert.equal(shared.overlapping_price_lines,0);
assert.ok(shared.candidates.every(x=>!x.reviewReasons.includes('MULTIPLE_PARSERS_SAME_PRICE_LINE')));
assert.ok(shared.candidates.every(x=>x.disposition==='REVIEW_REQUIRED'&&x.autoPromote===false));
// Real Mega Storia labels are section decorations, not saleable variants.
const decorated=reconcile([
 '🥇 IPHONE LACRADO GARANTIA 1 ANO PELA APPLE 🥇',
 '❇️LANÇAMENTO❇️',
 ' IPhone 18 PRO 256 GB E-Sim',
 '💲(8000)',
 '❇️BLACK',
 '❇️❇️❇️❇️❇️',
 ' iPhone 15 128 GB',
 '💲(3650)',
 '❇️ Azul 💲(3650)',
 '❇️IPHONE CPO❇️'
].join('\n'));
assert.equal(decorated.non_offer_markers,3);
assert.equal(decorated.overlapping_price_lines,0);
assert.ok(decorated.candidates.every(c=>c.amount_minor!==null));
// A genuine price-less color is reviewable, not a phantom overlapping price.
const unpriced=reconcile('🎧 AirPods 4\n❇️BRANCO\n❇️PRETO');
assert.equal(unpriced.shadow_candidates,2);
assert.equal(unpriced.non_offer_markers,0);
assert.equal(unpriced.overlapping_price_lines,0);
assert.ok(unpriced.candidates.every(c=>c.amount_minor===null&&c.reviewReasons.includes('PRICE_MISSING')));
assert.ok(unpriced.candidates.every(c=>c.autoPromote===false));
console.log('EXTERNAL_CALC_SHADOW_RECONCILIATION_V1=PASS review_only=true');
