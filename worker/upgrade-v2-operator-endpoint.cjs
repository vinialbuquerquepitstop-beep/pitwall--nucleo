'use strict';
// UP-CRM-01: OPERATOR-ONLY CRM reconciliation in the EXISTING Worker.
// This is not the public intake route. Separate V2 DB role, flag and Hyperdrive.
// It never accepts an organization, CRM URL, or SQL credential from request JSON.
const {createUpgradeV2DbScope}=require('./upgrade-v2-core/upgrade-db-scope.cjs');
const {createUpgradeV2OperatorJob}=require('./upgrade-v2-core/upgrade-operator-job.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ROLE=/^pw_upgrade_[a-z][a-z0-9_]{2,50}_login$/;
const PATH='/api/upgrade/v1/operator/reconcile';
const reply=(status,code,payload={})=>new Response(JSON.stringify({
 ok:status===200,code,...payload
}),{status,headers:{'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store','x-content-type-options':'nosniff'}});
function createUpgradeV2OperatorEndpoint({env,Client,fetchImpl=fetch}={}){
 const disabled=Object.freeze({handle:async()=>reply(404,'NOT_FOUND')});
 if(env?.UPGRADE_V2_OPERATOR_ENABLED!=='true')return disabled;
 const binding=env.UPGRADE_V2_DB_OPERATOR;
 const org=env.UPGRADE_V2_ORGANIZATION_ID;
 const login=env.UPGRADE_V2_OPERATOR_LOGIN_ROLE;
 const v2Url=env.PITWALL_V2_SUPABASE_URL;
 const key=env.PITWALL_V2_PUBLISHABLE_KEY;
 const expectedOrigin=env.UPGRADE_EXPECTED_ORIGIN;
 const ingress=env.UPGRADE_V2_DB_INGRESS;
 // Ensure physical independence of capability bindings.
 if(typeof Client!=='function'||typeof binding?.connectionString!=='string'||
  !/^postgres(?:ql)?:\/\//.test(binding.connectionString)||
  !UUID.test(org||'')||!ROLE.test(login||'')||
  typeof ingress?.connectionString!=='string'||
  binding.connectionString===ingress.connectionString||
  !/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(expectedOrigin||'')||
  !/^https:\/\/[a-z0-9.-]+(?::443)?\/?$/i.test(v2Url||'')||
  typeof key!=='string'||key.length<8||
  typeof fetchImpl!=='function')
   return Object.freeze({handle:async()=>reply(503,'UPGRADE_V2_OPERATOR_NOT_CONFIGURED')});
 const pool={async connect(){
  const client=new Client({connectionString:binding.connectionString,
   connectionTimeoutMillis:5000,query_timeout:5000,application_name:'Pitwall Upgrade V2 CRM Delivery'});
  try{await client.connect();}catch{
   try{await client.end();}catch{}
   throw Error('UPGRADE_V2_OPERATOR_DB_UNAVAILABLE');
  }
  return {query:(sql,params)=>client.query(sql,params),release:()=>client.end()};
 }};
 const scope=createUpgradeV2DbScope({
  pool,organizationId:org,capability:'operator',expectedLoginRole:login
 });
 return Object.freeze({async handle(request){
  let url;
  try{url=new URL(request.url);}catch{return reply(400,'UPGRADE_V2_INVALID_REQUEST');}
  if(request.method!=='POST'||url.pathname!==PATH||url.search||
   url.origin!==expectedOrigin)return reply(404,'NOT_FOUND');
  // The existing client app may invoke this only with an authenticated
  // Pitwall V2 operator JWT; this endpoint has no browser credentials/CORS.
  const auth=request.headers.get('authorization')||'';
  if(!/^Bearer [^\s]{20,8192}$/.test(auth))return reply(401,'UPGRADE_V2_OPERATOR_UNAUTHORIZED');
  const contentType=request.headers.get('content-type')||'';
  if(!/^application\/json(?:\s*;|\s*$)/i.test(contentType))
   return reply(415,'UPGRADE_V2_UNSUPPORTED_MEDIA_TYPE');
  const size=request.headers.get('content-length');
  if(size!==null&&(!/^\d+$/.test(size)||Number(size)>512))
   return reply(413,'UPGRADE_V2_PAYLOAD_TOO_LARGE');
  let buf;
  try{
   const reader=request.body?.getReader();if(!reader)return reply(400,'UPGRADE_V2_INVALID_REQUEST');
   let total=0,chunks=[];
   try{for(;;){const {done,value}=await reader.read();if(done)break;
    total+=value.byteLength;if(total>512)return reply(413,'UPGRADE_V2_PAYLOAD_TOO_LARGE');
    chunks.push(value);
   }}finally{try{await reader.cancel();}catch{}}
   buf=new Uint8Array(total);let pos=0;
   for(const c of chunks){buf.set(c,pos);pos+=c.byteLength;}
  }catch{return reply(400,'UPGRADE_V2_INVALID_REQUEST');}
  let body;
  try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buf));}
  catch{return reply(400,'UPGRADE_V2_INVALID_REQUEST');}
  if(!body||typeof body!=='object'||Array.isArray(body)||
   Object.keys(body).length!==1||!UUID.test(body.request_id||''))
   return reply(400,'UPGRADE_V2_INVALID_REQUEST');
  const token=auth.slice(7);
  try{
   // Perform Auth + membership checks before acquiring a DB connection.
   const result=await createUpgradeV2OperatorJob({
    enabled:true,organizationId:org,withQuery:scope.withQuery,
    supabaseUrl:v2Url,publishableKey:key,
    getOperatorAccessToken:async()=>token,fetchImpl
   }).deliver({requestId:body.request_id});
   if(result?.linked!==true||!UUID.test(result.lead_id||''))
    return reply(503,'UPGRADE_V2_RECONCILIATION_UNAVAILABLE');
   return reply(200,'UPGRADE_V2_LINKED',{
    request_id:body.request_id,lead_id:result.lead_id,already_linked:result.already_linked===true
   });
  }catch(e){
   if(['UPGRADE_V2_OPERATOR_DENIED','UPGRADE_DELIVERY_UNAUTHORIZED'].includes(e?.code))
    return reply(403,'UPGRADE_V2_OPERATOR_UNAUTHORIZED');
   if(e?.code==='UPGRADE_DELIVERY_REVIEW_REQUIRED')
    return reply(409,'UPGRADE_V2_REVIEW_REQUIRED');
   return reply(503,'UPGRADE_V2_RECONCILIATION_UNAVAILABLE');
  }
 }});
}
module.exports={createUpgradeV2OperatorEndpoint,PATH};
