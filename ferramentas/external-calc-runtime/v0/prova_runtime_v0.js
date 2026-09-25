'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  createExternalCalcWorkerRuntime
} = require('./runtime');
const {
  buildCurrentOfferEvidence
} = require('../../external-calc-research-provider/v0/current-offers-evidence');

const TENANT_A = '00000000-0000-4000-8000-000000000001';
const USER_A = 'fb2aad8e-b728-4e59-a198-71da2156449d';
const SUPABASE_URL = 'https://example.supabase.co';
const ANON_KEY = 'anon-public-fixture';
const TOKEN = 'user-access-token-fixture';
const FIXED_TIME = '2026-09-19T21:15:00.000Z';

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

function c01Candidate() {
  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_runtime_001',
    source_id: 'src_runtime_001',
    offer_id: 'off_runtime_001',
    offer_revision: 1,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-runtime-001',
    offer_value_fingerprint: 'value-runtime-001-r1',
    reviewed_offer: {
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
    },
    provenance_refs: ['human_review:runtime-fixture']
  };
}

function calculationProfile() {
  return {
    profile_id: 'calc-runtime-fixture',
    profile_version: '1',
    currency: 'BRL',
    cash_margin_minor: 55000,
    installment_margin_minor: 65000,
    freight_minor: 0,
    freight_mode: 'STORE',
    installment_base_addon_minor: 10000,
    entry_minor: 0,
    installment_coefficients: { 12: 1.1, 18: 1.2 }
  };
}

function researchProfile() {
  return {
    profile_id: 'research-runtime-fixture',
    profile_version: '1',
    required_match_fields: ['model_id', 'capacity_gb', 'condition'],
    min_evidence_confidence: 0.7,
    max_age_seconds: 60 * 60 * 24 * 30
  };
}

function indicatorProfile() {
  return {
    profile_id: 'indicator-runtime-fixture',
    profile_version: '1',
    min_evidence_count: 3,
    cheap_at_or_below_percent: -5,
    expensive_at_or_above_percent: 5
  };
}

function evidence(id, price) {
  return {
    evidence_id: id,
    source_ref: `fixture:${id}`,
    observed_at: '2026-09-19T12:00:00.000Z',
    product: {
      model_id: 'iphone-17-pro-256',
      model_label: 'iPhone 17 Pro 256GB',
      capacity_gb: 256,
      condition: 'LACRADO',
      color: 'AZUL'
    },
    normalized_price: price,
    currency: 'BRL',
    confidence: 0.9
  };
}

function trustedEvidence() {
  return [
    evidence('ev_runtime_1', 600000),
    evidence('ev_runtime_2', 650000),
    evidence('ev_runtime_3', 700000)
  ];
}

function currentOfferCandidates() {
  return trustedEvidence().map((item, index) => {
    const base = c01Candidate();
    return {
      ...base,
      analysis_id: 'ana_runtime_peer_' + (index + 1),
      source_id: 'src_runtime_peer_' + (index + 1),
      offer_id: 'off_runtime_peer_' + (index + 1),
      offer_revision: 1,
      offer_identity_fingerprint: 'identity-runtime-peer-' + (index + 1),
      offer_value_fingerprint: 'value-runtime-peer-' + (index + 1),
      reviewed_offer: {
        ...base.reviewed_offer,
        color: item.product.color,
        price: {
          amount_minor: item.normalized_price,
          currency: item.currency
        }
      },
      review: {
        decision: 'ACCEPT',
        reviewer_ref: 'reviewer-runtime',
        reviewed_at: item.observed_at
      },
      interpretation_confidence: {
        overall: item.confidence,
        by_field: {},
        record_state: 'resolved'
      },
      provenance_refs: ['human_review:runtime-peer-' + (index + 1)]
    };
  });
}

function currentOfferEvidence() {
  return buildCurrentOfferEvidence({
    c01_candidate: c01Candidate(),
    current_offers: currentOfferCandidates()
  }).evidence;
}

