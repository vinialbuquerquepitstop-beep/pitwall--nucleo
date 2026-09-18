'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  normalizeLine,
  scoreRoles,
  segmentDocument,
  extractFieldCandidates,
  buildContextTrace,
  interpretStructural,
  interpretContextual,
  interpretResolved
} = require('./core');

const genericSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'generic-device-domain.json'), 'utf8')
);
const genericKnowledge = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'generic-device-knowledge.json'), 'utf8')
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

function raw(documentId, content) {
  return {
    contract_version: 'raw-document/v1',
    document_id: documentId,
    content,
    source: { kind: 'plain_text' }
  };
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
  const segments = segmentDocument(raw('fixture-1', 'IPHONE 16\n256GB\nBLACK\nR$ 4299'));
  assert.strictEqual(segments.length, 4);
  assert.strictEqual(segments[0].raw, 'IPHONE 16');
  assert.strictEqual(segments[3].line_number, 4);
});

check('core devolve InterpretationBundle estrutural sem registros semanticos', () => {
  const result = interpretStructural({
    document: raw('fixture-2', 'TABELA NOVA\niPhone 16 Pro Max 256GB\nR$ 6999'),
    schema: genericSchema,
    knowledge: { contract_version: 'knowledge-snapshot/v1', snapshot_id: 'empty', version: '0', entities: [], aliases: [], semantic_rules: [], supplier_profiles: [] }
  });
  assert.strictEqual(result.contract_version, 'interpretation-bundle/v1');
  assert.strictEqual(result.records.length, 0);
  assert.ok(result.warnings.includes('shadow_mode_structural_only'));
  assert.strictEqual(result.metrics.n_lines, 3);
});

check('schema extrai modelo sem o Core conhecer o dominio', () => {
  const segment = segmentDocument(raw('fixture-3', 'DEVICE ALPHA16'))[0];
  const candidates = extractFieldCandidates(segment, genericSchema);
  assert.deepStrictEqual(candidates.map(c => [c.field, c.value]), [['model', 'ALPHA16']]);
});

check('capacidade abre contexto e e herdada pela linha seguinte', () => {
  const segments = buildContextTrace(segmentDocument(raw('fixture-4', 'DEVICE ALPHA16\n256GB\n6999')), genericSchema);
  assert.strictEqual(segments[0].context_after.model.value, 'ALPHA16');
  assert.strictEqual(segments[1].context_after.capacity.value, 256);
  assert.strictEqual(segments[2].inherited_context.model.value, 'ALPHA16');
  assert.strictEqual(segments[2].inherited_context.capacity.value, 256);
});

check('novo anchor de modelo limpa contexto dependente anterior', () => {
  const segments = buildContextTrace(segmentDocument(raw('fixture-5', 'DEVICE ALPHA16\n256GB\n6999\nDEVICE BETA20\n7999')), genericSchema);
  assert.strictEqual(segments[3].context_after.model.value, 'BETA20');
  assert.strictEqual(segments[3].context_after.capacity, undefined);
  assert.strictEqual(segments[4].inherited_context.model.value, 'BETA20');
  assert.strictEqual(segments[4].inherited_context.capacity, undefined);
});

check('schema pode preservar campo declarado ao abrir novo anchor', () => {
  const schema = JSON.parse(JSON.stringify(genericSchema));
  schema.context_policy = {
    ...(schema.context_policy || {}),
    preserve_on_anchor: ['capacity']
  };
  const segments = buildContextTrace(
    segmentDocument(raw('fixture-preserve', 'DEVICE ALPHA16\n256GB\n6999\nDEVICE BETA20\n7999')),
    schema
  );
  assert.strictEqual(segments[3].context_after.model.value, 'BETA20');
  assert.strictEqual(segments[3].context_after.capacity.value, 256);
  assert.strictEqual(segments[4].inherited_context.capacity.value, 256);
  assert.ok(
    segments[3].context_events.some(
      e => e.type === 'reset' &&
           e.reason === 'new_context_anchor' &&
           e.preserved_fields.includes('capacity')
    )
  );
});

check('timestamp zera contexto para impedir vazamento entre mensagens', () => {
  const segments = buildContextTrace(segmentDocument(raw('fixture-6', 'DEVICE ALPHA16\n256GB\n[17/09/2026, 10:30] Outro bloco\n6999')), genericSchema);
  assert.deepStrictEqual(segments[2].context_after, {});
  assert.deepStrictEqual(segments[3].inherited_context, {});
  assert.ok(segments[2].context_events.some(e => e.type === 'reset' && e.reason === 'timestamp_boundary'));
});

check('origem da heranca fica rastreavel por linha', () => {
  const result = interpretContextual({ document: raw('fixture-7', 'DEVICE ALPHA16\n256GB\n6999'), schema: genericSchema, knowledge: genericKnowledge });
  const priceLine = result.segments[2];
  assert.strictEqual(priceLine.inherited_context.model.source_line, 1);
  assert.strictEqual(priceLine.inherited_context.capacity.source_line, 2);
  assert.ok(result.warnings.includes('shadow_mode_context_only'));
  assert.ok(result.warnings.includes('no_persistence'));
});

check('resolver cria registro quando label canonico esta no snapshot', () => {
  const result = interpretResolved({ document: raw('fixture-8', 'DEVICE ALPHA16\n256GB\n6999'), schema: genericSchema, knowledge: genericKnowledge });
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].state, 'interpreted');
  assert.strictEqual(result.records[0].fields.model.id, 'model-alpha16');
  assert.strictEqual(result.records[0].fields.capacity, 256);
  assert.strictEqual(result.records[0].fields.price, 6999);
  assert.ok(result.warnings.includes('shadow_mode_resolver'));
});

