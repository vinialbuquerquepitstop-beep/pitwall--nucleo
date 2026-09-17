'use strict';

const { normalizeKey } = require('./core');

const ADAPTER_VERSION = 'legacy-calc-v2-adapter/0.1.0';

function extractLegacyParse(input) {
  if (!input || typeof input !== 'object') throw new Error('entrada legada invalida');
  if (Array.isArray(input)) {
    for (const item of input) {
      try { return extractLegacyParse(item); } catch (_) { /* tenta proximo */ }
    }
    throw new Error('nao encontrei parse legado no array');
  }
  if (Array.isArray(input.produtos)) return input;
  for (const key of ['parse', 'result', 'output', 'data', 'benchmark_result']) {
    if (!input[key] || typeof input[key] !== 'object') continue;
    try { return extractLegacyParse(input[key]); } catch (_) { /* tenta proximo */ }
  }
  throw new Error('nao encontrei objeto calc_parse_v2 (esperado campo produtos ou wrapper com parse)');
}

function buildModelIndex(knowledge = {}) {
  const byKey = new Map();
  const byId = new Map();
  for (const entity of knowledge.entities || []) {
    if (entity.kind !== 'model') continue;
    byId.set(entity.id, entity);
    byKey.set(normalizeKey(entity.label), entity);
  }
  for (const alias of knowledge.aliases || []) {
    if (alias.kind !== 'model') continue;
    const target = byId.get(alias.target_id);
    if (!target) continue;
    byKey.set(normalizeKey(alias.normalized || alias.text), target);
  }
  return { byKey, byId };
}

function parseCapacityGb(label) {
  const text = String(label ?? '');
  const gb = /\b(64|128|256|512|1024|2048)\s*GB\b/i.exec(text);
  if (gb) return Number(gb[1]);
  const tb = /\b([12])\s*TB\b/i.exec(text);
  if (tb) return Number(tb[1]) * 1024;
  return null;
}

function canonicalCondition(value) {
  const key = normalizeKey(value);
  const map = new Map([
    ['lacrado', 'Lacrado'], ['lacrados', 'Lacrado'],
    ['novo', 'Novo'], ['novos', 'Novo'],
    ['cpo', 'CPO'],
    ['seminovo', 'Seminovo'], ['seminovos', 'Seminovo'],
    ['usado', 'Usado'], ['usados', 'Usado']
  ]);
  return map.get(key) || (value == null ? null : String(value).trim());
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function adaptLegacyCalcV2(input, knowledge = {}) {
  const parse = extractLegacyParse(input);
  const index = buildModelIndex(knowledge);
  const offers = [];
  const unsupported = [];
  const invalid = [];

  for (let productIndex = 0; productIndex < parse.produtos.length; productIndex += 1) {
    const product = parse.produtos[productIndex] || {};
    const rawModel = product.n;
    const model = index.byKey.get(normalizeKey(rawModel));
    if (!model) {
      unsupported.push({
        product_index: productIndex,
        model: rawModel ?? null,
        supplier: product.f ?? null
      });
      continue;
    }

    const base = {
      model: { id: model.id, label: model.label, attributes: model.attributes || {} },
      capacity_gb: parseCapacityGb(model.label),
      condition: canonicalCondition(product.t)
    };

    const colors = Array.isArray(product.cs) && product.cs.length ? product.cs : null;
    if (colors) {
      for (let colorIndex = 0; colorIndex < colors.length; colorIndex += 1) {
        const color = colors[colorIndex] || {};
        const price = finiteNumber(color.v);
        if (price == null) {
          invalid.push({ product_index: productIndex, color_index: colorIndex, cause: 'invalid_price' });
          continue;
        }
        offers.push({
          legacy_record_id: `legacy-product-${productIndex + 1}-color-${colorIndex + 1}`,
          fields: { ...base, color: color.n == null ? null : String(color.n).trim(), price },
          metadata: {
            supplier: product.f ?? null,
            location: product.l ?? null,
            category: product.c ?? null,
            product_index: productIndex,
            color_index: colorIndex
          }
        });
      }
      continue;
    }

    const price = finiteNumber(product.v);
    if (price == null) {
      invalid.push({ product_index: productIndex, cause: 'invalid_price' });
      continue;
    }
    offers.push({
      legacy_record_id: `legacy-product-${productIndex + 1}`,
      fields: { ...base, color: null, price },
      metadata: {
        supplier: product.f ?? null,
        location: product.l ?? null,
        category: product.c ?? null,
        product_index: productIndex,
        color_index: null
      }
    });
  }

  return {
    contract_version: 'legacy-semantic-offers/v1',
    adapter_version: ADAPTER_VERSION,
    offers,
    unsupported,
    invalid,
    source_metrics: {
      n_lidas: Number(parse.n_lidas ?? 0),
      n_casou: Number(parse.n_casou ?? 0),
      n_duvidoso: Number(parse.n_duvidoso ?? 0),
      n_nao_reconhecido: Number(parse.n_nao_reconhecido ?? 0),
      n_produtos: parse.produtos.length,
      n_supported_offers: offers.length,
      n_unsupported_products: unsupported.length,
      n_invalid_supported: invalid.length
    }
  };
}

module.exports = {
  ADAPTER_VERSION,
  extractLegacyParse,
  buildModelIndex,
  parseCapacityGb,
  canonicalCondition,
  adaptLegacyCalcV2
};
