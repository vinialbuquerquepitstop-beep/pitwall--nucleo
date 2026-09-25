'use strict';

const assert = require('assert');
const fs = require('fs');
const { calculateC02 } = require('../../external-calc-c02/v1/c02-calculator');
const { runC03Research } = require('../../external-calc-c03/v1/c03-research-core');
const { runC04PriceIndicator } = require('../../external-calc-c04/v1/c04-price-indicator');
const { composeDecisionOutput } = require('../../external-calc-c05/v1/c05-decision-output');
const {
  createOpenAIAdvisorProvider,
  ADAPTER_VERSION,
  RESPONSES_ENDPOINT
} = require('./openai-provider');
const {
  createAdvisorApiV0,
  ADVISOR_PATH
} = require('./advisor-api');
const {
  advisorServerConfig,
  createExternalCalcWorkerRuntime
} = require('../../external-calc-runtime/v0/runtime');

let ok = 0;
async function check(name, fn) {
  try {
    await fn();
    ok += 1;
    console.log('OK ' + ok + ' - ' + name);
  } catch (error) {
    console.error('FALHOU - ' + name);
    throw error;
  }
}

function responseJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function validCandidate() {
  return {
    insights: [
      {
        insight_id: 'ins_a4_1',
        type: 'MARKET_POSITION',
        severity: 'MEDIUM',
        evidence_refs: [
          'decision_output:decision_a4_001',
          'evidence:ev_a'
        ],
        summary: 'A oferta esta alinhada aos comparaveis exatos validados.',
        confidence: 0.91
      }
    ]
  };
}

function openAIResponse(candidate = validCandidate()) {
  return {
    id: 'resp_fixture',
    status: 'completed',
    output: [
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: JSON.stringify(candidate)
          }
        ]
      }
    ]
  };
}

function providerFixture(fetchImpl) {
  return createOpenAIAdvisorProvider({
    apiKey: 'sk-fixture-only',
    model: 'gpt-6-sol',
    fetchImpl
  });
}

function persistedSource() {
  const c01 = {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_a4_001',
    source_id: 'src_a4_001',
    offer_id: 'off_a4_001',
    offer_revision: 1,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-a4',
    offer_value_fingerprint: 'value-a4',
    reviewed_offer: {
      supplier_id: 'SUP_A4',
      model: {
        id: 'iphone-17-pro-256',
        label: 'iPhone 17 Pro',
        attributes: {}
      },
      capacity_gb: 256,
      condition: 'LACRADO',
      color: 'PRETO',
      price: { amount_minor: 650000, currency: 'BRL' }
    },
    provenance_refs: ['human_review:a4']
  };

  const evidence = [
    {
      evidence_id: 'ev_a',
      source_ref: 'fixture:ev_a',
      observed_at: '2026-09-24T12:00:00.000Z',
      product: {
        model_id: 'iphone-17-pro-256',
        model_label: 'iPhone 17 Pro',
        capacity_gb: 256,
        condition: 'LACRADO',
        color: 'PRETO'
      },
      normalized_price: 620000,
      currency: 'BRL',
      confidence: 0.94
    },
    {
      evidence_id: 'ev_b',
      source_ref: 'fixture:ev_b',
      observed_at: '2026-09-24T12:00:00.000Z',
      product: {
        model_id: 'iphone-17-pro-256',
        model_label: 'iPhone 17 Pro',
        capacity_gb: 256,
        condition: 'LACRADO',
        color: 'PRETO'
      },
      normalized_price: 650000,
      currency: 'BRL',
      confidence: 0.94
    },
    {
      evidence_id: 'ev_c',
      source_ref: 'fixture:ev_c',
      observed_at: '2026-09-24T12:00:00.000Z',
      product: {
        model_id: 'iphone-17-pro-256',
        model_label: 'iPhone 17 Pro',
        capacity_gb: 256,
        condition: 'LACRADO',
        color: 'PRETO'
      },
      normalized_price: 680000,
      currency: 'BRL',
      confidence: 0.94
    }
  ];

  const c02 = calculateC02({
    calculation_run_id: 'calc_a4_001',
    c01_candidate: c01,
    calculation_profile: {
      profile_id: 'calc-a4',
      profile_version: '1',
      currency: 'BRL',
      cash_margin_minor: 55000,
      installment_margin_minor: 65000,
      freight_minor: 0,
      freight_mode: 'STORE',
      installment_base_addon_minor: 10000,
      entry_minor: 0,
      installment_coefficients: { 12: 1.1, 18: 1.2 }
    }
  });

  const c03 = runC03Research({
    research_run_id: 'research_a4_001',
    c01_candidate: c01,
    research_profile: {
      profile_id: 'research-a4',
      profile_version: '1',
      required_match_fields: ['model_id', 'capacity_gb', 'condition', 'color'],
      min_evidence_confidence: 0.7,
      max_age_seconds: 60 * 60 * 24 * 30
    },
    as_of: '2026-09-24T18:00:00.000Z',
    market_context: { country: 'BR' },
    evidence
  });

  const c04 = runC04PriceIndicator({
    price_signal_run_id: 'signal_a4_001',
    c01_candidate: c01,
    c03_research: c03,
    indicator_profile: {
      profile_id: 'indicator-a4',
      profile_version: '1',
      min_evidence_count: 3,
      cheap_at_or_below_percent: -5,
      expensive_at_or_above_percent: 5
    }
  });

  const c05 = composeDecisionOutput({
    decision_output_id: 'decision_a4_001',
    c01_candidate: c01,
    c02_calculation: c02,
    c03_research: c03,
    c04_price_signal: c04
  });

  return {
    resource_tenant_id: '00000000-0000-0000-0000-000000000001',
    source_execution_id: '11111111-1111-4111-8111-111111111111',
    analysis_id: c05.analysis_id,
    offer_id: c05.offer_id,
    offer_revision: c05.offer_revision,
    c05_decision_output: c05,
    evidence_records: evidence
  };
}

