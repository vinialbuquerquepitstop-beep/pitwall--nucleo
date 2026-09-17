'use strict';

const ENGINE_VERSION = 'interpreter-core/0.2.0-context-shadow';

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

function parseGenericNumber(input) {
  let s = String(input ?? '').trim().replace(/[^0-9,.-]/g, '');
  if (!s) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    s = decimals >= 1 && decimals <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const decimals = s.length - lastDot - 1;
    if (decimals === 3 && /^-?\d{1,3}(?:\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function applyTransform(value, transform = 'identity') {
  if (value == null) return null;
  if (transform === 'identity') return value;
  if (transform === 'trim') return String(value).trim();
  if (transform === 'lower') return String(value).trim().toLocaleLowerCase('pt-BR');
  if (transform === 'number') return parseGenericNumber(value);
  if (transform === 'integer') {
    const n = parseGenericNumber(value);
    return Number.isInteger(n) ? n : null;
  }
  throw new Error(`transform desconhecido: ${transform}`);
}

function extractFieldCandidates(segment, schema = {}) {
  const out = [];
  const fields = Array.isArray(schema.fields) ? schema.fields : [];

  for (const field of fields) {
    for (const extractor of field.extractors || []) {
      if (extractor.kind === 'role_raw') {
        const role = segment.role_candidates.find(r => r.role === extractor.role);
        if (!role) continue;
        const value = applyTransform(segment.normalized, extractor.transform || 'trim');
        if (value == null || value === '') continue;
        out.push({
          field: field.name,
          value,
          score: extractor.score ?? role.score,
          evidence: {
            kind: 'role_raw',
            role: extractor.role,
            segment_id: segment.segment_id,
            line_number: segment.line_number,
            raw: segment.raw
          }
        });
        continue;
      }

      if (extractor.kind === 'regex') {
        let regex;
        try {
          regex = new RegExp(extractor.pattern, extractor.flags || 'i');
        } catch (err) {
          throw new Error(`extractor regex invalido em ${field.name}: ${err.message}`);
        }
        const match = regex.exec(segment.normalized);
        if (!match) continue;
        const group = extractor.group ?? 1;
        const captured = match[group] ?? match[0];
        const value = applyTransform(captured, extractor.transform || 'trim');
        if (value == null || value === '') continue;
        out.push({
          field: field.name,
          value,
          score: extractor.score ?? 0.7,
          evidence: {
            kind: 'regex',
            pattern: extractor.pattern,
            segment_id: segment.segment_id,
            line_number: segment.line_number,
            raw: segment.raw
          }
        });
      }
    }
  }

  const byKey = new Map();
  for (const candidate of out) {
    const key = `${candidate.field}\u0000${JSON.stringify(candidate.value)}`;
    const prior = byKey.get(key);
    if (!prior || candidate.score > prior.score) byKey.set(key, candidate);
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score);
}

function cloneContext(context) {
  const copy = {};
  for (const [field, value] of Object.entries(context)) copy[field] = { ...value, evidence: { ...value.evidence } };
  return copy;
}

function selectUniqueCandidate(candidates, fieldName) {
  const matches = candidates.filter(c => c.field === fieldName);
  if (!matches.length) return { state: 'none', candidate: null, candidates: [] };
  const unique = new Map();
  for (const c of matches) {
    const key = JSON.stringify(c.value);
    const prior = unique.get(key);
    if (!prior || c.score > prior.score) unique.set(key, c);
  }
  const values = [...unique.values()].sort((a, b) => b.score - a.score);
  if (values.length === 1) return { state: 'unique', candidate: values[0], candidates: values };
  return { state: 'ambiguous', candidate: null, candidates: values };
}

function buildContextTrace(segments, schema = {}) {
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  const inheritable = fields.filter(f => f.context_inheritable);
  const anchors = inheritable.filter(f => f.context_anchor);
  const policy = {
    reset_on_timestamp: schema.context_policy?.reset_on_timestamp !== false,
    anchor_resets_other_context: schema.context_policy?.anchor_resets_other_context !== false
  };
  let context = {};

  return segments.map(segment => {
    const contextBefore = cloneContext(context);
    const events = [];
    const fieldCandidates = extractFieldCandidates(segment, schema);

    if (policy.reset_on_timestamp && isTimestampLine(segment.normalized)) {
      const cleared = Object.keys(context);
      context = {};
      events.push({ type: 'reset', reason: 'timestamp_boundary', fields: cleared });
    }

    let anchorOpened = false;
    for (const field of anchors) {
      const selected = selectUniqueCandidate(fieldCandidates, field.name);
      if (selected.state === 'unique') {
        anchorOpened = true;
        break;
      }
    }

    if (anchorOpened && policy.anchor_resets_other_context) {
      const cleared = Object.keys(context);
      context = {};
      events.push({ type: 'reset', reason: 'new_context_anchor', fields: cleared });
    }

    for (const field of inheritable) {
      const selected = selectUniqueCandidate(fieldCandidates, field.name);
      if (selected.state === 'ambiguous') {
        events.push({
          type: 'context_candidate_ambiguous',
          field: field.name,
          values: selected.candidates.map(c => c.value),
          source_line: segment.line_number
        });
        continue;
      }
      if (selected.state !== 'unique') continue;

      const candidate = selected.candidate;
      context[field.name] = {
        value: candidate.value,
        source_line: segment.line_number,
        source_segment_id: segment.segment_id,
        score: candidate.score,
        evidence: candidate.evidence
      };
      events.push({
        type: 'context_set',
        field: field.name,
        value: candidate.value,
        source_line: segment.line_number
      });
    }

    const contextAfter = cloneContext(context);
    const inheritedContext = {};
    for (const [field, value] of Object.entries(contextAfter)) {
      if (value.source_line !== segment.line_number) inheritedContext[field] = value;
    }

    return {
      ...segment,
      field_candidates: fieldCandidates,
      context_before: contextBefore,
      context_after: contextAfter,
      inherited_context: inheritedContext,
      context_events: events
    };
  });
}

function makeBaseBundle(request, segments, warnings) {
  const { document, schema = {}, knowledge = null } = request;
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
        context: segment.inherited_context || {}
      });
    } else if (top.role === 'noise') {
      invalid.push({
        cause: top.reason,
        raw: segment.raw,
        sources: [segment.line_number]
      });
    }
  }

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
    warnings,
    metrics: {
      n_lines: segments.length,
      n_records: 0,
      n_ambiguous: ambiguities.length,
      n_invalid: invalid.length,
      n_context_events: segments.reduce((n, s) => n + (s.context_events?.length || 0), 0),
      parse_ms: 0,
      fallback_calls: 0
    }
  };
}

function interpretStructural(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');
  const started = Date.now();
  const segments = segmentDocument(request.document);
  const bundle = makeBaseBundle(request, segments, ['shadow_mode_structural_only', 'no_semantic_resolution']);
  bundle.metrics.parse_ms = Date.now() - started;
  return bundle;
}

function interpretContextual(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');
  const started = Date.now();
  const structural = segmentDocument(request.document);
  const segments = buildContextTrace(structural, request.schema || {});
  const bundle = makeBaseBundle(request, segments, ['shadow_mode_context_only', 'no_semantic_resolution', 'no_persistence']);
  bundle.metrics.parse_ms = Date.now() - started;
  return bundle;
}

module.exports = {
  ENGINE_VERSION,
  normalizeText,
  normalizeLine,
  isTimestampLine,
  scoreRoles,
  segmentDocument,
  parseGenericNumber,
  applyTransform,
  extractFieldCandidates,
  buildContextTrace,
  interpretStructural,
  interpretContextual
};
