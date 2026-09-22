'use strict';

const assert = require('assert');
const { createC01ReviewCandidateRuntime } = require('./candidate-runtime');
const schema = require('../../interpreter-core/v1/domains/apple-iphone-v0.schema.json');
const knowledge = require('../../interpreter-core/v1/domains/apple-iphone-v0.knowledge.json');

async function main() {
  const persisted = [];
  const resolverCalls = [];
  const runtime = createC01ReviewCandidateRuntime({
    trustedInputResolver: {
      async resolve(input) {
        resolverCalls.push(input);
        return {
          analysis_id: 'analysis-runtime-gate-v0',
          source_id: 'source-trusted-fixture-v0',
          currency: 'BRL',
          document: {
            contract_version: 'raw-document/v1',
            document_id: 'doc-trusted-fixture-v0',
            content: 'iPhone 17 512GB Preto Lacrado - 8.100'
          },
          schema,
          knowledge,
          supplier_profiles: null
        };
      }
    },
    candidateRepository: {
      async persistCandidate(candidate) {
        persisted.push(JSON.parse(JSON.stringify(candidate)));
        return { persisted: true };
      }
    }
  });

  const result = await runtime.execute({ trusted_input_ref: 'fixture:canonical-document-001' });

  assert.deepStrictEqual(resolverCalls, [{ trusted_input_ref: 'fixture:canonical-document-001' }]);
  assert.strictEqual(result.contract_version, 'external-calc-c01-review-candidate-runtime/v0');
  assert.strictEqual(result.stage, 'REVIEW');
  assert.strictEqual(result.execution_status, 'SUCCEEDED');
  assert.strictEqual(result.persisted_count, persisted.length);
  assert.ok(persisted.length > 0, 'fixture precisa produzir ao menos um candidate');
  for (const candidate of persisted) {
    assert.strictEqual(candidate.contract_version, 'external-calc-c01-readonly/v1');
    assert.strictEqual(candidate.domain_outcome, 'REVIEW_REQUIRED');
    assert.strictEqual(candidate.reviewed_offer, null);
    assert.strictEqual(candidate.review, null);
  }

  assert.throws(
    () => createC01ReviewCandidateRuntime({}),
    /trustedInputResolver\.resolve obrigatorio/
  );

  const source = require('fs').readFileSync(__dirname + '/candidate-runtime.js', 'utf8');
  assert.ok(!/service_role/i.test(source), 'zero service_role');
  assert.ok(!/external-calc-c0[2-5]/i.test(source), 'zero C02-C05 dependency');
  assert.ok(!/calculation_profile|research_profile|indicator_profile|evidence/i.test(source),
    'browser/domain profiles must not cross this runtime');

  console.log('C01 review candidate runtime gate: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
