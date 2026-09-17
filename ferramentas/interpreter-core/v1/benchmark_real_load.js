'use strict';

const fs = require('fs');
const path = require('path');
const { interpretResolved } = require('./core');
const { adaptLegacyCalcV2 } = require('./legacy-calc-v2-adapter');
const { compareSemanticShadow } = require('./semantic-shadow');
const { analyzeDivergences } = require('./divergence-analyzer');

function die(message, code = 1) {
  console.error(`FALHOU: ${message}`);
  process.exit(code);
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (err) { die(`nao foi possivel ler ${file}: ${err.message}`); }
}

function readJson(file) {
  try { return JSON.parse(readText(file)); }
  catch (err) { die(`JSON invalido em ${file}: ${err.message}`); }
}

const rawPath = process.argv[2];
const legacyPath = process.argv[3];
if (!rawPath || !legacyPath) {
  die('uso: node benchmark_real_load.js <raw.txt> <legacy-bench.json>');
}

const schema = readJson(path.join(__dirname, 'domains', 'apple-iphone-v0.schema.json'));
const knowledge = readJson(path.join(__dirname, 'domains', 'apple-iphone-v0.knowledge.json'));
const raw = readText(rawPath);
const legacyBench = readJson(legacyPath);

if (!raw.trim()) die('documento bruto vazio');
if (legacyBench.guarda_conservacao?.ok !== true) {
  die('guarda de conservacao do leitor legado nao esta verde');
}

const legacy = adaptLegacyCalcV2(legacyBench, knowledge);
if (legacy.offers.length === 0) {
  die('snapshot legado nao produziu nenhuma oferta suportada pelo dominio Apple V0');
}

const coreBundle = interpretResolved({
  document: {
    contract_version: 'raw-document/v1',
    document_id: 'real-load-shadow',
    content: raw,
    source: { kind: 'plain_text' }
  },
  schema,
  knowledge
});

const report = compareSemanticShadow({ legacy, coreBundle });
const divergence = analyzeDivergences({ legacy, coreBundle });

const summary = {
  contract_version: 'real-shadow-benchmark-summary/v1',
  mode: 'shadow_read_only',
  scope: 'apple-iphone-v0-supported-models',
  legacy_guard_ok: true,
  legacy_supported_offers: report.metrics.legacy_supported_offers,
  legacy_unsupported_products: legacy.unsupported.length,
  legacy_invalid_supported: legacy.invalid.length,
  core_offers: report.metrics.core_offers,
  core_ambiguities: report.metrics.core_ambiguities,
  matched_offers: report.metrics.matched_offers,
  missing_offers: report.metrics.missing_offers,
  extra_offers: report.metrics.extra_offers,
  agreement_ratio: report.metrics.agreement_ratio,
  no_silent_wrong_price: report.gates.no_silent_wrong_price,
  exact_multiset: report.gates.exact_multiset,
  promotion_ready:
    report.gates.no_silent_wrong_price === true &&
    report.gates.exact_multiset === true
};

const diagnostic = {
  contract_version: divergence.contract_version,
  version: divergence.version,
  categories: divergence.categories,
  ambiguities_by_cause: divergence.ambiguities_by_cause,
  ambiguities_by_field: divergence.ambiguities_by_field,
  top_model_gaps: divergence.top_model_gaps
};

console.log('=== REAL SHADOW BENCHMARK — AGREGADO ===');
console.log(JSON.stringify(summary, null, 2));
console.log('=== DIVERGENCE ANALYZER V1 — AGREGADO ===');
console.log(JSON.stringify(diagnostic, null, 2));
console.log(`PROMOTION_READY=${summary.promotion_ready ? 'true' : 'false'}`);

if (!summary.no_silent_wrong_price) {
  console.log('BLOQUEIO: existe divergencia de preco para modelo suportado; detalhes sensiveis nao sao impressos.');
}
if (!summary.exact_multiset) {
  console.log('BLOQUEIO: o multiconjunto de ofertas ainda diverge; detalhes sensiveis nao sao impressos.');
}

console.log('BENCHMARK_CONCLUIDO=1');
