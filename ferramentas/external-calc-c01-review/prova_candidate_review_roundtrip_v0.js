'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createC01ReviewCandidateRuntime } = require('../external-calc-c01-review-candidate-runtime/v0/candidate-runtime');
const { createC01ReviewAuthority } = require('./v0/c01-review-authority');

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../interpreter-core/v1/domains/apple-iphone-v0.schema.json'), 'utf8'));
const knowledge = JSON.parse(fs.readFileSync(path.join(__dirname, '../interpreter-core/v1/domains/apple-iphone-v0.knowledge.json'), 'utf8'));

(async () => {
  const tenantId = '00000000-0000-4000-8000-000000000001';
  const actorRef = 'user:roundtrip-v0';
  const candidates = new Map();
  const reviews = [];

  const candidateRepository = {
    async persistCandidate(candidate) {
      const key = [tenantId, candidate.analysis_id, candidate.offer_id, candidate.offer_revision].join(':');
      if (!candidates.has(key)) candidates.set(key, JSON.parse(JSON.stringify(candidate)));
      return { persisted: true };
    },
    async loadCandidate(identity) {
      const key = [identity.tenant_id, identity.analysis_id, identity.offer_id, identity.offer_revision].join(':');
      return candidates.get(key) || null;
    }
  };

  const runtime = createC01ReviewCandidateRuntime({
    trustedInputResolver: {
      async resolve({ trusted_input_ref }) {
        assert.strictEqual(trusted_input_ref, 'fixture:roundtrip-v0');
        return {
          analysis_id: 'ana_roundtrip_v0',
          source_id: 'src_roundtrip_v0',
          currency: 'BRL',
          document: {
            contract_version: 'raw-document/v1',
            document_id: 'doc_roundtrip_v0',
            content: 'iPhone 17 512GB Preto Lacrado - 8.100'
          },
          schema,
          knowledge
        };
      }
    },
    candidateRepository
  });

  const first = await runtime.execute({ trusted_input_ref: 'fixture:roundtrip-v0' });
  const second = await runtime.execute({ trusted_input_ref: 'fixture:roundtrip-v0' });
  assert.strictEqual(first.persisted_count, 1);
  assert.strictEqual(second.persisted_count, 1);
  assert.strictEqual(candidates.size, 1, 'mesma execucao deve permanecer idempotente no store');

  const ref = first.candidates[0];
  const authority = createC01ReviewAuthority({
    candidateSource: candidateRepository,
    reviewRepository: {
      async persistReview(args) {
        reviews.push(JSON.parse(JSON.stringify(args)));
        return { persisted: true, offer_revision: args.reviewed.offer_revision };
      }
    },
    clock: () => '2026-09-22T15:00:00.000Z'
  });

  const result = await authority.review({
    tenant_id: tenantId,
    actor_ref: actorRef,
    command: {
      analysis_id: first.analysis_id,
      offer_id: ref.offer_id,
      offer_revision: ref.offer_revision,
      decision: 'EDIT',
      patch: { price: { amount_minor: 799900, currency: 'BRL' } },
      reason: 'roundtrip gate'
    }
  });

  assert.strictEqual(reviews.length, 1);
  assert.strictEqual(result.c01.domain_outcome, 'VALID');
  assert.strictEqual(result.c01.offer_revision, 2);
  assert.strictEqual(result.c01.review.original_offer_revision, 1);
  assert.strictEqual(result.c01.review.reviewer_ref, actorRef);
  assert.strictEqual(result.c01.reviewed_offer.price.amount_minor, 799900);
  assert.strictEqual(result.c01.interpreted_offer.price.amount_minor, 810000);
  assert.ok(result.c01.provenance_refs.some(ref => ref.startsWith('human_review:')));

  console.log('C01_CANDIDATE_REVIEW_ROUNDTRIP_GATE_V0=PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
