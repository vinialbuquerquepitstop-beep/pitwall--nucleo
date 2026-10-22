'use strict';
const {CONTRACT,createManualMissingOfferRecoveryV0}=require('./manual-missing-offer-recovery-v0');
const PATH='/api/external-calc/v0/manual-recovery';
function reply(status,body){return {status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body};}
function createManualMissingOfferRecoveryApiV0({authenticate,trustedInputResolver,candidateRepository}={}){
 if(typeof authenticate!=='function')throw new Error('RECOVERY_AUTHENTICATION_REQUIRED');
 const service=trustedInputResolver?.resolve&&candidateRepository?.persistCandidate
   ? createManualMissingOfferRecoveryV0({trustedInputResolver,candidateRepository}):null;
 return {
  async handle(request){
   if(String(request?.path)!==PATH||String(request?.method).toUpperCase()!=='POST')
    return reply(404,{error:{code:'NOT_FOUND',message:'rota nao encontrada'}});
   try{
    const auth=await authenticate(request);
    if(!auth?.subject||!auth?.tenant_id) return reply(401,{error:{code:'UNAUTHENTICATED',message:'sessao obrigatoria'}});
    if(auth.can_execute_external_calc!==true) return reply(403,{error:{code:'FORBIDDEN',message:'sem acesso a recuperacao'}});
    if(!service) return reply(503,{error:{code:'RECOVERY_TRUSTED_ORIGINAL_NOT_CONFIGURED',message:'Consulta autenticada da fonte original ainda indisponivel neste ambiente.'}});
    const raw=request.body;
    if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>20000)
      return reply(413,{error:{code:'RECOVERY_PAYLOAD_INVALID',message:'comando excede limite permitido'}});
    let command;
    try{command=JSON.parse(raw);}catch{return reply(400,{error:{code:'RECOVERY_JSON_INVALID',message:'JSON invalido'}});}
    const response=await service.execute({command,actor_ref:auth.subject});
    if(response.status!=='REVIEW_REQUIRED'||response.quoteable!==false)
      throw Object.assign(new Error('RECOVERY_AUTHORITY_UNEXPECTED'),{status:503});
    return reply(200,{api_version:CONTRACT,recovery:response});
   }catch(e){
    const code=typeof e?.code==='string'?e.code:'RECOVERY_FAILED';
    const status=e?.status===422?422:e?.status===503?503:400;
    return reply(status,{error:{code,message:e instanceof Error?e.message:'falha ao recuperar oferta'}});
   }
  }
 };
}
module.exports={PATH,CONTRACT,createManualMissingOfferRecoveryApiV0};
