'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  createPostgresReviewResultRepository,
  assertReviewResult
} = require('./postgres-review-result-repository');

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

const TENANT = '00000000-0000-4000-8000-000000000001';
const ACTOR = '11111111-1111-4111-8111-111111111111';

function candidate() {
  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_review_result_001',
    source_id: 'src_review_result_001',
    offer_id: 'off_review_result_001',
    offer_revision: 3,
    interpretation_run_id: 'interp_review_result_001',
    execution_status: 'SUCCEEDED',
    domain_outcome: 'REVIEW_REQUIRED',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-review-result-001',
    offer_value_fingerprint: 'value-review-result-001-r3',
    interpreted_offer: {
      supplier_id: 'SUP_TESTE',
      model: { id: 'iphone-17-pro-256', label: 'iPhone 17 Pro 256GB', attributes: {} },
      capacity_gb: 256,
      condition: 'LACRADO',
      color: 'PRETO',
      price: { amount_minor: 650000, currency: 'BRL' }
    },
    reviewed_offer: null,
    review: null,
    provenance_refs: ['interpreter:review-result-fixture']
  };
}

function accepted() {
  const c = candidate();
  return {
    ...c,
    domain_outcome: 'VALID',
    reviewed_offer: JSON.parse(JSON.stringify(c.interpreted_offer)),
    review: {
      decision: 'ACCEPT',
      reviewer_ref: ACTOR,
      reviewed_at: '2026-09-19T23:30:00.000Z',
      reason: null,
      material_change: false,
      original_offer_revision: 3
    },
    provenance_refs: [...c.provenance_refs, `human_review:${ACTOR}:2026-09-19T23:30:00.000Z`]
  };
}

function edited() {
  const a = accepted();
  return {
    ...a,
    offer_revision: 4,
    offer_value_fingerprint: 'value-review-result-001-r4',
    reviewed_offer: {
      ...a.reviewed_offer,
      color: 'AZUL'
    },
    review: {
      ...a.review,
      decision: 'EDIT',
      material_change: true
    }
  };
}

function excluded() {
  const c = candidate();
  return {
    ...c,
    domain_outcome: 'EXCLUDED',
    reviewed_offer: null,
    review: {
      decision: 'EXCLUDE',
      reviewer_ref: ACTOR,
      reviewed_at: '2026-09-19T23:31:00.000Z',
      reason: 'fora do escopo',
      material_change: false
    },
    provenance_refs: c.provenance_refs
  };
}

(async () => {
  await check('ACCEPT sem mudanca preserva offer_revision', async () => {
    const normalized = assertReviewResult({
      tenant_id: TENANT,
      actor_ref: ACTOR,
      candidate: candidate(),
      reviewed: accepted()
    });
    assert.strictEqual(normalized.reviewed.offer_revision, 3);
  });

  await check('EDIT material exige revision +1', async () => {
    const normalized = assertReviewResult({
      tenant_id: TENANT,
      actor_ref: ACTOR,
      candidate: candidate(),
      reviewed: edited()
    });
    assert.strictEqual(normalized.reviewed.offer_revision, 4);
  });

  await check('EXCLUDE preserva revision sem exigir original_offer_revision', async () => {
    const normalized = assertReviewResult({
      tenant_id: TENANT,
      actor_ref: ACTOR,
      candidate: candidate(),
      reviewed: excluded()
    });
    assert.strictEqual(normalized.reviewed.offer_revision, 3);
    assert.strictEqual(normalized.reviewed.domain_outcome, 'EXCLUDED');
  });


  await check('revision divergente falha antes da rede', async () => {
    const bad = edited();
    bad.offer_revision = 5;
    assert.throws(
      () => assertReviewResult({
        tenant_id: TENANT,
        actor_ref: ACTOR,
        candidate: candidate(),
        reviewed: bad
      }),
      /offer_revision final diverge/
    );
  });

  await check('repository envia somente p_reviewed para RPC', async () => {
    let captured = null;
    const repository = createPostgresReviewResultRepository({
      supabaseUrl: 'https://example.supabase.co',
      anonKey: 'anon-fixture',
      accessToken: 'jwt-fixture',
      fetchImpl: async (url, init) => {
        captured = { url, init };
        return new Response(JSON.stringify({
          ok: true,
          analysis_id: accepted().analysis_id,
          offer_id: accepted().offer_id,
          offer_revision: accepted().offer_revision,
          review_id: '22222222-2222-4222-8222-222222222222'
        }), { status: 200 });
      }
    });

    const result = await repository.persistReview({
      tenant_id: TENANT,
      actor_ref: ACTOR,
      candidate: candidate(),
      reviewed: accepted()
    });

    assert.strictEqual(result.ok, true);
    assert.ok(captured.url.endsWith('/rest/v1/rpc/extcalc_persist_review_result_v0'));
    const body = JSON.parse(captured.init.body);
    assert.deepStrictEqual(Object.keys(body), ['p_reviewed']);
    assert.strictEqual(body.p_reviewed.analysis_id, accepted().analysis_id);
    assert.strictEqual(JSON.stringify(body).includes('tenant_id'), false);
    assert.strictEqual(JSON.stringify(body).includes('actor_ref'), false);
  });

  await check('migration deriva tenant/ator e nao recalcula C01', async () => {
    const sql = fs.readFileSync(
      path.join(__dirname, '../../../supabase/migrations/20260919232500_external_calc_c01_review_result_v0.sql'),
      'utf8'
    ).toLowerCase();

    assert.ok(sql.includes('privado.fn_tenant_atual()'));
    assert.ok(sql.includes('privado.fn_papel_atual()'));
    assert.ok(sql.includes('auth.uid()'));
    assert.ok(sql.includes('security definer'));
    assert.ok(sql.includes('extcalc_review_candidate'));
    assert.ok(sql.includes('extcalc_offer_revision'));
    assert.ok(sql.includes('extcalc_human_review'));

    for (const forbidden of [
      'applyhumanreview',
      'offervaluefingerprint(',
      'offeridentityfingerprint(',
      'calculatec02(',
      'runc03research(',
      'runc04priceindicator(',
      'composedecisionoutput(',
      'service_role'
    ]) {
      assert.strictEqual(sql.includes(forbidden), false, `regra/segredo proibido no SQL: ${forbidden}`);
    }
  });

  await check('candidate store permanece separado e imutavel', async () => {
    const sql = fs.readFileSync(
      path.join(__dirname, '../../../supabase/migrations/20260919232500_external_calc_c01_review_result_v0.sql'),
      'utf8'
    ).toLowerCase();

    assert.strictEqual(/update\s+public\.extcalc_review_candidate/.test(sql), false);
    assert.strictEqual(/delete\s+from\s+public\.extcalc_review_candidate/.test(sql), false);
  });

  console.log(`C01_REVIEW_RESULT_PERSISTENCE_GATE_V0=PASS checks=${ok}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
