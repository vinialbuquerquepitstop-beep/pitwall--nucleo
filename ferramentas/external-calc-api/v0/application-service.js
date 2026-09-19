'use strict';

const crypto = require('crypto');
const { executeExternalCalcService } = require('../../external-calc-service/v0/external-calc-service');

const APPLICATION_SERVICE_VERSION = 'external-calc-application-service/v0';

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} obrigatorio`);
  }
  return value.trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultIdFactory(prefix) {
  if (prefix === 'execution') return crypto.randomUUID();
  return `${prefix}_${crypto.randomUUID()}`;
}

function createExternalCalcApplicationService(options = {}) {
  const repository = options.repository;
  if (!repository || typeof repository.persistExecution !== 'function') {
    throw new Error('repository.persistExecution obrigatorio');
  }

  const executeService = options.executeService || executeExternalCalcService;
  const idFactory = options.idFactory || defaultIdFactory;
  const clock = options.clock || (() => new Date().toISOString());

  return {
    version: APPLICATION_SERVICE_VERSION,

    async executeAnalysis(command) {
      if (!command || typeof command !== 'object') throw new Error('command obrigatorio');

      const tenantId = assertNonEmpty(command.tenant_id, 'tenant_id');
      const clientRequest = clone(command.request || {});

      if (clientRequest.run_ids) {
        throw new Error('run_ids sao gerados pelo servidor');
      }

      const executionId = assertNonEmpty(
        idFactory('execution'),
        'execution_id gerado'
      );

      const runIds = {
        calculation_run_id: assertNonEmpty(idFactory('calculation'), 'calculation_run_id gerado'),
        research_run_id: assertNonEmpty(idFactory('research'), 'research_run_id gerado'),
        price_signal_run_id: assertNonEmpty(idFactory('price_signal'), 'price_signal_run_id gerado'),
        decision_output_id: assertNonEmpty(idFactory('decision'), 'decision_output_id gerado')
      };

      const persistedAt = assertNonEmpty(clock(), 'persisted_at');

      const serviceRequest = {
        ...clientRequest,
        run_ids: runIds
      };

      const serviceResult = executeService(serviceRequest);

      await repository.persistExecution({
        tenant_id: tenantId,
        execution_id: executionId,
        persisted_at: persistedAt,
        request: serviceRequest,
        service_result: serviceResult
      });

      return {
        application_service_version: APPLICATION_SERVICE_VERSION,
        execution_id: executionId,
        analysis_id: serviceResult.analysis_id,
        source_id: serviceResult.source_id,
        offer_id: serviceResult.offer_id,
        offer_revision: serviceResult.offer_revision,
        execution_status: serviceResult.execution_status,
        freshness_status: serviceResult.freshness_status,
        decision_outcome: serviceResult.outputs?.c05?.decision_outcome ?? null,
        service_result: serviceResult
      };
    },

    async loadExecution(query) {
      if (!repository || typeof repository.loadExecution !== 'function') {
        throw new Error('repository.loadExecution obrigatorio');
      }

      const tenantId = assertNonEmpty(query?.tenant_id, 'tenant_id');
      const executionId = assertNonEmpty(query?.execution_id, 'execution_id');
      const replay = await repository.loadExecution({
        tenant_id: tenantId,
        execution_id: executionId
      });

      if (!replay) return null;

      return {
        application_service_version: APPLICATION_SERVICE_VERSION,
        execution_id: replay.execution_id,
        analysis_id: replay.lineage.analysis_id,
        offer_id: replay.lineage.offer_id,
        offer_revision: replay.lineage.offer_revision,
        request: clone(replay.request),
        service_result: clone(replay.service_result)
      };
    }
  };
}

module.exports = {
  APPLICATION_SERVICE_VERSION,
  createExternalCalcApplicationService
};
