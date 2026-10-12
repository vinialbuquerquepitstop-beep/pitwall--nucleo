'use strict';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fieldConfig(schema, name) {
  return (Array.isArray(schema?.fields) ? schema.fields : []).find(field => field.name === name) || null;
}

function sourceLine(trace) {
  return trace?.sources?.find(value => Number.isInteger(value) && value > 0) ?? null;
}

function validateUnknownSupplierPairing(bundle, schema) {
  const out = clone(bundle);
  const colorConfig = fieldConfig(schema, 'color');
  const pairing = colorConfig?.pair_by_order_with_trigger;
  const guard = pairing?.fallback_supplier_direction_guard;
  const maxDistance = Number(pairing?.fallback_max_distance);

  if (!guard || !Number.isFinite(maxDistance)) return out;

  out.ambiguities = Array.isArray(out.ambiguities) ? out.ambiguities : [];

  for (const record of out.records || []) {
    if (record.fields?.supplier != null) continue;
    if (record.fields?.color == null) continue;

    const colorTrace = (record.trace || []).find(item => item.field === 'color');
    const priceTrace = (record.trace || []).find(item => item.field === 'price');
    if (!colorTrace || !priceTrace) continue;
    if (!(colorTrace.rules || []).includes('record_expansion:pairing_nearest_unique')) continue;

    const colorLine = sourceLine(colorTrace);
    const priceLine = sourceLine(priceTrace);
    if (colorLine == null || priceLine == null) continue;

    const distance = Math.abs(priceLine - colorLine);
    const guardAtMax = guard.only_at_max_distance !== false
      ? distance === maxDistance
      : distance >= maxDistance;
    if (!guardAtMax) continue;

    delete record.fields.color;
    record.trace = (record.trace || []).filter(item => item.field !== 'color');

    out.ambiguities.push({
      ambiguity_id: 'amb-' + record.record_id + '-color-unknown-supplier-direction',
      field: 'color',
      cause: 'pairing_unknown_supplier_direction_unverified',
      raw: null,
      candidates: [],
      sources: [colorLine, priceLine],
      context: {
        supplier: null,
        distance,
        max_distance: maxDistance,
        policy: 'fail_closed_at_supplier_direction_guard_distance'
      }
    });
  }

  if (out.metrics && typeof out.metrics === 'object') {
    out.metrics.n_ambiguous = out.ambiguities.length;
  }

  return out;
}

module.exports = {
  validateUnknownSupplierPairing
};
