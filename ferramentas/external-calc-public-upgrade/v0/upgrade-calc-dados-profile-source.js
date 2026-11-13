'use strict';
// Private C02 profile source. The canonical business margins live in calc_dados,
// not in a second Upgrade price table. Only authenticated, authorized Calc
// operators may read this supplier-sensitive JSONB; the public role cannot.
const {buildCalculationProfileFromCalcDados}=require('../../external-calc-authority/v0/calc-dados-calculation-profile');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REF=/^[A-Za-z0-9_-]{1,100}$/;
const SOURCE_SQL=`SELECT c01_snapshot->'reviewed_offer'->'model'->>'id' AS model_id
 FROM public.extcalc_offer_revision
 WHERE tenant_id=$1::uuid AND analysis_id=$2 AND offer_id=$3
 AND offer_revision=$4 AND domain_outcome='VALID'
 AND freshness_status='CURRENT' LIMIT 2 FOR SHARE`;
const PROFILE_SQL=`SELECT tenant_id,dados,atualizado_em
 FROM public.calc_dados WHERE tenant_id=$1::uuid LIMIT 2 FOR SHARE`;
const DENIED='CALC_DADOS_PROFILE_UNAVAILABLE';
const deny=()=>{throw Object.assign(new Error(DENIED),{code:DENIED});};
function createUpgradeCalcDadosProfileSource({enabled=false}={}){
 if(enabled!==true)return async()=>deny();
 return async function loadCalculationProfile({tx,tenantId,analysisId,offerId,offerRevision}={}){
  try{
   if(typeof tx?.query!=='function'||!UUID.test(tenantId||'')||
      !REF.test(analysisId||'')||!REF.test(offerId||'')||
      !Number.isInteger(offerRevision)||offerRevision<1)deny();
   const source=await tx.query(SOURCE_SQL,[tenantId,analysisId,offerId,offerRevision]);
   if(!Array.isArray(source?.rows)||source.rows.length!==1)deny();
   // This publication is for iPhone trade-in only. Never project a Mac/iPad
   // with iPhone margins, and never trust product category from the browser.
   const modelId=source.rows[0]?.model_id;
   if(typeof modelId!=='string'||!/^iphone[a-z0-9_-]*$/i.test(modelId))deny();
   const profile=await tx.query(PROFILE_SQL,[tenantId]);
   if(!Array.isArray(profile?.rows)||profile.rows.length!==1)deny();
   const row=profile.rows[0];
   if(row.tenant_id!==tenantId||!row.dados||typeof row.dados!=='object'||Array.isArray(row.dados))deny();
   const date=row.atualizado_em instanceof Date
    ?row.atualizado_em.toISOString():typeof row.atualizado_em==='string'
     ?new Date(row.atualizado_em).toISOString():null;
   if(!date)deny();
   const derived=buildCalculationProfileFromCalcDados({
    category:'iPhone',updated_at:date,dados:row.dados
   });
   if(derived.currency!=='BRL'||!Number.isSafeInteger(derived.cash_margin_minor)||
      !Number.isSafeInteger(derived.installment_margin_minor))deny();
   return Object.freeze(derived);
  }catch(_){deny();}
 };
}
module.exports={createUpgradeCalcDadosProfileSource,SQL:Object.freeze({SOURCE_SQL,PROFILE_SQL}),DENIED};
