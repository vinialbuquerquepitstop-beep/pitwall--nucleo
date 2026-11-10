'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {createPrivateHyperdriveProbe,SQL_ROLE,SQL_READ}=require('./upgrade-hyperdrive-probe.cjs');
const token='Correct_Credential_1234567890123456789012345678';
const connectionString='postgres://secret:test@db.example/postgres';
const env={UPGRADE_DB_PROBE_ENABLED:'true',UPGRADE_DB_PROBE_TOKEN:token,UPGRADE_DB:{connectionString}};
let calls=[];
class Db{
 constructor(config){assert.equal(config.connectionString,connectionString);}
 async connect(){calls.push('connect');}
 async query({text,values}){calls.push(text);assert.deepEqual(values,[]);return text===SQL_ROLE?{rows:[{db_role:'upv1_cf_public'}]}:{rows:[]};}
 async end(){calls.push('end');}
}
const create=(change={},Client=Db)=>createPrivateHyperdriveProbe({env:{...env,...change},Client,subtle:webcrypto.subtle});
const req=(v=token,method='POST')=>new Request('https://example.test/api/upgrade/v1/_db-probe',{method,headers:{Authorization:'Bearer '+v}});
test('probe disabled by default and refuses GET',async()=>{
 calls=[];assert.equal((await create({UPGRADE_DB_PROBE_ENABLED:'false'})(req())).status,404);
 assert.equal((await create()(req(token,'GET'))).status,404);assert.deepEqual(calls,[]);
});
test('absent or wrong credential does not connect',async()=>{
 calls=[];assert.equal((await create({UPGRADE_DB_PROBE_TOKEN:undefined})(req())).status,404);
 assert.equal((await create()(req('Wrong_Credential_1234567890123456789012345678'))).status,404);
 assert.deepEqual(calls,[]);
});
test('valid operator diagnostic performs exactly two read-only queries',async()=>{
 calls=[];const r=await create()(req());assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{ok:true,code:'DB_CONNECTION_VERIFIED'});
 assert.deepEqual(calls,['connect',SQL_ROLE,SQL_READ,'end']);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('wrong role and SQL failures are sanitized',async()=>{
 class Wrong extends Db{async query(){return {rows:[{db_role:'postgres'}]};}}
 const wrong=await create({},Wrong)(req());assert.equal(wrong.status,503);
 class Fault extends Db{async connect(){throw Error('database password secret');}}
 const denied=await create({},Fault)(req());assert.equal(denied.status,503);
 const body=await denied.text();assert(!body.includes('password'));assert(!body.includes('secret'));
});
test('authenticated operator sees sanitized actionable binding/driver errors',async()=>{
 const noBinding=await create({UPGRADE_DB:null})(req());
 assert.equal(noBinding.status,503);
 assert.deepEqual(await noBinding.json(),{ok:false,code:'DB_BINDING_UNAVAILABLE'});
 const unavailable=await createPrivateHyperdriveProbe({env,Client:null,subtle:webcrypto.subtle})(req());
 assert.equal(unavailable.status,503);
 assert.deepEqual(await unavailable.json(),{ok:false,code:'DB_DRIVER_UNAVAILABLE'});
});
test('missing binding is not disclosed without correct operator token',async()=>{
 calls=[];
 const denied=await create({UPGRADE_DB:null})(req('Wrong_Credential_1234567890123456789012345678'));
 assert.equal(denied.status,404);
 assert.deepEqual(await denied.json(),{ok:false,code:'NOT_FOUND'});
 assert.deepEqual(calls,[]);
});
test('invalid secret or disabled feature remain opaque',async()=>{
 assert.equal((await create({UPGRADE_DB_PROBE_TOKEN:'bad'})(req())).status,404);
 assert.equal((await create({UPGRADE_DB_PROBE_ENABLED:'false',UPGRADE_DB:null})(req())).status,404);
});
