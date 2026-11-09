'use strict';
// WM-01/G10 shadow-only request authentication. No route or production wiring.
// The trusted keyring is server-only configuration. Never accept an actor
// object, tenant authorization, producer or permissions from JSON request body.
const crypto=require('node:crypto');
const {IntakeRejected}=require('./receiver-shadow');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST=/^[a-f0-9]{64}$/;
const SIGNATURE=/^[a-f0-9]{64}$/;
const REQUEST_PATH='/internal/pch/v0/inbox';
const RECEIPT_PATH='/internal/pch/v0/receipt';
const MAX_SKEW_MS=5*60*1000;
function fail(){throw new IntakeRejected('UNAUTHORIZED_SERVICE');}
function canonical({method,path,keyId,tenantId,timestamp,nonce,bodySha256}){
 return ['PCH-HMAC-SHA256-V1',method,path,keyId,tenantId,timestamp,nonce,bodySha256].join('\n');
}
function digest(body){if(typeof body!=='string')fail();return crypto.createHash('sha256').update(body,'utf8').digest('hex');}
function authenticateRequest({method,path,headers,body,keyring,nowMs=Date.now()}={}){
 if(method!=='POST'||![REQUEST_PATH,RECEIPT_PATH].includes(path))fail();
 if(!headers||typeof headers!=='object'||Array.isArray(headers))fail();
 const keyId=headers['x-pch-key-id'],timestamp=headers['x-pch-timestamp'],nonce=headers['x-pch-nonce'],signature=headers['x-pch-signature'],tenantId=headers['x-pch-tenant-id'];
 if(typeof keyId!=='string'||!/^[A-Za-z0-9_-]{3,64}$/.test(keyId)||
    typeof timestamp!=='string'||!/^\d{13}$/.test(timestamp)||
    typeof nonce!=='string'||!/^[a-f0-9]{32}$/.test(nonce)||
    typeof signature!=='string'||!SIGNATURE.test(signature)||
    typeof tenantId!=='string'||!UUID.test(tenantId)||
    !Number.isSafeInteger(nowMs)||!Number.isSafeInteger(Number(timestamp))||
    Math.abs(nowMs-Number(timestamp))>MAX_SKEW_MS)fail();
 // getKeyById is a trusted, in-process mapping to an authorized producer and
 // one tenant. It must NOT accept attacker-controlled key material or tenancy.
 const credential=keyring?.getKeyById?.(keyId);
 if(!credential||credential.producer!=='PCH'||credential.tenantId!==tenantId||
    credential.enabled!==true||!Array.isArray(credential.permissions)||
    !credential.permissions.includes('INGRESS_WRITE')||
    !Buffer.isBuffer(credential.secret)||credential.secret.length<32)fail();
 const signed=canonical({method,path,keyId,tenantId,timestamp,nonce,bodySha256:digest(body)});
 const target=crypto.createHmac('sha256',credential.secret).update(signed).digest();
 const supplied=Buffer.from(signature,'hex');
 if(supplied.length!==target.length||!crypto.timingSafeEqual(supplied,target))fail();
 // Nonce should be stored with TTL in a dedicated server-owned replay ledger
 // for one-shot operations. The inbox is idempotent, but this alone does not
 // prevent captured signed request replay inside the freshness window.
 return Object.freeze({authenticated:true,producer:'PCH',tenantId,permissions:Object.freeze(['INGRESS_WRITE']),keyId});
}
function signRequestForTest({method='POST',path=REQUEST_PATH,keyId,tenantId,secret,body,timestamp,nonce}={}){
 if(!Buffer.isBuffer(secret)||secret.length<32)throw Error('TEST_SECRET_REQUIRED');
 const headers={'x-pch-key-id':keyId,'x-pch-tenant-id':tenantId,'x-pch-timestamp':String(timestamp),'x-pch-nonce':nonce};
 const material=canonical({method,path,keyId,tenantId,timestamp:String(timestamp),nonce,bodySha256:digest(body)});
 headers['x-pch-signature']=crypto.createHmac('sha256',secret).update(material).digest('hex');
 return headers;
}
module.exports={REQUEST_PATH,RECEIPT_PATH,MAX_SKEW_MS,authenticateRequest,signRequestForTest};
