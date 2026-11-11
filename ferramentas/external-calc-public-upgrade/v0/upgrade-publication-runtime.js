'use strict';
// Private operator composition, not imported by the public Worker.
// The identity provider MUST authenticate a live operator session; a client
// body containing a user_id is not identity.
const {createUpgradeCatalogPublicationOperator}=require('./upgrade-catalog-publication-operator');
const {createUpgradeTrustedCalcSource}=require('./upgrade-trusted-calc-source');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MEMBER_SQL=`SELECT id,tenant_id,papel,ativo FROM public.app_usuario
 WHERE id=$1::uuid LIMIT 2 FOR SHARE`;
const DENIED='PUBLICATION_OPERATOR_AUTH_REQUIRED';
const deny=()=>{throw Object.assign(new Error(DENIED),{code:DENIED});};
function createUpgradePublicationRuntime({
 enabled=false,pool,authenticateOperator,loadCalculationProfile,loadTradeInCandidates,clock
}={}){
 if(enabled!==true)return createUpgradeCatalogPublicationOperator();
 if(!pool||typeof pool.connect!=='function'||typeof authenticateOperator!=='function'||
    (loadTradeInCandidates!=null&&typeof loadTradeInCandidates!=='function'))
  throw Error('PRIVATE_PUBLICATION_RUNTIME_DEPENDENCIES_REQUIRED');
 const loadTrustedCalcInputs=createUpgradeTrustedCalcSource({
  enabled:true,loadCalculationProfile,loadTradeInCandidates
 });
 async function withTransaction(fn){
  const client=await pool.connect();
  if(!client||typeof client.query!=='function'||typeof client.release!=='function')deny();
  let begun=false;
  try{
   await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
   begun=true;
   const result=await fn({query:(sql,params)=>client.query(sql,params)});
   await client.query('COMMIT');
   begun=false;
   return result;
  }catch(_){
   if(begun){try{await client.query('ROLLBACK');}catch(_){}}
   deny();
  }finally{client.release();}
 }
 async function authorizeOperator({action,tx}){
  if(!['stage','approve'].includes(action)||!tx||typeof tx.query!=='function')deny();
  // The supplied function must validate the operator's session server-side.
  // Never use a user id, token claims, or role submitted with an Upgrade form.
  const auth=await authenticateOperator({action});
  if(!auth||auth.verified!==true||!UUID.test(auth.user_id||''))deny();
  const members=await tx.query(MEMBER_SQL,[auth.user_id]);
  if(!Array.isArray(members?.rows)||members.rows.length!==1)deny();
  const row=members.rows[0];
  if(row.id!==auth.user_id||row.ativo!==true||
    !UUID.test(row.tenant_id||'')||!['dono','validador'].includes(row.papel))deny();
  return {authenticated:true,user_id:row.id,tenant_id:row.tenant_id,role:row.papel};
 }
 return createUpgradeCatalogPublicationOperator({
  enabled:true,withTransaction,authorizeOperator,loadTrustedCalcInputs,clock
 });
}
module.exports={createUpgradePublicationRuntime,MEMBER_SQL,DENIED};
