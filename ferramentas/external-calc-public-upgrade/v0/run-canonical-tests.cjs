#!/usr/bin/env node
'use strict';
// UP-06Y — deterministic canonical suite runner. Must run from repository checkout.
const {spawnSync}=require('node:child_process');
const {existsSync}=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const files=[
 'ferramentas/external-calc-sales-product/v0/sales-product-service.js',
 'ferramentas/external-calc-public-upgrade/v0/internal-upgrade-e2e.test.js',
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
const missing=files.filter(f=>!existsSync(path.join(root,f)));
if(missing.length){console.error('UP06Y BLOCKED: checkout incomplete:',missing.join(', '));process.exit(2);}
const tests=files.filter(f=>f.endsWith('.test.js')).map(f=>path.join(root,f));
console.log('UP06Y: executing',tests.length,'test modules against canonical repo files');
const r=spawnSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit',env:{...process.env,UPGRADE_PUBLIC_ENABLED:'false'},timeout:120000});
if(r.error){console.error('UP06Y EXECUTION_ERROR:',r.error.message);process.exit(3);}
process.exit(r.status===null?3:r.status);
