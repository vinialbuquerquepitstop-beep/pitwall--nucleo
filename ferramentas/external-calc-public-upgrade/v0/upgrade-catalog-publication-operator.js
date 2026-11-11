'use strict';
// Operator-only DB write boundary. NOT imported by the public Worker.
// All source financial inputs are loaded from trusted External Calc storage,
// never accepted from the customer or from an unsigned client payload.
const {createExternalCalcUpgradePublicationDraft}=require('./external-calc-publication-draft');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REF=/^[A-Za-z0-9_-]{1,100}$/;
const SOURCE_SQL=`SELECT offer_value_fingerprint,domain_outcome,freshness_status
 FROM public.extcalc_offer_revision WHERE tenant_id=$1::uuid AND analysis_id=$2
 AND offer_id=$3 AND offer_revision=$4 LIMIT 2 FOR SHARE`;
const LATEST_SQL=`SELECT max(offer_revision) AS latest_revision FROM public.extcalc_offer_revision
 WHERE tenant_id=$1::uuid AND analysis_id=$2 AND offer_id=$3`;
const INSERT_PUBLICATION=`INSERT INTO privado.extcalc_upgrade_publications_v0
 (tenant_id,public_id,price_revision,status,sale_price_minor,expires_at_ms,offer_revision,
 analysis_id,offer_id,offer_value_fingerprint,approved_at,approved_by)
 VALUES ($1::uuid,$2,$3,'draft',$4,$5,$6,$7,$8,$9,NULL,NULL)
 ON CONFLICT DO NOTHING RETURNING public_id`;
const INSERT_CATALOG=`INSERT INTO privado.extcalc_upgrade_public_catalog_v1
 (tenant_id,public_id,price_revision,desired_model,desired_capacity,desired_condition,trade_in_models)
 VALUES ($1::uuid,$2,$3,$4,$5,$6,$7::jsonb)
 ON CONFLICT DO NOTHING RETURNING public_id`;
const INSERT_CONTEXT=`INSERT INTO privado.extcalc_upgrade_context_v0
 (tenant_id,public_id,offer_revision,offers,trade_in_candidates,trade_in_policy,rate_profile)
 VALUES ($1::uuid,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb)
 ON CONFLICT DO NOTHING RETURNING public_id`;
const LOCK_PUBLICATION=`SELECT tenant_id,public_id,price_revision,status,sale_price_minor,expires_at_ms,
 offer_revision,analysis_id,offer_id,offer_value_fingerprint,approved_at,approved_by,revoked_at
 FROM privado.extcalc_upgrade_publications_v0
 WHERE tenant_id=$1::uuid AND public_id=$2 AND price_revision=$3 FOR UPDATE`;
const LOCK_CATALOG=`SELECT desired_model,desired_capacity,desired_condition,trade_in_models
 FROM privado.extcalc_upgrade_public_catalog_v1 WHERE tenant_id=$1::uuid
 AND public_id=$2 AND price_revision=$3 FOR SHARE`;
const LOCK_CONTEXT=`SELECT offers,trade_in_candidates,trade_in_policy,rate_profile
 FROM privado.extcalc_upgrade_context_v0 WHERE tenant_id=$1::uuid
 AND public_id=$2 AND offer_revision=$3 FOR SHARE`;
const REVOKE_PRIOR=`UPDATE privado.extcalc_upgrade_publications_v0 SET status='revoked',
 revoked_at=clock_timestamp() WHERE tenant_id=$1::uuid AND public_id=$2
 AND price_revision<>$3 AND status='published' AND revoked_at IS NULL`;
const APPROVE=`UPDATE privado.extcalc_upgrade_publications_v0
 SET status='published',approved_at=clock_timestamp(),approved_by=$4::uuid
 WHERE tenant_id=$1::uuid AND public_id=$2 AND price_revision=$3
 AND status='draft' AND approved_at IS NULL AND approved_by IS NULL AND revoked_at IS NULL
 RETURNING public_id`;
