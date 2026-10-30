'use strict';
// META-03.2: framework-neutral HTTP handlers; no network listener or persistence.
const {verifyChallenge,parseInbound,MAX_BYTES}=require('./whatsapp-source-adapter-v0.cjs');
function handlerFactory({verifyToken,appSecret,allowlist,allowedPhoneIds}={}) {
  if(!verifyToken || !appSecret || !allowlist || !Array.isArray(allowedPhoneIds))
    throw new Error('MISSING_SERVER_CONFIGURATION');
  function get(query) {
    const challenge=verifyChallenge(query,verifyToken);
    return challenge===null ? {status:403,body:''} : {status:200,body:challenge};
  }
  function post({rawBody,signature}={}) {
    if(!Buffer.isBuffer(rawBody) || rawBody.length===0 || rawBody.length>MAX_BYTES)
      return {status:413,body:''};
    const result=parseInbound({rawBody,signature,appSecret,allowlist});
    if(!result.ok) return {status:401,body:''};
    // Never send raw customer or unknown-source text to any downstream consumer.
    const approved=result.events.filter(event=>allowedPhoneIds.includes(event.channel_id));
    // Deliberately NO ack 200 for approved events: no durable queue exists yet.
    // A 503 prevents silent acceptance/loss and permits provider retry.
    if(approved.length) return {status:503,body:''};
    // Unsupported/status or unknown sender: intentionally acknowledged without persistence.
    return {status:200,body:''};
  }
  return {get,post};
}
module.exports={handlerFactory};
