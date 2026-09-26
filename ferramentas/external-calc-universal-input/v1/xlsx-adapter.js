'use strict';

const crypto = require('node:crypto');
const { readZipEntries, asBuffer, DEFAULT_LIMITS } = require('./xlsx-zip-reader');
const { routeSource } = require('./format-router');
const { SCHEMA_VERSION, validateCanonicalDocument } = require('./canonical-document');
const {
  safeXml,
  attributes,
  parseRelationships,
  resolveRelationship,
  parseWorkbook,
  parseSharedStrings,
  parseWorksheet
} = require('./xlsx-xml');

const ADAPTER_ID = 'xlsx-native-v1';
const ADAPTER_VERSION = '1.0';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CONTENT_TYPES_PATH = '[Content_Types].xml';
const ROOT_RELS_PATH = '_rels/.rels';
const WORKBOOK_PATH = 'xl/workbook.xml';
const WORKBOOK_RELS_PATH = 'xl/_rels/workbook.xml.rels';
const WORKSHEET_REL = '/worksheet';
const SHARED_STRINGS_REL = '/sharedStrings';

function fail(reason, message) {
  const error = new Error(message);
  error.code = 'PARSER_FAILURE';
  error.reason = reason;
  throw error;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function requireEntry(entries, name) {
  const entry = entries.get(name);
  if (!entry) fail('REQUIRED_PART_MISSING', 'parte XLSX obrigatoria ausente: ' + name);
  return entry;
}

function assertXlsxPackage(entries) {
  const contentTypes = safeXml(requireEntry(entries, CONTENT_TYPES_PATH), 'content types');
  const overrideRe = /<(?:[A-Za-z_][\w.-]*:)?Override\b([^>]*?)(?:\/>|>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?Override\s*>)/g;
  let workbookType = null;
  let match;
  while ((match = overrideRe.exec(contentTypes))) {
    const attrs = attributes(match[1]);
    if (attrs.PartName === '/xl/workbook.xml') workbookType = attrs.ContentType || null;
  }
  if (workbookType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml') {
    fail('XLSX_CONTENT_TYPE_INVALID', 'workbook XLSX content type ausente/invalido');
  }
  const rootRelationships = parseRelationships(requireEntry(entries, ROOT_RELS_PATH));
  const officeDocument = [...rootRelationships.values()].find(item => item.type.endsWith('/officeDocument'));
  if (!officeDocument || (officeDocument.target_mode && officeDocument.target_mode.toLowerCase() === 'external')) {
    fail('OFFICE_DOCUMENT_RELATIONSHIP_INVALID', 'officeDocument relationship ausente/invalido');
  }
  const target = resolveRelationship('package-root.xml', officeDocument.target);
  if (target !== WORKBOOK_PATH) fail('WORKBOOK_PATH_UNSUPPORTED', 'workbook fora do path XLSX canonico');
}

function contentBytes(source) {
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
  if (source.content == null) {
    const error = new Error('XlsxAdapter exige content binario');
    error.code = 'SOURCE_CORRUPTED';
    throw error;
  }
  try { return asBuffer(source.content); }
  catch (cause) {
    const error = new Error('XlsxAdapter exige Buffer, Uint8Array ou ArrayBuffer');
    error.code = 'SOURCE_CORRUPTED';
    error.cause = cause;
    throw error;
  }
}

function validateRoute(source, routeSource) {
  const route = routeSource(source);
  if (route.adapter_id !== ADAPTER_ID) fail('ROUTER_MISMATCH', 'router selecionou adapter incompativel');
  return route;
}

function resolveSharedStrings(entries, relationships) {
  const relation = [...relationships.values()].find(item => item.type.endsWith(SHARED_STRINGS_REL));
  if (!relation) return [];
  if (relation.target_mode && relation.target_mode.toLowerCase() === 'external') fail('EXTERNAL_RELATIONSHIP', 'sharedStrings externo nao permitido');
  const path = resolveRelationship(WORKBOOK_PATH, relation.target);
  return parseSharedStrings(requireEntry(entries, path));
}

function parseXlsxSource(source, options = {}) {
  const bytes = contentBytes(source);
  const route = validateRoute(source, routeSource);
  const { entries, stats } = readZipEntries(bytes, options.limits || {});
  assertXlsxPackage(entries);
  const workbook = requireEntry(entries, WORKBOOK_PATH);
  const workbookRels = parseRelationships(requireEntry(entries, WORKBOOK_RELS_PATH));
  const sheets = parseWorkbook(workbook);
  const sharedStrings = resolveSharedStrings(entries, workbookRels);

  const blocks = [];
  const sheetMetadata = [];
  const warnings = [];
  let sawFormula = false;
  let sawFormulaWithoutCachedValue = false;

  for (const sheet of sheets) {
    const relationship = workbookRels.get(sheet.relationship_id);
    if (!relationship || !relationship.type.endsWith(WORKSHEET_REL)) {
      fail('SHEET_RELATIONSHIP_INVALID', 'worksheet relationship ausente/invalido: ' + sheet.name);
    }
    if (relationship.target_mode && relationship.target_mode.toLowerCase() === 'external') {
      fail('EXTERNAL_RELATIONSHIP', 'worksheet externo nao permitido');
    }
    const entryPath = resolveRelationship(WORKBOOK_PATH, relationship.target);
    const parsed = parseWorksheet(requireEntry(entries, entryPath), sheet.name, sharedStrings);
    sheetMetadata.push({
      name: sheet.name,
      state: sheet.state,
      source_ref: entryPath,
      merged_cells: parsed.merged_cells
    });

    for (const row of parsed.rows) {
      const maxColumn = row.cells.reduce((max, cell) => Math.max(max, cell.column), 0);
      const textCells = Array.from({ length: maxColumn }, () => '');
      const cells = row.cells.map((cell, cellIndex) => {
        textCells[cell.column - 1] = String(cell.raw);
        if (cell.formula != null) {
          sawFormula = true;
          if (cell.raw === '') sawFormulaWithoutCachedValue = true;
        }
        return {
          cell_id: 'c-' + String(blocks.length + 1).padStart(3, '0') + '-' + String(cellIndex + 1).padStart(3, '0'),
          column: cell.column,
          raw: cell.raw,
          cell_ref: cell.cell_ref,
          value_type: cell.value_type,
          formula: cell.formula,
          style_index: cell.style_index,
          shared_string_index: cell.shared_string_index
        };
      });

      blocks.push({
        block_id: 'b-' + String(blocks.length + 1).padStart(3, '0'),
        index: blocks.length,
        type: 'row',
        text: textCells.join('\t'),
        cells,
        provenance: {
          page: null,
          sheet: sheet.name,
          row: row.row,
          source_ref: sheet.name + '!R' + String(row.row)
        }
      });
    }
  }

  if (sawFormula) warnings.push({ code: 'FORMULA_NOT_EVALUATED', message: 'formulas foram preservadas, nunca executadas pelo adapter' });
  if (sawFormulaWithoutCachedValue) warnings.push({ code: 'FORMULA_WITHOUT_CACHED_VALUE', message: 'formula sem valor cached exige tratamento seguro downstream' });

  const idFactory = options.idFactory || (() => crypto.randomUUID());
  const documentId = idFactory();
  if (typeof documentId !== 'string' || !documentId) fail('DOCUMENT_ID_INVALID', 'document_id invalido');

  const document = {
    schema_version: SCHEMA_VERSION,
    document_id: documentId,
    source: {
      type: route.detected_type,
      filename: source.filename,
      mime_type: source.mime_type == null ? null : String(source.mime_type),
      content_ref: source.content_ref == null ? null : String(source.content_ref),
      content_hash: 'sha256:' + sha256(bytes)
    },
    parser: { adapter: ADAPTER_ID, version: ADAPTER_VERSION },
    blocks,
    metadata: {
      archive: stats,
      sheets: sheetMetadata,
      shared_string_count: sharedStrings.length
    },
    warnings
  };
  validateCanonicalDocument(document);
  return document;
}

module.exports = { ADAPTER_ID, ADAPTER_VERSION, XLSX_MIME, DEFAULT_LIMITS, parseXlsxSource };
