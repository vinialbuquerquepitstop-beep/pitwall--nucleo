'use strict';
// PostgreSQL transaction adapter. Requires a pg-compatible pool with connect().
// The caller MUST resolve and authorize tenant, receiver and sender server-side.
const crypto=require('node:crypto');
const ROUTES={IGNORE:null,SUPPLIER_EXTERNAL_CALC:'external_calc',CRM_CANDIDATE:'pitwall_crm',HOLD_REVIEW:'human_review'};
const valid=x=>typeof x==='string' && x.length>0 && x.length<=512;
async function acceptIngress(pool,event){
 if(!pool||typeof pool.connect!=='function')throw Error('POOL_REQUIRED');
 const keys=['id','provider_scope_id','phone_number_id','provider_message_id','tenant_binding_ref','routing_policy_version','original_sha256'];
 if(!event||keys.some(k=>!valid(event[k]))||!Object.hasOwn(ROUTES,event.route)||!/^[a-f0-9]{64}$/.test(event.original_sha256))throw Error('INVALID_AUTHORIZED_EVENT');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const identity=[event.provider_scope_id,event.phone_number_id,event.provider_message_id];
  const ins=await client.query(`INSERT INTO ingress_events (id,provider,provider_scope_id,phone_number_id,provider_message_id,tenant_binding_ref,routing_policy_version,route,original_sha256,state) VALUES($1,'meta_cloud_api',$2,$3,$4,$5,$6,$7,$8,'RECEIVED') ON CONFLICT (provider,provider_scope_id,phone_number_id,provider_message_id) DO NOTHING RETURNING id`,
  [event.id,...identity,event.tenant_binding_ref,event.routing_policy_version,event.route,event.original_sha256]);
  if(ins.rows.length===0){
   // Immutable identity is protected by the UNIQUE constraint. Do not request FOR UPDATE:
   // restricted ingest roles have SELECT/INSERT only (no UPDATE privilege).
   // The conflicting INSERT already waits for the competing writer's outcome.
   const q=await client.query(`SELECT id,tenant_binding_ref,routing_policy_version,route,original_sha256 FROM ingress_events WHERE provider='meta_cloud_api' AND provider_scope_id=$1 AND phone_number_id=$2 AND provider_message_id=$3`,identity);
   const r=q.rows[0];
   if(!r||r.tenant_binding_ref!==event.tenant_binding_ref||r.routing_policy_version!==event.routing_policy_version||r.route!==event.route||r.original_sha256!==event.original_sha256)throw Error('IDENTITY_CONTENT_CONFLICT');
   await client.query('COMMIT');return {status:'DUPLICATE',inbox_id:r.id};
  }
  if(event.route!=='IGNORE'){
   await client.query(`INSERT INTO ingress_outbox(id,ingress_event_id,destination,state) VALUES($1,$2,$3,'PENDING')`,[crypto.randomUUID(),event.id,ROUTES[event.route]]);
  }
  await client.query('COMMIT');return {status:'INSERTED',inbox_id:event.id};
 }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
}
module.exports={acceptIngress};
