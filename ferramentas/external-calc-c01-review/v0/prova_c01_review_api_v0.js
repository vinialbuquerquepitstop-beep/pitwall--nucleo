'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  REVIEW_PATH,
  createC01ReviewApiV0
} = require('./review-api');

const TENANT = '00000000-0000-4000-8000-000000000001';
const SUBJECT = '11111111-1111-4111-8111-111111111111';

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
    analysis_id: 'ana_review_api_001',
    source_id: 'src_review_api_001',
    offer_id: 'off_review_api_001',
    offer_revision: 2,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-review-api-001',
    offer_value_fingerprint: 'value-review-api-001-r2',
    reviewed_offer: {
      supplier_id: 'SUP_TESTE',
      model: { id: 'iphone-17-pro-256', label: 'iPhone 17 Pro 256GB', attributes: {} },
      capacity_gb: 256,
      condition: 'LACRADO',
      color: 'AZUL',
      price: { amount_minor: 650000, currency: 'BRL' }
    },
    review: {
      decision: 'EDIT',
      reviewer_ref: SUBJECT,
      reviewed_at: '2026-09-19T23:40:00.000Z',
      reason: null,
      material_change: true,
      original_offer_revision: 1
    },
    provenance_refs: ['human_review:fixture']
  };
}

function makeApi(auth = {
  tenant_id: TENANT,
  subject: SUBJECT,
  can_execute_external_calc: true
}) {
  const state = { calls: [] };
  const reviewAuthority = {
    async review(args) {
      state.calls.push(JSON.parse(JSON.stringify(args)));
      return {
        authority_version: 'external-calc-c01-review-authority/v0',
        persisted: { ok: true, review_id: '22222222-2222-4222-8222-222222222222' },
        c01: c01()
      };
    }
  };

  const api = createC01ReviewApiV0({
    authenticate: async () => auth,
    reviewAuthority
  });

  return { api, state };
}

async function call(api, body, method = 'POST', pathName = REVIEW_PATH) {
  return api.handle({
    method,
    path: pathName,
    headers: { authorization: 'Bearer fixture' },
    body
  });
}

(async () => {
  await check('review API deriva tenant e ator do contexto autenticado', async () => {
    const { api, state } = makeApi();
    const command = {
      analysis_id: 'ana_review_api_001',
      offer_id: 'off_review_api_001',
      offer_revision: 1,
      decision: 'EDIT',
      patch: { color: 'AZUL' }
    };

    const response = await call(api, command);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(state.calls.length, 1);
    assert.strictEqual(state.calls[0].tenant_id, TENANT);
    assert.strictEqual(state.calls[0].actor_ref, SUBJECT);
    assert.deepStrictEqual(state.calls[0].command, command);
    assert.strictEqual(response.body.offer_revision, 2);
    assert.strictEqual(response.body.domain_outcome, 'VALID');
  });

  await check('sem auth responde 401 antes do authority', async () => {
    const { api, state } = makeApi(null);
    const response = await call(api, {
      analysis_id: 'ana_review_api_001',
      offer_id: 'off_review_api_001',
      offer_revision: 1,
      decision: 'ACCEPT'
    });

    assert.strictEqual(response.status, 401);
    assert.strictEqual(state.calls.length, 0);
  });

  await check('papel sem permissao responde 403 antes do authority', async () => {
    const { api, state } = makeApi({
      tenant_id: TENANT,
      subject: SUBJECT,
      can_execute_external_calc: false
    });
    const response = await call(api, {
      analysis_id: 'ana_review_api_001',
      offer_id: 'off_review_api_001',
      offer_revision: 1,
      decision: 'ACCEPT'
    });

    assert.strictEqual(response.status, 403);
    assert.strictEqual(state.calls.length, 0);
  });

  await check('subject ausente responde 401', async () => {
    const { api, state } = makeApi({
      tenant_id: TENANT,
      subject: null,
      can_execute_external_calc: true
    });
    const response = await call(api, {
      analysis_id: 'ana_review_api_001',
      offer_id: 'off_review_api_001',
      offer_revision: 1,
      decision: 'ACCEPT'
    });

    assert.strictEqual(response.status, 401);
    assert.strictEqual(state.calls.length, 0);
  });

  await check('campo de autoridade proibido preserva codigo do Review Authority', async () => {
    const reviewAuthority = {
      async review() {
        const error = new Error('campo de autoridade proibido no review command: $.reviewer_ref');
        error.code = 'CLIENT_REVIEW_AUTHORITY_FIELD';
        throw error;
      }
    };
    const api = createC01ReviewApiV0({
      authenticate: async () => ({
        tenant_id: TENANT,
        subject: SUBJECT,
        can_execute_external_calc: true
      }),
      reviewAuthority
    });

    const response = await call(api, {
      analysis_id: 'ana_review_api_001',
      offer_id: 'off_review_api_001',
      offer_revision: 1,
      decision: 'ACCEPT',
      reviewer_ref: 'client-controlled'
    });

    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error.code, 'CLIENT_REVIEW_AUTHORITY_FIELD');
  });

  await check('rota e metodo fora do contrato retornam 404', async () => {
    const { api, state } = makeApi();
    const body = {
      analysis_id: 'ana_review_api_001',
      offer_id: 'off_review_api_001',
      offer_revision: 1,
      decision: 'ACCEPT'
    };

    assert.strictEqual((await call(api, body, 'GET')).status, 404);
    assert.strictEqual((await call(api, body, 'POST', '/api/external-calc/v0/other')).status, 404);
    assert.strictEqual(state.calls.length, 0);
  });

  await check('review API e fina e nao importa Core/Persistence/Supabase', async () => {
    const source = fs.readFileSync(path.join(__dirname, 'review-api.js'), 'utf8').toLowerCase();

    for (const token of [
      'external-calc-c01/v1',
      'applyhumanreview',
      'postgres',
      'supabase',
      'offer_value_fingerprint',
      'offer_identity_fingerprint',
      'cash_margin_minor',
      'calculatec02(',
      'runc03research(',
      'runc04priceindicator(',
      'composedecisionoutput('
    ]) {
      assert.strictEqual(source.includes(token), false, `review API contem dependencia/regra proibida: ${token}`);
    }
  });

  console.log(`C01_REVIEW_API_V0=PASS checks=${ok}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