function clientRequest(overrides = {}) {
  return {
    analysis_id: 'ana_runtime_001',
    offer_id: 'off_runtime_001',
    offer_revision: 1,
    ...overrides
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
    storedBundle: null,
    persistCalls: 0,
    authCalls: 0,
    profileCalls: 0,
    calcConfigCalls: 0,
    authorityC01Calls: 0,
    authorityEvidenceCalls: 0,
    loadCalls: 0,
    calls: []
  };

  const role = options.role || 'dono';
  const authenticated = options.authenticated !== false;

  async function fetchImpl(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const method = String(init.method || 'GET').toUpperCase();
    state.calls.push({ url, method, headers: init.headers || {}, body: init.body || null });

    if (url === SUPABASE_URL + '/auth/v1/user') {
      state.authCalls += 1;
      if (!authenticated) return jsonResponse({ message: 'invalid token' }, 401);
      return jsonResponse({ id: USER_A });
    }

    if (url.startsWith(SUPABASE_URL + '/rest/v1/app_usuario?')) {
      state.profileCalls += 1;
      return jsonResponse([{
        tenant_id: TENANT_A,
        papel: role,
        ativo: true
      }]);
    }

    if (url.startsWith(SUPABASE_URL + '/rest/v1/calc_dados?')) {
      state.calcConfigCalls += 1;
      return jsonResponse([{
        tenant_id: TENANT_A,
        atualizado_em: '2026-08-17T23:20:02.384365+00:00',
        dados: {
          config: {
            margens: {
              iPhone: { av: 550, pc: 650 }
            },
            pb: 100,
            taxas: { 12: 1.1, 18: 1.2 }
          }
        }
      }]);
    }

    if (url.startsWith(SUPABASE_URL + '/rest/v1/extcalc_offer_revision?')) {
      state.authorityC01Calls += 1;
      return jsonResponse([{
        tenant_id: TENANT_A,
        analysis_id: c01Candidate().analysis_id,
        offer_id: c01Candidate().offer_id,
        offer_revision: c01Candidate().offer_revision,
        c01_snapshot: c01Candidate(),
        domain_outcome: 'VALID',
        freshness_status: 'CURRENT'
      }]);
    }

    if (url === SUPABASE_URL + '/rest/v1/rpc/extcalc_product_current_offers_v0') {
      state.authorityEvidenceCalls += 1;
      return jsonResponse(currentOfferCandidates());
    }

    if (url === SUPABASE_URL + '/rest/v1/rpc/extcalc_persist_execution_v0') {
      state.persistCalls += 1;
      const auth = init.headers.authorization || init.headers.Authorization;
      assert.strictEqual(auth, `Bearer ${TOKEN}`);
      assert.strictEqual(init.headers.apikey, ANON_KEY);

      const parsed = JSON.parse(init.body);
      assert.ok(parsed.p_bundle);
      state.storedBundle = parsed.p_bundle;

      return jsonResponse({
        ok: true,
        execution_id: parsed.p_bundle.execution.execution_id,
        idempotent: false
      });
    }

    if (url.startsWith(SUPABASE_URL + '/rest/v1/extcalc_execution?')) {
      state.loadCalls += 1;
      if (!state.storedBundle) return jsonResponse([]);

      const e = state.storedBundle.execution;
      return jsonResponse([{
        tenant_id: e.tenant_id,
        execution_id: e.execution_id,
        analysis_id: e.analysis_id,
        offer_id: e.offer_id,
        offer_revision: e.offer_revision,
        request_snapshot: e.request_snapshot,
        response_snapshot: e.response_snapshot
      }]);
    }

    throw new Error(`fetch inesperado: ${method} ${url}`);
  }

  return { state, fetchImpl };
}

function makeRuntime(backend, assetsFetch) {
  return createExternalCalcWorkerRuntime({
    env: {
      SUPABASE_URL,
      SUPABASE_ANON_KEY: ANON_KEY,
      EXTCALC_CALCULATION_CATEGORY: 'iPhone',
      EXTCALC_RESEARCH_PROFILE_JSON: JSON.stringify(researchProfile()),
      EXTCALC_INDICATOR_PROFILE_JSON: JSON.stringify(indicatorProfile()),
      EXTCALC_MARKET_CONTEXT_JSON: JSON.stringify({ country: 'BR' })
    },
    fetchImpl: backend.fetchImpl,
    assetsFetch,
    clock: () => FIXED_TIME
  });
}

