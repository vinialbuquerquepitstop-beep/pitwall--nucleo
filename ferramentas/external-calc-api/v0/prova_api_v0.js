'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { executeExternalCalcService } = require('../../external-calc-service/v0/external-calc-service');
const {
  createInMemoryLifecycleAdapter,
  createLifecycleRepository
} = require('../../external-calc-persistence/v0/lifecycle-repository');
const {
  createExternalCalcApplicationService
} = require('./application-service');
const {
  EXECUTE_PATH,
  createExternalCalcApiV0
} = require('./api-handler');

const TENANT_A = '00000000-0000-4000-8000-000000000001';
const TENANT_B = '00000000-0000-4000-8000-000000000002';
const FIXED_TIME = '2026-09-19T21:00:00.000Z';

let ok = 0;
function check(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      ok += 1;
      console.log(`OK ${ok} - ${name}`);
    })
    .catch(error => {
      console.error(`FALHOU - ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

function c01Candidate() {
  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_api_001',
    source_id: 'src_api_001',
    offer_id: 'off_api_001',
    offer_revision: 1,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-api-001',
    offer_value_fingerprint: 'value-api-001-r1',
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
    provenance_refs: ['human_review:api-fixture']
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

function clientRequest(overrides = {}) {
  return {
    c01_candidate: c01Candidate(),
    calculation_profile: {
      profile_id: 'calc-api-fixture',
      profile_version: '1',
      currency: 'BRL',
      cash_margin_minor: 55000,
      installment_margin_minor: 65000,
      freight_minor: 0,
      freight_mode: 'STORE',
      installment_base_addon_minor: 10000,
      entry_minor: 0,
      installment_coefficients: { 12: 1.1, 18: 1.2 }
    },
    research_profile: {
      profile_id: 'research-api-fixture',
      profile_version: '1',
      required_match_fields: ['model_id', 'capacity_gb', 'condition'],
      min_evidence_confidence: 0.7,
      max_age_seconds: 60 * 60 * 24 * 30
    },
    indicator_profile: {
      profile_id: 'indicator-api-fixture',
      profile_version: '1',
      min_evidence_count: 3,
      cheap_at_or_below_percent: -5,
      expensive_at_or_above_percent: 5
    },
    as_of: '2026-09-19T20:59:00.000Z',
    market_context: { country: 'BR' },
    evidence: [
      evidence('ev_api_1', 600000),
      evidence('ev_api_2', 650000),
      evidence('ev_api_3', 700000)
    ],
    ...overrides
  };
}

function deterministicIds() {
  const ids = [
    '10000000-0000-4000-8000-000000000001',
    'calc_api_server_001',
    'research_api_server_001',
    'signal_api_server_001',
    'decision_api_server_001'
  ];
  let index = 0;
  return () => ids[index++];
}

function makeSystem(auth = {
  tenant_id: TENANT_A,
  subject: 'user-api-001',
  can_execute_external_calc: true
}) {
  const adapter = createInMemoryLifecycleAdapter();
  const repository = createLifecycleRepository(adapter);
  const idFactory = deterministicIds();
  const applicationService = createExternalCalcApplicationService({
    repository,
    idFactory,
    clock: () => FIXED_TIME
  });
  const api = createExternalCalcApiV0({
    applicationService,
    authenticate: async () => auth
  });
  return { api, repository };
}

async function requestApi(api, body, overrides = {}) {
  return api.handle({
    method: 'POST',
    path: EXECUTE_PATH,
    headers: { authorization: 'Bearer fixture' },
    body,
    ...overrides
  });
}

check('API executa Service V0 e devolve C05 sem regra propria', async () => {
  const { api } = makeSystem();
  const response = await requestApi(api, clientRequest());

  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.body.result.outputs.c02.contract_id, 'C02');
  assert.strictEqual(response.body.result.outputs.c03.contract_id, 'C03');
  assert.strictEqual(response.body.result.outputs.c04.contract_id, 'C04');
  assert.strictEqual(response.body.result.outputs.c05.contract_id, 'C05');
  assert.strictEqual(response.body.decision_outcome, 'READY');
});

check('API + Application Service equivalem ao Service direto com IDs server-side', async () => {
  const body = clientRequest();
  const { api } = makeSystem();
  const response = await requestApi(api, body);

  const direct = executeExternalCalcService({
    ...body,
    run_ids: {
      calculation_run_id: 'calc_api_server_001',
      research_run_id: 'research_api_server_001',
      price_signal_run_id: 'signal_api_server_001',
      decision_output_id: 'decision_api_server_001'
    }
  });

  assert.deepStrictEqual(response.body.result, direct);
});

check('tenant vem somente do contexto autenticado e e preservado na persistencia', async () => {
  const { api, repository } = makeSystem();
  const response = await requestApi(api, clientRequest());

  const replay = repository.loadExecution({
    tenant_id: TENANT_A,
    execution_id: response.body.execution_id
  });

  assert.ok(replay);
  assert.strictEqual(replay.tenant_id, TENANT_A);
  assert.strictEqual(
    repository.loadExecution({
      tenant_id: TENANT_B,
      execution_id: response.body.execution_id
    }),
    null
  );
});

check('tenant_id enviado pelo cliente e rejeitado', async () => {
  const { api } = makeSystem();
  const response = await requestApi(api, {
    ...clientRequest(),
    tenant_id: TENANT_B
  });

  assert.strictEqual(response.status, 400);
  assert.strictEqual(response.body.error.code, 'CLIENT_AUTHORITY_FIELD');
});

check('tenant_id escondido em payload aninhado tambem e rejeitado', async () => {
  const { api } = makeSystem();
  const body = clientRequest();
  body.market_context = { country: 'BR', tenant_id: TENANT_B };

  const response = await requestApi(api, body);

  assert.strictEqual(response.status, 400);
  assert.match(response.body.error.message, /tenant_id/);
});

check('run_ids execution_id e persisted_at nao podem vir do cliente', async () => {
  for (const field of ['run_ids', 'execution_id', 'persisted_at']) {
    const { api } = makeSystem();
    const body = clientRequest();
    body[field] = field === 'run_ids'
      ? { calculation_run_id: 'client-controlled' }
      : 'client-controlled';

    const response = await requestApi(api, body);
    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error.code, 'CLIENT_AUTHORITY_FIELD');
  }
});

check('IDs de execucao e runs sao gerados pelo Application Service', async () => {
  const { api, repository } = makeSystem();
  const response = await requestApi(api, clientRequest());

  assert.strictEqual(response.body.execution_id, '10000000-0000-4000-8000-000000000001');

  const replay = repository.loadExecution({
    tenant_id: TENANT_A,
    execution_id: response.body.execution_id
  });

  assert.deepStrictEqual(replay.request.run_ids, {
    calculation_run_id: 'calc_api_server_001',
    research_run_id: 'research_api_server_001',
    price_signal_run_id: 'signal_api_server_001',
    decision_output_id: 'decision_api_server_001'
  });
});

check('request sem autenticacao e rejeitado antes da execucao', async () => {
  const { api } = makeSystem(null);
  const response = await requestApi(api, clientRequest());

  assert.strictEqual(response.status, 401);
  assert.strictEqual(response.body.error.code, 'UNAUTHENTICATED');
});

check('usuario autenticado sem permissao recebe 403', async () => {
  const { api } = makeSystem({
    tenant_id: TENANT_A,
    subject: 'user-no-access',
    can_execute_external_calc: false
  });

  const response = await requestApi(api, clientRequest());

  assert.strictEqual(response.status, 403);
  assert.strictEqual(response.body.error.code, 'FORBIDDEN');
});

check('rota ou metodo fora do contrato nao executam nada', async () => {
  const { api } = makeSystem();
  const response = await api.handle({
    method: 'GET',
    path: EXECUTE_PATH,
    body: clientRequest()
  });

  assert.strictEqual(response.status, 404);
});

check('API nao altera payload do cliente', async () => {
  const { api } = makeSystem();
  const body = clientRequest();
  const before = JSON.stringify(body);

  const response = await requestApi(api, body);

  assert.strictEqual(response.status, 200);
  assert.strictEqual(JSON.stringify(body), before);
});

check('fronteira API nao importa contratos nem persistence diretamente', () => {
  const source = fs.readFileSync(path.join(__dirname, 'api-handler.js'), 'utf8').toLowerCase();

  const forbidden = [
    'external-calc-c01',
    'external-calc-c02',
    'external-calc-c03',
    'external-calc-c04',
    'external-calc-c05',
    'external-calc-service',
    'external-calc-persistence',
    'supabase',
    'postgres',
    'calculation_profile',
    'cash_margin_minor',
    'price_signal'
  ];

  for (const token of forbidden) {
    assert.strictEqual(source.includes(token), false, `API contem dependencia/regra proibida: ${token}`);
  }
});

check('Application Service nao importa C01-C05 diretamente nem conhece frontend', () => {
  const source = fs.readFileSync(path.join(__dirname, 'application-service.js'), 'utf8').toLowerCase();

  for (const token of [
    'external-calc-c01',
    'external-calc-c02',
    'external-calc-c03',
    'external-calc-c04',
    'external-calc-c05',
    'document.',
    'window.',
    'localstorage',
    'supabase',
    'postgres'
  ]) {
    assert.strictEqual(source.includes(token), false, `Application Service contem dependencia proibida: ${token}`);
  }

  assert.ok(source.includes('external-calc-service/v0/external-calc-service'));
});

process.on('beforeExit', () => {
  if (process.exitCode) return;
  if (ok !== 13) {
    console.error(`FALHOU - checks concluidos ${ok}, esperado 13`);
    process.exitCode = 1;
    return;
  }
  console.log(`EXTERNAL_CALC_API_V0=PASS checks=${ok}`);
});
