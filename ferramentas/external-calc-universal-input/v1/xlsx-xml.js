'use strict';
const path = require('node:path').posix;

function xmlError(reason, message) {
  const error = new Error(message);
  error.code = 'PARSER_FAILURE';
  error.reason = reason;
  return error;
}

function safeXml(buffer, label) {
  let xml;
  if (Buffer.isBuffer(buffer) || buffer instanceof Uint8Array) {
    try { xml = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { throw xmlError('XML_ENCODING_INVALID', label + ' nao e UTF-8 valido'); }
  } else {
    xml = String(buffer);
  }
  if (/<!DOCTYPE\b/i.test(xml) || /<!ENTITY\b/i.test(xml)) throw xmlError('XML_DTD_FORBIDDEN', label + ' contem DTD/ENTITY');
  if (xml.includes('\u0000')) throw xmlError('XML_NUL_FORBIDDEN', label + ' contem NUL');
  return xml;
}

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (full, entity) => {
    if (entity === 'amp') return '&';
    if (entity === 'lt') return '<';
    if (entity === 'gt') return '>';
    if (entity === 'quot') return '"';
    if (entity === 'apos') return "'";
    const code = entity.startsWith('#x') ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    if (!Number.isInteger(code) || code < 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) {
      throw xmlError('XML_ENTITY_INVALID', 'entidade numerica XML invalida');
    }
    return String.fromCodePoint(code);
  }).replace(/&[A-Za-z_:][\w:.-]*;/g, entity => {
    throw xmlError('XML_ENTITY_UNSUPPORTED', 'entidade XML nao suportada: ' + entity);
  });
}

function attributes(fragment) {
  const result = {};
  const re = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(fragment))) result[match[1]] = decodeEntities(match[2] ?? match[3] ?? '');
  return result;
}

function textElements(xmlFragment) {
  const values = [];
  const re = /<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t\s*>|<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*\/>/g;
  let match;
  while ((match = re.exec(xmlFragment))) values.push(match[1] == null ? '' : decodeEntities(match[1]));
  return values.join('');
}

function elementText(xmlFragment, localName) {
  const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('<(?:[A-Za-z_][\\w.-]*:)?' + escaped + '\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?' + escaped + '\\s*>');
  const match = re.exec(xmlFragment);
  return match ? decodeEntities(match[1]) : null;
}

function parseRelationships(buffer) {
  const xml = safeXml(buffer, 'relationships');
  const map = new Map();
  const re = /<(?:[A-Za-z_][\w.-]*:)?Relationship\b([^>]*?)(?:\/>|>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?Relationship\s*>)/g;
  let match;
  while ((match = re.exec(xml))) {
    const attrs = attributes(match[1]);
    if (!attrs.Id || !attrs.Target || !attrs.Type) throw xmlError('RELATIONSHIP_INVALID', 'relationship incompleto');
    if (map.has(attrs.Id)) throw xmlError('RELATIONSHIP_DUPLICATE', 'relationship Id duplicado');
    map.set(attrs.Id, { id: attrs.Id, target: attrs.Target, type: attrs.Type, target_mode: attrs.TargetMode || null });
  }
  return map;
}

function resolveRelationship(baseFile, target) {
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target) || target.startsWith('//')) throw xmlError('EXTERNAL_RELATIONSHIP', 'relationship externo nao permitido');
  const rootRelative = target.startsWith('/') ? target.slice(1) : path.normalize(path.join(path.dirname(baseFile), target));
  if (!rootRelative || rootRelative === '..' || rootRelative.startsWith('../') || rootRelative.includes('/../')) {
    throw xmlError('RELATIONSHIP_TRAVERSAL', 'relationship sai do pacote');
  }
  return rootRelative;
}

function parseWorkbook(buffer) {
  const xml = safeXml(buffer, 'workbook');
  const sheets = [];
  const re = /<(?:[A-Za-z_][\w.-]*:)?sheet\b([^>]*?)(?:\/>|>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?sheet\s*>)/g;
  let match;
  while ((match = re.exec(xml))) {
    const attrs = attributes(match[1]);
    const relationshipId = attrs['r:id'] || attrs.id;
    if (!attrs.name || !relationshipId) throw xmlError('SHEET_INVALID', 'sheet sem name/r:id');
    sheets.push({ name: attrs.name, relationship_id: relationshipId, state: attrs.state || 'visible' });
  }
  if (!sheets.length) throw xmlError('WORKBOOK_EMPTY', 'workbook sem sheets');
  return sheets;
}

