'use strict';
// WM-01/G5 shadow domain contract. No HTTP, DB, network, token or production wiring.
// Caller must authenticate actor server-side; repository must implement one atomic,
// durable insert-or-get transaction with uniqueness and payload-conflict rejection.
const VERSION='external-calc-pch-receiver-shadow/v0';
const SOURCE_KINDS=new Set(['META_PRIVATE','GROUP_CONNECTOR']);
const allowed=v=>typeof v==='string'&&v.trim().length>0&&v.length<=256;
const exact=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).every(k=>keys.includes(k));
class IntakeRejected extends Error{constructor(code){super(code);this.code=code;}}
function prepare({actor,event}={}){
 if(!exact(actor,['authenticated','producer','tenantId','permissions'])||actor.authenticated!==true||actor.producer!=='PCH'||!allowed(actor.tenantId)||!Array.isArray(actor.permissions)||!actor.permissions.includes('INGRESS_WRITE'))throw new IntakeRejected('UNAUTHORIZED_PRODUCER');
 const fields=['eventId','tenantId','providerScope','providerMessageId','sourceKind','sourceId','senderId','contentSha256','encryptedPayloadRef','occurredAt'];
 if(!exact(event,fields)||!fields.every(k=>allowed(event[k]))||!SOURCE_KINDS.has(event.sourceKind)||!/^[a-f0-9]{64}$/i.test(event.contentSha256)||!Number.isFinite(Date.parse(event.occurredAt)))throw new IntakeRejected('INVALID_INGRESS_EVENT');
 if(event.tenantId!==actor.tenantId)throw new IntakeRejected('TENANT_MISMATCH');
 const idempotencyKey=[actor.tenantId,event.providerScope,event.eventId].map(encodeURIComponent).join(':');
 return Object.freeze({tenantId:actor.tenantId,producer:'PCH',idempotencyKey,eventId:event.eventId,providerScope:event.providerScope,providerMessageId:event.providerMessageId,sourceKind:event.sourceKind,sourceId:event.sourceId,senderId:event.senderId,contentSha256:event.contentSha256.toLowerCase(),encryptedPayloadRef:event.encryptedPayloadRef,occurredAt:event.occurredAt});
}
function receipt(record,prepared){
 if(!record||record.state!=='ACCEPTED'||!allowed(record.receiptId)||record.tenantId!==prepared.tenantId||record.idempotencyKey!==prepared.idempotencyKey||record.eventId!==prepared.eventId||record.contentSha256!==prepared.contentSha256)throw new IntakeRejected('RECEIPT_CONFLICT');
 return Object.freeze({receiptId:record.receiptId,tenant:record.tenantId,eventId:record.eventId,destination:'EXTERNAL_CALC',idempotencyKey:record.idempotencyKey,accepted:true,status:'ACCEPTED_NOT_PROCESSED',version:VERSION});
}
async function acceptIngress({actor,event,repository}={}){
 const prepared=prepare({actor,event});
 if(typeof repository?.acceptAtomic!=='function')throw new IntakeRejected('DURABLE_REPOSITORY_REQUIRED');
 // Repository MUST atomically detect duplicates and any mismatch in all immutable
 // fields, not only content hash; successful response requires durable commit.
 const result=await repository.acceptAtomic(prepared);
 if(result?.conflict)throw new IntakeRejected('INGRESS_IDEMPOTENCY_CONFLICT');
 return receipt(result?.record,prepared);
}
module.exports={VERSION,IntakeRejected,prepare,acceptIngress};
