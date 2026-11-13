'use strict';
// Private read-only trade-in candidate source. Selects only currently valid,
// latest C01 revisions explicitly marked as Seminovo. These are proxy market
// references, not guaranteed customer trade-in prices. The canonical
// resolveTradeIn policy remains responsible for the actual credit.
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const DENIED='UPGRADE_TRADE_IN_SOURCE_UNAVAILABLE';
const deny=()=>{throw Object.assign(new Error(DENIED),{code:DENIED});};
const SQL=`SELECT r.tenant_id,r.analysis_id,r.offer_id,r.offer_revision,
 r.c01_contract_version,r.offer_value_fingerprint,r.c01_snapshot,
 r.domain_outcome,r.freshness_status
 FROM public.extcalc_offer_revision r
 WHERE r.tenant_id=$1::uuid
 AND r.offer_revision=(
  SELECT max(newer.offer_revision) FROM public.extcalc_offer_revision newer
  WHERE newer.tenant_id=r.tenant_id AND newer.analysis_id=r.analysis_id
  AND newer.offer_id=r.offer_id
 )
 AND r.domain_outcome='VALID' AND r.freshness_status='CURRENT'
 AND lower(btrim(r.c01_snapshot->'reviewed_offer'->>'condition'))='seminovo'
 AND r.c01_snapshot->'reviewed_offer'->'model'->>'id' ~* '^iphone[a-z0-9_-]+$'
 AND (r.c01_snapshot->'reviewed_offer'->>'capacity_gb') ~ '^[0-9]+$'
 ORDER BY r.analysis_id,r.offer_id,r.offer_revision LIMIT 101 FOR SHARE`;
const validRef=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(s);
function createUpgradeTradeInCandidateSource({enabled=false}={}){
 if(enabled!==true)return async()=>deny();
 return async function loadTradeInCandidates({tx,tenantId}={}){
  try{
   if(typeof tx?.query!=='function'||!UUID.test(tenantId||''))deny();
   const result=await tx.query(SQL,[tenantId]);
   if(!Array.isArray(result?.rows)||result.rows.length<1||result.rows.length>100)deny();
   const ids=new Set(),candidates=[];
   for(const row of result.rows){
    const c=row?.c01_snapshot,o=c?.reviewed_offer;
    if(row.tenant_id!==tenantId||row.domain_outcome!=='VALID'||row.freshness_status!=='CURRENT'||
       row.c01_contract_version!=='external-calc-c01-readonly/v1'||!c||
       c.contract_version!==row.c01_contract_version||
       c.analysis_id!==row.analysis_id||c.offer_id!==row.offer_id||
       c.offer_revision!==row.offer_revision||
       c.offer_value_fingerprint!==row.offer_value_fingerprint||
       c.execution_status!=='SUCCEEDED'||c.domain_outcome!=='VALID'||
       c.freshness_status!=='CURRENT'||(c.tenant_id!=null&&c.tenant_id!==tenantId)||
       !validRef(row.analysis_id)||!validRef(row.offer_id)||
       !Number.isInteger(row.offer_revision)||row.offer_revision<1||
       !validRef(o?.supplier_id)||!validRef(o?.model?.id)||
       !/^iphone[a-z0-9_-]+$/i.test(o.model.id)||
       typeof o?.condition!=='string'||o.condition.trim().toLowerCase()!=='seminovo'||
       ![64,128,256,512,1024,2048].includes(o.capacity_gb)||
       o.price?.currency!=='BRL'||!Number.isSafeInteger(o.price?.amount_minor)||
       o.price.amount_minor<=0)deny();
    const key=[row.analysis_id,row.offer_id,row.offer_revision].join('|');
    if(ids.has(key))deny();ids.add(key);
    candidates.push(Object.freeze({...c,tenant_id:tenantId}));
   }
   return Object.freeze(candidates);
  }catch(_){deny();}
 };
}
module.exports={createUpgradeTradeInCandidateSource,SQL,DENIED};
