'use strict';

const assert = require('assert');
const path = require('path');
const { compareShadow } = require('./shadow-comparator');

const profile = require(path.join(__dirname, 'domains', 'apple-iphone-v0.comparison-profile.json'));

function legacyRecord(id, sourceLines, fields) {
  return {
    legacy_record_id: id,
    source_lines: sourceLines,
    fields
  };
}

function coreRecord(id, sourceLines, fields) {
  return {
    record_id: id,
    state: 'interpreted',
    fields,
    trace: Object.keys(fields).map(field => ({
      field,
      chosen: fields[field],
      sources: sourceLines,
      derived_from: [],
      rules: ['fixture'],
      alternatives: [],
      score: 1
    }))
  };
}

function baseLegacy(records, parseMs = 12) {
  return {
    contract_version: 'legacy-reader-snapshot/v1',
    document_id: 'shadow-proof-001',
    records,
    metrics: { parse_ms: parseMs }
  };
}

function baseCore(records, ambiguities = [], parseMs = 4) {
  return {
    contract_version: 'interpretation-bundle/v1',
    run: { document_id: 'shadow-proof-001' },
    records,
    ambiguities,
    metrics: { parse_ms: parseMs }
  };
}

function iphoneFields({ model = 'iphone_17_air_256gb', capacity = 256, condition = 'Lacrado', color = 'Azul', price = 5000 } = {}) {
  return {
    model: model && typeof model === 'object' ? model : { id: model, label: 'fixture' },
    capacity_gb: capacity,
    condition,
    color,
    price
  };
}

let assertions = 0;
function ok(value, message) {
  assert.ok(value, message);
  assertions += 1;
}
function equal(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assertions += 1;
}

// Cenário A: equivalência limpa. Deve provar os dois gates em verde.
{
  const legacy = baseLegacy([
    legacyRecord('legacy-1', [2, 3], {
      model: 'iphone_17_air_256gb',
      capacity_gb: 256,
      condition: 'Lacrado',
      color: 'Azul',
      price: 5000
    })
  ], 10);

  const core = baseCore([
    coreRecord('record-line-3', [2, 3], iphoneFields())
  ], [], 3);

  const report = compareShadow({ legacySnapshot: legacy, coreBundle: core, profile });
  equal(report.metrics.matched_records, 1, 'cenário limpo: 1 registro pareado');
  equal(report.metrics.exact_matches, 1, 'cenário limpo: match exato');
  equal(report.metrics.silent_wrong_price, 0, 'cenário limpo: zero preço silenciosamente errado');
  equal(report.metrics.silent_loss, 0, 'cenário limpo: zero perda silenciosa');
  ok(report.gates.silent_wrong_price, 'cenário limpo: gate de preço verde');
  ok(report.gates.silent_loss, 'cenário limpo: gate de perda verde');
  equal(report.metrics.parse_ms.delta, -7, 'parse delta preservado');
}

// Cenário B: controle negativo. O comparador PRECISA detectar preço diferente.
{
  const legacy = baseLegacy([
    legacyRecord('legacy-price', [10], {
      model: 'iphone_17_air_256gb',
      capacity_gb: 256,
      condition: 'Lacrado',
      color: 'Azul',
      price: 5000
    })
  ]);

  const core = baseCore([
    coreRecord('record-line-10', [10], iphoneFields({ price: 5500 }))
  ]);

  const report = compareShadow({ legacySnapshot: legacy, coreBundle: core, profile });
  equal(report.metrics.field_divergences.price, 1, 'controle negativo: divergência de preço detectada');
  equal(report.metrics.silent_wrong_price, 1, 'controle negativo: preço divergente é silencioso sem ambiguidade');
  equal(report.gates.silent_wrong_price, false, 'controle negativo: gate de preço deve fechar');
}

// Cenário C: abstinência explícita. Falta no Core + ambiguidade na mesma linha não é perda silenciosa.
{
  const legacy = baseLegacy([
    legacyRecord('legacy-ambiguous', [20], {
      model: 'iphone_17_air_256gb',
      capacity_gb: 256,
      condition: 'Lacrado',
      color: 'Azul',
      price: 5000
    })
  ]);

  const core = baseCore([], [
    {
      ambiguity_id: 'amb-line-20-price',
      field: 'price',
      cause: 'multiple_field_candidates',
      raw: '5000 / 5100',
      candidates: [],
      sources: [20],
      context: {}
    }
  ]);

  const report = compareShadow({ legacySnapshot: legacy, coreBundle: core, profile });
  equal(report.metrics.missing_records, 1, 'abstinência: registro ausente registrado');
  equal(report.metrics.abstentions, 1, 'abstinência: ausência explicada por ambiguidade');
  equal(report.metrics.silent_loss, 0, 'abstinência: não vira perda silenciosa');
  ok(report.missing[0].explained_by_ambiguity, 'abstinência: evidência explícita preservada');
}

// Cenário D: falta sem ambiguidade precisa derrubar gate de silent loss.
{
  const legacy = baseLegacy([
    legacyRecord('legacy-missing', [30], {
      model: 'iphone_17_air_256gb',
      capacity_gb: 256,
      condition: 'Lacrado',
      color: 'Azul',
      price: 5000
    })
  ]);

  const report = compareShadow({ legacySnapshot: legacy, coreBundle: baseCore([]), profile });
  equal(report.metrics.silent_loss, 1, 'perda silenciosa detectada');
  equal(report.gates.silent_loss, false, 'gate de perda silenciosa deve fechar');
}

// Cenário E: extra no Core é contabilizado e não some do relatório.
{
  const report = compareShadow({
    legacySnapshot: baseLegacy([]),
    coreBundle: baseCore([
      coreRecord('record-extra', [40], iphoneFields({ price: 5200 }))
    ]),
    profile
  });
  equal(report.metrics.extra_records, 1, 'extra no Core contabilizado');
  equal(report.extra[0].core_record_id, 'record-extra', 'extra preserva identidade do Core');
}

// Cenário F: divergências de domínio são discriminadas campo a campo.
{
  const legacy = baseLegacy([
    legacyRecord('legacy-domain', [50], {
      model: 'iphone_17_air_256gb',
      capacity_gb: 256,
      condition: 'Lacrado',
      color: 'Azul',
      price: 5000
    })
  ]);

  const core = baseCore([
    coreRecord('record-domain', [50], iphoneFields({
      model: 'iphone_17_pro_256gb',
      condition: 'CPO',
      color: 'Preto',
      price: 5000
    }))
  ]);

  const report = compareShadow({ legacySnapshot: legacy, coreBundle: core, profile });
  equal(report.metrics.field_divergences.model, 1, 'divergência de modelo discriminada');
  equal(report.metrics.field_divergences.condition, 1, 'divergência de condição discriminada');
  equal(report.metrics.field_divergences.color, 1, 'divergência de cor discriminada');
  equal(report.metrics.field_divergences.price, 0, 'preço igual não gera falso positivo');
}

console.log(`PASSOU: ${assertions} assercoes Shadow Comparator V0`);
