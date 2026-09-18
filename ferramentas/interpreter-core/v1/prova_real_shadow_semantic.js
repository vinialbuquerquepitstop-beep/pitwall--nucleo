'use strict';

const assert = require('assert');
const { compareSemanticShadow } = require('./semantic-shadow');

function legacyOffer(id, model, condition, color, price, capacity = 256, supplier = null) {
  return {
    legacy_record_id: id,
    fields: {
      model: { id: model, label: model },
      capacity_gb: capacity,
      condition,
      color,
      price
    },
    metadata: supplier == null ? {} : { supplier }
  };
}

function coreRecord(id, model, condition, color, price, capacity = 256) {
  return {
    record_id: id,
    fields: {
      model: { id: model, label: model },
      capacity_gb: capacity,
      condition,
      color,
      price
    },
    trace: []
  };
}

function legacy(offers) {
  return {
    contract_version: 'legacy-semantic-offers/v1',
    offers,
    unsupported: [],
    invalid: []
  };
}

function core(records, ambiguities = []) {
  return {
    contract_version: 'interpretation-bundle/v1',
    records,
    ambiguities,
    learning_proposals: [],
    metrics: {}
  };
}

let n = 0;
function eq(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  n += 1;
}
function ok(value, message) {
  assert.ok(value, message);
  n += 1;
}

// 1. multiconjunto exato, incluindo duplicidade legitima
{
  const l = legacy([
    legacyOffer('l1', 'iphone_17_256gb', 'Lacrado', 'Azul', 5000),
    legacyOffer('l2', 'iphone_17_256gb', 'Lacrado', 'Azul', 5000),
    legacyOffer('l3', 'iphone_17_256gb', 'Lacrado', 'Branco', 5100)
  ]);
  const c = core([
    coreRecord('c1', 'iphone_17_256gb', 'Lacrado', 'Azul', 5000),
    coreRecord('c2', 'iphone_17_256gb', 'Lacrado', 'Branco', 5100),
    coreRecord('c3', 'iphone_17_256gb', 'Lacrado', 'Azul', 5000)
  ]);
  const r = compareSemanticShadow({ legacy: l, coreBundle: c });
  eq(r.metrics.matched_offers, 3, 'deve preservar duplicidade');
  eq(r.metrics.missing_offers, 0, 'sem falta');
  eq(r.metrics.extra_offers, 0, 'sem extra');
  eq(r.metrics.exact_multiset, true, 'multiconjunto exato');
  eq(r.metrics.agreement_ratio, 1, 'acordo integral');
  ok(r.gates.no_silent_wrong_price, 'gate de preco verde');
}

// 2. preco errado precisa aparecer como falta + extra no mesmo modelo e fechar gate
{
  const l = legacy([legacyOffer('l1', 'iphone_16_128gb', 'Lacrado', 'Preto', 4200, 128)]);
  const c = core([coreRecord('c1', 'iphone_16_128gb', 'Lacrado', 'Preto', 4300, 128)]);
  const r = compareSemanticShadow({ legacy: l, coreBundle: c });
  eq(r.metrics.missing_offers, 1, 'preco errado causa falta do valor correto');
  eq(r.metrics.extra_offers, 1, 'preco errado causa extra do valor incorreto');
  eq(r.metrics.confirmed_wrong_price_offers, 1, 'referencia unica confirma preco errado');
  eq(r.metrics.ambiguous_price_reference_offers, 0, 'referencia unica nao e ambigua');
  eq(r.gates.no_silent_wrong_price, false, 'gate de preco fecha');
  eq(r.metrics.exact_multiset, false, 'nao pode parecer exato');
}

// 3. preco diferente em outra identidade semantica nao e "wrong price"
{
  const l = legacy([legacyOffer('l1', 'iphone_16_128gb', 'Lacrado', 'Preto', 4200, 128)]);
  const c = core([coreRecord('c1', 'iphone_16_128gb', 'Seminovo', 'Azul', 4300, 128)]);
  const r = compareSemanticShadow({ legacy: l, coreBundle: c });
  eq(r.metrics.exact_multiset, false, 'identidades diferentes continuam divergentes');
  eq(r.gates.no_silent_wrong_price, true, 'nao acusa preco errado quando outros campos divergem');
}

