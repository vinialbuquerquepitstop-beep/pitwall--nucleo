'use strict';

const AUTHORITY_APPLICATION_SERVICE_VERSION =
  'external-calc-authority-application-service/v0';

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} obrigatorio`);
  }
  return value.trim();
}

function createAuthorityBoundApplicationService(options = {}) {
  const applicationService = options.applicationService;
  const authorityResolver = options.authorityResolver;

  if (!applicationService || typeof applicationService.executeAnalysis !== 'function') {
    throw new Error('applicationService.executeAnalysis obrigatorio');
  }
  if (!applicationService || typeof applicationService.loadExecution !== 'function') {
    throw new Error('applicationService.loadExecution obrigatorio');
  }
  if (!authorityResolver || typeof authorityResolver.resolveExecutionInput !== 'function') {
    throw new Error('authorityResolver.resolveExecutionInput obrigatorio');
  }

  return {
    version: AUTHORITY_APPLICATION_SERVICE_VERSION,

    async executeAnalysis(command) {
      const tenantId = assertNonEmpty(command?.tenant_id, 'tenant_id');
      const request = await authorityResolver.resolveExecutionInput({
        tenant_id: tenantId,
        command: command?.request
      });

      return applicationService.executeAnalysis({
        tenant_id: tenantId,
        request
      });
    },

    async loadExecution(query) {
      return applicationService.loadExecution(query);
    }
  };
}

module.exports = {
  AUTHORITY_APPLICATION_SERVICE_VERSION,
  createAuthorityBoundApplicationService
};
