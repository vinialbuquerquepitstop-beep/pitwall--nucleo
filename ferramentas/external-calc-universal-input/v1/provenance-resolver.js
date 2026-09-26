'use strict';

const { validateCanonicalDocument } = require('./canonical-document');

const DEFAULT_CRITICAL_FIELDS = Object.freeze([
  'model',
  'capacity_gb',
  'condition',
  'color',
  'price'
]);

function provenanceError(reason, message) {
  const error = new Error(message);
  error.code = 'PROVENANCE_INCOMPLETE';
  error.reason = reason;
  return error;
}

function sourceRange(sourceRef) {
  let match = /^line:(\d+)$/.exec(String(sourceRef || ''));
  if (match) {
    const line = Number(match[1]);
    return { start: line, end: line };
  }
  match = /^lines:(\d+)-(\d+)$/.exec(String(sourceRef || ''));
  if (match) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (end < start) throw provenanceError('SOURCE_REF_RANGE_INVALID', 'source_ref com intervalo invertido');
    return { start, end };
  }
  throw provenanceError('SOURCE_REF_UNSUPPORTED', 'source_ref sem range fisico suportado: ' + String(sourceRef));
}

function buildCanonicalLineIndex(document) {
  validateCanonicalDocument(document);
  const index = new Map();

  for (const block of document.blocks) {
    const range = sourceRange(block.provenance.source_ref);
    for (let line = range.start; line <= range.end; line += 1) {
      if (!index.has(line)) index.set(line, []);
      index.get(line).push({
        block_id: block.block_id,
        source_ref: block.provenance.source_ref,
        page: block.provenance.page,
        sheet: block.provenance.sheet,
        row: block.provenance.row
      });
    }
  }

  return index;
}

function traceRecordProvenance(record, document, options = {}) {
  if (!record || typeof record !== 'object') {
    throw provenanceError('RECORD_INVALID', 'record obrigatorio');
  }

  const criticalFields = options.criticalFields || DEFAULT_CRITICAL_FIELDS;
  const lineIndex = buildCanonicalLineIndex(document);
  const traceByField = new Map((record.trace || []).map(item => [item.field, item]));
  const fields = [];

  for (const field of criticalFields) {
    if (!Object.prototype.hasOwnProperty.call(record.fields || {}, field)) continue;
    const trace = traceByField.get(field);
    if (!trace || !Array.isArray(trace.sources) || trace.sources.length === 0) {
      throw provenanceError('CRITICAL_FIELD_TRACE_MISSING', 'campo critico sem trace: ' + field);
    }

    const origins = [];
    for (const sourceLine of trace.sources) {
      if (!Number.isInteger(sourceLine) || sourceLine < 1) {
        throw provenanceError('TRACE_SOURCE_INVALID', 'linha de origem invalida em ' + field);
      }
      const matches = lineIndex.get(sourceLine) || [];
      if (matches.length === 0) {
        throw provenanceError('TRACE_SOURCE_UNRESOLVED', 'linha sem origem canonica: ' + sourceLine);
      }
      origins.push(...matches.map(match => ({ line: sourceLine, ...match })));
    }

    fields.push({
      field,
      chosen: trace.chosen,
      rules: Array.isArray(trace.rules) ? trace.rules.slice() : [],
      origins
    });
  }

  return {
    record_id: record.record_id,
    document_id: document.document_id,
    source_hash: document.source.content_hash,
    fields
  };
}

function assertCriticalProvenance(bundle, document, options = {}) {
  if (!bundle || !Array.isArray(bundle.records)) {
    throw provenanceError('BUNDLE_INVALID', 'InterpretationBundle invalido');
  }

  const traced = bundle.records.map(record => traceRecordProvenance(record, document, options));
  const priceFields = traced.flatMap(record => record.fields.filter(field => field.field === 'price'));

  if (bundle.records.some(record => Object.prototype.hasOwnProperty.call(record.fields || {}, 'price'))
      && priceFields.length === 0) {
    throw provenanceError('PRICE_PROVENANCE_MISSING', 'preco interpretado sem provenance');
  }

  return {
    document_id: document.document_id,
    source_hash: document.source.content_hash,
    records: traced
  };
}

module.exports = {
  DEFAULT_CRITICAL_FIELDS,
  sourceRange,
  buildCanonicalLineIndex,
  traceRecordProvenance,
  assertCriticalProvenance
};
