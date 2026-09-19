'use strict';

const AUTHORITY_RESOLVER_VERSION = 'external-calc-authority-resolver/v0';

const FORBIDDEN_CLIENT_AUTHORITY_KEYS = new Set([
  'tenant_id',
  'execution_id',
  'run_ids',
  'c01_candidate',
  'calculation_profile',
  'research_profile',
  'indicator_profile',
  'evidence',
  'as_of',
  'auth_context',
  'service_result',
  'persisted_at'
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} obrigatorio`);
  }
  return value.trim();
}

function findForbiddenKey(value, path = '$') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenKey(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }

  if (!value || typeof value !== 'object') return null;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_CLIENT_AUTHORITY_KEYS.has(key)) return childPath;
    const found = findForbiddenKey(child, childPath);
    if (found) return found;
  }

  return null;
}

function normalizeCommand(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    throw new Error('execution command obrigatorio');
  }

  const forbidden = findForbiddenKey(command);
  if (forbidden) {
    const error = new Error(`campo de autoridade proibido no cliente: ${forbidden}`);
    error.code = 'CLIENT_AUTHORITY_FIELD';
    throw error;
  }

  const keys = Object.keys(command).sort();
  const allowed = ['analysis_id', 'offer_id', 'offer_revision'];
  for (const key of keys) {
    if (!allowed.includes(key)) {
      const error = new Error(`campo nao permitido no execution command: ${key}`);
      error.code = 'CLIENT_COMMAND_FIELD';
      throw error;
    }
  }

  const offerRevision = command.offer_revision;
  if (!Number.isSafeInteger(offerRevision) || offerRevision < 1) {
    throw new Error('offer_revision invalida');
  }

  return {
    analysis_id: assertNonEmpty(command.analysis_id, 'analysis_id'),
    offer_id: assertNonEmpty(command.offer_id, 'offer_id'),
    offer_revision: offerRevision
  };
}

function assertC01MatchesReference(candidate, reference) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('C01 autoritativo ausente');
  }

  if (
    candidate.analysis_id !== reference.analysis_id ||
    candidate.offer_id !== reference.offer_id ||
    candidate.offer_revision !== reference.offer_revision
  ) {
    throw new Error('C01 autoritativo diverge da referencia solicitada');
  }

  if (candidate.domain_outcome !== 'VALID') {
    throw new Error('C01 autoritativo precisa estar VALID');
  }

  if (candidate.execution_status !== 'SUCCEEDED') {
    throw new Error('C01 autoritativo precisa estar SUCCEEDED');
  }

  if (candidate.freshness_status !== 'CURRENT') {
    throw new Error('C01 autoritativo precisa estar CURRENT');
  }

  return clone(candidate);
}

function assertProfile(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} server-side ausente`);
  }
  return clone(value);
}

function createExternalCalcAuthorityResolver(options = {}) {
  const source = options.source;
  const clock = options.clock || (() => new Date().toISOString());

  if (!source || typeof source !== 'object') {
    throw new Error('authority source obrigatorio');
  }

  for (const method of [
    'loadC01',
    'loadCalculationProfile',
    'loadResearchProfile',
    'loadIndicatorProfile',
    'loadEvidence',
    'loadMarketContext'
  ]) {
    if (typeof source[method] !== 'function') {
      throw new Error(`authority source.${method} obrigatorio`);
    }
  }

  return {
    version: AUTHORITY_RESOLVER_VERSION,

    async resolveExecutionInput(args) {
      const tenantId = assertNonEmpty(args?.tenant_id, 'tenant_id');
      const reference = normalizeCommand(args?.command || {});

      const c01 = assertC01MatchesReference(
        await source.loadC01({ tenant_id: tenantId, ...reference }),
        reference
      );

      const [
        calculationProfile,
        researchProfile,
        indicatorProfile,
        evidence,
        marketContext
      ] = await Promise.all([
        source.loadCalculationProfile({ tenant_id: tenantId, c01_candidate: c01 }),
        source.loadResearchProfile({ tenant_id: tenantId, c01_candidate: c01 }),
        source.loadIndicatorProfile({ tenant_id: tenantId, c01_candidate: c01 }),
        source.loadEvidence({ tenant_id: tenantId, c01_candidate: c01 }),
        source.loadMarketContext({ tenant_id: tenantId, c01_candidate: c01 })
      ]);

      const asOf = assertNonEmpty(clock(), 'server as_of');
      if (Number.isNaN(Date.parse(asOf))) {
        throw new Error('server as_of deve ser ISO date-time');
      }

      return {
        c01_candidate: c01,
        calculation_profile: assertProfile(calculationProfile, 'calculation_profile'),
        research_profile: assertProfile(researchProfile, 'research_profile'),
        indicator_profile: assertProfile(indicatorProfile, 'indicator_profile'),
        as_of: asOf,
        market_context:
          marketContext && typeof marketContext === 'object' && !Array.isArray(marketContext)
            ? clone(marketContext)
            : {},
        evidence: Array.isArray(evidence) ? clone(evidence) : []
      };
    }
  };
}

module.exports = {
  AUTHORITY_RESOLVER_VERSION,
  FORBIDDEN_CLIENT_AUTHORITY_KEYS,
  findForbiddenKey,
  normalizeCommand,
  createExternalCalcAuthorityResolver
};
