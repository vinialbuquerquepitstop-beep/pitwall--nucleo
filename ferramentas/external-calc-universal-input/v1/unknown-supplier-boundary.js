'use strict';

const {
  scoreRoles,
  normalizeLine,
  extractFieldCandidates
} = require('../../interpreter-core/v1/core');
const { validateCanonicalDocument } = require('./canonical-document');

const VERSION = 'unknown-supplier-boundary/0.2.0';
const ALLOWED_ROLES = new Set(['unknown', 'product_header', 'note']);
const MAX_CANDIDATES = 256;
const MAX_PATTERN_LENGTH = 32768;

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
}

function boundaryError(reason, message) {
  const error = new Error(message);
  error.code = 'PARSER_FAILURE';
  error.reason = reason;
  return error;
}

function segmentForBlock(block) {
  const line = Number(block.index) + 1;
  return {
    segment_id: 'unknown-supplier-candidate-' + line,
    line_number: line,
    raw: block.text,
    normalized: normalizeLine(block.text),
    role_candidates: scoreRoles(block.text)
  };
}

function detectUnknownSupplierBoundaryCandidates(schema, document) {
  validateCanonicalDocument(document);
  const fieldsSchema = clone(schema);
  fieldsSchema.fields = Array.isArray(fieldsSchema.fields) ? fieldsSchema.fields : [];

  const blocks = document.blocks || [];
  const candidates = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (typeof block.text !== 'string' || block.text.trim() === '') continue;

    const segment = segmentForBlock(block);
    const topRole = segment.role_candidates[0]?.role || 'none';
    if (!ALLOWED_ROLES.has(topRole)) continue;

    const fieldCandidates = extractFieldCandidates(segment, fieldsSchema);
    if (fieldCandidates.length > 0) continue;

    const previousBlank = index === 0
      || String(blocks[index - 1]?.text || '').trim() === '';
    const nextBlank = index === blocks.length - 1
      || String(blocks[index + 1]?.text || '').trim() === '';

    if (!previousBlank || !nextBlank) continue;

    const normalized = segment.normalized;
    if (!normalized) continue;

    candidates.push({
      line_number: segment.line_number,
      normalized
    });
  }

  if (candidates.length > MAX_CANDIDATES) {
    throw boundaryError(
      'UNKNOWN_SUPPLIER_BOUNDARY_LIMIT',
      'quantidade de boundaries candidatos excede limite seguro'
    );
  }

  return candidates;
}

function applyUnknownSupplierBoundaryFallback(schema, document) {
  const out = clone(schema);
  out.fields = Array.isArray(out.fields) ? out.fields : [];

  const candidates = detectUnknownSupplierBoundaryCandidates(schema, document);
  const literals = Array.from(new Set(candidates.map(item => item.normalized)));

  if (literals.length > 0) {
    const pattern = '^(?:' + literals.map(escapeRegex).join('|') + ')$';
    if (pattern.length > MAX_PATTERN_LENGTH) {
      throw boundaryError(
        'UNKNOWN_SUPPLIER_BOUNDARY_PATTERN_LIMIT',
        'pattern de boundaries excede limite seguro'
      );
    }

    const boundaryField = {
      name: '_unknown_supplier_boundary',
      type: 'string',
      required: false,
      context_inheritable: false,
      context_anchor: false,
      context_boundary: true,
      context_boundary_reason: 'supplier_boundary',
      preserve_fields: [],
      skip_if_anchor_present: true,
      extractors: [{
        kind: 'regex',
        pattern,
        flags: 'i',
        group: 0,
        transform: 'trim',
        score: 0.4
      }]
    };

    out.fields = out.fields.filter(field => field.name !== boundaryField.name);
    out.fields.unshift(boundaryField);
  }

  out.metadata = Object.assign({}, out.metadata || {}, {
    unknown_supplier_boundary_fallback: {
      version: VERSION,
      policy: 'isolated-nonsemantic-supplier-section-boundary-without-supplier-identity',
      candidate_count: candidates.length
    }
  });

  return out;
}

module.exports = {
  VERSION,
  ALLOWED_ROLES,
  MAX_CANDIDATES,
  MAX_PATTERN_LENGTH,
  detectUnknownSupplierBoundaryCandidates,
  applyUnknownSupplierBoundaryFallback
};
