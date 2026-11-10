'use strict';
// Optional operator-only live Hyperdrive smoke. Disabled by default and never
// returns rows, SQL errors, tenant identifiers or connection strings.
const {EXPECTED_ROLE}=require('./hyperdrive-db');
// Refer to an explicitly granted column: the scoped DB role has column-level SELECT, not table-wide SELECT.
const STATIC_QUERY='SELECT desired_model FROM privado.extcalc_upgrade_public_catalog_v1 LIMIT 1';
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const response=(status,code)=>new Response(JSON.stringify(status===200?{ok:true,code:'DB_CONNECTION_VERIFIED'}:{ok:false,code}),{status,headers:HEADERS});
function createHyperdriveOperatorProbe({env,Client,subtle=globalThis.crypto?.subtle}={}){
 const disabled=()=>response(404,'NOT_FOUND');
 return async function handle(request){
  if(env?.UPGRADE_DB_PROBE_ENABLED!=='true')return disabled();
  if(request.method!=='POST')return disabled();
  if(typeof env.UPGRADE_DB_PROBE_TOKEN!=='string'||env.UPGRADE_DB_PROBE_TOKEN.length<32||
     typeof env.UPGRADE_DB?.connectionString!=='string'||typeof Client!=='function'||
     !subtle||typeof subtle.digest!=='function')return disabled();
  const raw=request.headers.get('authorization')||'';
  if(!/^Bearer [A-Za-z0-9_-]{32,128}$/.test(raw))return disabled();
  // Compare fixed-length digests rather than comparing the raw token.
  const enc=new TextEncoder();
  const [provided,expected]=await Promise.all([
   subtle.digest('SHA-256',enc.encode(raw.slice(7))),
   subtle.digest('SHA-256',enc.encode(env.UPGRADE_DB_PROBE_TOKEN))
  ]);
  const a=new Uint8Array(provided),b=new Uint8Array(expected);
  let diff=0;for(let i=0;i<32;i++)diff|=a[i]^b[i];
  if(diff!==0)return disabled();
  let client,connected=false;
  try{
   client=new Client({
    connectionString:env.UPGRADE_DB.connectionString,
    connectionTimeoutMillis:5000,query_timeout:5000,
    application_name:'Pitstop Upgrade DB Probe'
   });
   await client.connect();connected=true;
   const who=await client.query({text:'SELECT current_user AS db_role',values:[]});
   if(who?.rows?.length!==1||who.rows[0]?.db_role!==EXPECTED_ROLE)throw Error('ROLE_NOT_VERIFIED');
   const read=await client.query({text:STATIC_QUERY,values:[]});
   if(!Array.isArray(read?.rows))throw Error('CATALOG_READ_NOT_VERIFIED');
   return response(200,'DB_CONNECTION_VERIFIED');
  }catch(_){return response(503,'DB_CONNECTION_UNAVAILABLE');}
  finally{if(connected)try{await client.end();}catch(_){}}
 };
}
module.exports={createHyperdriveOperatorProbe,STATIC_QUERY};
