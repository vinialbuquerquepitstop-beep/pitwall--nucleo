#!/usr/bin/env node
'use strict';
// UP-06Y: fail-closed canonical integration runner. No CI, DB or deployment side effects.
const {spawnSync}=require('node:child_process');
const {existsSync}=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const required=[
 'worker/external-calc-worker.mjs',
 'wrangler.jsonc',
 'ferramentas/external-calc-c02/v1/c02-calculator.js',
 'ferramentas/external-calc-store-rate/v1/store-rate-resolver.js',
 'ferramentas/external-calc-sales-product/v0/home-product-projection.js',
 'ferramentas/external-calc-sales-product/v0/sales-product-service.js',
 'ferramentas/external-calc-public-upgrade/v0/internal-upgrade-application.js',
 'ferramentas/external-calc-public-upgrade/v0/canonical-domain-adapter.js',
 'ferramentas/external-calc-public-upgrade/v0/internal-port.js',
 'ferramentas/external-calc-public-upgrade/v0/service-composition.js',
 'ferramentas/external-calc-public-upgrade/v0/service-identity.js',
 'ferramentas/external-calc-public-upgrade/v0/replay-store.js',
 'ferramentas/external-calc-public-upgrade/v0/postgres-replay-adapter.js',
 'ferramentas/external-calc-public-upgrade/v0/key-registry.js',
 'ferramentas/external-calc-public-upgrade/v0/published-offer-repository.js',
 'ferramentas/external-calc-public-upgrade/v0/tenant-context-repository.js',
 'ferramentas/external-calc-public-upgrade/v0/private-http-handler.js',
 'ferramentas/external-calc-public-upgrade/v0/public-upgrade-api.js',
 'ferramentas/external-calc-public-upgrade/v0/authorized-upgrade-quote.js',
 'ferramentas/external-calc-public-upgrade/v0/approved-catalog-repository.js',
 'ferramentas/external-calc-public-upgrade/v0/upgrade-capture-repository.js',
 'ferramentas/external-calc-public-upgrade/v0/upgrade-v1-public-application.js',
 'ferramentas/external-calc-public-upgrade/v0/upgrade-crm-reconciler.js',
 'ferramentas/external-calc-public-upgrade/v0/upgrade-crm-operator-repository.js'
];
const tests=[
 'worker/upgrade-route-wiring.test.cjs',
 'ferramentas/external-calc-public-upgrade/v0/internal-upgrade-e2e.test.js',
 'ferramentas/external-calc-public-upgrade/v0/private-http-handler.test.js',
 'ferramentas/external-calc-public-upgrade/v0/public-upgrade-api.test.js',
 'ferramentas/external-calc-public-upgrade/v0/authorized-upgrade-quote.test.js',
 'ferramentas/external-calc-public-upgrade/v0/approved-catalog-repository.test.js',
 'ferramentas/external-calc-public-upgrade/v0/upgrade-capture-repository.test.js',
 'ferramentas/external-calc-public-upgrade/v0/upgrade-v1-public-application.test.js',
 'ferramentas/external-calc-public-upgrade/v0/upgrade-crm-reconciler.test.js',
 'ferramentas/external-calc-public-upgrade/v0/upgrade-crm-operator-repository.test.js',
 'ferramentas/external-calc-public-upgrade/v0/canonical-domain-adapter.test.js',
 'ferramentas/external-calc-public-upgrade/v0/internal-upgrade-application.test.js',
 'ferramentas/external-calc-public-upgrade/v0/published-offer-repository.test.js',
 'ferramentas/external-calc-public-upgrade/v0/tenant-context-repository.test.js',
 'ferramentas/external-calc-public-upgrade/v0/service-composition.test.js',
 'ferramentas/external-calc-public-upgrade/v0/service-identity.test.js',
 'ferramentas/external-calc-public-upgrade/v0/replay-store.test.js',
 'ferramentas/external-calc-public-upgrade/v0/postgres-replay-adapter.test.js',
 'ferramentas/external-calc-public-upgrade/v0/key-registry.test.js'
];
const missing=[...required,...tests].filter(f=>!existsSync(path.join(root,f)));
if(missing.length){
 console.error('UP06Y BLOCKED: canonical checkout incomplete');
 for(const file of missing)console.error('MISSING',file);
 process.exit(2);
}
if(process.argv.includes('--check-only')){
 console.log('UP06Y READY: canonical sources and',tests.length,'test modules present');
 process.exit(0);
}
console.log('UP06Y: executing',tests.length,'test modules against canonical repo files');
const r=spawnSync(process.execPath,['--test',...tests.map(f=>path.join(root,f))],{
 cwd:root,stdio:'inherit',env:{...process.env,UPGRADE_PUBLIC_ENABLED:'false'},timeout:120000
});
if(r.error){console.error('UP06Y EXECUTION_ERROR:',r.error.message);process.exit(3);}
if(r.signal){console.error('UP06Y TERMINATED:',r.signal);process.exit(3);}
process.exit(r.status===null?3:r.status);
