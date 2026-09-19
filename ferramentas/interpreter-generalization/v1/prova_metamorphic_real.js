'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { runC01ReadOnlySlice } = require('../../external-calc-c01/v1/c01-readonly-bridge');

const [rawPath, supplierProfilesPath] = process.argv.slice(2);
if (!rawPath || !supplierProfilesPath) {
  console.error('uso: node prova_metamorphic_real.js <raw.txt> <supplier-profiles.json>');
  process.exit(2);
}

const raw = fs.readFileSync(rawPath, 'utf8');
const supplierProfiles = JSON.parse(fs.readFileSync(supplierProfilesPath, 'utf8'));
const schema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../interpreter-core/v1/domains/apple-iphone-v0.schema.json'),
  'utf8'
));
const knowledge = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../interpreter-core/v1/domains/apple-iphone-v0.knowledge.json'),
  'utf8'
));

function evaluate(content, label) {
  return runC01ReadOnlySlice({
    analysis_id: 'generalization-metamorphic-v1',
    source_id: `metamorphic-${label}`,
    currency: 'BRL',
    supplier_profiles: supplierProfiles,
    schema,
    knowledge,
    document: {
      contract_version: 'raw-document/v1',
      document_id: `metamorphic-${label}`,
      content,
      source: { kind: 'plain_text' }
    }
  });
}

function normalizeOffer(candidate) {
  const offer = candidate.interpreted_offer;
  return {
    supplier_id: offer.supplier_id ?? null,
    model: offer.model?.id || offer.model?.label || null,
    capacity_gb: offer.capacity_gb ?? null,
    condition: offer.condition ?? null,
    color: offer.color ?? null,
    amount_minor: offer.price?.amount_minor ?? null,
    currency: offer.price?.currency ?? null
  };
}

function semanticMultiset(queue) {
  return queue.candidates
    .map(normalizeOffer)
    .map(item => JSON.stringify(item))
    .sort();
}

function supplierCoverage(queue) {
  return queue.candidates.filter(candidate => candidate.interpreted_offer?.supplier_id).length;
}

const baseline = evaluate(raw, 'baseline');
const baselineSet = semanticMultiset(baseline);

assert.ok(baseline.candidates.length > 0, 'baseline sem candidatos');
assert.strictEqual(
  supplierCoverage(baseline),
  baseline.candidates.length,
  'baseline perdeu supplier_id'
);

const lf = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const transforms = [
  ['crlf', lf.replace(/\n/g, '\r\n')],
  ['trailing-spaces', lf.split('\n').map(line => line ? `${line}   ` : line).join('\n')],
  ['outer-blank-lines', `\n\n${lf}\n\n`],
  ['terminal-newlines', `${lf.replace(/\n+$/g, '')}\n\n\n`]
];

let passed = 0;
let diagnosticDrift = 0;

for (const [name, transformed] of transforms) {
  const queue = evaluate(transformed, name);

  assert.deepStrictEqual(
    semanticMultiset(queue),
    baselineSet,
    `ofertas semanticas mudaram em ${name}`
  );
  assert.strictEqual(
    queue.metrics.review_candidates,
    baseline.metrics.review_candidates,
    `quantidade de candidatos mudou em ${name}`
  );
  assert.strictEqual(
    supplierCoverage(queue),
    queue.candidates.length,
    `supplier_id incompleto em ${name}`
  );

  const ambiguityDelta =
    queue.metrics.unresolved_ambiguities - baseline.metrics.unresolved_ambiguities;
  const invalidDelta =
    queue.metrics.invalid_items - baseline.metrics.invalid_items;

  if (ambiguityDelta !== 0 || invalidDelta !== 0) {
    diagnosticDrift += 1;
    console.log(
      `METAMORPHIC_DIAGNOSTIC_DRIFT=${name} ambiguity_delta=${ambiguityDelta} invalid_delta=${invalidDelta}`
    );
  }

  passed += 1;
  console.log(
    `METAMORPHIC_CASE=${name} PASS candidates=${queue.candidates.length} supplier_attributed=${supplierCoverage(queue)}`
  );
}

console.log(`METAMORPHIC_CASES=${passed}`);
console.log(`METAMORPHIC_BASELINE_CANDIDATES=${baseline.candidates.length}`);
console.log(`METAMORPHIC_DIAGNOSTIC_DRIFT_CASES=${diagnosticDrift}`);
console.log('METAMORPHIC_SEMANTIC_GATE=PASS');
console.log(
  diagnosticDrift === 0
    ? 'METAMORPHIC_DIAGNOSTIC_STABILITY=PASS'
    : 'METAMORPHIC_DIAGNOSTIC_STABILITY=WARN'
);
console.log('METAMORPHIC_REAL_GATE=PASS');
