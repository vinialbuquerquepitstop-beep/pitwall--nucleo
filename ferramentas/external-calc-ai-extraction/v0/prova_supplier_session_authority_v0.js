'use strict';
const assert=require('node:assert/strict');
const {checkSupplierAuthority}=require('./supplier-session-authority');
const ID='55555555-5555-4555-8555-555555555555';
let calls=0;
const env={SUPABASE_URL:'https://supabase.invalid',SUPABASE_ANON_KEY:'anon-key'};
(async()=>{
 const allowed=async(url,opts)=>{calls++;assert.match(url,/extcalc_supplier\?select=supplier_id,name&supplier_id=eq\./);assert.equal(opts.headers.authorization,'Bearer owner');assert.equal(opts.method,'GET');return {ok:true,json:async()=>[{supplier_id:ID,name:'Quality'}]}};
 const ok=await checkSupplierAuthority({env,token:'owner',supplier_id:ID,fetchImpl:allowed});
 assert.equal(ok.supplier_id,ID);assert.equal(ok.authority,'RLS_AUTHENTICATED_READ');assert.equal(ok.write_allowed,false);
 await assert.rejects(checkSupplierAuthority({env,token:'owner',supplier_id:'invalid',fetchImpl:allowed}),e=>e.code==='AI_SUPPLIER_ID_INVALID');
 await assert.rejects(checkSupplierAuthority({env,token:'owner',supplier_id:ID,fetchImpl:async()=>({ok:true,json:async()=>[]})}),e=>e.code==='AI_SUPPLIER_FORBIDDEN');
 await assert.rejects(checkSupplierAuthority({env,token:'owner',supplier_id:ID,fetchImpl:async()=>({ok:true,json:async()=>[{supplier_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Other'}]})}),e=>e.code==='AI_SUPPLIER_FORBIDDEN');
 await assert.rejects(checkSupplierAuthority({env,token:'owner',supplier_id:ID,fetchImpl:async()=>({ok:false,status:403})}),e=>e.code==='AI_SUPPLIER_AUTH_UNAVAILABLE');
 await assert.rejects(checkSupplierAuthority({env,token:null,supplier_id:ID,fetchImpl:allowed}),e=>e.code==='UNAUTHENTICATED');
 assert.equal(calls,1);
 console.log('AI_SUPPLIER_SESSION_AUTHORITY=PASS',8);
})().catch(e=>{console.error(e);process.exitCode=1});
