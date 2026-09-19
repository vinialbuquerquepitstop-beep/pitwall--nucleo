'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  createC01ReviewAuthority,
  normalizeReviewCommand
} = require('./c01-review-authority');

const TENANT = '00000000-0000-4000-8000-000000000001';
const ACTOR = 'user:fb2aad8e-b728-4e59-a198-71da2156449d';
const REVIEWED_AT = '2026-09-19T23:30:00.000Z';

let ok = 0;

async function check(name, fn) {
  try {
    await fn();
    ok += 1;
    console.log(`OK ${ok} - ${name}`);
  } catch (error) {
    console.error(`FALHOU - ${name}`);
    throw error;
  }
}

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function candidate(overrides = {}) {
  const interpreted = {
    supplier_id: 'SUP_TESTE',
    model: {
      id: 'iphone-17-pro-256',
      label: 'iPhone 17 Pro 256GB',
      attributes: {}
    },
    capacity_gb: 256,
    condition: 'LACRADO',
    color: 'PRETO',
    price: { amount_minor: 650000, currency: 'BRL' }
  };

  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_review_001',
    source_id: 'src_review_001',
    offer_id: 'off_review_001',
    offer_revision: 1,
    stage: 'REVIEW',
    execution_status: 'SUCCEEDED',
    domain_outcome: 'REVIEW_REQUIRED',
    freshness_status: 'CURRENT',
    interpretation_run_id: 'int_review_001',
    interpretation_engine_version: 'interpreter-core/v1',
    interpretation_confidence: {
      overall: 0.98,
      by_field: {},
      record_state: 'resolved'
    },
    offer_identity_fingerprint: 'identity-review-001',
    offer_value_fingerprint: stableHash(JSON.stringify(interpreted)),
    interpreted_offer: interpreted,
    reviewed_offer: null,
    review: null,
    provenance_refs: [
      'interpretation_run:int_review_001',
      'interpreter_record:rec_review_001'
    ],
    trace: [],
    ...overrides
  };
}

function command(overrides = {}) {
  return {
    analysis_id: 'ana_review_001',
    offer_id: 'off_review_001',
    offer_revision: 1,
    decision: 'ACCEPT',
    ...overrides
  };
}

function makeHarness(options = {}) {
  const state = {
    loadCalls: [],
    persistCalls: []
  };

  const candidateSource = {
    async loadCandidate(identity) {
      state.loadCalls.push(identity);
      return options.loadedCandidate || candidate();
    }
  };

  const reviewRepository = {
    async persistReview(args) {
      state.persistCalls.push(args);
      if (options.persistError) throw options.persistError;
      return {
        review_id: '10000000-0000-4000-8000-000000000777',
        offer_revision: args.reviewed.offer_revision
      };
    }
  };

  const authority = createC01ReviewAuthority({
    candidateSource,
    reviewRepository,
    clock: () => REVIEWED_AT
  });

  return { state, authority };
}

