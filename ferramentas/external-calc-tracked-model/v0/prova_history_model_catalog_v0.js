'use strict';

const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(__dirname, '../../../supabase/migrations/20261002173000_external_calc_history_model_catalog_v0.sql'),
  'utf8',
);

const required = [
  /extcalc_history_model_catalog_v0/,
  /privado\.extcalc_product_membership_v0\(\)/,
  /r\.tenant_id = m\.tenant_id/,
  /domain_outcome = 'VALID'/,
  /execution_status' = 'SUCCEEDED'/,
  /catalog_version', 'external-calc-history-model-catalog\/v0'/,
  /supplier_count/,
  /observation_count/,
  /current_lowest_price/,
  /revoke all on function public\.extcalc_history_model_catalog_v0\(text,integer\)/,
  /grant execute on function public\.extcalc_history_model_catalog_v0\(text,integer\)\s+to authenticated/,
];

for (const rule of required) {
  if (!rule.test(migration)) {
    throw new Error('Missing history model catalog invariant: ' + rule);
  }
}

if (/grant execute[\s\S]*to anon/i.test(migration)) {
  throw new Error('History model catalog must not be executable by anon');
}

console.log('EXTERNAL_CALC_HISTORY_MODEL_CATALOG_V0=PASS');
