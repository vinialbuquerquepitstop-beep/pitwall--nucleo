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
  assert.strictEqual(result.records[0].fields.condition, 'Seminovo');
  const conditionTrace = result.records[0].trace.find(t => t.field === 'condition');
  assert.deepStrictEqual(conditionTrace.derived_from, [1]);
});

check('grafia Promax sem espaco resolve por alias de dominio', () => {
  const result = run(
    'apple-promax',
    'iPhone 16 Promax 256GB\nPreto $6.699,00'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_16_pro_max_256gb');
  assert.strictEqual(result.records[0].fields.price, 6699);
  assert.strictEqual(result.records[0].fields.color, 'Preto');
});

check('cores Lavanda e Laranja entram como cores de dominio', () => {
  const lavanda = run('apple-lavanda', 'iPhone 17 256GB\nLavanda R$5.299,00');
  assert.strictEqual(lavanda.records.length, 1);
  assert.strictEqual(lavanda.records[0].fields.color, 'Lavanda');

  const laranja = run('apple-laranja', 'iPhone 17 256GB\nLaranja R$5.299,00');
  assert.strictEqual(laranja.records.length, 1);
  assert.strictEqual(laranja.records[0].fields.color, 'Laranja');
});

check('Offer Expansion V1.1 expande multiplas cores contiguas antes do preco', () => {
  const result = run(
    'apple-expansion-block',
    'iPhone 17 256GB Lacrado\nPreto Azul\nR$ 5.299'
  );
  assert.strictEqual(result.records.length, 2);
  assert.deepStrictEqual(result.records.map(r => r.fields.color).sort(), ['Azul', 'Preto']);
  assert.ok(result.records.every(r => r.fields.price === 5299));
});

check('pareamento ordinal permite uma cor solta quando existe um unico preco nu', () => {
  const result = run(
    'apple-ordered-single-color',
    'iPhone 17 256GB Lacrado\nPreto\nR$ 5.299'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.color, 'Preto');
  assert.strictEqual(result.records[0].fields.price, 5299);
});

check('pareamento ordinal atravessa nota quando a linha fonte e somente cor e o bloco e 1:1', () => {
  const result = run(
    'apple-ordered-through-note',
    'iPhone 17 256GB Lacrado\nPreto Azul\nOBSERVACAO\nR$ 5.299'
  );
  assert.strictEqual(result.records.length, 2);
  assert.deepStrictEqual(result.records.map(r => r.fields.color).sort(), ['Azul', 'Preto']);
  assert.ok(result.records.every(r => r.fields.price === 5299));
});

check('pareamento ordinal nao usa linha com texto extra como fonte de cor', () => {
  const result = run(
    'apple-ordered-source-not-pure',
    'iPhone 17 256GB Lacrado\nPreto disponibilidade\nR$ 5.299'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.color, undefined);
});

check('Offer Expansion V1.1 nao atravessa timestamp', () => {
  const result = run(
    'apple-expansion-stop-timestamp',
    'iPhone 17 256GB Lacrado\nPreto\n[17/09/2026, 10:30] Nova mensagem\nR$ 5.299'
  );
  assert.strictEqual(result.records.length, 0);
  assert.ok(result.ambiguities.some(a => a.field === 'model' && a.cause === 'required_field_missing'));
});

check('cores equivalentes sao canonizadas pelo schema', () => {
  const result = run(
    'apple-color-map',
    'iPhone 17 256GB Black Blue White Lacrado R$ 5.299'
  );
  assert.strictEqual(result.records.length, 3);
  assert.deepStrictEqual(result.records.map(r => r.fields.color).sort(), ['Azul', 'Branco', 'Preto']);
});

check('cores Apple proprias continuam distintas', () => {
  const result = run(
    'apple-color-distinct',
    'iPhone 17 256GB Jet Black Space Black Midnight Lacrado R$ 5.299'
  );
  assert.strictEqual(result.records.length, 3);
  assert.deepStrictEqual(
    result.records.map(r => r.fields.color).sort(),
    ['Jet Black', 'Midnight', 'Space Black']
  );
});

check('alias e canonico juntos nao duplicam oferta', () => {
  const result = run(
    'apple-color-dedupe',
    'iPhone 17 256GB Black Preto Lacrado R$ 5.299'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.color, 'Preto');
});

check('modelo resolve com emoji colado em iPhone', () => {
  const result = run(
    'apple-model-emoji-separator',
    'iPhone📱16 128gb Lacrado\nR$ 3.999'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_16_128gb');
  assert.strictEqual(result.records[0].fields.price, 3999);
});

check('modelo resolve com separador pipe antes da capacidade', () => {
  const result = run(
    'apple-model-pipe-separator',
    'iPhone 15 | 128gb Lacrado\nR$ 3.999'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_15_128gb');
});

check('modelo resolve com bullet antes da capacidade', () => {
  const result = run(
    'apple-model-bullet-separator',
    'iPhone 17 • 256GB Lacrado\nR$ 5.299'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_17_256gb');
});

check('familia Android encerra contexto de iPhone antes do preco', () => {
  const result = run(
    'apple-domain-boundary-android',
    'iPhone 17e 256GB\nBranco\nR$ 4.299\nPoco F8 Pro 5G 16/256GB\nBlue\nR$ 3.280'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_17e_256gb');
  assert.strictEqual(result.records[0].fields.price, 4299);
  assert.ok(result.segments.some(segment =>
    segment.context_events?.some(event => event.reason === 'domain_boundary')
  ));
});

check('MacBook encerra contexto de iPhone', () => {
  const result = run(
    'apple-domain-boundary-mac',
    'iPhone 17 256GB\nPreto\nR$ 5.299\nMacBook Air M4 16/256GB\nR$ 6.999'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_17_256gb');
  assert.strictEqual(result.records[0].fields.price, 5299);
});

check('condicoes plurais sao canonizadas para o legado sem hardcode no Core', () => {
  const cases = [
    ['Lacrados', 'Lacrado'],
    ['Novos', 'Novo'],
    ['Seminovos', 'Seminovo'],
    ['Usados', 'Usado']
  ];
  for (const [raw, expected] of cases) {
    const result = run(
      'apple-condition-' + raw.toLowerCase(),
      `iPhone 17 256GB Preto ${raw} R$ 5.299`
    );
    assert.strictEqual(result.records.length, 1);
    assert.strictEqual(result.records[0].fields.condition, expected);
  }
});

check('preco com emoji de dinheiro sem R$ e reconhecido', () => {
  const result = run(
    'apple-money-emoji',
    'iPhone 17 256GB Lacrado\nPreto 💰5.299🔥🔥'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_17_256gb');
  assert.strictEqual(result.records[0].fields.price, 5299);
});

check('preco com emoji de dinheiro e separador decimal e reconhecido', () => {
  const result = run(
    'apple-money-emoji-decimal',
    'iPhone 16 128GB Lacrado\nBranco 💵 3.999,90'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.price, 3999.9);
});

check('CPO vence lacrado quando ambos estao na mesma linha', () => {
  const result = run(
    'apple-cpo-same-line',
    'iPhone 17 256GB Preto lacrado importado CPO caixa branca R$ 5.299'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.condition, 'CPO');
  assert.strictEqual(result.records[0].fields.price, 5299);
});

check('sem valor preferencial, duas condicoes distintas continuam ambiguas', () => {
  const result = run(
    'apple-condition-ambiguity',
    'iPhone 17 256GB Preto Lacrado Seminovo R$ 5.299'
  );
  assert.strictEqual(result.records.length, 0);
  assert.ok(result.ambiguities.some(a =>
    a.field === 'condition' && a.cause === 'multiple_field_candidates'
  ));
});

check('condicoes plurais canonizam para o singular sem alterar preco', () => {
  const lacrados = run(
    'apple-condition-lacrados',
    'Lacrados\niPhone 17 256GB Preto R$ 5.299'
  );
  assert.strictEqual(lacrados.records.length, 1);
  assert.strictEqual(lacrados.records[0].fields.condition, 'Lacrado');
  assert.strictEqual(lacrados.records[0].fields.price, 5299);

  const seminovos = run(
    'apple-condition-seminovos',
    'Seminovos\niPhone 17 256GB Preto R$ 5.199'
  );
  assert.strictEqual(seminovos.records.length, 1);
  assert.strictEqual(seminovos.records[0].fields.condition, 'Seminovo');
  assert.strictEqual(seminovos.records[0].fields.price, 5199);
});

check('CPO no cabecalho do modelo prevalece na composicao da oferta', () => {
  const result = run(
    'apple-cpo-anchor-precedence',
    'iPhone 13 Pro 128GB (CPO)\nImportado | eSIM + Chip físico\nLacrado\nPreto | Gold | Branco\nR$ 3.999'
  );
  assert.strictEqual(result.records.length, 3);
  assert.ok(result.records.every(record => record.fields.condition === 'CPO'));
  assert.ok(result.records.every(record =>
    record.trace.some(trace =>
      trace.field === 'condition' &&
      trace.rules.includes('anchor_precedence:model')
    )
  ));
});

check('precedencia CPO do cabecalho nao vaza para o modelo seguinte', () => {
  const result = run(
    'apple-cpo-anchor-no-leak',
    'iPhone 13 Pro 128GB (CPO)\nLacrado\nPreto R$ 3.999\niPhone 15 128GB\nAzul R$ 4.499'
  );
  assert.strictEqual(result.records.length, 2);
  assert.strictEqual(result.records[0].fields.condition, 'CPO');
  assert.notStrictEqual(result.records[1].fields.condition, 'CPO');
});

check('CPO do anchor vence Lacrado direto dentro do mesmo modelo', () => {
  const result = run(
    'apple-cpo-anchor-over-direct',
    'iPhone 13 Pro 128GB (CPO)\nLacrado\nPreto R$ 3.999'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.condition, 'CPO');
  const trace = result.records[0].trace.find(item => item.field === 'condition');
  assert.ok(trace.rules.includes('anchor_precedence:model'));
});

check('pareamento ordinal casa primeira cor com primeiro preco e segunda com segundo', () => {
  const result = run(
    'apple-ordered-pairing',
    'iPhone 17 256GB Lacrado\nRoxo\nR$ 4.480\nGold\nR$ 4.520'
  );
  assert.strictEqual(result.records.length, 2);
  assert.deepStrictEqual(
    result.records.map(record => [record.fields.color, record.fields.price]),
    [['Roxo', 4480], ['Gold', 4520]]
  );
  assert.ok(result.records.every(record =>
    record.trace.some(trace => trace.field === 'color')
  ));
});

check('pareamento ordinal expande varias cores da mesma linha para o mesmo preco', () => {
  const result = run(
    'apple-ordered-pairing-multicolor',
    'iPhone 17 256GB Lacrado\nPreto Azul\nR$ 5.299'
  );
  assert.strictEqual(result.records.length, 2);
  assert.deepStrictEqual(result.records.map(r => r.fields.color).sort(), ['Azul', 'Preto']);
  assert.ok(result.records.every(r => r.fields.price === 5299));
});

check('contagens diferentes usam apenas o vizinho unico seguro', () => {
  const result = run(
    'apple-ordered-pairing-count-mismatch',
    'iPhone 17 256GB Lacrado\nPreto\nR$ 5.299\nR$ 5.399'
  );
  assert.strictEqual(result.records.length, 2);
  assert.strictEqual(result.records[0].fields.color, 'Preto');
  assert.strictEqual(result.records[0].fields.price, 5299);
  assert.strictEqual(result.records[1].fields.color, undefined);
  assert.strictEqual(result.records[1].fields.price, 5399);
});

check('fallback vizinho unico pareia cor quando contagens diferem', () => {
  const result = run(
    'apple-nearest-unique',
    'iPhone 17 256GB Lacrado\nPreto\nR$ 5.299\nOBS\nOBS\nR$ 5.499'
  );
  assert.strictEqual(result.records.length, 2);
  assert.strictEqual(result.records[0].fields.color, 'Preto');
  assert.strictEqual(result.records[0].fields.price, 5299);
  assert.strictEqual(result.records[1].fields.color, undefined);
});

check('fallback vizinho unico se abstem em empate de distancia', () => {
  const result = run(
    'apple-nearest-tie',
    'iPhone 17 256GB Lacrado\nR$ 5.199\nPreto\nR$ 5.299'
  );
  assert.strictEqual(result.records.length, 2);
  assert.ok(result.records.every(record => record.fields.color === undefined));
});

check('fallback vizinho unico se abstem quando distancia passa de tres linhas', () => {
  const result = run(
    'apple-nearest-too-far',
    'iPhone 17 256GB Lacrado\nPreto\nOBS 1\nOBS 2\nOBS 3\nR$ 5.299\nR$ 5.499'
  );
  assert.strictEqual(result.records.length, 2);
  assert.ok(result.records.every(record => record.fields.color === undefined));
});

check('catalogo real: Azul Profundo e Citrus entram como cores validas', () => {
  const azulProfundo = run(
    'apple-color-azul-profundo',
    'iPhone 17 256GB Azul Profundo Lacrado R$ 5.299'
  );
  assert.strictEqual(azulProfundo.records.length, 1);
  assert.strictEqual(azulProfundo.records[0].fields.color, 'Azul Profundo');

  const citrus = run(
    'apple-color-citrus',
    'iPhone 17 256GB Cítrus Lacrado R$ 5.299'
  );
  assert.strictEqual(citrus.records.length, 1);
  assert.strictEqual(citrus.records[0].fields.color, 'Cítrus');
});

check('catalogo real: Purple canoniza para Lilas', () => {
  const result = run(
    'apple-color-purple-catalog',
    'iPhone 17 256GB Purple Lacrado R$ 5.299'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.color, 'Lilás');
});

check('shadow Apple nunca habilita persistencia nem escrita de preco', () => {
  const result = run('apple-11', 'iPhone 16 256GB Azul Lacrado - 4.900');
  assert.ok(result.warnings.includes('no_persistence'));
  assert.ok(result.warnings.includes('no_operational_price_write'));
});


check('cabecalho abreviado sem token iPhone resolve modelo base', () => {
  const result = run(
    'apple-bare-header-base',
    '17 256GB Lacrado\nPreto R$ 5.299'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_17_256gb');
  assert.strictEqual(result.records[0].fields.capacity_gb, 256);
  assert.strictEqual(result.records[0].fields.price, 5299);
});

check('cabecalho abreviado Pro Max sem token iPhone e sem GB resolve', () => {
  const result = run(
    'apple-bare-header-pro-max',
    '16 Pro Max 256 CPO\nPreto R$ 4.999'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_16_pro_max_256gb');
  assert.strictEqual(result.records[0].fields.capacity_gb, 256);
  assert.strictEqual(result.records[0].fields.condition, 'CPO');
  assert.strictEqual(result.records[0].fields.price, 4999);
});

check('cabecalho compacto PM resolve via conhecimento de dominio', () => {
  const result = run(
    'apple-bare-header-pm',
    '16PM 256GB Seminovo\nAzul R$ 4.799'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_16_pro_max_256gb');
  assert.strictEqual(result.records[0].fields.capacity_gb, 256);
  assert.strictEqual(result.records[0].fields.condition, 'Seminovo');
  assert.strictEqual(result.records[0].fields.price, 4799);
});


check('modelo iPhone nao suportado quebra contexto anterior', () => {
  const result = run(
    'apple-context-boundary-unsupported-canonical',
    'iPhone 17 256GB Lacrado\nPreto R$ 5.299\niPhone 14 128GB\nR$ 3.999'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_17_256gb');
  assert.strictEqual(result.records[0].fields.price, 5299);
  const boundary = result.segments.find(segment =>
    segment.raw.includes('iPhone 14 128GB')
  );
  assert.ok(boundary.context_events.some(event => event.reason === 'domain_boundary'));
});

check('modelo abreviado nao suportado quebra contexto anterior', () => {
  const result = run(
    'apple-context-boundary-unsupported-bare',
    '17 256GB Lacrado\nPreto R$ 5.299\n14 128GB\nR$ 3.999'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.model.id, 'iphone_17_256gb');
  assert.strictEqual(result.records[0].fields.price, 5299);
  const boundary = result.segments.find(segment => segment.raw.trim() === '14 128GB');
  assert.ok(boundary.context_events.some(event => event.reason === 'domain_boundary'));
});

check('linha de preco colorida nao vira fronteira de modelo', () => {
  const result = run(
    'apple-context-boundary-no-false-positive',
    '17 256GB Lacrado\nPreto R$ 5.299'
  );
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.price, 5299);
  const priceSegment = result.segments.find(segment => segment.raw.includes('5.299'));
  assert.ok(!priceSegment.context_events.some(event => event.reason === 'domain_boundary'));
});


check('capacidade pode derivar de atributo da entidade modelo quando ausente', () => {
  const derivedSchema = JSON.parse(JSON.stringify(schema));
  const capacityField = derivedSchema.fields.find(field => field.name === 'capacity_gb');
  capacityField.extractors = [];

  const result = interpretResolved({
    document: {
      contract_version: 'raw-document/v1',
      document_id: 'apple-capacity-derived',
      content: 'iPhone 17 256GB Preto Lacrado - 7.300',
      source: { kind: 'plain_text' }
    },
    schema: derivedSchema,
    knowledge
  });

  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.capacity_gb, 256);
  const trace = result.records[0].trace.find(item => item.field === 'capacity_gb');
  assert.deepStrictEqual(trace.rules, ['entity_attribute:model.capacity_gb']);
});

check('capacidade direta tem precedencia sobre derivacao por entidade', () => {
  const directSchema = JSON.parse(JSON.stringify(schema));
  const capacityField = directSchema.fields.find(field => field.name === 'capacity_gb');
  capacityField.extractors = [{
    kind: 'regex',
    pattern: 'CAP=(128)',
    flags: 'i',
    group: 1,
    transform: 'integer',
    score: 0.99
  }];
  const priceField = directSchema.fields.find(field => field.name === 'price');
  priceField.extractors = [{
    kind: 'regex',
    pattern: 'PRICE=(7300)',
    flags: 'i',
    group: 1,
    transform: 'integer',
    score: 0.99
  }];

  const result = interpretResolved({
    document: {
      contract_version: 'raw-document/v1',
      document_id: 'apple-capacity-direct-precedence',
      content: 'iPhone 17 256GB Preto Lacrado PRICE=7300 CAP=128',
      source: { kind: 'plain_text' }
    },
    schema: directSchema,
    knowledge
  });

  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.capacity_gb, 128);
  const trace = result.records[0].trace.find(item => item.field === 'capacity_gb');
  assert.deepStrictEqual(trace.rules, ['direct_extraction']);
});


check('capacidade generica de pareamento adjacente recupera cor quando explicitamente habilitada', () => {
  const adjacentSchema = JSON.parse(JSON.stringify(schema));
  const colorField = adjacentSchema.fields.find(field => field.name === 'color');
  colorField.pair_by_order_with_trigger.adjacent_unique_before_trigger = { enabled: true, non_field_only_roles: ['product_header'], min_leftover_tokens: 2 };

  const result = interpretResolved({
    document: {
      contract_version: 'raw-document/v1',
      document_id: 'apple-adjacent-unique-color-with-text',
      content: 'iPhone 17 256GB Lacrado\nDisponível Preto\nR$ 5.299',
      source: { kind: 'plain_text' }
    },
    schema: adjacentSchema,
    knowledge
  });

  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.color, 'Preto');
  assert.strictEqual(result.records[0].fields.price, 5299);
  const trace = result.records[0].trace.find(item => item.field === 'color');
  assert.deepStrictEqual(trace.rules, ['pairing:adjacent_unique']);
});

check('pareamento adjacente habilitado nao pula linha intermediaria', () => {
  const adjacentSchema = JSON.parse(JSON.stringify(schema));
  const colorField = adjacentSchema.fields.find(field => field.name === 'color');
  colorField.pair_by_order_with_trigger.adjacent_unique_before_trigger = { enabled: true, non_field_only_roles: ['product_header'], min_leftover_tokens: 2 };

  const result = interpretResolved({
    document: {
      contract_version: 'raw-document/v1',
      document_id: 'apple-adjacent-unique-color-does-not-skip',
      content: 'iPhone 17 256GB Lacrado\nDisponível Preto\nOBSERVAÇÃO\nR$ 5.299',
      source: { kind: 'plain_text' }
    },
    schema: adjacentSchema,
    knowledge
  });

  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].fields.color, undefined);
  assert.strictEqual(result.records[0].fields.price, 5299);
});

console.log(`PASSOU: ${ok} assercoes Apple`);
