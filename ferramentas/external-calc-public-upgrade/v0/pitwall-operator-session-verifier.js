'use strict';
// Verify a REAL Pitwall Supabase user session and active org membership.
// The token MUST originate from a trusted operator session, never the public
// Upgrade form. Uses only publishable credentials + caller's Auth JWT.
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ALLOWED_ROLES=new Set(['owner','manager','operator']);
const DENIED='PITWALL_OPERATOR_SESSION_DENIED';
const deny=()=>{throw Object.assign(new Error(DENIED),{code:DENIED});};
function createPitwallOperatorSessionVerifier({
 enabled=false,supabaseUrl,publishableKey,getOperatorAccessToken,fetchImpl=fetch
}={}){
 if(enabled!==true)return async()=>deny();
 let origin;
 try{
  origin=new URL(supabaseUrl);
  if(origin.protocol!=='https:'||origin.username||origin.password||
     origin.search||origin.hash||origin.pathname!=='/')deny();
 }catch(_){deny();}
 if(typeof publishableKey!=='string'||publishableKey.length<8||
    typeof getOperatorAccessToken!=='function'||typeof fetchImpl!=='function')
  throw Error('PITWALL_OPERATOR_VERIFIER_DEPENDENCIES_REQUIRED');
 async function request(path,token){
  try{
   const response=await fetchImpl(new URL(path,origin).toString(),{
    method:'GET',headers:{apikey:publishableKey,authorization:'Bearer '+token,
     accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)
   });
   if(!response?.ok)deny();
   return await response.json();
  }catch(_){deny();}
 }
 return async function authenticateOperator({organizationId}={}){
  if(!UUID.test(organizationId||''))deny();
  let token;
  try{token=await getOperatorAccessToken();}catch(_){deny();}
  if(typeof token!=='string'||token.length<20||token.length>8192||
     /\s/.test(token))deny();
  const user=await request('/auth/v1/user',token);
  if(!user||!UUID.test(user.id||'')||user.is_anonymous===true)deny();
  const query=new URLSearchParams({organization_id:'eq.'+organizationId,
   user_id:'eq.'+user.id,active:'eq.true',select:'organization_id,user_id,role,active',limit:'2'});
  const memberships=await request('/rest/v1/pw_memberships?'+query.toString(),token);
  if(!Array.isArray(memberships)||memberships.length!==1)deny();
  const membership=memberships[0];
  if(membership.user_id!==user.id||membership.organization_id!==organizationId||
     membership.active!==true||!ALLOWED_ROLES.has(membership.role))deny();
  return Object.freeze({verified:true,user_id:user.id,organization_id:organizationId,
   role:membership.role,access_token:token});
 };
}
module.exports={createPitwallOperatorSessionVerifier,DENIED};
