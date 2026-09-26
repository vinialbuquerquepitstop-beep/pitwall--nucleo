'use strict';

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function applyUnknownSupplierBoundaryFallback(schema) {
  const out = clone(schema);
  out.fields = Array.isArray(out.fields) ? out.fields : [];

  const boundaryField = {
    name: '_unknown_supplier_boundary',
    type: 'string',
    required: false,
    context_inheritable: false,
    context_anchor: false,
    context_boundary: true,
    context_boundary_reason: 'unknown_supplier_boundary',
    preserve_fields: [],
    skip_if_anchor_present: true,
    extractors: [{
      kind: 'role_raw',
      role: 'unknown',
      transform: 'trim',
      score: 0.4
    }]
  };

  out.fields = out.fields.filter(field => field.name !== boundaryField.name);
  out.fields.unshift(boundaryField);

  out.metadata = Object.assign({}, out.metadata || {}, {
    unknown_supplier_boundary_fallback: {
      version: 'unknown-supplier-boundary/0.1.0',
      policy: 'unknown-structural-line-resets-context-without-supplier-identity'
    }
  });

  return out;
}

module.exports = {
  applyUnknownSupplierBoundaryFallback
};
