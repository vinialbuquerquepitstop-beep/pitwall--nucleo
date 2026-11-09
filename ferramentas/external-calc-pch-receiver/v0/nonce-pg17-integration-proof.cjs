'use strict';
// Explicitly gated disposable database proof. Not part of CI or runtime.
if(process.env.PCH_DISPOSABLE_PG17!=='true')throw Error('PCH_DISPOSABLE_PG17_REQUIRED');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {createPgNonceLedger}=require('./pg-nonce-ledger-shadow');
const {authenticateOnce,signRequestForTest,REQUEST_PATH}=require('./m2m-auth-shadow');
const tenantId='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const pool=new Pool({host:process.env.PCH_PG_HOST||'/tmp',port:Number(process.env.PCH_PG_PORT||55439),user:'pch_test_login',database:'postgres',max:20});
const ledger=createPgNonceLedger({pool});
const current=Date.now(),expiresAt=current+300000;
let passed=0;
async function check(name,fn){try{await fn();passed++;console.log('PASS',name)}catch(err){console.error('FAIL',name,err.code||'',err.message);process.exitCode=1}}
const nonce=(n)=>n.toString(16).padStart(32,'0');
const item=(i,t=tenantId)=>({tenantId:t,keyId:'key-g11',nonce:nonce(i),expiresAt});
(async()=>{
 await check('PG17 first nonce reservation commits',async()=>assert.equal(await ledger.reserveOnce(item(1)),true));
 await check('PG17 same nonce refuses replay',async()=>assert.equal(await ledger.reserveOnce(item(1)),false));
 await check('PG17 twenty concurrent identical nonces result in one winner',async()=>{const xs=await Promise.all(Array.from({length:20},()=>ledger.reserveOnce(item(2))));assert.equal(xs.filter(Boolean).length,1)});
 await check('PG17 one key with 20 distinct nonces all succeed',async()=>{const xs=await Promise.all(Array.from({length:20},(_,i)=>ledger.reserveOnce(item(i+100))));assert.equal(xs.filter(Boolean).length,20)});
 await check('PG17 no tenant binding cannot view ledger',async()=>{const r=await pool.query('SELECT count(*)::int AS n FROM extcalc_pch_shadow.nonce_ledger');assert.equal(r.rows[0].n,0)});
 await check('PG17 nonces cannot be updated/deleted by inbox role',async()=>{await assert.rejects(pool.query('DELETE FROM extcalc_pch_shadow.nonce_ledger'),/permission denied/);await assert.rejects(pool.query('UPDATE extcalc_pch_shadow.nonce_ledger SET key_id=key_id'),/permission denied/)});
 await check('PG17 independent tenant nonce key requires distinct key ID',async()=>{assert.equal(await ledger.reserveOnce({...item(3,other),keyId:'key-g11-other'}),true)});
 await check('PG17 same key ID+nonce cannot be claimed across tenants',async()=>{assert.equal(await ledger.reserveOnce({...item(1,other)}),false)});
 await check('PG17 concurrent same HMAC nonce authorizes exactly once',async()=>{
  const secret=Buffer.alloc(32,3),keyId='pch-key-g11',body=JSON.stringify({tenantId,eventId:'evt'});
  const n=nonce(700),headers=signRequestForTest({keyId,tenantId,secret,body,timestamp:current,nonce:n});
  const request={method:'POST',path:REQUEST_PATH,headers,body,nowMs:current,keyring:{getKeyById:id=>id===keyId?{enabled:true,producer:'PCH',tenantId,permissions:['INGRESS_WRITE'],secret}:null}};
  const results=await Promise.allSettled(Array.from({length:12},()=>authenticateOnce(request,{nonceLedger:ledger})));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected').length,11);
 });
 await pool.end();console.log('TOTAL',passed,'FAIL',process.exitCode===1?'YES':'NO');if(process.exitCode)process.exit(process.exitCode);
})().catch(async err=>{console.error(err);await pool.end();process.exit(1)});
