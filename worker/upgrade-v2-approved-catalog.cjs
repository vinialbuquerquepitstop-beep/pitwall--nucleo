'use strict';
// Upgrade V2: a PUBLIC, price-free catalog projection from an injected trusted
// source of already-approved External Calc publications. The runtime adapter
// must be implemented by an authenticated server reader; this module has no DB
// connection, no legacy API imports and no public execution by itself.
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const CAPACITY=new Set(['64 GB','128 GB','256 GB','512 GB','1 TB','2 TB']);
const CONDITION=new Set(['lacrado','seminovo']);
const unavailable=()=>{throw Object.assign(new Error('UPGRADE_V2_CATALOG_UNAVAILABLE'),{code:'UPGRADE_V2_CATALOG_UNAVAILABLE'});};
function createUpgradeV2ApprovedCatalog({enabled=false,sourceTenantId,loadApprovedPublications,clock=()=>Date.now()}={}){
 if(enabled!==true)return async()=>unavailable();
 if(!UUID.test(sourceTenantId||'')||typeof loadApprovedPublications!=='function'||typeof clock!=='function')
  throw Error('UPGRADE_V2_CATALOG_TRUSTED_SOURCE_REQUIRED');
 return async function catalog(){
  try{
   const records=await loadApprovedPublications();
   if(!Array.isArray(records)||!records.length||records.length>500)unavailable();
   const now=clock();
   if(!Number.isSafeInteger(now))unavailable();
   const seen=new Set(),offers=[];
   for(const row of records){
    if(!row||typeof row!=='object'||Array.isArray(row)||
      row.tenant_id!==sourceTenantId||row.status!=='published'||row.approved!==true||
      !Number.isSafeInteger(row.expires_at_ms)||row.expires_at_ms<=now||
      !/^[A-Za-z0-9_-]{1,100}$/.test(row.public_id||'')||
      !/^[A-Za-z0-9_-]{1,100}$/.test(row.price_revision||''))unavailable();
    const d=row.desired;
    if(!d||typeof d!=='object'||Array.isArray(d)||
      typeof d.model!=='string'||d.model.trim()!==d.model||!d.model||d.model.length>100||
      !CAPACITY.has(d.capacity)||!CONDITION.has(d.condition))unavailable();
    const key=JSON.stringify([d.model,d.capacity,d.condition]);
    if(seen.has(key))unavailable();
    seen.add(key);
    offers.push(Object.freeze({model:d.model,capacity:d.capacity,condition:d.condition}));
   }
   return Object.freeze(offers);
  }catch{unavailable();}
 };
}
module.exports={createUpgradeV2ApprovedCatalog};
