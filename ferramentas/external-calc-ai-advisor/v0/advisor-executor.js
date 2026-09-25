'use strict';

const crypto = require('crypto');
const {
  CONTRACT_VERSION: ADVISOR_CONTEXT_CONTRACT_VERSION,
  VALIDATOR_VERSION,
  validateAdvisorCandidate
} = require('./advisor-context');

const EXECUTION_CONTRACT_VERSION = 'external-calc-ai-advisor-execution/v0';
const EXECUTOR_VERSION = 'external-calc-ai-advisor-executor/0.1.0';
const CAPABILITY = 'EXTERNAL_CALC_ADVISOR_INSIGHTS';

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(field + ' obrigatorio');
  }
  return value.trim();
}

function normalizeProviderConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('provider_config obrigatorio');
  }

  const timeoutMs = config.timeout_ms == null ? 30000 : config.timeout_ms;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) {
    throw new Error('provider_config.timeout_ms invalido');
  }

  return {
    provider_name: assertNonEmpty(config.provider_name, 'provider_config.provider_name'),
    model_name: assertNonEmpty(config.model_name, 'provider_config.model_name'),
    model_version: assertNonEmpty(config.model_version, 'provider_config.model_version'),
    adapter_version: assertNonEmpty(config.adapter_version, 'provider_config.adapter_version'),
    timeout_ms: timeoutMs
  };
}

function assertReadyContext(context) {
  if (!context || context.contract_version !== ADVISOR_CONTEXT_CONTRACT_VERSION) {
    throw new Error('Advisor context invalido');
  }

  if (context.advisor_status === 'BLOCKED_INSUFFICIENT_DATA') {
    if (context.model_input !== null) {
      throw new Error('Advisor bloqueado nao pode carregar model_input');
    }
    return { blocked: true };
  }

  if (context.advisor_status !== 'READY_FOR_MODEL' || !context.model_input) {
    throw new Error('Advisor context nao elegivel para execucao');
  }

  assertNonEmpty(context.analysis_id, 'context.analysis_id');
  assertNonEmpty(context.offer_id, 'context.offer_id');
  if (!Number.isInteger(context.offer_revision) || context.offer_revision < 1) {
    throw new Error('context.offer_revision invalida');
  }
  assertNonEmpty(context.decision_output_id, 'context.decision_output_id');
  assertNonEmpty(context.decision_output_fingerprint, 'context.decision_output_fingerprint');

  const expectedFingerprint = stableHash(JSON.stringify(context.model_input));
  if (context.context_fingerprint !== expectedFingerprint) {
    throw new Error('ADVISOR_CONTEXT_TAMPERED: fingerprint invalido');
  }

  const guardrails = context.model_input.guardrails;
  if (
    !guardrails ||
    guardrails.max_insights !== 3 ||
    guardrails.insights_are_advisory !== true ||
    guardrails.operational_data_is_read_only !== true ||
    guardrails.may_override_price !== false ||
    guardrails.may_override_provenance !== false ||
    guardrails.may_invent_missing_values !== false
  ) {
    throw new Error('ADVISOR_CONTEXT_TAMPERED: guardrails invalidos');
  }

  return { blocked: false };
}

function isoNow(clock) {
  const value = clock();
  const parsed = Date.parse(value);
  if (typeof value !== 'string' || Number.isNaN(parsed)) {
    throw new Error('clock deve retornar ISO date-time');
  }
  return value;
}

function safeProviderRequest(context, promptVersion) {
  return {
    capability: CAPABILITY,
    prompt_version: promptVersion,
    input: clone(context.model_input)
  };
}

