'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { interpretResolved } = require('./core');

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'domains', 'apple-iphone-v0.schema.json'), 'utf8')
);
const knowledge = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'domains', 'apple-iphone-v0.knowledge.json'), 'utf8')
);

function run(id, content) {
  return interpretResolved({
    document: {
      contract_version: 'raw-document/v1',
      document_id: id,
      content,
      source: { kind: 'plain_text' }
    },
    schema,
    knowledge
  });
}

let ok = 0;
function check(name, fn) {
  fn();
  ok += 1;
  console.log(`OK ${ok} - ${name}`);
}

check('duas cores e um preco expandem para duas ofertas sem duplicar preco', () => {
  const result = run(
    'expansion-1',
    'iPhone 17 256GB Preto Azul Lacrado - R$ 5.299'
  );
  assert.strictEqual(result.records.length, 2);
  assert.deepStrictEqual(
    result.records.map(r => r.fields.color).sort(),
    ['Azul', 'Preto']
  );
  assert.ok(result.records.every(r => r.fields.price === 5299));
  assert.ok(result.records.every(r => r.fields.model.id === 'iphone_17_256gb'));
  assert.ok(result.records.every(r =>
    r.trace.some(t => t.field === 'color' && t.rules.includes('record_expansion:direct_extraction'))
  ));
});

check('uma cor preserva o comportamento anterior', () => {
  const result = run(
    'expansion-2',
    'iPhone 17 256GB Preto Lacrado - R$ 5.299'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.color, 'Preto');
  assert.strictEqual(result.records[0].fields.price, 5299);
});

check('cor repetida nao cria oferta duplicada artificial', () => {
  const result = run(
    'expansion-3',
    'iPhone 17 256GB Preto Preto Lacrado - R$ 5.299'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.color, 'Preto');
});

check('duas cores com dois precos sem pareamento inequívoco se abstêm', () => {
  const result = run(
    'expansion-4',
    'iPhone 17 256GB Preto R$ 5.299 Azul R$ 5.399'
  );
  assert.strictEqual(result.records.length, 0);
  assert.ok(
    result.ambiguities.some(a =>
      a.field === 'price' &&
      (a.cause === 'multiple_trigger_candidates' || a.cause === 'multiple_field_candidates')
    )
  );
});

check('expansao continua shadow-only e sem escrita operacional', () => {
  const result = run(
    'expansion-5',
    'iPhone 17 256GB Preto Azul Lacrado - R$ 5.299'
  );
  assert.ok(result.warnings.includes('no_persistence'));
  assert.ok(result.warnings.includes('no_operational_price_write'));
});

console.log(`PASSOU: ${ok} assercoes Offer Expansion V1`);
