'use strict';
// Server-only loader for approved publication preparation. Uses canonical
// External Calc tables and externally injected trusted profile/candidate readers.
// The public Worker must never import or invoke this module.
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REF=/^[A-Za-z0-9_-]{1,100}$/;
const C01_SQL=`SELECT c01_snapshot,c01_contract_version,offer_value_fingerprint,
 domain_outcome,freshness_status FROM public.extcalc_offer_revision
 WHERE tenant_id=$1::uuid AND analysis_id=$2 AND offer_id=$3
 AND offer_revision=$4 LIMIT 2 FOR SHARE`;
const RATE_SQL=`SELECT profile_id,tenant_id,version,status,currency,rate_scale,fingerprint
 FROM public.extcalc_store_rate_profiles
 WHERE tenant_id=$1::uuid AND status='ACTIVE' LIMIT 2 FOR SHARE`;
const ENTRIES_SQL=`SELECT installment_count,rate_units FROM public.extcalc_store_rate_profile_entries
 WHERE profile_id=$1::uuid ORDER BY installment_count LIMIT 19`;
const TRADE_POLICY_SQL=`SELECT policy_id,tenant_id,version,status,currency,deduction_amount_minor,fingerprint
 FROM public.extcalc_store_trade_in_policies
 WHERE tenant_id=$1::uuid AND status='ACTIVE' LIMIT 2 FOR SHARE`;
const DENIED='CANONICAL_CALC_SOURCE_UNAVAILABLE';
const deny=()=>{throw Object.assign(new Error(DENIED),{code:DENIED});};
const one=r=>Array.isArray(r?.rows)&&r.rows.length===1?r.rows[0]:null;
function safeInt(value){
 if(typeof value==='number')return Number.isSafeInteger(value)?value:null;
 if(typeof value==='string'&&/^(0|[1-9][0-9]{0,15})$/.test(value)){
  const n=Number(value);return Number.isSafeInteger(n)?n:null;
 }
 return null;
}
function createUpgradeTrustedCalcSource({enabled=false,loadCalculationProfile,loadTradeInCandidates}={}){
 if(enabled!==true)return async()=>deny();
 if(typeof loadCalculationProfile!=='function'||typeof loadTradeInCandidates!=='function')
  throw Error('CANONICAL_CALC_READERS_REQUIRED');
 return async function loadTrustedCalcInputs(input={}){
  try {
   if(!input||typeof input!=='object'||Array.isArray(input)||
      Object.keys(input).some(k=>!['tx','tenantId','analysisId','offerId','offerRevision'].includes(k)))deny();
   const {tx,tenantId,analysisId,offerId,offerRevision}=input;
   if(!tx||typeof tx.query!=='function'||!UUID.test(tenantId||'')||
     !REF.test(analysisId||'')||!REF.test(offerId||'')||
     !Number.isInteger(offerRevision)||offerRevision<1)deny();
   const row=one(await tx.query(C01_SQL,[tenantId,analysisId,offerId,offerRevision]));
   if(!row||row.c01_contract_version!=='external-calc-c01-readonly/v1'||
     row.domain_outcome!=='VALID'||row.freshness_status!=='CURRENT'||!row.c01_snapshot||
     typeof row.c01_snapshot!=='object'||Array.isArray(row.c01_snapshot))deny();
   const c=row.c01_snapshot;
   if(c.contract_version!==row.c01_contract_version||c.analysis_id!==analysisId||
     c.offer_id!==offerId||c.offer_revision!==offerRevision||
     c.offer_value_fingerprint!==row.offer_value_fingerprint||
     c.execution_status!=='SUCCEEDED'||c.domain_outcome!=='VALID'||c.freshness_status!=='CURRENT')deny();
   if(c.tenant_id!=null&&c.tenant_id!==tenantId)deny();
   const rp=one(await tx.query(RATE_SQL,[tenantId]));
   const tp=one(await tx.query(TRADE_POLICY_SQL,[tenantId]));
   if(!rp||!tp||rp.tenant_id!==tenantId||tp.tenant_id!==tenantId||
     rp.status!=='ACTIVE'||tp.status!=='ACTIVE'||rp.currency!=='BRL'||tp.currency!=='BRL')deny();
   const entries=(await tx.query(ENTRIES_SQL,[rp.profile_id]))?.rows;
   if(!Array.isArray(entries)||entries.length<1||entries.length>18)deny();
   const normalizedEntries=entries.map(e=>({
    installment_count:safeInt(e.installment_count),rate_units:safeInt(e.rate_units)
   }));
   if(normalizedEntries.some(e=>!Number.isInteger(e.installment_count)||
     e.installment_count<1||e.installment_count>18||e.rate_units===null)||
     new Set(normalizedEntries.map(e=>e.installment_count)).size!==normalizedEntries.length)deny();
   const activeRateProfile={...rp,rate_scale:safeInt(rp.rate_scale),
    version:safeInt(rp.version),entries:normalizedEntries};
   const tradeInPolicy={...tp,version:safeInt(tp.version),
    deduction_amount_minor:safeInt(tp.deduction_amount_minor)};
   if(!activeRateProfile.profile_id||!Number.isInteger(activeRateProfile.version)||
     activeRateProfile.version<1||!Number.isInteger(activeRateProfile.rate_scale)||
     activeRateProfile.rate_scale<1||!activeRateProfile.fingerprint||
     !tradeInPolicy.policy_id||!Number.isInteger(tradeInPolicy.version)||
     tradeInPolicy.version<1||tradeInPolicy.deduction_amount_minor===null||
     !tradeInPolicy.fingerprint)deny();
   // Existing authenticated Calc authority provides its calculation profile
   // and trade-in offer candidates. Neither may come from an HTTP customer.
   const [calculationProfile,tradeInCandidates]=await Promise.all([
    loadCalculationProfile({tx,tenantId,analysisId,offerId,offerRevision}),
    loadTradeInCandidates({tx,tenantId,analysisId,offerId,offerRevision})
   ]);
   if(!calculationProfile||calculationProfile.currency!=='BRL'||
     !Array.isArray(tradeInCandidates)||!tradeInCandidates.length||
     tradeInCandidates.length>100)deny();
   const stamped=tradeInCandidates.map(v=>{
    if(!v||typeof v!=='object'||Array.isArray(v)||
      v.tenant_id!==tenantId||v.execution_status!=='SUCCEEDED'||
      v.domain_outcome!=='VALID'||v.freshness_status!=='CURRENT')deny();
    return v;
   });
   return Object.freeze({
    reviewedCandidate:{...c,tenant_id:tenantId},
    calculationProfile,
    calculationRunId:'upv1_'+offerRevision+'_'+offerId,
    tradeInCandidates:stamped,
    activeRateProfile,tradeInPolicy
   });
  }catch(_){deny();}
 };
}
module.exports={createUpgradeTrustedCalcSource,DENIED,SQL:Object.freeze({
 C01_SQL,RATE_SQL,ENTRIES_SQL,TRADE_POLICY_SQL
})};
