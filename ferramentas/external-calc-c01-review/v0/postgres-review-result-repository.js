'use strict';

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} obrigatorio`);
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
  try { return JSON.parse(text); }
  catch { throw new Error(`Supabase respondeu JSON invalido: ${text.slice(0, 160)}`); }
}

function assertReviewResult(args = {}) {
  const tenantId = assertNonEmpty(args.tenant_id, 'tenant_id');
  const actorRef = assertNonEmpty(args.actor_ref, 'actor_ref');
  const candidate = args.candidate;
  const reviewed = args.reviewed;

  if (!candidate || candidate.contract_version !== 'external-calc-c01-readonly/v1') {
    throw new Error('candidate C01 invalido');
  }
  if (candidate.domain_outcome !== 'REVIEW_REQUIRED' || candidate.reviewed_offer !== null) {
    throw new Error('candidate precisa estar REVIEW_REQUIRED pre-review');
  }
  if (!reviewed || reviewed.contract_version !== candidate.contract_version) {
    throw new Error('reviewed C01 invalido');
  }
  if (reviewed.analysis_id !== candidate.analysis_id || reviewed.offer_id !== candidate.offer_id) {
    throw new Error('reviewed C01 perdeu lineage');
  }
  const review = reviewed.review;
  if (!review || typeof review !== 'object') throw new Error('review ausente');
  if (review.reviewer_ref !== actorRef) throw new Error('reviewer_ref diverge do ator');
  if (review.original_offer_revision !== candidate.offer_revision) {
    throw new Error('review.original_offer_revision diverge do candidate');
  }

  const material = review.material_change === true;
  const expectedRevision = candidate.offer_revision + (material ? 1 : 0);
  if (reviewed.offer_revision !== expectedRevision) {
    throw new Error('offer_revision final diverge da materialidade produzida pelo Core');
  }

  const decision = assertNonEmpty(review.decision, 'review.decision').toUpperCase();
  if (!['ACCEPT', 'EDIT', 'EXCLUDE', 'INVALIDATE'].includes(decision)) {
    throw new Error('review.decision invalida');
  }

  if (reviewed.domain_outcome === 'VALID') {
    if (!reviewed.reviewed_offer || typeof reviewed.reviewed_offer !== 'object') {
      throw new Error('reviewed_offer obrigatorio para VALID');
    }
  } else if (!['EXCLUDED', 'INVALID'].includes(reviewed.domain_outcome)) {
    throw new Error('domain_outcome final invalido');
  }

  return { tenantId, actorRef, candidate: clone(candidate), reviewed: clone(reviewed) };
}

function createPostgresReviewResultRepository(options = {}) {
  const supabaseUrl = assertNonEmpty(options.supabaseUrl, 'supabaseUrl');
  const anonKey = assertNonEmpty(options.anonKey, 'anonKey');
  const accessToken = assertNonEmpty(options.accessToken, 'accessToken');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl obrigatorio');

  return {
    async persistReview(args) {
      const normalized = assertReviewResult(args);
      const response = await fetchImpl(
        joinUrl(supabaseUrl, '/rest/v1/rpc/extcalc_persist_review_result_v0'),
        {
          method: 'POST',
          headers: authHeaders(anonKey, accessToken),
          body: JSON.stringify({ p_reviewed: normalized.reviewed })
        }
      );
      const payload = await readJson(response);
      if (!response.ok) {
        const message = payload?.message || payload?.error || `HTTP ${response.status}`;
        throw new Error(`EXTCALC_REVIEW_RESULT_PERSIST_FAILED: ${message}`);
      }
      return clone(payload);
    }
  };
}

module.exports = {
  assertReviewResult,
  createPostgresReviewResultRepository
};
