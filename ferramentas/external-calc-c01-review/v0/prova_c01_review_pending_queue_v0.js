'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  createPostgresReviewCandidateRepository
} = require('./postgres-review-candidate-repository');

const URL = 'https://example.supabase.co';
const ANON = 'anon-pending-queue-fixture';
const TOKEN = 'jwt-pending-queue-fixture';

function candidate() {
  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_pending_queue_001',
    source_id: 'src_pending_queue_001',
    offer_id: 'off_pending_queue_001',
    offer_revision: 1,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'REVIEW_REQUIRED',
    freshness_status: 'CURRENT',
    interpretation_run_id: 'int_pending_queue_001',
    offer_identity_fingerprint: 'identity-pending-queue-001',
    offer_value_fingerprint: 'value-pending-queue-001',
    interpreted_offer: {
      supplier_id: 'SUP_TESTE',
      model: { id: 'iphone-17-pro-256', label: 'iPhone 17 Pro 256GB', attributes: {} },
      capacity_gb: 256,
      condition: 'LACRADO',
      color: 'PRETO',
      price: { amount_minor: 650000, currency: 'BRL' }
    },
    reviewed_offer: null,
    review: null
  };
}

(async () => {
  let captured = null;
  const repository = createPostgresReviewCandidateRepository({
    supabaseUrl: URL,
    anonKey: ANON,
    accessToken: TOKEN,
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify([
        { candidate_snapshot: candidate(), criado_em: '2026-09-22T18:00:00.000Z' }
      ]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });

  const queue = await repository.listPendingCandidates({ limit: 25 });

  assert.strictEqual(queue.length, 1);
  assert.strictEqual(queue[0].domain_outcome, 'REVIEW_REQUIRED');
  assert.ok(captured.url.endsWith('/rest/v1/rpc/extcalc_list_pending_review_candidates_v0'));
  assert.strictEqual(captured.init.method, 'POST');
  assert.strictEqual(captured.init.headers.authorization, `Bearer ${TOKEN}`);
  assert.strictEqual(captured.init.headers.apikey, ANON);
  assert.deepStrictEqual(JSON.parse(captured.init.body), { p_limit: 25 });

  const sql = fs.readFileSync(
    path.join(
      __dirname,
      '../../../supabase/migrations/20260922184500_external_calc_c01_review_pending_queue_v0.sql'
    ),
    'utf8'
  ).toLowerCase();

  for (const required of [
    'create or replace function public.extcalc_list_pending_review_candidates_v0',
    'security definer',
    'auth.uid()',
    'privado.fn_tenant_atual()',
    'privado.fn_papel_atual()',
    'from public.extcalc_review_candidate c',
    'not exists',
    'from public.extcalc_human_review h',
    "review_snapshot->>'original_offer_revision'",
    'h.offer_revision',
    '= c.offer_revision',
    'grant execute on function public.extcalc_list_pending_review_candidates_v0(integer)'
  ]) {
    assert.ok(sql.includes(required), `migration sem: ${required}`);
  }

  for (const forbidden of [
    'applyhumanreview',
    'calculatec02(',
    'runc03research(',
    'runc04priceindicator(',
    'composedecisionoutput(',
    'service_role',
    'delete from public.extcalc_review_candidate',
    'update public.extcalc_review_candidate'
  ]) {
    assert.strictEqual(sql.includes(forbidden), false, `regra/efeito proibido: ${forbidden}`);
  }

  console.log('C01_REVIEW_PENDING_QUEUE_GATE_V0=PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
