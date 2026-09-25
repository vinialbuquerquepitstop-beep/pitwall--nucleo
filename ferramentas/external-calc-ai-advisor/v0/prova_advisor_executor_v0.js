'use strict';

const assert = require('assert');
const {
  CONTRACT_VERSION: ADVISOR_CONTEXT_CONTRACT_VERSION
} = require('./advisor-context');
const {
  EXECUTION_CONTRACT_VERSION,
  CAPABILITY,
  stableHash,
  createAdvisorExecutor
} = require('./advisor-executor');

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

function readyContext() {
  const modelInput = {
    task: 'EXPLAIN_SELECTED_OFFER_AND_SUPPORT_NEGOTIATION',
    facts: {
      offer: {
        supplier_id: 'SUP_A',
        model: { id: 'iphone-17-pro-256', label: 'iPhone 17 Pro' },
        capacity_gb: 256,
        condition: 'LACRADO',
        color: 'PRETO',
        supplier_offer_price: { amount_minor: 650000, currency: 'BRL' }
      },
      market: {
        price_signal: 'MARKET',
        market_reference_price: { amount_minor: 650000, currency: 'BRL' },
        market_delta_amount: { amount_minor: 0, currency: 'BRL' },
        market_delta_percent: 0,
        price_signal_confidence: 0.94,
        comparable_evidence_count: 3,
        reason: 'fixture',
        evidence: [
          {
            evidence_id: 'ev_a',
            normalized_price: 620000,
            currency: 'BRL'
          }
        ]
      },
      commercial: {
        store_cost: { amount_minor: 620000, currency: 'BRL' },
        normal_sale_price: { amount_minor: 705000, currency: 'BRL' },
        installment_base_price: { amount_minor: 715000, currency: 'BRL' },
        estimated_margin: { amount_minor: 55000, currency: 'BRL' },
        estimated_margin_percent: 8.46,
        promo_price: null,
        promotion_floor: null,
        promotion_range: null
      }
    },
    allowed_evidence_refs: [
      'decision_output:decision_advisor_001',
      'offer_revision:off_advisor_001:3',
      'research_run:research_advisor_001',
      'price_signal_run:signal_advisor_001',
      'evidence:ev_a'
    ],
    guardrails: {
      max_insights: 3,
      insights_are_advisory: true,
      operational_data_is_read_only: true,
      may_override_price: false,
      may_override_provenance: false,
      may_invent_missing_values: false,
      allowed_insight_types: [
        'MARKET_POSITION',
        'NEGOTIATION_OPPORTUNITY'
      ]
    }
  };

  return {
    contract_version: ADVISOR_CONTEXT_CONTRACT_VERSION,
    analysis_id: 'ana_advisor_001',
    offer_id: 'off_advisor_001',
    offer_revision: 3,
    decision_output_id: 'decision_advisor_001',
    decision_output_fingerprint: 'decision-fingerprint-001',
    tenant_id: 'tenant_a',
    actor_role: 'dono',
    advisor_status: 'READY_FOR_MODEL',
    blocking_reason: null,
    model_input: modelInput,
    context_fingerprint: stableHash(JSON.stringify(modelInput))
  };
}

function blockedContext() {
  return {
    contract_version: ADVISOR_CONTEXT_CONTRACT_VERSION,
    analysis_id: 'ana_advisor_001',
    offer_id: 'off_advisor_001',
    offer_revision: 3,
    decision_output_id: 'decision_advisor_001',
    decision_output_fingerprint: 'decision-fingerprint-001',
    tenant_id: 'tenant_a',
    actor_role: 'dono',
    advisor_status: 'BLOCKED_INSUFFICIENT_DATA',
    blocking_reason: 'C05_INSUFFICIENT_DATA',
    model_input: null,
    context_fingerprint: 'blocked-fingerprint'
  };
}

function validCandidate() {
  return {
    insights: [
      {
        insight_id: 'ins_1',
        type: 'MARKET_POSITION',
        severity: 'MEDIUM',
        evidence_refs: [
          'decision_output:decision_advisor_001',
          'evidence:ev_a'
        ],
        summary: 'A oferta esta alinhada a referencia de mercado validada.',
        confidence: 0.91
      }
    ]
  };
}

function providerConfig(overrides = {}) {
  return {
    provider_name: 'fixture-provider',
    model_name: 'fixture-model',
    model_version: '2026-09-24',
    adapter_version: 'fixture-adapter/v1',
    timeout_ms: 1000,
    ...overrides
  };
}

