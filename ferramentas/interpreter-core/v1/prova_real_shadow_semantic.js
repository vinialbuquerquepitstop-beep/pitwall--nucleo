'use strict';

const assert = require('assert');
const { compareSemanticShadow } = require('./semantic-shadow');

function legacyOffer(id, model, condition, color, price, capacity = 256, supplier = 'S1') {
  return {
    legacy_record_id: id,
    fields: {
      model: { id: model, label: model },
      capacity_gb: capacity,
      condition,
      color,
      price
    },
    metadata: { supplier }
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
  eq(r.gates.no_silent_wrong_price, false, 'gate de preco fecha');
  eq(r.metrics.exact_multiset, false, 'nao pode parecer exato');
}

// 3. mesma identidade em fornecedores diferentes nao prova preco silenciosamente errado
{
  const l = legacy([
    legacyOffer('l1', 'iphone_16_128gb', 'Lacrado', 'Preto', 4200, 128, 'S1'),
    legacyOffer('l2', 'iphone_16_128gb', 'Lacrado', 'Preto', 4300, 128, 'S2')
  ]);
  const c = core([
    coreRecord('c1', 'iphone_16_128gb', 'Lacrado', 'Preto', 4200, 128),
    coreRecord('c2', 'iphone_16_128gb', 'Lacrado', 'Preto', 4400, 128)
  ]);
  const r = compareSemanticShadow({ legacy: l, coreBundle: c });
  eq(r.gates.no_silent_wrong_price, true, 'sem erro confirmado enquanto fornecedor nao pertence a identidade do Core');
  eq(r.gates.price_attribution_resolved, false, 'atribuicao entre fornecedores permanece bloqueada');
  eq(r.metrics.confirmed_silent_wrong_price, 0, 'nenhum erro confirmado em identidade multi-fornecedor');
  eq(r.metrics.unresolved_price_attribution, 1, 'uma atribuicao de preco permanece sem resolucao');
}

// 4. cor pode ser ignorada explicitamente para diagnostico, nunca por default
{
  const l = legacy([legacyOffer('l1', 'iphone_15_128gb', 'Seminovo', 'Azul', 2650, 128)]);
  const c = core([coreRecord('c1', 'iphone_15_128gb', 'Seminovo', 'Preto', 2650, 128)]);
  const strict = compareSemanticShadow({ legacy: l, coreBundle: c });
  const relaxed = compareSemanticShadow({ legacy: l, coreBundle: c, options: { include_color: false } });
  eq(strict.metrics.exact_multiset, false, 'default inclui cor');
  eq(relaxed.metrics.exact_multiset, true, 'modo diagnostico pode ignorar cor');
}

// 4. diferenca de cor + preco no mesmo modelo nao pode virar falso positivo de preco silencioso
{
  const l = legacy([legacyOffer('l1', 'iphone_17_256gb', 'Lacrado', 'Azul', 5000)]);
  const c = core([coreRecord('c1', 'iphone_17_256gb', 'Lacrado', 'Preto', 5100)]);
  const r = compareSemanticShadow({ legacy: l, coreBundle: c });
  eq(r.gates.no_silent_wrong_price, true, 'identidade diferente nao e substituicao silenciosa de preco');
  eq(r.metrics.silent_wrong_price_substitutions, 0, 'sem substituicao na mesma identidade');
}

// 5. oferta extra na mesma identidade nao e preco substituido se o preco legado continua presente
{
  const l = legacy([legacyOffer('l1', 'iphone_17_256gb', 'Lacrado', 'Azul', 5000)]);
  const c = core([
    coreRecord('c1', 'iphone_17_256gb', 'Lacrado', 'Azul', 5000),
    coreRecord('c2', 'iphone_17_256gb', 'Lacrado', 'Azul', 5100)
  ]);
  const r = compareSemanticShadow({ legacy: l, coreBundle: c });
  eq(r.gates.no_silent_wrong_price, true, 'extra deve ser tratado como extra, nao como troca silenciosa');
  eq(r.metrics.extra_offers, 1, 'extra continua visivel');
}

// 6. condicao canonicaliza plural sem esconder diferenca semantica
{
  const l = legacy([legacyOffer('l1', 'iphone_13_pro_128gb', 'Lacrados', 'Azul', 3000, 128)]);
  const c = core([coreRecord('c1', 'iphone_13_pro_128gb', 'Lacrado', 'Azul', 3000, 128)]);
  const r = compareSemanticShadow({ legacy: l, coreBundle: c });
  eq(r.metrics.exact_multiset, true, 'plural de condicao canonicalizado');
}

// 7. modelo a mais e modelo ausente permanecem visiveis no resumo
{
  const l = legacy([legacyOffer('l1', 'iphone_17_air_256gb', 'Lacrado', 'Gold', 5600)]);
  const c = core([coreRecord('c1', 'iphone_17e_256gb', 'Lacrado', 'Gold', 5600)]);
  const r = compareSemanticShadow({ legacy: l, coreBundle: c });
  eq(r.metrics.matched_offers, 0, 'modelo diferente nao casa');
  eq(r.by_model.length, 2, 'dois modelos aparecem no diagnostico');
}


{
  const aliases = {
    Branco: 'Silver',
    White: 'Silver',
    Silver: 'Silver',
    Prateado: 'Silver',
    Dourado: 'Gold',
    Amarelo: 'Gold',
    Gold: 'Gold'
  };

  const l = legacy([
    legacyOffer('l-color-alias', 'iphone_16_pro_max_256gb', 'Seminovo', 'Branco', 4999)
  ]);
  const c = core([
    coreRecord('c-color-alias', 'iphone_16_pro_max_256gb', 'Seminovo', 'Silver', 4999)
  ]);
  const same = compareSemanticShadow({
    legacy: l,
    coreBundle: c,
    options: { color_aliases: aliases }
  });
  eq(same.metrics.exact_multiset, true, 'alias canonico de cor casa semanticamente');

  const wrongPrice = compareSemanticShadow({
    legacy: l,
    coreBundle: core([
      coreRecord('c-color-alias-price', 'iphone_16_pro_max_256gb', 'Seminovo', 'Silver', 5099)
    ]),
    options: { color_aliases: aliases }
  });
  eq(wrongPrice.gates.no_silent_wrong_price, false, 'alias de cor nao pode esconder preco divergente');
  eq(wrongPrice.metrics.missing_offers, 1, 'preco errado continua faltando');
  eq(wrongPrice.metrics.extra_offers, 1, 'preco errado continua extra');
}

console.log(`PASSOU: ${n} assercoes Real Shadow Semantic V0`);
