'use strict';

const ADAPTER_VERSION = 'openai-responses-list-advisor/v0';
const ENDPOINT = 'https://api.openai.com/v1/responses';

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    offers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          model: { type: 'string', minLength: 1 },
          capacity_gb: { type: ['integer','null'], minimum: 1 },
          color: { type: ['string','null'] },
          condition: { type: ['string','null'] },
          variant: { type: ['string','null'] },
          price_amount_minor: { type: ['integer','null'], minimum: 1 },
          currency: { type: 'string', minLength: 3, maxLength: 3 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          source_excerpt: { type: 'string', minLength: 1, maxLength: 500 }
        },
        required: ['model','capacity_gb','color','condition','variant','price_amount_minor','currency','confidence','source_excerpt']
      }
    },
    ambiguities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          field: { type: 'string', minLength: 1 },
          source_excerpt: { type: 'string', minLength: 1, maxLength: 500 },
          reason: { type: 'string', minLength: 1, maxLength: 800 }
        },
        required: ['field','source_excerpt','reason']
      }
    }
  },
  required: ['offers','ambiguities']
};

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(field + ' obrigatorio');
  return value.trim();
}

function extractOutputText(payload) {
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === 'refusal') throw Object.assign(new Error('provider refusal'), { code: 'PROVIDER_REFUSAL' });
      if (part?.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  throw Object.assign(new Error('provider output_text ausente'), { code: 'PROVIDER_INVALID_RESPONSE' });
}

function systemInstruction(promptVersion) {
  return [
    'Você é a IA Advisor responsável por interpretar listas de fornecedores do External Calc.',
    'Extraia somente o que a lista realmente suporta.',
    'O contexto do fornecedor é consultivo e ajuda com convenções recorrentes, mas nunca substitui texto explícito da lista.',
    'Nunca invente modelo, capacidade, cor, condição ou preço.',
    'Nunca corrija silenciosamente preço suspeito ou erro de digitação; preserve o valor textual interpretável e registre ambiguidade quando necessário.',
    'Quando múltiplas capacidades e múltiplos preços estiverem claramente em ordem, associe pela ordem.',
    'Se a relação entre cores, capacidades ou preços não estiver comprovada, preserve a ambiguidade em vez de fabricar combinações.',
    'Texto como Anatel, chip+eSIM ou outra variante não mapeada deve ser preservado em variant.',
    'Políticas, endereços, links, contatos e cabeçalhos não são ofertas.',
    'Uma oferta deve manter source_excerpt literal suficiente para auditoria.',
    'Prompt version: ' + promptVersion
  ].join(' ');
}

function createOpenAIListAdvisorProvider(options = {}) {
  const apiKey = assertNonEmpty(options.apiKey, 'apiKey');
  const model = assertNonEmpty(options.model, 'model');
  const promptVersion = assertNonEmpty(options.promptVersion, 'promptVersion');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl obrigatorio');

  return {
    adapter_version: ADAPTER_VERSION,
    async interpret(request) {
      const response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model,
          store: false,
          input: [
            { role: 'system', content: systemInstruction(promptVersion) },
            { role: 'user', content: JSON.stringify(request) }
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'external_calc_list_interpretation',
              strict: true,
              schema: OUTPUT_SCHEMA
            }
          },
          max_output_tokens: 5000
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const providerType = typeof payload?.error?.type === 'string' ? payload.error.type : null;
        const providerCode = typeof payload?.error?.code === 'string' ? payload.error.code : null;
        const rateLimited = response.status === 429;
        const quotaExhausted =
          rateLimited &&
          ['insufficient_quota', 'credit_balance_exhausted'].includes(providerCode || providerType);

        const code = quotaExhausted
          ? 'PROVIDER_QUOTA_EXHAUSTED'
          : rateLimited
            ? 'PROVIDER_RATE_LIMITED'
            : 'PROVIDER_HTTP';

        const message = quotaExhausted
          ? 'OpenAI sem quota/créditos disponíveis para o List Advisor.'
          : rateLimited
            ? 'OpenAI aplicou limite temporário ao List Advisor.'
            : 'provider HTTP ' + response.status;

        throw Object.assign(new Error(message), {
          code,
          provider_status: response.status,
          provider_type: providerType,
          provider_code: providerCode
        });
      }
      const text = extractOutputText(payload);
      try { return JSON.parse(text); }
      catch { throw Object.assign(new Error('provider JSON invalido'), { code: 'PROVIDER_INVALID_RESPONSE' }); }
    }
  };
}

module.exports = {
  ADAPTER_VERSION,
  OUTPUT_SCHEMA,
  createOpenAIListAdvisorProvider
};
