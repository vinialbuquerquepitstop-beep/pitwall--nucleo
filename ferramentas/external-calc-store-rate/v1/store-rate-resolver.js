'use strict';

const { calculateC02 } = require('../../external-calc-c02/v1/c02-calculator');

const RESOLVER_VERSION = 'external-calc-store-rate-resolver/v1.1.0';
const RATE_SEMANTICS = 'PROCESSOR_DEDUCTION_PERCENT';
const GROSS_UP_FORMULA_VERSION = 'processor-deduction-gross-up/v1';
const FORBIDDEN_CLIENT_KEYS = new Set([
  'tenant_id','user_id','auth_user_id','profile_id','profile_version','rate_units',
  'rate_scale','rate_percent','coefficient','total_amount_minor','installment_amount_minor',
  'calculation_profile','c01_candidate'
]);

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function nonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail('RATE_PROFILE_INVALID', field + ' obrigatorio');
  return value.trim();
}
function findForbidden(value, path = '$') {
  if (Array.isArray(value)) {
    for (let i=0;i<value.length;i+=1) { const found=findForbidden(value[i], path+'['+i+']'); if(found) return found; }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_CLIENT_KEYS.has(key)) return path+'.'+key;
    const found=findForbidden(child,path+'.'+key); if(found) return found;
  }
  return null;
}
function normalizeCommand(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) fail('RATE_PROFILE_INVALID','quote command obrigatorio');
  const forbidden=findForbidden(command);
  if (forbidden) fail('RATE_PROFILE_FORBIDDEN','campo de autoridade proibido no cliente: '+forbidden);
  const allowed=new Set(['analysis_id','offer_id','offer_revision','installment_count']);
  for (const key of Object.keys(command)) if(!allowed.has(key)) fail('RATE_PROFILE_FORBIDDEN','campo nao permitido: '+key);
  const installmentCount=command.installment_count;
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 18) fail('INSTALLMENT_RATE_NOT_CONFIGURED');
  if (!Number.isInteger(command.offer_revision) || command.offer_revision < 1) fail('RATE_PROFILE_INVALID','offer_revision invalida');
  return {
    analysis_id: nonEmpty(command.analysis_id,'analysis_id'),
    offer_id: nonEmpty(command.offer_id,'offer_id'),
    offer_revision: command.offer_revision,
    installment_count: installmentCount
  };
}
function normalizeMembership(row, authUserId) {
  if (!row || row.id !== authUserId || !row.ativo) fail('RATE_PROFILE_FORBIDDEN');
  if (!['dono','validador'].includes(row.papel)) fail('RATE_PROFILE_FORBIDDEN');
  return { tenant_id: nonEmpty(row.tenant_id,'membership.tenant_id'), role: row.papel };
}
function rateFractionFromUnits(rateUnits, rateScale) {
  if (!Number.isSafeInteger(rateUnits) || rateUnits < 0 ||
      !Number.isSafeInteger(rateScale) || rateScale <= 0) {
    fail('RATE_PROFILE_INVALID','taxa invalida');
  }
  const percent=rateUnits/rateScale;
  if (percent >= 100) fail('RATE_PROFILE_INVALID','taxa precisa ser menor que 100%');
  return percent/100;
}
function normalizeStoreRateProfile(profile, tenantId, installmentCount) {
  if (!profile) fail('RATE_PROFILE_NOT_CONFIGURED');
  if (profile.tenant_id !== tenantId || profile.status !== 'ACTIVE') fail('RATE_PROFILE_INVALID');
  if (!profile.profile_id || !Number.isInteger(profile.version) || profile.version < 1 ||
      profile.currency !== 'BRL' || !Number.isInteger(profile.rate_scale) || profile.rate_scale <= 0 ||
      typeof profile.fingerprint !== 'string' || !profile.fingerprint) fail('RATE_PROFILE_INVALID');
  const entries=Array.isArray(profile.entries) ? profile.entries : [];
  const entry=entries.find(x=>x && x.installment_count===installmentCount);
  if (!entry || !Number.isSafeInteger(entry.rate_units) || entry.rate_units < 0) fail('INSTALLMENT_RATE_NOT_CONFIGURED');
  rateFractionFromUnits(entry.rate_units,profile.rate_scale);
  return { ...profile, entry };
}
function coefficientFromRate(rateUnits, rateScale) {
  const processorDeductionFraction=rateFractionFromUnits(rateUnits,rateScale);
  // StoreRateProfile stores the real processor deduction percentage.
  // To preserve the desired net amount, customer_total = net_base / (1 - deduction_fraction).
  return 1/(1-processorDeductionFraction);
}
function buildTrustedCalculationProfile(baseProfile, rateProfile) {
  if (!baseProfile || typeof baseProfile !== 'object') fail('RATE_PROFILE_INVALID','base calculation profile ausente');
  const count=rateProfile.entry.installment_count;
  return {
    ...baseProfile,
    installment_coefficients: { [count]: coefficientFromRate(rateProfile.entry.rate_units, rateProfile.rate_scale) }
  };
}
function createStoreRateQuoteResolver(options={}) {
  const source=options.source;
  if (!source) throw new Error('source obrigatorio');
  for (const method of ['loadMembership','loadC01','loadBaseCalculationProfile','loadActiveStoreRateProfile']) {
    if (typeof source[method] !== 'function') throw new Error('source.'+method+' obrigatorio');
  }
  return {
    version: RESOLVER_VERSION,
    async resolveQuote(args={}) {
      const authUserId=nonEmpty(args.auth_user_id,'auth_user_id'); // only verified server auth may supply this.
      const command=normalizeCommand(args.command);
      const membership=normalizeMembership(await source.loadMembership({auth_user_id:authUserId}),authUserId);
      const identity={tenant_id:membership.tenant_id,...command};
      const [c01, baseProfile, rawRateProfile]=await Promise.all([
        source.loadC01(identity),
        source.loadBaseCalculationProfile(identity),
        source.loadActiveStoreRateProfile({tenant_id:membership.tenant_id})
      ]);
      if (!c01 || c01.analysis_id!==command.analysis_id || c01.offer_id!==command.offer_id ||
          c01.offer_revision!==command.offer_revision) fail('QUOTE_RECALCULATION_REQUIRED','C01 diverge da referencia');
      const rateProfile=normalizeStoreRateProfile(rawRateProfile,membership.tenant_id,command.installment_count);
      const calculationProfile=buildTrustedCalculationProfile(baseProfile,rateProfile);
      const calculation=calculateC02({
        calculation_run_id: nonEmpty(args.calculation_run_id,'calculation_run_id'),
        c01_candidate:c01,
        calculation_profile:calculationProfile
      });
      const installment=calculation.installments.find(x=>x.count===command.installment_count);
      if (!installment) fail('QUOTE_RECALCULATION_REQUIRED');

      const processorDeductionFraction=rateFractionFromUnits(rateProfile.entry.rate_units,rateProfile.rate_scale);
      const totalMinor=installment.total_price.amount_minor;
      const processorFeeMinor=Math.round(totalMinor*processorDeductionFraction);
      const netMinor=totalMinor-processorFeeMinor;

      return {
        resolver_version:RESOLVER_VERSION,
        rate_semantics:RATE_SEMANTICS,
        gross_up_formula_version:GROSS_UP_FORMULA_VERSION,
        tenant_id:membership.tenant_id,
        role:membership.role,
        analysis_id:command.analysis_id,
        offer_id:command.offer_id,
        offer_revision:command.offer_revision,
        installment_count:command.installment_count,
        base_amount:installment.charged_base,
        applied_rate_units:rateProfile.entry.rate_units,
        applied_rate_scale:rateProfile.rate_scale,
        total:installment.total_price,
        installment_amount:installment.installment_price,
        processor_fee:{amount_minor:processorFeeMinor,currency:rateProfile.currency},
        net_amount:{amount_minor:netMinor,currency:rateProfile.currency},
        calculation_version:calculation.engine_version,
        rounding_version:'c02-calculator/1.0.0',
        rate_profile_id:rateProfile.profile_id,
        rate_profile_version:rateProfile.version,
        rate_profile_fingerprint:rateProfile.fingerprint,
        calculation_output_fingerprint:calculation.output_fingerprint
      };
    }
  };
}
module.exports={
 RESOLVER_VERSION,RATE_SEMANTICS,GROSS_UP_FORMULA_VERSION,FORBIDDEN_CLIENT_KEYS,
 findForbidden,normalizeCommand,rateFractionFromUnits,coefficientFromRate,
 buildTrustedCalculationProfile,createStoreRateQuoteResolver
};
