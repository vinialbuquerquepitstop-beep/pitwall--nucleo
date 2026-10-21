#!/usr/bin/env node
// Structural negative/positive proof. No widening ownership by file prefix alone.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {classifyFiles}=require('../../external-calc-proof-governance/v1/proof-governance.js');
const files=[
 'ferramentas/external-calc-generalization/v0/generate.mjs',
 'ferramentas/external-calc-generalization/v0/verify.mjs',
 'ferramentas/external-calc-generalization/v0/compare.mjs',
 'ferramentas/external-calc-generalization/v0/run-parser.mjs',
 'ferramentas/external-calc-generalization/v0/proof.mjs',
 'ferramentas/external-calc-generalization/v0/prova_ownership.mjs',
 'ferramentas/external-calc-generalization/v0/README.md',
 'docs/external-calc/EXTERNAL_CALC_EXECUCAO_LINEAR_V3_GENERALIZACAO.md',
 'docs/external-calc/EXTERNAL_CALC_VERTICAL_SLICES_GENERALIZATION_V1.md',
 'docs/external-calc/EXTERNAL_CALC_GENERALIZATION_DECISION_ADR_2026-10-20.md',
 'docs/external-calc/EXTERNAL_CALC_VS0_BASELINE_GENERALIZATION_2026-10-20.md',
 'docs/external-calc/EXTERNAL_CALC_VS1_RELATION_GRAPH_PROPOSAL_V0.md',
 'docs/external-calc/EXTERNAL_CALC_VS3_UNCERTAINTY_REVIEW_GATE_V0.md',
 'docs/external-calc/EXTERNAL_CALC_VS4_GENERALIZATION_METRICS_V0.md',
 'docs/external-calc/EXTERNAL_CALC_VS5_C01_INTEGRATION_PRECHECK_V0.md',
 'docs/external-calc/EXTERNAL_CALC_VS51_TRIANGULAR_ORACLE_CHECKPOINT_2026-10-21.md',
 'docs/external-calc/EXTERNAL_CALC_VS52_SERVICE_PREVIEW_CONTRACT_V0.md',
 'docs/external-calc/EXTERNAL_CALC_VS53_RUNTIME_PREVIEW_CHECKPOINT_V0.md',
 'docs/external-calc/EXTERNAL_CALC_VS53B_IDENTITY_BRIDGE_CHECKPOINT_V0.md',
 'docs/external-calc/EXTERNAL_CALC_VS53C_RLS_HOMOLOGATION_PRECHECK_V0.md',
 'docs/external-calc/EXTERNAL_CALC_PLANO_DE_CONVERGENCIA_V2.md',
 'docs/calculadora/PROCESSO.md',
 '.github/workflows/external_calc_generalization_method_v0.yml',
 'ferramentas/external-calc-proof-governance/v1/proof-governance.js'
];
const classified=classifyFiles(files);
assert.deepEqual(classified.unknown,[],'every changed path must have explicit ownership');
assert(classified.requiredOwners.includes('GENERALIZATION_EVALUATION'));
assert(classified.requiredOwners.includes('PROOF_GOVERNANCE'));
assert(classified.requiredOwners.includes('WORKFLOW_GOVERNANCE'));
for(const path of [
 'ferramentas/external-calc-generalization/v1/unapproved.mjs',
 'ferramentas/external-calc-generalization-v0/unsafe.mjs',
 'docs/external-calc/UNDECLARED_CANON.md',
 'ferramentas/interpreter-core/v2/unsafe.js'
])assert.deepEqual(classifyFiles([path]).unknown,[path],'unknown path must fail closed');
console.log('GENERALIZATION_OWNERSHIP=PASS paths='+files.length+' deny=4');
