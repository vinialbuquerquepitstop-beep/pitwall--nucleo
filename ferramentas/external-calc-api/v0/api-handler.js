'use strict';

const API_VERSION = 'external-calc-api/v0';
const EXECUTE_PATH = '/api/external-calc/v0/execute';

const RESERVED_CLIENT_KEYS = new Set([
  'tenant_id',
  'execution_id',
  'review_id',
  'persisted_at',
  'run_ids',
  'service_result',
  'auth_context'
]);

function json(status, body) {
  return {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    body
  };
}

function normalizeBody(rawBody) {
  if (rawBody == null) throw new Error('body obrigatorio');
  if (typeof rawBody === 'string') {
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new Error('body JSON invalido');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('body deve ser objeto JSON');
    }
    return parsed;
  }
  if (typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    throw new Error('body deve ser objeto JSON');
  }
  return JSON.parse(JSON.stringify(rawBody));
}

function findReservedClientKey(value, path = '$') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findReservedClientKey(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }

  if (!value || typeof value !== 'object') return null;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (RESERVED_CLIENT_KEYS.has(key)) return childPath;
    const found = findReservedClientKey(child, childPath);
    if (found) return found;
  }

  return null;
}

function assertAuthenticatedContext(context) {
  if (!context || typeof context !== 'object') {
    const error = new Error('nao autenticado');
    error.code = 'UNAUTHENTICATED';
    throw error;
  }

  if (typeof context.tenant_id !== 'string' || !context.tenant_id.trim()) {
    const error = new Error('tenant autenticado ausente');
    error.code = 'UNAUTHENTICATED';
    throw error;
  }

  if (context.can_execute_external_calc !== true) {
    const error = new Error('sem permissao para External Calc');
    error.code = 'FORBIDDEN';
    throw error;
  }

  return {
    tenant_id: context.tenant_id.trim(),
    subject: context.subject == null ? null : String(context.subject)
  };
}

function createExternalCalcApiV0(options = {}) {
  const authenticate = options.authenticate;
  const applicationService = options.applicationService;

  if (typeof authenticate !== 'function') {
    throw new Error('authenticate obrigatorio');
  }
  if (!applicationService || typeof applicationService.executeAnalysis !== 'function') {
    throw new Error('applicationService.executeAnalysis obrigatorio');
  }

  return {
    version: API_VERSION,

    async handle(request) {
      try {
        const method = String(request?.method || '').toUpperCase();
        const path = String(request?.path || '');

        if (method !== 'POST' || path !== EXECUTE_PATH) {
          return json(404, {
            error: {
              code: 'NOT_FOUND',
              message: 'rota nao encontrada'
            }
          });
        }

        const authContext = assertAuthenticatedContext(await authenticate(request));
        const body = normalizeBody(request.body);
        const reservedPath = findReservedClientKey(body);

        if (reservedPath) {
          return json(400, {
            error: {
              code: 'CLIENT_AUTHORITY_FIELD',
              message: `campo reservado ao servidor: ${reservedPath}`
            }
          });
        }

        const result = applicationService.executeAnalysis({
          tenant_id: authContext.tenant_id,
          request: body
        });

        return json(200, {
          api_version: API_VERSION,
          execution_id: result.execution_id,
          analysis_id: result.analysis_id,
          offer_id: result.offer_id,
          offer_revision: result.offer_revision,
          execution_status: result.execution_status,
          freshness_status: result.freshness_status,
          decision_outcome: result.decision_outcome,
          result: result.service_result
        });
      } catch (error) {
        if (error?.code === 'UNAUTHENTICATED') {
          return json(401, {
            error: { code: 'UNAUTHENTICATED', message: 'autenticacao obrigatoria' }
          });
        }
        if (error?.code === 'FORBIDDEN') {
          return json(403, {
            error: { code: 'FORBIDDEN', message: 'acesso negado' }
          });
        }

        return json(400, {
          error: {
            code: 'INVALID_REQUEST',
            message: error instanceof Error ? error.message : 'request invalido'
          }
        });
      }
    }
  };
}

module.exports = {
  API_VERSION,
  EXECUTE_PATH,
  RESERVED_CLIENT_KEYS,
  findReservedClientKey,
  createExternalCalcApiV0
};
