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
} = require('../../external-calc-api/v0/application-service');
const {
  createExternalCalcAuthorityResolver
} = require('./authority-resolver');
const {
  createAuthorityBoundApplicationService
} = require('./authority-application-service');
const {
  createPostgresAuthoritySource
} = require('./postgres-authority-source');

const TENANT = '00000000-0000-4000-8000-000000000001';
const FIXED_TIME = '2026-09-19T23:00:00.000Z';

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

function c01() {
  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_authority_001',
    source_id: 'src_authority_001',
    offer_id: 'off_authority_001',
    offer_revision: 3,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-authority-001',
    offer_value_fingerprint: 'value-authority-001-r3',
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
    provenance_refs: ['human_review:authority-fixture']
  };
}

function calculationProfile() {
  return {
    profile_id: 'calc-authority-fixture',
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
    profile_id: 'research-authority-fixture',
    profile_version: '1',
    required_match_fields: ['model_id', 'capacity_gb', 'condition'],
    min_evidence_confidence: 0.7,
    max_age_seconds: 60 * 60 * 24 * 30
  };
}

function indicatorProfile() {
  return {
    profile_id: 'indicator-authority-fixture',
    profile_version: '1',
    min_evidence_count: 3,
    cheap_at_or_below_percent: -5,
    expensive_at_or_above_percent: 5
  };
}

function evidence(id, price) {
  return {
    evidence_id: id,
    source_ref: `trusted:${id}`,
    observed_at: '2026-09-19T22:00:00.000Z',
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
    evidence('ev_authority_1', 600000),
    evidence('ev_authority_2', 650000),
    evidence('ev_authority_3', 700000)
  ];
}

function command() {
  return {
    analysis_id: 'ana_authority_001',
    offer_id: 'off_authority_001',
    offer_revision: 3
  };
}

function makeAuthoritySource(overrides = {}) {
  return {
    async loadC01() { return c01(); },
    async loadCalculationProfile() { return calculationProfile(); },
    async loadResearchProfile() { return researchProfile(); },
    async loadIndicatorProfile() { return indicatorProfile(); },
    async loadEvidence() { return trustedEvidence(); },
    async loadMarketContext() { return { country: 'BR' }; },
    ...overrides
  };
}

function deterministicIds() {
  const ids = [
    '10000000-0000-4000-8000-000000000111',
    'calc_authority_server_001',
    'research_authority_server_001',
    'signal_authority_server_001',
    'decision_authority_server_001'
  ];
  let index = 0;
  return () => ids[index++];
}

function makeSystem(source = makeAuthoritySource()) {
  const resolver = createExternalCalcAuthorityResolver({
    source,
    clock: () => FIXED_TIME
  });
  const repository = createLifecycleRepository(createInMemoryLifecycleAdapter());
  const base = createExternalCalcApplicationService({
    repository,
    idFactory: deterministicIds(),
    clock: () => FIXED_TIME
  });
  const app = createAuthorityBoundApplicationService({
    applicationService: base,
    authorityResolver: resolver
  });
  return { resolver, repository, app };
}

