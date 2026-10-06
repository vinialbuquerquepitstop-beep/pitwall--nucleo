'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('assert');

const sql=fs.readFileSync(
  path.join(__dirname,'../../../supabase/migrations/20261002160000_external_calc_movement_feed_v0.sql'),
  'utf8'
);
const correction=fs.readFileSync(
  path.join(__dirname,'../../../supabase/migrations/20261005211500_external_calc_movement_feed_coalesce_fix_v0.sql'),
  'utf8'
);

assert.match(sql,/extcalc_movement_feed_v0/);
assert.match(sql,/privado\.extcalc_product_membership_v0\(\)/);
assert.match(sql,/public\.extcalc_offer_revision/);
assert.match(sql,/domain_outcome = 'VALID'/);
assert.match(sql,/freshness_status = 'CURRENT'/);
assert.match(sql,/contract_id = 'C02'/);
assert.match(sql,/contract_id = 'C04'/);
assert.match(sql,/contract_id = 'C05'/);
assert.match(sql,/delta_amount_minor/);
assert.match(sql,/delta_percent/);
assert.match(sql,/direction/);
assert.match(sql,/normal_sale_price/);
assert.match(sql,/promo_price/);
assert.match(sql,/price_signal/);
assert.doesNotMatch(sql,/tenant_id\s*:=\s*p_/);
assert.doesNotMatch(sql,/CHEAP.*then.*true/i);
assert.doesNotMatch(sql,/opportunity.*boolean/i);
assert.match(correction,/create or replace function public\.extcalc_movement_feed_v0/);
assert.doesNotMatch(correction,/pg_catalog\.coalesce/);
assert.match(correction,/coalesce\(/);

console.log('EXTERNAL_CALC_MOVEMENT_FEED_V0=PASS coalesce-fix=true');
