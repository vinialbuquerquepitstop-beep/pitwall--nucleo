'use strict';
const assert = require('assert');
const { createTrustedInputIngestionV0 } = require('./trusted-input-ingestion');
const { createInMemoryTrustedInputRepository, createTrustedInputResolverV0 } = require('./trusted-input-repository');
const { createC01ReviewCandidateRuntime } = require('../../external-calc-c01-review-candidate-runtime/v0/candidate-runtime');
const schema = require('../../interpreter-core/v1/domains/apple-iphone-v0.schema.json');
const knowledge = require('../../interpreter-core/v1/domains/apple-iphone-v0.knowledge.json');

async function main() {
  const repository = createInMemoryTrustedInputRepository();
  const ingestion = createTrustedInputIngestionV0({ repository });
  const uploaded = await ingestion.ingest({
    tenant_id:'store-a', actor_ref:'user-a', filename:'fornecedor.txt',
    content_type:'text/plain', bytes:Buffer.from('iPhone 17 512GB Preto Lacrado - 8.100')
  });
  const ref = uploaded.accepted[0].trusted_input_ref;
  const resolver = createTrustedInputResolverV0({ repository, schema, knowledge });

  const own = await resolver.resolve({ tenant_id:'store-a', trusted_input_ref:ref });
  assert.ok(own);
  assert.strictEqual(own.source_id, uploaded.accepted[0].source_id);
  const foreign = await resolver.resolve({ tenant_id:'store-b', trusted_input_ref:ref });
  assert.strictEqual(foreign, null);

  const persisted=[];
  const runtime=createC01ReviewCandidateRuntime({
    trustedInputResolver: resolver,
    candidateRepository:{async persistCandidate(v){persisted.push(v);return {persisted:true};}}
  });
  const result=await runtime.execute({trusted_input_ref:ref});
  assert.strictEqual(result.execution_status,'SUCCEEDED');
  assert.strictEqual(result.source_id,uploaded.accepted[0].source_id);
  assert.ok(result.candidates.length>0);
  assert.ok(persisted.length>0);
  assert.strictEqual(result.stage,'REVIEW');
  console.log('Trusted Input -> C01 candidate runtime integration gate: PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
