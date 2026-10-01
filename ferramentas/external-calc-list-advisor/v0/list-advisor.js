'use strict';

const crypto = require('crypto');

const CONTRACT_VERSION = 'external-calc-list-advisor/v0';
const MAX_LIST_BYTES = 2 * 1024 * 1024;

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(field + ' obrigatorio');
  return value.trim();
}

function normalizeOptional(value, max, field) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) throw new Error(field + ' excede limite');
  return text;
}

function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input obrigatorio');
  const supplierId = assertNonEmpty(input.supplier_id, 'supplier_id').toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(supplierId)) {
    throw new Error('supplier_id invalido');
  }
  const content = assertNonEmpty(input.content, 'content');
  if (Buffer.byteLength(content, 'utf8') > MAX_LIST_BYTES) throw new Error('lista excede 2 MB');
  return {
    supplier_id: supplierId,
    filename: normalizeOptional(input.filename, 180, 'filename') || 'lista.txt',
    mime_type: normalizeOptional(input.mime_type, 120, 'mime_type') || 'text/plain',
    content
  };
}

function normalizeSupplier(value, expectedId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('fornecedor nao encontrado');
  if (String(value.supplier_id || '').toLowerCase() !== expectedId) throw new Error('supplier context mismatch');
  return {
    supplier_id: expectedId,
    name: assertNonEmpty(value.name, 'supplier.name'),
    ai_context: normalizeOptional(value.ai_context, 2000, 'supplier.ai_context')
  };
}

function assertCandidateOutput(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) throw new Error('candidate output invalido');
  if (!Array.isArray(output.offers) || !Array.isArray(output.ambiguities)) throw new Error('candidate output incompleto');

  const offers = output.offers.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('offer[' + index + '] invalida');
    const allowed = ['model','capacity_gb','color','condition','variant','price_amount_minor','currency','confidence','source_excerpt'];
    for (const key of Object.keys(item)) if (!allowed.includes(key)) throw new Error('offer[' + index + '] campo nao permitido: ' + key);
    const model = assertNonEmpty(item.model, 'offer[' + index + '].model');
    const capacity = item.capacity_gb == null ? null : item.capacity_gb;
    if (capacity != null && (!Number.isSafeInteger(capacity) || capacity <= 0)) throw new Error('offer[' + index + '].capacity_gb invalida');
    const price = item.price_amount_minor == null ? null : item.price_amount_minor;
    if (price != null && (!Number.isSafeInteger(price) || price <= 0)) throw new Error('offer[' + index + '].price_amount_minor invalido');
    const confidence = item.confidence;
    if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('offer[' + index + '].confidence invalida');
    return {
      model,
      capacity_gb: capacity,
      color: normalizeOptional(item.color, 80, 'color'),
      condition: normalizeOptional(item.condition, 80, 'condition'),
      variant: normalizeOptional(item.variant, 120, 'variant'),
      price_amount_minor: price,
      currency: item.currency == null ? 'BRL' : assertNonEmpty(item.currency, 'currency'),
      confidence,
      source_excerpt: assertNonEmpty(item.source_excerpt, 'source_excerpt').slice(0, 500)
    };
  });

  const ambiguities = output.ambiguities.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('ambiguity[' + index + '] invalida');
    return {
      field: assertNonEmpty(item.field, 'ambiguity.field'),
      source_excerpt: assertNonEmpty(item.source_excerpt, 'ambiguity.source_excerpt').slice(0, 500),
      reason: assertNonEmpty(item.reason, 'ambiguity.reason').slice(0, 800)
    };
  });

  return { offers, ambiguities };
}

function createListAdvisorService(options = {}) {
  const supplierSource = options.supplierSource;
  const provider = options.provider;
  if (!supplierSource || typeof supplierSource.load !== 'function') throw new Error('supplierSource.load obrigatorio');
  if (!provider || typeof provider.interpret !== 'function') throw new Error('provider.interpret obrigatorio');

  return {
    async interpret(rawInput) {
      const input = normalizeInput(rawInput);
      const supplier = normalizeSupplier(await supplierSource.load(input.supplier_id), input.supplier_id);
      const request = {
        contract_version: CONTRACT_VERSION,
        task: 'INTERPRET_SUPPLIER_LIST',
        supplier_context: supplier,
        source: {
          filename: input.filename,
          mime_type: input.mime_type,
          content: input.content
        },
        guardrails: {
          source_is_authoritative: true,
          supplier_context_is_advisory: true,
          may_invent_values: false,
          may_correct_suspicious_prices: false,
          preserve_ambiguity: true,
          preserve_unmapped_variant_text: true
        }
      };
      const candidate = assertCandidateOutput(await provider.interpret(request));
      return {
        contract_version: CONTRACT_VERSION,
        supplier_id: supplier.supplier_id,
        supplier_name: supplier.name,
        input_hash: stableHash(input.content),
        context_fingerprint: stableHash(JSON.stringify(request.supplier_context)),
        offers: candidate.offers,
        ambiguities: candidate.ambiguities
      };
    }
  };
}

function createPostgresSupplierContextSource(options = {}) {
  const supabaseUrl = assertNonEmpty(options.supabaseUrl, 'supabaseUrl').replace(/\/+$/, '');
  const anonKey = assertNonEmpty(options.anonKey, 'anonKey');
  const accessToken = assertNonEmpty(options.accessToken, 'accessToken');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl obrigatorio');

  return {
    async load(supplierId) {
      const url = supabaseUrl + '/rest/v1/extcalc_supplier?supplier_id=eq.' +
        encodeURIComponent(supplierId) + '&select=supplier_id,name,ai_context&limit=1';
      const response = await fetchImpl(url, {
        headers: {
          apikey: anonKey,
          authorization: 'Bearer ' + accessToken,
          accept: 'application/json'
        }
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'SUPPLIER_CONTEXT_LOAD_FAILED');
      return Array.isArray(payload) ? (payload[0] || null) : null;
    }
  };
}

module.exports = {
  CONTRACT_VERSION,
  MAX_LIST_BYTES,
  normalizeInput,
  assertCandidateOutput,
  createListAdvisorService,
  createPostgresSupplierContextSource
};
