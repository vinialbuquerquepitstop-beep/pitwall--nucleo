'use strict';

const crypto = require('crypto');
const { calculateC02 } = require('../../external-calc-c02/v1/c02-calculator');
const { runC03Research } = require('../../external-calc-c03/v1/c03-research-core');
const { runC04PriceIndicator } = require('../../external-calc-c04/v1/c04-price-indicator');
const { composeDecisionOutput } = require('../../external-calc-c05/v1/c05-decision-output');

const CONTRACT_VERSION = 'external-calc-core-pipeline/v1';
const ENGINE_VERSION = 'external-calc-core-pipeline/1.0.0';

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} obrigatorio`);
  return value.trim();
}

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizeRunIds(runIds) {
  if (!runIds || typeof runIds !== 'object') throw new Error('run_ids obrigatorio');
  return {
    calculation_run_id: assertNonEmpty(runIds.calculation_run_id, 'run_ids.calculation_run_id'),
    research_run_id: assertNonEmpty(runIds.research_run_id, 'run_ids.research_run_id'),
    price_signal_run_id: assertNonEmpty(runIds.price_signal_run_id, 'run_ids.price_signal_run_id'),
    decision_output_id: assertNonEmpty(runIds.decision_output_id, 'run_ids.decision_output_id')
  };
}

function runExternalCalcCorePipeline(request) {
  if (!request || typeof request !== 'object') throw new Error('request obrigatorio');

  const runIds = normalizeRunIds(request.run_ids);
  const c01 = request.c01_candidate;
  if (!c01 || typeof c01 !== 'object') throw new Error('c01_candidate obrigatorio');

  const c02 = calculateC02({
    calculation_run_id: runIds.calculation_run_id,
    c01_candidate: c01,
    calculation_profile: request.calculation_profile
  });

  const c03 = runC03Research({
    research_run_id: runIds.research_run_id,
    c01_candidate: c01,
    research_profile: request.research_profile,
    as_of: request.as_of,
    market_context: request.market_context || null,
    evidence: Array.isArray(request.evidence) ? request.evidence : []
  });

  const c04 = runC04PriceIndicator({
    price_signal_run_id: runIds.price_signal_run_id,
    c01_candidate: c01,
    c03_research: c03,
    indicator_profile: request.indicator_profile
  });

  const c05 = composeDecisionOutput({
    decision_output_id: runIds.decision_output_id,
    c01_candidate: c01,
    c02_calculation: c02,
    c03_research: c03,
    c04_price_signal: c04
  });

  const inputFingerprint = stableHash(JSON.stringify({
    c01_offer_id: c01.offer_id,
    c01_offer_revision: c01.offer_revision,
    c01_offer_value_fingerprint: c01.offer_value_fingerprint,
    calculation_profile: request.calculation_profile,
    research_profile: request.research_profile,
    indicator_profile: request.indicator_profile,
    as_of: request.as_of,
    market_context: request.market_context || null,
    evidence: Array.isArray(request.evidence) ? request.evidence : []
  }));

  const outputCore = {
    c02_output_fingerprint: c02.output_fingerprint,
    c03_output_fingerprint: c03.output_fingerprint,
    c04_output_fingerprint: c04.output_fingerprint,
    c05_output_fingerprint: c05.output_fingerprint,
    decision_outcome: c05.decision_outcome
  };

  return {
    contract_version: CONTRACT_VERSION,
    engine_version: ENGINE_VERSION,
    analysis_id: c01.analysis_id,
    source_id: c01.source_id,
    offer_id: c01.offer_id,
    offer_revision: c01.offer_revision,
    stage: 'CORE_PIPELINE',
    execution_status: 'SUCCEEDED',
    freshness_status: 'CURRENT',
    input_fingerprint: inputFingerprint,
    output_fingerprint: stableHash(JSON.stringify(outputCore)),
    outputs: {
      c02,
      c03,
      c04,
      c05
    },
    provenance_refs: [
      `offer_revision:${c01.offer_id}:${c01.offer_revision}`,
      `calculation_run:${c02.calculation_run_id}`,
      `research_run:${c03.research_run_id}`,
      `price_signal_run:${c04.price_signal_run_id}`,
      `decision_output:${c05.decision_output_id}`
    ]
  };
}

module.exports = {
  CONTRACT_VERSION,
  ENGINE_VERSION,
  runExternalCalcCorePipeline
};