function callWithTimeout(provider, payload, timeoutMs) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('provider timeout');
      error.code = 'PROVIDER_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([
    Promise.resolve().then(() => provider.generateStructured(clone(payload))),
    timeout
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function baseEnvelope({
  executionId,
  config,
  promptVersion,
  context,
  requestedAt,
  inputHash,
  sourceRefs
}) {
  return {
    execution_contract_version: EXECUTION_CONTRACT_VERSION,
    executor_version: EXECUTOR_VERSION,
    execution_id: executionId,
    capability: CAPABILITY,
    provider_name: config.provider_name,
    model_name: config.model_name,
    model_version: config.model_version,
    adapter_version: config.adapter_version,
    prompt_version: promptVersion,
    analysis_id: context.analysis_id,
    offer_id: context.offer_id,
    offer_revision: context.offer_revision,
    decision_output_id: context.decision_output_id,
    context_fingerprint: context.context_fingerprint,
    input_hash: inputHash,
    source_refs: sourceRefs,
    requested_at: requestedAt
  };
}

function createAdvisorExecutor(options = {}) {
  const provider = options.provider;
  const config = normalizeProviderConfig(options.providerConfig);
  const clock = options.clock || (() => new Date().toISOString());

  if (!provider || typeof provider.generateStructured !== 'function') {
    throw new Error('provider.generateStructured obrigatorio');
  }

  return {
    version: EXECUTOR_VERSION,

    async execute(request) {
      if (!request || typeof request !== 'object') {
        throw new Error('request obrigatorio');
      }

      const executionId = assertNonEmpty(request.execution_id, 'execution_id');
      const promptVersion = assertNonEmpty(request.prompt_version, 'prompt_version');
      const context = request.context;
      const contextState = assertReadyContext(context);
      const requestedAt = isoNow(clock);

      if (contextState.blocked) {
        return {
          ...baseEnvelope({
            executionId,
            config,
            promptVersion,
            context,
            requestedAt,
            inputHash: null,
            sourceRefs: []
          }),
          execution_status: 'BLOCKED',
          validator_version: VALIDATOR_VERSION,
          validator_status: 'NOT_RUN',
          completed_at: isoNow(clock),
          candidate_output: null,
          candidate_output_hash: null,
          error: {
            code: 'INSUFFICIENT_DATA'
          }
        };
      }

      const providerRequest = safeProviderRequest(context, promptVersion);
      const inputHash = stableHash(JSON.stringify(providerRequest));
      const sourceRefs = Array.isArray(context.model_input.allowed_evidence_refs)
        ? [...context.model_input.allowed_evidence_refs]
        : [];
      const envelope = baseEnvelope({
        executionId,
        config,
        promptVersion,
        context,
        requestedAt,
        inputHash,
        sourceRefs
      });

      try {
        const rawCandidate = await callWithTimeout(
          provider,
          providerRequest,
          config.timeout_ms
        );
        const candidateHash = stableHash(JSON.stringify(rawCandidate));

        try {
          const validated = validateAdvisorCandidate({
            context,
            candidate_output: rawCandidate
          });

          return {
            ...envelope,
            execution_status: 'SUCCEEDED',
            validator_version: validated.validator_version,
            validator_status: validated.validator_status,
            completed_at: isoNow(clock),
            candidate_output: clone(validated.candidate_output),
            candidate_output_hash: candidateHash,
            error: null
          };
        } catch {
          return {
            ...envelope,
            execution_status: 'REJECTED',
            validator_version: VALIDATOR_VERSION,
            validator_status: 'REJECTED',
            completed_at: isoNow(clock),
            candidate_output: null,
            candidate_output_hash: candidateHash,
            error: {
              code: 'CANDIDATE_VALIDATION_FAILED'
            }
          };
        }
      } catch (error) {
        return {
          ...envelope,
          execution_status: 'FAILED',
          validator_version: VALIDATOR_VERSION,
          validator_status: 'NOT_RUN',
          completed_at: isoNow(clock),
          candidate_output: null,
          candidate_output_hash: null,
          error: {
            code: error && error.code === 'PROVIDER_TIMEOUT'
              ? 'PROVIDER_TIMEOUT'
              : 'PROVIDER_ERROR'
          }
        };
      }
    }
  };
}

module.exports = {
  EXECUTION_CONTRACT_VERSION,
  EXECUTOR_VERSION,
  CAPABILITY,
  stableHash,
  createAdvisorExecutor
};
