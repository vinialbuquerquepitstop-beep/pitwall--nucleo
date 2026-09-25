'use strict';

const assert = require('assert');
const fs = require('fs');
const { calculateC02 } = require('../../external-calc-c02/v1/c02-calculator');
const { runC03Research } = require('../../external-calc-c03/v1/c03-research-core');
const { runC04PriceIndicator } = require('../../external-calc-c04/v1/c04-price-indicator');
const { composeDecisionOutput } = require('../../external-calc-c05/v1/c05-decision-output');
const {
  createAdvisorRuntimeSource,
  createAdvisorRuntimeService
} = require('./advisor-runtime');

const SOURCE_EXECUTION_ID = '11111111-1111-4111-8111-111111111111';
const ADVISOR_EXECUTION_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_ID = '33333333-3333-4333-8333-333333333333';

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

function evidence(id, price, color = 'PRETO') {
  return {
    evidence_id: id,
    source_ref: 'fixture:' + id,
    source_url: 'https://example.invalid/' + id,
    observed_at: '2026-09-24T12:00:00.000Z',
    product: {
      model_id: 'iphone-17-pro-256',
      model_label: 'iPhone 17 Pro',
      capacity_gb: 256,
      condition: 'LACRADO',
      color
    },
    normalized_price: price,
    currency: 'BRL',
    confidence: 0.94
  };
}

