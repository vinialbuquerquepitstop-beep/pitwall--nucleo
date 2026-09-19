'use strict';

const assert = require('assert');
const {
  applyHumanReview
} = require('../../external-calc-c01/v1/c01-readonly-bridge');
const {
  CONTRACT_VERSION,
  allocateFreight,
  calculateC02
} = require('./c02-calculator');

let ok = 0;

function check(name, fn) {
  try {
    fn();
    ok += 1;
    console.log(`OK ${ok} - ${name}`);
  } catch (error) {
    console.error(`FALHOU - ${name}`);
    throw error;
  }
}

function c01ReviewCandidate(priceMinor = 400000) {
  const candidate = {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_calc_001',
    source_id: 'src_calc_001',
    offer_id: 'off_calc_001',
    offer_revision: 1,
    stage: 'REVIEW',
    execution_status: 'SUCCEEDED',
    domain_outcome: 'REVIEW_REQUIRED',
    freshness_status: 'CURRENT',
    interpretation_run_id: 'int_calc_001',
    interpretation_engine_version: 'interpreter-core/test',
    interpretation_confidence: { overall: 0.98, by_field: {}, record_state: 'resolved' },
    offer_identity_fingerprint: 'identity-v1',
    offer_value_fingerprint: 'value-v1',
    interpreted_offer: {
      supplier_id: 'SUP_TESTE',
      model: { id: 'iphone-17-256', label: 'iPhone 17 256GB', attributes: {} },
      capacity_gb: 256,
      condition: 'LACRADO',
      color: 'PRETO',
      price: { amount_minor: priceMinor, currency: 'BRL' }
    },
    reviewed_offer: null,
    review: null,
    provenance_refs: [
      'interpretation_run:int_calc_001',
      'interpreter_record:rec_calc_001'
    ],
    trace: []
  };

  return applyHumanReview(candidate, {
    decision: 'ACCEPT',
    reviewer_ref: 'fixture-reviewer',
    reviewed_at: '2026-09-19T18:00:00.000Z'
  });
}

function profile(overrides = {}) {
  return {
    profile_id: 'pitwall-parity-fixture',
    profile_version: '1',
    currency: 'BRL',
    cash_margin_minor: 55000,
    installment_margin_minor: 65000,
    freight_minor: 10000,
    freight_mode: 'SPLIT',
    installment_base_addon_minor: 10000,
    entry_minor: 50000,
    installment_coefficients: {
      12: 1.1,
      18: 1.2
    },
    ...overrides
  };
}

function calculate(candidate = c01ReviewCandidate(), profileOverride = {}) {
  return calculateC02({
    calculation_run_id: 'calc_run_001',
    c01_candidate: candidate,
    calculation_profile: profile(profileOverride)
  });
}

check('frete dividido preserva a semantica da calculadora viva', () => {
  assert.deepStrictEqual(allocateFreight(10000, 'SPLIT'), {
    store_freight_minor: 5000,
    customer_freight_minor: 5000
  });
});

check('C02 consome somente oferta C01 revisada e valida', () => {
  const result = calculate();
  assert.strictEqual(result.contract_version, CONTRACT_VERSION);
  assert.strictEqual(result.contract_id, 'C02');
  assert.strictEqual(result.offer_revision, 1);
  assert.strictEqual(result.execution_status, 'SUCCEEDED');
  assert.strictEqual(result.freshness_status, 'CURRENT');
});

check('preco a vista preserva a matematica viva', () => {
  const result = calculate();
  assert.deepStrictEqual(result.supplier_offer_price, {
    amount_minor: 400000,
    currency: 'BRL'
  });
  assert.deepStrictEqual(result.store_cost, {
    amount_minor: 405000,
    currency: 'BRL'
  });
  assert.deepStrictEqual(result.normal_sale_price, {
    amount_minor: 465000,
    currency: 'BRL'
  });
});

check('base parcelada preserva a matematica viva', () => {
  const result = calculate();
  assert.deepStrictEqual(result.installment_base_price, {
    amount_minor: 475000,
    currency: 'BRL'
  });
  assert.deepStrictEqual(result.entry, {
    amount_minor: 50000,
    currency: 'BRL'
  });
  assert.deepStrictEqual(result.financed_balance, {
    amount_minor: 425000,
    currency: 'BRL'
  });
});

check('12x e 18x reproduzem base mais acrescimo e coeficiente', () => {
  const result = calculate();
  assert.strictEqual(result.installments.length, 2);

  assert.deepStrictEqual(result.installments[0], {
    count: 12,
    coefficient: 1.1,
    base_price: { amount_minor: 425000, currency: 'BRL' },
    charged_base: { amount_minor: 435000, currency: 'BRL' },
    total_price: { amount_minor: 478500, currency: 'BRL' },
    installment_price: { amount_minor: 39875, currency: 'BRL' },
    finance_delta: { amount_minor: 43500, currency: 'BRL' }
  });

  assert.deepStrictEqual(result.installments[1], {
    count: 18,
    coefficient: 1.2,
    base_price: { amount_minor: 425000, currency: 'BRL' },
    charged_base: { amount_minor: 435000, currency: 'BRL' },
    total_price: { amount_minor: 522000, currency: 'BRL' },
    installment_price: { amount_minor: 29000, currency: 'BRL' },
    finance_delta: { amount_minor: 87000, currency: 'BRL' }
  });
});

