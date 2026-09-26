'use strict';

const crypto = require('node:crypto');
const { interpretResolved } = require('../../interpreter-core/v1/core');
const { validateCanonicalDocument } = require('./canonical-document');
const { reconstructText } = require('./text-adapter');
const { reconstructCsv } = require('./csv-adapter');

const BRIDGE_VERSION = 'canonical-interpreter-bridge/v1';

function bridgeError(reason, message) {
  const error = new Error(message);
  error.code = 'PARSER_FAILURE';
  error.reason = reason;
  return error;
}

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function exactLegacyContent(document) {
  validateCanonicalDocument(document);

  if (document.source.type === 'txt') {
    return {
      content: reconstructText(document),
      projection_mode: 'LEGACY_EXACT_TEXT'
    };
  }

  if (document.source.type === 'csv') {
    return {
      content: reconstructCsv(document),
      projection_mode: 'LEGACY_EXACT_CSV'
    };
  }

  throw bridgeError(
    'SEMANTIC_PROJECTION_NOT_EQUIVALENCE_CERTIFIED',
    'tipo ainda sem projecao U2 equivalence-certified: ' + String(document.source.type)
  );
}

function canonicalToRawDocument(document, options = {}) {
  const projection = exactLegacyContent(document);
  const documentId = options.documentId || document.document_id;
  if (typeof documentId !== 'string' || !documentId) {
    throw bridgeError('DOCUMENT_ID_INVALID', 'document_id do bridge invalido');
  }

  return {
    contract_version: 'raw-document/v1',
    document_id: documentId,
    content: projection.content,
    content_hash: 'sha256:' + sha256(projection.content),
    source: {
      kind: 'canonical_document_bridge',
      canonical_document_id: document.document_id,
      canonical_source_type: document.source.type,
      canonical_source_hash: document.source.content_hash,
      adapter_id: document.parser.adapter,
      adapter_version: document.parser.version,
      bridge_version: BRIDGE_VERSION,
      projection_mode: projection.projection_mode
    }
  };
}

function interpretCanonical(request, options = {}) {
  if (!request || typeof request !== 'object') {
    throw bridgeError('REQUEST_INVALID', 'request obrigatorio');
  }
  const rawDocument = canonicalToRawDocument(request.document, {
    documentId: options.documentId
  });
  return interpretResolved({
    document: rawDocument,
    schema: request.schema || {},
    knowledge: request.knowledge || null
  });
}

module.exports = {
  BRIDGE_VERSION,
  exactLegacyContent,
  canonicalToRawDocument,
  interpretCanonical
};
