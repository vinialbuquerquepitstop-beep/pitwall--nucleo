import runtimeModule from '../ferramentas/external-calc-runtime/v0/runtime.js';

const { createExternalCalcWorkerRuntime } = runtimeModule;

export default {
  async fetch(request, env) {
    const runtime = createExternalCalcWorkerRuntime({ env });
    return runtime.fetch(request);
  }
};
