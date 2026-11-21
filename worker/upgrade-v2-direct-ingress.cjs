'use strict';
// UP-CRM-01 | Direct capture in the EXISTING Cloudflare Worker.
// Canonical V2 modules are pinned snapshots from pitswal-v2 PR #40.
// The authorized edge rate-limit guard MUST run before calling handle().
// Ingress DB identity is independent of the old UPGRADE_DB Hyperdrive binding
// and has no operator privileges. No CRM RPC runs on this public request.
const {createUpgradeV2DbScope}=require('./upgrade-v2-core/upgrade-db-scope.cjs');
const {createPitwallUpgradeIntake}=require('./upgrade-v2-core/upgrade-intake.cjs');
const {createUpgradeV2ReceiptStore}=require('./upgrade-v2-core/upgrade-receipt-store.cjs');
const {createUpgradeV2HttpIngress}=require('./upgrade-v2-core/upgrade-http-ingress.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ROLE=/^pw_upgrade_[a-z][a-z0-9_]{2,50}_login$/;
function createUpgradeV2DirectIngress({env,Client}={}){
 const binding=env?.UPGRADE_V2_DB_INGRESS;
 const org=env?.UPGRADE_V2_ORGANIZATION_ID;
 const login=env?.UPGRADE_V2_INGRESS_LOGIN_ROLE;
 const origin=env?.UPGRADE_EXPECTED_ORIGIN;
 if(typeof Client!=='function'||typeof binding?.connectionString!=='string'||
    !/^postgres(?:ql)?:\/\//.test(binding.connectionString)||
    !UUID.test(org||'')||!ROLE.test(login||'')||
    typeof origin!=='string')return null;
 const pool={
  async connect(){
   const client=new Client({connectionString:binding.connectionString,
    connectionTimeoutMillis:5000,query_timeout:5000,
    application_name:'Pitwall Upgrade V2 Ingress'});
   try{await client.connect();}
   catch{try{await client.end();}catch{}throw Error('UPGRADE_V2_DB_UNAVAILABLE');}
   return {query:(sql,parameters)=>client.query(sql,parameters),
    release:()=>client.end()};
  }
 };
 const scope=createUpgradeV2DbScope({
  pool,organizationId:org,capability:'ingress',expectedLoginRole:login
 });
 const store=createUpgradeV2ReceiptStore;
 const intake=createPitwallUpgradeIntake({
  organizationId:org,
  // The edge guard MUST validate Cloudflare rate limiting before invoking
  // this handler. The HTTP entry is not exported as an unguarded route.
  checkAbuse:async()=>true,
  store:input=>scope.withQuery(({query})=>store({query})(input))
 });
 const ingress=createUpgradeV2HttpIngress({
  enabled:true,intake,publicOrigin:origin
 });
 return Object.freeze({handle:request=>ingress.handle(request)});
}
module.exports={createUpgradeV2DirectIngress};
