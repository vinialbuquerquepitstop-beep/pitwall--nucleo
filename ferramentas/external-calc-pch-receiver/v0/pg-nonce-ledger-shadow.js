'use strict';
// G11 isolated Postgres nonce ledger, no runtime route registration.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function createPgNonceLedger({pool}={}){
 if(typeof pool?.connect!=='function')throw Error('PCH_NONCE_POOL_REQUIRED');
 return {
  async reserveOnce({keyId,tenantId,nonce,expiresAt}={}){
   if(typeof keyId!=='string'||!/^[A-Za-z0-9_-]{3,64}$/.test(keyId)||
      typeof tenantId!=='string'||!UUID.test(tenantId)||
      typeof nonce!=='string'||!/^[0-9a-f]{32}$/.test(nonce)||
      !Number.isSafeInteger(expiresAt)||expiresAt<=0)throw Error('PCH_NONCE_INVALID');
   const client=await pool.connect();let inTx=false;
   try{
    await client.query('BEGIN');inTx=true;
    await client.query("SELECT set_config('app.pch_tenant_id', $1, true)",[tenantId]);
    const rows=await client.query(`INSERT INTO extcalc_pch_shadow.nonce_ledger
      (tenant_id,key_id,nonce,expires_at)
      VALUES ($1,$2,$3,to_timestamp($4::double precision / 1000.0))
      ON CONFLICT (key_id,nonce) DO NOTHING
      RETURNING nonce`,[tenantId,keyId,nonce,expiresAt]);
    if(rows.rowCount!==0&&rows.rowCount!==1)throw Error('PCH_NONCE_RESULT_INVALID');
    await client.query('COMMIT');inTx=false;
    return rows.rowCount===1;
   }catch(error){
    if(inTx){try{await client.query('ROLLBACK')}catch{}}
    throw error;
   }finally{client.release()}
  }
 };
}
module.exports={createPgNonceLedger};
