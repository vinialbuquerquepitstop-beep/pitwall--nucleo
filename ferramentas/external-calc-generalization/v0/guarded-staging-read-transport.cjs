'use strict';
// VS5.3h: OPTIONAL staging-only PostgREST metadata probe.
// Never wired to the production runtime; no source storage implementation.
// Configuring this adapter is NOT authorization to use a Supabase project.
const KNOWN_PRODUCTION_PROJECTS=Object.freeze(['unjzpyexgtbcmjfgcqrx']);
const PROJECT=/^[a-z]{20}$/;
const TABLE=/^extcalc_[a-z0-9_]+_probe_v0$/;
const REF=/^[A-Za-z0-9_.:-]{3,160}$/;
const FIELDS=Object.freeze(['tenant_id','source_ref','source_contract_version',
 'source_type','immutability','state','content_sha256']);
const fail=()=>new Error('VS53H_STAGING_TRANSPORT_DENIED');
function unpackJWT(token,project,now){
 if(typeof token!=='string'||token.length<20||token.length>16384)throw fail();
 const parts=token.split('.');
 if(parts.length!==3||parts.some(x=>!x))throw fail();
 let claim;
 try{claim=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'))}
 catch{throw fail()}
 // This check is only an early guard. Supabase MUST validate the JWT signature
 // and grants in the real target database; these fields are untrusted here.
 if(!claim||claim.role!=='authenticated'||
    typeof claim.sub!=='string'||
    !/^[a-f0-9-]{36}$/i.test(claim.sub)||
    !Number.isFinite(claim.exp)||claim.exp<=now||
    claim.iss!=='https://'+project+'.supabase.co/auth/v1')
   throw fail();
 return claim.sub;
}
function createGuardedStagingReadProbe({project_ref,approved_staging_ref,
 table_name,publishable_key,jwt_a,jwt_b,fetchImpl,nowSeconds}={}){
 if(typeof project_ref!=='string'||!PROJECT.test(project_ref)||
    KNOWN_PRODUCTION_PROJECTS.includes(project_ref)||
    approved_staging_ref!==project_ref||
    typeof table_name!=='string'||!TABLE.test(table_name)||
    typeof publishable_key!=='string'||!publishable_key.startsWith('sb_publishable_')||
    publishable_key.length>1024||
    typeof fetchImpl!=='function')throw fail();
 const now=Number.isFinite(nowSeconds)?nowSeconds:Math.floor(Date.now()/1000);
 const actorA=unpackJWT(jwt_a,project_ref,now);
 const actorB=unpackJWT(jwt_b,project_ref,now);
 if(actorA===actorB)throw fail();
 const base='https://'+project_ref+'.supabase.co';
 const tokenFor=Object.freeze({A:jwt_a,B:jwt_b});
 return Object.freeze({
   project_ref,table_name,method:'GET_ONLY',production_runtime_registered:false,
   async probe({actor,source_ref}={}){
    if(!['A','B','ANON'].includes(actor)||typeof source_ref!=='string'||
       !REF.test(source_ref))throw fail();
    const uri=new URL('/rest/v1/'+table_name,base);
    uri.searchParams.set('select',FIELDS.join(','));
    uri.searchParams.set('source_ref','eq.'+source_ref);
    uri.searchParams.set('limit','2');
    const headers={'apikey':publishable_key,
       'accept':'application/json','cache-control':'no-store'};
    if(actor!=='ANON')headers.authorization='Bearer '+tokenFor[actor];
    // No arbitrary URL, body, POST, RPC, cookies, or user-provided tenant.
    // Deny redirects to avoid forwarding bearer tokens to another host.
    let response;
    try{
      response=await fetchImpl(uri.toString(),{
       method:'GET',headers,redirect:'error',cache:'no-store'
      });
    }catch{throw Error('VS53H_READ_TRANSPORT_ERROR')}
    if(response?.status===401||response?.status===403)
     return {status:'FORBIDDEN'};
    if(response?.status!==200)throw Error('VS53H_READ_TRANSPORT_ERROR');
    let rows;
    try{rows=await response.json()}catch{throw Error('VS53H_INVALID_METADATA_RESPONSE')}
    if(!Array.isArray(rows)||rows.length>1)throw Error('VS53H_INVALID_METADATA_RESPONSE');
    if(rows.length===0)return {status:'NOT_FOUND'};
    const row=rows[0];
    if(!row||typeof row!=='object'||Array.isArray(row)||
       Object.keys(row).some(key=>!FIELDS.includes(key)))
      throw Error('VS53H_INVALID_METADATA_RESPONSE');
    return {status:'FOUND',record:row};
   }
 });
}
module.exports={createGuardedStagingReadProbe,KNOWN_PRODUCTION_PROJECTS,FIELDS};
