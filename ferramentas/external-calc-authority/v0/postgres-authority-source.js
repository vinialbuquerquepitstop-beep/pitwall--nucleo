'use strict';

const { buildCalculationProfileFromCalcDados } = require('./calc-dados-calculation-profile');

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} obrigatorio`);
  }
  return value.trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function joinUrl(base, path) {
  return assertNonEmpty(base, 'supabaseUrl').replace(/\/+$/, '') + path;
}

function authHeaders(anonKey, accessToken) {
  return {
    apikey: assertNonEmpty(anonKey, 'anonKey'),
    authorization: `Bearer ${assertNonEmpty(accessToken, 'accessToken')}`,
    'content-type': 'application/json'
  };
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Supabase respondeu JSON invalido: ${text.slice(0, 160)}`);
  }
}

function parseServerJson(raw, field, options = {}) {
  const { optional = false, fallback = null } = options;
  if (raw == null || raw === '') {
    if (optional) return clone(fallback);
    throw new Error(`${field} server-side ausente`);
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) return clone(raw);

  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    throw new Error(`${field} server-side invalido`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${field} server-side deve ser objeto JSON`);
  }

  return parsed;
}

function createPostgresAuthoritySource(options = {}) {
  const supabaseUrl = assertNonEmpty(options.supabaseUrl, 'supabaseUrl');
  const anonKey = assertNonEmpty(options.anonKey, 'anonKey');
  const accessToken = assertNonEmpty(options.accessToken, 'accessToken');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const serverConfig = options.serverConfig || {};

  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl obrigatorio');

  async function selectOne(path, errorCode) {
    const response = await fetchImpl(joinUrl(supabaseUrl, path), {
      method: 'GET',
      headers: authHeaders(anonKey, accessToken)
    });
    const payload = await readJson(response);

    if (!response.ok) {
      const message = payload?.message || payload?.error || `HTTP ${response.status}`;
      throw new Error(`${errorCode}: ${message}`);
    }

    if (!Array.isArray(payload) || payload.length === 0) return null;
    if (payload.length !== 1) throw new Error(`${errorCode}: resultado nao unico`);
    return payload[0];
  }

  return {
    async loadC01(identity) {
      const tenantId = assertNonEmpty(identity?.tenant_id, 'tenant_id');
      const analysisId = assertNonEmpty(identity?.analysis_id, 'analysis_id');
      const offerId = assertNonEmpty(identity?.offer_id, 'offer_id');
      const offerRevision = identity?.offer_revision;

      if (!Number.isSafeInteger(offerRevision) || offerRevision < 1) {
        throw new Error('offer_revision invalida');
      }

      const params = new URLSearchParams({
        tenant_id: `eq.${tenantId}`,
        analysis_id: `eq.${analysisId}`,
        offer_id: `eq.${offerId}`,
        offer_revision: `eq.${offerRevision}`,
        select: 'tenant_id,analysis_id,offer_id,offer_revision,c01_snapshot,domain_outcome,freshness_status'
      });

      const row = await selectOne(
        `/rest/v1/extcalc_offer_revision?${params.toString()}`,
        'EXTCALC_AUTHORITY_C01_LOAD_FAILED'
      );

      if (!row) throw new Error('C01 autoritativo nao encontrado');
      if (
        row.tenant_id !== tenantId ||
        row.analysis_id !== analysisId ||
        row.offer_id !== offerId ||
        row.offer_revision !== offerRevision
      ) {
        throw new Error('C01 autoritativo com identidade divergente');
      }

      return clone(row.c01_snapshot);
    },

    async loadCalculationProfile(identity) {
      const tenantId = assertNonEmpty(identity?.tenant_id, 'tenant_id');
      const category = assertNonEmpty(
        serverConfig.calculationCategory,
        'EXTCALC_CALCULATION_CATEGORY'
      );

      const params = new URLSearchParams({
        tenant_id: `eq.${tenantId}`,
        select: 'tenant_id,dados,atualizado_em'
      });

      const row = await selectOne(
        `/rest/v1/calc_dados?${params.toString()}`,
        'EXTCALC_AUTHORITY_CALC_CONFIG_LOAD_FAILED'
      );

      if (!row) throw new Error('calc_dados autoritativo nao encontrado');
      if (row.tenant_id !== tenantId) {
        throw new Error('calc_dados autoritativo com tenant divergente');
      }

      return buildCalculationProfileFromCalcDados({
        category,
        dados: row.dados,
        updated_at: row.atualizado_em
      });
    },

    async loadResearchProfile() {
      return parseServerJson(
        serverConfig.researchProfileJson,
        'EXTCALC_RESEARCH_PROFILE_JSON'
      );
    },

    async loadIndicatorProfile() {
      return parseServerJson(
        serverConfig.indicatorProfileJson,
        'EXTCALC_INDICATOR_PROFILE_JSON'
      );
    },

    async loadMarketContext() {
      return parseServerJson(
        serverConfig.marketContextJson,
        'EXTCALC_MARKET_CONTEXT_JSON',
        { optional: true, fallback: {} }
      );
    },

    async loadEvidence(identity) {
      const tenantId = assertNonEmpty(identity?.tenant_id, 'tenant_id');
      const candidate = identity?.c01_candidate || {};
      const analysisId = assertNonEmpty(candidate.analysis_id, 'c01.analysis_id');
      const offerId = assertNonEmpty(candidate.offer_id, 'c01.offer_id');
      const offerRevision = candidate.offer_revision;

      if (!Number.isSafeInteger(offerRevision) || offerRevision < 1) {
        throw new Error('c01.offer_revision invalida');
      }

      const params = new URLSearchParams({
        tenant_id: `eq.${tenantId}`,
        analysis_id: `eq.${analysisId}`,
        offer_id: `eq.${offerId}`,
        offer_revision: `eq.${offerRevision}`,
        select: 'evidence_id,evidence_snapshot,observed_at',
        order: 'observed_at.desc',
        limit: String(serverConfig.maxEvidenceRows || 100)
      });

      const response = await fetchImpl(
        joinUrl(supabaseUrl, `/rest/v1/extcalc_evidence?${params.toString()}`),
        {
          method: 'GET',
          headers: authHeaders(anonKey, accessToken)
        }
      );
      const payload = await readJson(response);

      if (!response.ok) {
        const message = payload?.message || payload?.error || `HTTP ${response.status}`;
        throw new Error(`EXTCALC_AUTHORITY_EVIDENCE_LOAD_FAILED: ${message}`);
      }

      if (!Array.isArray(payload)) {
        throw new Error('EXTCALC_AUTHORITY_EVIDENCE_LOAD_FAILED: resposta invalida');
      }

      const seen = new Set();
      const evidence = [];

      for (const row of payload) {
        const snapshot = row?.evidence_snapshot;
        const evidenceId = snapshot?.evidence_id || row?.evidence_id;
        if (!snapshot || typeof snapshot !== 'object' || !evidenceId || seen.has(evidenceId)) {
          continue;
        }
        seen.add(evidenceId);
        evidence.push(clone(snapshot));
      }

      return evidence;
    }
  };
}

module.exports = {
  parseServerJson,
  createPostgresAuthoritySource
};
