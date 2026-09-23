'use strict';
const assert=require('assert');
const {createSalesProductApiV0,PRODUCT_OPTIONS_PATH,VARIANT_PATH,TRADE_IN_PATH,SIM_PATH}=require('./sales-product-api');
let seen=[];
const api=createSalesProductApiV0({authenticate:async()=>({subject:'seller'}),service:{async listProductOptions(x){seen.push(['o',x]);return {ok:true}},async resolveVariant(x){seen.push(['v',x]);return {ok:true}},async estimateTradeIn(x){seen.push(['t',x]);return {ok:true}},async simulateSale(x){seen.push(['s',x]);return {ok:true}}}});
(async()=>{for(const p of [PRODUCT_OPTIONS_PATH,VARIANT_PATH,TRADE_IN_PATH,SIM_PATH])assert.strictEqual((await api.handle({method:'POST',path:p,body:'{}'})).status,200);assert.strictEqual(seen.every(x=>x[1].auth_user_id==='seller'),true);
const unauth=createSalesProductApiV0({authenticate:async()=>null,service:{}});assert.strictEqual((await unauth.handle({method:'POST',path:PRODUCT_OPTIONS_PATH,body:'{}'})).status,401);
for(const [code,status] of [['VARIANT_COLOR_REQUIRED',409],['TRADE_IN_POLICY_NOT_CONFIGURED',422],['TRADE_IN_NO_ELIGIBLE_OFFER',404],['TRADE_IN_ESTIMATE_STALE',409],['SALE_AMOUNT_INVALID',400]]){const x=createSalesProductApiV0({authenticate:async()=>({subject:'u'}),service:{async resolveVariant(){let e=new Error(code);e.code=code;throw e},async estimateTradeIn(){let e=new Error(code);e.code=code;throw e},async simulateSale(){let e=new Error(code);e.code=code;throw e}}});const p=code.startsWith('VARIANT')?VARIANT_PATH:code.startsWith('TRADE_IN')?TRADE_IN_PATH:SIM_PATH;assert.strictEqual((await x.handle({method:'POST',path:p,body:'{}'})).status,status);}
console.log('EXTERNAL_CALC_SALES_PRODUCT_T04_API=PASS');})().catch(e=>{console.error(e);process.exit(1)});
