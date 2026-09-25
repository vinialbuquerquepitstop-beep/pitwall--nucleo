'use strict';
const assert = require('node:assert');
const { classifyFiles } = require('./proof-governance');

let checks = 0;
function check(name, fn) { fn(); checks += 1; console.log('OK ' + checks + ' - ' + name); }

check('cross-slice Review + Runtime e aceito por ownership', () => {
  const r = classifyFiles([
    'ferramentas/external-calc-c01-review/v0/review-api.js',
    'ferramentas/external-calc-runtime/v0/runtime.js'
  ]);
  assert.deepStrictEqual(r.unknown, []);
  assert(r.requiredOwners.includes('C01_REVIEW'));
  assert(r.requiredOwners.includes('RUNTIME'));
});

check('nome da branch nao participa da classificacao', () => {
  const r = classifyFiles(['ferramentas/external-calc-c01-review/v0/review-api.js']);
  assert.deepStrictEqual(r.unknown, []);
});

check('arquivo sem ownership falha fechado', () => {
  const r = classifyFiles(['financeiro/producao.js']);
  assert.deepStrictEqual(r.unknown, ['financeiro/producao.js']);
});

check('documento canonico de access control exige ownership explicito', () => {
  const r = classifyFiles(['docs/calculadora/EXTERNAL_CALC_ACCESS_CONTROL_MANAGER_SELLER_PLAN_V1.md']);
  assert.deepStrictEqual(r.unknown, []);
  assert(r.requiredOwners.includes('ACCESS_CONTROL_DOCS'));
});

check('governance pode evoluir a propria prova explicitamente', () => {
  const r = classifyFiles(['ferramentas/external-calc-proof-governance/v1/proof-governance.js']);
  assert.deepStrictEqual(r.unknown, []);
  assert(r.requiredOwners.includes('PROOF_GOVERNANCE'));
});

check('AI Advisor exige ownership explicito em A1 A2 e A3', () => {
  const r = classifyFiles([
    'ferramentas/external-calc-ai-advisor/v0/advisor-context.js',
    'ferramentas/external-calc-ai-advisor/v0/advisor-executor.js',
    'ferramentas/external-calc-ai-advisor/v0/advisor-runtime.js',
    'docs/calculadora/EXTERNAL_CALC_AI_ADVISOR_A1_GATE_V0.md',
    'docs/calculadora/EXTERNAL_CALC_AI_ADVISOR_A2_EXECUTION_GATE_V0.md',
    'docs/calculadora/EXTERNAL_CALC_AI_ADVISOR_A3_RUNTIME_PERSISTENCE_GATE_V0.md',
    'docs/calculadora/EXTERNAL_CALC_AI_ADVISOR_A31_PRODUCTION_ACTIVATION_V0.md',
    'docs/calculadora/EXTERNAL_CALC_AI_ADVISOR_A4_OPENAI_RUNTIME_GATE_V0.md',
    'docs/calculadora/EXTERNAL_CALC_AI_ADVISOR_A41_PRODUCTION_ACTIVATION_V0.md',
    'supabase/migrations/20260925003500_external_calc_ai_advisor_a3_v0.sql',
    'wrangler.jsonc'
  ]);
  assert.deepStrictEqual(r.unknown, []);
  assert(r.requiredOwners.includes('AI_ADVISOR'));
  assert(r.requiredOwners.includes('RUNTIME'));
});

check('C03 research evidence e execution authority possuem ownership explicito', () => {
  const r = classifyFiles([
    'ferramentas/external-calc-research-provider/v0/current-offers-evidence.js',
    'ferramentas/external-calc-authority/v0/postgres-authority-source.js'
  ]);
  assert.deepStrictEqual(r.unknown, []);
  assert(r.requiredOwners.includes('C03_RESEARCH_EVIDENCE'));
  assert(r.requiredOwners.includes('EXECUTION_AUTHORITY'));
});

check('C03 C04 market policy proposal exige ownership explicito', () => {
  const r = classifyFiles([
    'docs/calculadora/EXTERNAL_CALC_C03_C04_PRODUCTION_POLICY_PROPOSAL_V1.md'
  ]);
  assert.deepStrictEqual(r.unknown, []);
  assert(r.requiredOwners.includes('C03_C04_MARKET_POLICY'));
});

check('gate de configuracao aprovado exige ownership de politica', () => {
  const r = classifyFiles([
    'docs/calculadora/EXTERNAL_CALC_AUTHORITY_PRODUCTION_CONFIG_GATE_V0.md',
    'wrangler.jsonc'
  ]);
  assert.deepStrictEqual(r.unknown, []);
  assert(r.requiredOwners.includes('C03_C04_MARKET_POLICY'));
  assert(r.requiredOwners.includes('RUNTIME'));
});

console.log('EXTERNAL_CALC_PROOF_GOVERNANCE_V1=PASS checks=' + checks);
