'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {createHyperdriveOperatorProbe,STATIC_QUERY}=require('./hyperdrive-operator-probe');
const token='a_valid_non_public_operator_probe_token_1234567890123456789012';
const origin='https://upgrade.example.test';
const env={UPGRADE_DB_PROBE_ENABLED:'true',UPGRADE_DB_PROBE_TOKEN:token,UPGRADE_DB:{connectionString:'postgres://REDACTED@private.invalid/postgres'}};
const req=(secret=token,method='POST')=>new Request(origin+'/api/upgrade/v1/_db-probe',{method,headers:{authorization:'Bearer '+secret}});
const calls=[];
class FakeClient{
 constructor(opts){assert.equal(opts.connectionString,env.UPGRADE_DB.connectionString);}
 async connect(){calls.push('connect');}
 async query({text,values}){calls.push(text);assert.deepEqual(values,[]);if(text==='SELECT current_user AS db_role')return {rows:[{db_role:'upv1_cf_public'}]};if(text===STATIC_QUERY)return{rows:[]};throw Error('unknown query');}
 async end(){calls.push('end');}
}
const make=(overrides={},Client=FakeClient)=>createHyperdriveOperatorProbe({env:{...env,...overrides},Client,subtle:webcrypto.subtle});
test('disabled by default never accesses PostgreSQL',async()=>{calls.length=0;const r=await make({UPGRADE_DB_PROBE_ENABLED:'false'})(req());assert.equal(r.status,404);assert.deepEqual(calls,[]);});
test('no usable operator token or DB binding fails closed',async()=>{for(const e of [{UPGRADE_DB_PROBE_TOKEN:''},{UPGRADE_DB_PROBE_TOKEN:'short'},{UPGRADE_DB:null}])assert.equal((await make(e)(req())).status,404);});
test('GET and invalid bearer token fail closed without connecting',async()=>{calls.length=0;const p=make();assert.equal((await p(req(token,'GET'))).status,404);assert.equal((await p(req('not-the-secret-token-1234567890123456789012'))).status,404);assert.deepEqual(calls,[]);});
test('correct private token verifies database identity and read privilege only',async()=>{calls.length=0;const r=await make()(req());assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,code:'DB_CONNECTION_VERIFIED'});assert.deepEqual(calls,['connect','SELECT current_user AS db_role',STATIC_QUERY,'end']);assert.equal(r.headers.get('cache-control'),'no-store');});
test('incorrect database role cannot pass verification',async()=>{class Wrong extends FakeClient{async query({text}){return {rows:text==='SELECT current_user AS db_role'?[{db_role:'postgres'}]:[]};}}const r=await make({},Wrong)(req());assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false,code:'DB_CONNECTION_UNAVAILABLE'});});
test('db error leaks neither credentials nor SQL',async()=>{class Broken extends FakeClient{async connect(){throw Error('secret connection string');}}const r=await make({},Broken)(req());assert.equal(r.status,503);const body=await r.text();assert(!body.includes('secret'));assert(!body.includes('postgres:'));});
test('never treats missing catalog permission as success',async()=>{class Denied extends FakeClient{async query({text,values}){if(text===STATIC_QUERY)throw Error('permission denied');return super.query({text,values});}}const r=await make({},Denied)(req());assert.equal(r.status,503);});
