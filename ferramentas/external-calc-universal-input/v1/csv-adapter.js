'use strict';

const crypto = require('node:crypto');
const { routeSource } = require('./format-router');
const { SCHEMA_VERSION, validateCanonicalDocument } = require('./canonical-document');

const ADAPTER_ID = 'csv-native-v1';
const ADAPTER_VERSION = '1.0';
const DELIMITERS = [',', ';', '\t'];

function csvError(reason, message) {
  const error = new Error(message);
  error.code = 'PARSER_FAILURE';
  error.reason = reason;
  return error;
}

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function splitRecordsPreservingEndings(content) {
  if (content === '') return [];

  const records = [];
  let recordStart = 0;
  let recordStartLine = 1;
  let physicalLine = 1;
  let inQuotes = false;
  let index = 0;

  while (index < content.length) {
    const char = content[index];

    if (char === '"') {
      if (inQuotes && content[index + 1] === '"') {
        index += 2;
        continue;
      }
      inQuotes = !inQuotes;
      index += 1;
      continue;
    }

    if (char === '\r' || char === '\n') {
      const isCrLf = char === '\r' && content[index + 1] === '\n';
      const ending = isCrLf ? '\r\n' : char;

      if (inQuotes) {
        physicalLine += 1;
        index += ending.length;
        continue;
      }

      records.push({
        raw: content.slice(recordStart, index),
        line_ending: ending,
        start_line: recordStartLine,
        end_line: physicalLine
      });

      physicalLine += 1;
      index += ending.length;
      recordStart = index;
      recordStartLine = physicalLine;
      continue;
    }

    index += 1;
  }

  if (inQuotes) {
    throw csvError('UNCLOSED_QUOTE', 'CSV possui aspas nao fechadas');
  }

  if (recordStart < content.length) {
    records.push({
      raw: content.slice(recordStart),
      line_ending: '',
      start_line: recordStartLine,
      end_line: physicalLine
    });
  }

  return records;
}

function countDelimiterOutsideQuotes(raw, delimiter) {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === '"') {
      if (inQuotes && raw[index + 1] === '"') {
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === delimiter) count += 1;
  }

  return count;
}

function normalizeExplicitDelimiter(value) {
  if (value == null) return null;
  if (value === '\\t') return '\t';
  if (DELIMITERS.includes(value)) return value;
  throw csvError('INVALID_DELIMITER', 'delimiter CSV invalido');
}

function detectDelimiter(records, explicitDelimiter) {
  const explicit = normalizeExplicitDelimiter(explicitDelimiter);
  if (explicit) {
    return { delimiter: explicit, warning: null };
  }

  const firstNonEmpty = records.find(record => record.raw.length > 0);
  if (!firstNonEmpty) {
    return {
      delimiter: ',',
      warning: {
        code: 'DELIMITER_DEFAULTED_SINGLE_COLUMN',
        message: 'CSV sem delimitador observavel; virgula usada sem alterar conteudo'
      }
    };
  }

  const candidates = DELIMITERS
    .map(delimiter => ({
      delimiter,
      count: countDelimiterOutsideQuotes(firstNonEmpty.raw, delimiter)
    }))
    .filter(candidate => candidate.count > 0);

  if (candidates.length > 1) {
    throw csvError('DELIMITER_UNCERTAIN', 'mais de um delimitador possivel no primeiro registro');
  }

  if (candidates.length === 1) {
    return { delimiter: candidates[0].delimiter, warning: null };
  }

  return {
    delimiter: ',',
    warning: {
      code: 'DELIMITER_DEFAULTED_SINGLE_COLUMN',
      message: 'CSV de uma coluna sem delimitador observavel; virgula usada sem alterar conteudo'
    }
  };
}

