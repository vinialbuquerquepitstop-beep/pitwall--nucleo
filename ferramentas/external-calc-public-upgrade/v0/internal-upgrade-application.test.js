'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createInternalUpgradeApplication}=require('./internal-upgrade-application');
test('disabled by default without DB credentials',async()=>{
 const app=createInternalUpgradeApplication();
 assert.equal(app.enabled,false);
 await assert.rejects(()=>app.execute({action:'resolveVariant'}),e=>e.code==='PUBLIC_UPGRADE_DISABLED');
});
test('cannot enable without publication and tenant-scoped repository',()=>{
 assert.throws(()=>createInternalUpgradeApplication({enabled:true}),/TENANT_PUBLICATION_REPOSITORY_REQUIRED/);
});
test('cannot enable with unconfigured identity store',()=>{
 assert.throws(()=>createInternalUpgradeApplication({enabled:true,loadApprovedPublication:async()=>null,loadTenantScopedContext:async()=>null}),/PERSISTENT_IDENTITY_DEPENDENCIES_REQUIRED/);
});
