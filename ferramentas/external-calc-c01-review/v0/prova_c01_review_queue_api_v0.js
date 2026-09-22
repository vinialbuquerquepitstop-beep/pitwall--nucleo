'use strict';
const assert = require('assert');
const { createC01ReviewApiV0 } = require('./review-api');

const candidate = {
  contract_version: 'external-calc-c01-readonly/v1',
  analysis_id: 'ana_queue_1', source_id: 'src_queue_1', offer_id: 'off_queue_1',
  offer_revision: 1, execution_status: 'SUCCEEDED', domain_outcome: 'REVIEW_REQUIRED',
  freshness_status: 'CURRENT', offer_identity_fingerprint: 'ifp', offer_value_fingerprint: 'vfp',
  interpretation_run_id: 'run_1', interpreted_offer: { price: { amount_minor: 810000, currency: 'BRL' } },
  reviewed_offer: null, review: null
};

(async () => {
  let listCalls = 0;
  const api = createC01ReviewApiV0({
    authenticate: async () => ({ tenant_id: 'tenant-1', subject: 'user-1', can_execute_external_calc: true }),
    candidateSource: { async listPendingCandidates() { listCalls += 1; return [candidate]; } },
    reviewAuthority: { async review() { throw new Error('POST nao deve executar no GET'); } }
  });
  const res = await api.handle({ method: 'GET', path: '/api/external-calc/v0/review' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.count, 1);
  assert.strictEqual(res.body.queue[0].domain_outcome, 'REVIEW_REQUIRED');
  assert.strictEqual(listCalls, 1);

  const unauth = createC01ReviewApiV0({
    authenticate: async () => null,
    candidateSource: { async listPendingCandidates() { throw new Error('nao deve ler'); } },
    reviewAuthority: { async review() {} }
  });
  const denied = await unauth.handle({ method: 'GET', path: '/api/external-calc/v0/review' });
  assert.strictEqual(denied.status, 401);

  console.log('C01_REVIEW_QUEUE_API_GATE_V0=PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
