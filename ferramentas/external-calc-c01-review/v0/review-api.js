'use strict';

const REVIEW_API_VERSION = 'external-calc-c01-review-api/v0';
const REVIEW_PATH = '/api/external-calc/v0/review';

function json(status, body) {
  return {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body
  };
}

function normalizeBody(rawBody) {
  if (rawBody == null) throw new Error('body obrigatorio');
  if (typeof rawBody === 'string') {
    let parsed;
    try { parsed = JSON.parse(rawBody); }
    catch { throw new Error('body JSON invalido'); }
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

function assertReviewAuth(context) {
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
  if (typeof context.subject !== 'string' || !context.subject.trim()) {
    const error = new Error('ator autenticado ausente');
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
    actor_ref: context.subject.trim()
  };
}

function createC01ReviewApiV0(options = {}) {
  const authenticate = options.authenticate;
  const reviewAuthority = options.reviewAuthority;

  if (typeof authenticate !== 'function') throw new Error('authenticate obrigatorio');
  if (!reviewAuthority || typeof reviewAuthority.review !== 'function') {
    throw new Error('reviewAuthority.review obrigatorio');
  }

  return {
    version: REVIEW_API_VERSION,

    async handle(request) {
      try {
        const method = String(request?.method || '').toUpperCase();
        const path = String(request?.path || '');

        if (method !== 'POST' || path !== REVIEW_PATH) {
          return json(404, {
            error: { code: 'NOT_FOUND', message: 'rota nao encontrada' }
          });
        }

        const auth = assertReviewAuth(await authenticate(request));
        const command = normalizeBody(request.body);

        const result = await reviewAuthority.review({
          tenant_id: auth.tenant_id,
          actor_ref: auth.actor_ref,
          command
        });

        return json(200, {
          api_version: REVIEW_API_VERSION,
          authority_version: result.authority_version,
          analysis_id: result.c01.analysis_id,
          offer_id: result.c01.offer_id,
          offer_revision: result.c01.offer_revision,
          domain_outcome: result.c01.domain_outcome,
          freshness_status: result.c01.freshness_status,
          persisted: result.persisted,
          c01: result.c01
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
        if (
          error?.code === 'CLIENT_REVIEW_AUTHORITY_FIELD' ||
          error?.code === 'CLIENT_REVIEW_COMMAND_FIELD'
        ) {
          return json(400, {
            error: { code: error.code, message: error.message }
          });
        }

        return json(400, {
          error: {
            code: 'INVALID_REVIEW_REQUEST',
            message: error instanceof Error ? error.message : 'review request invalido'
          }
        });
      }
    }
  };
}

module.exports = {
  REVIEW_API_VERSION,
  REVIEW_PATH,
  normalizeBody,
  assertReviewAuth,
  createC01ReviewApiV0
};
