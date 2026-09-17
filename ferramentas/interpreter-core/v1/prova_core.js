'use strict';

const assert = require('assert');
const {
  normalizeLine,
  scoreRoles,
  segmentDocument,
  interpretStructural
} = require('./core');

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

check('normaliza espacos sem destruir texto', () => {
  assert.strictEqual(normalizeLine('  IPHONE   16  PRO  '), 'IPHONE 16 PRO');
});

check('linha monetaria vira candidata a price_line', () => {
  assert.strictEqual(scoreRoles('R$ 4.299')[0].role, 'price_line');
});

check('numero isolado pode ser price_line, ainda sem semantica', () => {
  assert.strictEqual(scoreRoles('4299')[0].role, 'price_line');
});

check('condicao e detectada como sinal estrutural', () => {
  assert.ok(scoreRoles('Lacrado CPO').some(x => x.role === 'condition'));
});

check('linha produto curta alfanumerica gera product_header candidato', () => {
  assert.ok(scoreRoles('iPhone 16 Pro Max 256GB').some(x => x.role === 'product_header'));
});

check('link de grupo gera note', () => {
  assert.strictEqual(scoreRoles('https://chat.whatsapp.com/abc')[0].role, 'note');
});

check('simbolos puros viram noise', () => {
  assert.strictEqual(scoreRoles('🚨🚨🚨')[0].role, 'noise');
});

check('segmentacao preserva raw e numero da linha', () => {
  const segments = segmentDocument({
    contract_version: 'raw-document/v1',
    document_id: 'fixture-1',
    content: 'IPHONE 16\n256GB\nBLACK\nR$ 4299',
    source: { kind: 'plain_text' }
  });
  assert.strictEqual(segments.length, 4);
  assert.strictEqual(segments[0].raw, 'IPHONE 16');
  assert.strictEqual(segments[3].line_number, 4);
});

check('core devolve InterpretationBundle estrutural sem registros semanticos', () => {
  const result = interpretStructural({
    document: {
      contract_version: 'raw-document/v1',
      document_id: 'fixture-2',
      content: 'TABELA NOVA\niPhone 16 Pro Max 256GB\nR$ 6999',
      source: { kind: 'plain_text' }
    },
    schema: {
      contract_version: 'domain-schema/v1',
      schema_id: 'apple-electronics',
      schema_version: '1',
      entity_type: 'product_offer',
      fields: []
    },
    knowledge: {
      contract_version: 'knowledge-snapshot/v1',
      snapshot_id: 'empty',
      version: '0',
      entities: [], aliases: [], semantic_rules: [], supplier_profiles: []
    }
  });
  assert.strictEqual(result.contract_version, 'interpretation-bundle/v1');
  assert.strictEqual(result.records.length, 0);
  assert.ok(result.warnings.includes('shadow_mode_structural_only'));
  assert.strictEqual(result.metrics.n_lines, 3);
});

console.log(`PASSOU: ${ok} assercoes`);
