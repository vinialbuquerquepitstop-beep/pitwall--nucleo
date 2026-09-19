'use strict';

const crypto = require('crypto');

const SERVICE_VERSION = 'external-calc-service/v0';
const RUN_FIELDS = {
  C02: {
    key: 'c02',
    runId: 'calculation_run_id',
    inputFingerprint: 'calculation_input_fingerprint'
  },
  C03: {
    key: 'c03',
    runId: 'research_run_id',
    inputFingerprint: 'research_input_fingerprint'
  },
  C04: {
    key: 'c04',
    runId: 'price_signal_run_id',
    inputFingerprint: 'price_signal_input_fingerprint'
  },
  C05: {
    key: 'c05',
    runId: 'decision_output_id',
    inputFingerprint: 'decision_input_fingerprint'
  }
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function assertEqualValue(actual, expected, message) {
  if (canonical(actual) !== canonical(expected)) throw new Error(message);
}

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} obrigatorio`);
  return value.trim();
}

function assertUuid(value, field) {
  const normalized = assertNonEmpty(value, field).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error(`${field} deve ser UUID`);
  }
  return normalized;
}

function assertIsoDate(value, field) {
  const normalized = assertNonEmpty(value, field);
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${field} deve ser ISO date-time`);
  return normalized;
}

function assertServiceLineage(request, result) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');
  if (!result || typeof result !== 'object') throw new Error('service_result obrigatorio');
  if (result.service_version !== SERVICE_VERSION) throw new Error('service_result nao e Service V0');

  const c01 = request.c01_candidate;
  if (!c01 || c01.contract_version !== 'external-calc-c01-readonly/v1') {
    throw new Error('C01 candidate invalido');
  }
  if (c01.execution_status !== 'SUCCEEDED' || c01.domain_outcome !== 'VALID' || c01.freshness_status !== 'CURRENT') {
    throw new Error('C01 precisa estar SUCCEEDED VALID CURRENT');
  }
  if (!Number.isInteger(c01.offer_revision) || c01.offer_revision < 1) {
    throw new Error('C01 offer_revision invalida');
  }

  for (const field of ['analysis_id', 'source_id', 'offer_id', 'offer_revision']) {
    if (result[field] !== c01[field]) throw new Error(`service_result.${field} diverge de C01`);
  }

  if (!result.core_pipeline || !result.core_pipeline.input_fingerprint || !result.core_pipeline.output_fingerprint) {
    throw new Error('core_pipeline fingerprints obrigatorios');
  }

  const outputs = result.outputs || {};
  for (const contractId of Object.keys(RUN_FIELDS)) {
    const spec = RUN_FIELDS[contractId];
    const output = outputs[spec.key];
    if (!output || output.contract_id !== contractId) throw new Error(`${contractId} ausente no Service V0`);
    if (output.analysis_id !== c01.analysis_id || output.offer_id !== c01.offer_id || output.offer_revision !== c01.offer_revision) {
      throw new Error(`${contractId} perdeu lineage da oferta`);
    }
    if (output.execution_status !== 'SUCCEEDED' || output.freshness_status !== 'CURRENT') {
      throw new Error(`${contractId} precisa estar SUCCEEDED CURRENT`);
    }
    if (!output[spec.runId] || output[spec.runId] !== request.run_ids[spec.runId]) {
      throw new Error(`${contractId} run_id diverge do request`);
    }
    if (!output[spec.inputFingerprint] || !output.output_fingerprint) {
      throw new Error(`${contractId} fingerprints obrigatorios`);
    }
  }

  return c01;
}