check('alias conhecido resolve entidade e marca registro como inferred', () => {
  const aliasSchema = JSON.parse(JSON.stringify(genericSchema));
  aliasSchema.fields.find(f => f.name === 'model').extractors[0].pattern = '^DEVICE\\s+([A-Z][A-Z0-9]+)$';
  const result = interpretResolved({ document: raw('fixture-9', 'DEVICE A16\n128GB\n5999'), schema: aliasSchema, knowledge: genericKnowledge });
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].state, 'inferred');
  assert.strictEqual(result.records[0].fields.model.id, 'model-alpha16');
  assert.ok(result.records[0].trace.some(t => t.field === 'model' && t.rules.includes('resolver:alias')));
});

check('entidade desconhecida nao vira registro e gera proposta de aprendizado', () => {
  const result = interpretResolved({ document: raw('fixture-10', 'DEVICE GAMMA30\n256GB\n8999'), schema: genericSchema, knowledge: genericKnowledge });
  assert.strictEqual(result.records.length, 0);
  assert.ok(result.ambiguities.some(a => a.field === 'model' && a.cause === 'entity_unresolved'));
  assert.ok(result.learning_proposals.some(p => p.kind === 'local_resolution' && p.payload.raw === 'GAMMA30'));
});

check('alias conflitante bloqueia o registro em vez de escolher silenciosamente', () => {
  const knowledge = JSON.parse(JSON.stringify(genericKnowledge));
  knowledge.aliases.push({ kind: 'model', text: 'A16', target_id: 'model-beta20' });
  const aliasSchema = JSON.parse(JSON.stringify(genericSchema));
  aliasSchema.fields.find(f => f.name === 'model').extractors[0].pattern = '^DEVICE\\s+([A-Z][A-Z0-9]+)$';
  const result = interpretResolved({ document: raw('fixture-11', 'DEVICE A16\n128GB\n5999'), schema: aliasSchema, knowledge });
  assert.strictEqual(result.records.length, 0);
  assert.ok(result.ambiguities.some(a => a.field === 'model' && a.cause === 'entity_resolution_ambiguous'));
});

check('novo anchor nao deixa capacidade antiga contaminar registro seguinte', () => {
  const result = interpretResolved({ document: raw('fixture-12', 'DEVICE ALPHA16\n256GB\n6999\nDEVICE BETA20\n7999'), schema: genericSchema, knowledge: genericKnowledge });
  assert.strictEqual(result.records.length, 2);
  assert.strictEqual(result.records[0].fields.capacity, 256);
  assert.strictEqual(result.records[1].fields.capacity, undefined);
  assert.strictEqual(result.records[1].fields.model.id, 'model-beta20');
});


check('boundary configurada pode ceder ao anchor valido', () => {
  const schema = JSON.parse(JSON.stringify(genericSchema));
  schema.context_policy = {
    ...(schema.context_policy || {}),
    preserve_on_anchor: ['capacity']
  };
  schema.fields.push({
    name: '_product_boundary',
    type: 'string',
    required: false,
    context_inheritable: false,
    context_anchor: false,
    context_boundary: true,
    skip_if_anchor_present: true,
    extractors: [{
      kind: 'regex',
      pattern: '^DEVICE\\s+',
      flags: 'i',
      group: 0,
      transform: 'trim',
      score: 1
    }]
  });

  const segments = buildContextTrace(
    segmentDocument(raw('fixture-boundary-anchor', '256GB\nDEVICE ALPHA16\n6999')),
    schema
  );

  assert.ok(!segments[1].context_events.some(e => e.reason === 'domain_boundary'));
  assert.strictEqual(segments[1].context_after.model.value, 'ALPHA16');
  assert.strictEqual(segments[1].context_after.capacity.value, 256);
  assert.strictEqual(segments[2].inherited_context.capacity.value, 256);
});


check('boundary pode preservar campos declarados', () => {
  const schema = JSON.parse(JSON.stringify(genericSchema));
  schema.fields.push({
    name: '_section_boundary',
    type: 'string',
    required: false,
    context_inheritable: false,
    context_anchor: false,
    context_boundary: true,
    preserve_fields: ['capacity'],
    extractors: [{
      kind: 'regex',
      pattern: '^SECTION
      group: 0,
      transform: 'trim',
      score: 1
    }]
  });

  const segments = buildContextTrace(
    segmentDocument(raw('fixture-boundary-preserve', '256GB\nSECTION\n6999')),
    schema
  );

  assert.ok(segments[1].context_events.some(e => e.reason === 'domain_boundary'));
  assert.deepStrictEqual(segments[1].context_events[0].preserved_fields, ['capacity']);
  assert.strictEqual(segments[1].context_after.capacity.value, 256);
  assert.strictEqual(segments[2].inherited_context.capacity.value, 256);
});

console.log(`PASSOU: ${ok} assercoes`);
,
      flags: 'i',
      group: 0,
      transform: 'trim',
      score: 1
    }]
  });

  const segments = buildContextTrace(
    segmentDocument(raw('fixture-boundary-preserve', '256GB\nSECTION\n6999')),
    schema
  );

  assert.ok(segments[1].context_events.some(e => e.reason === 'domain_boundary'));
  assert.deepStrictEqual(segments[1].context_events[0].preserved_fields, ['capacity']);
  assert.strictEqual(segments[1].context_after.capacity.value, 256);
  assert.strictEqual(segments[2].inherited_context.capacity.value, 256);
});

console.log(`PASSOU: ${ok} assercoes`);