(async () => {
  await check('cliente envia somente referencias e resolver monta input confiavel', async () => {
    const { resolver } = makeSystem();
    const result = await resolver.resolveExecutionInput({
      tenant_id: TENANT,
      command: command()
    });

    assert.deepStrictEqual(result.c01_candidate, c01());
    assert.deepStrictEqual(result.calculation_profile, calculationProfile());
    assert.deepStrictEqual(result.research_profile, researchProfile());
    assert.deepStrictEqual(result.indicator_profile, indicatorProfile());
    assert.deepStrictEqual(result.evidence, trustedEvidence());
    assert.strictEqual(result.as_of, FIXED_TIME);
    assert.deepStrictEqual(result.market_context, { country: 'BR' });
  });

  await check('cliente nao pode enviar C01 perfis evidencia nem as_of', async () => {
    const { resolver } = makeSystem();

    for (const [field, value] of [
      ['c01_candidate', c01()],
      ['calculation_profile', calculationProfile()],
      ['research_profile', researchProfile()],
      ['indicator_profile', indicatorProfile()],
      ['evidence', trustedEvidence()],
      ['as_of', FIXED_TIME]
    ]) {
      await assert.rejects(
        () => resolver.resolveExecutionInput({
          tenant_id: TENANT,
          command: { ...command(), [field]: value }
        }),
        /autoridade proibido/
      );
    }
  });

  await check('autoridade proibida aninhada tambem e rejeitada', async () => {
    const { resolver } = makeSystem();
    await assert.rejects(
      () => resolver.resolveExecutionInput({
        tenant_id: TENANT,
        command: {
          ...command(),
          presentation: { calculation_profile: calculationProfile() }
        }
      }),
      /autoridade proibido/
    );
  });

  await check('C01 carregado precisa corresponder exatamente a referencia', async () => {
    const { resolver } = makeSystem(makeAuthoritySource({
      async loadC01() {
        return { ...c01(), offer_revision: 4 };
      }
    }));

    await assert.rejects(
      () => resolver.resolveExecutionInput({
        tenant_id: TENANT,
        command: command()
      }),
      /diverge da referencia/
    );
  });

  await check('authority facade preserva paridade com Service V0 direto', async () => {
    const { app } = makeSystem();
    const viaAuthority = await app.executeAnalysis({
      tenant_id: TENANT,
      request: command()
    });

    const direct = executeExternalCalcService({
      c01_candidate: c01(),
      calculation_profile: calculationProfile(),
      research_profile: researchProfile(),
      indicator_profile: indicatorProfile(),
      as_of: FIXED_TIME,
      market_context: { country: 'BR' },
      evidence: trustedEvidence(),
      run_ids: {
        calculation_run_id: 'calc_authority_server_001',
        research_run_id: 'research_authority_server_001',
        price_signal_run_id: 'signal_authority_server_001',
        decision_output_id: 'decision_authority_server_001'
      }
    });

    assert.deepStrictEqual(viaAuthority.service_result, direct);
  });

  await check('persistencia guarda input resolvido e nao o command do browser', async () => {
    const { app, repository } = makeSystem();
    const result = await app.executeAnalysis({
      tenant_id: TENANT,
      request: command()
    });

    const replay = repository.loadExecution({
      tenant_id: TENANT,
      execution_id: result.execution_id
    });

    assert.deepStrictEqual(replay.request.c01_candidate, c01());
    assert.deepStrictEqual(replay.request.evidence, trustedEvidence());
    assert.strictEqual(replay.request.analysis_id, undefined);
    assert.ok(replay.request.run_ids);
  });

  await check('loadExecution continua delegado ao Application Service existente', async () => {
    const { app } = makeSystem();
    const executed = await app.executeAnalysis({
      tenant_id: TENANT,
      request: command()
    });
    const loaded = await app.loadExecution({
      tenant_id: TENANT,
      execution_id: executed.execution_id
    });

    assert.strictEqual(loaded.execution_id, executed.execution_id);
    assert.deepStrictEqual(loaded.service_result, executed.service_result);
  });

  await check('Postgres authority source usa C01 e Evidence sob tenant autenticado', async () => {
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
      calls.push({ url, init });

      if (url.includes('/rest/v1/extcalc_offer_revision?')) {
        return new Response(JSON.stringify([{
          tenant_id: TENANT,
          analysis_id: c01().analysis_id,
          offer_id: c01().offer_id,
          offer_revision: c01().offer_revision,
          c01_snapshot: c01(),
          domain_outcome: 'VALID',
          freshness_status: 'CURRENT'
        }]), { status: 200 });
      }

      if (url.includes('/rest/v1/calc_dados?')) {
        return new Response(JSON.stringify([{
          tenant_id: TENANT,
          atualizado_em: '2026-08-17T23:20:02.384365+00:00',
          dados: {
            config: {
              margens: { iPhone: { av: 550, pc: 650 } },
              pb: 100,
              taxas: { 12: 1.1, 18: 1.2 }
            }
          }
        }]), { status: 200 });
      }

      if (url.includes('/rest/v1/extcalc_evidence?')) {
        return new Response(JSON.stringify(
          trustedEvidence().map(item => ({
            evidence_id: item.evidence_id,
            evidence_snapshot: item,
            observed_at: item.observed_at
          }))
        ), { status: 200 });
      }

      throw new Error(`fetch inesperado: ${url}`);
    };

    const source = createPostgresAuthoritySource({
      supabaseUrl: 'https://example.supabase.co',
      anonKey: 'anon-fixture',
      accessToken: 'jwt-fixture',
      fetchImpl,
      serverConfig: {
        calculationCategory: 'iPhone',
        researchProfileJson: researchProfile(),
        indicatorProfileJson: indicatorProfile(),
        marketContextJson: { country: 'BR' }
      }
    });

    const loadedC01 = await source.loadC01({
      tenant_id: TENANT,
      ...command()
    });
    const loadedCalculation = await source.loadCalculationProfile({
      tenant_id: TENANT,
      c01_candidate: loadedC01
    });
    const loadedEvidence = await source.loadEvidence({
      tenant_id: TENANT,
      c01_candidate: loadedC01
    });

    assert.deepStrictEqual(loadedC01, c01());
    assert.strictEqual(loadedCalculation.cash_margin_minor, 55000);
    assert.strictEqual(loadedCalculation.installment_margin_minor, 65000);
    assert.strictEqual(loadedCalculation.installment_base_addon_minor, 10000);
    assert.deepStrictEqual(loadedEvidence, trustedEvidence());
    assert.ok(calls[0].url.includes(encodeURIComponent(`eq.${TENANT}`)));
    assert.ok(calls[1].url.includes('/rest/v1/calc_dados?'));
    assert.ok(calls[1].url.includes(encodeURIComponent(`eq.${TENANT}`)));
    assert.ok(calls[2].url.includes(encodeURIComponent(`eq.${TENANT}`)));
    assert.strictEqual(calls[0].init.headers.authorization, 'Bearer jwt-fixture');
  });

  await check('C02 vem de calc_dados e C03-C04 permanecem server-side', async () => {
    let calcCalls = 0;
    const source = createPostgresAuthoritySource({
      supabaseUrl: 'https://example.supabase.co',
      anonKey: 'anon-fixture',
      accessToken: 'jwt-fixture',
      fetchImpl: async (url) => {
        if (!url.includes('/rest/v1/calc_dados?')) {
          throw new Error(`fetch inesperado: ${url}`);
        }
        calcCalls += 1;
        return new Response(JSON.stringify([{
          tenant_id: TENANT,
          atualizado_em: '2026-08-17T23:20:02.384365+00:00',
          dados: {
            config: {
              margens: { iPhone: { av: 550, pc: 650 } },
              pb: 100,
              taxas: { 12: 1.1, 18: 1.2 }
            }
          }
        }]), { status: 200 });
      },
      serverConfig: {
        calculationCategory: 'iPhone',
        researchProfileJson: JSON.stringify(researchProfile()),
        indicatorProfileJson: JSON.stringify(indicatorProfile()),
        marketContextJson: JSON.stringify({ country: 'BR' })
      }
    });

    const calc = await source.loadCalculationProfile({ tenant_id: TENANT });
    assert.strictEqual(calc.profile_id, 'pitwall-calc-dados:iPhone');
    assert.strictEqual(calc.cash_margin_minor, 55000);
    assert.strictEqual(calc.installment_margin_minor, 65000);
    assert.strictEqual(calc.installment_base_addon_minor, 10000);
    assert.strictEqual(calc.installment_coefficients[12], 1.1);
    assert.strictEqual(calc.installment_coefficients[18], 1.2);
    assert.strictEqual(calcCalls, 1);

    assert.deepStrictEqual(await source.loadResearchProfile(), researchProfile());
    assert.deepStrictEqual(await source.loadIndicatorProfile(), indicatorProfile());
    assert.deepStrictEqual(await source.loadMarketContext(), { country: 'BR' });
  });

  await check('camada de autoridade nao reimplementa C01-C05', async () => {
    const files = [
      'authority-resolver.js',
      'authority-application-service.js',
      'postgres-authority-source.js'
    ];

    for (const file of files) {
      const source = fs.readFileSync(path.join(__dirname, file), 'utf8').toLowerCase();
      for (const forbidden of [
        "require('../../external-calc-c01",
        "require('../../external-calc-c02",
        "require('../../external-calc-c03",
        "require('../../external-calc-c04",
        "require('../../external-calc-c05",
        'mediannminor',
        'calculatec02(',
        'runc03research(',
        'runc04priceindicator(',
        'composedecisionoutput('
      ]) {
        assert.strictEqual(
          source.includes(forbidden),
          false,
          `regra de dominio entrou em ${file}: ${forbidden}`
        );
      }
    }
  });

  console.log(`PRODUCT_EXECUTION_AUTHORITY_GATE_V0=PASS checks=${ok}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