function tickingClock() {
  const values = [
    '2026-09-24T21:30:00.000-03:00',
    '2026-09-24T21:30:01.000-03:00',
    '2026-09-24T21:30:02.000-03:00'
  ];
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function executorFor(provider, config = providerConfig(), clock = tickingClock()) {
  return createAdvisorExecutor({
    provider,
    providerConfig: config,
    clock
  });
}

(async () => {
  await check('READY context chama provider exatamente uma vez', async () => {
    let calls = 0;
    const provider = {
      async generateStructured() {
        calls += 1;
        return validCandidate();
      }
    };
    const result = await executorFor(provider).execute({
      execution_id: 'ai_exec_001',
      prompt_version: 'advisor-prompt/v1',
      context: readyContext()
    });
    assert.strictEqual(calls, 1);
    assert.strictEqual(result.execution_status, 'SUCCEEDED');
  });

  await check('capability e prompt version sao controlados pelo executor', async () => {
    let received = null;
    const provider = {
      async generateStructured(payload) {
        received = payload;
        return validCandidate();
      }
    };
    await executorFor(provider).execute({
      execution_id: 'ai_exec_002',
      prompt_version: 'advisor-prompt/v7',
      context: readyContext()
    });
    assert.strictEqual(received.capability, CAPABILITY);
    assert.strictEqual(received.prompt_version, 'advisor-prompt/v7');
  });

  await check('metadata de provider vem da configuracao confiavel', async () => {
    const result = await executorFor({
      async generateStructured() {
        return validCandidate();
      }
    }).execute({
      execution_id: 'ai_exec_003',
      prompt_version: 'advisor-prompt/v1',
      context: readyContext()
    });
    assert.strictEqual(result.provider_name, 'fixture-provider');
    assert.strictEqual(result.model_name, 'fixture-model');
    assert.strictEqual(result.model_version, '2026-09-24');
    assert.strictEqual(result.adapter_version, 'fixture-adapter/v1');
  });

  await check('execution envelope possui contrato e identidade da oferta', async () => {
    const context = readyContext();
    const result = await executorFor({
      async generateStructured() {
        return validCandidate();
      }
    }).execute({
      execution_id: 'ai_exec_004',
      prompt_version: 'advisor-prompt/v1',
      context
    });
    assert.strictEqual(result.execution_contract_version, EXECUTION_CONTRACT_VERSION);
    assert.strictEqual(result.analysis_id, context.analysis_id);
    assert.strictEqual(result.offer_id, context.offer_id);
    assert.strictEqual(result.offer_revision, context.offer_revision);
    assert.strictEqual(result.decision_output_id, context.decision_output_id);
  });

  await check('input hash e deterministico para o mesmo contexto e prompt', async () => {
    const provider = { async generateStructured() { return validCandidate(); } };
    const a = await executorFor(provider).execute({
      execution_id: 'ai_exec_005a',
      prompt_version: 'advisor-prompt/v1',
      context: readyContext()
    });
    const b = await executorFor(provider).execute({
      execution_id: 'ai_exec_005b',
      prompt_version: 'advisor-prompt/v1',
      context: readyContext()
    });
    assert.strictEqual(a.input_hash, b.input_hash);
  });

  await check('source refs sao herdadas do contexto permitido', async () => {
    const context = readyContext();
    const result = await executorFor({
      async generateStructured() { return validCandidate(); }
    }).execute({
      execution_id: 'ai_exec_006',
      prompt_version: 'advisor-prompt/v1',
      context
    });
    assert.deepStrictEqual(
      result.source_refs,
      context.model_input.allowed_evidence_refs
    );
  });

  await check('candidate valido passa pelo validator A1', async () => {
    const result = await executorFor({
      async generateStructured() { return validCandidate(); }
    }).execute({
      execution_id: 'ai_exec_007',
      prompt_version: 'advisor-prompt/v1',
      context: readyContext()
    });
    assert.strictEqual(result.validator_status, 'PASS');
    assert.strictEqual(result.candidate_output.insights.length, 1);
    assert(result.candidate_output_hash);
  });

  await check('candidate com campo de autoridade extra e rejeitado sem output', async () => {
    const result = await executorFor({
      async generateStructured() {
        return {
          insights: validCandidate().insights,
          price_override: 1
        };
      }
    }).execute({
      execution_id: 'ai_exec_008',
      prompt_version: 'advisor-prompt/v1',
      context: readyContext()
    });
    assert.strictEqual(result.execution_status, 'REJECTED');
    assert.strictEqual(result.validator_status, 'REJECTED');
    assert.strictEqual(result.candidate_output, null);
    assert.strictEqual(result.error.code, 'CANDIDATE_VALIDATION_FAILED');
  });

  await check('candidate com evidence ref fora da allowlist e rejeitado', async () => {
    const candidate = validCandidate();
    candidate.insights[0].evidence_refs = ['evidence:forged'];
    const result = await executorFor({
      async generateStructured() { return candidate; }
    }).execute({
      execution_id: 'ai_exec_009',
      prompt_version: 'advisor-prompt/v1',
      context: readyContext()
    });
    assert.strictEqual(result.execution_status, 'REJECTED');
    assert.strictEqual(result.candidate_output, null);
  });

  await check('erro do provider vira FAILED sem propagar mensagem bruta', async () => {
    const result = await executorFor({
      async generateStructured() {
        throw new Error('secret-token-should-not-leak');
      }
    }).execute({
      execution_id: 'ai_exec_010',
      prompt_version: 'advisor-prompt/v1',
      context: readyContext()
    });
    assert.strictEqual(result.execution_status, 'FAILED');
    assert.deepStrictEqual(result.error, { code: 'PROVIDER_ERROR' });
    assert(!JSON.stringify(result).includes('secret-token-should-not-leak'));
  });

  await check('contexto bloqueado nao chama provider', async () => {
    let calls = 0;
    const result = await executorFor({
      async generateStructured() {
        calls += 1;
        return validCandidate();
      }
    }).execute({
      execution_id: 'ai_exec_011',
      prompt_version: 'advisor-prompt/v1',
      context: blockedContext()
    });
    assert.strictEqual(calls, 0);
    assert.strictEqual(result.execution_status, 'BLOCKED');
    assert.strictEqual(result.validator_status, 'NOT_RUN');
    assert.strictEqual(result.input_hash, null);
  });

  await check('provider recebe clone e nao consegue alterar contexto original', async () => {
    const context = readyContext();
    const before = JSON.stringify(context);
    const result = await executorFor({
      async generateStructured(payload) {
        payload.input.facts.offer.color = 'ALTERADO';
        payload.input.facts.commercial.store_cost.amount_minor = 1;
        return validCandidate();
      }
    }).execute({
      execution_id: 'ai_exec_012',
      prompt_version: 'advisor-prompt/v1',
      context
    });
    assert.strictEqual(result.execution_status, 'SUCCEEDED');
    assert.strictEqual(JSON.stringify(context), before);
  });

  await check('context fingerprint adulterado bloqueia antes do provider', async () => {
    let calls = 0;
    const context = readyContext();
    context.model_input.facts.offer.color = 'AZUL';
    await assert.rejects(
      executorFor({
        async generateStructured() {
          calls += 1;
          return validCandidate();
        }
      }).execute({
        execution_id: 'ai_exec_013',
        prompt_version: 'advisor-prompt/v1',
        context
      }),
      /ADVISOR_CONTEXT_TAMPERED/
    );
    assert.strictEqual(calls, 0);
  });

  await check('guardrail adulterado bloqueia antes do provider', async () => {
    let calls = 0;
    const context = readyContext();
    context.model_input.guardrails.may_override_price = true;
    context.context_fingerprint = stableHash(JSON.stringify(context.model_input));
    await assert.rejects(
      executorFor({
        async generateStructured() {
          calls += 1;
          return validCandidate();
        }
      }).execute({
        execution_id: 'ai_exec_014',
        prompt_version: 'advisor-prompt/v1',
        context
      }),
      /guardrails invalidos/
    );
    assert.strictEqual(calls, 0);
  });

  await check('prompt e provider config invalidos falham fechado', async () => {
    assert.throws(
      () => executorFor(
        { async generateStructured() { return validCandidate(); } },
        providerConfig({ provider_name: '' })
      ),
      /provider_config.provider_name obrigatorio/
    );

    await assert.rejects(
      executorFor({
        async generateStructured() { return validCandidate(); }
      }).execute({
        execution_id: 'ai_exec_015',
        prompt_version: '',
        context: readyContext()
      }),
      /prompt_version obrigatorio/
    );
  });

  console.log('AI_ADVISOR_A2_FIXTURES=PASS checks=' + ok);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
