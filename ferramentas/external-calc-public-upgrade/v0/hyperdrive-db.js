'use strict';
// Cloudflare Hyperdrive + node-postgres. The only allowed database queries are
// the reviewed public-catalog read and idempotent lead intake statements.
// A wrong Hyperdrive database user fails before any read or write.
const {SQL:CATALOG}=require('./approved-catalog-repository');
const {INSERT,RECHECK}=require('./upgrade-capture-repository');
const EXPECTED_ROLE='upv1_cf_public';
const ALLOWED=new Map([[CATALOG,1],[INSERT,5],[RECHECK,5]]);
const VALID_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class UpgradeDatabaseUnavailable extends Error{
 constructor(){super('UPGRADE_DATABASE_UNAVAILABLE');this.code='UPGRADE_DATABASE_UNAVAILABLE';}
}
const deny=()=>{throw new UpgradeDatabaseUnavailable();};
function createHyperdriveUpgradeQuery({hyperdrive,Client,tenantId}={}){
 if(typeof hyperdrive?.connectionString!=='string'||!hyperdrive.connectionString.startsWith('postgres')||
    typeof Client!=='function'||!VALID_UUID.test(tenantId||''))
  throw Error('HYPERDRIVE_TRUSTED_BINDING_REQUIRED');
 return async function query(statement,params){
  const count=ALLOWED.get(statement);
  if(count===undefined||!Array.isArray(params)||params.length!==count||
     params[0]!==tenantId)deny();
  // Client connects to Hyperdrive, which handles pooling to Supabase. Never
  // record or expose the connection string in logs, errors or HTTP responses.
  const client=new Client({
   connectionString:hyperdrive.connectionString,
   connectionTimeoutMillis:5000,
   query_timeout:5000,
   application_name:'Pitstop Upgrade V1'
  });
  let connected=false;
  try{
   await client.connect();connected=true;
   const role=await client.query({text:'SELECT current_user AS db_role',values:[]});
   if(!Array.isArray(role?.rows)||role.rows.length!==1||
      role.rows[0]?.db_role!==EXPECTED_ROLE)deny();
   const result=await client.query({text:statement,values:params});
   if(!Array.isArray(result?.rows))deny();
   return {rows:result.rows};
  }catch(_){deny();}
  finally{
   if(connected){try{await client.end();}catch(_){}}
  }
 };
}
module.exports={createHyperdriveUpgradeQuery,UpgradeDatabaseUnavailable,EXPECTED_ROLE};
