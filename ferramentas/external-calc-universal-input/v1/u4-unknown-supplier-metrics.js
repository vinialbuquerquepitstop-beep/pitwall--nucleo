'use strict';

function semanticSignature(record) {
  return JSON.stringify({
    model: record.fields?.model?.id || record.fields?.model || null,
    capacity_gb: record.fields?.capacity_gb ?? null,
    condition: record.fields?.condition ?? null,
    color: record.fields?.color ?? null,
    price: record.fields?.price ?? null
  });
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

function compareUnknownSupplier(baseline, unknown) {
  const unknownBuckets = new Map();
  for (const record of unknown.records || []) {
    const signature = semanticSignature(record);
    if (!unknownBuckets.has(signature)) unknownBuckets.set(signature, []);
    unknownBuckets.get(signature).push(record);
  }

  let recognized = 0;
  let unresolved = 0;
  let review = 0;
  let silentMissing = 0;

  for (const record of baseline.records || []) {
    const signature = semanticSignature(record);
    const bucket = unknownBuckets.get(signature) || [];
    if (bucket.length) {
      bucket.pop();
      recognized += 1;
      continue;
    }

    unresolved += 1;
    const lines = recordSourceLines(record);
    const explicitReview = (unknown.ambiguities || []).some(ambiguity =>
      ambiguityTouches(ambiguity, lines)
    );
    if (explicitReview) review += 1;
    else silentMissing += 1;
  }

  const wrongPrice = Array.from(unknownBuckets.values())
    .reduce((total, bucket) => total + bucket.length, 0);

  const baselineCount = (baseline.records || []).length;
  const unknownCount = (unknown.records || []).length;
  const supplierInvented = (unknown.records || []).filter(record =>
    record.fields?.supplier != null
  ).length;

  return {
    baseline_records: baselineCount,
    unknown_records: unknownCount,
    recognized,
    recognition_rate: baselineCount ? recognized / baselineCount : 1,
    core_rate: baselineCount ? unknownCount / baselineCount : 1,
    review,
    review_rate: baselineCount ? review / baselineCount : 0,
    unresolved,
    silent_missing: silentMissing,
    wrong_price: wrongPrice,
    supplier_invented: supplierInvented
  };
}

module.exports = {
  semanticSignature,
  recordSourceLines,
  compareUnknownSupplier
};