(async () => {
  await check('OpenAI adapter usa Responses endpoint e POST autenticado', async () => {
    const calls = [];
    const provider = providerFixture(async (url, init) => {
      calls.push({ url, init });
      return responseJson(openAIResponse());
    });
    await provider.generateStructured({
      capability: 'EXTERNAL_CALC_ADVISOR_INSIGHTS',
      prompt_version: 'advisor-prompt/v1',
      input: { safe: true }
    });
    assert.strictEqual(calls[0].url, RESPONSES_ENDPOINT);
    assert.strictEqual(calls[0].init.method, 'POST');
    assert.strictEqual(calls[0].init.headers.authorization, 'Bearer sk-fixture-only');
  });

  await check('OpenAI request fixa model server-side e store=false', async () => {
    let body;
    const provider = providerFixture(async (_url, init) => {
      body = JSON.parse(init.body);
      return responseJson(openAIResponse());
    });
    await provider.generateStructured({
      capability: 'EXTERNAL_CALC_ADVISOR_INSIGHTS',
      prompt_version: 'advisor-prompt/v1',
      input: { safe: true }
    });
    assert.strictEqual(body.model, 'gpt-6-sol');
    assert.strictEqual(body.store, false);
  });

  await check('Structured Output usa text.format json_schema strict', async () => {
    let body;
    const provider = providerFixture(async (_url, init) => {
      body = JSON.parse(init.body);
      return responseJson(openAIResponse());
    });
    await provider.generateStructured({
      capability: 'EXTERNAL_CALC_ADVISOR_INSIGHTS',
      prompt_version: 'advisor-prompt/v1',
      input: { safe: true }
    });
    assert.strictEqual(body.text.format.type, 'json_schema');
    assert.strictEqual(body.text.format.strict, true);
    assert.strictEqual(body.text.format.schema.properties.insights.maxItems, 3);
  });

  await check('OpenAI adapter retorna candidate JSON e metadata estavel', async () => {
    const provider = providerFixture(async () => responseJson(openAIResponse()));
    const out = await provider.generateStructured({
      capability: 'EXTERNAL_CALC_ADVISOR_INSIGHTS',
      prompt_version: 'advisor-prompt/v1',
      input: { safe: true }
    });
    assert.deepStrictEqual(out, validCandidate());
    assert.strictEqual(provider.adapter_version, ADAPTER_VERSION);
    assert.strictEqual(provider.provider_name, 'openai');
  });

  await check('refusal do provider falha fechado', async () => {
    const provider = providerFixture(async () => responseJson({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }]
    }));
    await assert.rejects(
      provider.generateStructured({
        capability: 'EXTERNAL_CALC_ADVISOR_INSIGHTS',
        prompt_version: 'advisor-prompt/v1',
        input: { safe: true }
      }),
      error => error.code === 'PROVIDER_REFUSAL'
    );
  });

  await check('response incompleta falha fechado', async () => {
    const provider = providerFixture(async () => responseJson({
      status: 'incomplete',
      output: []
    }));
    await assert.rejects(
      provider.generateStructured({
        capability: 'EXTERNAL_CALC_ADVISOR_INSIGHTS',
        prompt_version: 'advisor-prompt/v1',
        input: { safe: true }
      }),
      error => error.code === 'PROVIDER_INCOMPLETE'
    );
  });

  await check('HTTP failure do provider nao expoe payload como candidate', async () => {
    const provider = providerFixture(async () => responseJson({
      error: { message: 'fixture-secret-message' }
    }, 429));
    await assert.rejects(
      provider.generateStructured({
        capability: 'EXTERNAL_CALC_ADVISOR_INSIGHTS',
        prompt_version: 'advisor-prompt/v1',
        input: { safe: true }
      }),
      error => error.code === 'PROVIDER_HTTP'
    );
  });

  await check('output_text JSON invalido e rejeitado', async () => {
    const provider = providerFixture(async () => responseJson({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{bad' }] }]
    }));
    await assert.rejects(
      provider.generateStructured({
        capability: 'EXTERNAL_CALC_ADVISOR_INSIGHTS',
        prompt_version: 'advisor-prompt/v1',
        input: { safe: true }
      }),
      error => error.code === 'PROVIDER_INVALID_RESPONSE'
    );
  });

  await check('Advisor API aceita somente source_execution_id', async () => {
    const api = createAdvisorApiV0({
      service: { async execute() { throw new Error('nao deve chamar'); } },
      authenticate: async () => ({
        tenant_id: 'tenant_a',
        actor_role: 'dono'
      }),
      promptVersion: 'advisor-prompt/v1'
    });
    const res = await api.handle({
      method: 'POST',
      path: ADVISOR_PATH,
      body: JSON.stringify({
        source_execution_id: 'x',
        model: 'forjado'
      })
    });
    assert.strictEqual(res.status, 400);
  });

  await check('Advisor API exige autenticacao', async () => {
    const api = createAdvisorApiV0({
      authenticate: async () => null
    });
    const res = await api.handle({
      method: 'POST',
      path: ADVISOR_PATH,
      body: JSON.stringify({ source_execution_id: 'x' })
    });
    assert.strictEqual(res.status, 401);
  });

  await check('Advisor API bloqueia vendedor antes do service', async () => {
    let calls = 0;
    const api = createAdvisorApiV0({
      service: { async execute() { calls += 1; } },
      authenticate: async () => ({
        tenant_id: 'tenant_a',
        actor_role: 'vendedor'
      }),
      promptVersion: 'advisor-prompt/v1'
    });
    const res = await api.handle({
      method: 'POST',
      path: ADVISOR_PATH,
      body: JSON.stringify({ source_execution_id: 'x' })
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(calls, 0);
  });

  await check('Advisor API sem provider configurado retorna 503', async () => {
    const api = createAdvisorApiV0({
      authenticate: async () => ({
        tenant_id: 'tenant_a',
        actor_role: 'dono'
      })
    });
    const res = await api.handle({
      method: 'POST',
      path: ADVISOR_PATH,
      body: JSON.stringify({ source_execution_id: 'x' })
    });
    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.error.code, 'ADVISOR_NOT_CONFIGURED');
  });

  await check('advisor_execution_id e prompt_version sao server-side', async () => {
    let received;
    const api = createAdvisorApiV0({
      service: {
        async execute(request) {
          received = request;
          return {
            source_execution_id: request.source_execution_id,
            advisor_execution_id: request.advisor_execution_id,
            advisor_status: 'READY_FOR_MODEL',
            execution: {
              execution_status: 'SUCCEEDED',
              candidate_output: { insights: [] },
              provider_name: 'openai',
              model_name: 'gpt-6-sol',
              model_version: 'gpt-6-sol'
            }
          };
        }
      },
      authenticate: async () => ({
        tenant_id: 'tenant_a',
        actor_role: 'dono'
      }),
      promptVersion: 'advisor-prompt/server-v1',
      idFactory: () => '22222222-2222-4222-8222-222222222222'
    });
    const res = await api.handle({
      method: 'POST',
      path: ADVISOR_PATH,
      body: JSON.stringify({ source_execution_id: 'source-1' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(received.advisor_execution_id, '22222222-2222-4222-8222-222222222222');
    assert.strictEqual(received.prompt_version, 'advisor-prompt/server-v1');
    assert.strictEqual(received.identity.tenant_id, 'tenant_a');
  });

  await check('runtime config falha fechado sem secret', async () => {
    const config = advisorServerConfig({
      EXTCALC_ADVISOR_OPENAI_MODEL: 'gpt-6-sol',
      EXTCALC_ADVISOR_PROMPT_VERSION: 'advisor-prompt/v1'
    });
    assert.strictEqual(config.configured, false);
  });

  await check('runtime config aceita secret + model + prompt server-side', async () => {
    const config = advisorServerConfig({
      OPENAI_API_KEY: 'sk-fixture',
      EXTCALC_ADVISOR_OPENAI_MODEL: 'gpt-6-sol',
      EXTCALC_ADVISOR_PROMPT_VERSION: 'advisor-prompt/v1',
      EXTCALC_ADVISOR_TIMEOUT_MS: '30000'
    });
    assert.strictEqual(config.configured, true);
    assert.strictEqual(config.model, 'gpt-6-sol');
    assert.strictEqual(config.promptVersion, 'advisor-prompt/v1');
  });

  await check('Worker sem OPENAI_API_KEY expõe rota fail-closed 503', async () => {
    const fetchImpl = async (url) => {
      if (url.includes('/auth/v1/user')) {
        return responseJson({ id: 'owner-user' });
      }
      if (url.includes('/rest/v1/app_usuario?')) {
        return responseJson([{
          tenant_id: '00000000-0000-0000-0000-000000000001',
          papel: 'dono',
          ativo: true
        }]);
      }
      throw new Error('fetch inesperado: ' + url);
    };
    const runtime = createExternalCalcWorkerRuntime({
      env: {
        SUPABASE_URL: 'https://fixture.supabase.co',
        SUPABASE_ANON_KEY: 'anon',
        EXTCALC_ADVISOR_OPENAI_MODEL: 'gpt-6-sol',
        EXTCALC_ADVISOR_PROMPT_VERSION: 'advisor-prompt/v1'
      },
      fetchImpl
    });
    const res = await runtime.fetch(new Request(
      'https://worker.test' + ADVISOR_PATH,
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer jwt',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          source_execution_id: '11111111-1111-4111-8111-111111111111'
        })
      }
    ));
    assert.strictEqual(res.status, 503);
  });

  await check('Worker A4 percorre auth -> A3 -> OpenAI -> persistence', async () => {
    const calls = [];
    const source = persistedSource();
    const fetchImpl = async (url, init = {}) => {
      calls.push(url);

      if (url.includes('/auth/v1/user')) {
        return responseJson({ id: 'owner-user' });
      }
      if (url.includes('/rest/v1/app_usuario?')) {
        return responseJson([{
          tenant_id: source.resource_tenant_id,
          papel: 'dono',
          ativo: true
        }]);
      }
      if (url.endsWith('/rest/v1/rpc/extcalc_load_ai_advisor_source_v0')) {
        return responseJson(source);
      }
      if (url === RESPONSES_ENDPOINT) {
        return responseJson(openAIResponse());
      }
      if (url.endsWith('/rest/v1/rpc/extcalc_persist_ai_advisor_execution_v0')) {
        return responseJson({ ok: true, idempotent: false });
      }

      throw new Error('fetch inesperado: ' + url + ' ' + (init.method || 'GET'));
    };

    const runtime = createExternalCalcWorkerRuntime({
      env: {
        SUPABASE_URL: 'https://fixture.supabase.co',
        SUPABASE_ANON_KEY: 'anon',
        OPENAI_API_KEY: 'sk-fixture',
        EXTCALC_ADVISOR_OPENAI_MODEL: 'gpt-6-sol',
        EXTCALC_ADVISOR_PROMPT_VERSION: 'advisor-prompt/v1',
        EXTCALC_ADVISOR_TIMEOUT_MS: '30000'
      },
      fetchImpl,
      clock: (() => {
        const times = [
          '2026-09-24T22:00:00.000-03:00',
          '2026-09-24T22:00:01.000-03:00'
        ];
        let i = 0;
        return () => times[Math.min(i++, times.length - 1)];
      })()
    });

    const res = await runtime.fetch(new Request(
      'https://worker.test' + ADVISOR_PATH,
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer jwt',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          source_execution_id: source.source_execution_id
        })
      }
    ));
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.execution_status, 'SUCCEEDED');
    assert.strictEqual(body.insights.length, 1);
    assert(calls.includes(RESPONSES_ENDPOINT));
    assert(calls.some(url => url.endsWith('/rest/v1/rpc/extcalc_load_ai_advisor_source_v0')));
    assert(calls.some(url => url.endsWith('/rest/v1/rpc/extcalc_persist_ai_advisor_execution_v0')));
  });

  await check('wrangler nao contem OPENAI_API_KEY e fixa somente config nao secreta', async () => {
    const wrangler = fs.readFileSync('wrangler.jsonc', 'utf8');
    assert(wrangler.includes('"EXTCALC_ADVISOR_OPENAI_MODEL": "gpt-6-sol"'));
    assert(wrangler.includes('"EXTCALC_ADVISOR_PROMPT_VERSION": "advisor-prompt/v1"'));
    assert(!/"OPENAI_API_KEY"\s*:/.test(wrangler));
  });

  await check('runtime roteia Advisor explicitamente antes da API generica', async () => {
    const runtime = fs.readFileSync(
      'ferramentas/external-calc-runtime/v0/runtime.js',
      'utf8'
    );
    assert(runtime.includes('url.pathname === ADVISOR_PATH ? advisorApi'));
    assert(runtime.includes('createAdvisorRuntimeService'));
    assert(runtime.includes('createOpenAIAdvisorProvider'));
  });

  await check('API response nao expoe input interno ou source evidence', async () => {
    const api = createAdvisorApiV0({
      service: {
        async execute(request) {
          return {
            source_execution_id: request.source_execution_id,
            advisor_execution_id: request.advisor_execution_id,
            advisor_status: 'READY_FOR_MODEL',
            execution: {
              execution_status: 'SUCCEEDED',
              candidate_output: validCandidate(),
              provider_name: 'openai',
              model_name: 'gpt-6-sol',
              model_version: 'gpt-6-sol',
              input_hash: 'hidden',
              source_refs: ['hidden']
            }
          };
        }
      },
      authenticate: async () => ({
        tenant_id: 'tenant_a',
        actor_role: 'dono'
      }),
      promptVersion: 'advisor-prompt/v1',
      idFactory: () => '22222222-2222-4222-8222-222222222222'
    });
    const res = await api.handle({
      method: 'POST',
      path: ADVISOR_PATH,
      body: JSON.stringify({ source_execution_id: 'source-1' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual('input_hash' in res.body, false);
    assert.strictEqual('source_refs' in res.body, false);
    assert.strictEqual('commercial' in res.body, false);
  });

  console.log('AI_ADVISOR_A4_FIXTURES=PASS checks=' + ok);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
