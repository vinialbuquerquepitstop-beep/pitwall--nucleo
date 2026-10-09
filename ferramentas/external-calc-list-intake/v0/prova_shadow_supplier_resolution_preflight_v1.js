'use strict';
const assert=require('node:assert/strict');
const {resolveShadowSupplier:check}=require('./shadow-supplier-resolution-preflight-v1');
const supplier={supplier_id:'sup-fixture-01',name:'Loja Exemplo Atacado',phone:'21999999999'};
const known=check({filename:'lista.txt',content:'LOJA EXEMPLO ATACADO\n📱 iPhone 17 Pro 256GB\nR$ 6850',suppliers:[supplier]});
assert.equal(known.state,'MATCHED_EXISTING_REVIEW_ONLY');
assert.equal(known.matched_supplier_id,supplier.supplier_id);
assert.equal(known.supplier_create_authorized,false);
assert.equal(known.c01_persistence_authorized,false);
assert.equal(known.auto_promotion_authorized,false);
const unknown=check({filename:'nova-lista.txt',content:'NOVA COMERCIO ATACADO\n(21) 98888-9999\n📱iPhone 16 128GB\nR$ 4500',suppliers:[]});
assert.equal(unknown.state,'UNKNOWN_REVIEW_ONLY');
assert.equal(unknown.matched_supplier_id,null);
assert.equal(unknown.supplier_create_authorized,false);
assert.equal(unknown.requires_human_review,true);
const category=check({filename:'produtos.txt',content:'IPHONE LACRADO\n17 PRO MAX 256GB\nR$ 7000',suppliers:[]});
assert.equal(category.matched_supplier_id,null);
assert.equal(category.supplier_create_authorized,false);
for(const r of [known,unknown,category]){
 assert.equal(r.release_status,'NO_GO');
 assert.equal(r.c01_persistence_authorized,false);
 assert.equal(r.auto_promotion_authorized,false);
}
assert.throws(()=>check({filename:'',content:'a',suppliers:[]}),/FILENAME_REQUIRED/);
assert.throws(()=>check({filename:'x',content:'',suppliers:[]}),/CONTENT_REQUIRED/);
assert.throws(()=>check({filename:'x',content:'text',suppliers:{}}),/SUPPLIER_CATALOG_INVALID/);
console.log('EXTERNAL_CALC_SHADOW_SUPPLIER_RESOLUTION_V1=PASS no_supplier_create=true');
