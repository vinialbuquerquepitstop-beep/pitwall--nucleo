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

check('AI Advisor exige ownership explicito em A1 e A2', () => {
  const r = classifyFiles([
    'ferramentas/external-calc-ai-advisor/v0/advisor-context.js',
    'ferramentas/external-calc-ai-advisor/v0/advisor-executor.js',
    'docs/calculadora/EXTERNAL_CALC_AI_ADVISOR_A1_GATE_V0.md',
    'docs/calculadora/EXTERNAL_CALC_AI_ADVISOR_A2_EXECUTION_GATE_V0.md'
  ]);
  assert.deepStrictEqual(r.unknown, []);
  assert(r.requiredOwners.includes('AI_ADVISOR'));
});

console.log('EXTERNAL_CALC_PROOF_GOVERNANCE_V1=PASS checks=' + checks);
