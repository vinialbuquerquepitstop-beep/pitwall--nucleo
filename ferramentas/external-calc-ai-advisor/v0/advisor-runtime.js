'use strict';

const {
  buildAdvisorContext
} = require('./advisor-context');
const {
  createAdvisorExecutor
} = require('./advisor-executor');

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(field + ' obrigatorio');
  }
  return value.trim();
}

function assertUuid(value, field) {
  const normalized = assertNonEmpty(value, field).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error(field + ' deve ser UUID');
  }
  return normalized;
}

function joinUrl(base, path) {
  return assertNonEmpty(base, 'supabaseUrl').replace(/\/+$/, '') + path;
}

function authHeaders(anonKey, accessToken) {
  return {
    apikey: assertNonEmpty(anonKey, 'anonKey'),
    authorization: 'Bearer ' + assertNonEmpty(accessToken, 'accessToken'),
    'content-type': 'application/json'
  };
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Supabase respondeu JSON invalido');
  }
}

function createAdvisorRuntimeSource(options = {}) {
  const supabaseUrl = assertNonEmpty(options.supabaseUrl, 'supabaseUrl');
  const anonKey = assertNonEmpty(options.anonKey, 'anonKey');
  const accessToken = assertNonEmpty(options.accessToken, 'accessToken');
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new Error('fetchImpl obrigatorio');
  }

  return {
    async loadSource({ source_execution_id }) {
      const sourceExecutionId = assertUuid(source_execution_id, 'source_execution_id');
      const response = await fetchImpl(
        joinUrl(supabaseUrl, '/rest/v1/rpc/extcalc_load_ai_advisor_source_v0'),
        {
          method: 'POST',
          headers: authHeaders(anonKey, accessToken),
          body: JSON.stringify({
            p_source_execution_id: sourceExecutionId
          })
        }
      );

      const payload = await readJson(response);
      if (!response.ok) {
        const message = payload?.message || payload?.error || ('HTTP ' + response.status);
        throw new Error('EXTCALC_ADVISOR_SOURCE_LOAD_FAILED: ' + message);
      }

      if (payload == null) return null;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('EXTCALC_ADVISOR_SOURCE_LOAD_FAILED: resposta invalida');
      }

      return payload;
    },

    async persistExecution({
      source_execution_id,
      advisor_execution_id,
      envelope
    }) {
      const sourceExecutionId = assertUuid(source_execution_id, 'source_execution_id');
      const advisorExecutionId = assertUuid(advisor_execution_id, 'advisor_execution_id');

      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
        throw new Error('envelope obrigatorio');
      }

      const response = await fetchImpl(
        joinUrl(supabaseUrl, '/rest/v1/rpc/extcalc_persist_ai_advisor_execution_v0'),
        {
          method: 'POST',
          headers: authHeaders(anonKey, accessToken),
          body: JSON.stringify({
            p_source_execution_id: sourceExecutionId,
            p_advisor_execution_id: advisorExecutionId,
            p_envelope: envelope
          })
        }
      );

      const payload = await readJson(response);
      if (!response.ok) {
        const message = payload?.message || payload?.error || ('HTTP ' + response.status);
        throw new Error('EXTCALC_ADVISOR_PERSIST_FAILED: ' + message);
      }

      if (!payload || payload.ok !== true) {
        throw new Error('EXTCALC_ADVISOR_PERSIST_FAILED: resposta invalida');
      }

      return {
        advisor_execution_id: advisorExecutionId,
        idempotent: payload.idempotent === true
      };
    }
  };
}

function assertIdentity(identity) {
  if (!identity || typeof identity !== 'object') {
    throw new Error('identity obrigatoria');
  }

  return {
    tenant_id: assertNonEmpty(identity.tenant_id, 'identity.tenant_id'),
    actor_role: assertNonEmpty(identity.actor_role, 'identity.actor_role')
  };
}

function assertLoadedSource(source, identity) {
  if (!source || typeof source !== 'object') {
    throw new Error('Advisor source nao encontrada');
  }

  if (source.resource_tenant_id !== identity.tenant_id) {
    throw new Error('ADVISOR_SOURCE_TENANT_MISMATCH');
  }

  if (!source.c05_decision_output || !Array.isArray(source.evidence_records)) {
    throw new Error('Advisor source incompleta');
  }

  const c05 = source.c05_decision_output;

  if (
    source.analysis_id !== c05.analysis_id ||
    source.offer_id !== c05.offer_id ||
    source.offer_revision !== c05.offer_revision
  ) {
    throw new Error('ADVISOR_SOURCE_LINEAGE_MISMATCH');
  }

  return source;
}

function createAdvisorRuntimeService(options = {}) {
  const source = options.source;
  const executor = options.executor || createAdvisorExecutor({
    provider: options.provider,
    providerConfig: options.providerConfig,
    clock: options.clock
  });

  if (!source || typeof source.loadSource !== 'function' || typeof source.persistExecution !== 'function') {
    throw new Error('source com loadSource/persistExecution obrigatorio');
  }

  return {
    async execute(request) {
      if (!request || typeof request !== 'object') {
        throw new Error('request obrigatorio');
      }

      const identity = assertIdentity(request.identity);
      const sourceExecutionId = assertUuid(
        request.source_execution_id,
        'source_execution_id'
      );
      const advisorExecutionId = assertUuid(
        request.advisor_execution_id,
        'advisor_execution_id'
      );
      const promptVersion = assertNonEmpty(
        request.prompt_version,
        'prompt_version'
      );

      const loaded = assertLoadedSource(
        await source.loadSource({
          source_execution_id: sourceExecutionId
        }),
        identity
      );

      const context = buildAdvisorContext({
        authority_context: {
          tenant_id: identity.tenant_id,
          resource_tenant_id: loaded.resource_tenant_id,
          actor_role: identity.actor_role
        },
        expected: {
          analysis_id: loaded.analysis_id,
          offer_id: loaded.offer_id,
          offer_revision: loaded.offer_revision
        },
        c05_decision_output: loaded.c05_decision_output,
        evidence_records: loaded.evidence_records
      });

      const envelope = await executor.execute({
        execution_id: advisorExecutionId,
        prompt_version: promptVersion,
        context
      });

      const persistence = await source.persistExecution({
        source_execution_id: sourceExecutionId,
        advisor_execution_id: advisorExecutionId,
        envelope
      });

      return {
        source_execution_id: sourceExecutionId,
        advisor_execution_id: advisorExecutionId,
        idempotent: persistence.idempotent,
        advisor_status: context.advisor_status,
        execution: envelope
      };
    }
  };
}

module.exports = {
  createAdvisorRuntimeSource,
  createAdvisorRuntimeService
};
