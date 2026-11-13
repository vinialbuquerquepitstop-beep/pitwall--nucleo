'use strict';
const {createReplayConsumer}=require('./replay-store');
// Dedicated, restricted PostgreSQL pool only. Never a browser/Supabase user token.
const CLAIM_SQL=`INSERT INTO privado.extcalc_upgrade_nonce_ledger_v0
 (nonce_digest, tenant_id, expires_at)
 VALUES ($1, $2::uuid, to_timestamp($3::double precision / 1000.0))
 ON CONFLICT (nonce_digest) DO NOTHING
 RETURNING nonce_digest`;
function createPostgresReplayConsumer({pool,clock=()=>Date.now()}={}){
 if(!pool||typeof pool.query!=='function')throw new Error('DEDICATED_PG_POOL_REQUIRED');
 return createReplayConsumer({clock,atomicInsert:async({digest,tenantId,expiresAtMs})=>{
  const r=await pool.query(CLAIM_SQL,[digest,tenantId,expiresAtMs]);
  if(!r||!Array.isArray(r.rows)||!Number.isInteger(r.rowCount)||r.rows.length!==r.rowCount||r.rowCount<0||r.rowCount>1)throw new Error('DB_RESULT_INVALID');
  return r.rowCount===1;
 }});
}
module.exports={createPostgresReplayConsumer,CLAIM_SQL};