function buildPersistenceBundle(args) {
  if (!args || typeof args !== 'object') throw new Error('args obrigatorio');

  const tenantId = assertUuid(args.tenant_id, 'tenant_id');
  const executionId = assertUuid(args.execution_id || crypto.randomUUID(), 'execution_id');
  const persistedAt = assertIsoDate(args.persisted_at || new Date().toISOString(), 'persisted_at');
  const request = deepClone(args.request);
  const result = deepClone(args.service_result);
  const c01 = assertServiceLineage(request, result);

  const runs = Object.entries(RUN_FIELDS).map(([contractId, spec]) => {
    const output = result.outputs[spec.key];
    return {
      tenant_id: tenantId,
      execution_id: executionId,
      analysis_id: c01.analysis_id,
      offer_id: c01.offer_id,
      offer_revision: c01.offer_revision,
      contract_id: contractId,
      run_id: output[spec.runId],
      contract_version: output.contract_version,
      engine_version: output.engine_version,
      stage: output.stage,
      execution_status: output.execution_status,
      domain_outcome: output.domain_outcome == null ? null : output.domain_outcome,
      freshness_status: output.freshness_status,
      input_fingerprint: output[spec.inputFingerprint],
      output_fingerprint: output.output_fingerprint,
      provenance_refs: deepClone(Array.isArray(output.provenance_refs) ? output.provenance_refs : []),
      output_snapshot: deepClone(output),
      criado_em: persistedAt
    };
  });

  const evidence = (Array.isArray(request.evidence) ? request.evidence : []).map(item => ({
    tenant_id: tenantId,
    execution_id: executionId,
    analysis_id: c01.analysis_id,
    offer_id: c01.offer_id,
    offer_revision: c01.offer_revision,
    evidence_id: assertNonEmpty(item.evidence_id, 'evidence.evidence_id'),
    observed_at: item.observed_at == null ? null : assertIsoDate(item.observed_at, 'evidence.observed_at'),
    evidence_snapshot: deepClone(item),
    criado_em: persistedAt
  }));

  const humanReview = c01.review ? {
    review_id: assertUuid(args.review_id || crypto.randomUUID(), 'review_id'),
    tenant_id: tenantId,
    analysis_id: c01.analysis_id,
    offer_id: c01.offer_id,
    offer_revision: c01.offer_revision,
    decision: assertNonEmpty(c01.review.decision, 'C01 review.decision'),
    reviewer_ref: assertNonEmpty(c01.review.reviewer_ref, 'C01 review.reviewer_ref'),
    reviewed_at: assertIsoDate(c01.review.reviewed_at, 'C01 review.reviewed_at'),
    review_snapshot: deepClone(c01.review),
    criado_em: persistedAt
  } : null;

  const bundle = {
    version: 'external-calc-persistence-bundle/v0',
    analysis: {
      tenant_id: tenantId,
      analysis_id: c01.analysis_id,
      criado_em: persistedAt
    },
    offer: {
      tenant_id: tenantId,
      analysis_id: c01.analysis_id,
      offer_id: c01.offer_id,
      source_id: c01.source_id,
      criado_em: persistedAt
    },
    offer_revision: {
      tenant_id: tenantId,
      analysis_id: c01.analysis_id,
      offer_id: c01.offer_id,
      offer_revision: c01.offer_revision,
      c01_contract_version: c01.contract_version,
      c01_snapshot: deepClone(c01),
      offer_identity_fingerprint: c01.offer_identity_fingerprint,
      offer_value_fingerprint: c01.offer_value_fingerprint,
      domain_outcome: c01.domain_outcome,
      freshness_status: c01.freshness_status,
      criado_em: persistedAt
    },
    human_review: humanReview,
    execution: {
      execution_id: executionId,
      tenant_id: tenantId,
      analysis_id: c01.analysis_id,
      offer_id: c01.offer_id,
      offer_revision: c01.offer_revision,
      service_version: result.service_version,
      service_engine_version: result.service_engine_version,
      core_contract_version: result.core_pipeline.contract_version,
      core_engine_version: result.core_pipeline.engine_version,
      core_input_fingerprint: result.core_pipeline.input_fingerprint,
      core_output_fingerprint: result.core_pipeline.output_fingerprint,
      execution_status: result.execution_status,
      freshness_status: result.freshness_status,
      request_snapshot: request,
      response_snapshot: result,
      criado_em: persistedAt
    },
    runs,
    evidence
  };

  validatePersistenceBundle(bundle);
  return bundle;
}