function makePersistedSource({ insufficient = false, mixedColor = false } = {}) {
  const c01 = {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_advisor_runtime_001',
    source_id: 'src_advisor_runtime_001',
    offer_id: 'off_advisor_runtime_001',
    offer_revision: 1,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-advisor-runtime-001',
    offer_value_fingerprint: 'value-advisor-runtime-001',
    reviewed_offer: {
      supplier_id: 'SUP_RUNTIME',
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
    provenance_refs: ['human_review:off_advisor_runtime_001:r1']
  };

  const evidenceRecords = insufficient
    ? [evidence('ev_a', 620000), evidence('ev_b', 680000)]
    : mixedColor
      ? [
          evidence('ev_a', 620000),
          evidence('ev_b', 640000, 'AZUL'),
          evidence('ev_c', 660000),
          evidence('ev_d', 680000)
        ]
      : [
          evidence('ev_a', 620000),
          evidence('ev_b', 650000),
          evidence('ev_c', 680000)
        ];

  const c02 = calculateC02({
    calculation_run_id: 'calc_advisor_runtime_001',
    c01_candidate: c01,
    calculation_profile: {
      profile_id: 'calc-advisor-runtime',
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
    research_run_id: 'research_advisor_runtime_001',
    c01_candidate: c01,
    research_profile: {
      profile_id: 'research-advisor-runtime',
      profile_version: '1',
      required_match_fields: mixedColor
        ? ['model_id', 'capacity_gb', 'condition']
        : ['model_id', 'capacity_gb', 'condition', 'color'],
      min_evidence_confidence: 0.7,
      max_age_seconds: 60 * 60 * 24 * 30
    },
    as_of: '2026-09-24T18:00:00.000Z',
    market_context: { country: 'BR' },
    evidence: evidenceRecords
  });

  const c04 = runC04PriceIndicator({
    price_signal_run_id: 'signal_advisor_runtime_001',
    c01_candidate: c01,
    c03_research: c03,
    indicator_profile: {
      profile_id: 'indicator-advisor-runtime',
      profile_version: '1',
      min_evidence_count: 3,
      cheap_at_or_below_percent: -5,
      expensive_at_or_above_percent: 5
    }
  });

  const c05 = composeDecisionOutput({
    decision_output_id: 'decision_advisor_runtime_001',
    c01_candidate: c01,
    c02_calculation: c02,
    c03_research: c03,
    c04_price_signal: c04
  });

  return {
    resource_tenant_id: TENANT_ID,
    source_execution_id: SOURCE_EXECUTION_ID,
    analysis_id: c05.analysis_id,
    offer_id: c05.offer_id,
    offer_revision: c05.offer_revision,
    c05_decision_output: c05,
    evidence_records: evidenceRecords
  };
}

function validCandidate() {
  return {
    insights: [
      {
        insight_id: 'ins_runtime_1',
        type: 'MARKET_POSITION',
        severity: 'MEDIUM',
        evidence_refs: [
          'decision_output:decision_advisor_runtime_001',
          'evidence:ev_a'
        ],
        summary: 'A oferta esta alinhada aos comparaveis exatos validados.',
        confidence: 0.9
      }
    ]
  };
}

function tickingClock() {
  const values = [
    '2026-09-24T21:45:00.000-03:00',
    '2026-09-24T21:45:01.000-03:00',
    '2026-09-24T21:45:02.000-03:00'
  ];
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function runtimeFixture({
  loadedSource = makePersistedSource(),
  role = 'dono',
  provider = null,
  idempotent = false
} = {}) {
  const calls = {
    load: [],
    persist: [],
    provider: []
  };

  const source = {
    async loadSource(args) {
      calls.load.push(JSON.parse(JSON.stringify(args)));
      return loadedSource == null ? null : JSON.parse(JSON.stringify(loadedSource));
    },
    async persistExecution(args) {
      calls.persist.push(JSON.parse(JSON.stringify(args)));
      return {
        advisor_execution_id: args.advisor_execution_id,
        idempotent
      };
    }
  };

  const modelProvider = provider || {
    async generateStructured(payload) {
      calls.provider.push(JSON.parse(JSON.stringify(payload)));
      return validCandidate();
    }
  };

  const service = createAdvisorRuntimeService({
    source,
    provider: modelProvider,
    providerConfig: {
      provider_name: 'fixture-provider',
      model_name: 'fixture-model',
      model_version: '2026-09-24',
      adapter_version: 'fixture-adapter/v1',
      timeout_ms: 1000
    },
    clock: tickingClock()
  });

  const request = {
    identity: {
      tenant_id: TENANT_ID,
      actor_role: role
    },
    source_execution_id: SOURCE_EXECUTION_ID,
    advisor_execution_id: ADVISOR_EXECUTION_ID,
    prompt_version: 'advisor-prompt/v1'
  };

  return { calls, source, service, request };
}

(async () => {
  await check('runtime carrega exatamente a source execution solicitada', async () => {
    const fx = runtimeFixture();
    await fx.service.execute(fx.request);
    assert.deepStrictEqual(fx.calls.load, [
      { source_execution_id: SOURCE_EXECUTION_ID }
    ]);
  });

  await check('owner executa A1 + A2 e persiste uma vez', async () => {
    const fx = runtimeFixture();
    const result = await fx.service.execute(fx.request);
    assert.strictEqual(result.execution.execution_status, 'SUCCEEDED');
    assert.strictEqual(fx.calls.provider.length, 1);
    assert.strictEqual(fx.calls.persist.length, 1);
  });

  await check('validador usa a mesma fronteira sem abrir RLS bruto', async () => {
    const fx = runtimeFixture({ role: 'validador' });
    const result = await fx.service.execute(fx.request);
    assert.strictEqual(result.execution.execution_status, 'SUCCEEDED');
    assert.strictEqual(fx.calls.persist.length, 1);
  });

  await check('vendedor e bloqueado antes de provider e persistencia', async () => {
    const fx = runtimeFixture({ role: 'vendedor' });
    await assert.rejects(
      fx.service.execute(fx.request),
      /ADVISOR_FORBIDDEN/
    );
    assert.strictEqual(fx.calls.provider.length, 0);
    assert.strictEqual(fx.calls.persist.length, 0);
  });

  await check('tenant divergente bloqueia antes de provider', async () => {
    const loaded = makePersistedSource();
    loaded.resource_tenant_id = '44444444-4444-4444-8444-444444444444';
    const fx = runtimeFixture({ loadedSource: loaded });
    await assert.rejects(
      fx.service.execute(fx.request),
      /ADVISOR_SOURCE_TENANT_MISMATCH/
    );
    assert.strictEqual(fx.calls.provider.length, 0);
    assert.strictEqual(fx.calls.persist.length, 0);
  });

  await check('lineage divergente na source e rejeitada', async () => {
    const loaded = makePersistedSource();
    loaded.offer_id = 'off_forjada';
    const fx = runtimeFixture({ loadedSource: loaded });
    await assert.rejects(
      fx.service.execute(fx.request),
      /ADVISOR_SOURCE_LINEAGE_MISMATCH/
    );
    assert.strictEqual(fx.calls.provider.length, 0);
  });

  await check('source inexistente falha fechado', async () => {
    const fx = runtimeFixture({ loadedSource: null });
    await assert.rejects(
      fx.service.execute(fx.request),
      /Advisor source nao encontrada/
    );
    assert.strictEqual(fx.calls.provider.length, 0);
  });

  await check('comparavel de outra cor e bloqueado por A1 antes do provider', async () => {
    const fx = runtimeFixture({
      loadedSource: makePersistedSource({ mixedColor: true })
    });
    await assert.rejects(
      fx.service.execute(fx.request),
      /ADVISOR_EVIDENCE_MISMATCH/
    );
    assert.strictEqual(fx.calls.provider.length, 0);
    assert.strictEqual(fx.calls.persist.length, 0);
  });

  await check('C05 insuficiente gera envelope BLOCKED sem chamar provider', async () => {
    const fx = runtimeFixture({
      loadedSource: makePersistedSource({ insufficient: true })
    });
    const result = await fx.service.execute(fx.request);
    assert.strictEqual(result.advisor_status, 'BLOCKED_INSUFFICIENT_DATA');
    assert.strictEqual(result.execution.execution_status, 'BLOCKED');
    assert.strictEqual(fx.calls.provider.length, 0);
    assert.strictEqual(fx.calls.persist.length, 1);
  });

  await check('persistencia recebe somente envelope AI e referencia source execution', async () => {
    const fx = runtimeFixture();
    await fx.service.execute(fx.request);
    const persisted = fx.calls.persist[0];
    assert.strictEqual(persisted.source_execution_id, SOURCE_EXECUTION_ID);
    assert.strictEqual(persisted.advisor_execution_id, ADVISOR_EXECUTION_ID);
    assert.strictEqual(persisted.envelope.execution_status, 'SUCCEEDED');
    assert.strictEqual('c05_decision_output' in persisted.envelope, false);
    assert.strictEqual('evidence_records' in persisted.envelope, false);
  });

  await check('idempotencia retornada pela persistence e preservada', async () => {
    const fx = runtimeFixture({ idempotent: true });
    const result = await fx.service.execute(fx.request);
    assert.strictEqual(result.idempotent, true);
  });

  await check('adapter load chama apenas RPC segura sem tenant no body', async () => {
    const calls = [];
    const source = createAdvisorRuntimeSource({
      supabaseUrl: 'https://fixture.supabase.co',
      anonKey: 'anon',
      accessToken: 'jwt',
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify(makePersistedSource()), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
    });
    await source.loadSource({ source_execution_id: SOURCE_EXECUTION_ID });
    assert(calls[0].url.endsWith('/rest/v1/rpc/extcalc_load_ai_advisor_source_v0'));
    const body = JSON.parse(calls[0].init.body);
    assert.deepStrictEqual(body, {
      p_source_execution_id: SOURCE_EXECUTION_ID
    });
    assert.strictEqual('tenant_id' in body, false);
  });

  await check('adapter persist chama RPC segura sem tenant ou actor no body', async () => {
    const calls = [];
    const source = createAdvisorRuntimeSource({
      supabaseUrl: 'https://fixture.supabase.co',
      anonKey: 'anon',
      accessToken: 'jwt',
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ ok: true, idempotent: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
    });
    await source.persistExecution({
      source_execution_id: SOURCE_EXECUTION_ID,
      advisor_execution_id: ADVISOR_EXECUTION_ID,
      envelope: { safe: true }
    });
    assert(calls[0].url.endsWith('/rest/v1/rpc/extcalc_persist_ai_advisor_execution_v0'));
    const body = JSON.parse(calls[0].init.body);
    assert.strictEqual('tenant_id' in body, false);
    assert.strictEqual('actor_id' in body, false);
    assert.strictEqual(body.p_source_execution_id, SOURCE_EXECUTION_ID);
  });

  await check('migration preserva raw RLS e usa SECURITY DEFINER com papel derivado', async () => {
    const sql = fs.readFileSync(
      'supabase/migrations/20260925003500_external_calc_ai_advisor_a3_v0.sql',
      'utf8'
    );
    assert(sql.includes('security definer'));
    assert(sql.includes('privado.fn_tenant_atual()'));
    assert(sql.includes('privado.fn_papel_atual()'));
    assert(sql.includes("v_papel not in ('dono', 'validador')"));
    assert(sql.includes("privado.fn_papel_atual() = 'dono'"));
    assert(!/alter table public\.extcalc_execution\s+(?!enable row level security)/i.test(sql));
  });

  await check('migration cria somente envelope AI ligado a execution existente', async () => {
    const sql = fs.readFileSync(
      'supabase/migrations/20260925003500_external_calc_ai_advisor_a3_v0.sql',
      'utf8'
    );
    assert(sql.includes('create table if not exists public.extcalc_ai_advisor_execution'));
    assert(sql.includes('foreign key (tenant_id, source_execution_id)'));
    assert(sql.includes('references public.extcalc_execution (tenant_id, execution_id)'));
    assert(!sql.includes('create table if not exists public.extcalc_ai_advisor_c05'));
    assert(!sql.includes('create table if not exists public.extcalc_ai_advisor_evidence'));
  });

  console.log('AI_ADVISOR_A3_FIXTURES=PASS checks=' + ok);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
