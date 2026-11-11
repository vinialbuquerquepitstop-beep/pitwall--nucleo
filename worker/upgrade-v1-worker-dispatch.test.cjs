'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createUpgradeV1HyperdriveApplication } = require('../ferramentas/external-calc-public-upgrade/v0/upgrade-hyperdrive-composition');
const { SQL } = require('../ferramentas/external-calc-public-upgrade/v0/approved-catalog-repository');
const { INSERT } = require('../ferramentas/external-calc-public-upgrade/v0/upgrade-capture-repository');

// Run the Worker dispatcher source itself. Replace only external module bindings
// (no source-level route replacement, no network and no real DB writes).
const source = fs.readFileSync(path.join(__dirname, 'external-calc-worker.mjs'), 'utf8');
const wrangler = fs.readFileSync(path.join(__dirname, '../wrangler.jsonc'), 'utf8');
const entrypoint = source.replace(/^import\s+[^;]+;\s*$/gm, '').replace(/export\s+default\s*\{/, 'return {');
const origin = 'https://flat-resonance-09ba.pitstopimports.workers.dev';
const tenant = '00000000-0000-0000-0000-000000000001';
const key = 'd71c03a5-c98d-4fe9-ad8c-ea4c20d18591';
const id = '930e39e4-6ee4-414a-861a-99c318bf40a6';
const selection = { desired:{model:'iPhone 17 Pro',capacity:'256 GB',condition:'lacrado'},
  trade_in:{model:'iPhone 14 Pro',capacity:'128 GB',condition:'bom'},installments:12 };
const env = { UPGRADE_PUBLIC_ENABLED:'true', UPGRADE_EXPECTED_ORIGIN:origin,
  UPGRADE_TENANT_ID:tenant, UPGRADE_DB:{connectionString:'postgres://fake:fake@example.invalid/db'} };

function harness() {
  const calls = [];
  class FakeClient {
    async connect() { calls.push('connect'); }
    async end() { calls.push('end'); }
    async query({text,values}) {
      calls.push(text);
      if(text === 'SELECT current_user AS db_role') return {rows:[{db_role:'upv1_cf_public'}]};
      if(text === SQL) {
        assert.deepEqual(values,[tenant]);
        return {rows:[{tenant_id:tenant,public_id:'p1',price_revision:'rev1',status:'published',
          expires_at_ms:'1900000000000',desired_model:'iPhone 17 Pro',
          desired_capacity:'256 GB',desired_condition:'lacrado',
          trade_in_models:[{model:'iPhone 14 Pro',capacity:'128 GB',
            capacity_gb:128,device_model_id:'iphone14pro'}]}]};
      }
      if(text === INSERT) {
        assert.equal(values[0],tenant);
        return {rows:[{id}]};
      }
      throw Error('UNEXPECTED_SQL');
    }
  }
  const mkApi = label => () => ({
    matches:p => p === '/api/' + label + '/test',
    handle:async()=>{calls.push(label);return Response.json({route:label});}
  });
  const factory = new Function('runtimeModule','trackedModelModule','listIntakeModule',
    'batchListIntakeModule','handleWhatsAppWebhook','probeModule','pgModule',
    'upgradePublicModule',entrypoint);
  const worker = factory(
    {createExternalCalcWorkerRuntime:()=>({fetch:async()=>{calls.push('calc');return Response.json({route:'calc'});}})},
    {createTrackedModelApiV0:mkApi('tracked')},
    {createListIntakeApiV0:mkApi('list')},
    {createBatchListIntakeApiV0:mkApi('batch')},
    async()=>null,
    {createPrivateHyperdriveProbe:()=>async()=>{calls.push('probe');return Response.json({route:'probe'});},
      PROBE_PATH:'/api/upgrade/v1/_db-probe'},
    {Client:FakeClient},
    {createUpgradeV1HyperdriveApplication}
  );
  return {worker,calls};
}
const req=(p,method='GET',body)=>new Request(origin+p,{
  method,headers:body?{'content-type':'application/json'}:{},
  body:body?JSON.stringify(body):undefined
});
test('Wrangler preserves existing Worker and all route prefixes, default-off',()=>{
  const cfg = JSON.parse(wrangler.replace(/^\s*\/\/.*$/gm,''));
  assert.equal(cfg.name,'flat-resonance-09ba');
  assert.equal(cfg.main,'./worker/external-calc-worker.mjs');
  assert.equal(cfg.vars.UPGRADE_PUBLIC_ENABLED,'false');
  assert.equal(cfg.vars.UPGRADE_DB_PROBE_ENABLED,'false');
  assert.deepEqual(cfg.hyperdrive.map(x=>x.binding),['UPGRADE_DB']);
  for(const p of ['/api/upgrade/v1/*','/api/external-calc/*',
    '/api/pitsquad/acquisition/*','/api/pitsquad/whatsapp/*',
    '/api/pitsquad/assistant/*','/a/*'])
    assert(cfg.assets.run_worker_first.includes(p), 'missing '+p);
});
test('public routes default-off while existing Calc paths still dispatch',async()=>{
  const {worker,calls}=harness();
  for(const p of ['/api/upgrade/v1/catalog','/api/upgrade/v1/lead','/api/upgrade/v1/quote']){
    const response=await worker.fetch(req(p),{UPGRADE_PUBLIC_ENABLED:'false'});
    assert.equal(response.status,404);
    assert.deepEqual(await response.json(),{ok:false,code:'NOT_FOUND'});
  }
  const other=await worker.fetch(req('/api/external-calc/health'),{});
  assert.equal((await other.json()).route,'calc');
  assert(calls.includes('calc'));assert(!calls.includes('connect'));
});
test('unknown upgrade route fails closed without reaching Calc',async()=>{
  const {worker,calls}=harness();
  const r=await worker.fetch(req('/api/upgrade/v1/unrecognized'),env);
  assert.equal(r.status,404);assert.equal((await r.json()).code,'NOT_FOUND');
  assert(!calls.includes('calc'));
});
test('private probe is not intercepted by public upgrade dispatcher',async()=>{
  const {worker,calls}=harness();
  const r=await worker.fetch(req('/api/upgrade/v1/_db-probe'),env);
  assert.equal((await r.json()).route,'probe');
  assert.deepEqual(calls,['probe']);
});
test('public catalog through actual Worker dispatch uses restricted DB role',async()=>{
  const {worker,calls}=harness();
  const r=await worker.fetch(req('/api/upgrade/v1/catalog'),env);
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{ok:true,offers:[selection.desired]});
  assert(calls.includes(SQL));assert(!calls.includes('calc'));
});
test('lead through Worker dispatch uses restricted INSERT and returns receipt',async()=>{
  const {worker,calls}=harness();
  const r=await worker.fetch(req('/api/upgrade/v1/lead','POST',{
    request_key:key,selection,contact:{name:'Ana',whatsapp:'(21) 99999-9999'},consent:true
  }),env);
  assert.equal(r.status,202);
  assert.deepEqual(await r.json(),{ok:true,reference:'upg_'+id.replaceAll('-','')});
  assert(calls.includes(INSERT));assert(!calls.includes('calc'));
});
test('quote remains 503 without canonical financial invoker, never fabricates money',async()=>{
  const {worker,calls}=harness();
  const r=await worker.fetch(req('/api/upgrade/v1/quote','POST',selection),env);
  assert.equal(r.status,503);
  assert.deepEqual(await r.json(),{ok:false,code:'QUOTE_UNAVAILABLE'});
  assert(!calls.includes('calc'));
});
test('legacy route handlers remain reachable',async()=>{
  const {worker}=harness();
  for(const name of ['batch','list','tracked']){
    const r=await worker.fetch(req('/api/'+name+'/test'),env);
    assert.equal((await r.json()).route,name);
  }
});
