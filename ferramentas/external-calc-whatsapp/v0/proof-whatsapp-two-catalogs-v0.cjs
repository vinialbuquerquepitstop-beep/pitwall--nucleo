'use strict';
// Synthetic format fixtures only. No real supplier price list or invitation link.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {normalizeSupervised} = require('./whatsapp-supervised-source-adapter-v0.cjs');
const catalogNew = ['*TABELA ATUALIZADA - 28/10*','*IPHONES LACRADOS*','📲 IPHONE 17 256GB','🔵azul/⚫️preto *R$5.111,11*','📲 IPHONE 16 512GB','nao ativado / caixa aberta','R$4.222,22','📲 IPHONE 16 128GB (CPO)','R$3.333,33','🎧 FONES 1ª linha','*$99,90*'].join('\n');
const catalogUsed = ['*TABELA ATUALIZADA - 28/10*','*IPHONES SEMINOVOS*','GARANTIA 30 DIAS','BATERIA SEM GARANTIA','📲 IPHONE 15 PRO 256GB 🇺🇸','🔋89% à 95%','R$2.777,77','📲 IPHONE 14 PRO 128GB','*$R$2.499,99*'].join('\n');
const loose = '*HOJE* iPhone 16 128GB, R$3.101,01, duas unidades';
function source(intake_id, original_text, supplier_id='supplier-demo', group_alias='group-demo') {
 return normalizeSupervised({trustedContext:{tenant_id:'tenant-demo',operator_id:'operator-demo',intake_id,captured_at:'2026-10-28T19:00:00Z',authorized_suppliers:{'supplier-demo':'tenant-demo'},authorized_groups:{'group-demo':'tenant-demo'}},submission:{supplier_id,group_alias,capture_method:'operator_import',original_text}});
}
let n=0;function check(title,fn){fn();n++;console.log('PASS '+title);}
check('S01 two catalogs yield two source events',()=>{assert.equal(source('new',catalogNew).events.length,1);assert.equal(source('used',catalogUsed).events.length,1);});
check('S02 same supplier date does not merge identities',()=>{assert.notEqual(source('new',catalogNew).events[0].source_event_key,source('used',catalogUsed).events[0].source_event_key);});
check('S03 sealed list preserves CPO and open-box exceptions',()=>{const t=source('new',catalogNew).events[0].original_text;assert.equal(t,catalogNew);assert.ok(t.includes('(CPO)')&&t.includes('caixa aberta'));});
check('S04 used list preserves battery and warranty qualifiers',()=>{const t=source('used',catalogUsed).events[0].original_text;assert.ok(t.includes('89% à 95%')&&t.includes('BATERIA SEM GARANTIA'));});
check('S05 colors and per-color price notation preserved',()=>{assert.ok(source('new',catalogNew).events[0].original_text.includes('🔵azul/⚫️preto *R$5.111,11*'));});
check('S06 malformed currency syntax not silently repaired',()=>{assert.ok(source('used',catalogUsed).events[0].original_text.includes('*$R$2.499,99*'));});
check('S07 standalone update has its own identity',()=>{assert.notEqual(source('loose',loose).events[0].source_event_key,source('new',catalogNew).events[0].source_event_key);});
check('S08 same intake id creates same key, not durable dedup',()=>{assert.equal(source('one',loose).events[0].source_event_key,source('one',loose).events[0].source_event_key);});
check('S09 review only, no offer authority or price parsing',()=>{for(const [id,t] of [['new',catalogNew],['used',catalogUsed],['loose',loose]]){const e=source(id,t).events[0];assert.equal(e.review_state,'REVIEW_REQUIRED');assert.ok(!('offer_id' in e)&&!('price' in e));}});
check('S10 unknown group rejected without text leakage',()=>{const r=source('new',catalogNew,'supplier-demo','not-approved');assert.equal(r.ok,false);assert.deepEqual(r.events,[]);assert.ok(!JSON.stringify(r).includes('IPHONE'));});
check('S11 raw content hash matches exact UTF-8 bytes',()=>{const e=source('used',catalogUsed).events[0];assert.equal(e.original_sha256,'sha256:'+crypto.createHash('sha256').update(catalogUsed,'utf8').digest('hex'));});
check('S12 synthetic fixtures contain no real WhatsApp invite link',()=>{for(const t of [catalogNew,catalogUsed,loose])assert.ok(!/chat\.whatsapp\.com\//i.test(t));});
console.log('WM02 TWO-CATALOG SYNTHETIC PROOF PASS '+n+'/'+n);
