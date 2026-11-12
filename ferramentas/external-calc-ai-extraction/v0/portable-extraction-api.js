'use strict';
const {verifyPortableAiInput}=require('./original-source-verifier');
const {previewExternalAiC01}=require('./external-ai-c01-preview');
const {unpackOriginalZip}=require('./original-zip-unpacker');
const PATH='/api/external-calc/v0/ai-extraction/validate';
const UNPACK_PATH='/api/external-calc/v0/ai-extraction/unpack';
function createAiExtractionValidationApiV0({env}={}){
 if(!env)throw new Error('env obrigatorio');
 return {
  matches(path){return path===PATH||path===UNPACK_PATH},
  async handle(request){
   const origin=request.headers.get('origin');
   const allowedOrigins=new Set(String(env.EXTCALC_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean));
   const safeOrigin=origin&&(allowedOrigins.has(origin)||/^https:\/\/external-calc-frontend-v1-preview(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)||origin==='http://localhost:3000')?origin:null;
   const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store',...(safeOrigin?{'access-control-allow-origin':safeOrigin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,content-type','vary':'Origin'}:{})};
   const response=(code,payload)=>new Response(JSON.stringify(payload),{status:code,headers});
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
   if(request.method!=='POST')return response(405,{error:{code:'METHOD_NOT_ALLOWED'}});
   const bearer=/^Bearer\s+(.+)$/i.exec(request.headers.get('authorization')||'');
   if(!bearer)return response(401,{error:{code:'UNAUTHENTICATED'}});
   try{
    const auth=await fetch(env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:env.SUPABASE_ANON_KEY,authorization:'Bearer '+bearer[1]}});
    if(!auth.ok)return response(401,{error:{code:'UNAUTHENTICATED'}});
    const raw=await request.text();
    if(raw.length>3*1024*1024)throw Object.assign(new Error('payload muito grande'),{code:'AI_EXTRACTION_TOO_LARGE',status:413});
    if(typeof request.url==='string' && request.url.split('?')[0].endsWith(UNPACK_PATH)){
      const input=JSON.parse(raw);
      if(!input||typeof input!=='object'||Array.isArray(input)||
        Object.keys(input).join(',')!=='content_base64')throw Object.assign(new Error('ZIP esperado'),{code:'AI_ZIP_INVALID',status:422});
      return response(200,{api_version:'external-calc-ai-unpack/v0',unpack:unpackOriginalZip(input.content_base64)});
    }
    const payload=JSON.parse(raw);
    const result=verifyPortableAiInput(payload);
    const preview=previewExternalAiC01(result);
    // Do not echo originals, potentially sensitive group messages or phone numbers.
    return response(200,{api_version:'external-calc-ai-extraction-validate/v0',
      validation:{contract_version:result.contract_version,coverage_complete:result.coverage_complete,
      original_sources_verified:result.original_sources_verified,original_source_count:result.original_source_count,
      accepted_for_staging:result.accepted_for_staging,needs_review:result.needs_review,
      issue_count:result.issues.length,issues:result.issues.slice(0,100),
      unresolved_count:result.unresolved.length,persistence_allowed:false,c01_import_ready:false,authority:'STAGING_ONLY',
      c01_preview:{review_candidates:preview.c01_review_candidates,auto_promoted:0,invalid_or_unmapped:preview.invalid_or_unmapped}}});
   }catch(e){
    return response(e.status===422?422:e.status===413?413:400,{error:{code:e.code||'AI_EXTRACTION_INVALID',message:String(e.message||'invalid extraction')}});
   }
  }
 };
}
module.exports={PATH,UNPACK_PATH,createAiExtractionValidationApiV0};