check('margem C02 e o valor configurado sobre custo, sem dupla subtracao de frete', () => {
  const result = calculate();
  assert.deepStrictEqual(result.estimated_margin, {
    amount_minor: 55000,
    currency: 'BRL'
  });
  assert.strictEqual(result.estimated_margin_percent, 11.828);
});

check('frete STORE nao reduz novamente a margem configurada', () => {
  const result = calculate(c01ReviewCandidate(), {
    freight_mode: 'STORE',
    entry_minor: 0
  });
  assert.strictEqual(result.normal_sale_price.amount_minor, 465000);
  assert.strictEqual(result.estimated_margin.amount_minor, 55000);
});

check('frete CUSTOMER mantem o mesmo preco final com margem constante', () => {
  const result = calculate(c01ReviewCandidate(), {
    freight_mode: 'CUSTOMER',
    entry_minor: 0
  });
  assert.strictEqual(result.store_cost.amount_minor, 400000);
  assert.strictEqual(result.normal_sale_price.amount_minor, 465000);
  assert.strictEqual(result.estimated_margin.amount_minor, 55000);
});

check('entrada que cobre a base parcelada zera saldo e nao cria parcelas', () => {
  const result = calculate(c01ReviewCandidate(), {
    entry_minor: 999999
  });
  assert.strictEqual(result.entry.amount_minor, 475000);
  assert.strictEqual(result.financed_balance.amount_minor, 0);
  assert.deepStrictEqual(result.installments, []);
});

check('C02 recusa C01 ainda aguardando revisao', () => {
  const candidate = c01ReviewCandidate();
  candidate.domain_outcome = 'REVIEW_REQUIRED';
  assert.throws(() => calculate(candidate), /C01 precisa estar VALID/);
});

check('C02 recusa output C01 stale', () => {
  const candidate = c01ReviewCandidate();
  candidate.freshness_status = 'STALE';
  assert.throws(() => calculate(candidate), /C01 precisa estar CURRENT/);
});

check('C02 recusa perfil com moeda diferente da oferta', () => {
  assert.throws(
    () => calculate(c01ReviewCandidate(), { currency: 'USD' }),
    /currency difere/
  );
});

check('margem ausente nao recebe default financeiro silencioso', () => {
  const p = profile();
  delete p.cash_margin_minor;
  assert.throws(
    () => calculateC02({
      calculation_run_id: 'calc_run_missing_margin',
      c01_candidate: c01ReviewCandidate(),
      calculation_profile: p
    }),
    /cash_margin_minor/
  );
});

check('promocao nao e inventada sem politica autoritativa', () => {
  const result = calculate();
  assert.strictEqual(result.promo_price, null);
  assert.strictEqual(result.promotion_floor, null);
  assert.strictEqual(result.promotion_range, null);
});

check('revisao material de preco em C01 alimenta nova revisao no C02', () => {
  const base = {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_calc_edit',
    source_id: 'src_calc_edit',
    offer_id: 'off_calc_edit',
    offer_revision: 1,
    stage: 'REVIEW',
    execution_status: 'SUCCEEDED',
    domain_outcome: 'REVIEW_REQUIRED',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-edit',
    offer_value_fingerprint: 'value-edit',
    interpreted_offer: {
      supplier_id: 'SUP_TESTE',
      model: { id: 'iphone-17-256', label: 'iPhone 17 256GB', attributes: {} },
      capacity_gb: 256,
      condition: 'LACRADO',
      color: 'PRETO',
      price: { amount_minor: 400000, currency: 'BRL' }
    },
    reviewed_offer: null,
    review: null,
    provenance_refs: [],
    trace: []
  };

  const edited = applyHumanReview(base, {
    decision: 'EDIT',
    reviewer_ref: 'fixture-reviewer',
    reviewed_at: '2026-09-19T18:01:00.000Z',
    patch: {
      price: { amount_minor: 390000, currency: 'BRL' }
    }
  });

  const result = calculateC02({
    calculation_run_id: 'calc_run_edit',
    c01_candidate: edited,
    calculation_profile: profile({ entry_minor: 0 })
  });

  assert.strictEqual(edited.offer_revision, 2);
  assert.strictEqual(result.offer_revision, 2);
  assert.strictEqual(result.supplier_offer_price.amount_minor, 390000);
  assert.strictEqual(result.normal_sale_price.amount_minor, 455000);
});

check('fingerprint e output sao deterministas para o mesmo input', () => {
  const a = calculate();
  const b = calculate();
  assert.strictEqual(a.calculation_input_fingerprint, b.calculation_input_fingerprint);
  assert.strictEqual(a.output_fingerprint, b.output_fingerprint);
});

check('C02 nao altera a oferta C01 recebida', () => {
  const candidate = c01ReviewCandidate();
  const before = JSON.stringify(candidate);
  calculate(candidate);
  assert.strictEqual(JSON.stringify(candidate), before);
});

console.log(`C02_FIXTURES=PASS checks=${ok}`);
