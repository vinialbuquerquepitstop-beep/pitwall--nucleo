'use strict';
// Trusted Pitwall V2 REST adapter. Operator access token is supplied only by
// the authenticated server session; never by public Upgrade form fields.
// Supabase RLS and the Pitwall RPC remain the authority for org membership.
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const DENIED='CRM_V2_AUTHENTICATED_TRANSPORT_UNAVAILABLE';
const deny=()=>{throw Object.assign(new Error(DENIED),{code:DENIED});};
function createPitwallCrmOperatorTransport({enabled=false,supabaseUrl,publishableKey,getOperatorAccessToken,fetchImpl=fetch}={}){
 if(enabled!==true)return Object.freeze({findExistingLeads:async()=>deny(),authenticatedOperatorRpc:async()=>deny()});
 let origin;
 try{
  origin=new URL(supabaseUrl);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')deny();
 }catch(_){deny();}
 if(typeof publishableKey!=='string'||!publishableKey.trim()||
 typeof getOperatorAccessToken!=='function'||typeof fetchImpl!=='function')
  throw Error('CRM_V2_OPERATOR_TRANSPORT_DEPENDENCIES_REQUIRED');
 async function rest(path,{method='GET',body}={}){
  const accessToken=await getOperatorAccessToken();
  if(typeof accessToken!=='string'||accessToken.length<20||
   accessToken.length>8192||/\s/.test(accessToken))deny();
  let response,payload;
  try{
   response=await fetchImpl(new URL(path,origin).toString(),{
    method,headers:{apikey:publishableKey,authorization:'Bearer '+accessToken,
     'content-type':'application/json',accept:'application/json',
     ...(method==='POST'?{prefer:'return=representation'}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    redirect:'error',signal:AbortSignal.timeout(10000)
   });
   if(!response||!response.ok)deny();
   payload=await response.json();
  }catch(_){deny();}
  return payload;
 }
 return Object.freeze({
  async findExistingLeads({organizationId,whatsapp}={}){
   if(!UUID.test(organizationId||'')||!/^55[0-9]{10,11}$/.test(whatsapp||''))deny();
   const query=new URLSearchParams({organization_id:'eq.'+organizationId,phone:'eq.'+whatsapp,
    select:'id,organization_id,phone,notes',limit:'3'});
   const results=await rest('/rest/v1/pw_leads?'+query.toString());
   if(!Array.isArray(results)||results.length>2||
    results.some(x=>x.organization_id!==organizationId||x.phone!==whatsapp||!UUID.test(x.id||'')))deny();
   return results;
  },
  async authenticatedOperatorRpc(method,command){
   if(method!=='pw_s01_create_lead'||!command||!UUID.test(command.p_org_id||'')||
    typeof command.p_name!=='string'||typeof command.p_phone!=='string')deny();
   const response=await rest('/rest/v1/rpc/pw_s01_create_lead',{method:'POST',body:command});
   if(!response||Array.isArray(response)||!UUID.test(response.id||'')||
    response.organization_id!==command.p_org_id)deny();
   return response;
  }
 });
}
module.exports={createPitwallCrmOperatorTransport,DENIED};
