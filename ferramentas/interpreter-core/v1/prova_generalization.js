'use strict';

const assert = require('assert');
const { interpretResolved } = require('./core');

const schema = {
  contract_version: 'domain-schema/v1',
  schema_id: 'synthetic-parts-domain',
  schema_version: '1',
  entity_type: 'quote',
  fields: [
    {
      name: 'sku',
      type: 'string',
      required: true,
      context_inheritable: true,
      context_anchor: true,
      resolver: {
        kind: 'entity',
        entity_kind: 'sku',
        match: ['alias', 'label']
      },
      extractors: [
        {
          kind: 'regex',
          pattern: '^ITEM\\s+([A-Z]{2}-[0-9]{2})$',
          flags: 'i',
          group: 1,
          transform: 'trim',
          score: 0.98
        }
      ]
    },
    {
      name: 'grade',
      type: 'string',
      required: false,
      context_inheritable: true,
      context_anchor: false,
      extractors: [
        {
          kind: 'regex',
          pattern: '^GRADE:\\s*(NEW|USED)$',
          flags: 'i',
          group: 1,
          transform: 'trim',
          score: 0.95
        }
      ],
      value_map: {
        NEW: 'NEW',
        USED: 'USED'
      }
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      context_inheritable: false,
      context_anchor: false,
      record_trigger: true,
      extractors: [
        {
          kind: 'regex',
          pattern: '^AMOUNT:\\s*([0-9][0-9.,]*)$',
          flags: 'i',
          group: 1,
          transform: 'number',
          score: 0.99
        }
      ]
    }
  ],
  context_policy: {
    reset_on_timestamp: true,
    anchor_resets_other_context: true
  }
};

const knowledge = {
  contract_version: 'knowledge-snapshot/v1',
  snapshot_id: 'synthetic-parts-knowledge',
  version: '1',
  entities: [
    { kind: 'sku', id: 'part-zx-10', label: 'ZX-10', attributes: { family: 'zx' } },
    { kind: 'sku', id: 'part-qk-20', label: 'QK-20', attributes: { family: 'qk' } }
  ],
  aliases: [
    { kind: 'sku', text: 'ZZ-10', target_id: 'part-zx-10' }
  ],
  semantic_rules: [],
  supplier_profiles: [],
  domain_rules: []
};

function raw(id, content) {
  return {
    contract_version: 'raw-document/v1',
    document_id: id,
    content,
    source: { kind: 'plain_text' }
  };
}

function run(id, content, localKnowledge = knowledge) {
  return interpretResolved({
    document: raw(id, content),
    schema,
    knowledge: localKnowledge
  });
}

let ok = 0;
function check(name, fn) {
  try {
    fn();
    ok += 1;
    console.log(`OK ${ok} - ${name}`);
  } catch (err) {
    console.error(`FALHOU - ${name}`);
    throw err;
  }
}

check('dominio nao Apple resolve SKU, grade e amount em layout vertical', () => {
  const result = run('gen-1', 'ITEM ZX-10\nGRADE: NEW\nAMOUNT: 1200');
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.sku.id, 'part-zx-10');
  assert.strictEqual(result.records[0].fields.grade, 'NEW');
  assert.strictEqual(result.records[0].fields.amount, 1200);
});

check('novo anchor sintetico reseta contexto dependente sem contaminar o proximo registro', () => {
  const result = run(
    'gen-2',
    'ITEM ZX-10\nGRADE: USED\nAMOUNT: 900\nITEM QK-20\nAMOUNT: 1500'
  );
  assert.strictEqual(result.records.length, 2);
  assert.strictEqual(result.records[0].fields.grade, 'USED');
  assert.strictEqual(result.records[1].fields.sku.id, 'part-qk-20');
  assert.strictEqual(result.records[1].fields.grade, undefined);
  assert.strictEqual(result.records[1].fields.amount, 1500);
});

check('timestamp impede heranca sintetica para trigger posterior', () => {
  const result = run(
    'gen-3',
    'ITEM ZX-10\nGRADE: NEW\n[18/09/2026, 12:00] nova mensagem\nAMOUNT: 1200'
  );
  assert.strictEqual(result.records.length, 0);
  assert.ok(result.ambiguities.some(item =>
    item.field === 'sku' && item.cause === 'required_field_missing'
  ));
});

check('alias sintetico resolve sem qualquer conhecimento Apple no motor', () => {
  const result = run('gen-4', 'ITEM ZZ-10\nAMOUNT: 1100');
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.sku.id, 'part-zx-10');
  assert.strictEqual(result.records[0].state, 'inferred');
});