(async () => {
  await check('ACCEPT usa actor e horario server-side e preserva revisao sem mudanca material', async () => {
    const { state, authority } = makeHarness();
    const result = await authority.review({
      tenant_id: TENANT,
      actor_ref: ACTOR,
      command: command()
    });

    assert.strictEqual(result.c01.domain_outcome, 'VALID');
    assert.strictEqual(result.c01.offer_revision, 1);
    assert.strictEqual(result.c01.review.decision, 'ACCEPT');
    assert.strictEqual(result.c01.review.reviewer_ref, ACTOR);
    assert.strictEqual(result.c01.review.reviewed_at, REVIEWED_AT);
    assert.strictEqual(result.c01.review.material_change, false);
    assert.strictEqual(state.persistCalls.length, 1);
  });

  await check('EDIT material delega ao C01 canonico e incrementa revisao', async () => {
    const { authority } = makeHarness();
    const result = await authority.review({
      tenant_id: TENANT,
      actor_ref: ACTOR,
      command: command({
        decision: 'EDIT',
        patch: {
          price: { amount_minor: 640000, currency: 'BRL' }
        },
        reason: 'preco corrigido'
      })
    });

    assert.strictEqual(result.c01.domain_outcome, 'VALID');
    assert.strictEqual(result.c01.offer_revision, 2);
    assert.strictEqual(result.c01.review.material_change, true);
    assert.strictEqual(result.c01.review.original_offer_revision, 1);
    assert.strictEqual(result.c01.review.reason, 'preco corrigido');
    assert.strictEqual(result.c01.reviewed_offer.price.amount_minor, 640000);
  });

  await check('EXCLUDE permanece outcome C01 e nao executa downstream', async () => {
    const { authority } = makeHarness();
    const result = await authority.review({
      tenant_id: TENANT,
      actor_ref: ACTOR,
      command: command({ decision: 'EXCLUDE', reason: 'fora de escopo' })
    });

    assert.strictEqual(result.c01.domain_outcome, 'EXCLUDED');
    assert.strictEqual(result.c01.reviewed_offer, null);
    assert.strictEqual(result.c01.review.reviewer_ref, ACTOR);
  });

  await check('browser nao pode escolher reviewer horario tenant candidate ou fingerprints', async () => {
    for (const [field, value] of [
      ['tenant_id', TENANT],
      ['reviewer_ref', 'client:user'],
      ['reviewed_at', '2020-01-01T00:00:00.000Z'],
      ['candidate', candidate()],
      ['c01_candidate', candidate()],
      ['offer_value_fingerprint', 'client-fp'],
      ['domain_outcome', 'VALID']
    ]) {
      assert.throws(
        () => normalizeReviewCommand({ ...command(), [field]: value }),
        /autoridade proibido/
      );
    }
  });

  await check('campo de autoridade aninhado tambem e rejeitado', async () => {
    assert.throws(
      () => normalizeReviewCommand({
        ...command(),
        patch: {
          price: { amount_minor: 640000, currency: 'BRL' },
          meta: { reviewer_ref: 'client:user' }
        }
      }),
      /autoridade proibido/
    );
  });

  await check('candidate precisa casar lineage e estar REVIEW_REQUIRED CURRENT', async () => {
    for (const loadedCandidate of [
      candidate({ offer_id: 'off_other' }),
      candidate({ domain_outcome: 'VALID' }),
      candidate({ freshness_status: 'STALE' }),
      candidate({ execution_status: 'FAILED' })
    ]) {
      const { authority } = makeHarness({ loadedCandidate });
      await assert.rejects(
        () => authority.review({
          tenant_id: TENANT,
          actor_ref: ACTOR,
          command: command()
        }),
        /(diverge|REVIEW_REQUIRED|CURRENT|SUCCEEDED)/
      );
    }
  });

  await check('falha de persistencia nao fabrica sucesso', async () => {
    const { authority } = makeHarness({
      persistError: new Error('PERSISTENCE_DOWN')
    });
    await assert.rejects(
      () => authority.review({
        tenant_id: TENANT,
        actor_ref: ACTOR,
        command: command()
      }),
      /PERSISTENCE_DOWN/
    );
  });

  await check('authority core nao reimplementa fingerprints nem regra material de C01', async () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'c01-review-authority.js'),
      'utf8'
    ).toLowerCase();

    assert.ok(source.includes('applyhumanreview'));
    for (const forbidden of [
      'createhash(',
      'sha256',
      'material_fields',
      'offeridentityfingerprint(',
      'offervaluefingerprint(',
      'reviewed_offer.price.amount_minor'
    ]) {
      assert.strictEqual(
        source.includes(forbidden),
        false,
        `regra C01 duplicada no authority core: ${forbidden}`
      );
    }
  });

  console.log(`C01_REVIEW_AUTHORITY_CORE_GATE_V0=PASS checks=${ok}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
