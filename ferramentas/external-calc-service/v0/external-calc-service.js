'use strict';

const {
  CONTRACT_VERSION: CORE_PIPELINE_CONTRACT_VERSION,
  ENGINE_VERSION: CORE_PIPELINE_ENGINE_VERSION,
  runExternalCalcCorePipeline
} = require('../../external-calc-pipeline/v1/core-pipeline');

const SERVICE_VERSION = 'external-calc-service/v0';
const SERVICE_ENGINE_VERSION = 'external-calc-service/0.1.0';

function executeExternalCalcService(request) {
  const core = runExternalCalcCorePipeline(request);

  return {
    service_version: SERVICE_VERSION,
    service_engine_version: SERVICE_ENGINE_VERSION,
    analysis_id: core.analysis_id,
    source_id: core.source_id,
    offer_id: core.offer_id,
    offer_revision: core.offer_revision,
    execution_status: core.execution_status,
    freshness_status: core.freshness_status,
    outputs: core.outputs,
    core_pipeline: {
      contract_version: CORE_PIPELINE_CONTRACT_VERSION,
      engine_version: CORE_PIPELINE_ENGINE_VERSION,
      input_fingerprint: core.input_fingerprint,
      output_fingerprint: core.output_fingerprint,
      provenance_refs: [...core.provenance_refs]
    }
  };
}

module.exports = {
  SERVICE_VERSION,
  SERVICE_ENGINE_VERSION,
  executeExternalCalcService
};
