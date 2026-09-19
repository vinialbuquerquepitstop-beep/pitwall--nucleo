'use strict';

const {
  buildPersistenceBundle
} = require('../../external-calc-persistence/v0/lifecycle-repository');

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} obrigatorio`);
  }
  return value.trim();
}

function joinUrl(base, path) {
  return assertNonEmpty(base, 'supabaseUrl').replace(/\/+$/, '') + path;
}

function authHeaders(anonKey, accessToken) {
  return {
    apikey: assertNonEmpty(anonKey, 'anonKey'),
    authorization: `Bearer ${assertNonEmpty(accessToken, 'accessToken')}`,
    'content-type': 'application/json'
  };
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Supabase respondeu JSON invalido: ${text.slice(0, 160)}`);
  }
}

function createPostgresLifecycleRepository(options = {}) {
  const supabaseUrl = assertNonEmpty(options.supabaseUrl, 'supabaseUrl');
  const anonKey = assertNonEmpty(options.anonKey, 'anonKey');
  const accessToken = assertNonEmpty(options.accessToken, 'accessToken');
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl obrigatorio');

  return {
    async persistExecution(args) {
      const bundle = buildPersistenceBundle(args);
      const response = await fetchImpl(
        joinUrl(supabaseUrl, '/rest/v1/rpc/extcalc_persist_execution_v0'),
        {
          method: 'POST',
          headers: authHeaders(anonKey, accessToken),
          body: JSON.stringify({ p_bundle: bundle })
        }
      );

      const payload = await readJson(response);
      if (!response.ok) {
        const message = payload?.message || payload?.error || `HTTP ${response.status}`;
        throw new Error(`EXTCALC_PERSIST_FAILED: ${message}`);
      }

      if (!payload || payload.ok !== true) {
        throw new Error('EXTCALC_PERSIST_FAILED: resposta invalida');
      }

      return {
        execution_id: bundle.execution.execution_id,
        idempotent: payload.idempotent === true
      };
    },

    async loadExecution(identity) {
      const tenantId = assertNonEmpty(identity?.tenant_id, 'tenant_id');
      const executionId = assertNonEmpty(identity?.execution_id, 'execution_id');

      const params = new URLSearchParams({
        tenant_id: `eq.${tenantId}`,
        execution_id: `eq.${executionId}`,
        select: 'tenant_id,execution_id,analysis_id,offer_id,offer_revision,request_snapshot,response_snapshot'
      });

      const response = await fetchImpl(
        joinUrl(supabaseUrl, `/rest/v1/extcalc_execution?${params.toString()}`),
        {
          method: 'GET',
          headers: authHeaders(anonKey, accessToken)
        }
      );

      const payload = await readJson(response);
      if (!response.ok) {
        const message = payload?.message || payload?.error || `HTTP ${response.status}`;
        throw new Error(`EXTCALC_LOAD_FAILED: ${message}`);
      }

      if (!Array.isArray(payload) || payload.length === 0) return null;
      if (payload.length !== 1) throw new Error('EXTCALC_LOAD_FAILED: execution_id nao e unico');

      const row = payload[0];
      if (row.tenant_id !== tenantId || row.execution_id !== executionId) {
        throw new Error('EXTCALC_LOAD_FAILED: identidade divergente');
      }

      return {
        tenant_id: row.tenant_id,
        execution_id: row.execution_id,
        request: row.request_snapshot,
        service_result: row.response_snapshot,
        lineage: {
          analysis_id: row.analysis_id,
          offer_id: row.offer_id,
          offer_revision: row.offer_revision
        }
      };
    }
  };
}

module.exports = {
  createPostgresLifecycleRepository
};
