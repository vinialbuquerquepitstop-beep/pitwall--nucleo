'use strict';
// UP-06K: internal-only port. No Worker route, DB privilege or credentials are created here.
const SCOPES=Object.freeze({resolveVariant:'product:resolve-variant',estimateTradeIn:'product:trade-in-estimate',simulateSale:'product:sales-simulation'});
const FIELDS=Object.freeze({resolveVariant:['public_id','price_revision'],estimateTradeIn:['public_id','price_revision','device_model_id','capacity_gb','color'],simulateSale:['public_id','price_revision','installment_count','estimate_ref']});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class PortDenied extends Error {constructor(code){super(code);this.code=code;this.name='PortDenied';}}
const deny=c=>{throw new PortDenied(c)};
const isMoney=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const isTime=n=>Number.isSafeInteger(n)&&n>0;
function createInternalUpgradePort({enabled=false,verifyService,loadApprovedPublication,loadTenantScopedContext,domain,clock=()=>Date.now(),audit}={}){
 if(typeof verifyService!=='function'||typeof loadApprovedPublication!=='function'||typeof loadTenantScopedContext!=='function'||!domain||Object.keys(SCOPES).some(k=>typeof domain[k]!=='function'))throw new Error('TRUSTED_DEPENDENCIES_REQUIRED');
 async function execute({action,credential,command}={}){
  if(enabled!==true)deny('PUBLIC_UPGRADE_DISABLED');
  if(!Object.hasOwn(SCOPES,action))deny('OPERATION_FORBIDDEN');
  if(!command||typeof command!=='object'||Array.isArray(command)||Object.keys(command).some(k=>!FIELDS[action].includes(k))||!['public_id','price_revision'].every(k=>typeof command[k]==='string'&&command[k].length>0&&command[k].length<=100))deny('COMMAND_INVALID');
  if(action==='simulateSale'&&(!Number.isInteger(command.installment_count)||command.installment_count<1||command.installment_count>18))deny('INSTALLMENTS_INVALID');
  if(action==='estimateTradeIn'&&(typeof command.device_model_id!=='string'||!command.device_model_id||!Number.isInteger(command.capacity_gb)||command.capacity_gb<1||command.capacity_gb>2048||(command.color!=null&&(typeof command.color!=='string'||command.color.length>48))))deny('DEVICE_INVALID');
  if(action==='simulateSale'&&command.estimate_ref!=null&&(typeof command.estimate_ref!=='string'||!command.estimate_ref||command.estimate_ref.length>200))deny('ESTIMATE_REF_INVALID');
  if(typeof credential!=='string'||credential.length===0||credential.length>8192)deny('CREDENTIAL_REQUIRED');
  // Verifier must cryptographically verify issuer/audience, revocation and one-time invocation.
  const identity=await verifyService({credential,requiredScope:SCOPES[action]});
  if(!identity||identity.verified!==true||identity.principal!=='pitstop-upgrade-service'||!UUID.test(identity.tenant_id||'')||!Array.isArray(identity.scopes)||identity.scopes.length!==1||identity.scopes[0]!==SCOPES[action])deny('SERVICE_IDENTITY_DENIED');
  if(!isTime(identity.expires_at_ms)||!isTime(identity.not_before_ms)||identity.expires_at_ms<=clock()||identity.not_before_ms>clock()||identity.expires_at_ms-identity.not_before_ms>300000)deny('SERVICE_TOKEN_STALE');
  const publication=await loadApprovedPublication({publicId:command.public_id,revision:command.price_revision,tenantId:identity.tenant_id});
  if(!publication||publication.status!=='published'||publication.tenant_id!==identity.tenant_id||publication.public_id!==command.public_id||publication.price_revision!==command.price_revision||!isMoney(publication.sale_price_minor)||!isTime(publication.expires_at_ms)||publication.expires_at_ms<=clock()||!Number.isSafeInteger(publication.offer_revision)||publication.offer_revision<1)deny('PUBLICATION_NOT_AUTHORIZED');
  // Repository must scope tenant on the DB side, not interpolate client-provided tenant.
  const context=await loadTenantScopedContext({tenantId:identity.tenant_id,publicId:publication.public_id,publication});
  if(!context||context.tenant_id!==identity.tenant_id||context.public_id!==publication.public_id||context.offer_revision!==publication.offer_revision)deny('CONTEXT_MISMATCH');
  const result=await domain[action]({context,publication,command});
  if(!result||typeof result!=='object'||!isMoney(result.public_amount_minor))deny('DOMAIN_RESULT_INVALID');
  if(action==='resolveVariant'&&result.public_amount_minor!==publication.sale_price_minor)deny('PUBLISHED_PRICE_MISMATCH');
  if(action==='simulateSale'&&(!Number.isSafeInteger(result.installment_count)||result.installment_count!==command.installment_count))deny('SIMULATION_MISMATCH');
  // Strict explicit outward projection. Never spread domain objects.
  const output={schema_version:'pitstop-internal-upgrade/v1',public_id:publication.public_id,price_revision:publication.price_revision,action,amount_minor:result.public_amount_minor,currency:'BRL'};
  if(action==='simulateSale')output.installment_count=result.installment_count;
  if(typeof audit==='function')await audit({event:'PUBLIC_UPGRADE_INTERNAL_PORT',action,public_id:publication.public_id,tenant_id:identity.tenant_id});
  return output;
 }
 return Object.freeze({execute});
}
module.exports={createInternalUpgradePort,PortDenied,ALLOWED:SCOPES};
