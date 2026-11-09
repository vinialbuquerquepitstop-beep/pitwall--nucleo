'use strict';
// WM-01/G6 transactional repository SHADOW. Not imported by any deployed handler.
// Requires a dedicated PostgreSQL pool/role. No implicit env or user token.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validTenant(p){if(!p||typeof p.tenantId!=='string'||!UUID.test(p.tenantId))throw Error('PCH_TENANT_UUID_REQUIRED');}
async function bindTenant(client,p){
 await client.query("SELECT set_config('app.pch_tenant_id', $1, true)",[p.tenantId]);
}
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
  async findReceipt(p) {
   validTenant(p);
   const client=await pool.connect();
   let inTx=false;
   try{
    await client.query('BEGIN READ ONLY');inTx=true;
    await bindTenant(client,p);
    const rows=await client.query(`SELECT tenant_id,idempotency_key,event_id,
      content_sha256,event_snapshot,state,receipt_id
      FROM extcalc_pch_shadow.inbox
      WHERE tenant_id=$1 AND idempotency_key=$2`,[p.tenantId,p.idempotencyKey]);
    let result;
    if(rows.rowCount===0)result={record:null};
    else if(rows.rowCount!==1)throw Error('PCH_INBOX_IDENTITY_NOT_UNIQUE');
    else {
      const saved=asRecord(rows.rows[0]);
      result=(!same(saved.snapshot,p)||saved.state!=='ACCEPTED')?{conflict:true}:{record:saved};
    }
    await client.query('COMMIT');inTx=false;
    return result;
   } catch(error) {
    if(inTx){try{await client.query('ROLLBACK')}catch{}}
    throw error;
   } finally {client.release();}
  },
  async acceptAtomic(p) {
   validTenant(p);
   const client=await pool.connect();
   let inTx=false;
   try{
    await client.query('BEGIN');inTx=true;
    await bindTenant(client,p);
    // ON CONFLICT waits for concurrent commits on the same unique key.
    // A unique-key conflict serializes concurrent inserts. Only SELECT and INSERT
    // are granted to the restricted role; do not use FOR UPDATE (requires UPDATE privilege).
    // The inbox is append-only and its immutable snapshot is fully compared.
    await client.query(`INSERT INTO extcalc_pch_shadow.inbox
     (tenant_id,idempotency_key,event_id,content_sha256,event_snapshot)
     VALUES ($1,$2,$3,$4,$5::jsonb)
     ON CONFLICT (tenant_id,idempotency_key) DO NOTHING`,
     [p.tenantId,p.idempotencyKey,p.eventId,p.contentSha256,JSON.stringify(p)]);
    const rows=await client.query(`SELECT tenant_id,idempotency_key,event_id,content_sha256,
       event_snapshot,state,receipt_id FROM extcalc_pch_shadow.inbox
       WHERE tenant_id=$1 AND idempotency_key=$2 `,[p.tenantId,p.idempotencyKey]);
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
