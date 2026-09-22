'use strict';

const assert = require('assert');
const path = require('path');
const { interpretResolved } = require('./core');
const { applySupplierProfiles } = require('./supplier-profile-adapter');

const schema = require(path.join(__dirname, 'domains', 'apple-iphone-v0.schema.json'));
const knowledge = require(path.join(__dirname, 'domains', 'apple-iphone-v0.knowledge.json'));

const supplierProfiles = {
  profiles: [
    { id: 'supplier_mp', label: 'MP Imports', aliases: ['M P Imports'] },
    { id: 'supplier_quality', label: 'Quality', aliases: ['Quality Imports'] }
  ]
};

const enrichedSchema = applySupplierProfiles(schema, supplierProfiles);

function run(id, content) {
  return interpretResolved({
    document: {
      contract_version: 'raw-document/v1',
      document_id: id,
      content,
      source: { kind: 'plain_text' }
    },
    schema: enrichedSchema,
    knowledge
  });
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

{
  const result = run(
    'supplier-profile-two-blocks',
    [
      'MP Imports',
      'iPhone 17 256GB Lacrado',
      'Preto R$ 5.299',
      'Quality Imports',
      'iPhone 17 256GB Lacrado',
      'Azul R$ 5.399'
    ].join('\n')
  );

  eq(result.records.length, 2, 'deve produzir duas ofertas');
  eq(result.records[0].fields.supplier, 'supplier_mp', 'primeiro bloco herda fornecedor MP');
  eq(result.records[1].fields.supplier, 'supplier_quality', 'segundo bloco herda fornecedor Quality');

  const boundaries = result.segments
    .flatMap(segment => segment.context_events || [])
    .filter(event => event.reason === 'supplier_boundary');
  eq(boundaries.length, 2, 'cada cabecalho reconhecido abre supplier boundary');

  ok(result.records.every(record =>
    record.trace.some(trace =>
      trace.field === 'supplier' &&
      trace.rules.includes('context_inheritance')
    )
  ), 'fornecedor deve ter proveniencia de contexto');
}

{
  const result = run(
    'supplier-profile-unknown',
    [
      'Fornecedor Nao Cadastrado',
      'iPhone 17 256GB Lacrado',
      'Preto R$ 5.299'
    ].join('\n')
  );
  eq(result.records.length, 1, 'oferta continua interpretavel sem fornecedor conhecido');
  eq(result.records[0].fields.supplier, undefined, 'fornecedor desconhecido nao e inventado');
}

{
  const result = run(
    'supplier-profile-accent-spacing',
    [
      'M   P   IMPORTS',
      'iPhone 17 256GB Lacrado',
      'Preto R$ 5.299'
    ].join('\n')
  );
  eq(result.records[0].fields.supplier, 'supplier_mp', 'alias tolera variacao de espaco e caixa');
}


{
  const result = run(
    'supplier-direction-guard',
    [
      'MP Imports',
      'iPhone 13 Pro 128GB Lacrado',
      'R$ 3.999',
      'Azul',
      'Preto',
      'iPhone 15 128GB Lacrado',
      'R$ 4.299',
      'Azul',
      'Preto',
      'iPhone 16 256GB Lacrado',
      'R$ 4.899',
      'Azul',
      'Preto',
      'iPhone 16 128GB Lacrado',
      'Azul',
      'Preto',
      'OBS',
      'R$ 4.599',
      'Branco'
    ].join('\n')
  );

  const target = result.records.filter(record =>
    record.fields.model?.id === 'iphone_16_128gb' &&
    record.fields.price === 4599
  );
  eq(target.length, 2, 'guard deve preservar duas cores seguras no grupo misto');
  eq(
    target.map(record => record.fields.color).sort(),
    ['Preto', 'Silver'],
    'guard deve abster apenas a cor oposta mais distante'
  );
  ok(result.ambiguities.some(ambiguity =>
    ambiguity.field === 'color' &&
    ambiguity.cause === 'pairing_supplier_direction_conflict'
  ), 'abstencao deve ficar auditavel como ambiguidade');
}


{
  const result = run(
    'supplier-preserve-timestamp',
    [
      'MP Imports',
      '18/09/2026, 10:00 - Lista atualizada',
      'iPhone 17 256GB Lacrado',
      'Preto R$ 5.299'
    ].join('\n')
  );
  eq(result.records.length, 1, 'oferta apos timestamp continua interpretavel');
  eq(result.records[0].fields.supplier, 'supplier_mp', 'fornecedor deve sobreviver ao timestamp');
  const timestampEvent = result.segments
    .flatMap(segment => segment.context_events || [])
    .find(event => event.reason === 'timestamp_boundary');
  ok(timestampEvent?.preserved_fields?.includes('supplier'), 'timestamp deve preservar apenas contexto autorizado de fornecedor');
}

{
  const result = run(
    'supplier-timestamp-new-supplier-overrides',
    [
      'MP Imports',
      '18/09/2026, 10:00 - Lista atualizada',
      'Quality Imports',
      'iPhone 17 256GB Lacrado',
      'Azul R$ 5.399'
    ].join('\n')
  );
  eq(result.records.length, 1, 'oferta do novo fornecedor continua interpretavel');
  eq(result.records[0].fields.supplier, 'supplier_quality', 'novo supplier boundary deve sobrescrever fornecedor preservado');
}

console.log(`PASSOU: ${n} assercoes Supplier Profile Adapter V0`);
