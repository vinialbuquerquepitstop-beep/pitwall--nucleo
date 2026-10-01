'use strict';

const API_VERSION = 'external-calc-list-advisor-api/v0';
const PATH = '/api/external-calc/v0/list-advisor';

function json(status, body) {
  return { status, headers: { 'content-type': 'application/json; charset=utf-8' }, body };
}

function parseBody(rawBody) {
  let body = rawBody;
  if (typeof rawBody === 'string') {
    try { body = JSON.parse(rawBody); } catch { throw new Error('body JSON invalido'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('body invalido');
  const allowed = new Set(['supplier_id','filename','mime_type','content']);
  for (const key of Object.keys(body)) if (!allowed.has(key)) throw new Error('campo nao permitido: ' + key);
  return body;
}

function createListAdvisorApiV0(options = {}) {
  const service = options.service || null;
  const authenticate = options.authenticate;
  if (typeof authenticate !== 'function') throw new Error('authenticate obrigatorio');

  return {
    async handle(request) {
      try {
        if (String(request?.method || '').toUpperCase() !== 'POST' || String(request?.path || '') !== PATH) {
          return json(404, { error: { code: 'NOT_FOUND', message: 'rota nao encontrada' } });
        }
        const identity = await authenticate(request);
        if (!identity?.tenant_id) return json(401, { error: { code: 'UNAUTHENTICATED', message: 'autenticacao obrigatoria' } });
        if (identity.actor_role !== 'dono') return json(403, { error: { code: 'FORBIDDEN', message: 'acesso negado' } });
        if (!service) return json(503, { error: { code: 'LIST_ADVISOR_NOT_CONFIGURED', message: 'IA de interpretação não configurada' } });
        const result = await service.interpret(parseBody(request.body));
        return json(200, { api_version: API_VERSION, interpretation: result });
      } catch (error) {
        return json(400, {
          error: {
            code: error?.code || 'LIST_ADVISOR_INVALID_REQUEST',
            message: error instanceof Error ? error.message : 'falha na interpretação'
          }
        });
      }
    }
  };
}

module.exports = { API_VERSION, PATH, parseBody, createListAdvisorApiV0 };
