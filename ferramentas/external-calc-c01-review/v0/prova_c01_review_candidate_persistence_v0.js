'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  assertCandidateIdentity,
  createPostgresReviewCandidateRepository
} = require('./postgres-review-candidate-repository');

const TENANT = '00000000-0000-4000-8000-000000000001';
const TOKEN = 'jwt-review-candidate-fixture';
const ANON = 'anon-review-candidate-fixture';
const URL = 'https://example.supabase.co';

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

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function candidate(overrides = {}) {
  const offer = {
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
    analysis_id: 'ana_candidate_001',
    source_id: 'src_candidate_001',
    offer_id: 'off_candidate_001',
    offer_revision: 1,
    stage: 'REVIEW',
    execution_status: 'SUCCEEDED',
    domain_outcome: 'REVIEW_REQUIRED',
    freshness_status: 'CURRENT',
    interpretation_run_id: 'int_candidate_001',
    interpretation_engine_version: 'interpreter-core/v1',
    interpretation_confidence: {
      overall: 0.98,
      by_field: {},
      record_state: 'resolved'
    },
    offer_identity_fingerprint: 'identity-candidate-001',
    offer_value_fingerprint: hash(JSON.stringify(offer)),
    interpreted_offer: offer,
    reviewed_offer: null,
    review: null,
    provenance_refs: [
      'interpretation_run:int_candidate_001',
      'interpreter_record:rec_candidate_001'
    ],
    trace: [],
    ...overrides
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function makeBackend() {
  const state = {
    stored: null,
    persistCalls: [],
    loadCalls: []
  };

  async function fetchImpl(url, init = {}) {
    const method = String(init.method || 'GET').toUpperCase();

    if (url === URL + '/rest/v1/rpc/extcalc_persist_review_candidate_v0') {
      state.persistCalls.push({ url, init });
      assert.strictEqual(method, 'POST');
      assert.strictEqual(init.headers.authorization, `Bearer ${TOKEN}`);
      assert.strictEqual(init.headers.apikey, ANON);

      const payload = JSON.parse(init.body);
      assert.deepStrictEqual(Object.keys(payload), ['p_candidate']);
      assert.strictEqual(payload.p_candidate.tenant_id, undefined);

      const incoming = payload.p_candidate;
      if (state.stored) {
        if (JSON.stringify(state.stored) !== JSON.stringify(incoming)) {
          return json({ message: 'EXTCALC_REVIEW_CANDIDATE_CONFLICT' }, 409);
        }
        return json({
          ok: true,
          analysis_id: incoming.analysis_id,
          offer_id: incoming.offer_id,
          offer_revision: incoming.offer_revision,
          idempotent: true
        });
      }

      state.stored = JSON.parse(JSON.stringify(incoming));
      return json({
        ok: true,
        analysis_id: incoming.analysis_id,
        offer_id: incoming.offer_id,
        offer_revision: incoming.offer_revision,
        idempotent: false
      });
    }

    if (url.startsWith(URL + '/rest/v1/extcalc_review_candidate?')) {
      state.loadCalls.push({ url, init });
      assert.strictEqual(method, 'GET');
      assert.strictEqual(init.headers.authorization, `Bearer ${TOKEN}`);
      assert.ok(url.includes(encodeURIComponent(`eq.${TENANT}`)));

      if (!state.stored) return json([]);

      return json([{
        tenant_id: TENANT,
        analysis_id: state.stored.analysis_id,
        offer_id: state.stored.offer_id,
        offer_revision: state.stored.offer_revision,
        candidate_snapshot: state.stored
      }]);
    }

    throw new Error(`fetch inesperado: ${method} ${url}`);
  }

  return { state, fetchImpl };
}

(async () => {
  await check('candidate valido e estritamente pre-review', async () => {
    const normalized = assertCandidateIdentity(candidate());
    assert.strictEqual(normalized.domain_outcome, 'REVIEW_REQUIRED');
    assert.strictEqual(normalized.reviewed_offer, null);
    assert.strictEqual(normalized.review, null);
  });

  await check('persistencia envia snapshot sem tenant escolhido pelo cliente', async () => {
    const backend = makeBackend();
    const repository = createPostgresReviewCandidateRepository({
      supabaseUrl: URL,
      anonKey: ANON,
      accessToken: TOKEN,
      fetchImpl: backend.fetchImpl
    });

    const result = await repository.persistCandidate(candidate());

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.idempotent, false);
    assert.strictEqual(backend.state.persistCalls.length, 1);
  });

  await check('mesmo candidate e idempotente', async () => {
    const backend = makeBackend();
    const repository = createPostgresReviewCandidateRepository({
      supabaseUrl: URL,
      anonKey: ANON,
      accessToken: TOKEN,
      fetchImpl: backend.fetchImpl
    });

    await repository.persistCandidate(candidate());
    const second = await repository.persistCandidate(candidate());

    assert.strictEqual(second.idempotent, true);
  });

  await check('roundtrip persiste e carrega exatamente o snapshot', async () => {
    const backend = makeBackend();
    const repository = createPostgresReviewCandidateRepository({
      supabaseUrl: URL,
      anonKey: ANON,
      accessToken: TOKEN,
      fetchImpl: backend.fetchImpl
    });

    const original = candidate();
    await repository.persistCandidate(original);
    const loaded = await repository.loadCandidate({
      tenant_id: TENANT,
      analysis_id: original.analysis_id,
      offer_id: original.offer_id,
      offer_revision: original.offer_revision
    });

    assert.deepStrictEqual(loaded, original);
    assert.strictEqual(backend.state.loadCalls.length, 1);
  });

  await check('estado que nao e REVIEW_REQUIRED falha antes de rede', async () => {
    let calls = 0;
    const repository = createPostgresReviewCandidateRepository({
      supabaseUrl: URL,
      anonKey: ANON,
      accessToken: TOKEN,
      fetchImpl: async () => {
        calls += 1;
        throw new Error('nao deveria chamar rede');
      }
    });

    await assert.rejects(
      () => repository.persistCandidate(candidate({ domain_outcome: 'VALID' })),
      /REVIEW_REQUIRED/
    );
    assert.strictEqual(calls, 0);
  });

  await check('snapshot com review previo falha antes de rede', async () => {
    let calls = 0;
    const repository = createPostgresReviewCandidateRepository({
      supabaseUrl: URL,
      anonKey: ANON,
      accessToken: TOKEN,
      fetchImpl: async () => {
        calls += 1;
        throw new Error('nao deveria chamar rede');
      }
    });

    await assert.rejects(
      () => repository.persistCandidate(candidate({
        review: {
          decision: 'ACCEPT',
          reviewer_ref: 'client',
          reviewed_at: '2026-09-19T00:00:00.000Z'
        }
      })),
      /pre-review/
    );
    assert.strictEqual(calls, 0);
  });

  await check('migration usa store separado, RLS e writer transacional autenticado', async () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        '../../../supabase/migrations/20260919231000_external_calc_c01_review_candidate_v0.sql'
      ),
      'utf8'
    ).toLowerCase();

    for (const required of [
      'create table if not exists public.extcalc_review_candidate',
      'enable row level security',
      'privado.fn_tenant_atual()',
      "privado.fn_papel_atual() = 'dono'",
      'security definer',
      'auth.uid()',
      'extcalc_review_candidate_conflict',
      'revoke all on public.extcalc_review_candidate from anon, authenticated',
      'grant select on public.extcalc_review_candidate to authenticated',
      'revoke all on function public.extcalc_persist_review_candidate_v0(jsonb)',
      'grant execute on function public.extcalc_persist_review_candidate_v0(jsonb)'
    ]) {
      assert.ok(sql.includes(required), `migration sem: ${required}`);
    }

    assert.strictEqual(
      /update\s+public\.extcalc_offer_revision/.test(sql),
      false,
      'candidate store nao pode reescrever offer_revision final'
    );
    assert.strictEqual(
      /delete\s+from\s+public\.extcalc_offer_revision/.test(sql),
      false,
      'candidate store nao pode apagar offer_revision final'
    );
  });

  await check('candidate persistence nao usa service_role nem executa regra de review', async () => {
    const files = [
      path.join(__dirname, 'postgres-review-candidate-repository.js'),
      path.join(
        __dirname,
        '../../../supabase/migrations/20260919231000_external_calc_c01_review_candidate_v0.sql'
      )
    ];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8').toLowerCase();
      assert.strictEqual(source.includes('service_role'), false);
      assert.strictEqual(source.includes('applyhumanreview'), false);
      assert.strictEqual(source.includes('offeridentityfingerprint('), false);
      assert.strictEqual(source.includes('offervaluefingerprint('), false);
    }
  });

  console.log(`C01_REVIEW_CANDIDATE_PERSISTENCE_GATE_V0=PASS checks=${ok}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
