'use strict';

const ENGINE_VERSION = 'interpreter-core/0.4.0-offer-expansion-shadow';

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

function normalizeKey(input) {
  return normalizeLine(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
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
        const matchMode = extractor.match_mode === 'all' ? 'all' : 'first';
        let flags = extractor.flags || 'i';
        if (matchMode === 'all' && !flags.includes('g')) flags += 'g';
        try {
          regex = new RegExp(extractor.pattern, flags);
        } catch (err) {
          throw new Error(`extractor regex invalido em ${field.name}: ${err.message}`);
        }

        const matches = [];
        if (matchMode === 'all') {
          let match;
          while ((match = regex.exec(segment.normalized)) !== null) {
            matches.push(match);
            if (match[0] === '') regex.lastIndex += 1;
          }
        } else {
          const match = regex.exec(segment.normalized);
          if (match) matches.push(match);
        }

        for (let occurrence = 0; occurrence < matches.length; occurrence += 1) {
          const match = matches[occurrence];
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
              match_mode: matchMode,
              occurrence: occurrence + 1,
              match_index: match.index,
              segment_id: segment.segment_id,
              line_number: segment.line_number,
              raw: segment.raw
            }
          });
        }
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

function uniqueFieldCandidates(candidates, fieldName) {
  const matches = candidates.filter(c => c.field === fieldName);
  const unique = new Map();
  for (const c of matches) {
    const key = JSON.stringify(c.value);
    const prior = unique.get(key);
    if (!prior || c.score > prior.score) unique.set(key, c);
  }
  return [...unique.values()].sort((a, b) => b.score - a.score);
}

function selectUniqueCandidate(candidates, fieldName) {
  const values = uniqueFieldCandidates(candidates, fieldName);
  if (!values.length) return { state: 'none', candidate: null, candidates: [] };
  if (values.length === 1) return { state: 'unique', candidate: values[0], candidates: values };
  return { state: 'ambiguous', candidate: null, candidates: values };
}

