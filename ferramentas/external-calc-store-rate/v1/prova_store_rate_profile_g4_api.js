'use strict';
const assert=require('assert');
const {createStoreRateQuoteApiV0,QUOTE_PATH}=require('./store-rate-quote-api');
let seen=null;
const api=createStoreRateQuoteApiV0({
 authenticate:async()=>({subject:'verified-user',can_execute_external_calc:true}),
 resolver:{async resolveQuote(args){seen=args;return {tenant_id:'server-tenant',rate_profile_id:'server-profile',total:{amount_minor:500000,currency:'BRL'}};}}
});
(async()=>{
 const good=await api.handle({method:'POST',path:QUOTE_PATH,body:JSON.stringify({analysis_id:'a',offer_id:'o',offer_revision:1,installment_count:12})});
 assert.strictEqual(good.status,200);assert.strictEqual(seen.auth_user_id,'verified-user');assert.strictEqual(seen.command.tenant_id,undefined);
 const unauth=createStoreRateQuoteApiV0({authenticate:async()=>null,resolver:{resolveQuote(){throw new Error('never');}}});
 assert.strictEqual((await unauth.handle({method:'POST',path:QUOTE_PATH,body:'{}'})).status,401);
 const forbidden=createStoreRateQuoteApiV0({authenticate:async()=>({subject:'seller',can_execute_external_calc:false}),resolver:{resolveQuote(){throw new Error('never');}}});
 assert.strictEqual((await forbidden.handle({method:'POST',path:QUOTE_PATH,body:'{}'})).status,403);
 for(const [code,status] of [['RATE_PROFILE_NOT_CONFIGURED',422],['INSTALLMENT_RATE_NOT_CONFIGURED',422],['RATE_PROFILE_CONFLICT',409],['QUOTE_RECALCULATION_REQUIRED',409],['RATE_PROFILE_INVALID',400]]){
  const x=createStoreRateQuoteApiV0({authenticate:async()=>({subject:'u',can_execute_external_calc:true}),resolver:{async resolveQuote(){const e=new Error(code);e.code=code;throw e;}}});
  assert.strictEqual((await x.handle({method:'POST',path:QUOTE_PATH,body:'{}'})).status,status);
 }
 console.log('EXTERNAL_CALC_STORE_RATE_PROFILE_G4_API=PASS');
})().catch(e=>{console.error(e);process.exit(1);});
