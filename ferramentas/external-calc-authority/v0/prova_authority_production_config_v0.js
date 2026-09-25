'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildCalculationProfileFromCalcDados
} = require('./calc-dados-calculation-profile');
const { authorityServerConfig } = require('../../external-calc-runtime/v0/runtime');
const {
  calculateC02
} = require('../../external-calc-c02/v1/c02-calculator');

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

const LIVE_CONFIG_SNAPSHOT = {
  atualizado_em: '2026-08-17T23:20:02.384365+00:00',
  dados: {
    config: {
      pb: 100,
      margens: {
        iPhone: { av: 550, pc: 650 }
      },
      taxas: {
        2: 1.05031,
        3: 1.05698,
        4: 1.0636,
        5: 1.07043,
        6: 1.07726,
        7: 1.07863,
        8: 1.08542,
        9: 1.09217,
        10: 1.099,
        11: 1.10609,
        12: 1.11284,
        13: 1.14117,
        14: 1.14836,
        15: 1.15568,
        16: 1.16292,
        17: 1.17028,
        18: 1.17758
      }
    }
  }
};

function profile() {
  return buildCalculationProfileFromCalcDados({
    category: 'iPhone',
    dados: LIVE_CONFIG_SNAPSHOT.dados,
    updated_at: LIVE_CONFIG_SNAPSHOT.atualizado_em
  });
}

function c01(priceMinor) {
  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_prod_config',
    source_id: 'src_prod_config',
    offer_id: 'off_prod_config',
    offer_revision: 1,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-prod-config',
    offer_value_fingerprint: `value-prod-config-${priceMinor}`,
    reviewed_offer: {
      supplier_id: 'SUP_CONFIG',
      model: { id: 'iphone-config', label: 'iPhone', attributes: {} },
      capacity_gb: 256,
      condition: 'LACRADO',
      color: 'PRETO',
      price: { amount_minor: priceMinor, currency: 'BRL' }
    },
    provenance_refs: ['prod-config:calc_dados']
  };
}

function r2(value) {
  return Math.round(value * 100) / 100;
}

function legacyLiveCalculation(costMajor, count) {
  const config = LIVE_CONFIG_SNAPSHOT.dados.config;
  const cash = r2(costMajor + config.margens.iPhone.av);
  const installmentBase = r2(costMajor + config.margens.iPhone.pc);
  const chargedBase = r2(installmentBase + config.pb);
  const total = r2(chargedBase * config.taxas[count]);
  const installment = r2(total / count);
  return { cash, installmentBase, chargedBase, total, installment };
}

function c02For(costMajor) {
  return calculateC02({
    calculation_run_id: `calc_prod_${costMajor}`,
    c01_candidate: c01(Math.round(costMajor * 100)),
    calculation_profile: profile()
  });
}

check('snapshot atual mapeia margens e pb para minor units', () => {
  const p = profile();
  assert.strictEqual(p.profile_id, 'pitwall-calc-dados:iPhone');
  assert.strictEqual(p.profile_version, LIVE_CONFIG_SNAPSHOT.atualizado_em);
  assert.strictEqual(p.cash_margin_minor, 55000);
  assert.strictEqual(p.installment_margin_minor, 65000);
  assert.strictEqual(p.installment_base_addon_minor, 10000);
  assert.strictEqual(p.freight_minor, 0);
  assert.strictEqual(p.entry_minor, 0);
  assert.strictEqual(p.freight_mode, 'STORE');
});

check('snapshot atual preserva os 17 coeficientes 2x-18x', () => {
  const p = profile();
  assert.strictEqual(Object.keys(p.installment_coefficients).length, 17);
  for (let count = 2; count <= 18; count += 1) {
    assert.strictEqual(
      p.installment_coefficients[count],
      LIVE_CONFIG_SNAPSHOT.dados.config.taxas[count]
    );
  }
});

