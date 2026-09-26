'use strict';

const crypto = require('node:crypto');
const { routeSource } = require('./format-router');
const { SCHEMA_VERSION, validateCanonicalDocument } = require('./canonical-document');

const ADAPTER_ID = 'text-native-v1';
const ADAPTER_VERSION = '1.0';

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function tokenizePreservingLineEndings(content) {
  if (content === '') return [];

  const tokens = [];
  let cursor = 0;
  while (cursor < content.length) {
    let end = cursor;
    while (end < content.length && content[end] !== '\n' && content[end] !== '\r') {
      end += 1;
    }

    let lineEnding = '';
    if (end < content.length) {
      if (content[end] === '\r' && content[end + 1] === '\n') {
        lineEnding = '\r\n';
        end += 2;
      } else {
        lineEnding = content[end];
        end += 1;
      }
    }

    const textEnd = end - lineEnding.length;
    tokens.push({
      text: content.slice(cursor, textEnd),
      line_ending: lineEnding
    });
    cursor = end;
  }

  return tokens;
}

function reconstructText(document) {
  const endings = document?.metadata?.line_endings;
  if (!Array.isArray(endings) || endings.length !== document.blocks.length) {
    const error = new Error('line_endings ausente ou inconsistente');
    error.code = 'PROVENANCE_INCOMPLETE';
    throw error;
  }
  return document.blocks.map((block, index) => block.text + endings[index]).join('');
}

function parseTextSource(source, options = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    const error = new Error('source obrigatorio');
    error.code = 'SOURCE_CORRUPTED';
    throw error;
  }
  if (typeof source.filename !== 'string' || !source.filename) {
    const error = new Error('filename obrigatorio');
    error.code = 'SOURCE_CORRUPTED';
    throw error;
  }
  if (typeof source.content !== 'string') {
    const error = new Error('TextAdapter exige content string');
    error.code = 'SOURCE_CORRUPTED';
    throw error;
  }

  const route = routeSource(source);
  if (route.adapter_id !== ADAPTER_ID) {
    const error = new Error('router selecionou adapter incompatível');
    error.code = 'PARSER_FAILURE';
    throw error;
  }

  const idFactory = options.idFactory || (() => crypto.randomUUID());
  const documentId = idFactory();
  if (typeof documentId !== 'string' || !documentId) {
    const error = new Error('document_id invalido');
    error.code = 'PARSER_FAILURE';
    throw error;
  }

  const tokens = tokenizePreservingLineEndings(source.content);
  const blocks = tokens.map((token, index) => ({
    block_id: 'b-' + String(index + 1).padStart(3, '0'),
    index,
    type: 'text',
    text: token.text,
    provenance: {
      page: null,
      sheet: null,
      row: index + 1,
      source_ref: 'line:' + String(index + 1)
    }
  }));

  const warnings = [];
  if (source.content.length === 0) {
    warnings.push({
      code: 'EMPTY_INPUT',
      message: 'fonte de texto vazia'
    });
  }

  const document = {
    schema_version: SCHEMA_VERSION,
    document_id: documentId,
    source: {
      type: route.detected_type,
      filename: source.filename,
      mime_type: source.mime_type == null ? null : String(source.mime_type),
      content_ref: source.content_ref == null ? null : String(source.content_ref),
      content_hash: 'sha256:' + sha256(source.content)
    },
    parser: {
      adapter: ADAPTER_ID,
      version: ADAPTER_VERSION
    },
    blocks,
    metadata: {
      encoding: 'utf-8',
      line_endings: tokens.map(token => token.line_ending)
    },
    warnings
  };

  validateCanonicalDocument(document);

  if (reconstructText(document) !== source.content) {
    const error = new Error('TextAdapter perdeu fidelidade de conteudo');
    error.code = 'PARTIAL_EXTRACTION';
    throw error;
  }

  return document;
}

module.exports = {
  ADAPTER_ID,
  ADAPTER_VERSION,
  parseTextSource,
  reconstructText,
  tokenizePreservingLineEndings
};
