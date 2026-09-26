'use strict';

const ROUTER_VERSION = 'format-router/v1';

const EXTENSION_TYPES = new Map([
  ['.txt', 'txt'],
  ['.csv', 'csv'],
  ['.xlsx', 'xlsx'],
  ['.json', 'json'],
  ['.pdf', 'pdf'],
  ['.docx', 'docx'],
  ['.html', 'html'],
  ['.htm', 'html']
]);

const MIME_TYPES = new Map([
  ['text/plain', 'txt'],
  ['text/csv', 'csv'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['application/json', 'json'],
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['text/html', 'html']
]);

const ADAPTERS = new Map([
  ['txt', 'text-native-v1']
]);

function routeError(reason, message, details = {}) {
  const error = new Error(message);
  error.code = 'UNSUPPORTED_FORMAT';
  error.reason = reason;
  error.details = details;
  return error;
}

function extensionFromFilename(filename) {
  if (typeof filename !== 'string') return null;
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot >= 0 ? lower.slice(dot) : null;
}

function routeSource(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw routeError('SOURCE_INVALID', 'source obrigatorio');
  }

  const extension = extensionFromFilename(source.filename);
  const extensionType = extension ? EXTENSION_TYPES.get(extension) || null : null;
  const mime = typeof source.mime_type === 'string'
    ? source.mime_type.toLowerCase().split(';')[0].trim()
    : null;
  const mimeType = mime ? MIME_TYPES.get(mime) || null : null;

  if (extensionType && mimeType && extensionType !== mimeType) {
    throw routeError('TYPE_CONFLICT', 'tipo de arquivo conflitante', {
      extension_type: extensionType,
      mime_type: mimeType
    });
  }

  const detectedType = extensionType || mimeType;
  if (!detectedType) {
    throw routeError('UNSUPPORTED_FORMAT', 'tipo de arquivo nao suportado', {
      extension,
      mime_type: mime
    });
  }

  const adapterId = ADAPTERS.get(detectedType);
  if (!adapterId) {
    throw routeError('ADAPTER_NOT_IMPLEMENTED', 'adapter ainda nao implementado', {
      detected_type: detectedType
    });
  }

  return {
    router_version: ROUTER_VERSION,
    adapter_id: adapterId,
    detected_type: detectedType,
    confidence: 1.0
  };
}

module.exports = {
  ROUTER_VERSION,
  routeSource
};
