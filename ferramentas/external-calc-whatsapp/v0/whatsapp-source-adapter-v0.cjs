'use strict';
// WM-01: pure transport validation. NO webhook route, persistence, AI, or C01 authority.
const crypto = require('node:crypto');
const CONTRACT = 'external-calc-whatsapp-source-event/v0';
const MAX_BYTES = 256 * 1024;
const id = v => typeof v === 'string' && /^[a-zA-Z0-9._:-]{1,160}$/.test(v);
function fail(code) { return { ok: false, code, events: [] }; }
function verifySignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || typeof secret !== 'string' || !secret ||
      typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const want = crypto.createHmac('sha256', secret).update(rawBody).digest();
  const supplied = Buffer.from(signature.slice(7), 'hex');
  return supplied.length === want.length && crypto.timingSafeEqual(supplied, want);
}
function verifyChallenge(params, expectedToken) {
  if (!params || params['hub.mode'] !== 'subscribe' ||
      typeof expectedToken !== 'string' || !expectedToken ||
      typeof params['hub.verify_token'] !== 'string' ||
      typeof params['hub.challenge'] !== 'string' ||
      params['hub.challenge'].length > 512) return null;
  const a = Buffer.from(params['hub.verify_token']), b = Buffer.from(expectedToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b)
    ? params['hub.challenge'] : null;
}
/**
 * allowlist is server-owned mapping:
 * { [phoneNumberId]: { [senderWaId]: { tenant_id, supplier_id } } }
 * Caller MUST ensure mapping is loaded from authenticated configuration.
 * Output is only a transport/source event, NEVER an authorized C01 offer.
 */
function parseInbound({ rawBody, signature, appSecret, allowlist } = {}) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || rawBody.length > MAX_BYTES)
    return fail('INVALID_BODY_SIZE');
  // Always authenticate bytes prior to JSON parsing or inspecting sender data.
  if (!verifySignature(rawBody, signature, appSecret)) return fail('INVALID_SIGNATURE');
  let payload;
  try { payload = JSON.parse(rawBody.toString('utf8')); } catch { return fail('INVALID_JSON'); }
  if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry))
    return fail('NOT_WHATSAPP_MESSAGE');
  const events = [], seen = new Set();
  let ignored = 0;
  for (const entry of payload.entry) {
    if (!Array.isArray(entry?.changes)) { ignored++; continue; }
    for (const change of entry.changes) {
      const value = change?.value;
      if (change?.field !== 'messages' || value?.messaging_product !== 'whatsapp' ||
          !Array.isArray(value.messages)) { ignored++; continue; }
      const phoneId = value?.metadata?.phone_number_id;
      const permittedSenders = id(phoneId) && allowlist && Object.hasOwn(allowlist, phoneId)
        ? allowlist[phoneId] : null;
      for (const message of value.messages) {
        const sender = message?.from;
        const mapping = id(sender) && permittedSenders && Object.hasOwn(permittedSenders, sender)
          ? permittedSenders[sender] : null;
        if (message?.type !== 'text' || typeof message?.text?.body !== 'string' ||
            !message.text.body.trim() || !id(message.id) ||
            !mapping || !id(mapping.tenant_id) || !id(mapping.supplier_id)) {
          ignored++; continue;
        }
        const key = phoneId + ':' + message.id;
        if (seen.has(key)) { ignored++; continue; }
        seen.add(key);
        events.push({
          contract_version: CONTRACT,
          provider: 'meta_cloud_api',
          channel_id: phoneId,
          provider_message_id: message.id,
          tenant_id: mapping.tenant_id,
          supplier_id: mapping.supplier_id,
          original_text: message.text.body,
          original_sha256: 'sha256:' + crypto.createHash('sha256').update(message.text.body, 'utf8').digest('hex'),
          received_timestamp: typeof message.timestamp === 'string' && /^\d{1,12}$/.test(message.timestamp)
            ? message.timestamp : null,
          source_event_key: 'meta:' + phoneId + ':' + message.id,
          state: 'TRANSPORT_VALIDATED_REVIEW_ONLY'
        });
      }
    }
  }
  return {ok:true, contract_version:CONTRACT, events, ignored};
}
module.exports = {CONTRACT, MAX_BYTES, verifySignature, verifyChallenge, parseInbound};
