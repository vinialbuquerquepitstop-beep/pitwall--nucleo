'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');

function checkEvidence(e) {
  const issues = [];
  if (!e || e.contract_version !== 'external-calc-unseen-suppliers-gate/v1') issues.push('INVALID_CONTRACT');
  const suppliers = e?.suppliers;
  if (!Array.isArray(suppliers) || suppliers.length < 3) issues.push('FEWER_THAN_THREE_BLIND_SUPPLIERS');
  if (!e?.freeze_sha256 || !/^[a-f0-9]{64}$/i.test(e.freeze_sha256)) issues.push('FREEZE_HASH_MISSING');
  if (!e?.parser_commit || !/^[a-f0-9]{40}$/i.test(e.parser_commit)) issues.push('PARSER_COMMIT_MISSING');
  if (e?.ground_truth_reviewed !== true) issues.push('GROUND_TRUTH_NOT_REVIEWED');
  if (!e?.run_at || !e?.evidence_uri) issues.push('EXECUTION_EVIDENCE_MISSING');
  const ids = new Set();
  for (const s of Array.isArray(suppliers) ? suppliers : []) {
    if (!s?.source_id || ids.has(s.source_id)) issues.push('SOURCE_ID_MISSING_OR_DUPLICATED');
    if (s?.source_id) ids.add(s.source_id);
    if (s?.seen_during_development !== false) issues.push('SOURCE_NOT_BLIND');
    if (!s?.sha256 || !/^[a-f0-9]{64}$/i.test(s.sha256)) issues.push('SOURCE_HASH_MISSING');
    if (s?.ground_truth_count == null || !Number.isSafeInteger(s.ground_truth_count) || s.ground_truth_count < 1) issues.push('INVALID_GROUND_TRUTH_COUNT');
    if (s?.reconciled_count !== s?.ground_truth_count) issues.push('OFFERS_NOT_RECONCILED');
  }
  const c = e?.critical_errors || {};
  for (const field of ['wrong_price_silent','wrong_supplier_silent','wrong_variant_silent','missing_offer_silent','unsafe_auto_promotion']) {
    if (!Number.isSafeInteger(c[field]) || c[field] !== 0) issues.push('CRITICAL_ERROR_' + field);
  }
  if (e?.review_queue_verified !== true) issues.push('REVIEW_QUEUE_UNVERIFIED');
  if (e?.cross_tenant_isolation_verified !== true) issues.push('TENANT_ISOLATION_UNVERIFIED');
  return { passed: issues.length === 0, issues: [...new Set(issues)] };
}

if (require.main === module) {
  if (!process.argv[2]) {
    console.error('Usage: node gate_unseen_suppliers_v1.js evidence.json');
    process.exitCode = 2;
  } else {
    try {
      const evidence = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
      const result = checkEvidence(evidence);
      console.log(JSON.stringify({ gate: 'UNSEEN_SUPPLIERS_V1', ...result }));
      if (!result.passed) process.exitCode = 1;
    } catch (err) {
      console.error(err.message);
      process.exitCode = 2;
    }
  }
}
module.exports = {checkEvidence};
