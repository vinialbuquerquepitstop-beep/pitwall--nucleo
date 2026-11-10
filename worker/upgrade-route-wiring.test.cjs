'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createUpgradeV1HyperdriveApplication}=require('../ferramentas/external-calc-public-upgrade/v0/upgrade-hyperdrive-composition');
const worker=fs.readFileSync(path.join(__dirname,'external-calc-worker.mjs'),'utf8');
const wrangler=fs.readFileSync(path.join(__dirname,'../wrangler.jsonc'),'utf8');
test('existing Worker imports the upgrade app without replacing other handlers',()=>{
 assert.match(worker,/import upgradeHyperdriveModule from '\.\.\/ferramentas\/external-calc-public-upgrade\/v0\/upgrade-hyperdrive-composition\.js'/);
 for(const name of ['handlePitsquadAssistant','handleWhatsAppWebhook','handlePitsquad','createBatchListIntakeApiV0','createListIntakeApiV0','createTrackedModelApiV0','createExternalCalcWorkerRuntime']){
  assert(worker.includes(name),'missing canonical worker component '+name);
 }
});
test('public Upgrade dispatch precedes canonical Calc routing',()=>{
 const start=worker.lastIndexOf('async fetch(request, env)');
 const route=worker.indexOf('if (upgradePublicApi.matches(url.pathname))',start);
 const calc=worker.indexOf('const runtime = createExternalCalcWorkerRuntime({ env });',start);
 assert(route>start&&route<calc);
 assert(worker.includes('createUpgradeV1HyperdriveApplication({ env, Client })'),'existing Worker uses binding-aware composition');
 assert(worker.includes("env.UPGRADE_PUBLIC_ENABLED === 'true'"),'explicit activation gate');
 assert(!worker.includes('UPGRADE_PUBLIC_ENABLED = \'true\''));
});
test('Wrangler explicitly passes upgrade path to Worker first without dropping existing paths',()=>{
 for(const p of ['/api/upgrade/v1/*','/api/external-calc/*','/api/pitsquad/acquisition/*','/api/pitsquad/whatsapp/*','/api/pitsquad/assistant/*','/a/*']){
  assert(wrangler.includes('"'+p+'"'), 'missing path '+p);
 }
 assert(wrangler.includes('"name": "flat-resonance-09ba"'),'existing Worker unchanged');
 assert(wrangler.includes('"main": "./worker/external-calc-worker.mjs"'),'entrypoint unchanged');
 assert(wrangler.includes('"binding": "UPGRADE_DB"'));
 assert(wrangler.includes('"id": "3b2d749f7ee74994aa149c601217b6f7"'));
 assert(wrangler.includes('"UPGRADE_PUBLIC_ENABLED": "false"'));
});
test('upgrade endpoint returns disabled status without DB credentials',async()=>{
 const api=createUpgradeV1HyperdriveApplication();
 for(const pathname of ['/api/upgrade/v1/quote','/api/upgrade/v1/lead']){
  assert(api.matches(pathname));
  const res=await api.handle(new Request('https://example.test'+pathname,{method:'POST'}));
  assert.equal(res.status,404);assert.deepEqual(await res.json(),{ok:false,code:'NOT_FOUND'});
 }
});
test('unrelated paths are left to original Calc/Pitsquad handlers',()=>{
 const api=createUpgradeV1HyperdriveApplication();
 for(const pathname of ['/api/external-calc/v1/quote','/api/pitsquad/acquisition/capture','/api/pitsquad/whatsapp/webhook','/a/example','/api/upgrade/v1/unrecognized'])assert.equal(api.matches(pathname),false);
});
