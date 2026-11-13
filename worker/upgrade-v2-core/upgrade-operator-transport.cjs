'use strict';
// Pitwall V2 operator-only transport. Tokens must originate in a trusted
// server session, never in the public form. Not mounted in a public Worker.
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const deny=()=>{throw Object.assign(new Error('UPGRADE_V2_OPERATOR_DENIED'),{code:'UPGRADE_V2_OPERATOR_DENIED'});};
function createUpgradeV2OperatorTransport({supabaseUrl,publishableKey,getOperatorAccessToken,fetchImpl=fetch}={}){
 let base;
 try{const u=new URL(supabaseUrl);if(u.protocol!=='https:'||u.pathname!=='/'||u.search||u.hash||
  u.username||u.password)deny();base=u.origin;}catch{throw Error('UPGRADE_V2_OPERATOR_CONFIG_REQUIRED');}
 if(typeof publishableKey!=='string'||publishableKey.length<8||
  typeof getOperatorAccessToken!=='function'||typeof fetchImpl!=='function')throw Error('UPGRADE_V2_OPERATOR_CONFIG_REQUIRED');
 async function session(){
  let token;try{token=await getOperatorAccessToken();}catch{deny();}
  if(typeof token!=='string'||token.length<20||token.length>8192||/\s/.test(token))deny();
  return token;
 }
 async function api(path,token,method='GET',body){
  let response;
  try{response=await fetchImpl(new URL(path,base).toString(),{
   method,headers:{apikey:publishableKey,authorization:'Bearer '+token,accept:'application/json',
    ...(method==='POST'?{'content-type':'application/json',prefer:'return=representation'}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),
   redirect:'error',signal:AbortSignal.timeout(10000)
  });if(!response?.ok)deny();return await response.json();}catch{deny();}
 }
 async function withOperator({organizationId,run}={}){
  if(!UUID.test(organizationId||'')||typeof run!=='function')deny();
  const token=await session();
  const user=await api('/auth/v1/user',token);
  if(!UUID.test(user?.id||'')||user.is_anonymous===true)deny();
  const qs=new URLSearchParams({select:'user_id,organization_id,role,active',
   organization_id:'eq.'+organizationId,user_id:'eq.'+user.id,active:'eq.true',limit:'2'});
  const memberships=await api('/rest/v1/pw_memberships?'+qs.toString(),token);
  const m=Array.isArray(memberships)&&memberships.length===1?memberships[0]:null;
  if(!m||m.user_id!==user.id||m.organization_id!==organizationId||
    m.active!==true||!['owner','manager','operator'].includes(m.role))deny();
  const identity=Object.freeze({verified:true,user_id:user.id,organization_id:organizationId,role:m.role});
  const transport=Object.freeze({
   async findExistingLeads({organizationId:org,phone}={}){
    if(org!==organizationId||!/^55[0-9]{10,11}$/.test(phone||''))deny();
    const qs=new URLSearchParams({select:'id,organization_id,phone,notes',
     organization_id:'eq.'+org,phone:'eq.'+phone,limit:'3'});
    const rows=await api('/rest/v1/pw_leads?'+qs.toString(),token);
    if(!Array.isArray(rows)||rows.length>2||rows.some(x=>x.organization_id!==org||
     x.phone!==phone||!UUID.test(x.id||'')))deny();
    return rows;
   },
   async createLead({organizationId:org,command}={}){
    if(org!==organizationId||command?.p_org_id!==org||
      typeof command.p_name!=='string'||typeof command.p_phone!=='string')deny();
    const lead=await api('/rest/v1/rpc/pw_s01_create_lead',token,'POST',command);
    if(!lead||Array.isArray(lead)||!UUID.test(lead.id||'')||
     lead.organization_id!==org)deny();
    return lead;
   }
  });
  return run({identity,transport});
 }
 return Object.freeze({withOperator});
}
module.exports={createUpgradeV2OperatorTransport};
