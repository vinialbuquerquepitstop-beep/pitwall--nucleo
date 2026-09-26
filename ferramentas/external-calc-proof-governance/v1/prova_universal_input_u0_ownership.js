'use strict';

const assert = require('node:assert');
const { classifyFiles } = require('./proof-governance');

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log('OK ' + checks + ' - ' + name);
}

check('future Universal Input implementation path has explicit ownership', () => {
  const result = classifyFiles([
    'ferramentas/external-calc-universal-input/v1/canonical-document.js'
  ]);
  assert.deepStrictEqual(result.unknown, []);
  assert(result.requiredOwners.includes('UNIVERSAL_INPUT'));
});

check('Universal Input governance document has explicit ownership', () => {
  const result = classifyFiles([
    'docs/calculadora/EXTERNAL_CALC_UNIVERSAL_INPUT_U0_GOVERNANCE_GATE_V0.md'
  ]);
  assert.deepStrictEqual(result.unknown, []);
  assert(result.requiredOwners.includes('UNIVERSAL_INPUT'));
});

check('Universal Input workflow remains workflow-governed', () => {
  const result = classifyFiles([
    '.github/workflows/external_calc_universal_input_u0_governance.yml'
  ]);
  assert.deepStrictEqual(result.unknown, []);
  assert(result.requiredOwners.includes('WORKFLOW_GOVERNANCE'));
});

check('Universal Input does not absorb unrelated paths', () => {
  const result = classifyFiles([
    'ferramentas/external-calc-universal-input-v2/unsafe.js'
  ]);
  assert.deepStrictEqual(result.unknown, [
    'ferramentas/external-calc-universal-input-v2/unsafe.js'
  ]);
});

console.log('EXTERNAL_CALC_UNIVERSAL_INPUT_U0_OWNERSHIP=PASS checks=' + checks);
