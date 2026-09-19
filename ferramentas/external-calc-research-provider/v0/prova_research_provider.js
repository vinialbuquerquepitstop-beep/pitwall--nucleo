'use strict';

const assert = require('assert');
const {
  CONTRACT_VERSION,
  createResearchProviderRequest,
  normalizeProviderResponse
} = require('./research-provider-contract');
const { runC03Research } = require('../../external-calc-c03/v1/c03-research-core');

let ok = 0;
function check(name, fn) {
  try {
    fn();
    ok += 1;
    console.log(`OK ${ok} - ${name}`);
  } catch (error) {
    console.error(`FALHOU - ${name}`);
    throw error;
  }
}

function c01Candidate(overrides = {}) {
  return {
    contract_version: 'external-calc-c01-readonly/v1',
    analysis_id: 'ana_provider_001',
    source_id: 'src_provider_001',
    offer_id: 'off_provider_001',
    offer_revision: 2,
    execution_status: 'SUCCEEDED',
    domain_outcome: 'VALID',
    freshness_status: 'CURRENT',
    offer_identity_fingerprint: 'identity-provider-001',
    offer_value_fingerprint: 'value-provider-001-r2',
    reviewed_offer: {
      supplier_id: 'SUP_TESTE',
      model: {
        id: 'iphone-17-pro-256',
        label: 'iPhone 17 Pro',
        attributes: {}
      },
      capacity_gb: 256,
      condition: 'LACRADO',
      color: 'AZUL',
      price: { amount_minor: 650000, currency: 'BRL' }
    },
    provenance_refs: ['human_review:provider-fixture'],
    ...overrides
  };
}

function providerRequest() {
  return createResearchProviderRequest({
    provider_request_id: 'provider_req_001',
    c01_candidate: c01Candidate(),
    provider_profile: {
      provider_id: 'search-fixture',
      provider_version: '1',
      max_results: 10,
      country: 'BR',
      language: 'pt-br'
    },
    market_context: {
      country: 'BR'
    }
  });
}

function hit(id, price, overrides = {}) {
  return {
    source_ref: id,
    source_url: `https://example.test/${id}`,
    title: `Oferta ${id}`,
    observed_at: '2026-09-19T18:00:00.000Z',
    price_minor: price,
    confidence: 0.9,
    product: {
      model_id: 'iphone-17-pro-256',
      model_label: 'iPhone 17 Pro',
      capacity_gb: 256,
      condition: 'LACRADO',
      color: 'PRETO'
    },
    ...overrides
  };
}

check('request de provider deriva assunto do C01 revisado', () => {
  const result = providerRequest();
  assert.strictEqual(result.contract_version, CONTRACT_VERSION);
  assert.strictEqual(result.offer_id, 'off_provider_001');
  assert.strictEqual(result.offer_revision, 2);
  assert.strictEqual(result.research_subject.model_id, 'iphone-17-pro-256');
  assert.strictEqual(result.research_subject.capacity_gb, 256);
  assert.strictEqual(result.research_subject.currency, 'BRL');
});

check('query inclui modelo capacidade condicao e cor sem semantica de provider', () => {
  const result = providerRequest();
  assert.strictEqual(result.query_text, 'iPhone 17 Pro 256GB LACRADO AZUL');
  assert.strictEqual(result.provider_id, 'search-fixture');
});

check('request recusa C01 ainda nao revisado', () => {
  assert.throws(
    () => createResearchProviderRequest({
      provider_request_id: 'provider_req_invalid',
      c01_candidate: c01Candidate({ domain_outcome: 'REVIEW_REQUIRED' }),
      provider_profile: {
        provider_id: 'search-fixture',
        provider_version: '1',
        max_results: 10
      }
    }),
    /C01 precisa estar VALID/
  );
});