function parseSharedStrings(buffer) {
  if (!buffer) return [];
  const xml = safeXml(buffer, 'sharedStrings');
  const strings = [];
  const re = /<(?:[A-Za-z_][\w.-]*:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?si\s*>/g;
  let match;
  while ((match = re.exec(xml))) strings.push(textElements(match[1]));
  return strings;
}

function columnNumber(cellRef) {
  const match = /^([A-Za-z]+)([1-9]\d*)$/.exec(cellRef || '');
  if (!match) throw xmlError('CELL_REF_INVALID', 'referencia de celula invalida: ' + String(cellRef));
  let value = 0;
  for (const char of match[1].toUpperCase()) value = value * 26 + (char.charCodeAt(0) - 64);
  return { column: value, row: Number(match[2]) };
}

function parseWorksheet(buffer, sheetName, sharedStrings) {
  const xml = safeXml(buffer, 'worksheet ' + sheetName);
  const merged = [];
  const mergeRe = /<(?:[A-Za-z_][\w.-]*:)?mergeCell\b([^>]*?)(?:\/>|>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?mergeCell\s*>)/g;
  let mergeMatch;
  while ((mergeMatch = mergeRe.exec(xml))) {
    const attrs = attributes(mergeMatch[1]);
    if (!attrs.ref || !/^[A-Za-z]+[1-9]\d*:[A-Za-z]+[1-9]\d*$/.test(attrs.ref)) throw xmlError('MERGE_REF_INVALID', 'mergeCell ref invalido');
    merged.push(attrs.ref);
  }

  const rows = [];
  const rowRe = /<(?:[A-Za-z_][\w.-]*:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?row\s*>)/g;
  let rowMatch;
  let fallbackRow = 0;
  while ((rowMatch = rowRe.exec(xml))) {
    const attrs = attributes(rowMatch[1]);
    const rowNumber = attrs.r ? Number(attrs.r) : fallbackRow + 1;
    if (!Number.isSafeInteger(rowNumber) || rowNumber < 1) throw xmlError('ROW_REF_INVALID', 'row r invalido');
    if (rows.length && rowNumber <= rows[rows.length - 1].row) throw xmlError('ROW_ORDER_INVALID', 'rows fora de ordem');
    fallbackRow = rowNumber;
    const body = rowMatch[2] || '';
    const cells = [];
    const cellRe = /<(?:[A-Za-z_][\w.-]*:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c\s*>)/g;
    let cellMatch;
    let lastColumn = 0;
    while ((cellMatch = cellRe.exec(body))) {
      const cellAttrs = attributes(cellMatch[1]);
      if (!cellAttrs.r) throw xmlError('CELL_REF_INVALID', 'celula sem referencia');
      const ref = columnNumber(cellAttrs.r);
      if (ref.row !== rowNumber) throw xmlError('CELL_ROW_MISMATCH', 'celula fora da row declarada');
      if (ref.column <= lastColumn) throw xmlError('CELL_ORDER_INVALID', 'celulas fora de ordem');
      lastColumn = ref.column;
      const inner = cellMatch[2] || '';
      const type = cellAttrs.t || 'n';
      const valueText = elementText(inner, 'v');
      const formula = elementText(inner, 'f');
      let raw;
      let sharedStringIndex = null;
      if (type === 's') {
        if (valueText == null || !/^\d+$/.test(valueText)) throw xmlError('SHARED_STRING_INDEX_INVALID', 'indice shared string invalido');
        sharedStringIndex = Number(valueText);
        if (!Number.isSafeInteger(sharedStringIndex) || sharedStringIndex < 0 || sharedStringIndex >= sharedStrings.length) {
          throw xmlError('SHARED_STRING_INDEX_INVALID', 'indice shared string fora da tabela');
        }
        raw = sharedStrings[sharedStringIndex];
      } else if (type === 'inlineStr') {
        raw = textElements(inner);
      } else {
        raw = valueText == null ? '' : valueText;
      }
      cells.push({
        cell_ref: cellAttrs.r,
        column: ref.column,
        raw,
        value_type: type,
        formula: formula == null ? null : formula,
        style_index: cellAttrs.s == null ? null : cellAttrs.s,
        shared_string_index: sharedStringIndex
      });
    }
    rows.push({ row: rowNumber, cells });
  }
  return { rows, merged_cells: merged };
}

module.exports = { safeXml, decodeEntities, attributes, textElements, elementText, parseRelationships, resolveRelationship, parseWorkbook, parseSharedStrings, columnNumber, parseWorksheet };
