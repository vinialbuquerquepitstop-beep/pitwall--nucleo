'use strict';

const { execFileSync } = require('node:child_process');

const OWNERS = [
  { owner: 'C01_REVIEW', patterns: [/^ferramentas\/external-calc-c01-review\/v0\//] },
  { owner: 'RUNTIME', patterns: [/^ferramentas\/external-calc-runtime\/v0\//] },
  { owner: 'PROOF_GOVERNANCE', patterns: [/^ferramentas\/external-calc-proof-governance\/v1\//, /^docs\/calculadora\/EXTERNAL_CALC_PROOF_GOVERNANCE_V1\.md$/, /^docs\/calculadora\/BRAIN_CHECKPOINT_EXTERNAL_CALC_PROOF_GOVERNANCE_2026_09_22\.md$/] },
  { owner: 'ACCESS_CONTROL_DOCS', patterns: [/^docs\/calculadora\/EXTERNAL_CALC_ACCESS_CONTROL_MANAGER_SELLER_PLAN_V1\.md$/] },
  { owner: 'WORKFLOW_GOVERNANCE', patterns: [
    /^\.github\/workflows\/external_calc_c01_review_queue_api_v0\.yml$/,
    /^\.github\/workflows\/external_calc_c01_review_runtime_api_v0\.yml$/,
    /^\.github\/workflows\/external_calc_c01_review_candidate_persistence_v0\.yml$/,
    /^\.github\/workflows\/external_calc_c01_review_authority_core_v0\.yml$/,
    /^\.github\/workflows\/external_calc_authority_runtime_binding_v0\.yml$/,
    /^\.github\/workflows\/external_calc_runtime_postgres_v0\.yml$/,
    /^\.github\/workflows\/external_calc_authority_production_config_v0\.yml$/,
    /^\.github\/workflows\/external_calc_proof_governance_v1\.yml$/
  ] }
];

function classifyFiles(files) {
  const classified = [];
  const unknown = [];
  for (const file of files.filter(Boolean)) {
    const owners = OWNERS.filter(entry => entry.patterns.some(pattern => pattern.test(file))).map(entry => entry.owner);
    if (!owners.length) unknown.push(file);
    else classified.push({ file, owners });
  }
  return { classified, unknown, requiredOwners: [...new Set(classified.flatMap(x => x.owners))].sort() };
}

function changedFiles() {
  if (process.env.PROOF_GOVERNANCE_CHANGED_FILES) {
    return process.env.PROOF_GOVERNANCE_CHANGED_FILES.split('\n').map(x => x.trim()).filter(Boolean);
  }
  try { execFileSync('git', ['fetch', 'origin', 'main'], { stdio: 'ignore' }); } catch {}
  let base = 'origin/main';
  try { execFileSync('git', ['rev-parse', '--verify', base], { stdio: 'ignore' }); }
  catch { base = 'HEAD^'; }
  return execFileSync('git', ['diff', '--name-only', base + '...HEAD'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
}

if (require.main === module) {
  const result = classifyFiles(changedFiles());
  for (const item of result.classified) console.log('OWNED ' + item.file + ' -> ' + item.owners.join(','));
  console.log('REQUIRED_OWNERS=' + result.requiredOwners.join(','));
  if (result.unknown.length) {
    for (const file of result.unknown) console.error('UNOWNED_CHANGE=' + file);
    console.error('PROOF_GOVERNANCE_V1=STRUCTURAL_REVIEW_REQUIRED');
    process.exit(1);
  }
  console.log('PROOF_GOVERNANCE_SCOPE_V1=PASS');
}

module.exports = { classifyFiles, OWNERS };
