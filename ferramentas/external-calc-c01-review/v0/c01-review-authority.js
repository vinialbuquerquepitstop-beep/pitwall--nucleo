'use strict';

const {
  applyHumanReview
} = require('../../external-calc-c01/v1/c01-readonly-bridge');

const C01_REVIEW_AUTHORITY_VERSION = 'external-calc-c01-review-authority/v0';

const FORBIDDEN_CLIENT_KEYS = new Set([
  'tenant_id',
  'actor_id',
  'reviewer_ref',
  'reviewed_at',
  'candidate',
  'c01_candidate',
  'reviewed_offer',
  'offer_identity_fingerprint',
  'offer_value_fingerprint',
  'domain_outcome',
  'freshness_status',
  'execution_status'
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
    if (FORBIDDEN_CLIENT_KEYS.has(key)) return childPath;
    const found = findForbiddenKey(child, childPath);
    if (found) return found;
  }

  return null;
}

function normalizeReviewCommand(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    throw new Error('review command obrigatorio');
  }

  const forbidden = findForbiddenKey(command);
  if (forbidden) {
    const error = new Error(`campo de autoridade proibido no review command: ${forbidden}`);
    error.code = 'CLIENT_REVIEW_AUTHORITY_FIELD';
    throw error;
  }

  const allowed = new Set([
    'analysis_id',
    'offer_id',
    'offer_revision',
    'decision',
    'patch',
    'reason'
  ]);

  for (const key of Object.keys(command)) {
    if (!allowed.has(key)) {
      const error = new Error(`campo nao permitido no review command: ${key}`);
      error.code = 'CLIENT_REVIEW_COMMAND_FIELD';
      throw error;
    }
  }

  const revision = command.offer_revision;
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error('offer_revision invalida');
  }

  const decision = assertNonEmpty(command.decision, 'decision').toUpperCase();
  if (!['ACCEPT', 'EDIT', 'EXCLUDE', 'INVALIDATE'].includes(decision)) {
    throw new Error('decision invalida');
  }

  return {
    analysis_id: assertNonEmpty(command.analysis_id, 'analysis_id'),
    offer_id: assertNonEmpty(command.offer_id, 'offer_id'),
    offer_revision: revision,
    decision,
    patch: command.patch == null ? undefined : clone(command.patch),
    reason: command.reason == null ? undefined : String(command.reason)
  };
}

function assertCandidateMatches(candidate, command) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('C01 review candidate ausente');
  }
  if (
    candidate.analysis_id !== command.analysis_id ||
    candidate.offer_id !== command.offer_id ||
    candidate.offer_revision !== command.offer_revision
  ) {
    throw new Error('C01 review candidate diverge da referencia');
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
  return clone(candidate);
}

function createC01ReviewAuthority(options = {}) {
  const candidateSource = options.candidateSource;
  const reviewRepository = options.reviewRepository;
  const clock = options.clock || (() => new Date().toISOString());

  if (!candidateSource || typeof candidateSource.loadCandidate !== 'function') {
    throw new Error('candidateSource.loadCandidate obrigatorio');
  }
  if (!reviewRepository || typeof reviewRepository.persistReview !== 'function') {
    throw new Error('reviewRepository.persistReview obrigatorio');
  }

  return {
    version: C01_REVIEW_AUTHORITY_VERSION,

    async review(args) {
      const tenantId = assertNonEmpty(args?.tenant_id, 'tenant_id');
      const actorRef = assertNonEmpty(args?.actor_ref, 'actor_ref');
      const command = normalizeReviewCommand(args?.command);

      const candidate = assertCandidateMatches(
        await candidateSource.loadCandidate({
          tenant_id: tenantId,
          analysis_id: command.analysis_id,
          offer_id: command.offer_id,
          offer_revision: command.offer_revision
        }),
        command
      );

      const reviewedAt = assertNonEmpty(clock(), 'server reviewed_at');
      if (Number.isNaN(Date.parse(reviewedAt))) {
        throw new Error('server reviewed_at deve ser ISO date-time');
      }

      const reviewed = applyHumanReview(candidate, {
        decision: command.decision,
        reviewer_ref: actorRef,
        reviewed_at: reviewedAt,
        ...(command.patch === undefined ? {} : { patch: command.patch }),
        ...(command.reason === undefined ? {} : { reason: command.reason })
      });

      const persisted = await reviewRepository.persistReview({
        tenant_id: tenantId,
        actor_ref: actorRef,
        candidate,
        reviewed
      });

      return {
        authority_version: C01_REVIEW_AUTHORITY_VERSION,
        persisted: persisted == null ? null : clone(persisted),
        c01: clone(reviewed)
      };
    }
  };
}

module.exports = {
  C01_REVIEW_AUTHORITY_VERSION,
  FORBIDDEN_CLIENT_KEYS,
  findForbiddenKey,
  normalizeReviewCommand,
  createC01ReviewAuthority
};
