'use strict';

const crypto = require('crypto');

const CONTRACT_VERSION = 'external-calc-c02/v1';
const ENGINE_VERSION = 'c02-calculator/1.0.0';
const C01_CONTRACT_VERSION = 'external-calc-c01-readonly/v1';
const FREIGHT_MODES = new Set(['STORE', 'SPLIT', 'CUSTOMER']);

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} obrigatorio`);
  }
  return value.trim();
}

function assertMinor(value, field, options = {}) {
  const { allowZero = true } = options;
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${field} deve ser inteiro em minor units`);
  }
  return value;
}

function normalizeCurrency(value) {
  const currency = assertNonEmpty(value, 'currency').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('currency invalida');
  return currency;
}

function money(amountMinor, currency) {
  return {
    amount_minor: assertMinor(amountMinor, 'amount_minor'),
    currency: normalizeCurrency(currency)
  };
}

function assertMoney(value, field) {
  if (!value || typeof value !== 'object') throw new Error(`${field} obrigatorio`);
  return money(
    assertMinor(value.amount_minor, `${field}.amount_minor`, { allowZero: false }),
    value.currency
  );
}

function normalizeCandidate(candidate) {
  if (!candidate || candidate.contract_version !== C01_CONTRACT_VERSION) {
    throw new Error('C01 candidate invalido');
  }
  if (candidate.execution_status !== 'SUCCEEDED') {
    throw new Error('C01 precisa estar SUCCEEDED');
  }
  if (candidate.domain_outcome !== 'VALID') {
    throw new Error('C01 precisa estar VALID');
  }
  if (candidate.freshness_status !== 'CURRENT') {
    throw new Error('C01 precisa estar CURRENT');
  }
  if (!candidate.reviewed_offer) {
    throw new Error('C01 reviewed_offer obrigatorio');
  }

  const reviewedPrice = assertMoney(candidate.reviewed_offer.price, 'reviewed_offer.price');

  return {
    analysis_id: assertNonEmpty(candidate.analysis_id, 'candidate.analysis_id'),
    source_id: assertNonEmpty(candidate.source_id, 'candidate.source_id'),
    offer_id: assertNonEmpty(candidate.offer_id, 'candidate.offer_id'),
    offer_revision: candidate.offer_revision,
    offer_identity_fingerprint: assertNonEmpty(
      candidate.offer_identity_fingerprint,
      'candidate.offer_identity_fingerprint'
    ),
    offer_value_fingerprint: assertNonEmpty(
      candidate.offer_value_fingerprint,
      'candidate.offer_value_fingerprint'
    ),
    reviewed_offer: {
      ...candidate.reviewed_offer,
      price: reviewedPrice
    },
    provenance_refs: Array.isArray(candidate.provenance_refs)
      ? [...candidate.provenance_refs]
      : []
  };
}

function normalizeInstallmentCoefficients(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('installment_coefficients obrigatorio');
  }

  const entries = Object.entries(input)
    .map(([countText, coefficient]) => {
      const count = Number(countText);
      if (!Number.isInteger(count) || count < 1 || count > 60) {
        throw new Error('installment count invalido');
      }
      if (typeof coefficient !== 'number' || !Number.isFinite(coefficient) || coefficient <= 0) {
        throw new Error(`installment coefficient invalido para ${count}x`);
      }
      return [count, coefficient];
    })
    .sort((a, b) => a[0] - b[0]);

  if (!entries.length) throw new Error('installment_coefficients vazio');

  return entries;
}

function normalizeProfile(profile, expectedCurrency) {
  if (!profile || typeof profile !== 'object') throw new Error('calculation_profile obrigatorio');

  const currency = normalizeCurrency(profile.currency);
  if (currency !== expectedCurrency) {
    throw new Error('calculation_profile.currency difere da oferta revisada');
  }

  const freightMode = assertNonEmpty(profile.freight_mode, 'freight_mode').toUpperCase();
  if (!FREIGHT_MODES.has(freightMode)) throw new Error('freight_mode invalido');

  return {
    profile_id: assertNonEmpty(profile.profile_id, 'profile_id'),
    profile_version: assertNonEmpty(profile.profile_version, 'profile_version'),
    currency,
    cash_margin_minor: assertMinor(profile.cash_margin_minor, 'cash_margin_minor'),
    installment_margin_minor: assertMinor(
      profile.installment_margin_minor,
      'installment_margin_minor'
    ),
    freight_minor: assertMinor(profile.freight_minor ?? 0, 'freight_minor'),
    freight_mode: freightMode,
    installment_base_addon_minor: assertMinor(
      profile.installment_base_addon_minor ?? 0,
      'installment_base_addon_minor'
    ),
    entry_minor: assertMinor(profile.entry_minor ?? 0, 'entry_minor'),
    installment_coefficients: normalizeInstallmentCoefficients(
      profile.installment_coefficients
    )
  };
}

function allocateFreight(freightMinor, mode) {
  if (mode === 'STORE') {
    return { store_freight_minor: freightMinor, customer_freight_minor: 0 };
  }
  if (mode === 'CUSTOMER') {
    return { store_freight_minor: 0, customer_freight_minor: freightMinor };
  }

  // Paridade com r2(frete / 2) da calculadora viva.
  // Em valor impar de centavos, as duas metades arredondam independentemente.
  const half = Math.round(freightMinor / 2);
  return { store_freight_minor: half, customer_freight_minor: half };
}

