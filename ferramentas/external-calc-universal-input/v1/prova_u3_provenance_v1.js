'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseTextSource } = require('./text-adapter');
const { parseCsvSource } = require('./csv-adapter');
const { interpretCanonical } = require('./canonical-interpreter-bridge');
const {
  buildCanonicalLineIndex,
  assertCriticalProvenance
} = require('./provenance-resolver');

const schema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', 'interpreter-core', 'v1', 'domains', 'apple-iphone-v0.schema.json'),
  'utf8'
));
const knowledge = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', 'interpreter-core', 'v1', 'domains', 'apple-iphone-v0.knowledge.json'),
  'utf8'
));

let checks = 0;
let criticalFields = 0;
let priceFields = 0;

function check(name, fn) {
  fn();
  checks += 1;
  console.log('OK ' + checks + ' - ' + name);
}

function prove(document, id) {
  const bundle = interpretCanonical({ document, schema, knowledge }, { documentId: id });
  const traced = assertCriticalProvenance(bundle, document);
  for (const record of traced.records) {
    criticalFields += record.fields.length;
    priceFields += record.fields.filter(field => field.field === 'price').length;
    for (const field of record.fields) {
      assert(field.origins.length > 0);
      for (const origin of field.origins) {
        assert(origin.source_ref);
        assert(Number.isInteger(origin.line));
      }
    }
  }
  return { bundle, traced };
}

check('TXT inline: campos criticos e preco voltam a line:1', () => {
  const document = parseTextSource({
    filename: 'inline.txt',
    mime_type: 'text/plain',
    content: 'iPhone 17 256GB Preto Lacrado - 7.300'
  }, { idFactory: () => 'u3-inline' });
  const { traced } = prove(document, 'u3-inline');
  const fields = traced.records.flatMap(record => record.fields);
  assert(fields.some(field => field.field === 'price'));
  assert(fields.every(field => field.origins.some(origin => origin.source_ref === 'line:1')));
});

check('TXT contexto: origem herdada permanece na linha fisica correta', () => {
  const document = parseTextSource({
    filename: 'context.txt',
    mime_type: 'text/plain',
    content: '*🍎 iPhone 13 Pro – 128GB (CPO)*\n💵 *R$ 3.150,00*'
  }, { idFactory: () => 'u3-context' });
  const { traced } = prove(document, 'u3-context');
  const fields = traced.records.flatMap(record => record.fields);
  assert(fields.some(field => field.origins.some(origin => origin.source_ref === 'line:1')));
  assert(fields.some(field => field.field === 'price' && field.origins.some(origin => origin.source_ref === 'line:2')));
});

check('TXT multi-cor: expansao preserva provenance por campo', () => {
  const document = parseTextSource({
    filename: 'colors.txt',
    mime_type: 'text/plain',
    content: 'iPhone 17 256GB Lacrado\nPreto Azul\nR$ 5.299'
  }, { idFactory: () => 'u3-colors' });
  const { bundle, traced } = prove(document, 'u3-colors');
  assert(bundle.records.length >= 1);
  assert(traced.records.every(record => record.fields.every(field => field.origins.length > 0)));
});

check('CSV de uma coluna: price provenance resolve para origem canonica', () => {
  const document = parseCsvSource({
    filename: 'offers.csv',
    mime_type: 'text/csv',
    content: 'iPhone 17 256GB Preto Lacrado - 7.300\r\n'
  }, { idFactory: () => 'u3-csv' });
  const { traced } = prove(document, 'u3-csv');
  const prices = traced.records.flatMap(record => record.fields.filter(field => field.field === 'price'));
  assert(prices.length > 0);
  assert(prices.every(field => field.origins.some(origin => origin.source_ref === 'line:1')));
});

check('CSV multiline: index canonico cobre todo intervalo fisico', () => {
  const document = parseCsvSource({
    filename: 'multiline.csv',
    mime_type: 'text/csv',
    content: 'oferta;obs\r\n"iPhone 17 256GB Preto Lacrado - 7.300\r\nestoque imediato";ok\r\n'
  }, { idFactory: () => 'u3-csv-multiline' });
  const index = buildCanonicalLineIndex(document);
  assert(index.get(2).some(origin => origin.source_ref === 'lines:2-3'));
  assert(index.get(3).some(origin => origin.source_ref === 'lines:2-3'));
});

check('fail-closed: campo critico sem trace e rejeitado', () => {
  const document = parseTextSource({
    filename: 'fail.txt',
    mime_type: 'text/plain',
    content: 'iPhone 17 256GB Preto Lacrado - 7.300'
  }, { idFactory: () => 'u3-fail' });
  assert.throws(
    () => assertCriticalProvenance({
      records: [{ record_id: 'broken', fields: { price: 7300 }, trace: [] }]
    }, document),
    error => error.code === 'PROVENANCE_INCOMPLETE'
      && error.reason === 'CRITICAL_FIELD_TRACE_MISSING'
  );
});

check('P0: todo preco observado possui ao menos uma origem', () => {
  assert(priceFields > 0);
  assert(criticalFields >= priceFields);
});

console.log(
  'EXTERNAL_CALC_UNIVERSAL_INPUT_U3=PASS checks=' + checks
  + ' critical_fields=' + criticalFields
  + ' price_fields=' + priceFields
  + ' unresolved_critical_provenance=0'
);
