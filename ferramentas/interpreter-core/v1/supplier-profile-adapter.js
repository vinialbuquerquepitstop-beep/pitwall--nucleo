'use strict';

const { normalizeKey } = require('./core');

const ACCENT_CLASS = {
  a: '[aàáâãäå]',
  c: '[cç]',
  e: '[eèéêë]',
  i: '[iìíîï]',
  n: '[nñ]',
  o: '[oòóôõö]',
  u: '[uùúûü]',
  y: '[yýÿ]'
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
}

function tokenPattern(token) {
  return String(token)
    .split('')
    .map(char => ACCENT_CLASS[char] || escapeRegex(char))
    .join('');
}

function normalizedTermPattern(value) {
  const key = normalizeKey(value);
  if (!key) return null;
  const tokens = key.split(' ').filter(Boolean);
  if (!tokens.length) return null;
  return tokens.map(tokenPattern).join('[^a-zA-Z0-9À-ÿ]+');
}

function normalizeProfiles(input) {
  const source = Array.isArray(input)
    ? input
    : Array.isArray(input && input.profiles)
      ? input.profiles
      : Array.isArray(input && input.supplier_profiles)
        ? input.supplier_profiles
        : [];

  const profiles = [];
  for (const raw of source) {
    const id = raw && (raw.id || raw.supplier_id || raw.code || raw.codigo);
    const label = raw && (raw.label || raw.name || raw.nome);
    if (!id || !label) continue;

    const aliases = []
      .concat(Array.isArray(raw.aliases) ? raw.aliases : [])
      .concat(Array.isArray(raw.match_terms) ? raw.match_terms : [])
      .map(value => String(value == null ? '' : value).trim())
      .filter(Boolean);

    const terms = Array.from(new Set([String(label).trim()].concat(aliases)))
      .filter(Boolean)
      .sort((a, b) => normalizeKey(b).length - normalizeKey(a).length || a.localeCompare(b));

    profiles.push({
      id: String(id),
      label: String(label),
      terms
    });
  }

  return profiles;
}

function applySupplierProfiles(schema, input) {
  const out = deepClone(schema || {});
  out.fields = Array.isArray(out.fields) ? out.fields : [];

  const profiles = normalizeProfiles(input);
  if (!profiles.length) return out;

  const termToId = new Map();
  for (const profile of profiles) {
    for (const term of profile.terms) {
      const key = normalizeKey(term);
      if (!key || termToId.has(key)) continue;
      termToId.set(key, { term, id: profile.id });
    }
  }

  const alternatives = Array.from(termToId.values())
    .map(item => ({ ...item, pattern: normalizedTermPattern(item.term) }))
    .filter(item => item.pattern)
    .sort((a, b) => normalizeKey(b.term).length - normalizeKey(a.term).length);

  if (!alternatives.length) return out;

  const pattern =
    '(?:^|[^a-zA-Z0-9À-ÿ])(' +
    alternatives.map(item => item.pattern).join('|') +
    ')(?=$|[^a-zA-Z0-9À-ÿ])';

  const valueMap = {};
  for (const item of alternatives) valueMap[item.term] = item.id;

  const supplierField = {
    name: 'supplier',
    type: 'string',
    required: false,
    context_inheritable: true,
    context_anchor: false,
    context_boundary: true,
    context_boundary_reason: 'supplier_boundary',
    preserve_fields: [],
    extractors: [{
      kind: 'regex',
      pattern,
      flags: 'i',
      group: 1,
      transform: 'trim',
      score: 0.995
    }],
    value_map: valueMap
  };

  out.fields = out.fields.filter(field => field.name !== 'supplier');
  out.fields.unshift(supplierField);

  out.fields = out.fields.map(field => {
    if (field.name === 'supplier' || field.context_boundary !== true) return field;
    const preserveFields = new Set(
      Array.isArray(field.preserve_fields) ? field.preserve_fields : []
    );
    preserveFields.add('supplier');
    return {
      ...field,
      preserve_fields: Array.from(preserveFields)
    };
  });

  out.context_policy = out.context_policy || {};
  const preserve = new Set(
    Array.isArray(out.context_policy.preserve_on_anchor)
      ? out.context_policy.preserve_on_anchor
      : []
  );
  preserve.add('supplier');
  out.context_policy.preserve_on_anchor = Array.from(preserve);

  out.metadata = Object.assign({}, out.metadata || {}, {
    supplier_profile_adapter: {
      version: 'supplier-profile-adapter/0.1.0',
      profile_count: profiles.length,
      term_count: alternatives.length
    }
  });

  return out;
}

module.exports = {
  normalizeProfiles,
  normalizedTermPattern,
  applySupplierProfiles
};
