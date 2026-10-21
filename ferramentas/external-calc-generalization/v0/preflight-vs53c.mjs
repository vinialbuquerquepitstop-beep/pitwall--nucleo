#!/usr/bin/env node
// VS5.3c: static preflight only. No network, DB, tokens, or production writes.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(new URL('../../../',import.meta.url).pathname);
const paths={
 reviewSql:'supabase/migrations/20260919231000_external_calc_c01_review_candidate_v0.sql',
 lifecycleSql:'supabase/migrations/20260919_external_calc_lifecycle_persistence_v0.sql',
 candidateRepo:'ferramentas/external-calc-c01-review/v0/postgres-review-candidate-repository.js',
 runtime:'ferramentas/external-calc-runtime/v0/runtime.js',
 preview:'ferramentas/external-calc-generalization/v0/preview-api-shadow.cjs',
 service:'ferramentas/external-calc-generalization/v0/service-preview-contract.cjs',
 identity:'ferramentas/external-calc-generalization/v0/identity-bridge-shadow.cjs'
};
const files=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,readFileSync(resolve(root,p),'utf8')]));
const checks={
 review_rls_declared:/alter table public\.extcalc_review_candidate enable row level security/iu.test(files.reviewSql),
 review_tenant_scoped:/tenant_id\s*=\s*privado\.fn_tenant_atual\(\)/iu.test(files.reviewSql),
 review_owner_only:/privado\.fn_papel_atual\(\)\s*=\s*'dono'/iu.test(files.reviewSql),
 candidate_read_has_tenant_filter:files.candidateRepo.includes("tenant_id: "),
 worker_exports_identity:/module\.exports\s*=\s*\{[\s\S]*?resolveIdentity/iu.test(files.runtime),
 preview_not_registered_in_worker:!files.runtime.includes('/experimental/preview'),
 preview_body_restricts_fields:files.preview.includes("keys[0]!=='trusted_input_ref'"),
 service_requires_tenant_match:files.service.includes('resolved.tenant_id!==tenant'),
 identity_reuses_worker:files.identity.includes("require('../../external-calc-runtime/v0/runtime')"),
 lifecycle_tenant_scope:files.lifecycleSql.includes('primary key (tenant_id, analysis_id, offer_id)')
};
const failures=Object.keys(checks).filter(k=>!checks[k]);
const blockers=[
 'ORIGINAL_SUPPLIER_SOURCE_RLS_CONTRACT_UNKNOWN',
 'ISOLATED_STAGING_SUPABASE_NOT_VERIFIED',
 'TWO_REAL_STAGING_JWT_TENANTS_NOT_TESTED',
 'REAL_RLS_DENY_ALLOW_REVOKE_NOT_TESTED',
 'EXISTING_C01_QUARANTINE_UNRESOLVED'
];
const report={
 contract_version:'external-calc-vs53c-staging-preflight/v0',
 mode:'STATIC_REPOSITORY_ONLY',network_calls:0,database_writes:0,
 checks,failures,blockers,production_gate:'NO_GO',
 decision:failures.length?'STATIC_AUDIT_FAIL':'STATIC_AUDIT_PASS_REAL_RLS_BLOCKED',
 explanation:'SQL source is not evidence that deployed RLS applies to trusted_input_ref supplier content.'
};
if(process.argv[2]==='--output'&&process.argv[3])
 writeFileSync(resolve(process.argv[3]),JSON.stringify(report,null,2)+'\n');
console.log('VS53C_PREFLIGHT='+report.decision+' checks='+Object.keys(checks).length+
 ' failed='+failures.length+' blockers='+blockers.length+' real_rls=NOT_RUN');
if(failures.length)process.exitCode=1;
