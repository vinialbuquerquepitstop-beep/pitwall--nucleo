'use strict';

const {
  createExternalCalcApiV0
} = require('../../external-calc-api/v0/api-handler');
const {
  createExternalCalcApplicationService
} = require('../../external-calc-api/v0/application-service');
const {
  createPostgresLifecycleRepository
} = require('./postgres-adapter');

const API_PREFIX = '/api/external-calc/';
const OWNER_ROLE = 'dono';

function assertEnv(env) {
  const supabaseUrl = env?.SUPABASE_URL;
  const anonKey = env?.SUPABASE_ANON_KEY;

  if (typeof supabaseUrl !== 'string' || !supabaseUrl) {
    throw new Error('SUPABASE_URL ausente');
  }
  if (typeof anonKey !== 'string' || !anonKey) {
    throw new Error('SUPABASE_ANON_KEY ausente');
  }

  return { supabaseUrl, anonKey };
}

function bearerFrom(request) {
  const auth = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match ? match[1].trim() : '';
}

async function responseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function resolveIdentity(request, config, fetchImpl) {
  const accessToken = bearerFrom(request);
  if (!accessToken) return null;

  const authHeaders = {
    apikey: config.anonKey,
    authorization: `Bearer ${accessToken}`
  };

  const userResponse = await fetchImpl(
    config.supabaseUrl.replace(/\/+$/, '') + '/auth/v1/user',
    {
      method: 'GET',
      headers: authHeaders
    }
  );

  if (!userResponse.ok) return null;
  const user = await responseJson(userResponse);
  if (!user || typeof user.id !== 'string' || !user.id) return null;

  const params = new URLSearchParams({
    id: `eq.${user.id}`,
    select: 'tenant_id,papel,ativo'
  });

  const profileResponse = await fetchImpl(
    config.supabaseUrl.replace(/\/+$/, '') + `/rest/v1/app_usuario?${params.toString()}`,
    {
      method: 'GET',
      headers: authHeaders
    }
  );

  if (!profileResponse.ok) return null;
  const rows = await responseJson(profileResponse);
  if (!Array.isArray(rows) || rows.length !== 1) return null;

  const profile = rows[0];
  if (profile.ativo !== true || typeof profile.tenant_id !== 'string') return null;

  return {
    tenant_id: profile.tenant_id,
    subject: user.id,
    can_execute_external_calc: profile.papel === OWNER_ROLE,
    access_token: accessToken
  };
}

function toApiRequest(request, body) {
  const url = new URL(request.url);
  return {
    method: request.method,
    path: url.pathname,
    headers: Object.fromEntries(request.headers.entries()),
    body
  };
}

function toResponse(apiResponse) {
  return new Response(JSON.stringify(apiResponse.body), {
    status: apiResponse.status,
    headers: apiResponse.headers
  });
}

function createExternalCalcWorkerRuntime(options = {}) {
  const env = options.env || {};
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const assetsFetch = options.assetsFetch || (
    env.ASSETS && typeof env.ASSETS.fetch === 'function'
      ? request => env.ASSETS.fetch(request)
      : null
  );
  const config = assertEnv(env);

  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl obrigatorio');

  return {
    async fetch(request) {
      const url = new URL(request.url);

      if (!url.pathname.startsWith(API_PREFIX)) {
        if (assetsFetch) return assetsFetch(request);
        return new Response('Not found', { status: 404 });
      }

      const identity = await resolveIdentity(request, config, fetchImpl);
      const accessToken = identity?.access_token || bearerFrom(request) || 'unauthenticated';

      const repository = createPostgresLifecycleRepository({
        supabaseUrl: config.supabaseUrl,
        anonKey: config.anonKey,
        accessToken,
        fetchImpl
      });

      const applicationService = createExternalCalcApplicationService({
        repository
      });

      const api = createExternalCalcApiV0({
        applicationService,
        authenticate: async () => identity && ({
          tenant_id: identity.tenant_id,
          subject: identity.subject,
          can_execute_external_calc: identity.can_execute_external_calc
        })
      });

      let body = null;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        body = await request.text();
      }

      const apiResponse = await api.handle(toApiRequest(request, body));
      return toResponse(apiResponse);
    }
  };
}

module.exports = {
  API_PREFIX,
  OWNER_ROLE,
  resolveIdentity,
  createExternalCalcWorkerRuntime
};
