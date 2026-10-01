'use strict';

const assert = require('assert');
const {
  CONTRACT_VERSION,
  createListAdvisorService,
  assertCandidateOutput
} = require('./list-advisor');

let checks = 0;
function check(name, fn) {
  Promise.resolve().then(fn).then(() => {
    checks += 1;
    console.log('OK ' + checks + ' - ' + name);
  }).catch(error => {
    console.error('FALHOU - ' + name);
    console.error(error);
    process.exitCode = 1;
  });
}

const supplier = {
  supplier_id: '7cbb126f-0499-44af-8d0b-55c4547ff701',
  name: 'Fornecedor Teste',
  ai_context: 'Usa PM para Pro Max. Manter Anatel como variante distinta.'
};

function serviceWith(candidate, capture, c01Sink = null) {
  return createListAdvisorService({
    supplierSource: { async load(id) { assert.strictEqual(id, supplier.supplier_id); return supplier; } },
    provider: { async interpret(request) { capture?.(request); return candidate; } },
    c01Sink
  });
}

const baseCandidate = {
  offers: [{
    model: 'iPhone 17 Pro',
    capacity_gb: 256,
    color: 'Blue',
    condition: 'LACRADO',
    variant: 'Anatel',
    price_amount_minor: 690000,
    currency: 'BRL',
    confidence: 0.98,
    source_excerpt: 'Blue Anatel $ 6.900'
  }],
  ambiguities: []
};

check('fornecedor e contexto entram como apoio, nunca autoridade', async () => {
  let seen = null;
  const result = await serviceWith(baseCandidate, request => { seen = request; }).interpret({
    supplier_id: supplier.supplier_id,
    filename: 'lista.txt',
    content: '17 pro 256gb\nBlue Anatel $ 6.900'
  });
  assert.strictEqual(result.contract_version, CONTRACT_VERSION);
  assert.strictEqual(result.offers[0].variant, 'Anatel');
  assert.strictEqual(seen.supplier_context.ai_context, supplier.ai_context);
  assert.strictEqual(seen.guardrails.supplier_context_is_advisory, true);
  assert.strictEqual(seen.guardrails.may_invent_values, false);
  assert.strictEqual(seen.guardrails.may_correct_suspicious_prices, false);
});

check('preço suspeito pode permanecer literal e virar ambiguidade', async () => {
  const candidate = {
    offers: [{
      model: 'iPhone 15 Pro',
      capacity_gb: 256,
      color: 'PRETO',
      condition: null,
      variant: null,
      price_amount_minor: 3355000,
      currency: 'BRL',
      confidence: 0.55,
      source_excerpt: 'PRETO : R$3.3550,00'
    }],
    ambiguities: [{
      field: 'price',
      source_excerpt: 'PRETO : R$3.3550,00',
      reason: 'Formato de preço parece atípico; não corrigir silenciosamente.'
    }]
  };
  const result = await serviceWith(candidate).interpret({
    supplier_id: supplier.supplier_id,
    content: '15 PRO 256GB\nPRETO : R$3.3550,00'
  });
  assert.strictEqual(result.offers[0].price_amount_minor, 3355000);
  assert.strictEqual(result.ambiguities.length, 1);
});

check('ambiguidade entre cores e capacidades pode ser preservada', async () => {
  const candidate = {
    offers: [
      { model:'iPhone 12',capacity_gb:64,color:null,condition:'GRADE A',variant:null,price_amount_minor:135000,currency:'BRL',confidence:.88,source_excerpt:'12 | 64gb | 128g - 🟦🟪🟩⬛️ *1.350/ 1450*' },
      { model:'iPhone 12',capacity_gb:128,color:null,condition:'GRADE A',variant:null,price_amount_minor:145000,currency:'BRL',confidence:.88,source_excerpt:'12 | 64gb | 128g - 🟦🟪🟩⬛️ *1.350/ 1450*' }
    ],
    ambiguities: [{
      field:'color_assignment',
      source_excerpt:'12 | 64gb | 128g - 🟦🟪🟩⬛️ *1.350/ 1450*',
      reason:'A linha não informa quais cores pertencem a cada capacidade.'
    }]
  };
  const result = await serviceWith(candidate).interpret({
    supplier_id: supplier.supplier_id,
    content: '12 | 64gb | 128g - 🟦🟪🟩⬛️ *1.350/ 1450*'
  });
  assert.strictEqual(result.offers.length, 2);
  assert.strictEqual(result.offers[0].color, null);
  assert.strictEqual(result.ambiguities[0].field, 'color_assignment');
});


check('interpretação pode seguir direto para persistência C01', async () => {
  let persisted = null;
  const sink = {
    async persist(payload) {
      persisted = payload;
      return {
        analysis_id: payload.analysis_id,
        source_id: payload.source_id,
        candidates: 1,
        auto_promoted: 1,
        review_required: 0,
        persisted: 1,
        idempotent: 0,
        unresolved_ambiguities: 0
      };
    }
  };
  const result = await serviceWith(baseCandidate, null, sink).interpret({
    supplier_id: supplier.supplier_id,
    content: '17 pro 256gb\nBlue Anatel $ 6.900'
  });
  assert(persisted);
  assert.strictEqual(persisted.supplier_id, supplier.supplier_id);
  assert.strictEqual(result.c01.auto_promoted, 1);
  assert(result.analysis_id.startsWith('analysis_'));
  assert(result.source_id.startsWith('source_'));
});

check('validator rejeita campo inventado fora do contrato', () => {
  assert.throws(() => assertCandidateOutput({
    offers: [{ ...baseCandidate.offers[0], magical_fix: true }],
    ambiguities: []
  }), /campo nao permitido/);
});

process.on('beforeExit', () => {
  if (!process.exitCode) {
    assert.strictEqual(checks, 5);
    console.log('EXTERNAL_CALC_LIST_ADVISOR_V0=PASS checks=' + checks);
  }
});