function validatePersistenceBundle(bundle) {
  if (!bundle || bundle.version !== 'external-calc-persistence-bundle/v0') {
    throw new Error('persistence bundle v0 invalido');
  }

  const request = bundle.execution.request_snapshot;
  const response = bundle.execution.response_snapshot;
  const c01 = request.c01_candidate;

  assertEqualValue(bundle.offer_revision.c01_snapshot, c01, 'C01 snapshot divergente');
  if (bundle.offer_revision.offer_revision !== c01.offer_revision) {
    throw new Error('offer_revision divergente');
  }

  for (const [contractId, spec] of Object.entries(RUN_FIELDS)) {
    const row = bundle.runs.find(item => item.contract_id === contractId);
    if (!row) throw new Error(`run persistido ausente: ${contractId}`);
    assertEqualValue(row.output_snapshot, response.outputs[spec.key], `${contractId} snapshot divergente`);
    if (row.run_id !== response.outputs[spec.key][spec.runId]) throw new Error(`${contractId} run_id divergente`);
    if (row.input_fingerprint !== response.outputs[spec.key][spec.inputFingerprint]) {
      throw new Error(`${contractId} input_fingerprint divergente`);
    }
    if (row.output_fingerprint !== response.outputs[spec.key].output_fingerprint) {
      throw new Error(`${contractId} output_fingerprint divergente`);
    }
  }

  const requestEvidence = Array.isArray(request.evidence) ? request.evidence : [];
  if (requestEvidence.length !== bundle.evidence.length) throw new Error('Evidence[] contagem divergente');
  for (const item of requestEvidence) {
    const row = bundle.evidence.find(candidate => candidate.evidence_id === item.evidence_id);
    if (!row) throw new Error(`evidence persistida ausente: ${item.evidence_id}`);
    assertEqualValue(row.evidence_snapshot, item, `evidence snapshot divergente: ${item.evidence_id}`);
  }

  if (c01.review) {
    if (!bundle.human_review) throw new Error('HumanReview ausente');
    assertEqualValue(bundle.human_review.review_snapshot, c01.review, 'HumanReview snapshot divergente');
  } else if (bundle.human_review) {
    throw new Error('HumanReview inesperado');
  }

  if (bundle.execution.core_input_fingerprint !== response.core_pipeline.input_fingerprint) {
    throw new Error('core input fingerprint divergente');
  }
  if (bundle.execution.core_output_fingerprint !== response.core_pipeline.output_fingerprint) {
    throw new Error('core output fingerprint divergente');
  }

  return true;
}

function reconstructExecution(bundle) {
  validatePersistenceBundle(bundle);
  return {
    tenant_id: bundle.execution.tenant_id,
    execution_id: bundle.execution.execution_id,
    request: deepClone(bundle.execution.request_snapshot),
    service_result: deepClone(bundle.execution.response_snapshot),
    lineage: {
      analysis_id: bundle.execution.analysis_id,
      offer_id: bundle.execution.offer_id,
      offer_revision: bundle.execution.offer_revision
    }
  };
}

function createInMemoryLifecycleAdapter() {
  const byExecution = new Map();

  return {
    saveBundle(bundle) {
      validatePersistenceBundle(bundle);
      const id = bundle.execution.execution_id;
      if (byExecution.has(id)) throw new Error('execution_id ja persistido');
      byExecution.set(id, deepClone(bundle));
      return { execution_id: id };
    },
    loadBundle({ tenant_id, execution_id }) {
      const tenantId = assertUuid(tenant_id, 'tenant_id');
      const executionId = assertUuid(execution_id, 'execution_id');
      const found = byExecution.get(executionId);
      if (!found || found.execution.tenant_id !== tenantId) return null;
      return deepClone(found);
    }
  };
}

function createLifecycleRepository(adapter) {
  if (!adapter || typeof adapter.saveBundle !== 'function' || typeof adapter.loadBundle !== 'function') {
    throw new Error('adapter com saveBundle/loadBundle obrigatorio');
  }

  return {
    persistExecution(args) {
      const bundle = buildPersistenceBundle(args);
      return adapter.saveBundle(bundle);
    },
    loadExecution(identity) {
      const bundle = adapter.loadBundle(identity);
      if (!bundle) return null;
      return reconstructExecution(bundle);
    }
  };
}

module.exports = {
  RUN_FIELDS,
  buildPersistenceBundle,
  validatePersistenceBundle,
  reconstructExecution,
  createInMemoryLifecycleAdapter,
  createLifecycleRepository
};