check('alias sintetico conflitante se abstem em vez de escolher silenciosamente', () => {
  const conflicting = JSON.parse(JSON.stringify(knowledge));
  conflicting.aliases.push({ kind: 'sku', text: 'ZZ-10', target_id: 'part-qk-20' });
  const result = run('gen-5', 'ITEM ZZ-10\nAMOUNT: 1100', conflicting);
  assert.strictEqual(result.records.length, 0);
  assert.ok(result.ambiguities.some(item =>
    item.field === 'sku' && item.cause === 'entity_resolution_ambiguous'
  ));
});

check('ordem trigger antes do anchor nao faz retro-heranca indevida', () => {
  const result = run('gen-6', 'AMOUNT: 800\nITEM ZX-10');
  assert.strictEqual(result.records.length, 0);
  assert.ok(result.ambiguities.some(item =>
    item.field === 'sku' && item.cause === 'required_field_missing'
  ));
});


check('segundo schema sintetico interpreta lista tabular inline sem regra Apple', () => {
  const tableSchema = {
    contract_version: 'domain-schema/v1',
    schema_id: 'synthetic-inline-catalog',
    schema_version: '1',
    entity_type: 'quote',
    fields: [
      {
        name: 'sku',
        type: 'string',
        required: true,
        context_inheritable: true,
        context_anchor: true,
        resolver: { kind: 'entity', entity_kind: 'sku', match: ['alias', 'label'] },
        extractors: [{
          kind: 'regex',
          pattern: 'SKU=([A-Z]{2}-[0-9]{2})',
          flags: 'i',
          group: 1,
          transform: 'trim',
          score: 0.98
        }]
      },
      {
        name: 'grade',
        type: 'string',
        required: false,
        context_inheritable: false,
        context_anchor: false,
        extractors: [{
          kind: 'regex',
          pattern: 'STATE=(NEW|USED)',
          flags: 'i',
          group: 1,
          transform: 'trim',
          score: 0.95
        }]
      },
      {
        name: 'amount',
        type: 'number',
        required: true,
        context_inheritable: false,
        context_anchor: false,
        record_trigger: true,
        extractors: [{
          kind: 'regex',
          pattern: 'VALUE=([0-9][0-9.,]*)',
          flags: 'i',
          group: 1,
          transform: 'number',
          score: 0.99
        }]
      }
    ],
    context_policy: {
      reset_on_timestamp: true,
      anchor_resets_other_context: true
    }
  };

  const result = interpretResolved({
    document: raw(
      'gen-inline',
      'SKU=ZX-10 STATE=NEW VALUE=1250\nSKU=QK-20 STATE=USED VALUE=875'
    ),
    schema: tableSchema,
    knowledge
  });

  assert.strictEqual(result.records.length, 2);
  assert.strictEqual(result.records[0].fields.sku.id, 'part-zx-10');
  assert.strictEqual(result.records[0].fields.grade, 'NEW');
  assert.strictEqual(result.records[0].fields.amount, 1250);
  assert.strictEqual(result.records[1].fields.sku.id, 'part-qk-20');
  assert.strictEqual(result.records[1].fields.grade, 'USED');
  assert.strictEqual(result.records[1].fields.amount, 875);
});

check('pairing ordinal generico funciona fora do dominio Apple', () => {
  const pairedSchema = JSON.parse(JSON.stringify(schema));
  pairedSchema.schema_id = 'synthetic-paired-catalog';
  pairedSchema.fields.splice(1, 1, {
    name: 'finish',
    type: 'string',
    required: false,
    context_inheritable: false,
    context_anchor: false,
    extractors: [{
      kind: 'regex',
      pattern: '^(RED|BLUE)
,
      flags: 'i',
      group: 1,
      transform: 'trim',
      score: 0.9
    }],
    pair_by_order_with_trigger: {
      field: 'amount',
      require_equal_rows: true,
      require_adjacent_rows: false,
      require_source_only: true
    }
  });

  const result = interpretResolved({
    document: raw(
      'gen-paired',
      'ITEM ZX-10\nRED\nBLUE\nAMOUNT: 1000\nAMOUNT: 1100'
    ),
    schema: pairedSchema,
    knowledge
  });

  assert.strictEqual(result.records.length, 2);
  assert.strictEqual(result.records[0].fields.finish, 'RED');
  assert.strictEqual(result.records[0].fields.amount, 1000);
  assert.strictEqual(result.records[1].fields.finish, 'BLUE');
  assert.strictEqual(result.records[1].fields.amount, 1100);
});

console.log(`PASSOU: ${ok} assercoes de generalizacao`);
