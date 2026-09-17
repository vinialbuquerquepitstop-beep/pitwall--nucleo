'use strict';

const ENGINE_VERSION = 'interpreter-core/0.1.0-shadow';

function normalizeText(input) {
  return String(input ?? '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n');
}

function normalizeLine(input) {
  return String(input ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTimestampLine(line) {
  return /^\[?\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}(?:,|\s)+\s*\d{1,2}:\d{2}/.test(line)
    || /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/.test(line);
}

function scoreRoles(line) {
  const roles = [];
  const t = normalizeLine(line);
  const lower = t.toLocaleLowerCase('pt-BR');
  const push = (role, score, reason) => roles.push({ role, score, reason });

  if (!t) {
    push('noise', 1, 'empty-line');
    return roles;
  }

  if (isTimestampLine(t)) push('header', 0.82, 'timestamp-pattern');

  if (/https?:\/\/|chat\.whatsapp\.com\//i.test(t)) {
    push('note', 0.8, 'link-pattern');
  }

  if (/^(r\$|us\$|usd|\$|€|£)\s*\d/i.test(t)
      || /\b(r\$|us\$|usd|€|£)\s*\d/i.test(t)
      || /^\s*\d{2,6}(?:[.,]\d{1,2})?\s*$/.test(t)) {
    push('price_line', 0.74, 'money-or-isolated-number-pattern');
  }

  if (/\b(lacrado|seminovo|cpo|novo|usado|open box|caixa aberta)\b/i.test(t)) {
    push('condition', 0.56, 'condition-token');
  }

  if (/\b(64|128|256|512)\s*(gb)?\b/i.test(t) || /\b[124]\s*tb\b/i.test(t)) {
    push('variant', 0.5, 'capacity-token');
  }

  if (/[a-zA-ZÀ-ÿ]/.test(t) && /\d/.test(t) && t.length <= 140) {
    push('product_header', 0.48, 'mixed-alpha-numeric-short-line');
  }

  if (/\b(tabela|lista|atacado|revenda|retirada|entrega|garantia|obs|aten[cç][aã]o)\b/i.test(lower)) {
    push('note', 0.45, 'commercial-note-token');
  }

  if (/^[^\p{L}\p{N}]+$/u.test(t)) push('noise', 0.95, 'symbols-only');

  if (!roles.length) push('unknown', 1, 'no-structural-signal');

  return roles
    .sort((a, b) => b.score - a.score)
    .map((r, index) => ({ ...r, rank: index + 1 }));
}

function segmentDocument(document) {
  if (!document || document.contract_version !== 'raw-document/v1') {
    throw new Error('RawDocument invalido: contract_version esperado raw-document/v1');
  }
  if (typeof document.content !== 'string') {
    throw new Error('RawDocument invalido: content precisa ser string');
  }

  const normalizedDocument = normalizeText(document.content);
  const lines = normalizedDocument.split('\n');

  return lines.map((raw, index) => {
    const normalized = normalizeLine(raw);
    return {
      segment_id: `line-${index + 1}`,
      line_number: index + 1,
      raw,
      normalized,
      role_candidates: scoreRoles(raw)
    };
  });
}

function interpretStructural(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');
  const { document, schema = {}, knowledge = null } = request;
  const started = Date.now();
  const segments = segmentDocument(document);

  const invalid = [];
  const ambiguities = [];

  for (const segment of segments) {
    const top = segment.role_candidates[0];
    if (!top) continue;
    if (top.role === 'unknown') {
      ambiguities.push({
        ambiguity_id: `amb-${segment.segment_id}`,
        field: null,
        cause: 'structural_role_unknown',
        raw: segment.raw,
        candidates: segment.role_candidates,
        sources: [segment.line_number],
        context: {}
      });
    } else if (top.role === 'noise') {
      invalid.push({
        cause: top.reason,
        raw: segment.raw,
        sources: [segment.line_number]
      });
    }
  }

  const parseMs = Date.now() - started;

  return {
    contract_version: 'interpretation-bundle/v1',
    run: {
      run_id: `shadow-${document.document_id}`,
      document_id: document.document_id,
      document_hash: document.content_hash ?? null,
      engine_version: ENGINE_VERSION,
      schema_id: schema.schema_id || 'structural-only',
      schema_version: schema.schema_version || '0',
      knowledge_version: knowledge?.version || null,
      started_at: null,
      finished_at: null
    },
    segments,
    records: [],
    ambiguities,
    invalid,
    learning_proposals: [],
    warnings: ['shadow_mode_structural_only', 'no_semantic_resolution'],
    metrics: {
      n_lines: segments.length,
      n_records: 0,
      n_ambiguous: ambiguities.length,
      n_invalid: invalid.length,
      parse_ms: parseMs,
      fallback_calls: 0
    }
  };
}

module.exports = {
  ENGINE_VERSION,
  normalizeText,
  normalizeLine,
  scoreRoles,
  segmentDocument,
  interpretStructural
};
