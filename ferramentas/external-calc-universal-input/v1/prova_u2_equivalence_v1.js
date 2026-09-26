'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { interpretResolved } = require('../../interpreter-core/v1/core');
const { parseTextSource } = require('./text-adapter');
const { parseCsvSource } = require('./csv-adapter');
const { parseXlsxSource } = require('./xlsx-adapter');
const { canonicalToRawDocument, interpretCanonical } = require('./canonical-interpreter-bridge');

const schema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', 'interpreter-core', 'v1', 'domains', 'apple-iphone-v0.schema.json'),
  'utf8'
));
const knowledge = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', 'interpreter-core', 'v1', 'domains', 'apple-iphone-v0.knowledge.json'),
  'utf8'
));

let checks = 0;
let strictCases = 0;
let newSilentWrongPrice = 0;

function check(name, fn) {
  fn();
  checks += 1;
  console.log('OK ' + checks + ' - ' + name);
}

function semanticSnapshot(bundle) {
  const metrics = { ...(bundle.metrics || {}) };
  delete metrics.parse_ms;
  return {
    segments: bundle.segments,
    records: bundle.records,
    ambiguities: bundle.ambiguities,
    invalid: bundle.invalid,
    learning_proposals: bundle.learning_proposals,
    warnings: bundle.warnings,
    metrics
  };
}

function priceSignatures(bundle) {
  return (bundle.records || []).map(record => JSON.stringify({
    model: record.fields?.model?.id || record.fields?.model || null,
    capacity_gb: record.fields?.capacity_gb ?? null,
    condition: record.fields?.condition ?? null,
    color: record.fields?.color ?? null,
    price: record.fields?.price ?? null
  })).sort();
}

function assertEquivalent(content, kind, id) {
  const legacyDocument = {
    contract_version: 'raw-document/v1',
    document_id: id,
    content,
    source: { kind: 'u2_legacy_fixture' }
  };
  const legacy = interpretResolved({ document: legacyDocument, schema, knowledge });

  const canonical = kind === 'txt'
    ? parseTextSource({
        filename: id + '.txt',
        mime_type: 'text/plain',
        content
      }, { idFactory: () => 'canonical-' + id })
    : parseCsvSource({
        filename: id + '.csv',
        mime_type: 'text/csv',
        content
      }, { idFactory: () => 'canonical-' + id });

  const bridgedDocument = canonicalToRawDocument(canonical, { documentId: id });
  assert.strictEqual(bridgedDocument.content, content);

  const modern = interpretCanonical({
    document: canonical,
    schema,
    knowledge
  }, { documentId: id });

  assert.deepStrictEqual(semanticSnapshot(modern), semanticSnapshot(legacy));

  const legacyPrices = priceSignatures(legacy);
  const modernPrices = priceSignatures(modern);
  const legacySet = new Set(legacyPrices);
  const newPrices = modernPrices.filter(signature => !legacySet.has(signature));
  newSilentWrongPrice += newPrices.length;
  assert.deepStrictEqual(modernPrices, legacyPrices);
  strictCases += 1;
}

check('TXT inline canonico preserva semantica integral', () => {
  assertEquivalent(
    'iPhone 17 256GB Preto Lacrado - 7.300',
    'txt',
    'u2-inline'
  );
});

check('TXT bloco com heranca preserva semantica integral', () => {
  assertEquivalent(
    '*🍎 iPhone 13 Pro – 128GB (CPO)*\n💵 *R$ 3.150,00*',
    'txt',
    'u2-block'
  );
});

check('TXT multi-cor preserva expansao e price attribution', () => {
  assertEquivalent(
    'iPhone 17 256GB Lacrado\nPreto Azul\nR$ 5.299',
    'txt',
    'u2-colors'
  );
});

check('TXT CRLF preserva a mesma normalizacao do Core legado', () => {
  assertEquivalent(
    'iPhone 17 256GB Preto Lacrado\r\nR$ 5.299\r\n',
    'txt',
    'u2-crlf'
  );
});

check('TXT modelo desconhecido preserva abstencao e learning proposal', () => {
  assertEquivalent(
    'iPhone 18 256GB Preto Lacrado - 9.999',
    'txt',
    'u2-unknown'
  );
});

check('CSV textual legado permanece byte-equivalente antes do Core', () => {
  assertEquivalent(
    'oferta;obs\r\niPhone 17 256GB Preto Lacrado - 7.300;ok\r\n',
    'csv',
    'u2-csv'
  );
});

check('XLSX permanece bloqueado no bridge U2 estrito', () => {
  const encoded = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'xlsx-multi-sheet.base64.txt'),
    'utf8'
  ).trim();
  const canonical = parseXlsxSource({
    filename: 'fixture.xlsx',
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content: Buffer.from(encoded, 'base64')
  }, { idFactory: () => 'u2-xlsx' });

  assert.throws(
    () => canonicalToRawDocument(canonical),
    error => error.code === 'PARSER_FAILURE'
      && error.reason === 'SEMANTIC_PROJECTION_NOT_EQUIVALENCE_CERTIFIED'
  );
});

check('P0 local: nenhum novo price signature surgiu', () => {
  assert.strictEqual(newSilentWrongPrice, 0);
  assert.strictEqual(strictCases, 6);
});

console.log(
  'EXTERNAL_CALC_UNIVERSAL_INPUT_U2_LOCAL=PASS checks=' + checks
  + ' strict_cases=' + strictCases
  + ' new_silent_wrong_price=' + newSilentWrongPrice
);
