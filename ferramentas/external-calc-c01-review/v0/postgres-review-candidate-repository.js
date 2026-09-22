'use strict';

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

function assertCandidateIdentity(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('C01 review candidate obrigatorio');
  }
  if (candidate.contract_version !== 'external-calc-c01-readonly/v1') {
    throw new Error('C01 review candidate com contrato invalido');
  }
  if (candidate.execution_status !== 'SUCCEEDED') {
    throw new Error('C01 review candidate precisa estar SUCCEEDED');
  }
  if (candidate.domain_outcome !== 'REVIEW_REQUIRED') {
    throw new Error('C01 review candidate precisa estar REVIEW_REQUIRED');
  }
  if (candidate.freshness_status !== 'CURRENT') {
    throw new Error('C01 review candidate precisa estar CURRENT');
  }
  assertNonEmpty(candidate.analysis_id, 'candidate.analysis_id');
  assertNonEmpty(candidate.source_id, 'candidate.source_id');
  assertNonEmpty(candidate.offer_id, 'candidate.offer_id');
  assertNonEmpty(candidate.offer_identity_fingerprint, 'candidate.offer_identity_fingerprint');
  assertNonEmpty(candidate.offer_value_fingerprint, 'candidate.offer_value_fingerprint');
  assertNonEmpty(candidate.interpretation_run_id, 'candidate.interpretation_run_id');
  if (!Number.isSafeInteger(candidate.offer_revision) || candidate.offer_revision < 1) {
    throw new Error('candidate.offer_revision invalida');
  }
  if (candidate.reviewed_offer !== null || candidate.review !== null) {
    throw new Error('candidate pre-review nao pode conter review');
  }
  return clone(candidate);
}

function createPostgresReviewCandidateRepository(options = {}) {
  const supabaseUrl = assertNonEmpty(options.supabaseUrl, 'supabaseUrl');
  const anonKey = assertNonEmpty(options.anonKey, 'anonKey');
  const accessToken = assertNonEmpty(options.accessToken, 'accessToken');
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl obrigatorio');

  return {
    async persistCandidate(candidate) {
      const normalized = assertCandidateIdentity(candidate);
      const response = await fetchImpl(
        joinUrl(supabaseUrl, '/rest/v1/rpc/extcalc_persist_review_candidate_v0'),
        {
          method: 'POST',
          headers: authHeaders(anonKey, accessToken),
          body: JSON.stringify({ p_candidate: normalized })
        }
      );
      const payload = await readJson(response);

      if (!response.ok) {
        const message = payload?.message || payload?.error || `HTTP ${response.status}`;
        throw new Error(`EXTCALC_REVIEW_CANDIDATE_PERSIST_FAILED: ${message}`);
      }

      return clone(payload);
    },

    async listPendingCandidates(options = {}) {
      const limit = Number.isSafeInteger(options.limit) ? options.limit : 50;
      if (limit < 1 || limit > 100) throw new Error('limit invalido');

      const response = await fetchImpl(
        joinUrl(supabaseUrl, '/rest/v1/rpc/extcalc_list_pending_review_candidates_v0'),
        {
          method: 'POST',
          headers: authHeaders(anonKey, accessToken),
          body: JSON.stringify({ p_limit: limit })
        }
      );
      const payload = await readJson(response);
      if (!response.ok) {
        const message = payload?.message || payload?.error || `HTTP ${response.status}`;
        throw new Error(`EXTCALC_REVIEW_QUEUE_LOAD_FAILED: ${message}`);
      }
      if (!Array.isArray(payload)) {
        throw new Error('EXTCALC_REVIEW_QUEUE_LOAD_FAILED: resposta invalida');
      }
      return payload.map(row => assertCandidateIdentity(row.candidate_snapshot));
    },

    async loadCandidate(identity) {
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
        select: 'tenant_id,analysis_id,offer_id,offer_revision,candidate_snapshot'
      });

      const response = await fetchImpl(
        joinUrl(supabaseUrl, `/rest/v1/extcalc_review_candidate?${params.toString()}`),
        {
          method: 'GET',
          headers: authHeaders(anonKey, accessToken)
        }
      );
      const payload = await readJson(response);

      if (!response.ok) {
        const message = payload?.message || payload?.error || `HTTP ${response.status}`;
        throw new Error(`EXTCALC_REVIEW_CANDIDATE_LOAD_FAILED: ${message}`);
      }

      if (!Array.isArray(payload) || payload.length === 0) return null;
      if (payload.length !== 1) {
        throw new Error('EXTCALC_REVIEW_CANDIDATE_LOAD_FAILED: resultado nao unico');
      }

      const row = payload[0];
      if (
        row.tenant_id !== tenantId ||
        row.analysis_id !== analysisId ||
        row.offer_id !== offerId ||
        row.offer_revision !== offerRevision
      ) {
        throw new Error('EXTCALC_REVIEW_CANDIDATE_LOAD_FAILED: lineage divergente');
      }

      return assertCandidateIdentity(row.candidate_snapshot);
    }
  };
}

module.exports = {
  assertCandidateIdentity,
  createPostgresReviewCandidateRepository
};
