'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { createExternalCalcWorkerRuntime } = require('./runtime');

const TENANT = '00000000-0000-4000-8000-000000000001';
const USER = '11111111-1111-4111-8111-111111111111';
const SUPABASE_URL = 'https://example.supabase.co';
const ANON_KEY = 'anon-fixture';
const TOKEN = 'user-token-fixture';
const FIXED_TIME = '2026-09-19T23:45:00.000Z';

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

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function candidate() {
  const interpretedOffer = {
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
    analysis_id: 'ana_review_runtime_001',
    source_id: 'src_review_runtime_001',
    offer_id: 'off_review_runtime_001',
    offer_revision: 1,
    interpretation_run_id: 'interp_review_runtime_001',
    execution_status: 'SUCCEEDED',
    domain_outcome: 'REVIEW_REQUIRED',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: sha256(JSON.stringify({
      supplier_id: interpretedOffer.supplier_id,
      model: interpretedOffer.model.id,
      capacity_gb: interpretedOffer.capacity_gb,
      condition: interpretedOffer.condition,
      color: interpretedOffer.color
    })),
    offer_value_fingerprint: sha256(JSON.stringify(interpretedOffer)),
    interpreted_offer: interpretedOffer,
    reviewed_offer: null,
    review: null,
    provenance_refs: ['interpreter:review-runtime-fixture']
  };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function makeBackend(options = {}) {
  const state = {
    authCalls: 0,
    profileCalls: 0,
    candidateCalls: 0,
    persistReviewCalls: 0,
    persistedBody: null
  };
  const role = options.role || 'dono';
  const authenticated = options.authenticated !== false;

  async function fetchImpl(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;

    if (url === SUPABASE_URL + '/auth/v1/user') {
      state.authCalls += 1;
      if (!authenticated) return jsonResponse({ message: 'invalid token' }, 401);
      return jsonResponse({ id: USER });
    }

    if (url.startsWith(SUPABASE_URL + '/rest/v1/app_usuario?')) {
      state.profileCalls += 1;
      return jsonResponse([{
        tenant_id: TENANT,
        papel: role,
        ativo: true
      }]);
    }

    if (url.startsWith(SUPABASE_URL + '/rest/v1/extcalc_review_candidate?')) {
      state.candidateCalls += 1;
      return jsonResponse([{
        tenant_id: TENANT,
        analysis_id: candidate().analysis_id,
        offer_id: candidate().offer_id,
        offer_revision: candidate().offer_revision,
        candidate_snapshot: candidate()
      }]);
    }

    if (url === SUPABASE_URL + '/rest/v1/rpc/extcalc_persist_review_result_v0') {
      state.persistReviewCalls += 1;
      assert.strictEqual(init.headers.authorization, `Bearer ${TOKEN}`);
      assert.strictEqual(init.headers.apikey, ANON_KEY);
      state.persistedBody = JSON.parse(init.body);
      return jsonResponse({
        ok: true,
        analysis_id: candidate().analysis_id,
        offer_id: candidate().offer_id,
        offer_revision: 1,
        review_id: '22222222-2222-4222-8222-222222222222'
      });
    }

    throw new Error(`fetch inesperado: ${url}`);
  }

  return { state, fetchImpl };
}

function makeRuntime(backend) {
  return createExternalCalcWorkerRuntime({
    env: {
      SUPABASE_URL,
      SUPABASE_ANON_KEY: ANON_KEY
    },
    fetchImpl: backend.fetchImpl,
    clock: () => FIXED_TIME
  });
}

function request(body, token = TOKEN, origin = null) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (origin) headers.origin = origin;
  return new Request('https://pitwall.test/api/external-calc/v0/review', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

async function bodyOf(response) {
  return JSON.parse(await response.text());
}

(async () => {
  await check('runtime review usa JWT para tenant ator candidate e persistencia', async () => {
    const backend = makeBackend();
    const runtime = makeRuntime(backend);
    const response = await runtime.fetch(request({
      analysis_id: candidate().analysis_id,
      offer_id: candidate().offer_id,
      offer_revision: 1,
      decision: 'ACCEPT'
    }));
    const body = await bodyOf(response);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(body.domain_outcome, 'VALID');
    assert.strictEqual(body.offer_revision, 1);
    assert.strictEqual(body.c01.review.decision, 'ACCEPT');
    assert.strictEqual(body.c01.review.reviewer_ref, USER);
    assert.strictEqual(body.c01.review.reviewed_at, FIXED_TIME);
    assert.strictEqual(backend.state.candidateCalls, 1);
    assert.strictEqual(backend.state.persistReviewCalls, 1);
    assert.ok(backend.state.persistedBody.p_reviewed);
    assert.strictEqual(backend.state.persistedBody.p_reviewed.review.reviewer_ref, USER);
    assert.strictEqual(JSON.stringify(backend.state.persistedBody).includes('tenant_id'), false);
  });

  await check('runtime review rejeita reviewer_ref do browser antes de consultar candidate', async () => {
    const backend = makeBackend();
    const runtime = makeRuntime(backend);
    const response = await runtime.fetch(request({
      analysis_id: candidate().analysis_id,
      offer_id: candidate().offer_id,
      offer_revision: 1,
      decision: 'ACCEPT',
      reviewer_ref: 'client-controlled'
    }));
    const body = await bodyOf(response);

    assert.strictEqual(response.status, 400);
    assert.strictEqual(body.error.code, 'CLIENT_REVIEW_AUTHORITY_FIELD');
    assert.strictEqual(backend.state.candidateCalls, 0);
    assert.strictEqual(backend.state.persistReviewCalls, 0);
  });

  await check('runtime review sem JWT responde 401 sem banco de review', async () => {
    const backend = makeBackend({ authenticated: false });
    const runtime = makeRuntime(backend);
    const response = await runtime.fetch(request({
      analysis_id: candidate().analysis_id,
      offer_id: candidate().offer_id,
      offer_revision: 1,
      decision: 'ACCEPT'
    }, null));

    assert.strictEqual(response.status, 401);
    assert.strictEqual(backend.state.candidateCalls, 0);
    assert.strictEqual(backend.state.persistReviewCalls, 0);
  });

  await check('runtime review com validador beta permite revisao auditavel', async () => {
    const backend = makeBackend({ role: 'validador' });
    const runtime = makeRuntime(backend);
    const response = await runtime.fetch(request({
      analysis_id: candidate().analysis_id,
      offer_id: candidate().offer_id,
      offer_revision: 1,
      decision: 'ACCEPT'
    }));
    const body = await bodyOf(response);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(body.c01.review.reviewer_ref, USER);
    assert.strictEqual(backend.state.persistReviewCalls, 1);
  });

  await check('runtime review com vendedor responde 403 sem banco de review', async () => {
    const backend = makeBackend({ role: 'vendedor' });
    const runtime = makeRuntime(backend);
    const response = await runtime.fetch(request({
      analysis_id: candidate().analysis_id,
      offer_id: candidate().offer_id,
      offer_revision: 1,
      decision: 'ACCEPT'
    }));

    assert.strictEqual(response.status, 403);
    assert.strictEqual(backend.state.candidateCalls, 0);
    assert.strictEqual(backend.state.persistReviewCalls, 0);
  });

  await check('EDIT material e calculado pelo Core e persiste revision +1', async () => {
    const backend = makeBackend();
    backend.fetchImpl = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url === SUPABASE_URL + '/auth/v1/user') return jsonResponse({ id: USER });
      if (url.startsWith(SUPABASE_URL + '/rest/v1/app_usuario?')) {
        return jsonResponse([{ tenant_id: TENANT, papel: 'dono', ativo: true }]);
      }
      if (url.startsWith(SUPABASE_URL + '/rest/v1/extcalc_review_candidate?')) {
        return jsonResponse([{
          tenant_id: TENANT,
          analysis_id: candidate().analysis_id,
          offer_id: candidate().offer_id,
          offer_revision: 1,
          candidate_snapshot: candidate()
        }]);
      }
      if (url === SUPABASE_URL + '/rest/v1/rpc/extcalc_persist_review_result_v0') {
        backend.state.persistReviewCalls += 1;
        backend.state.persistedBody = JSON.parse(init.body);
        return jsonResponse({
          ok: true,
          analysis_id: candidate().analysis_id,
          offer_id: candidate().offer_id,
          offer_revision: 2,
          review_id: '33333333-3333-4333-8333-333333333333'
        });
      }
      throw new Error(`fetch inesperado: ${url}`);
    };

    const runtime = makeRuntime(backend);
    const response = await runtime.fetch(request({
      analysis_id: candidate().analysis_id,
      offer_id: candidate().offer_id,
      offer_revision: 1,
      decision: 'EDIT',
      patch: { color: 'AZUL' }
    }));
    const body = await bodyOf(response);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(body.offer_revision, 2);
    assert.strictEqual(body.c01.review.material_change, true);
    assert.strictEqual(body.c01.review.original_offer_revision, 1);
    assert.strictEqual(backend.state.persistedBody.p_reviewed.offer_revision, 2);
  });

  await check('runtime responde preflight CORS do Preview sem autenticar', async () => {
    const backend = makeBackend();
    const runtime = makeRuntime(backend);
    const origin = 'https://external-calc-frontend-v1-preview-8baw1ij9y-pits4.vercel.app';
    const response = await runtime.fetch(new Request(
      'https://pitwall.test/api/external-calc/v0/review',
      {
        method: 'OPTIONS',
        headers: {
          origin,
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'authorization'
        }
      }
    ));

    assert.strictEqual(response.status, 204);
    assert.strictEqual(response.headers.get('access-control-allow-origin'), origin);
    assert.ok(response.headers.get('access-control-allow-methods').includes('GET'));
    assert.ok(response.headers.get('access-control-allow-headers').includes('authorization'));
    assert.strictEqual(backend.state.authCalls, 0);
  });

  await check('runtime inclui CORS na resposta autenticada do Preview', async () => {
    const backend = makeBackend();
    const runtime = makeRuntime(backend);
    const origin = 'https://external-calc-frontend-v1-preview-8baw1ij9y-pits4.vercel.app';
    const response = await runtime.fetch(request({
      analysis_id: candidate().analysis_id,
      offer_id: candidate().offer_id,
      offer_revision: 1,
      decision: 'ACCEPT'
    }, TOKEN, origin));

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('access-control-allow-origin'), origin);
    assert.strictEqual(response.headers.get('vary'), 'Origin');
  });

  await check('runtime nao contem regra C01 local nem service_role', async () => {
    const source = fs.readFileSync(path.join(__dirname, 'runtime.js'), 'utf8').toLowerCase();

    for (const token of [
      'applyhumanreview(',
      'offervaluefingerprint(',
      'offeridentityfingerprint(',
      'service_role',
      'supabase_service_role_key'
    ]) {
      assert.strictEqual(source.includes(token), false, `runtime contem regra/segredo proibido: ${token}`);
    }

    assert.ok(source.includes('createc01reviewauthority'));
    assert.ok(source.includes('createpostgresreviewcandidaterepository'));
    assert.ok(source.includes('createpostgresreviewresultrepository'));
  });

  console.log(`C01_REVIEW_RUNTIME_API_GATE_V0=PASS checks=${ok}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
