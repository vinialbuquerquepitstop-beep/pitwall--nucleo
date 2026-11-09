'use strict';
// WM-01/G6 transactional repository SHADOW. Not imported by any deployed handler.
// Requires a dedicated PostgreSQL pool/role. No implicit env or user token.
const immutable=['tenantId','producer','idempotencyKey','eventId','providerScope','providerMessageId','sourceKind','sourceId','senderId','contentSha256','encryptedPayloadRef','occurredAt'];
function same(saved,p) { return immutable.every(k=>saved[k]===p[k]); }
function asRecord(row) {
 const d=row?.event_snapshot;
 if(!d||typeof d!=='object'||Array.isArray(d))throw Error('PCH_STORED_SNAPSHOT_INVALID');
 return {state:row.state,receiptId:row.receipt_id,tenantId:row.tenant_id,idempotencyKey:row.idempotency_key,eventId:row.event_id,contentSha256:row.content_sha256,snapshot:d};
}
function createPostgresPchReceiverRepository({pool}={}) {
 if(typeof pool?.connect!=='function')throw Error('PCH_POOL_REQUIRED');
 return {
  async acceptAtomic(p) {
   const client=await pool.connect();
   let inTx=false;
   try{
    await client.query('BEGIN');inTx=true;
    // ON CONFLICT waits for concurrent commits on the same unique key.
    // Existing duplicates are read under row lock before verifying all fields.
    await client.query(`INSERT INTO extcalc_pch_shadow.inbox
     (tenant_id,idempotency_key,event_id,content_sha256,event_snapshot)
     VALUES ($1,$2,$3,$4,$5::jsonb)
     ON CONFLICT (tenant_id,idempotency_key) DO NOTHING`,
     [p.tenantId,p.idempotencyKey,p.eventId,p.contentSha256,JSON.stringify(p)]);
    const rows=await client.query(`SELECT tenant_id,idempotency_key,event_id,content_sha256,
       event_snapshot,state,receipt_id FROM extcalc_pch_shadow.inbox
       WHERE tenant_id=$1 AND idempotency_key=$2 FOR UPDATE`,[p.tenantId,p.idempotencyKey]);
    if(rows.rowCount!==1)throw Error('PCH_INBOX_READBACK_FAILED');
    const saved=asRecord(rows.rows[0]);
    if(!same(saved.snapshot,p)||saved.state!=='ACCEPTED'){
      await client.query('ROLLBACK');inTx=false;return {conflict:true};
    }
    await client.query('COMMIT');inTx=false;
    return {record:saved};
   } catch(error){
    if(inTx){try{await client.query('ROLLBACK')}catch{ /* preserve original error */ }}
    throw error;
   } finally {client.release();}
  }
 };
}
module.exports={createPostgresPchReceiverRepository};
