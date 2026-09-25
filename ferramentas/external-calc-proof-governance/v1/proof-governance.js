'use strict';

const { execFileSync } = require('node:child_process');

const OWNERS = [
  { owner: 'C03_RESEARCH_EVIDENCE', patterns: [
    /^ferramentas\/external-calc-research-provider\/v0\//,
    /^docs\/calculadora\/EXTERNAL_CALC_C03_CURRENT_OFFERS_EVIDENCE_SOURCE_V0\.md$/
  ] },
  { owner: 'EXECUTION_AUTHORITY', patterns: [
    /^ferramentas\/external-calc-authority\/v0\//
  ] },
  { owner: 'C02_CALCULATION', patterns: [/^ferramentas\/external-calc-c02\/v1\//] },
  { owner: 'STORE_RATE_PROFILE_PERSISTENCE', patterns: [
    /^supabase\/migrations\/20260922230000_external_calc_user_rate_profile_persistence_v1\.sql$/,
    /^supabase\/migrations\/20260922233000_external_calc_store_rate_profile_correction_v1\.sql$/,
    /^ferramentas\/external-calc-user-rate\/v1\//,
    /^ferramentas\/external-calc-store-rate\/v1\//,
    /^docs\/calculadora\/EXTERNAL_CALC_USER_RATE_PROFILE_BACKEND_IMPLEMENTATION_V1\.md$/,
    /^docs\/calculadora\/EXTERNAL_CALC_STORE_RATE_PROFILE_BACKEND_IMPLEMENTATION_V1\.md$/,
    /^docs\/calculadora\/EXTERNAL_CALC_PRODUCTION_STATUS_2026_09_22_V1\.md$/
  ] },
  { owner: 'TRADE_IN_POLICY', patterns: [
    /^supabase\/migrations\/20260923052000_external_calc_store_trade_in_policy_v0\.sql$/,
    /^supabase\/migrations\/20260923053000_external_calc_store_trade_in_policy_indexes_v0\.sql$/,
    /^ferramentas\/external-calc-trade-in\/v0\//,
    /^docs\/calculadora\/EXTERNAL_CALC_STORE_TRADE_IN_POLICY_GATE_V0\.md$/
  ] },
  { owner: 'SALES_PRODUCT_T04', patterns: [
    /^ferramentas\/external-calc-sales-product\/v0\//,
    /^supabase\/migrations\/20260923061000_external_calc_sales_product_context_v0\.sql$/
  ] },
  { owner: 'BETA_STORE_TEAM_ACCESS', patterns: [
    /^supabase\/migrations\/20260922213000_external_calc_beta_store_team_access_v0\.sql$/,
    /^ferramentas\/external-calc-access\/v0\/prova_beta_store_team_access_v0\.js$/,
    /^docs\/calculadora\/EXTERNAL_CALC_BETA_STORE_TEAM_ACCESS_V0\.md$/
  ] },
  { owner: 'MODEL_STORAGE_SEPARATION', patterns: [
    /^ferramentas\/interpreter-core\/v1\/domains\/apple-iphone-v0\.knowledge\.json$/,
    /^ferramentas\/external-calc-c01\/v1\/c01-readonly-bridge\.js$/,
    /^ferramentas\/external-calc-c01\/v1\/prova_c01_readonly_bridge\.js$/,
    /^docs\/calculadora\/EXTERNAL_CALC_MODEL_STORAGE_SEPARATION_GATE_V0\.md$/
  ] },
  { owner: 'HUMAN_REVIEW_LEARNING_CAPTURE', patterns: [
    /^supabase\/migrations\/20260922194500_external_calc_human_review_learning_capture_v0\.sql$/,
    /^docs\/calculadora\/EXTERNAL_CALC_HUMAN_REVIEW_LEARNING_CAPTURE_V0\.md$/
  ] },
  { owner: 'C01_REVIEW_EVIDENCE', patterns: [
    /^ferramentas\/external-calc-c01\/v1\/c01-readonly-bridge\.js$/,
    /^ferramentas\/external-calc-c01\/v1\/prova_c01_readonly_bridge\.js$/,
    /^docs\/calculadora\/EXTERNAL_CALC_C01_REVIEW_EVIDENCE_GATE_V0\.md$/
  ] },
  { owner: 'C01_REVIEW', patterns: [
    /^ferramentas\/external-calc-c01-review\/v0\//,
    /^supabase\/migrations\/20260922184500_external_calc_c01_review_pending_queue_v0\.sql$/,
    /^docs\/calculadora\/EXTERNAL_CALC_C01_REVIEW_PENDING_QUEUE_GATE_V0\.md$/
  ] },
  { owner: 'AI_ADVISOR', patterns: [
    /^ferramentas\/external-calc-ai-advisor\/v0\//,
    /^docs\/calculadora\/EXTERNAL_CALC_AI_ADVISOR_A1_GATE_V0\.md$/,
    /^docs\/calculadora\/EXTERNAL_CALC_AI_ADVISOR_A2_EXECUTION_GATE_V0\.md$/,
    /^docs\/calculadora\/EXTERNAL_CALC_AI_ADVISOR_A3_RUNTIME_PERSISTENCE_GATE_V0\.md$/,
    /^docs\/calculadora\/EXTERNAL_CALC_AI_ADVISOR_A31_PRODUCTION_ACTIVATION_V0\.md$/,
    /^docs\/calculadora\/EXTERNAL_CALC_AI_ADVISOR_A4_OPENAI_RUNTIME_GATE_V0\.md$/,
    /^docs\/calculadora\/EXTERNAL_CALC_AI_ADVISOR_A41_PRODUCTION_ACTIVATION_V0\.md$/,
    /^supabase\/migrations\/20260925003500_external_calc_ai_advisor_a3_v0\.sql$/
  ] },
  { owner: 'RUNTIME', patterns: [/^ferramentas\/external-calc-runtime\/v0\//, /^worker\/external-calc-worker\.mjs$/, /^wrangler\.jsonc$/] },
  { owner: 'PROOF_GOVERNANCE', patterns: [/^ferramentas\/external-calc-proof-governance\/v1\//, /^docs\/calculadora\/EXTERNAL_CALC_PROOF_GOVERNANCE_V1\.md$/, /^docs\/calculadora\/BRAIN_CHECKPOINT_EXTERNAL_CALC_PROOF_GOVERNANCE_2026_09_22\.md$/] },
  { owner: 'ACCESS_CONTROL_DOCS', patterns: [/^docs\/calculadora\/EXTERNAL_CALC_ACCESS_CONTROL_MANAGER_SELLER_PLAN_V1\.md$/] },
  { owner: 'WORKFLOW_GOVERNANCE', patterns: [
    /^\.github\/workflows\/external_calc_c01_review_queue_api_v0\.yml$/,
    /^\.github\/workflows\/external_calc_c01_review_runtime_api_v0\.yml$/,
    /^\.github\/workflows\/external_calc_c01_review_candidate_persistence_v0\.yml$/,
    /^\.github\/workflows\/external_calc_c01_review_result_persistence_v0\.yml$/,
    /^\.github\/workflows\/external_calc_c01_review_authority_core_v0\.yml$/,
    /^\.github\/workflows\/external_calc_authority_runtime_binding_v0\.yml$/,
    /^\.github\/workflows\/external_calc_product_execution_authority_v0\.yml$/,
    /^\.github\/workflows\/external_calc_runtime_postgres_v0\.yml$/,
    /^\.github\/workflows\/external_calc_authority_production_config_v0\.yml$/,
    /^\.github\/workflows\/external_calc_proof_governance_v1\.yml$/,
    /^\.github\/workflows\/external_calc_cloudflare_g4\.yml$/,
    /^\.github\/workflows\/external_calc_beta_store_team_v0\.yml$/,
    /^\.github\/workflows\/external_calc_user_rate_profile_persistence_v1\.yml$/,
    /^\.github\/workflows\/external_calc_store_rate_profile_persistence_v1\.yml$/,
    /^\.github\/workflows\/external_calc_store_rate_profile_resolver_c02_g3\.yml$/,
    /^\.github\/workflows\/external_calc_store_rate_profile_g4_api\.yml$/,
    /^\.github\/workflows\/external_calc_store_trade_in_policy_v0\.yml$/,
    /^\.github\/workflows\/external_calc_ai_advisor_a1\.yml$/,
    /^\.github\/workflows\/external_calc_ai_advisor_a2\.yml$/,
    /^\.github\/workflows\/external_calc_ai_advisor_a3\.yml$/,
    /^\.github\/workflows\/external_calc_ai_advisor_a4\.yml$/,
    /^\.github\/workflows\/external_calc_ai_advisor_a41_production\.yml$/,
    /^\.github\/workflows\/external_calc_research_provider\.yml$/,
    /^\.github\/workflows\/external_calc_simular_venda_t04\.yml$/
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
