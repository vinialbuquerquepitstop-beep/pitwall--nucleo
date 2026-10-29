// WM-03: framework-independent durable acknowledgement decision.
// The caller verifies Meta HMAC AND server-side tenant/receiver/supplier authorization.
// A trusted storage adapter must commit inbox+outbox in one transaction.
export async function durableAck({authenticated=false,authorized=false,event=null,accept=null}={}){
 if(!authenticated)return {status:401,code:'UNAUTHENTICATED'};
 if(!authorized||!event||typeof event!=='object')return {status:403,code:'NOT_AUTHORIZED'};
 if(typeof accept!=='function')return {status:503,code:'STORAGE_UNAVAILABLE'};
 try{
  const result=await accept(event);
  if(result?.status==='INSERTED'||result?.status==='DUPLICATE')
   return {status:200,code:result.status};
  return {status:503,code:'NO_DURABLE_COMMIT'};
 }catch{
  // Never expose provider messages, internal DB errors or credentials.
  return {status:503,code:'DURABLE_WRITE_FAILED'};
 }
}
