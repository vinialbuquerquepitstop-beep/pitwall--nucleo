'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { validateCanonicalDocument } = require('./canonical-document');
const { routeSource } = require('./format-router');
const { parseTextSource, reconstructText } = require('./text-adapter');

const FIXTURES = path.join(__dirname, 'fixtures');
let checks = 0;

function check(name, fn) {
  fn();
  checks += 1;
  console.log('OK ' + checks + ' - ' + name);
}

function read(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

function collectKeys(value, keys = new Set()) {
  if (Array.isArray(value)) {
    value.forEach(item => collectKeys(item, keys));
    return keys;
  }
  if (!value || typeof value !== 'object') return keys;
  Object.entries(value).forEach(([key, child]) => {
    keys.add(key);
    collectKeys(child, keys);
  });
  return keys;
}

check('CanonicalDocument JSON Schema e JSON valido e declara a versao V1', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'canonical-document.schema.json'), 'utf8'));
  assert.strictEqual(schema.$id, 'external-calc/canonical-document/v1');
  assert.strictEqual(schema.properties.schema_version.const, '1.0');
  assert(schema.required.includes('blocks'));
  assert(schema.required.includes('warnings'));
});

check('FormatRouter seleciona TextAdapter por extensao e MIME coerentes', () => {
  const route = routeSource({
    filename: 'lista.txt',
    mime_type: 'text/plain'
  });
  assert.strictEqual(route.adapter_id, 'text-native-v1');
  assert.strictEqual(route.detected_type, 'txt');
  assert.strictEqual(route.confidence, 1.0);
});

check('FormatRouter falha fechado em conflito de tipo', () => {
  assert.throws(
    () => routeSource({ filename: 'lista.txt', mime_type: 'application/pdf' }),
    error => error.code === 'UNSUPPORTED_FORMAT' && error.reason === 'TYPE_CONFLICT'
  );
});

check('FormatRouter nao finge adapter ainda nao implementado', () => {
  assert.throws(
    () => routeSource({ filename: 'lista.json', mime_type: 'application/json' }),
    error => error.code === 'UNSUPPORTED_FORMAT' && error.reason === 'ADAPTER_NOT_IMPLEMENTED'
  );
});

check('TextAdapter preserva conteudo, ordem, numeros e provenance linha a linha', () => {
  const content = read('text-basic.txt');
  const document = parseTextSource({
    filename: 'text-basic.txt',
    mime_type: 'text/plain',
    content_ref: 'fixture:text-basic',
    content
  }, {
    idFactory: () => 'doc-fixture-basic'
  });

  validateCanonicalDocument(document);
  assert.strictEqual(document.document_id, 'doc-fixture-basic');
  assert.strictEqual(reconstructText(document), content);
  assert.strictEqual(document.blocks[0].text, 'FORNECEDOR ALFA');
  assert.strictEqual(document.blocks[1].text, 'IPHONE 16 PRO MAX 256GB');
  assert.strictEqual(document.blocks[2].text, 'R$ 7.499,90');
  assert.strictEqual(document.blocks[2].provenance.source_ref, 'line:3');
  assert.strictEqual(document.blocks[2].provenance.row, 3);
});

check('TextAdapter preserva linhas vazias, CRLF, CR e Unicode sem normalizar', () => {
  const content = read('text-line-endings.txt');
  const document = parseTextSource({
    filename: 'text-line-endings.txt',
    mime_type: 'text/plain; charset=utf-8',
    content
  }, {
    idFactory: () => 'doc-line-endings'
  });

  assert.strictEqual(reconstructText(document), content);
  assert.strictEqual(document.blocks[1].text, '');
  assert.strictEqual(document.blocks[2].text, 'linha 3 — ação');
  assert.deepStrictEqual(document.metadata.line_endings, ['\r\n', '\r\n', '\r', '']);
});

check('TextAdapter nao cria campos semanticos comerciais', () => {
  const content = read('text-basic.txt');
  const document = parseTextSource({
    filename: 'text-basic.txt',
    mime_type: 'text/plain',
    content
  }, {
    idFactory: () => 'doc-no-semantics'
  });

  const keys = collectKeys(document);
  for (const forbidden of ['model', 'condition', 'price', 'opportunity', 'margin', 'decision']) {
    assert.strictEqual(keys.has(forbidden), false, 'campo semantico indevido: ' + forbidden);
  }
});

check('TextAdapter registra hash de conteudo e versao do parser', () => {
  const content = read('text-basic.txt');
  const document = parseTextSource({
    filename: 'text-basic.txt',
    mime_type: 'text/plain',
    content
  }, {
    idFactory: () => 'doc-hash'
  });

  assert.match(document.source.content_hash, /^sha256:[a-f0-9]{64}$/);
  assert.strictEqual(document.parser.adapter, 'text-native-v1');
  assert.strictEqual(document.parser.version, '1.0');
});

check('entrada vazia e preservada com warning explicito', () => {
  const document = parseTextSource({
    filename: 'empty.txt',
    mime_type: 'text/plain',
    content: ''
  }, {
    idFactory: () => 'doc-empty'
  });

  assert.deepStrictEqual(document.blocks, []);
  assert.strictEqual(reconstructText(document), '');
  assert.deepStrictEqual(document.warnings, [{
    code: 'EMPTY_INPUT',
    message: 'fonte de texto vazia'
  }]);
});

check('entrada malformada falha como SOURCE_CORRUPTED', () => {
  assert.throws(
    () => parseTextSource({
      filename: 'bad.txt',
      mime_type: 'text/plain',
      content: Buffer.from('nao aceitar buffer silenciosamente')
    }),
    error => error.code === 'SOURCE_CORRUPTED'
  );
});

console.log('EXTERNAL_CALC_UNIVERSAL_INPUT_B1_B3=PASS checks=' + checks);
