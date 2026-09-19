'use strict';

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} obrigatorio`);
  }
  return value.trim();
}

function toMinorUnits(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} invalido`);
  }
  const minor = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(minor)) throw new Error(`${field} fora de faixa`);
  return minor;
}

function normalizeCoefficients(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('config.taxas obrigatorio');
  }

  const result = {};
  for (const [countText, coefficient] of Object.entries(value)) {
    const count = Number(countText);
    if (!Number.isInteger(count) || count < 2 || count > 60) {
      throw new Error(`config.taxas prazo invalido: ${countText}`);
    }
    if (typeof coefficient !== 'number' || !Number.isFinite(coefficient) || coefficient <= 0) {
      throw new Error(`config.taxas[${countText}] invalido`);
    }
    result[count] = coefficient;
  }

  if (!Object.keys(result).length) throw new Error('config.taxas vazio');
  return result;
}

function buildCalculationProfileFromCalcDados(input = {}) {
  const category = assertNonEmpty(input.category, 'calculation category');
  const updatedAt = assertNonEmpty(input.updated_at, 'calc_dados.atualizado_em');
  if (Number.isNaN(Date.parse(updatedAt))) {
    throw new Error('calc_dados.atualizado_em invalido');
  }

  const dados = input.dados;
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    throw new Error('calc_dados.dados invalido');
  }

  const config = dados.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('calc_dados.dados.config ausente');
  }

  const margins = config.margens;
  if (!margins || typeof margins !== 'object' || Array.isArray(margins)) {
    throw new Error('config.margens ausente');
  }

  const categoryMargins = margins[category];
  if (!categoryMargins || typeof categoryMargins !== 'object') {
    throw new Error(`config.margens[${category}] ausente`);
  }
  if (typeof categoryMargins.av !== 'number' || typeof categoryMargins.pc !== 'number') {
    throw new Error(`config.margens[${category}] incompleta`);
  }

  const baseAddon = config.pb;
  if (typeof baseAddon !== 'number' || !Number.isFinite(baseAddon) || baseAddon < 0) {
    throw new Error('config.pb ausente ou invalido');
  }

  return {
    profile_id: `pitwall-calc-dados:${category}`,
    profile_version: updatedAt,
    currency: 'BRL',
    cash_margin_minor: toMinorUnits(categoryMargins.av, `margens.${category}.av`),
    installment_margin_minor: toMinorUnits(categoryMargins.pc, `margens.${category}.pc`),
    freight_minor: 0,
    freight_mode: 'STORE',
    installment_base_addon_minor: toMinorUnits(baseAddon, 'config.pb'),
    entry_minor: 0,
    installment_coefficients: normalizeCoefficients(config.taxas)
  };
}

module.exports = {
  toMinorUnits,
  normalizeCoefficients,
  buildCalculationProfileFromCalcDados
};
