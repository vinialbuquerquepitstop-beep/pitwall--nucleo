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
const {
  createExternalCalcAuthorityResolver
} = require('../../external-calc-authority/v0/authority-resolver');
const {
  createAuthorityBoundApplicationService
} = require('../../external-calc-authority/v0/authority-application-service');
const {
  createPostgresAuthoritySource
} = require('../../external-calc-authority/v0/postgres-authority-source');
const {
  REVIEW_PATH,
  createC01ReviewApiV0
} = require('../../external-calc-c01-review/v0/review-api');
const {
  createC01ReviewAuthority
} = require('../../external-calc-c01-review/v0/c01-review-authority');
const {
  createPostgresReviewCandidateRepository
} = require('../../external-calc-c01-review/v0/postgres-review-candidate-repository');
const {
  createPostgresReviewResultRepository
} = require('../../external-calc-c01-review/v0/postgres-review-result-repository');
const {
  createStoreRateQuoteResolver
} = require('../../external-calc-store-rate/v1/store-rate-resolver');
const {
  createPostgresStoreRateQuoteSource
} = require('../../external-calc-store-rate/v1/postgres-store-rate-source');
const {
  QUOTE_PATH,
  createStoreRateQuoteApiV0
} = require('../../external-calc-store-rate/v1/store-rate-quote-api');

const API_PREFIX = '/api/external-calc/';
const OWNER_ROLE = 'dono';
const BETA_VALIDATOR_ROLE = 'validador';

function canOperateExternalCalc(role) {
  return role === OWNER_ROLE || role === BETA_VALIDATOR_ROLE;
}
const EXTERNAL_CALC_VERCEL_PREVIEW_ORIGIN =
  /^https:\/\/external-calc-frontend-v1-preview(?:-[a-z0-9-]+)?\.vercel\.app$/i;
const EXTERNAL_CALC_LOCAL_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

function configuredCorsOrigins(env) {
  return new Set(
    String(env?.EXTCALC_ALLOWED_ORIGINS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  );
}

function allowedCorsOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return null;

  if (configuredCorsOrigins(env).has(origin)) return origin;
  if (EXTERNAL_CALC_LOCAL_ORIGINS.has(origin)) return origin;
  if (EXTERNAL_CALC_VERCEL_PREVIEW_ORIGIN.test(origin)) return origin;

  return null;
}

function corsHeaders(origin) {
  if (!origin) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin'
  };
}

function withCors(response, origin) {
  if (!origin) return response;

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

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
    papel: profile.papel,
    can_execute_external_calc: canOperateExternalCalc(profile.papel),
    access_token: accessToken
  };
}

function authorityServerConfig(env) {
  return {
    calculationCategory: env?.EXTCALC_CALCULATION_CATEGORY,
    researchProfileJson: env?.EXTCALC_RESEARCH_PROFILE_JSON,
    indicatorProfileJson: env?.EXTCALC_INDICATOR_PROFILE_JSON,
    marketContextJson: env?.EXTCALC_MARKET_CONTEXT_JSON
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
  const clock = options.clock || (() => new Date().toISOString());

  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl obrigatorio');

  return {
    async fetch(request) {
      const url = new URL(request.url);

      if (!url.pathname.startsWith(API_PREFIX)) {
        if (assetsFetch) return assetsFetch(request);
        return new Response('Not found', { status: 404 });
      }

      const corsOrigin = allowedCorsOrigin(request, env);
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(corsOrigin)
        });
      }

      const identity = await resolveIdentity(request, config, fetchImpl);
      const accessToken = identity?.access_token || bearerFrom(request) || 'unauthenticated';

      const repository = createPostgresLifecycleRepository({
        supabaseUrl: config.supabaseUrl,
        anonKey: config.anonKey,
        accessToken,
        fetchImpl
      });

      const baseApplicationService = createExternalCalcApplicationService({
        repository
      });

      const authoritySource = createPostgresAuthoritySource({
        supabaseUrl: config.supabaseUrl,
        anonKey: config.anonKey,
        accessToken,
        fetchImpl,
        serverConfig: authorityServerConfig(env)
      });

      const authorityResolver = createExternalCalcAuthorityResolver({
        source: authoritySource,
        clock
      });

      const applicationService = createAuthorityBoundApplicationService({
        applicationService: baseApplicationService,
        authorityResolver
      });

      const authContext = async () => identity && ({
        tenant_id: identity.tenant_id,
        subject: identity.subject,
        can_execute_external_calc: identity.can_execute_external_calc
      });

      const api = createExternalCalcApiV0({
        applicationService,
        authenticate: authContext
      });

      const storeRateSource = createPostgresStoreRateQuoteSource({
        supabaseUrl: config.supabaseUrl,
        anonKey: config.anonKey,
        accessToken,
        fetchImpl,
        authoritySource
      });
      const storeRateResolver = createStoreRateQuoteResolver({ source: storeRateSource });
      const storeRateApi = createStoreRateQuoteApiV0({
        resolver: storeRateResolver,
        authenticate: authContext
      });

      const reviewCandidateRepository = createPostgresReviewCandidateRepository({
        supabaseUrl: config.supabaseUrl,
        anonKey: config.anonKey,
        accessToken,
        fetchImpl
      });

      const reviewResultRepository = createPostgresReviewResultRepository({
        supabaseUrl: config.supabaseUrl,
        anonKey: config.anonKey,
        accessToken,
        fetchImpl
      });

      const reviewAuthority = createC01ReviewAuthority({
        candidateSource: reviewCandidateRepository,
        reviewRepository: reviewResultRepository,
        clock
      });

      const reviewApi = createC01ReviewApiV0({
        reviewAuthority,
        candidateSource: reviewCandidateRepository,
        authenticate: authContext
      });

      let body = null;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        body = await request.text();
      }

      const handler =
        url.pathname === REVIEW_PATH ? reviewApi :
        url.pathname === QUOTE_PATH ? storeRateApi :
        api;
      const apiResponse = await handler.handle(toApiRequest(request, body));
      return withCors(toResponse(apiResponse), corsOrigin);
    }
  };
}

module.exports = {
  API_PREFIX,
  OWNER_ROLE,
  BETA_VALIDATOR_ROLE,
  canOperateExternalCalc,
  resolveIdentity,
  authorityServerConfig,
  createExternalCalcWorkerRuntime
};