check('preco a vista C02 = matematica viva para custos representativos', () => {
  for (const costMajor of [1900, 2550, 4000, 5400, 6500]) {
    const live = legacyLiveCalculation(costMajor, 12);
    const c02 = c02For(costMajor);
    assert.strictEqual(c02.normal_sale_price.amount_minor, Math.round(live.cash * 100));
    assert.strictEqual(c02.installment_base_price.amount_minor, Math.round(live.installmentBase * 100));
  }
});

check('parcelamento C02 = PB + TX da calculadora viva em todos os prazos', () => {
  const costMajor = 4000;
  const result = c02For(costMajor);

  for (const item of result.installments) {
    const live = legacyLiveCalculation(costMajor, item.count);
    assert.strictEqual(item.charged_base.amount_minor, Math.round(live.chargedBase * 100));
    assert.strictEqual(item.total_price.amount_minor, Math.round(live.total * 100));
    assert.strictEqual(item.installment_price.amount_minor, Math.round(live.installment * 100));
  }
});

check('config sem margem iPhone falha sem default silencioso', () => {
  assert.throws(
    () => buildCalculationProfileFromCalcDados({
      category: 'iPhone',
      updated_at: LIVE_CONFIG_SNAPSHOT.atualizado_em,
      dados: {
        config: {
          pb: 100,
          margens: {},
          taxas: LIVE_CONFIG_SNAPSHOT.dados.config.taxas
        }
      }
    }),
    /margens\[iPhone\] ausente/
  );
});

check('config sem pb falha sem duplicar o antigo +100', () => {
  const dados = JSON.parse(JSON.stringify(LIVE_CONFIG_SNAPSHOT.dados));
  delete dados.config.pb;
  assert.throws(
    () => buildCalculationProfileFromCalcDados({
      category: 'iPhone',
      updated_at: LIVE_CONFIG_SNAPSHOT.atualizado_em,
      dados
    }),
    /config.pb/
  );
});

check('config sem taxas falha sem fallback chumbado', () => {
  const dados = JSON.parse(JSON.stringify(LIVE_CONFIG_SNAPSHOT.dados));
  delete dados.config.taxas;
  assert.throws(
    () => buildCalculationProfileFromCalcDados({
      category: 'iPhone',
      updated_at: LIVE_CONFIG_SNAPSHOT.atualizado_em,
      dados
    }),
    /config.taxas/
  );
});

check('Worker usa exatamente os perfis C03/C04 aprovados e os entrega ao resolver', () => {
  const raw = fs.readFileSync(path.join(__dirname, '../../../wrangler.jsonc'), 'utf8');
  const config = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'));
  const vars = config.vars;
  const research = JSON.parse(vars.EXTCALC_RESEARCH_PROFILE_JSON);
  const indicator = JSON.parse(vars.EXTCALC_INDICATOR_PROFILE_JSON);

  assert.deepStrictEqual(research, {
    profile_id: 'external-calc-research-production-v1',
    profile_version: '1',
    required_match_fields: ['model_id', 'capacity_gb', 'condition', 'color'],
    min_evidence_confidence: 0.9,
    max_age_seconds: 604800
  });
  assert.deepStrictEqual(indicator, {
    profile_id: 'external-calc-indicator-production-v1',
    profile_version: '1',
    min_evidence_count: 3,
    cheap_at_or_below_percent: -5,
    expensive_at_or_above_percent: 5
  });

  const mapped = authorityServerConfig(vars);
  assert.strictEqual(mapped.researchProfileJson, vars.EXTCALC_RESEARCH_PROFILE_JSON);
  assert.strictEqual(mapped.indicatorProfileJson, vars.EXTCALC_INDICATOR_PROFILE_JSON);
  assert.strictEqual(config.name, 'flat-resonance-09ba');
});

console.log(`C02_PRODUCTION_CONFIG_GATE_V0=PASS checks=${ok}`);
console.log('C03_PRODUCTION_PROFILE=APPROVED_CONFIG_READY');
console.log('C04_PRODUCTION_PROFILE=APPROVED_CONFIG_READY');
console.log('AUTHORITY_PRODUCTION_CONFIG_GATE_V0=PASS');
