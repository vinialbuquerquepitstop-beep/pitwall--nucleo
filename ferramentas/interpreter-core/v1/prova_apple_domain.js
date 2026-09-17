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

check('linha inline canonica resolve iPhone 17 256GB e preco', () => {
  const result = run('apple-1', 'iPhone 17 256GB Preto Lacrado - 7.300');
  assert.strictEqual(result.records.length, 1);
  const record = result.records[0];
  assert.strictEqual(record.fields.model.id, 'iphone_17_256gb');
  assert.strictEqual(record.fields.price, 7300);
  assert.strictEqual(record.fields.capacity_gb, 256);
  assert.strictEqual(record.fields.color, 'Preto');
  assert.strictEqual(record.fields.condition, 'Lacrado');
  assert.strictEqual(record.state, 'interpreted');
});

check('segunda capacidade canonica permanece entidade distinta', () => {
  const result = run('apple-2', 'iPhone 17 512GB Preto Lacrado - 8.100');
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_17_512gb');
  assert.strictEqual(result.records[0].fields.price, 8100);
});

check('forma sem GB resolve por alias e extrai capacidade declarada', () => {
  const result = run('apple-3', 'iPhone 16 128 Preto Lacrado - 4.299');
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_16_128gb');
  assert.strictEqual(result.records[0].fields.price, 4299);
  assert.strictEqual(result.records[0].fields.capacity_gb, 128);
  assert.strictEqual(result.records[0].state, 'inferred');
});

check('apelido de mercado iPhone Air resolve para iPhone 17 Air', () => {
  const result = run('apple-4', 'iPhone Air 256GB Preto Lacrado - 7.300');
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_17_air_256gb');
  assert.strictEqual(result.records[0].state, 'inferred');
});

check('formato bloco CPO herda modelo e condicao ate a linha de preco', () => {
  const result = run(
    'apple-5',
    '*🍎 iPhone 13 Pro – 128GB (CPO)*\n💵 *R$ 3.150,00*'
  );
  assert.strictEqual(result.records.length, 1);
  const record = result.records[0];
  assert.strictEqual(record.fields.model.id, 'iphone_13_pro_128gb');
  assert.strictEqual(record.fields.capacity_gb, 128);
  assert.strictEqual(record.fields.condition, 'CPO');
  assert.strictEqual(record.fields.price, 3150);
  const modelTrace = record.trace.find(t => t.field === 'model');
  assert.deepStrictEqual(modelTrace.derived_from, [1]);
});

check('modelo novo nao conhecido abstém em vez de criar registro', () => {
  const result = run('apple-6', 'iPhone 18 256GB Preto Lacrado - 9.999');
  assert.strictEqual(result.records.length, 0);
  assert.ok(result.ambiguities.some(a => a.field === 'model' && a.cause === 'entity_unresolved'));
  assert.ok(result.learning_proposals.some(p => p.payload?.field === 'model'));
});

check('numero baixo isolado nao vira preco operacional no shadow Apple', () => {
  const result = run(
    'apple-7',
    'iPhone 16 128GB Preto Lacrado - 300'
  );
  assert.strictEqual(result.records.length, 0);
});

check('cabecalho de fornecedor desconhecido nao e necessario para resolver produto', () => {
  const result = run(
    'apple-8',
    '[08/09/2026, 11:30:00] Vini: TABELA XPTO IMPORTS\n' +
    'iPhone 17 256GB Preto Lacrado - 7.300\n' +
    'iPhone 17 512GB Preto Lacrado - 8.100'
  );
  assert.strictEqual(result.records.length, 2);
  assert.deepStrictEqual(
    result.records.map(r => r.fields.model.id),
    ['iphone_17_256gb', 'iphone_17_512gb']
  );
});

check('cabecalho sem GB seguido de emoji resolve modelo e capacidade', () => {
  const result = run(
    'apple-9',
    '📲IPHONE 16 PRO MAX 256 ⚪️ (gold) ⚫️\nR$4.999/BATERIA🔋🟰92%'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_16_pro_max_256gb');
  assert.strictEqual(result.records[0].fields.capacity_gb, 256);
  assert.strictEqual(result.records[0].fields.price, 4999);
});

check('preco com R$ pode ter texto e emoji depois sem perder o gatilho', () => {
  const result = run(
    'apple-10',
    'iPhone 17 256GB\nAzul R$4.900🔥🔥'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_17_256gb');
  assert.strictEqual(result.records[0].fields.price, 4900);
  assert.strictEqual(result.records[0].fields.color, 'Azul');
});

check('condicao de secao sobrevive a troca de modelo declarada pelo schema', () => {
  const result = run(
    'apple-condition-section',
    '🔥 IPHONES SEMINOVOS 🔥\niPhone 17 256GB\nR$ 4.900'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_17_256gb');
  assert.strictEqual(result.records[0].fields.condition, 'SEMINOVOS');
  const conditionTrace = result.records[0].trace.find(t => t.field === 'condition');
  assert.deepStrictEqual(conditionTrace.derived_from, [1]);
});

check('shadow Apple nunca habilita persistencia nem escrita de preco', () => {
  const result = run('apple-11', 'iPhone 16 256GB Azul Lacrado - 4.900');
  assert.ok(result.warnings.includes('no_persistence'));
  assert.ok(result.warnings.includes('no_operational_price_write'));
});

console.log(`PASSOU: ${ok} assercoes Apple`);
