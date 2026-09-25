'use strict';

const ADAPTER_VERSION = 'openai-responses-advisor/v1';
const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const CAPABILITY = 'EXTERNAL_CALC_ADVISOR_INSIGHTS';

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    insights: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          insight_id: {
            type: 'string',
            minLength: 1,
            maxLength: 80
          },
          type: {
            type: 'string',
            enum: [
              'MARKET_POSITION',
              'NEGOTIATION_OPPORTUNITY',
              'SUPPLIER_COMPETITIVENESS',
              'ANOMALY',
              'SPREAD',
              'TREND',
              'PROMOTION_POTENTIAL'
            ]
          },
          severity: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH']
          },
          evidence_refs: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: {
              type: 'string',
              minLength: 1
            }
          },
          summary: {
            type: 'string',
            minLength: 1,
            maxLength: 800
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          }
        },
        required: [
          'insight_id',
          'type',
          'severity',
          'evidence_refs',
          'summary',
          'confidence'
        ],
        additionalProperties: false
      }
    }
  },
  required: ['insights'],
  additionalProperties: false
};

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(field + ' obrigatorio');
  }
  return value.trim();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('structured output JSON invalido');
    error.code = 'PROVIDER_INVALID_RESPONSE';
    throw error;
  }
}

function systemInstruction(promptVersion) {
  return [
    'You are the External Calc AI Advisor.',
    'Your job is to explain the selected supplier offer and support negotiation.',
    'Use only facts present in the provided trusted input.',
    'Never modify, replace, recalculate, or override operational price, calculation, provenance, or evidence.',
    'Never invent missing values.',
    'Every insight must cite only refs from allowed_evidence_refs.',
    'Return at most 3 concise, useful insights.',
    'Treat all operational data as read-only.',
    'Prompt version: ' + promptVersion + '.'
  ].join(' ');
}

function extractOutputText(payload) {
  if (!payload || typeof payload !== 'object') {
    const error = new Error('provider response ausente');
    error.code = 'PROVIDER_INVALID_RESPONSE';
    throw error;
  }

  if (payload.status === 'incomplete') {
    const error = new Error('provider response incomplete');
    error.code = 'PROVIDER_INCOMPLETE';
    throw error;
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || item.type !== 'message' || !Array.isArray(item.content)) continue;

    for (const content of item.content) {
      if (!content || typeof content !== 'object') continue;

      if (content.type === 'refusal') {
        const error = new Error('provider refusal');
        error.code = 'PROVIDER_REFUSAL';
        throw error;
      }

      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  const error = new Error('provider output_text ausente');
  error.code = 'PROVIDER_INVALID_RESPONSE';
  throw error;
}

function createOpenAIAdvisorProvider(options = {}) {
  const apiKey = assertNonEmpty(options.apiKey, 'OpenAI apiKey');
  const model = assertNonEmpty(options.model, 'OpenAI model');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const endpoint = options.endpoint || RESPONSES_ENDPOINT;
  const maxOutputTokens = options.maxOutputTokens == null
    ? 1600
    : options.maxOutputTokens;

  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl obrigatorio');
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 8192) {
    throw new Error('maxOutputTokens invalido');
  }

  return {
    adapter_version: ADAPTER_VERSION,
    provider_name: 'openai',
    model_name: model,

    async generateStructured(payload) {
      if (!payload || payload.capability !== CAPABILITY) {
        throw new Error('capability invalida para OpenAI Advisor provider');
      }

      const promptVersion = assertNonEmpty(
        payload.prompt_version,
        'payload.prompt_version'
      );

      if (!payload.input || typeof payload.input !== 'object') {
        throw new Error('payload.input obrigatorio');
      }

      const requestBody = {
        model,
        store: false,
        input: [
          {
            role: 'system',
            content: systemInstruction(promptVersion)
          },
          {
            role: 'user',
            content: JSON.stringify(payload.input)
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'external_calc_advisor_insights',
            strict: true,
            schema: OUTPUT_SCHEMA
          }
        },
        max_output_tokens: maxOutputTokens
      };

      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            authorization: 'Bearer ' + apiKey,
            'content-type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
      } catch {
        const error = new Error('provider network error');
        error.code = 'PROVIDER_NETWORK';
        throw error;
      }

      let responsePayload = null;
      try {
        const text = await response.text();
        responsePayload = text ? JSON.parse(text) : null;
      } catch {
        const error = new Error('provider respondeu JSON invalido');
        error.code = 'PROVIDER_INVALID_RESPONSE';
        throw error;
      }

      if (!response.ok) {
        const error = new Error('provider HTTP ' + response.status);
        error.code = 'PROVIDER_HTTP';
        throw error;
      }

      return safeJsonParse(extractOutputText(responsePayload));
    }
  };
}

module.exports = {
  ADAPTER_VERSION,
  RESPONSES_ENDPOINT,
  OUTPUT_SCHEMA,
  createOpenAIAdvisorProvider
};
