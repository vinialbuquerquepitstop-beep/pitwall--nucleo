'use strict';

const IDENTITY_FIELDS = Object.freeze([
  'model',
  'capacity_gb',
  'condition',
  'color'
]);

function fieldValue(record, field) {
  const value = record?.fields?.[field];
  if (field === 'model' && value && typeof value === 'object') return value.id ?? value.label ?? null;
  return value ?? null;
}

function semanticSignature(record) {
  return JSON.stringify({
    model: fieldValue(record, 'model'),
    capacity_gb: fieldValue(record, 'capacity_gb'),
    condition: fieldValue(record, 'condition'),
    color: fieldValue(record, 'color'),
    price: fieldValue(record, 'price')
  });
}

function traceSource(record, field) {
  const trace = (record?.trace || []).find(item => item.field === field);
  return trace?.sources?.find(value => Number.isInteger(value) && value > 0) ?? null;
}

function recordSourceLines(record) {
  return Array.from(new Set(
    (record.trace || [])
      .flatMap(item => Array.isArray(item.sources) ? item.sources : [])
      .filter(value => Number.isInteger(value) && value > 0)
  ));
}

function ambiguityTouches(ambiguity, lines) {
  const sourceSet = new Set(Array.isArray(ambiguity?.sources) ? ambiguity.sources : []);
  return lines.some(line => sourceSet.has(line));
}

function exactRecordMatch(a, b) {
  if (fieldValue(a, 'price') !== fieldValue(b, 'price')) return false;
  return IDENTITY_FIELDS.every(field => fieldValue(a, field) === fieldValue(b, field));
}

function safePartialMatch(candidate, baseline) {
  if (fieldValue(candidate, 'price') !== fieldValue(baseline, 'price')) return false;

  let degraded = false;
  for (const field of IDENTITY_FIELDS) {
    const actual = fieldValue(candidate, field);
    const expected = fieldValue(baseline, field);

    if (actual == null) {
      if (expected != null) degraded = true;
      continue;
    }

    if (expected == null || actual !== expected) return false;
  }

  return degraded;
}

function boundaryReviewForBaseline(record, unknown) {
  const supplierLine = traceSource(record, 'supplier');
  if (!supplierLine) return false;

  const segment = (unknown.segments || []).find(item => item.line_number === supplierLine);
  return (segment?.context_events || []).some(event =>
    event.field === '_unknown_supplier_boundary'
      && event.reason === 'supplier_boundary'
  );
}

function compareUnknownSupplier(baseline, unknown) {
  const baselineRecords = baseline.records || [];
  const unknownRecords = unknown.records || [];
  const matched = new Set();

  let recognized = 0;
  let degraded = 0;
  let wrongPrice = 0;

  for (const candidate of unknownRecords) {
    const priceLine = traceSource(candidate, 'price');
    if (!priceLine) {
      wrongPrice += 1;
      continue;
    }

    const sameLine = baselineRecords
      .map((record, index) => ({ record, index }))
      .filter(item => !matched.has(item.index) && traceSource(item.record, 'price') === priceLine);

    const exact = sameLine.find(item => exactRecordMatch(candidate, item.record));
    if (exact) {
      matched.add(exact.index);
      recognized += 1;
      continue;
    }

    const partial = sameLine.find(item => safePartialMatch(candidate, item.record));
    if (partial) {
      matched.add(partial.index);
      degraded += 1;
      continue;
    }

    wrongPrice += 1;
  }

  let unresolved = 0;
  let review = degraded;
  let silentMissing = 0;

  baselineRecords.forEach((record, index) => {
    if (matched.has(index)) return;

    unresolved += 1;
    const lines = recordSourceLines(record);
    const explicitReview =
      (unknown.ambiguities || []).some(ambiguity => ambiguityTouches(ambiguity, lines))
      || boundaryReviewForBaseline(record, unknown);

    if (explicitReview) review += 1;
    else silentMissing += 1;
  });

  const baselineCount = baselineRecords.length;
  const supplierInvented = unknownRecords.filter(record =>
    record.fields?.supplier != null
  ).length;

  return {
    baseline_records: baselineCount,
    unknown_records: unknownRecords.length,
    recognized,
    degraded,
    recognition_rate: baselineCount ? (recognized + degraded) / baselineCount : 1,
    core_rate: baselineCount ? recognized / baselineCount : 1,
    review,
    review_rate: baselineCount ? review / baselineCount : 0,
    unresolved,
    silent_missing: silentMissing,
    wrong_price: wrongPrice,
    supplier_invented: supplierInvented
  };
}

module.exports = {
  IDENTITY_FIELDS,
  fieldValue,
  semanticSignature,
  traceSource,
  recordSourceLines,
  exactRecordMatch,
  safePartialMatch,
  compareUnknownSupplier
};