function parseRecord(raw, delimiter) {
  const fields = [];
  let value = '';
  let inQuotes = false;
  let fieldStarted = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (char === '"') {
      if (inQuotes && raw[index + 1] === '"') {
        value += '"';
        index += 1;
        fieldStarted = true;
        continue;
      }

      if (!inQuotes && fieldStarted) {
        throw csvError('UNEXPECTED_QUOTE', 'aspas inesperadas em campo CSV');
      }

      inQuotes = !inQuotes;
      fieldStarted = true;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      fields.push(value);
      value = '';
      fieldStarted = false;
      continue;
    }

    value += char;
    fieldStarted = true;
  }

  if (inQuotes) {
    throw csvError('UNCLOSED_QUOTE', 'CSV possui aspas nao fechadas');
  }

  fields.push(value);
  return fields;
}

function reconstructCsv(document) {
  const endings = document?.metadata?.record_endings;
  if (!Array.isArray(endings) || endings.length !== document.blocks.length) {
    const error = new Error('record_endings ausente ou inconsistente');
    error.code = 'PROVENANCE_INCOMPLETE';
    throw error;
  }
  return document.blocks.map((block, index) => block.text + endings[index]).join('');
}

function parseCsvSource(source, options = {}) {
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
    const error = new Error('CsvAdapter exige content string');
    error.code = 'SOURCE_CORRUPTED';
    throw error;
  }

  const route = routeSource(source);
  if (route.adapter_id !== ADAPTER_ID) {
    const error = new Error('router selecionou adapter incompativel');
    error.code = 'PARSER_FAILURE';
    throw error;
  }

  const records = splitRecordsPreservingEndings(source.content);
  const delimiterResult = detectDelimiter(records, source.delimiter);
  const delimiter = delimiterResult.delimiter;

  const blocks = records.map((record, index) => {
    const values = parseRecord(record.raw, delimiter);
    const sourceRef = record.start_line === record.end_line
      ? 'line:' + String(record.start_line)
      : 'lines:' + String(record.start_line) + '-' + String(record.end_line);

    return {
      block_id: 'b-' + String(index + 1).padStart(3, '0'),
      index,
      type: 'row',
      text: record.raw,
      cells: values.map((raw, columnIndex) => ({
        cell_id: 'c-' + String(index + 1).padStart(3, '0') + '-' + String(columnIndex + 1).padStart(3, '0'),
        column: columnIndex + 1,
        raw
      })),
      provenance: {
        page: null,
        sheet: null,
        row: record.start_line,
        source_ref: sourceRef
      }
    };
  });

  const warnings = [];
  if (delimiterResult.warning) warnings.push(delimiterResult.warning);
  if (source.content.length === 0) {
    warnings.push({
      code: 'EMPTY_INPUT',
      message: 'fonte CSV vazia'
    });
  }

  const nonEmptyColumnCounts = blocks
    .filter(block => block.text.length > 0)
    .map(block => block.cells.length);
  if (new Set(nonEmptyColumnCounts).size > 1) {
    warnings.push({
      code: 'COLUMN_COUNT_VARIANCE',
      message: 'registros CSV possuem quantidades diferentes de colunas'
    });
  }

  const idFactory = options.idFactory || (() => crypto.randomUUID());
  const documentId = idFactory();
  if (typeof documentId !== 'string' || !documentId) {
    const error = new Error('document_id invalido');
    error.code = 'PARSER_FAILURE';
    throw error;
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
      delimiter,
      record_endings: records.map(record => record.line_ending)
    },
    warnings
  };

  validateCanonicalDocument(document);

  if (reconstructCsv(document) !== source.content) {
    const error = new Error('CsvAdapter perdeu fidelidade de conteudo');
    error.code = 'PARTIAL_EXTRACTION';
    throw error;
  }

  return document;
}

module.exports = {
  ADAPTER_ID,
  ADAPTER_VERSION,
  parseCsvSource,
  reconstructCsv,
  splitRecordsPreservingEndings,
  parseRecord,
  detectDelimiter
};
