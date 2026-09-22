'use strict';
const crypto=require('crypto');
const QUOTE_PATH='/api/external-calc/v0/quote';
function out(status,body){return {status,headers:{'content-type':'application/json; charset=utf-8'},body};}
function body(raw){if(raw==null)throw new Error('body obrigatorio');const v=typeof raw==='string'?JSON.parse(raw):raw;if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('body invalido');return v;}
function createStoreRateQuoteApiV0(options={}){
 const resolver=options.resolver, authenticate=options.authenticate;
 if(!resolver||typeof resolver.resolveQuote!=='function')throw new Error('resolver obrigatorio');
 if(typeof authenticate!=='function')throw new Error('authenticate obrigatorio');
 return {async handle(request){
  try{
   if(String(request?.method||'').toUpperCase()!=='POST'||String(request?.path||'')!==QUOTE_PATH)return out(404,{error:{code:'NOT_FOUND',message:'rota nao encontrada'}});
   const auth=await authenticate(request);
   if(!auth||!auth.subject){const e=new Error('autenticacao obrigatoria');e.code='UNAUTHENTICATED';throw e;}
   if(auth.can_execute_external_calc!==true){const e=new Error('acesso negado');e.code='RATE_PROFILE_FORBIDDEN';throw e;}
   const result=await resolver.resolveQuote({auth_user_id:String(auth.subject),calculation_run_id:crypto.randomUUID(),command:body(request.body)});
   return out(200,{api_version:'external-calc-store-rate-quote-api/v1',quote:result});
  }catch(error){
   const code=error?.code||'INVALID_REQUEST';
   const status=code==='UNAUTHENTICATED'?401:code==='RATE_PROFILE_FORBIDDEN'?403:
    code==='RATE_PROFILE_NOT_CONFIGURED'||code==='INSTALLMENT_RATE_NOT_CONFIGURED'?422:
    code==='RATE_PROFILE_CONFLICT'||code==='QUOTE_RECALCULATION_REQUIRED'?409:400;
   return out(status,{error:{code,message:error instanceof Error?error.message:'request invalido'}});
  }
 }};
}
module.exports={QUOTE_PATH,createStoreRateQuoteApiV0};