// 4. multiplos precos legados para a mesma identidade tornam a referencia de preco ambigua
{
  const l = legacy([
    legacyOffer('l1', 'iphone_16_pro_max_256gb', 'Seminovo', 'Natural', 5200, 256, 'fornecedor-a'),
    legacyOffer('l2', 'iphone_16_pro_max_256gb', 'Seminovo', 'Natural', 5300, 256, 'fornecedor-b')
  ]);
  const c = core([
    coreRecord('c1', 'iphone_16_pro_max_256gb', 'Seminovo', 'Natural', 5400, 256)
  ]);
  const r = compareSemanticShadow({ legacy: l, coreBundle: c });
  eq(r.metrics.exact_multiset, false, 'referencia ambigua continua divergente no multiconjunto');
  eq(r.metrics.confirmed_wrong_price_offers, 0, 'sem fornecedor no Core nao confirma qual preco legado seria o correto');
  eq(r.metrics.ambiguous_price_reference_offers, 1, 'marca a oferta extra como referencia de preco ambigua');
  eq(r.gates.no_silent_wrong_price, true, 'ambiguidade de referencia nao e rotulada como preco silenciosamente errado');
}

// 5. duplicidade extra no mesmo preco conhecido nao e erro de preco
{
  const l = legacy([
    legacyOffer('l1', 'iphone_16_128gb', 'Lacrado', 'Preto', 4200, 128)
  ]);
  const c = core([
    coreRecord('c1', 'iphone_16_128gb', 'Lacrado', 'Preto', 4200, 128),
    coreRecord('c2', 'iphone_16_128gb', 'Lacrado', 'Preto', 4200, 128)
  ]);
  const r = compareSemanticShadow({ legacy: l, coreBundle: c });
  eq(r.metrics.exact_multiset, false, 'duplicidade extra continua bloqueando equivalencia');
  eq(r.metrics.extra_at_known_reference_price_offers, 1, 'separa excesso de multiplicidade de erro de preco');
  eq(r.metrics.confirmed_wrong_price_offers, 0, 'mesmo preco conhecido nao e wrong price');
  eq(r.gates.no_silent_wrong_price, true, 'gate de preco fica verde embora exact_multiset continue falso');
}

// 6. cor pode ser ignorada explicitamente para diagnostico, nunca por default
{
  const l = legacy([legacyOffer('l1', 'iphone_15_128gb', 'Seminovo', 'Azul', 2650, 128)]);
  const c = core([coreRecord('c1', 'iphone_15_128gb', 'Seminovo', 'Preto', 2650, 128)]);
  const strict = compareSemanticShadow({ legacy: l, coreBundle: c });
  const relaxed = compareSemanticShadow({ legacy: l, coreBundle: c, options: { include_color: false } });
  eq(strict.metrics.exact_multiset, false, 'default inclui cor');
  eq(relaxed.metrics.exact_multiset, true, 'modo diagnostico pode ignorar cor');
}

// 7. condicao canonicaliza plural sem esconder diferenca semantica
{
  const l = legacy([legacyOffer('l1', 'iphone_13_pro_128gb', 'Lacrados', 'Azul', 3000, 128)]);
  const c = core([coreRecord('c1', 'iphone_13_pro_128gb', 'Lacrado', 'Azul', 3000, 128)]);
  const r = compareSemanticShadow({ legacy: l, coreBundle: c });
  eq(r.metrics.exact_multiset, true, 'plural de condicao canonicalizado');
}

// 8. modelo a mais e modelo ausente permanecem visiveis no resumo
{
  const l = legacy([legacyOffer('l1', 'iphone_17_air_256gb', 'Lacrado', 'Gold', 5600)]);
  const c = core([coreRecord('c1', 'iphone_17e_256gb', 'Lacrado', 'Gold', 5600)]);
  const r = compareSemanticShadow({ legacy: l, coreBundle: c });
  eq(r.metrics.matched_offers, 0, 'modelo diferente nao casa');
  eq(r.by_model.length, 2, 'dois modelos aparecem no diagnostico');
}

console.log(`PASSOU: ${n} assercoes Real Shadow Semantic V0`);
