// G13 isolated real HTTPS loopback + disposable PG17 integration proof.
// NOT a production server. It requires PCH_G13_DISPOSABLE=true and a local
// PG socket; certificate is short-lived and trusted only in test process.
import assert from 'node:assert/strict';
import https from 'node:https';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
if(process.env.PCH_G13_DISPOSABLE!=='true')throw Error('DISPOSABLE_ONLY');
const {Pool}=require('pg');
const {createPchInternalAdapter}=require('./internal-http-adapter-shadow.js');
const {createPostgresPchReceiverRepository}=require('./postgres-receiver-shadow.js');
const {createPgNonceLedger}=require('./pg-nonce-ledger-shadow.js');
const {createPchCalcTransport}=await import(process.env.PCH_G13_CLIENT_MODULE);
const pgPool=new Pool({host:'/tmp',port:Number(process.env.PCH_PG_PORT||55439),database:'postgres',user:'pch_test_login',max:12});
const repo=createPostgresPchReceiverRepository({pool:pgPool});
const ledger=createPgNonceLedger({pool:pgPool});
const tenantId='11111111-1111-4111-8111-111111111111';
const keyId='pch-g13-loopback',secret=new Uint8Array(32).fill(68);
const keyring={getKeyById:id=>id===keyId?{enabled:true,producer:'PCH',tenantId,permissions:['INGRESS_WRITE'],secret:Buffer.from(secret)}:null};
const handle=createPchInternalAdapter({keyring,nonceLedger:ledger,repository:repo});
let faultOnce=true,firstCommitted=false,serverRequests=0;const kinds=[];
const server=https.createServer({key:fs.readFileSync(process.env.PCH_G13_TLS_KEY),cert:fs.readFileSync(process.env.PCH_G13_TLS_CERT)},async(req,res)=>{
 serverRequests++;kinds.push(req.url);
 let raw='';
 try {
  for await(const chunk of req){
   raw+=chunk;
   if(Buffer.byteLength(raw)>2100000)throw Error('BODY_TOO_LARGE');
  }
  const result=await handle({method:req.method,path:req.url,headers:req.headers,body:raw});
  if(req.url==='/internal/pch/v0/inbox'&&result.status===200&&faultOnce){
   faultOnce=false;firstCommitted=true;req.socket.destroy();
   return;
  }
  res.writeHead(result.status,result.headers);res.end(result.body);
 }catch(err){if(!res.headersSent&&!res.destroyed){res.writeHead(503);res.end('fault')}}
});
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name)};
const event={eventId:'g13-event-1',tenantId,providerScope:'meta-private',providerMessageId:'wamid.g13',sourceKind:'META_PRIVATE',sourceId:'supplier-private',senderId:'supplier-id',contentSha256:'a'.repeat(64),encryptedPayloadRef:'encrypted:ref',occurredAt:'2026-11-09T15:00:00Z'};
let counter=0;
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const port=server.address().port;
 const client=createPchCalcTransport({baseUrl:'https://127.0.0.1:'+port,tenantId,keyId,secret,fetchImpl:fetch,randomBytes:()=>new Uint8Array(16).fill(++counter),now:()=>Date.now()});
 const first=await client.dispatchAndReconcile(event);
 check('real HTTPS lost-ACK outcome not falsely confirmed',()=>{assert.equal(first.decision,'RECONCILE');assert.equal(firstCommitted,true)});
 const recovered=await client.reconcile(event);
 check('real HTTPS signed status lookup recovers DB receipt',()=>{assert.equal(recovered.decision,'CONFIRM');assert.match(recovered.receipt.receiptId,/^[a-f0-9-]{36}$/)});
 const again=await client.dispatchAndReconcile(event);
 check('real HTTPS duplicate reuses the same durable receipt',()=>{assert.equal(again.decision,'CONFIRM');assert.equal(again.receipt.receiptId,recovered.receipt.receiptId)});
 const changed=await client.dispatchAndReconcile({...event,senderId:'mutated'});
 check('real HTTPS conflicting immutable identity blocked',()=>assert.equal(changed.decision,'HOLD'));
 const other=await client.dispatchAndReconcile({...event,tenantId:'22222222-2222-4222-8222-222222222222'}).catch(e=>e);
 check('client blocks cross-tenant event before network',()=>{assert.match(other.message,/TENANT_MISMATCH/);assert.equal(serverRequests,5)});
 const c=await pgPool.connect();try{
  await c.query('BEGIN READ ONLY');await c.query("SELECT set_config('app.pch_tenant_id', $1, true)",[tenantId]);
  const r=await c.query("SELECT count(*)::int AS n FROM extcalc_pch_shadow.inbox WHERE event_id=$1",[event.eventId]);
  check('exactly one durable inbox row after lost ACK and retry',()=>assert.equal(r.rows[0].n,1));
  const nonces=await c.query('SELECT count(*)::int AS n FROM extcalc_pch_shadow.nonce_ledger WHERE key_id=$1',[keyId]);
  check('every real HTTPS request consumed a unique durable nonce',()=>assert.equal(nonces.rows[0].n,serverRequests));
  await c.query('COMMIT');
 }finally{c.release()}
 console.log('G13_PASS='+passed+' G13_REQUESTS='+serverRequests);
}catch(e){console.error('G13_FAIL',e.stack||e);process.exitCode=1}
finally{await new Promise(r=>server.close(r));await pgPool.end()}
