'use strict';
// Trusted read-only catalog built only from explicitly approved, non-revoked
// publications. Never read offer costs or let the browser supply tenant.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SQL=`SELECT p.tenant_id,p.public_id,p.price_revision,p.status,p.expires_at_ms,
 c.desired_model,c.desired_capacity,c.desired_condition,c.trade_in_models
 FROM privado.extcalc_upgrade_public_catalog_v1 c
 JOIN privado.extcalc_upgrade_publications_v0 p
 ON p.tenant_id=c.tenant_id AND p.public_id=c.public_id AND p.price_revision=c.price_revision
 WHERE c.tenant_id=$1::uuid AND p.status='published'
 AND p.approved_at IS NOT NULL AND p.approved_by IS NOT NULL
 AND p.revoked_at IS NULL
 AND p.expires_at_ms > (extract(epoch from clock_timestamp())*1000)::bigint
 ORDER BY p.public_id,p.price_revision LIMIT 501`;
const REF=/^[A-Za-z0-9_-]{1,100}$/;
const CAPACITY=new Set(['64 GB','128 GB','256 GB','512 GB','1 TB','2 TB']);
const CONDITION=new Set(['lacrado','seminovo']);
const usedCapacity=new Map([['64 GB',64],['128 GB',128],['256 GB',256],['512 GB',512],['1 TB',1024],['2 TB',2048]]);
class CatalogUnavailable extends Error{constructor(){super('CATALOG_UNAVAILABLE');this.code='CATALOG_UNAVAILABLE';}}
const deny=()=>{throw new CatalogUnavailable();};
const safeText=(s)=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=100;
function createApprovedCatalogRepository({enabled=false,tenantId,query,clock=()=>Date.now()}={}){
 if(enabled!==true)return async()=>deny();
 if(!UUID.test(tenantId||'')||typeof query!=='function')throw Error('TRUSTED_CATALOG_DEPENDENCIES_REQUIRED');
 return async function loadApprovedCatalog(){
  let rows;
  try{rows=(await query(SQL,[tenantId]))?.rows;}catch(_){deny();}
  if(!Array.isArray(rows)||rows.length>500)deny();
  const now=clock();
  const seen=new Set();
  const catalog=[];
  for(const r of rows){
   const exp=typeof r?.expires_at_ms==='string'?Number(r.expires_at_ms):r?.expires_at_ms;
   if(r?.tenant_id!==tenantId||!REF.test(r.public_id||'')||!REF.test(r.price_revision||'')||
      r.status!=='published'||!Number.isSafeInteger(exp)||exp<=now||
      !safeText(r.desired_model)||!CAPACITY.has(r.desired_capacity)||!CONDITION.has(r.desired_condition)||
      !Array.isArray(r.trade_in_models)||r.trade_in_models.length>200)deny();
   const identity=[r.desired_model,r.desired_capacity,r.desired_condition].join('|');
   if(seen.has(identity))deny();seen.add(identity);
   const models=r.trade_in_models.map(v=>{
    if(!v||typeof v!=='object'||Array.isArray(v)||!safeText(v.model)||!CAPACITY.has(v.capacity)||
       !Number.isInteger(v.capacity_gb)||v.capacity_gb!==usedCapacity.get(v.capacity)||
       !REF.test(v.device_model_id||''))deny();
    return Object.freeze({model:v.model,capacity:v.capacity,capacity_gb:v.capacity_gb,device_model_id:v.device_model_id});
   });
   const keys=new Set(models.map(v=>v.model+'|'+v.capacity));
   if(keys.size!==models.length)deny();
   catalog.push(Object.freeze({
    tenant_id:tenantId,public_id:r.public_id,price_revision:r.price_revision,
    status:'published',approved:true,expires_at_ms:exp,
    desired:Object.freeze({model:r.desired_model,capacity:r.desired_capacity,condition:r.desired_condition}),
    trade_in_models:Object.freeze(models)
   }));
  }
  return Object.freeze(catalog);
 };
}
module.exports={createApprovedCatalogRepository,SQL,CatalogUnavailable};
