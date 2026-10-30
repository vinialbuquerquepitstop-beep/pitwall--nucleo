// Staging-only PostgreSQL transport. Never use a browser-provided connection string.
// Hyperdrive holds the credential for the least-privilege Neon application role.
import pg from 'pg';
import transactionModule from '../ingress-transaction-v0.cjs';
const {acceptIngress}=transactionModule;
export async function acceptViaHyperdrive(env,event){
 if(!env?.HYPERDRIVE?.connectionString)throw Error('HYPERDRIVE_NOT_BOUND');
 const client=new pg.Client({connectionString:env.HYPERDRIVE.connectionString});
 await client.connect();
 try{
  const identity=await client.query("SELECT current_user AS role, (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass");
  if(identity.rows.length!==1||!['pch_app_a_login','pch_app_b_login'].includes(identity.rows[0].role)||identity.rows[0].bypass!==false)throw Error('UNSAFE_DATABASE_IDENTITY');
  // Reject untrusted or cross-tenant events before any INSERT; DB RLS remains the final defense.
  const mappings=await client.query('SELECT tenant_binding_ref FROM ingress_tenant_role_bindings');
  if(mappings.rows.length!==1||typeof event?.tenant_binding_ref!=='string'||mappings.rows[0].tenant_binding_ref!==event.tenant_binding_ref)throw Error('TENANT_BINDING_MISMATCH');
  if(event.route==='CRM_CANDIDATE')throw Error('CRM_INGRESS_DISABLED');
  // The existing transaction adapter expects a pool-style connect()/release() contract.
  const pool={connect:async()=>({query:(...args)=>client.query(...args),release:()=>{}})};
  return await acceptIngress(pool,event);
 }finally{await client.end();}
}
