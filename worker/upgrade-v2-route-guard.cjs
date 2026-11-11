'use strict';
// UP-CRM-01: explicit V2-only gate on the EXISTING Cloudflare Worker.
// Public Upgrade routes must never silently fall back to the External Calc
// capture database. A missing V2 provider is an operational block, not 202.
const V2_PATHS=new Set(['/api/upgrade/v1/lead','/api/upgrade/v1/catalog','/api/upgrade/v1/quote']);
const response=(status,code)=>new Response(JSON.stringify({ok:false,code}),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff'}
});
function createUpgradeV2Gate({enabled=false,handleV2}={}){
 return Object.freeze({
  matches(path){return typeof path==='string'&&path.startsWith('/api/upgrade/v1/');},
  async handle(request){
   let path;
   try{path=new URL(request.url).pathname;}catch{return response(400,'BAD_REQUEST');}
   if(!V2_PATHS.has(path))return response(404,'NOT_FOUND');
   // Both flags are mandatory. The legacy UPGRADE_PUBLIC_ENABLED is ignored.
   if(enabled!==true)return response(404,'NOT_FOUND');
   // An operator must deliberately inject the trusted, approved V2 ingress.
   // No URL, identity, or DB key comes from the anonymous request.
   if(typeof handleV2!=='function')return response(503,'UPGRADE_V2_NOT_CONNECTED');
   if(path!=='/api/upgrade/v1/lead')return response(503,'UPGRADE_V2_NOT_CONNECTED');
   try{
    const result=await handleV2(request);
    if(!(result instanceof Response))throw Error('INVALID_UPGRADE_V2_RESPONSE');
    return result;
   }catch{return response(503,'UPGRADE_V2_UNAVAILABLE');}
  }
 });
}
module.exports={createUpgradeV2Gate};
