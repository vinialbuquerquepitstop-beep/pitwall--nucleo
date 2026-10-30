'use strict';
const crypto = require('node:crypto');
const CONTRACT = 'external-calc-whatsapp-supervised-source-event/v0';
const MAX_BYTES = 256 * 1024;
const validId = v => typeof v === 'string' && /^[a-zA-Z0-9._:+=/-]{1,512}$/.test(v);
function deny(code) { return {ok:false,code,events:[]}; }
/**
 * trustedContext MUST be constructed by an authenticated server, not copied
 * from request JSON. This pure function does not authenticate callers.
 */
function normalizeSupervised({trustedContext, submission} = {}) {
  const c=trustedContext, s=submission;
  if (!c || !s || typeof c !== 'object' || typeof s !== 'object') return deny('INVALID_INPUT');
  if (![c.tenant_id,c.operator_id,c.intake_id].every(validId)) return deny('INVALID_TRUSTED_CONTEXT');
  if (!c.authorized_suppliers || !c.authorized_groups || typeof c.authorized_suppliers !== 'object' || typeof c.authorized_groups !== 'object') return deny('INVALID_TRUSTED_CONTEXT');
  if (!validId(s.supplier_id) || !validId(s.group_alias) || !Object.hasOwn(c.authorized_suppliers,s.supplier_id) || !Object.hasOwn(c.authorized_groups,s.group_alias)) return deny('UNAUTHORIZED_SOURCE');
  if (c.authorized_suppliers[s.supplier_id] !== c.tenant_id || c.authorized_groups[s.group_alias] !== c.tenant_id) return deny('CROSS_TENANT_SOURCE');
  if (!['operator_forward','operator_import'].includes(s.capture_method)) return deny('UNSUPPORTED_METHOD');
  if (typeof s.original_text !== 'string' || !s.original_text.trim() || Buffer.byteLength(s.original_text,'utf8')>MAX_BYTES) return deny('INVALID_TEXT');
  if (typeof c.captured_at!=='string' || Number.isNaN(Date.parse(c.captured_at))) return deny('INVALID_TRUSTED_CONTEXT');
  if (s.declared_message_timestamp != null && (typeof s.declared_message_timestamp !== 'string' || Number.isNaN(Date.parse(s.declared_message_timestamp)))) return deny('INVALID_TIMESTAMP');
  const event={
    contract_version: CONTRACT, provider:'operator_supervised',
    channel_kind:'whatsapp_group_supervised', capture_method:s.capture_method,
    tenant_id:c.tenant_id, supplier_id:s.supplier_id, operator_id:c.operator_id, group_alias:s.group_alias,
    source_event_key:'supervised:'+c.intake_id,
    original_text:s.original_text,
    original_sha256:'sha256:'+crypto.createHash('sha256').update(s.original_text,'utf8').digest('hex'),
    captured_at:c.captured_at,
    declared_message_timestamp:s.declared_message_timestamp ?? null,
    provenance_confidence:'operator_asserted', review_state:'REVIEW_REQUIRED'
  };
  return {ok:true,contract_version:CONTRACT,events:[event]};
}
module.exports={CONTRACT,MAX_BYTES,normalizeSupervised};