const DENIED='UPGRADE_PUBLICATION_NOT_AUTHORIZED';
const deny=()=>{throw Object.assign(new Error(DENIED),{code:DENIED});};
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function countOne(result){return Array.isArray(result?.rows)&&result.rows.length===1;}
function operatorId(v){return UUID.test(v||'');}
function ref(v){return REF.test(v||'');}
function createUpgradeCatalogPublicationOperator({enabled=false,withTransaction,authorizeOperator,loadTrustedCalcInputs,clock=()=>Date.now()}={}){
 if(enabled!==true)return Object.freeze({enabled:false,stage:async()=>deny(),approve:async()=>deny()});
 if(typeof withTransaction!=='function'||typeof authorizeOperator!=='function'||typeof loadTrustedCalcInputs!=='function')throw Error('PUBLICATION_OPERATOR_DEPENDENCIES_REQUIRED');
 async function authorize(action){
  const actor=await authorizeOperator({action});
  if(!actor||!operatorId(actor.user_id)||!operatorId(actor.tenant_id)||
   !['dono','validador'].includes(actor.role)||actor.authenticated!==true)deny();
  return actor;
 }
 async function prepare(tx,actor,command){
  if(!command||typeof command!=='object'||Array.isArray(command)||
   Object.keys(command).some(k=>!['publicId','priceRevision','analysisId','offerId','offerRevision','expiresAtMs'].includes(k))||
   !ref(command.publicId)||!ref(command.priceRevision)||!ref(command.analysisId)||!ref(command.offerId)||
   !Number.isInteger(command.offerRevision)||command.offerRevision<1||
   !Number.isSafeInteger(command.expiresAtMs))deny();
  const identity=[actor.tenant_id,command.analysisId,command.offerId,command.offerRevision];
  const row=await tx.query(SOURCE_SQL,identity);
  const latest=await tx.query(LATEST_SQL,identity.slice(0,3));
  if(!countOne(row)||!countOne(latest)||Number(latest.rows[0].latest_revision)!==command.offerRevision||
   row.rows[0].domain_outcome!=='VALID'||row.rows[0].freshness_status!=='CURRENT')deny();
  const inputs=await loadTrustedCalcInputs({tx,tenantId:actor.tenant_id,
   analysisId:command.analysisId,offerId:command.offerId,offerRevision:command.offerRevision});
  if(!inputs||!inputs.reviewedCandidate||!inputs.tradeInPolicy||
   inputs.tradeInPolicy.tenant_id!==actor.tenant_id||
   inputs.tradeInPolicy.status!=='ACTIVE'||inputs.tradeInPolicy.currency!=='BRL'||
   inputs.reviewedCandidate.offer_value_fingerprint!==row.rows[0].offer_value_fingerprint||
   inputs.reviewedCandidate.analysis_id!==command.analysisId||
   inputs.reviewedCandidate.offer_id!==command.offerId||
   inputs.reviewedCandidate.offer_revision!==command.offerRevision)deny();
  const draft=createExternalCalcUpgradePublicationDraft({
   tenantId:actor.tenant_id,publicId:command.publicId,priceRevision:command.priceRevision,
   expiresAtMs:command.expiresAtMs,clock,reviewedCandidate:inputs.reviewedCandidate,
   calculationProfile:inputs.calculationProfile,calculationRunId:inputs.calculationRunId,
   tradeInCandidates:inputs.tradeInCandidates,activeRateProfile:inputs.activeRateProfile
  });
  return {draft,inputs};
 }
 async function stage(command){
  const actor=await authorize('stage');
  return withTransaction(async tx=>{
   const {draft,inputs}=await prepare(tx,actor,command);
   const p=draft.publication,c=draft.catalog;
   if(!countOne(await tx.query(INSERT_PUBLICATION,[p.tenant_id,p.public_id,p.price_revision,
    p.sale_price_minor,p.expires_at_ms,p.offer_revision,p.analysis_id,p.offer_id,p.offer_value_fingerprint])))deny();
   if(!countOne(await tx.query(INSERT_CATALOG,[c.tenant_id,c.public_id,c.price_revision,
    c.desired_model,c.desired_capacity,c.desired_condition,JSON.stringify(c.trade_in_models)])))deny();
   if(!countOne(await tx.query(INSERT_CONTEXT,[p.tenant_id,p.public_id,p.offer_revision,
    JSON.stringify([inputs.reviewedCandidate]),JSON.stringify(inputs.tradeInCandidates),
    JSON.stringify(inputs.tradeInPolicy),JSON.stringify(inputs.activeRateProfile)])))deny();
   return Object.freeze({status:'draft',public_id:p.public_id,price_revision:p.price_revision,
    sale_price_minor:p.sale_price_minor,source:draft.source});
  });
 }
 async function approve(command){
  const actor=await authorize('approve');
  return withTransaction(async tx=>{
   // Recompute from the live canonical source, not the staged or client-supplied price.
   const {draft,inputs}=await prepare(tx,actor,command);
   const p=draft.publication,c=draft.catalog;
   const keys=[p.tenant_id,p.public_id,p.price_revision];
   const existing=await tx.query(LOCK_PUBLICATION,keys);
   const cat=await tx.query(LOCK_CATALOG,keys);
   const context=await tx.query(LOCK_CONTEXT,[p.tenant_id,p.public_id,p.offer_revision]);
   if(!countOne(existing)||!countOne(cat)||!countOne(context))deny();
   const e=existing.rows[0],a=cat.rows[0],ctx=context.rows[0];
   if(e.status!=='draft'||e.tenant_id!==p.tenant_id||e.public_id!==p.public_id||
    e.price_revision!==p.price_revision||e.approved_at!=null||e.approved_by!=null||
    e.revoked_at!=null||Number(e.sale_price_minor)!==p.sale_price_minor||
    Number(e.expires_at_ms)!==p.expires_at_ms||e.offer_revision!==p.offer_revision||
    e.analysis_id!==p.analysis_id||e.offer_id!==p.offer_id||
    e.offer_value_fingerprint!==p.offer_value_fingerprint||
    a.desired_model!==c.desired_model||a.desired_capacity!==c.desired_capacity||
    a.desired_condition!==c.desired_condition||
    !same(a.trade_in_models,c.trade_in_models)||
    !same(ctx.offers,[inputs.reviewedCandidate])||
    !same(ctx.trade_in_candidates,inputs.tradeInCandidates)||
    !same(ctx.trade_in_policy,inputs.tradeInPolicy)||
    !same(ctx.rate_profile,inputs.activeRateProfile))deny();
   // Atomic revocation of earlier revisions and publication of this exact one.
   await tx.query(REVOKE_PRIOR,keys);
   if(!countOne(await tx.query(APPROVE,[...keys,actor.user_id])))deny();
   return Object.freeze({status:'published',public_id:p.public_id,
    price_revision:p.price_revision,approved_by:actor.user_id});
  });
 }
 return Object.freeze({enabled:true,stage,approve});
}
module.exports={createUpgradeCatalogPublicationOperator,DENIED,SQL:Object.freeze({
 SOURCE_SQL,LATEST_SQL,INSERT_PUBLICATION,INSERT_CATALOG,INSERT_CONTEXT,
 LOCK_PUBLICATION,LOCK_CATALOG,LOCK_CONTEXT,REVOKE_PRIOR,APPROVE
})};
