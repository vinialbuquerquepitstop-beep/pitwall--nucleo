'use strict';
// Isolated Hyperdrive diagnostic. No other Upgrade module is imported.
// Explicitly off unless two independent dashboard controls are configured.
const PROBE_PATH='/api/upgrade/v1/_db-probe';
const SQL_ROLE='SELECT current_user AS db_role';
const SQL_READ='SELECT desired_model FROM privado.extcalc_upgrade_public_catalog_v1 LIMIT 1';
const expectedRole='upv1_cf_public';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(status,code)=>new Response(JSON.stringify({ok:status===200,code}),{status,headers});
function createPrivateHyperdriveProbe({env,Client,subtle=globalThis.crypto?.subtle}={}){
 return async function probe(request){
  if(env?.UPGRADE_DB_PROBE_ENABLED!=='true'||request.method!=='POST'||
     typeof env.UPGRADE_DB_PROBE_TOKEN!=='string'||env.UPGRADE_DB_PROBE_TOKEN.length<32||
     !/^[A-Za-z0-9_-]{32,128}$/.test(env.UPGRADE_DB_PROBE_TOKEN)||
     !subtle?.digest)return json(404,'NOT_FOUND');
  const bearer=request.headers.get('authorization')||'';
  if(!/^Bearer [A-Za-z0-9_-]{32,128}$/.test(bearer))return json(404,'NOT_FOUND');
  const encoder=new TextEncoder();
  const [supplied,authorized]=await Promise.all([
   subtle.digest('SHA-256',encoder.encode(bearer.slice(7))),
   subtle.digest('SHA-256',encoder.encode(env.UPGRADE_DB_PROBE_TOKEN))
  ]);
  const a=new Uint8Array(supplied),b=new Uint8Array(authorized);let different=0;
  for(let i=0;i<a.length;i++)different|=a[i]^b[i];
  if(different)return json(404,'NOT_FOUND');
  // Infrastructure state is revealed only AFTER successful operator authentication.
  // This avoids confusing a missing driver/binding with an invalid bearer token.
  if(typeof env.UPGRADE_DB?.connectionString!=='string')
   return json(503,'DB_BINDING_UNAVAILABLE');
  if(typeof Client!=='function')
   return json(503,'DB_DRIVER_UNAVAILABLE');
  let client,connected=false;
  try{
   client=new Client({connectionString:env.UPGRADE_DB.connectionString,connectionTimeoutMillis:5000,query_timeout:5000,application_name:'Pitstop Upgrade DB Probe'});
   await client.connect();connected=true;
   const role=await client.query({text:SQL_ROLE,values:[]});
   if(role?.rows?.length!==1||role.rows[0]?.db_role!==expectedRole)throw Error('WRONG_ROLE');
   const result=await client.query({text:SQL_READ,values:[]});
   if(!Array.isArray(result?.rows))throw Error('UNREADABLE_CATALOG');
   return json(200,'DB_CONNECTION_VERIFIED');
  }catch(_){return json(503,'DB_CONNECTION_UNAVAILABLE');}
  finally{if(connected)try{await client.end();}catch(_){}}
 };
}
module.exports={createPrivateHyperdriveProbe,PROBE_PATH,SQL_ROLE,SQL_READ};