check('response normaliza hit em Evidence consumivel pelo C03', () => {
  const response = normalizeProviderResponse({
    provider_response_id: 'provider_resp_001',
    provider_request: providerRequest(),
    hits: [hit('a', 620000)]
  });

  assert.strictEqual(response.evidence_count, 1);
  assert.strictEqual(response.evidence[0].normalized_price, 620000);
  assert.strictEqual(response.evidence[0].currency, 'BRL');
  assert.strictEqual(response.evidence[0].source_ref, 'search-fixture:a');
  assert.ok(response.evidence[0].evidence_id.startsWith('ev_'));
});

check('mesmo hit produz evidence_id deterministico', () => {
  const a = normalizeProviderResponse({
    provider_response_id: 'provider_resp_a',
    provider_request: providerRequest(),
    hits: [hit('same', 630000)]
  });
  const b = normalizeProviderResponse({
    provider_response_id: 'provider_resp_b',
    provider_request: providerRequest(),
    hits: [hit('same', 630000)]
  });
  assert.strictEqual(a.evidence[0].evidence_id, b.evidence[0].evidence_id);
});

check('preco invalido do provider e rejeitado antes do C03', () => {
  assert.throws(
    () => normalizeProviderResponse({
      provider_response_id: 'provider_resp_bad_price',
      provider_request: providerRequest(),
      hits: [hit('bad', 0)]
    }),
    /price_minor invalido/
  );
});

check('evidencia normalizada entra no C03 sem adapter adicional', () => {
  const response = normalizeProviderResponse({
    provider_response_id: 'provider_resp_c03',
    provider_request: providerRequest(),
    hits: [
      hit('c1', 600000),
      hit('c2', 650000),
      hit('c3', 700000)
    ]
  });

  const c03 = runC03Research({
    research_run_id: 'research_provider_001',
    c01_candidate: c01Candidate(),
    research_profile: {
      profile_id: 'research-provider-fixture',
      profile_version: '1',
      required_match_fields: ['model_id', 'capacity_gb', 'condition'],
      min_evidence_confidence: 0.7,
      max_age_seconds: 60 * 60 * 24 * 30
    },
    as_of: '2026-09-19T19:00:00.000Z',
    market_context: { country: 'BR' },
    evidence: response.evidence
  });

  assert.strictEqual(c03.evidence_summary.total, 3);
  assert.strictEqual(c03.evidence_summary.eligible, 3);
  assert.strictEqual(c03.eligible_evidence_ids.length, 3);
});

check('provider request e response nao alteram input', () => {
  const reqInput = {
    provider_request_id: 'provider_req_immutable',
    c01_candidate: c01Candidate(),
    provider_profile: {
      provider_id: 'search-fixture',
      provider_version: '1',
      max_results: 10
    },
    market_context: { country: 'BR' }
  };
  const beforeReq = JSON.stringify(reqInput);
  const req = createResearchProviderRequest(reqInput);
  assert.strictEqual(JSON.stringify(reqInput), beforeReq);

  const respInput = {
    provider_response_id: 'provider_resp_immutable',
    provider_request: req,
    hits: [hit('immutable', 640000)]
  };
  const beforeResp = JSON.stringify(respInput);
  normalizeProviderResponse(respInput);
  assert.strictEqual(JSON.stringify(respInput), beforeResp);
});

check('fingerprints sao deterministas para o mesmo conteudo', () => {
  const a = providerRequest();
  const b = providerRequest();
  assert.strictEqual(a.subject_fingerprint, b.subject_fingerprint);
  assert.strictEqual(a.output_fingerprint, b.output_fingerprint);

  const ra = normalizeProviderResponse({
    provider_response_id: 'provider_resp_det_a',
    provider_request: a,
    hits: [hit('det', 640000)]
  });
  const rb = normalizeProviderResponse({
    provider_response_id: 'provider_resp_det_b',
    provider_request: b,
    hits: [hit('det', 640000)]
  });
  assert.strictEqual(ra.output_fingerprint, rb.output_fingerprint);
});

console.log(`RESEARCH_PROVIDER_FIXTURES=PASS checks=${ok}`);