function buildContextTrace(segments, schema = {}) {
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  const inheritable = fields.filter(f => f.context_inheritable);
  const anchors = inheritable.filter(f => f.context_anchor);
  const preserveOnAnchor = new Set(
    Array.isArray(schema.context_policy?.preserve_on_anchor)
      ? schema.context_policy.preserve_on_anchor
      : []
  );
  const policy = {
    reset_on_timestamp: schema.context_policy?.reset_on_timestamp !== false,
    anchor_resets_other_context: schema.context_policy?.anchor_resets_other_context !== false,
    preserve_on_anchor: preserveOnAnchor
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
      const preserved = {};
      const cleared = [];
      for (const [field, value] of Object.entries(context)) {
        if (policy.preserve_on_anchor.has(field)) preserved[field] = value;
        else cleared.push(field);
      }
      context = preserved;
      events.push({
        type: 'reset',
        reason: 'new_context_anchor',
        fields: cleared,
        preserved_fields: Object.keys(preserved)
      });
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

function buildKnowledgeIndex(knowledge = {}) {
  const entitiesByKind = new Map();
  const aliasesByKind = new Map();

  for (const entity of knowledge.entities || []) {
    const kind = entity.kind;
    if (!entitiesByKind.has(kind)) entitiesByKind.set(kind, []);
    entitiesByKind.get(kind).push({ ...entity, normalized_label: normalizeKey(entity.label) });
  }

  for (const alias of knowledge.aliases || []) {
    const kind = alias.kind;
    if (!aliasesByKind.has(kind)) aliasesByKind.set(kind, []);
    aliasesByKind.get(kind).push({
      ...alias,
      normalized_text: normalizeKey(alias.normalized || alias.text)
    });
  }

  return { entitiesByKind, aliasesByKind };
}

function resolveEntityCandidate(candidate, field, knowledgeIndex) {
  const resolver = field.resolver;
  if (!resolver || resolver.kind !== 'entity') {
    return {
      state: 'literal',
      field: field.name,
      input: candidate.value,
      value: candidate.value,
      score: candidate.score,
      evidence: candidate.evidence
    };
  }

  const key = normalizeKey(candidate.value);
  const entityKind = resolver.entity_kind;
  const allowed = new Set(resolver.match || []);
  const matches = [];

  if (allowed.has('alias')) {
    for (const alias of knowledgeIndex.aliasesByKind.get(entityKind) || []) {
      if (alias.normalized_text !== key) continue;
      matches.push({
        entity_id: alias.target_id,
        via: 'alias',
        matched: alias.text,
        score: Math.min(1, candidate.score * 0.99)
      });
    }
  }

  if (allowed.has('label')) {
    for (const entity of knowledgeIndex.entitiesByKind.get(entityKind) || []) {
      if (entity.normalized_label !== key) continue;
      matches.push({
        entity_id: entity.id,
        via: 'label',
        matched: entity.label,
        score: candidate.score
      });
    }
  }

  const grouped = new Map();
  for (const match of matches) {
    const prior = grouped.get(match.entity_id);
    if (!prior || match.score > prior.score) grouped.set(match.entity_id, match);
  }
  const unique = [...grouped.values()].sort((a, b) => b.score - a.score);

  if (!unique.length) {
    return {
      state: 'unresolved',
      field: field.name,
      input: candidate.value,
      entity_kind: entityKind,
      matches: [],
      score: candidate.score,
      evidence: candidate.evidence
    };
  }

  if (unique.length > 1) {
    return {
      state: 'ambiguous',
      field: field.name,
      input: candidate.value,
      entity_kind: entityKind,
      matches: unique,
      score: candidate.score,
      evidence: candidate.evidence
    };
  }

  const chosen = unique[0];
  const entity = (knowledgeIndex.entitiesByKind.get(entityKind) || []).find(e => e.id === chosen.entity_id) || null;
  return {
    state: chosen.via === 'label' ? 'interpreted' : 'inferred',
    field: field.name,
    input: candidate.value,
    entity_kind: entityKind,
    entity_id: chosen.entity_id,
    value: entity?.label ?? candidate.value,
    attributes: entity?.attributes || {},
    via: chosen.via,
    score: chosen.score,
    evidence: candidate.evidence
  };
}

function semanticizeSegments(segments, schema = {}, knowledge = {}) {
  const knowledgeIndex = buildKnowledgeIndex(knowledge);
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  const fieldsByName = new Map(fields.map(f => [f.name, f]));

  return segments.map(segment => {
    const semanticCandidates = [];
    for (const candidate of segment.field_candidates || []) {
      const field = fieldsByName.get(candidate.field);
      if (!field) continue;
      semanticCandidates.push(resolveEntityCandidate(candidate, field, knowledgeIndex));
    }
    return { ...segment, semantic_candidates: semanticCandidates };
  });
}

function resolveContextEntry(entry, field, knowledgeIndex) {
  if (!entry) return null;
  const candidate = {
    field: field.name,
    value: entry.value,
    score: entry.score,
    evidence: entry.evidence
  };
  const result = resolveEntityCandidate(candidate, field, knowledgeIndex);
  return { ...result, source_line: entry.source_line, source_segment_id: entry.source_segment_id };
}

function composeRecords(segments, schema = {}, knowledge = {}) {
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  const fieldsByName = new Map(fields.map(f => [f.name, f]));
  const triggers = fields.filter(f => f.record_trigger);
  const knowledgeIndex = buildKnowledgeIndex(knowledge);
  const records = [];
  const ambiguities = [];
  const learningProposals = [];

  for (const segment of segments) {
    const triggerCandidates = [];
    for (const trigger of triggers) {
      const selected = selectUniqueCandidate(segment.field_candidates || [], trigger.name);
      if (selected.state === 'unique') triggerCandidates.push({ field: trigger, candidate: selected.candidate });
      if (selected.state === 'ambiguous') {
        ambiguities.push({
          ambiguity_id: `amb-${segment.segment_id}-${trigger.name}`,
          field: trigger.name,
          cause: 'multiple_trigger_candidates',
          raw: segment.raw,
          candidates: selected.candidates,
          sources: [segment.line_number],
          context: segment.inherited_context || {}
        });
      }
    }

    if (!triggerCandidates.length) continue;

    const fieldsOut = {};
    const trace = [];
    let blocked = false;
    let inferred = false;
    let recordExpansion = null;

    const directByField = new Map();
    for (const candidate of segment.field_candidates || []) {
      if (!directByField.has(candidate.field)) directByField.set(candidate.field, []);
      directByField.get(candidate.field).push(candidate);
    }

    for (const field of fields) {
      const directCandidates = uniqueFieldCandidates(segment.field_candidates || [], field.name);

      if (field.expand_records === true && directCandidates.length > 1) {
        if (field.resolver?.kind === 'entity') {
          blocked = true;
          ambiguities.push({
            ambiguity_id: `amb-${segment.segment_id}-${field.name}-expansion-entity`,
            field: field.name,
            cause: 'record_expansion_entity_not_supported_v1',
            raw: segment.raw,
            candidates: directCandidates,
            sources: [segment.line_number],
            context: segment.inherited_context || {}
          });
          continue;
        }

        if (recordExpansion) {
          blocked = true;
          ambiguities.push({
            ambiguity_id: `amb-${segment.segment_id}-${field.name}-multiple-expansions`,
            field: field.name,
            cause: 'multiple_record_expansion_fields',
            raw: segment.raw,
            candidates: directCandidates,
            sources: [segment.line_number],
            context: segment.inherited_context || {}
          });
          continue;
        }

        recordExpansion = {
          field,
          candidates: directCandidates
        };
        continue;
      }

      let selected = selectUniqueCandidate(segment.field_candidates || [], field.name);
      let sourceType = 'direct';
      let sourceCandidate = selected.candidate;

      if (selected.state === 'none' && segment.inherited_context?.[field.name]) {
        const entry = segment.inherited_context[field.name];
        sourceType = 'context';
        sourceCandidate = {
          field: field.name,
          value: entry.value,
          score: entry.score,
          evidence: entry.evidence
        };
      }

      if (selected.state === 'ambiguous') {
        blocked = true;
        ambiguities.push({
          ambiguity_id: `amb-${segment.segment_id}-${field.name}`,
          field: field.name,
          cause: 'multiple_field_candidates',
          raw: segment.raw,
          candidates: selected.candidates,
          sources: [segment.line_number],
          context: segment.inherited_context || {}
        });
        continue;
      }

      if (!sourceCandidate) {
        if (field.required) {
          blocked = true;
          ambiguities.push({
            ambiguity_id: `amb-${segment.segment_id}-${field.name}-missing`,
            field: field.name,
            cause: 'required_field_missing',
            raw: segment.raw,
            candidates: [],
            sources: [segment.line_number],
            context: segment.inherited_context || {}
          });
        }
        continue;
      }

      let resolved;
      if (field.resolver?.kind === 'entity') {
        if (sourceType === 'context') {
          resolved = resolveContextEntry(segment.inherited_context[field.name], field, knowledgeIndex);
        } else {
          resolved = resolveEntityCandidate(sourceCandidate, field, knowledgeIndex);
        }

        if (resolved.state === 'unresolved') {
          blocked = true;
          ambiguities.push({
            ambiguity_id: `amb-${segment.segment_id}-${field.name}-unresolved`,
            field: field.name,
            cause: 'entity_unresolved',
            raw: String(sourceCandidate.value),
            candidates: [],
            sources: [resolved.source_line || sourceCandidate.evidence?.line_number || segment.line_number],
            context: segment.inherited_context || {}
          });
          learningProposals.push({
            proposal_id: `learn-${segment.segment_id}-${field.name}`,
            kind: 'local_resolution',
            payload: {
              field: field.name,
              entity_kind: field.resolver.entity_kind,
              raw: sourceCandidate.value
            },
            evidence: [resolved.source_line || sourceCandidate.evidence?.line_number || segment.line_number],
            score: sourceCandidate.score ?? null
          });
          continue;
        }

        if (resolved.state === 'ambiguous') {
          blocked = true;
          ambiguities.push({
            ambiguity_id: `amb-${segment.segment_id}-${field.name}-entity`,
            field: field.name,
            cause: 'entity_resolution_ambiguous',
            raw: String(sourceCandidate.value),
            candidates: resolved.matches,
            sources: [resolved.source_line || sourceCandidate.evidence?.line_number || segment.line_number],
            context: segment.inherited_context || {}
          });
          continue;
        }

        if (resolved.state === 'inferred') inferred = true;
        fieldsOut[field.name] = resolved.entity_id ? {
          id: resolved.entity_id,
          label: resolved.value,
          attributes: resolved.attributes || {}
        } : resolved.value;
        trace.push({
          field: field.name,
          chosen: fieldsOut[field.name],
          sources: [resolved.source_line || sourceCandidate.evidence?.line_number || segment.line_number],
          derived_from: sourceType === 'context' ? [resolved.source_line] : [],
          rules: [`resolver:${resolved.via || resolved.state}`],
          alternatives: [],
          score: resolved.score ?? null
        });
      } else {
        fieldsOut[field.name] = sourceCandidate.value;
        trace.push({
          field: field.name,
          chosen: sourceCandidate.value,
          sources: [sourceType === 'context'
            ? segment.inherited_context[field.name].source_line
            : sourceCandidate.evidence?.line_number || segment.line_number],
          derived_from: sourceType === 'context' ? [segment.inherited_context[field.name].source_line] : [],
          rules: [sourceType === 'context' ? 'context_inheritance' : 'direct_extraction'],
          alternatives: [],
          score: sourceCandidate.score ?? null
        });
      }
    }

    if (!blocked) {
      if (recordExpansion) {
        for (let index = 0; index < recordExpansion.candidates.length; index += 1) {
          const candidate = recordExpansion.candidates[index];
          const expandedFields = {
            ...fieldsOut,
            [recordExpansion.field.name]: candidate.value
          };
          const expandedTrace = [
            ...trace,
            {
              field: recordExpansion.field.name,
              chosen: candidate.value,
              sources: [candidate.evidence?.line_number || segment.line_number],
              derived_from: [],
              rules: ['record_expansion:direct_extraction'],
              alternatives: [],
              score: candidate.score ?? null
            }
          ];

          records.push({
            record_id: `record-${segment.segment_id}-exp-${index + 1}`,
            state: inferred ? 'inferred' : 'interpreted',
            fields: expandedFields,
            trace: expandedTrace
          });
        }
      } else {
        records.push({
          record_id: `record-${segment.segment_id}`,
          state: inferred ? 'inferred' : 'interpreted',
          fields: fieldsOut,
          trace
        });
      }
    }
  }

  return { records, ambiguities, learningProposals };
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
      n_learning_proposals: 0,
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

function interpretResolved(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');
  const started = Date.now();
  const structural = segmentDocument(request.document);
  const contextual = buildContextTrace(structural, request.schema || {});
  const segments = semanticizeSegments(contextual, request.schema || {}, request.knowledge || {});
  const composed = composeRecords(segments, request.schema || {}, request.knowledge || {});
  const bundle = makeBaseBundle(request, segments, ['shadow_mode_resolver', 'no_persistence', 'no_operational_price_write']);
  bundle.records = composed.records;
  bundle.ambiguities.push(...composed.ambiguities);
  bundle.learning_proposals = composed.learningProposals;
  bundle.metrics.n_records = bundle.records.length;
  bundle.metrics.n_ambiguous = bundle.ambiguities.length;
  bundle.metrics.n_learning_proposals = bundle.learning_proposals.length;
  bundle.metrics.parse_ms = Date.now() - started;
  return bundle;
}

module.exports = {
  ENGINE_VERSION,
  normalizeText,
  normalizeLine,
  normalizeKey,
  isTimestampLine,
  scoreRoles,
  segmentDocument,
  parseGenericNumber,
  applyTransform,
  extractFieldCandidates,
  uniqueFieldCandidates,
  buildContextTrace,
  buildKnowledgeIndex,
  resolveEntityCandidate,
  semanticizeSegments,
  composeRecords,
  interpretStructural,
  interpretContextual,
  interpretResolved
};
