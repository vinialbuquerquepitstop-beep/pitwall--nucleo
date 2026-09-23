'use strict';
const assert=require('assert');
const fs=require('fs');

const runtime=fs.readFileSync('ferramentas/external-calc-runtime/v0/runtime.js','utf8');
const api=fs.readFileSync('ferramentas/external-calc-sales-product/v0/sales-product-api.js','utf8');
const service=fs.readFileSync('ferramentas/external-calc-sales-product/v0/sales-product-service.js','utf8');

assert.match(api,/PRODUCT_OPTIONS_PATH='\/api\/external-calc\/v0\/product-options'/);
assert.match(api,/path===PRODUCT_OPTIONS_PATH\?await service\.listProductOptions/);
assert.match(service,/async listProductOptions\(\{auth_user_id,command\}\)\{await ctx\(auth_user_id\);return listProductOptions\(await source\.loadCurrentOffers\(\),command\);\}/);
assert.match(runtime,/PRODUCT_OPTIONS_PATH, VARIANT_PATH, TRADE_IN_PATH, SIM_PATH/);
assert.match(runtime,/\[PRODUCT_OPTIONS_PATH, VARIANT_PATH, TRADE_IN_PATH, SIM_PATH\]\.includes\(url\.pathname\)/);

console.log('EXTERNAL_CALC_PRODUCT_OPTIONS_RUNTIME_WIRING=PASS');
