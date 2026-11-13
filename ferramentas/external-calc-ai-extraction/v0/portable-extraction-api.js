'use strict';
const {verifyPortableAiInput}=require('./original-source-verifier');
const {previewExternalAiC01}=require('./external-ai-c01-preview');
const {unpackOriginalZip}=require('./original-zip-unpacker');
const {checkSupplierAuthority}=require('./supplier-session-authority');
const PATH='/api/external-calc/v0/ai-extraction/validate';
const UNPACK_PATH='/api/external-calc/v0/ai-extraction/unpack';
const SAFE_ERROR_CODES=new Set([
 'UNAUTHENTICATED','AI_EXTRACTION_TOO_LARGE','AI_ZIP_INVALID','AI_ZIP_TOO_LARGE',
 'AI_ZIP_NO_READABLE_TEXT','AI_SUPPLIER_ID_INVALID','AI_SUPPLIER_FORBIDDEN',
 'AI_SUPPLIER_AUTH_UNAVAILABLE','AI_SUPPLIER_AUTH_CONFIG','AI_SUPPLIER_CLAIM_CONFLICT',
 'AI_ORIGINAL_SOURCE_REQUIRED','AI_ORIGINAL_SOURCE_INVALID',
 'AI_ORIGINAL_SOURCE_DUPLICATE','AI_ORIGINAL_SOURCE_TOO_LARGE',
 'AI_ORIGINAL_SOURCE_MISSING','AI_ORIGINAL_SOURCE_MISMATCH',
 'AI_EXTRACTION_SCHEMA_INVALID','AI_EXTRACTION_EVIDENCE_MISMATCH',
 'AI_EXTRACTION_COVERAGE_CONFLICT','AI_EXTRACTION_SOURCE_MISSING',
 'PARSER_FAILURE'
]);
function safeApiError(error){
 const status=[401,403,413,422,503].includes(error?.status)?error.status:400;
 const code=SAFE_ERROR_CODES.has(error?.code)?error.code:'AI_EXTRACTION_INVALID';
 // Never reflect raw JSON parser errors, ZIP filenames, original message text,
 // source quotes, SQL/HTTP errors, stack traces or provider error descriptions.
 const message=status===413?'Arquivo excede o limite permitido':
  status===401?'Autenticacao necessaria':
  status===403?'Acesso negado':
  status===503?'Validacao temporariamente indisponivel':
  'Nao foi possivel validar o arquivo enviado';
 return {status,payload:{error:{code,message}}};
}

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
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||
      typeof payload.supplier_id!=='string')throw Object.assign(new Error('Fornecedor obrigatorio'),{code:'AI_SUPPLIER_ID_INVALID',status:422});
    const supplier=await checkSupplierAuthority({env,token:bearer[1],supplier_id:payload.supplier_id});
    const result=verifyPortableAiInput({extraction:payload.extraction,original_sources:payload.original_sources});
    // An AI-asserted supplier identity is never trusted. If the AI declares
    // a different supplier, stop the preview and require owner adjudication.
    const claims=result.offers.map(o=>o.supplier_ref).filter(Boolean);
    if(claims.some(s=>s.toLowerCase()!==supplier.name.trim().toLowerCase())){
      throw Object.assign(new Error('Fornecedor informado pela IA diverge do fornecedor autorizado'),
        {code:'AI_SUPPLIER_CLAIM_CONFLICT',status:422});
    }
    const preview=previewExternalAiC01(result);
    // Bounded review preview only: omit full chats, quotes, filenames and
    // sender/supplier claims. Redact common contact strings from AI field values.
    // These remain untrusted display labels, not authoritative C01 records.
    const displayLabel=(value,max)=>{
      if(typeof value!=='string')return null;
      return value
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi,'[email omitido]')
        .replace(/(?:\\+?55[\\s().-]*)?(?:\\(?\\d{2}\\)?[\\s().-]*)?\\d{4,5}[\\s.-]?\\d{4}/g,'[telefone omitido]')
        .slice(0,max);
    };
    const issueRefs=new Map();
    for(const issue of result.issues){
      if(!issueRefs.has(issue.offer_ref))issueRefs.set(issue.offer_ref,new Set());
      issueRefs.get(issue.offer_ref).add(issue.reason);
    }
    const reviewItems=result.offers.slice(0,20).map((offer,index)=>({
      review_ref:'item-'+(index+1),
      model:displayLabel(offer.model,120),
      capacity_gb:offer.capacity_gb,
      color:displayLabel(offer.color,80),
      condition:displayLabel(offer.condition,80),
      price_amount_minor:offer.price?.amount_minor??null,
      status:'REVIEW_REQUIRED',
      review_reasons:[...(issueRefs.get(offer.offer_ref)||[])].slice(0,12)
    }));
    // Do not echo originals, potentially sensitive group messages or phone numbers.
    return response(200,{api_version:'external-calc-ai-extraction-validate/v0',
      validation:{contract_version:result.contract_version,coverage_complete:result.coverage_complete,
      supplier_authority:{verified:true,scope:'RLS_AUTHENTICATED_READ',supplier_id:supplier.supplier_id},
      original_sources_verified:result.original_sources_verified,original_source_count:result.original_source_count,
      accepted_for_staging:result.accepted_for_staging,needs_review:result.needs_review,
      issue_count:result.issues.length,issues:result.issues.slice(0,100),
      review_preview:{total_offers:result.offers.length,shown:reviewItems.length,items:reviewItems},
      unresolved_count:result.unresolved.length,
      chronology:{review_flags:result.chronology.issues.length,unbound_partial_updates:result.chronology.unbound_partial_updates,latest_selected:false,chronological_authority:false},
      persistence_allowed:false,c01_import_ready:false,authority:'STAGING_ONLY',
      c01_preview:{review_candidates:preview.c01_review_candidates,auto_promoted:0,invalid_or_unmapped:preview.invalid_or_unmapped,catalog_resolved:preview.catalog_resolved,catalog_needs_review:preview.catalog_needs_review}}});
   }catch(e){
    const safe=safeApiError(e);
    return response(safe.status,safe.payload);
   }
  }
 };
}
module.exports={PATH,UNPACK_PATH,createAiExtractionValidationApiV0};
