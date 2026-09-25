'use strict';

const crypto = require('crypto');
const { AUTHORIZED_ROLES } = require('./advisor-context');

const API_VERSION = 'external-calc-ai-advisor-api/v0';
const ADVISOR_PATH = '/api/external-calc/v0/advisor';

function json(status, body) {
  return {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    body
  };
}

function parseBody(rawBody) {
  if (rawBody == null) throw new Error('body obrigatorio');

  let body = rawBody;
  if (typeof rawBody === 'string') {
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new Error('body JSON invalido');
    }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('body deve ser objeto');
  }

  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'source_execution_id') {
    throw new Error('body aceita somente source_execution_id');
  }

  if (typeof body.source_execution_id !== 'string' || !body.source_execution_id.trim()) {
    throw new Error('source_execution_id obrigatorio');
  }

  return {
    source_execution_id: body.source_execution_id.trim()
  };
}

function createAdvisorApiV0(options = {}) {
  const service = options.service || null;
  const authenticate = options.authenticate;
  const promptVersion = options.promptVersion || null;
  const idFactory = options.idFactory || (() => crypto.randomUUID());

  if (typeof authenticate !== 'function') {
    throw new Error('authenticate obrigatorio');
  }
  if (typeof idFactory !== 'function') {
    throw new Error('idFactory obrigatorio');
  }

  return {
    version: API_VERSION,

    async handle(request) {
      try {
        const method = String(request?.method || '').toUpperCase();
        const path = String(request?.path || '');

        if (method !== 'POST' || path !== ADVISOR_PATH) {
          return json(404, {
            error: {
              code: 'NOT_FOUND',
              message: 'rota nao encontrada'
            }
          });
        }

        const identity = await authenticate(request);

        if (!identity || typeof identity.tenant_id !== 'string' || !identity.tenant_id) {
          return json(401, {
            error: {
              code: 'UNAUTHENTICATED',
              message: 'autenticacao obrigatoria'
            }
          });
        }

        if (!AUTHORIZED_ROLES.has(identity.actor_role)) {
          return json(403, {
            error: {
              code: 'FORBIDDEN',
              message: 'acesso negado'
            }
          });
        }

        if (!service || !promptVersion) {
          return json(503, {
            error: {
              code: 'ADVISOR_NOT_CONFIGURED',
              message: 'AI Advisor ainda nao esta configurado neste ambiente'
            }
          });
        }

        const body = parseBody(request.body);
        const advisorExecutionId = idFactory();

        const result = await service.execute({
          identity: {
            tenant_id: identity.tenant_id,
            actor_role: identity.actor_role
          },
          source_execution_id: body.source_execution_id,
          advisor_execution_id: advisorExecutionId,
          prompt_version: promptVersion
        });

        return json(200, {
          api_version: API_VERSION,
          source_execution_id: result.source_execution_id,
          advisor_execution_id: result.advisor_execution_id,
          advisor_status: result.advisor_status,
          execution_status: result.execution.execution_status,
          insights: result.execution.candidate_output?.insights || [],
          provider: {
            name: result.execution.provider_name,
            model: result.execution.model_name,
            model_version: result.execution.model_version
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'request invalido';

        if (
          error?.code === 'FORBIDDEN' ||
          /EXTCALC_ADVISOR_FORBIDDEN/.test(message)
        ) {
          return json(403, {
            error: {
              code: 'FORBIDDEN',
              message: 'acesso negado'
            }
          });
        }

        if (/ADVISOR_SOURCE_TENANT_MISMATCH/.test(message)) {
          return json(403, {
            error: {
              code: 'FORBIDDEN',
              message: 'acesso negado'
            }
          });
        }

        if (
          /Advisor source nao encontrada/.test(message) ||
          /EXTCALC_ADVISOR_SOURCE_NOT_FOUND/.test(message)
        ) {
          return json(404, {
            error: {
              code: 'ADVISOR_SOURCE_NOT_FOUND',
              message: 'execucao de origem nao encontrada'
            }
          });
        }

        return json(400, {
          error: {
            code: 'INVALID_REQUEST',
            message
          }
        });
      }
    }
  };
}

module.exports = {
  API_VERSION,
  ADVISOR_PATH,
  parseBody,
  createAdvisorApiV0
};
