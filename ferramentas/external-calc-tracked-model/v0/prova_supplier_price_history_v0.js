'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('assert');

const sql=fs.readFileSync(path.join(__dirname,'../../../supabase/migrations/20261002014500_external_calc_supplier_price_history_v0.sql'),'utf8');

assert.match(sql,/extcalc_supplier_price_history_v0/);
assert.match(sql,/privado\.extcalc_product_membership_v0\(\)/);
assert.match(sql,/public\.extcalc_offer_revision/);
assert.match(sql,/domain_outcome = 'VALID'/);
assert.match(sql,/freshness_status = 'CURRENT'/);
assert.match(sql,/supplier_id/);
assert.match(sql,/current_rank/);
assert.match(sql,/delta_amount_minor/);
assert.match(sql,/delta_percent/);
assert.match(sql,/biggest_drop/);
assert.match(sql,/biggest_increase/);
assert.match(sql,/jsonb_agg[\s\S]*points/);
assert.doesNotMatch(sql,/extcalc_price_snapshot/);
assert.doesNotMatch(sql,/tenant_id\s*:=\s*p_/);

console.log('EXTERNAL_CALC_SUPPLIER_PRICE_HISTORY_V0=PASS');
