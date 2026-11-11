'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createUpgradeV1HyperdriveApplication}=require('../ferramentas/external-calc-public-upgrade/v0/upgrade-hyperdrive-composition');
const worker=fs.readFileSync(path.join(__dirname,'external-calc-worker.mjs'),'utf8');
const wrangler=fs.readFileSync(path.join(__dirname,'../wrangler.jsonc'),'utf8');
test('the existing Worker, pg and private Hyperdrive diagnostic remain wired',()=>{
 for(const name of ['handlePitsquadAssistant','handleWhatsAppWebhook','handlePitsquad','createBatchListIntakeApiV0','createListIntakeApiV0','createTrackedModelApiV0','createExternalCalcWorkerRuntime','createPrivateHyperdriveProbe','pgModule?.Client'])assert(worker.includes(name),'missing '+name);
 assert.match(worker,/import pgModule from 'pg'/);
 assert.match(worker,/createPrivateHyperdriveProbe\(\{ env, Client: pgModule\?\.Client \}\)/);
});
test('public Upgrade dispatcher precedes Calc without replacing unrelated routes',()=>{
 const start=worker.lastIndexOf('async fetch(request, env)');
 const u=worker.indexOf('if (upgradePublicApi.matches(url.pathname))',start);
 const calc=worker.indexOf('const runtime = createExternalCalcWorkerRuntime({ env });',start);
 assert(u>start&&u<calc);
 assert(worker.includes('createUpgradeV1HyperdriveApplication({ env, Client: pgModule?.Client })'));
 assert(wrangler.includes('"/api/upgrade/v1/*"'));
 assert(wrangler.includes('"/api/external-calc/*"'));
 assert(wrangler.includes('"binding":"UPGRADE_DB"'));
 assert(wrangler.includes('"UPGRADE_PUBLIC_ENABLED": "false"'));
 assert(wrangler.includes('"UPGRADE_DB_PROBE_ENABLED": "false"'));
});
test('default-off public endpoints reveal nothing and no extra paths match',async()=>{
 const api=createUpgradeV1HyperdriveApplication();
 for(const pathname of ['/api/upgrade/v1/catalog','/api/upgrade/v1/lead','/api/upgrade/v1/quote']){
  assert(api.matches(pathname));
  const res=await api.handle(new Request('https://example.test'+pathname,{method:pathname.endsWith('/catalog')?'GET':'POST'}));
  assert.equal(res.status,404);
  assert.deepEqual(await res.json(),{ok:false,code:'NOT_FOUND'});
 }
 for(const pathname of ['/api/pitsquad/acquisition/capture','/api/external-calc/v0/execute','/api/upgrade/v1/_db-probe','/api/upgrade/v1/unrecognized'])assert.equal(api.matches(pathname),false);
});
test('no trusted tenant or origin remains fail-closed even if flag toggled',async()=>{
 const api=createUpgradeV1HyperdriveApplication({env:{UPGRADE_PUBLIC_ENABLED:'true',UPGRADE_DB:{connectionString:'postgres://placeholder/db'}},Client:class {}});
 const res=await api.handle(new Request('https://example.test/api/upgrade/v1/catalog'));
 assert.equal(res.status,404);
});