function roundPercent(numeratorMinor, denominatorMinor) {
  if (denominatorMinor <= 0) return null;
  return Math.round((numeratorMinor / denominatorMinor) * 1000000) / 10000;
}

function calculateInstallments(baseMinor, profile) {
  if (baseMinor <= 0) return [];

  const chargedBase = baseMinor + profile.installment_base_addon_minor;

  return profile.installment_coefficients.map(([count, coefficient]) => {
    const totalMinor = Math.round(chargedBase * coefficient);
    const installmentMinor = Math.round(totalMinor / count);
    return {
      count,
      coefficient,
      base_price: money(baseMinor, profile.currency),
      charged_base: money(chargedBase, profile.currency),
      total_price: money(totalMinor, profile.currency),
      installment_price: money(installmentMinor, profile.currency),
      finance_delta: money(totalMinor - chargedBase, profile.currency)
    };
  });
}

function calculationInputFingerprint(candidate, profile) {
  return stableHash(JSON.stringify({
    offer_id: candidate.offer_id,
    offer_revision: candidate.offer_revision,
    offer_value_fingerprint: candidate.offer_value_fingerprint,
    reviewed_price: candidate.reviewed_offer.price,
    profile: {
      profile_id: profile.profile_id,
      profile_version: profile.profile_version,
      currency: profile.currency,
      cash_margin_minor: profile.cash_margin_minor,
      installment_margin_minor: profile.installment_margin_minor,
      freight_minor: profile.freight_minor,
      freight_mode: profile.freight_mode,
      installment_base_addon_minor: profile.installment_base_addon_minor,
      entry_minor: profile.entry_minor,
      installment_coefficients: profile.installment_coefficients
    }
  }));
}

function calculateC02(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');

  const calculationRunId = assertNonEmpty(
    request.calculation_run_id,
    'calculation_run_id'
  );
  const candidate = normalizeCandidate(request.c01_candidate);
  if (!Number.isInteger(candidate.offer_revision) || candidate.offer_revision < 1) {
    throw new Error('candidate.offer_revision invalida');
  }

  const supplierPrice = candidate.reviewed_offer.price;
  const profile = normalizeProfile(request.calculation_profile, supplierPrice.currency);
  const freight = allocateFreight(profile.freight_minor, profile.freight_mode);

  const storeCostMinor =
    supplierPrice.amount_minor + freight.store_freight_minor;

  // A margem configurada e um valor monetario SOBRE o custo.
  // O frete pago pelo cliente e apenas repasse e nao vira margem.
  const normalSaleMinor =
    storeCostMinor +
    profile.cash_margin_minor +
    freight.customer_freight_minor;

  const installmentBaseMinor =
    storeCostMinor +
    profile.installment_margin_minor +
    freight.customer_freight_minor;

  const entryMinor = Math.min(profile.entry_minor, installmentBaseMinor);
  const financedBalanceMinor = Math.max(installmentBaseMinor - entryMinor, 0);
  const installments = calculateInstallments(financedBalanceMinor, profile);

  const inputFingerprint = calculationInputFingerprint(candidate, profile);

  const outputCore = {
    supplier_offer_price: money(supplierPrice.amount_minor, profile.currency),
    store_cost: money(storeCostMinor, profile.currency),
    freight: {
      total: money(profile.freight_minor, profile.currency),
      mode: profile.freight_mode,
      store_share: money(freight.store_freight_minor, profile.currency),
      customer_share: money(freight.customer_freight_minor, profile.currency)
    },
    normal_sale_price: money(normalSaleMinor, profile.currency),
    installment_base_price: money(installmentBaseMinor, profile.currency),
    entry: money(entryMinor, profile.currency),
    financed_balance: money(financedBalanceMinor, profile.currency),
    estimated_margin: money(profile.cash_margin_minor, profile.currency),
    estimated_margin_percent: roundPercent(
      profile.cash_margin_minor,
      normalSaleMinor
    ),
    installments,
    promo_price: null,
    promotion_floor: null,
    promotion_range: null
  };

  const outputFingerprint = stableHash(JSON.stringify(outputCore));

  return {
    contract_version: CONTRACT_VERSION,
    calculation_run_id: calculationRunId,
    analysis_id: candidate.analysis_id,
    source_id: candidate.source_id,
    offer_id: candidate.offer_id,
    offer_revision: candidate.offer_revision,
    contract_id: 'C02',
    engine_version: ENGINE_VERSION,
    calculation_profile_id: profile.profile_id,
    calculation_profile_version: profile.profile_version,
    stage: 'CALCULATION',
    run_kind: 'INITIAL',
    attempt_no: 1,
    execution_status: 'SUCCEEDED',
    freshness_status: 'CURRENT',
    calculation_input_fingerprint: inputFingerprint,
    output_fingerprint: outputFingerprint,
    ...outputCore,
    provenance_refs: [
      ...candidate.provenance_refs,
      `offer_revision:${candidate.offer_id}:${candidate.offer_revision}`,
      `c01_value:${candidate.offer_value_fingerprint}`,
      `calculation_profile:${profile.profile_id}:${profile.profile_version}`
    ]
  };
}

module.exports = {
  CONTRACT_VERSION,
  ENGINE_VERSION,
  allocateFreight,
  calculateInstallments,
  calculationInputFingerprint,
  calculateC02
};
