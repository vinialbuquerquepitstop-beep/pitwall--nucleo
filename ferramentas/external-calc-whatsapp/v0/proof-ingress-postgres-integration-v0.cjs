'use strict';
// Run ONLY against dedicated ingress staging with an explicitly authorized least-privilege role.
// Usage: PCH_STAGING_DATABASE_URL=... node proof-ingress-postgres-integration-v0.cjs
// Requires npm package pg. Do not print connection details or message contents.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {acceptIngress}=require('./ingress-transaction-v0.cjs');
async function main(){
 if(!process.env.PCH_STAGING_DATABASE_URL)throw Error('NOT_RUN: dedicated staging credential required');
 const {Pool}=require('pg');
 const pool=new Pool({connectionString:process.env.PCH_STAGING_DATABASE_URL,ssl:{rejectUnauthorized:true},max:8});
 const probe=await pool.query(`SELECT current_user, current_database() AS db, 
 (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('ingress_events','ingress_outbox') AND c.relrowsecurity AND c.relforcerowsecurity) AS rls_count,
 (SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND tablename IN ('ingress_events','ingress_outbox')) AS policy_count`);
 const gate=probe.rows[0];
 if(gate.current_user==='neondb_owner'||gate.rls_count!==2||gate.policy_count<2)throw Error('NOT_RUN: role or RLS security gate incomplete');
 const n=crypto.randomUUID(),scope='wm034-staging-'+n;
 const root={id:crypto.randomUUID(),provider_scope_id:scope,phone_number_id:'synthetic-receiver',provider_message_id:'wamid.'+n,tenant_binding_ref:process.env.PCH_AUTHORIZED_TENANT_BINDING,route:'SUPPLIER_EXTERNAL_CALC',routing_policy_version:'wm034-integration-test',original_sha256:crypto.createHash('sha256').update('synthetic payload').digest('hex')};
 if(!root.tenant_binding_ref)throw Error('NOT_RUN: tenant binding required');
 try{
  const results=await Promise.allSettled(Array.from({length:12},()=>acceptIngress(pool,{...root,id:crypto.randomUUID()})));
  assert.ok(results.every(r=>r.status==='fulfilled'),'concurrent ingestion failed');
  assert.equal(results.filter(r=>r.value.status==='INSERTED').length,1);
  assert.equal(results.filter(r=>r.value.status==='DUPLICATE').length,11);
  const counts=await pool.query(`SELECT (SELECT count(*)::int FROM ingress_events WHERE provider_scope_id=$1) AS inbox,(SELECT count(*)::int FROM ingress_outbox o JOIN ingress_events i ON i.id=o.ingress_event_id WHERE i.provider_scope_id=$1) AS outbox`,[scope]);
  assert.deepEqual([counts.rows[0].inbox,counts.rows[0].outbox],[1,1]);
  await assert.rejects(()=>acceptIngress(pool,{...root,id:crypto.randomUUID(),original_sha256:'f'.repeat(64)}),/IDENTITY_CONTENT_CONFLICT/);
  console.log('PASS postgres concurrent 12 deliveries: inbox=1 outbox=1');
  console.log('PASS postgres divergent replay: rejected');
  console.log('PASS same-tenant RLS visibility for synthetic scope');
 }finally{await pool.end();}
}
main().catch(e=>{console.error('GATE_FAIL',e.message);process.exitCode=1;});
