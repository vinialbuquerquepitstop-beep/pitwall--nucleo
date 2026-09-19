'use strict';

const assert = require('assert');
const { analyzeDivergences } = require('./divergence-analyzer');

function offer(model, price, overrides = {}) {
  return {
    fields: {
      model: { id: model, label: model },
      capacity_gb: 256,
      condition: 'Lacrado',
      color: 'Azul',
      price,
      ...overrides
    }
  };
}

function legacy(offers) {
  return { contract_version: 'legacy-semantic-offers/v1', offers, unsupported: [], invalid: [] };
}

function core(records, ambiguities = []) {
  return {
    contract_version: 'interpretation-bundle/v1',
    records: records.map((x, i) => ({ record_id: `c${i + 1}`, ...x })),
    ambiguities,
    learning_proposals: [],
    metrics: {}
  };
}

let n = 0;
function eq(a, b, msg) { assert.deepStrictEqual(a, b, msg); n += 1; }

{
  const r = analyzeDivergences({
    legacy: legacy([offer('iphone_17_256gb', 7000)]),
    coreBundle: core([offer('iphone_17_256gb', 7000)])
  });
  eq(r.categories.exact_matches, 1, 'exacto');
  eq(r.categories.wrong_price_only, 0, 'sem preco errado');
}

{
  const r = analyzeDivergences({
    legacy: legacy([offer('iphone_17_256gb', 7000)]),
    coreBundle: core([offer('iphone_17_256gb', 7100)])
  });
  eq(r.categories.wrong_price_only, 1, 'preco isolado');
}

{
  const r = analyzeDivergences({
    legacy: legacy([offer('iphone_17_256gb', 7000)]),
    coreBundle: core([offer('iphone_17_256gb', 7000, { color: 'Preto' })])
  });
  eq(r.categories.color_only, 1, 'cor isolada');
}

{
  const r = analyzeDivergences({
    legacy: legacy([offer('iphone_17_256gb', 7000, { capacity_gb: 256 })]),
    coreBundle: core([offer('iphone_17_256gb', 7000, { capacity_gb: null })])
  });
  eq(r.categories.capacity_only, 1, 'capacidade isolada');
}

{
  const r = analyzeDivergences({
    legacy: legacy([offer('iphone_17_256gb', 7000)]),
    coreBundle: core([offer('iphone_17_256gb', 7100, { color: 'Preto' })])
  });
  eq(r.categories.multi_field_mismatch, 1, 'multicampo');
}

{
  const r = analyzeDivergences({
    legacy: legacy([offer('iphone_17_256gb', 7000)]),
    coreBundle: core([offer('iphone_16_256gb', 7000)])
  });
  eq(r.categories.missing_model, 1, 'modelo faltante');
  eq(r.categories.extra_model, 1, 'modelo extra');
}

{
  const r = analyzeDivergences({
    legacy: legacy([offer('iphone_17_256gb', 7000), offer('iphone_17_256gb', 7000)]),
    coreBundle: core([offer('iphone_17_256gb', 7000)])
  });
  eq(r.categories.exact_matches, 1, 'duplicidade preserva um exacto');
  eq(r.categories.missing_offer_same_model, 1, 'duplicidade faltante visivel');
}

{
  const r = analyzeDivergences({
    legacy: legacy([]),
    coreBundle: core([], [
      { cause: 'required_field_missing', field: 'model' },
      { cause: 'required_field_missing', field: 'model' },
      { cause: 'structural_role_unknown', field: null }
    ])
  });
  eq(r.ambiguities_by_cause.required_field_missing, 2, 'agrega causa');
  eq(r.ambiguities_by_field.model, 2, 'agrega campo');
  eq(r.ambiguities_by_field['(structural)'], 1, 'agrega estrutural');
}

console.log(`PASSOU: ${n} assercoes Divergence Analyzer V1`);