function apiRequest(method, pathName, body, token = TOKEN) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body != null) headers['content-type'] = 'application/json';

  return new Request('https://pitwall.test' + pathName, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  });
}

async function responseBody(response) {
  return JSON.parse(await response.text());
}

(async () => {
  await check('sem JWT responde 401 e nao toca autoridade/persistencia', async () => {
    const backend = makeBackend({ authenticated: false });
    const runtime = makeRuntime(backend);
    const response = await runtime.fetch(
      apiRequest('POST', '/api/external-calc/v0/execute', clientRequest(), null)
    );

    assert.strictEqual(response.status, 401);
    assert.strictEqual(backend.state.authorityC01Calls, 0);
    assert.strictEqual(backend.state.persistCalls, 0);
  });

  await check('JWT de papel sem permissao responde 403 antes da autoridade', async () => {
    const backend = makeBackend({ role: 'vendedor' });
    const runtime = makeRuntime(backend);
    const response = await runtime.fetch(
      apiRequest('POST', '/api/external-calc/v0/execute', clientRequest())
    );

    assert.strictEqual(response.status, 403);
    assert.strictEqual(backend.state.authorityC01Calls, 0);
    assert.strictEqual(backend.state.persistCalls, 0);
  });

  await check('JWT validador beta resolve autoridade e executa External Calc', async () => {
    const backend = makeBackend({ role: 'validador' });
    const runtime = makeRuntime(backend);
    const response = await runtime.fetch(
      apiRequest('POST', '/api/external-calc/v0/execute', clientRequest())
    );
    const body = await responseBody(response);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(body.result.outputs.c05.contract_id, 'C05');
    assert.strictEqual(backend.state.persistCalls, 1);
  });

  await check('JWT dono resolve autoridade server-side executa Service V0 e persiste', async () => {
    const backend = makeBackend();
    const runtime = makeRuntime(backend);
    const response = await runtime.fetch(
      apiRequest('POST', '/api/external-calc/v0/execute', clientRequest())
    );
    const body = await responseBody(response);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(body.result.outputs.c05.contract_id, 'C05');
    assert.strictEqual(backend.state.authorityC01Calls, 1);
    assert.strictEqual(backend.state.calcConfigCalls, 1);
    assert.strictEqual(backend.state.authorityEvidenceCalls, 1);
    assert.strictEqual(backend.state.persistCalls, 1);
    assert.ok(backend.state.storedBundle);
    assert.strictEqual(backend.state.storedBundle.execution.tenant_id, TENANT_A);
    assert.deepStrictEqual(
      backend.state.storedBundle.execution.request_snapshot.c01_candidate,
      c01Candidate()
    );
  });

  await check('execution_id default e UUID puro aceito pela persistencia', async () => {
    const backend = makeBackend();
    const runtime = makeRuntime(backend);
    const response = await runtime.fetch(
      apiRequest('POST', '/api/external-calc/v0/execute', clientRequest())
    );
    const body = await responseBody(response);

    assert.match(
      body.execution_id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    assert.strictEqual(backend.state.storedBundle.execution.execution_id, body.execution_id);
  });

  await check('tenant e domain bundle injetados pelo cliente sao rejeitados', async () => {
    const tenantBackend = makeBackend();
    const tenantRuntime = makeRuntime(tenantBackend);
    const tenantResponse = await tenantRuntime.fetch(
      apiRequest('POST', '/api/external-calc/v0/execute', {
        ...clientRequest(),
        tenant_id: '00000000-0000-4000-8000-000000000099'
      })
    );
    const tenantBody = await responseBody(tenantResponse);

    assert.strictEqual(tenantResponse.status, 400);
    assert.strictEqual(tenantBody.error.code, 'CLIENT_AUTHORITY_FIELD');
    assert.strictEqual(tenantBackend.state.persistCalls, 0);

    const profileBackend = makeBackend();
    const profileRuntime = makeRuntime(profileBackend);
    const profileResponse = await profileRuntime.fetch(
      apiRequest('POST', '/api/external-calc/v0/execute', {
        ...clientRequest(),
        calculation_profile: calculationProfile()
      })
    );
    const profileBody = await responseBody(profileResponse);

    assert.strictEqual(profileResponse.status, 400);
    assert.match(profileBody.error.message, /autoridade proibido/);
    assert.strictEqual(profileBackend.state.persistCalls, 0);
  });

  await check('round-trip POST -> persistencia -> GET retorna request resolvido e result', async () => {
    const backend = makeBackend();
    const runtime = makeRuntime(backend);

    const post = await runtime.fetch(
      apiRequest('POST', '/api/external-calc/v0/execute', clientRequest())
    );
    const postBody = await responseBody(post);

    const get = await runtime.fetch(
      apiRequest(
        'GET',
        `/api/external-calc/v0/executions/${encodeURIComponent(postBody.execution_id)}`,
        null
      )
    );
    const getBody = await responseBody(get);

    assert.strictEqual(get.status, 200);
    assert.strictEqual(getBody.execution_id, postBody.execution_id);
    assert.deepStrictEqual(getBody.request.c01_candidate, c01Candidate());
    assert.deepStrictEqual(getBody.request.evidence, currentOfferEvidence());
    assert.strictEqual(getBody.request.analysis_id, undefined);
    assert.deepStrictEqual(getBody.result, postBody.result);
    assert.strictEqual(backend.state.loadCalls, 1);
  });

  await check('identidade e tenant continuam derivados de Auth + app_usuario', async () => {
    const backend = makeBackend();
    const runtime = makeRuntime(backend);

    await runtime.fetch(
      apiRequest('POST', '/api/external-calc/v0/execute', clientRequest())
    );

    assert.strictEqual(backend.state.authCalls, 1);
    assert.strictEqual(backend.state.profileCalls, 1);
    assert.strictEqual(backend.state.authorityC01Calls, 1);
    assert.strictEqual(backend.state.storedBundle.execution.tenant_id, TENANT_A);
  });

  await check('rota fora de /api/external-calc usa assets sem tocar Auth', async () => {
    const backend = makeBackend();
    let assets = 0;
    const runtime = makeRuntime(backend, async () => {
      assets += 1;
      return new Response('asset-ok', { status: 200 });
    });

    const response = await runtime.fetch(
      new Request('https://pitwall.test/calc/')
    );

    assert.strictEqual(response.status, 200);
    assert.strictEqual(await response.text(), 'asset-ok');
    assert.strictEqual(assets, 1);
    assert.strictEqual(backend.state.authCalls, 0);
  });

  await check('runtime adapters e authority source nao carregam service_role', async () => {
    const runtimeSource = fs.readFileSync(path.join(__dirname, 'runtime.js'), 'utf8').toLowerCase();
    const adapterSource = fs.readFileSync(path.join(__dirname, 'postgres-adapter.js'), 'utf8').toLowerCase();
    const authoritySource = fs.readFileSync(
      path.join(__dirname, '../../external-calc-authority/v0/postgres-authority-source.js'),
      'utf8'
    ).toLowerCase();

    for (const source of [runtimeSource, adapterSource, authoritySource]) {
      assert.strictEqual(source.includes('service_role'), false);
      assert.strictEqual(source.includes('supabase_service_role_key'), false);
    }
  });

  await check('Worker entry apenas delega ao runtime canonico', async () => {
    const workerSource = fs.readFileSync(
      path.join(__dirname, '../../../worker/external-calc-worker.mjs'),
      'utf8'
    );

    assert.ok(workerSource.includes('createExternalCalcWorkerRuntime'));
    assert.strictEqual(workerSource.includes('cash_margin_minor'), false);
    assert.strictEqual(workerSource.includes('tenant_id'), false);
    assert.strictEqual(workerSource.includes('service_role'), false);
  });

  await check('wrangler preserva assets e roteia somente External Calc API', async () => {
    const configSource = fs.readFileSync(
      path.join(__dirname, '../../../wrangler.jsonc'),
      'utf8'
    );

    assert.ok(configSource.includes('"directory": "./public"'));
    assert.ok(configSource.includes('"binding": "ASSETS"'));
    assert.ok(configSource.includes('"/api/external-calc/*"'));
    assert.ok(configSource.includes('"not_found_handling": "single-page-application"'));
    assert.ok(configSource.includes('"main": "./worker/external-calc-worker.mjs"'));
    assert.strictEqual(configSource.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
  });

  console.log(`EXTERNAL_CALC_RUNTIME_V0=PASS checks=${ok}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
