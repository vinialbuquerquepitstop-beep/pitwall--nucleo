'use strict';
const VARIANT_PATH='/api/external-calc/v0/resolve-variant';
const TRADE_IN_PATH='/api/external-calc/v0/trade-in-estimate';
const SIM_PATH='/api/external-calc/v0/sales-simulation';
function out(status,body){return {status,headers:{'content-type':'application/json; charset=utf-8'},body};}
function parse(raw){if(raw==null)throw Object.assign(new Error('body obrigatorio'),{code:'INVALID_REQUEST'});const x=typeof raw==='string'?JSON.parse(raw):raw;if(!x||typeof x!=='object'||Array.isArray(x))throw Object.assign(new Error('body invalido'),{code:'INVALID_REQUEST'});return x;}
function status(code){if(code==='UNAUTHENTICATED')return 401;if(code==='PRODUCT_FORBIDDEN')return 403;if(['VARIANT_NOT_FOUND','TRADE_IN_NO_ELIGIBLE_OFFER'].includes(code))return 404;if(['TRADE_IN_POLICY_NOT_CONFIGURED','RATE_PROFILE_NOT_CONFIGURED','INSTALLMENT_RATE_NOT_CONFIGURED'].includes(code))return 422;if(['VARIANT_AMBIGUOUS','VARIANT_COLOR_REQUIRED','OFFER_REFERENCE_CONFLICT','SALE_OFFER_STALE','TRADE_IN_ESTIMATE_STALE','RATE_PROFILE_CONFLICT'].includes(code))return 409;return 400;}
function createSalesProductApiV0({service,authenticate}={}){
 if(!service)throw new Error('service obrigatorio');if(typeof authenticate!=='function')throw new Error('authenticate obrigatorio');
 return {async handle(request){try{
   const path=String(request?.path||''),method=String(request?.method||'').toUpperCase();
   if(method!=='POST'||![VARIANT_PATH,TRADE_IN_PATH,SIM_PATH].includes(path))return out(404,{error:{code:'NOT_FOUND',message:'rota nao encontrada'}});
   const auth=await authenticate(request);if(!auth?.subject){const e=new Error('autenticacao obrigatoria');e.code='UNAUTHENTICATED';throw e;}
   const command=parse(request.body);
   const result=path===VARIANT_PATH?await service.resolveVariant({auth_user_id:String(auth.subject),command}):path===TRADE_IN_PATH?await service.estimateTradeIn({auth_user_id:String(auth.subject),command}):await service.simulateSale({auth_user_id:String(auth.subject),command});
   return out(200,{api_version:'external-calc-sales-product-api/v0',result});
 }catch(e){const code=e?.code||'INVALID_REQUEST';return out(status(code),{error:{code,message:e instanceof Error?e.message:'request invalido'}});}}};
}
module.exports={VARIANT_PATH,TRADE_IN_PATH,SIM_PATH,createSalesProductApiV0};
