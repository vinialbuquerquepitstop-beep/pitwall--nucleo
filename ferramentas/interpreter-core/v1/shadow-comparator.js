'use strict';

const COMPARATOR_VERSION = 'shadow-comparator/0.1.0';

function assertObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
}

function uniqSortedNumbers(values) {
  return [...new Set((values || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
}

function legacySourceLines(record) {
  return uniqSortedNumbers(record?.source_lines || (record?.source_line != null ? [record.source_line] : []));
}

function coreSourceLines(record) {
  const out = [];
  for (const item of record?.trace || []) {
    for (const source of item?.sources || []) out.push(source);
  }
  return uniqSortedNumbers(out);
}

function ambiguitySourceLines(ambiguity) {
  return uniqSortedNumbers(ambiguity?.sources || []);
}

function overlapCount(a, b) {
  const right = new Set(b);
  let count = 0;
  for (const value of a) if (right.has(value)) count += 1;
  return count;
}

function nearestDistance(a, b) {
  if (!a.length || !b.length) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const left of a) {
    for (const right of b) best = Math.min(best, Math.abs(left - right));
  }
  return best;
}

function normalizeString(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function readPath(root, path) {
  if (!path) return undefined;
  const parts = Array.isArray(path) ? path : String(path).split('.');
  let current = root;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function unwrapCoreValue(value, field) {
  if (field?.value_kind === 'entity_id' && value && typeof value === 'object') return value.id;
  if (field?.value_kind === 'entity_label' && value && typeof value === 'object') return value.label;
  return value;
}

function normalizeComparable(value, field = {}) {
  const unwrapped = unwrapCoreValue(value, field);
  if (unwrapped == null || unwrapped === '') return null;

  if (field.value_kind === 'number') {
    const number = Number(unwrapped);
    return Number.isFinite(number) ? number : null;
  }

  if (field.value_kind === 'integer') {
    const number = Number(unwrapped);
    return Number.isInteger(number) ? number : null;
  }

  if (field.value_kind === 'exact') return unwrapped;
  return normalizeString(unwrapped);
}

function sameComparable(left, right) {
  if (left === null && right === null) return true;
  return Object.is(left, right);
}

function validateInputs(legacySnapshot, coreBundle, profile) {
  assertObject(legacySnapshot, 'legacySnapshot obrigatorio');
  assertObject(coreBundle, 'coreBundle obrigatorio');
  assertObject(profile, 'profile obrigatorio');

  if (legacySnapshot.contract_version !== 'legacy-reader-snapshot/v1') {
    throw new Error('legacySnapshot invalido: contract_version esperado legacy-reader-snapshot/v1');
  }
  if (coreBundle.contract_version !== 'interpretation-bundle/v1') {
    throw new Error('coreBundle invalido: contract_version esperado interpretation-bundle/v1');
  }
  if (profile.contract_version !== 'shadow-comparison-profile/v1') {
    throw new Error('profile invalido: contract_version esperado shadow-comparison-profile/v1');
  }
  if (!Array.isArray(legacySnapshot.records)) throw new Error('legacySnapshot.records precisa ser array');
  if (!Array.isArray(coreBundle.records)) throw new Error('coreBundle.records precisa ser array');
  if (!Array.isArray(profile.fields) || profile.fields.length === 0) {
    throw new Error('profile.fields precisa ter pelo menos um campo');
  }
}

function pairByProvenance(legacyRecords, coreRecords) {
  const candidates = [];

  for (let legacyIndex = 0; legacyIndex < legacyRecords.length; legacyIndex += 1) {
    const legacyLines = legacySourceLines(legacyRecords[legacyIndex]);
    for (let coreIndex = 0; coreIndex < coreRecords.length; coreIndex += 1) {
      const coreLines = coreSourceLines(coreRecords[coreIndex]);
      const overlap = overlapCount(legacyLines, coreLines);
      if (overlap === 0) continue;
      candidates.push({
        legacyIndex,
        coreIndex,
        overlap,
        distance: nearestDistance(legacyLines, coreLines)
      });
    }
  }

  candidates.sort((a, b) =>
    b.overlap - a.overlap
    || a.distance - b.distance
    || a.legacyIndex - b.legacyIndex
    || a.coreIndex - b.coreIndex
  );

  const usedLegacy = new Set();
  const usedCore = new Set();
  const pairs = [];

  for (const candidate of candidates) {
    if (usedLegacy.has(candidate.legacyIndex) || usedCore.has(candidate.coreIndex)) continue;
    usedLegacy.add(candidate.legacyIndex);
    usedCore.add(candidate.coreIndex);
    pairs.push(candidate);
  }

  const missingLegacyIndexes = legacyRecords
    .map((_, index) => index)
    .filter(index => !usedLegacy.has(index));
  const extraCoreIndexes = coreRecords
    .map((_, index) => index)
    .filter(index => !usedCore.has(index));

  return { pairs, missingLegacyIndexes, extraCoreIndexes };
}

function ambiguityOverlapsLines(ambiguities, lines) {
  return (ambiguities || []).some(ambiguity => overlapCount(ambiguitySourceLines(ambiguity), lines) > 0);
}

function compareShadow({ legacySnapshot, coreBundle, profile }) {
  validateInputs(legacySnapshot, coreBundle, profile);

  const legacyRecords = legacySnapshot.records;
  const coreRecords = coreBundle.records;
  const ambiguities = Array.isArray(coreBundle.ambiguities) ? coreBundle.ambiguities : [];
  const pairing = pairByProvenance(legacyRecords, coreRecords);
  const divergences = [];
  const matched = [];

  for (const pair of pairing.pairs) {
    const legacyRecord = legacyRecords[pair.legacyIndex];
    const coreRecord = coreRecords[pair.coreIndex];
    const pairDivergences = [];

    for (const field of profile.fields) {
      const legacyValue = normalizeComparable(
        readPath(legacyRecord, field.legacy_path || `fields.${field.name}`),
        field
      );
      const coreValue = normalizeComparable(
        readPath(coreRecord, field.core_path || `fields.${field.name}`),
        field
      );

      if (sameComparable(legacyValue, coreValue)) continue;

      const item = {
        legacy_record_id: legacyRecord.legacy_record_id ?? `legacy-${pair.legacyIndex + 1}`,
        core_record_id: coreRecord.record_id ?? `core-${pair.coreIndex + 1}`,
        field: field.name,
        semantic_role: field.semantic_role || 'generic',
        legacy_value: legacyValue,
        core_value: coreValue,
        source_lines: uniqSortedNumbers([
          ...legacySourceLines(legacyRecord),
          ...coreSourceLines(coreRecord)
        ])
      };
      pairDivergences.push(item);
      divergences.push(item);
    }

    matched.push({
      legacy_record_id: legacyRecord.legacy_record_id ?? `legacy-${pair.legacyIndex + 1}`,
      core_record_id: coreRecord.record_id ?? `core-${pair.coreIndex + 1}`,
      source_lines: uniqSortedNumbers([
        ...legacySourceLines(legacyRecord),
        ...coreSourceLines(coreRecord)
      ]),
      divergences: pairDivergences
    });
  }

  const missing = pairing.missingLegacyIndexes.map(index => {
    const record = legacyRecords[index];
    const sourceLines = legacySourceLines(record);
    const explainedByAmbiguity = ambiguityOverlapsLines(ambiguities, sourceLines);
    return {
      legacy_record_id: record.legacy_record_id ?? `legacy-${index + 1}`,
      source_lines: sourceLines,
      explained_by_ambiguity: explainedByAmbiguity
    };
  });

  const extra = pairing.extraCoreIndexes.map(index => {
    const record = coreRecords[index];
    return {
      core_record_id: record.record_id ?? `core-${index + 1}`,
      source_lines: coreSourceLines(record)
    };
  });

  const divergenceByField = {};
  for (const field of profile.fields) divergenceByField[field.name] = 0;
  for (const divergence of divergences) {
    divergenceByField[divergence.field] = (divergenceByField[divergence.field] || 0) + 1;
  }

  const silentWrongPrice = divergences.filter(divergence => {
    if (divergence.semantic_role !== 'price') return false;
    return !ambiguityOverlapsLines(ambiguities, divergence.source_lines);
  }).length;
  const silentLoss = missing.filter(item => !item.explained_by_ambiguity).length;
  const abstentions = missing.filter(item => item.explained_by_ambiguity).length;

  const legacyParseMs = Number(legacySnapshot.metrics?.parse_ms ?? legacySnapshot.parse_ms ?? 0);
  const coreParseMs = Number(coreBundle.metrics?.parse_ms ?? 0);

  return {
    contract_version: 'shadow-comparison-report/v1',
    comparator_version: COMPARATOR_VERSION,
    profile_id: profile.profile_id || null,
    source_document_id: legacySnapshot.document_id || coreBundle.run?.document_id || null,
    metrics: {
      legacy_records: legacyRecords.length,
      core_records: coreRecords.length,
      matched_records: matched.length,
      exact_matches: matched.filter(item => item.divergences.length === 0).length,
      divergent_matches: matched.filter(item => item.divergences.length > 0).length,
      missing_records: missing.length,
      extra_records: extra.length,
      field_divergences: divergenceByField,
      ambiguities: ambiguities.length,
      abstentions,
      silent_loss: silentLoss,
      silent_wrong_price: silentWrongPrice,
      parse_ms: {
        legacy: Number.isFinite(legacyParseMs) ? legacyParseMs : null,
        core: Number.isFinite(coreParseMs) ? coreParseMs : null,
        delta: Number.isFinite(legacyParseMs) && Number.isFinite(coreParseMs)
          ? coreParseMs - legacyParseMs
          : null
      }
    },
    gates: {
      silent_wrong_price: silentWrongPrice === 0,
      silent_loss: silentLoss === 0
    },
    matched,
    missing,
    extra,
    divergences
  };
}

module.exports = {
  COMPARATOR_VERSION,
  legacySourceLines,
  coreSourceLines,
  normalizeComparable,
  pairByProvenance,
  compareShadow
};
