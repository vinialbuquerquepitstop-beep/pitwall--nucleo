'use strict';

const {
  runC01ReadOnlySlice
} = require('../../external-calc-c01/v1/c01-readonly-bridge');

function assertObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} obrigatorio`);
  }
  return value;
}

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} obrigatorio`);
  return value.trim();
}

function createC01ReviewCandidateRuntime(options = {}) {
  const trustedInputResolver = options.trustedInputResolver;
  const candidateRepository = options.candidateRepository;

  if (!trustedInputResolver || typeof trustedInputResolver.resolve !== 'function') {
    throw new Error('trustedInputResolver.resolve obrigatorio');
  }
  if (!candidateRepository || typeof candidateRepository.persistCandidate !== 'function') {
    throw new Error('candidateRepository.persistCandidate obrigatorio');
  }

  return {
    async execute(command) {
      assertObject(command, 'command');
      const trustedRef = assertNonEmpty(command.trusted_input_ref, 'trusted_input_ref');

      const resolved = await trustedInputResolver.resolve({
        trusted_input_ref: trustedRef
      });
      assertObject(resolved, 'trusted input resolvido');

      const queue = runC01ReadOnlySlice({
        analysis_id: assertNonEmpty(resolved.analysis_id, 'resolved.analysis_id'),
        source_id: assertNonEmpty(resolved.source_id, 'resolved.source_id'),
        currency: assertNonEmpty(resolved.currency, 'resolved.currency'),
        document: assertObject(resolved.document, 'resolved.document'),
        schema: assertObject(resolved.schema, 'resolved.schema'),
        knowledge: resolved.knowledge || null,
        supplier_profiles: resolved.supplier_profiles || null
      });

      const persisted = [];
      for (const candidate of queue.candidates) {
        if (candidate.domain_outcome !== 'REVIEW_REQUIRED') continue;
        persisted.push(await candidateRepository.persistCandidate(candidate));
      }

      return {
        contract_version: 'external-calc-c01-review-candidate-runtime/v0',
        analysis_id: queue.analysis_id,
        source_id: queue.source_id,
        interpretation_run_id: queue.interpretation_run_id,
        stage: 'REVIEW',
        execution_status: 'SUCCEEDED',
        candidates: queue.candidates.map(candidate => ({
          offer_id: candidate.offer_id,
          offer_revision: candidate.offer_revision,
          domain_outcome: candidate.domain_outcome
        })),
        persisted_count: persisted.length,
        unresolved_ambiguities: queue.unresolved_ambiguities,
        invalid_items: queue.invalid_items,
        warnings: queue.warnings,
        metrics: { ...queue.metrics }
      };
    }
  };
}

module.exports = {
  createC01ReviewCandidateRuntime
};
