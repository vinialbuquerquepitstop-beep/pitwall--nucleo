'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { routeSource } = require('./format-router');
const { parseCsvSource, reconstructCsv } = require('./csv-adapter');

const FIXTURE = path.join(__dirname, 'fixtures', 'csv-semicolon.csv');
let checks = 0;

function check(name, fn) {
  fn();
  checks += 1;
  console.log('OK ' + checks + ' - ' + name);
}

check('FormatRouter seleciona CsvAdapter sem fallback', () => {
  const route = routeSource({
    filename: 'lista.csv',
    mime_type: 'text/csv'
  });
  assert.strictEqual(route.adapter_id, 'csv-native-v1');
  assert.strictEqual(route.detected_type, 'csv');
});

check('CsvAdapter preserva arquivo inteiro e delimitador estrutural', () => {
  const content = fs.readFileSync(FIXTURE, 'utf8');
  const document = parseCsvSource({
    filename: 'csv-semicolon.csv',
    mime_type: 'text/csv',
    content
  }, {
    idFactory: () => 'doc-csv-fixture'
  });

  assert.strictEqual(reconstructCsv(document), content);
  assert.strictEqual(document.metadata.delimiter, ';');
  assert.strictEqual(document.parser.adapter, 'csv-native-v1');
  assert.strictEqual(document.blocks.length, 4);
});

check('CsvAdapter preserva numeros e delimitador dentro de campo quoted', () => {
  const content = fs.readFileSync(FIXTURE, 'utf8');
  const document = parseCsvSource({
    filename: 'csv-semicolon.csv',
    mime_type: 'text/csv',
    content
  }, {
    idFactory: () => 'doc-csv-values'
  });

  assert.strictEqual(document.blocks[1].cells[2].raw, '7499,90');
  assert.strictEqual(document.blocks[1].cells[3].raw, 'azul; preto');
  assert.strictEqual(document.blocks[2].cells[0].raw, 'Modelo "Especial"');
});

check('CsvAdapter preserva campo multilinha com provenance fisica', () => {
  const content = fs.readFileSync(FIXTURE, 'utf8');
  const document = parseCsvSource({
    filename: 'csv-semicolon.csv',
    mime_type: 'text/csv',
    content
  }, {
    idFactory: () => 'doc-csv-multiline'
  });

  assert.strictEqual(document.blocks[2].cells[3].raw, 'linha 1\nlinha 2');
  assert.strictEqual(document.blocks[2].provenance.row, 3);
  assert.strictEqual(document.blocks[2].provenance.source_ref, 'lines:3-4');
  assert.strictEqual(document.blocks[3].provenance.row, 5);
});

check('CsvAdapter falha fechado quando delimitador e ambiguo', () => {
  assert.throws(
    () => parseCsvSource({
      filename: 'ambiguous.csv',
      mime_type: 'text/csv',
      content: 'a,b;c\n1,2;3'
    }),
    error => error.code === 'PARSER_FAILURE' && error.reason === 'DELIMITER_UNCERTAIN'
  );
});

check('CsvAdapter falha em aspas nao fechadas', () => {
  assert.throws(
    () => parseCsvSource({
      filename: 'bad.csv',
      mime_type: 'text/csv',
      content: 'a;b\n"valor;quebrado'
    }),
    error => error.code === 'PARSER_FAILURE' && error.reason === 'UNCLOSED_QUOTE'
  );
});

check('CsvAdapter preserva vazio e explicita warning', () => {
  const document = parseCsvSource({
    filename: 'empty.csv',
    mime_type: 'text/csv',
    content: ''
  }, {
    idFactory: () => 'doc-csv-empty'
  });

  assert.deepStrictEqual(document.blocks, []);
  assert.strictEqual(reconstructCsv(document), '');
  assert(document.warnings.some(warning => warning.code === 'EMPTY_INPUT'));
});

console.log('EXTERNAL_CALC_UNIVERSAL_INPUT_B4_CSV=PASS checks=' + checks);
