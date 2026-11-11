'use strict';
// Private transaction boundary for one Pitwall V2 organization and one SQL
// capability. Never use the Supabase postgres/service_role credentials here.
// The two DB pools must use different dedicated connection login identities.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES=Object.freeze({ingress:'pw_upgrade_ingress',operator:'pw_upgrade_operator'});
const CHECK=`SELECT current_user AS effective_role, session_user AS login_role,
 row_security_active('pitwall_private.pw_upgrade_requests'::regclass) AS rls_active,
 current_setting('app.pw_upgrade_org_id',true) AS organization_id,
 COALESCE((SELECT NOT (rolsuper OR rolbypassrls) AND rolcanlogin
   FROM pg_roles WHERE rolname=session_user),false) AS login_restricted,
 pg_has_role(session_user,$1,'MEMBER') AS opposite_role_member,
 EXISTS (SELECT 1 FROM pitwall_private.pw_upgrade_service_bindings
  WHERE login_role=session_user::name
    AND organization_id=current_setting('app.pw_upgrade_org_id',true)::uuid
    AND capability=$2) AS binding_matches`;
function deny(){throw Object.assign(new Error('UPGRADE_V2_DB_AUTH_DENIED'),{code:'UPGRADE_V2_DB_AUTH_DENIED'});}
function createUpgradeV2DbScope({pool,organizationId,capability,expectedLoginRole}={}){
 const role=ROLES[capability];
 if(!role||!UUID.test(organizationId||'')||!pool||typeof pool.connect!=='function'||
    typeof expectedLoginRole!=='string'||!/^pw_upgrade_[a-z][a-z0-9_]{2,50}_login$/.test(expectedLoginRole))
  throw Error('UPGRADE_V2_DB_SCOPE_CONFIG_REQUIRED');
 return Object.freeze({
  async withQuery(run){
   if(typeof run!=='function')deny();
   let client,started=false;
   try{
    client=await pool.connect();
    if(!client||typeof client.query!=='function'||typeof client.release!=='function')deny();
    await client.query('BEGIN');
    started=true;
    // Static role names from the allowlist, never request-supplied SQL.
    await client.query('SET LOCAL ROLE '+role);
    await client.query(`SELECT set_config('app.pw_upgrade_org_id',$1,true)`,[organizationId]);
    const opposite=capability==='ingress'?ROLES.operator:ROLES.ingress;
    const state=await client.query(CHECK,[opposite,capability]);
    const verified=Array.isArray(state?.rows)&&state.rows.length===1&&state.rows[0];
    if(!verified||verified.effective_role!==role||verified.login_role!==expectedLoginRole||
       verified.login_restricted!==true||verified.opposite_role_member!==false||
       verified.binding_matches!==true||
       verified.rls_active!==true||verified.organization_id!==organizationId)deny();
    const result=await run({query:(sql,parameters)=>client.query(sql,parameters)});
    await client.query('COMMIT');
    started=false;
    return result;
   }catch(err){
    if(started){try{await client.query('ROLLBACK');}catch{}}
    // Preserve only known domain conflict after a completed rollback; never
    // expose raw SQL errors, authentication failures or internal DB details.
    if(['UPGRADE_INTAKE_CONFLICT','UPGRADE_V2_DB_AUTH_DENIED',
        'UPGRADE_V2_OPERATOR_DENIED','UPGRADE_DELIVERY_UNAUTHORIZED'].includes(err?.code))throw err;
    deny();
   }finally{
    if(client){try{client.release();}catch{}}
   }
  }
 });
}
module.exports={createUpgradeV2DbScope,ROLES,CHECK};
