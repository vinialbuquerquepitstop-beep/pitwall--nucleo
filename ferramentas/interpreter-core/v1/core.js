'use strict';

const ENGINE_VERSION = 'interpreter-core/0.5.1-context-scope-shadow';

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

function stripMessagePrefix(line) {
  const t = normalizeLine(line);
  return t
    .replace(/^\s*\[[^\]]{4,40}\]\s*[^:]{1,60}:\s*/, '')
    .replace(/^\s*\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*[-–—]\s*[^:]{1,60}:\s*/, '');
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

function applyFieldValueMap(value, field = {}) {
  if (value == null || !field.value_map || typeof field.value_map !== 'object') return value;
  const key = normalizeKey(value);
  for (const [raw, canonical] of Object.entries(field.value_map)) {
    if (normalizeKey(raw) === key) return canonical;
  }
  return value;
}

function extractFieldCandidates(segment, schema = {}) {
  const out = [];
  const fields = Array.isArray(schema.fields) ? schema.fields : [];

  for (const field of fields) {
    for (const extractor of field.extractors || []) {
      if (extractor.kind === 'role_raw') {
        const role = segment.role_candidates.find(r => r.role === extractor.role);
        if (!role) continue;
        const transformed = applyTransform(segment.normalized, extractor.transform || 'trim');
        const value = applyFieldValueMap(transformed, field);
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

        const inputText = extractor.input === 'message_body'
          ? stripMessagePrefix(segment.normalized)
          : segment.normalized;

        const matches = [];
        if (matchMode === 'all') {
          let match;
          while ((match = regex.exec(inputText)) !== null) {
            matches.push(match);
            if (match[0] === '') regex.lastIndex += 1;
          }
        } else {
          const match = regex.exec(inputText);
          if (match) matches.push(match);
        }

        for (let occurrence = 0; occurrence < matches.length; occurrence += 1) {
          const match = matches[occurrence];
          const group = extractor.group ?? 1;
          const captured = match[group] ?? match[0];
          const transformed = applyTransform(captured, extractor.transform || 'trim');
          const value = applyFieldValueMap(transformed, field);
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
              raw: segment.raw,
              extractor_input: extractor.input || 'segment',
              captured: match[0]
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

  let deduped = [...byKey.values()];
  for (const field of fields) {
    const preferred = Array.isArray(field.prefer_values_if_present)
      ? field.prefer_values_if_present.map(normalizeKey)
      : [];
    if (!preferred.length) continue;

    const candidates = deduped.filter(candidate => candidate.field === field.name);
    const preferredCandidate = candidates
      .filter(candidate => preferred.includes(normalizeKey(candidate.value)))
      .sort((a, b) =>
        preferred.indexOf(normalizeKey(a.value)) - preferred.indexOf(normalizeKey(b.value)) ||
        b.score - a.score
      )[0];

    if (!preferredCandidate) continue;
    const chosenKey = normalizeKey(preferredCandidate.value);
    deduped = deduped.filter(candidate =>
      candidate.field !== field.name || normalizeKey(candidate.value) === chosenKey
    );
  }

  return deduped.sort((a, b) => b.score - a.score);
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
  const boundaries = fields.filter(f => f.context_boundary === true);
  const preserveOnAnchor = new Set(
    Array.isArray(schema.context_policy?.preserve_on_anchor)
      ? schema.context_policy.preserve_on_anchor
      : []
  );
  const preserveOnTimestamp = new Set(
    Array.isArray(schema.context_policy?.preserve_on_timestamp)
      ? schema.context_policy.preserve_on_timestamp
      : []
  );
  const policy = {
    reset_on_timestamp: schema.context_policy?.reset_on_timestamp !== false,
    anchor_resets_other_context: schema.context_policy?.anchor_resets_other_context !== false,
    preserve_on_anchor: preserveOnAnchor,
    preserve_on_timestamp: preserveOnTimestamp
  };
  let context = {};

  return segments.map(segment => {
    const contextBefore = cloneContext(context);
    const events = [];
    const fieldCandidates = extractFieldCandidates(segment, schema);

    if (policy.reset_on_timestamp && isTimestampLine(segment.normalized)) {
      const preserved = {};
      const cleared = [];
      for (const [field, value] of Object.entries(context)) {
        if (policy.preserve_on_timestamp.has(field)) preserved[field] = value;
        else cleared.push(field);
      }
      context = preserved;
      events.push({
        type: 'reset',
        reason: 'timestamp_boundary',
        fields: cleared,
        preserved_fields: Object.keys(preserved)
      });
    }

    const anchorOpened = anchors.some(field =>
      selectUniqueCandidate(fieldCandidates, field.name).state === 'unique'
    );

    let boundaryOpened = null;
    for (const field of boundaries) {
      if (field.skip_if_anchor_present === true && anchorOpened) continue;
      const candidates = fieldCandidates.filter(candidate => candidate.field === field.name);
      if (candidates.length > 0) {
        boundaryOpened = field;
        break;
      }
    }

    if (boundaryOpened) {
      const preserveFields = new Set(
        Array.isArray(boundaryOpened.preserve_fields)
          ? boundaryOpened.preserve_fields
          : []
      );
      const preserved = {};
      const cleared = [];
      for (const [field, value] of Object.entries(context)) {
        if (preserveFields.has(field)) preserved[field] = value;
        else cleared.push(field);
      }
      context = preserved;
      events.push({
        type: 'reset',
        reason: boundaryOpened.context_boundary_reason || 'domain_boundary',
        field: boundaryOpened.name,
        fields: cleared,
        preserved_fields: Object.keys(preserved)
      });
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

function isFieldOnlySegment(segment, fieldName) {
  const candidates = uniqueFieldCandidates(segment.field_candidates || [], fieldName);
  if (!candidates.length) return false;

  let remainder = String(segment.normalized || '');
  for (const candidate of candidates) {
    const captured = candidate.evidence?.captured;
    if (!captured) return false;
    const index = remainder.toLocaleLowerCase('pt-BR').indexOf(
      String(captured).toLocaleLowerCase('pt-BR')
    );
    if (index < 0) continue;
    remainder = remainder.slice(0, index) + ' ' + remainder.slice(index + String(captured).length);
  }

  return normalizeKey(remainder) === '';
}

function applyOrderedFieldPairing(segments, schema = {}) {
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  const pairFields = fields.filter(field => field.pair_by_order_with_trigger);
  if (!pairFields.length) return segments;

  const anchorNames = new Set(fields.filter(field => field.context_anchor).map(field => field.name));
  const out = segments.map(segment => ({
    ...segment,
    field_candidates: [...(segment.field_candidates || [])],
    pairing_ambiguities: [...(segment.pairing_ambiguities || [])]
  }));

  const blocks = [];
  let blockStart = null;

  const closeBlock = end => {
    if (blockStart != null && end > blockStart) blocks.push([blockStart, end]);
    blockStart = null;
  };

  for (let index = 0; index < out.length; index += 1) {
    const segment = out[index];
    const hardBoundary = (segment.context_events || []).some(event =>
      event.reason === 'timestamp_boundary' || event.reason === 'domain_boundary' || event.reason === 'supplier_boundary'
    );
    if (hardBoundary) closeBlock(index);

    const hasAnchor = [...anchorNames].some(name =>
      uniqueFieldCandidates(segment.field_candidates || [], name).length > 0
    );
    if (hasAnchor) {
      closeBlock(index);
      blockStart = index;
    }
  }
  closeBlock(out.length);

  const collectRows = (start, end, field, triggerField, policy) => {
    const sources = [];
    const targets = [];
    for (let index = start; index < end; index += 1) {
      const segment = out[index];
      const sourceCandidates = uniqueFieldCandidates(segment.field_candidates || [], field.name);
      const triggerCandidates = uniqueFieldCandidates(segment.field_candidates || [], triggerField);

      if (sourceCandidates.length > 0 && triggerCandidates.length === 0) {
        if (policy.require_source_only !== true || isFieldOnlySegment(segment, field.name)) {
          sources.push({ index, candidates: sourceCandidates });
        }
      }
      if (triggerCandidates.length === 1 && sourceCandidates.length === 0) {
        targets.push({ index, candidate: triggerCandidates[0] });
      }
    }
    return { sources, targets };
  };

  const supplierForBlock = (start, end) => {
    for (let index = start; index < end; index += 1) {
      const inherited = out[index]?.inherited_context?.supplier?.value;
      if (inherited != null && inherited !== '') return String(inherited);
      const direct = uniqueFieldCandidates(out[index]?.field_candidates || [], 'supplier');
      if (direct.length === 1) return String(direct[0].value);
    }
    return null;
  };

  const nearestProposals = (sources, targets, policy) => {
    const proposals = [];
    for (const source of sources) {
      const ranked = targets
        .map(target => ({ target, distance: Math.abs(target.index - source.index) }))
        .sort((a, b) => a.distance - b.distance || a.target.index - b.target.index);
      if (!ranked.length) continue;
      if (ranked.length > 1 && ranked[0].distance === ranked[1].distance) continue;
      if (Number.isFinite(Number(policy.fallback_max_distance))
          && ranked[0].distance > Number(policy.fallback_max_distance)) continue;
      const target = ranked[0].target;
      proposals.push({
        source,
        target,
        distance: ranked[0].distance,
        direction: source.index < target.index ? 'before' : source.index > target.index ? 'after' : 'same'
      });
    }
    return proposals;
  };

  for (const field of pairFields) {
    const policy = typeof field.pair_by_order_with_trigger === 'string'
      ? { field: field.pair_by_order_with_trigger }
      : field.pair_by_order_with_trigger;
    const triggerField = policy?.field;
    if (!triggerField) continue;

    const guard = policy.fallback_supplier_direction_guard;
    const supplierEvidence = new Map();

    if (guard && policy.fallback_unique_nearest === true) {
      for (const [start, end] of blocks) {
        const { sources, targets } = collectRows(start, end, field, triggerField, policy);
        if (!sources.length || !targets.length || sources.length === targets.length) continue;

        const supplier = supplierForBlock(start, end);
        if (!supplier) continue;

        const proposals = nearestProposals(sources, targets, policy);
        if (!proposals.length) continue;
        const directions = new Set(proposals.map(proposal => proposal.direction).filter(x => x !== 'same'));
        if (directions.size !== 1) continue;

        const direction = [...directions][0];
        if (!supplierEvidence.has(supplier)) {
          supplierEvidence.set(supplier, { before: 0, after: 0 });
        }
        supplierEvidence.get(supplier)[direction] += 1;
      }
    }

    const dominantDirection = supplier => {
      if (!guard || !supplier) return null;
      const evidence = supplierEvidence.get(supplier);
      if (!evidence) return null;
      const minPureGroups = Number.isFinite(Number(guard.min_pure_groups))
        ? Number(guard.min_pure_groups)
        : 3;
      const requireZeroOpposite = guard.require_zero_opposite !== false;

      if (evidence.after >= minPureGroups && (!requireZeroOpposite || evidence.before === 0)) return 'after';
      if (evidence.before >= minPureGroups && (!requireZeroOpposite || evidence.after === 0)) return 'before';
      return null;
    };

    for (const [start, end] of blocks) {
      const { sources, targets } = collectRows(start, end, field, triggerField, policy);
      if (!sources.length || !targets.length) continue;

      const appendCandidates = (source, target, kind) => {
        const targetSegment = out[target.index];
        for (const candidate of source.candidates) {
          targetSegment.field_candidates.push({
            ...candidate,
            score: Math.min(1, (candidate.score ?? 0.7) * 0.99),
            evidence: {
              ...(candidate.evidence || {}),
              kind,
              paired_field: field.name,
              trigger_field: triggerField,
              source_line: out[source.index].line_number,
              target_line: targetSegment.line_number
            }
          });
        }
      };

      const countsEqual = sources.length === targets.length;
      if (countsEqual) {
        const pairCount = sources.length;
        if (policy.require_adjacent_rows === true) {
          const allAdjacent = Array.from({ length: pairCount }, (_, pairIndex) =>
            targets[pairIndex]?.index === sources[pairIndex]?.index + 1
          ).every(Boolean);
          if (!allAdjacent) continue;
        }
        for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
          appendCandidates(sources[pairIndex], targets[pairIndex], 'ordered_pair');
        }
        continue;
      }

      if (policy.require_equal_rows !== false && policy.fallback_unique_nearest !== true) continue;
      if (policy.fallback_unique_nearest !== true) continue;

      const proposals = nearestProposals(sources, targets, policy);
      const proposalDirections = new Set(
        proposals.map(proposal => proposal.direction).filter(direction => direction !== 'same')
      );
      const mixedDirections = proposalDirections.size > 1;
      const supplier = supplierForBlock(start, end);
      const dominant = mixedDirections ? dominantDirection(supplier) : null;
      const maxDistance = Number.isFinite(Number(policy.fallback_max_distance))
        ? Number(policy.fallback_max_distance)
        : null;

      for (const proposal of proposals) {
        const guardAtMax = guard?.only_at_max_distance !== false;
        const opposingDominant = dominant && proposal.direction !== 'same' && proposal.direction !== dominant;
        const atGuardDistance = maxDistance == null
          ? false
          : guardAtMax
            ? proposal.distance === maxDistance
            : proposal.distance >= maxDistance;

        if (opposingDominant && atGuardDistance) {
          const targetSegment = out[proposal.target.index];
          targetSegment.pairing_ambiguities.push({
            ambiguity_id: `amb-${targetSegment.segment_id}-${field.name}-supplier-direction-${out[proposal.source.index].line_number}`,
            field: field.name,
            cause: 'pairing_supplier_direction_conflict',
            raw: null,
            candidates: [],
            sources: [
              out[proposal.source.index].line_number,
              targetSegment.line_number
            ],
            context: {
              supplier,
              dominant_direction: dominant,
              candidate_direction: proposal.direction,
              distance: proposal.distance
            }
          });
          continue;
        }

        appendCandidates(proposal.source, proposal.target, 'nearest_unique_pair');
      }
    }

    const adjacentPolicy = policy.adjacent_unique_before_trigger;
    const adjacentEnabled =
      adjacentPolicy === true ||
      (adjacentPolicy && typeof adjacentPolicy === 'object' && adjacentPolicy.enabled === true);

    if (adjacentEnabled) {
      const adjacentConfig = adjacentPolicy === true ? {} : adjacentPolicy;
      const allowedNonFieldOnlyRoles = new Set(
        Array.isArray(adjacentConfig.non_field_only_roles)
          ? adjacentConfig.non_field_only_roles
          : []
      );
      const minLeftoverTokens = Number.isFinite(Number(adjacentConfig.min_leftover_tokens))
        ? Number(adjacentConfig.min_leftover_tokens)
        : 0;

      for (const [start, end] of blocks) {
        for (let targetIndex = Math.max(start + 1, 1); targetIndex < end; targetIndex += 1) {
          const targetSegment = out[targetIndex];
          const triggerCandidates = uniqueFieldCandidates(
            targetSegment.field_candidates || [],
            triggerField
          );
          const existingFieldCandidates = uniqueFieldCandidates(
            targetSegment.field_candidates || [],
            field.name
          );
          if (triggerCandidates.length !== 1 || existingFieldCandidates.length !== 0) continue;

          const sourceIndex = targetIndex - 1;
          if (sourceIndex < start) continue;
          const sourceSegment = out[sourceIndex];
          const sourceCandidates = uniqueFieldCandidates(
            sourceSegment.field_candidates || [],
            field.name
          );
          const sourceTriggerCandidates = uniqueFieldCandidates(
            sourceSegment.field_candidates || [],
            triggerField
          );
          if (sourceCandidates.length !== 1 || sourceTriggerCandidates.length !== 0) continue;

          const candidate = sourceCandidates[0];
          const sourceIsFieldOnly = isFieldOnlySegment(sourceSegment, field.name);

          if (!sourceIsFieldOnly) {
            const topRole = sourceSegment.role_candidates?.[0]?.role || 'unknown';
            if (!allowedNonFieldOnlyRoles.has(topRole)) continue;

            const normalizedSource = String(sourceSegment.normalized || '').trim();
            const capturedSource = String(candidate.evidence?.captured || candidate.value || '');
            const normalizedLower = normalizedSource.toLocaleLowerCase('pt-BR');
            const capturedLower = capturedSource.toLocaleLowerCase('pt-BR');
            const capturedIndex = capturedLower ? normalizedLower.indexOf(capturedLower) : -1;
            const leftover = capturedIndex >= 0
              ? (
                  normalizedSource.slice(0, capturedIndex) +
                  ' ' +
                  normalizedSource.slice(capturedIndex + capturedSource.length)
                ).trim()
              : normalizedSource;
            const leftoverTokens = leftover
              ? leftover.split(/\s+/).filter(Boolean).length
              : 0;
            if (leftoverTokens < minLeftoverTokens) continue;
          }

          targetSegment.field_candidates.push({
            ...candidate,
            score: Math.min(1, (candidate.score ?? 0.7) * 0.995),
            evidence: {
              ...(candidate.evidence || {}),
              kind: 'adjacent_unique_pair',
              paired_field: field.name,
              trigger_field: triggerField,
              source_line: sourceSegment.line_number,
              target_line: targetSegment.line_number
            }
          });
        }
      }
    }
  }

  return out;
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

function collectExpansionCandidates(segments, segmentIndex, fieldName, schema = {}) {
  const current = uniqueFieldCandidates(segments[segmentIndex]?.field_candidates || [], fieldName);
  if (current.length) return { source: 'direct', candidates: current };

  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  const fieldConfig = fields.find(field => field.name === fieldName) || {};
  const blockStrategy = fieldConfig.expand_records_block_strategy || 'bounded';
  const triggerNames = new Set(fields.filter(field => field.record_trigger).map(field => field.name));
  const anchorNames = new Set(fields.filter(field => field.context_anchor).map(field => field.name));
  const collected = [];

  for (let index = segmentIndex - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const candidates = segment.field_candidates || [];

    const hasPriorTrigger = [...triggerNames].some(name =>
      uniqueFieldCandidates(candidates, name).length > 0
    );
    if (hasPriorTrigger) break;

    const hasTimestampBoundary = (segment.context_events || []).some(
      event => event.reason === 'timestamp_boundary'
    );
    if (hasTimestampBoundary) break;

    const fieldCandidates = uniqueFieldCandidates(candidates, fieldName);
    if (blockStrategy === 'contiguous_before_trigger' && fieldCandidates.length === 0) break;
    collected.push(...fieldCandidates);

    const hasAnchor = [...anchorNames].some(name =>
      uniqueFieldCandidates(candidates, name).length > 0
    );
    if (hasAnchor) break;
  }

  const unique = new Map();
  for (const candidate of collected) {
    const key = JSON.stringify(candidate.value);
    const prior = unique.get(key);
    if (!prior || candidate.score > prior.score) unique.set(key, candidate);
  }

  return {
    source: collected.length ? 'block' : 'none',
    candidates: [...unique.values()].sort((a, b) => b.score - a.score)
  };
}

function preferredCandidateFromAnchor(segmentsById, segment, field) {
  const policy = field.prefer_from_anchor;
  if (!policy || typeof policy !== 'object') return null;

  const anchorField = policy.anchor_field;
  const preferredValues = Array.isArray(policy.values) ? policy.values.map(normalizeKey) : [];
  if (!anchorField || !preferredValues.length) return null;

  const anchorContext = segment.inherited_context?.[anchorField];
  if (!anchorContext?.source_segment_id) return null;

  const anchorSegment = segmentsById.get(anchorContext.source_segment_id);
  if (!anchorSegment) return null;

  const candidates = uniqueFieldCandidates(anchorSegment.field_candidates || [], field.name)
    .filter(candidate => preferredValues.includes(normalizeKey(candidate.value)))
    .sort((a, b) => {
      const ai = preferredValues.indexOf(normalizeKey(a.value));
      const bi = preferredValues.indexOf(normalizeKey(b.value));
      return (ai - bi) || (b.score - a.score);
    });

  return candidates[0] || null;
}

function composeRecords(segments, schema = {}, knowledge = {}) {
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  const fieldsByName = new Map(fields.map(f => [f.name, f]));
  const triggers = fields.filter(f => f.record_trigger);
  const knowledgeIndex = buildKnowledgeIndex(knowledge);
  const segmentsById = new Map(segments.map(segment => [segment.segment_id, segment]));
  const records = [];
  const ambiguities = [];
  const learningProposals = [];

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const segment = segments[segmentIndex];
    if (Array.isArray(segment.pairing_ambiguities) && segment.pairing_ambiguities.length) {
      ambiguities.push(...segment.pairing_ambiguities);
    }
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

      if (field.expand_records === true) {
        const expansion = collectExpansionCandidates(segments, segmentIndex, field.name, schema);
        const blockMode = field.expand_records_block_mode || 'all';
        if (expansion.source === 'block' && expansion.candidates.length > 1 && blockMode === 'single_only') {
          expansion.candidates = [];
        }
        if (expansion.source === 'block' && expansion.candidates.length === 1 && blockMode === 'multi_only') {
          expansion.candidates = [];
        }

        if (field.resolver?.kind === 'entity' && expansion.candidates.length > 0) {
          blocked = true;
          ambiguities.push({
            ambiguity_id: `amb-${segment.segment_id}-${field.name}-expansion-entity`,
            field: field.name,
            cause: 'record_expansion_entity_not_supported_v1',
            raw: segment.raw,
            candidates: expansion.candidates,
            sources: [segment.line_number],
            context: segment.inherited_context || {}
          });
          continue;
        }

        if (expansion.candidates.length > 1) {
          if (recordExpansion) {
            blocked = true;
            ambiguities.push({
              ambiguity_id: `amb-${segment.segment_id}-${field.name}-multiple-expansions`,
              field: field.name,
              cause: 'multiple_record_expansion_fields',
              raw: segment.raw,
              candidates: expansion.candidates,
              sources: [segment.line_number],
              context: segment.inherited_context || {}
            });
            continue;
          }

          recordExpansion = {
            field,
            candidates: expansion.candidates,
            source: expansion.source
          };
          continue;
        }

        if (directCandidates.length === 0 && expansion.candidates.length === 1) {
          const candidate = expansion.candidates[0];
          fieldsOut[field.name] = candidate.value;
          trace.push({
            field: field.name,
            chosen: candidate.value,
            sources: [candidate.evidence?.line_number || segment.line_number],
            derived_from: [candidate.evidence?.line_number].filter(Boolean),
            rules: ['record_expansion:block_inheritance'],
            alternatives: [],
            score: candidate.score ?? null
          });
          continue;
        }
      }

      let selected = selectUniqueCandidate(segment.field_candidates || [], field.name);
      let sourceType = 'direct';
      let sourceCandidate = selected.candidate;
      const anchorCandidate = preferredCandidateFromAnchor(segmentsById, segment, field);

      if (selected.state === 'none') {
        if (anchorCandidate) {
          sourceType = 'anchor_context';
          sourceCandidate = anchorCandidate;
        } else if (segment.inherited_context?.[field.name]) {
          const entry = segment.inherited_context[field.name];
          sourceType = 'context';
          sourceCandidate = {
            field: field.name,
            value: entry.value,
            score: entry.score,
            evidence: entry.evidence
          };
        }
      } else if (selected.state === 'unique' && anchorCandidate) {
        const preferredValues = Array.isArray(field.prefer_from_anchor?.values)
          ? field.prefer_from_anchor.values.map(normalizeKey)
          : [];
        const directIsPreferred = preferredValues.includes(normalizeKey(selected.candidate?.value));
        if (!directIsPreferred) {
          sourceType = 'anchor_context';
          sourceCandidate = anchorCandidate;
          selected = { state: 'unique', candidate: anchorCandidate, candidates: [anchorCandidate] };
        }
      }

      if (!sourceCandidate && field.derive_from_entity_attribute) {
        const derive = field.derive_from_entity_attribute;
        const sourceFieldName = derive.field;
        const attributeName = derive.attribute;
        const entityValue = sourceFieldName ? fieldsOut[sourceFieldName] : null;
        const derivedValue = entityValue && typeof entityValue === 'object'
          ? entityValue.attributes?.[attributeName]
          : null;
        if (derivedValue != null) {
          const sourceTrace = trace.find(item => item.field === sourceFieldName);
          sourceType = 'entity_attribute';
          sourceCandidate = {
            field: field.name,
            value: derivedValue,
            score: sourceTrace?.score ?? 1,
            evidence: {
              kind: 'entity_attribute',
              source_field: sourceFieldName,
              attribute: attributeName,
              line_number: sourceTrace?.sources?.[0] || segment.line_number
            }
          };
        }
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
          derived_from: sourceType === 'context'
            ? [segment.inherited_context[field.name].source_line]
            : sourceType === 'anchor_context' || sourceType === 'entity_attribute'
              ? [sourceCandidate.evidence?.line_number].filter(Boolean)
              : [],
          rules: [sourceType === 'context'
            ? 'context_inheritance'
            : sourceType === 'anchor_context'
              ? `anchor_precedence:${field.prefer_from_anchor.anchor_field}`
              : sourceType === 'entity_attribute'
                ? `entity_attribute:${field.derive_from_entity_attribute.field}.${field.derive_from_entity_attribute.attribute}`
                : sourceCandidate.evidence?.kind === 'adjacent_unique_pair'
                  ? 'pairing:adjacent_unique'
                  : sourceCandidate.evidence?.kind === 'nearest_unique_pair'
                    ? 'pairing:nearest_unique'
                    : sourceCandidate.evidence?.kind === 'ordered_pair'
                      ? 'pairing:ordered'
                      : 'direct_extraction'],
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
              rules: [candidate.evidence?.kind === 'adjacent_unique_pair'
                ? 'record_expansion:pairing_adjacent_unique'
                : candidate.evidence?.kind === 'nearest_unique_pair'
                  ? 'record_expansion:pairing_nearest_unique'
                  : candidate.evidence?.kind === 'ordered_pair'
                    ? 'record_expansion:pairing_ordered'
                    : recordExpansion.source === 'block'
                      ? 'record_expansion:block_inheritance'
                      : 'record_expansion:direct_extraction'],
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
  const paired = applyOrderedFieldPairing(contextual, request.schema || {});
  const segments = semanticizeSegments(paired, request.schema || {}, request.knowledge || {});
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
  stripMessagePrefix,
  scoreRoles,
  segmentDocument,
  parseGenericNumber,
  applyTransform,
  applyFieldValueMap,
  extractFieldCandidates,
  uniqueFieldCandidates,
  buildContextTrace,
  isFieldOnlySegment,
  applyOrderedFieldPairing,
  buildKnowledgeIndex,
  resolveEntityCandidate,
  semanticizeSegments,
  collectExpansionCandidates,
  preferredCandidateFromAnchor,
  composeRecords,
  interpretStructural,
  interpretContextual,
  interpretResolved
};
