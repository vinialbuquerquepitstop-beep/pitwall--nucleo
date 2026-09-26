'use strict';

const SCHEMA_VERSION = '1.0';
const BLOCK_TYPES = new Set([
  'text',
  'row',
  'table',
  'heading',
  'list_item',
  'image_region',
  'unknown'
]);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('SOURCE_CORRUPTED', field + ' obrigatorio');
  }
}

function assertNullablePositiveInteger(value, field) {
  if (value == null) return;
  if (!Number.isInteger(value) || value < 1) {
    fail('SOURCE_CORRUPTED', field + ' invalido');
  }
}

function validateCanonicalDocument(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    fail('SOURCE_CORRUPTED', 'CanonicalDocument deve ser objeto');
  }
  if (document.schema_version !== SCHEMA_VERSION) {
    fail('SOURCE_CORRUPTED', 'schema_version invalido');
  }

  assertNonEmptyString(document.document_id, 'document_id');

  const source = document.source;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    fail('SOURCE_CORRUPTED', 'source obrigatorio');
  }
  assertNonEmptyString(source.type, 'source.type');
  assertNonEmptyString(source.filename, 'source.filename');
  if (typeof source.content_hash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(source.content_hash)) {
    fail('SOURCE_CORRUPTED', 'source.content_hash invalido');
  }

  const parser = document.parser;
  if (!parser || typeof parser !== 'object' || Array.isArray(parser)) {
    fail('SOURCE_CORRUPTED', 'parser obrigatorio');
  }
  assertNonEmptyString(parser.adapter, 'parser.adapter');
  assertNonEmptyString(parser.version, 'parser.version');

  if (!Array.isArray(document.blocks)) {
    fail('SOURCE_CORRUPTED', 'blocks deve ser array');
  }

  document.blocks.forEach((block, expectedIndex) => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      fail('SOURCE_CORRUPTED', 'block invalido em index ' + expectedIndex);
    }
    assertNonEmptyString(block.block_id, 'block.block_id');
    if (block.index !== expectedIndex) {
      fail('ORDERING_UNCERTAIN', 'block.index fora de ordem');
    }
    if (!BLOCK_TYPES.has(block.type)) {
      fail('SOURCE_CORRUPTED', 'block.type invalido');
    }
    if (typeof block.text !== 'string') {
      fail('SOURCE_CORRUPTED', 'block.text deve ser string');
    }
    const provenance = block.provenance;
    if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
      fail('PROVENANCE_INCOMPLETE', 'block.provenance obrigatorio');
    }
    assertNullablePositiveInteger(provenance.page, 'provenance.page');
    assertNullablePositiveInteger(provenance.row, 'provenance.row');
    if (provenance.sheet != null && typeof provenance.sheet !== 'string') {
      fail('PROVENANCE_INCOMPLETE', 'provenance.sheet invalido');
    }
    assertNonEmptyString(provenance.source_ref, 'provenance.source_ref');
  });

  if (!document.metadata || typeof document.metadata !== 'object' || Array.isArray(document.metadata)) {
    fail('SOURCE_CORRUPTED', 'metadata deve ser objeto');
  }
  if (!Array.isArray(document.warnings)) {
    fail('SOURCE_CORRUPTED', 'warnings deve ser array');
  }

  return document;
}

module.exports = {
  SCHEMA_VERSION,
  BLOCK_TYPES,
  validateCanonicalDocument
};
