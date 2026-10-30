# TREE | WM-03.4e — Security review of real PostgreSQL proof runner
Date: 2026-10-29
Owner: Chat B / PR #201
Code fix commit: `637950d47d844412027e5ed8196d7c6071fba87f`

## Findings and fixes
Inspected actual runner `proof-ingress-postgres-integration-v0.cjs` in branch.
1. Previous `try/finally` started after DB probe and security gates, so pool remained open on gate errors. Wrapped all DB use in `try/finally { await pool.end() }`.
2. Previous preflight rejected role by literal name `neondb_owner` and checked RLS/policy counts, but did not reject other bypass roles or owner membership. Added `rolbypassrls` and `pg_has_role(current_user, relowner, 'member')` for target tables.

## Execution / limits
Commit confirmed via GitHub fetch after change. PostgreSQL integration runner not executed, since previous live audit recorded 0 per-tenant RLS policies, 0 test roles and RLS disabled. No alternate privilege path was attempted and no database configuration was changed.
A simple role/policy count is only a preflight, not proof of correct tenant-level RLS: tenant A/B authenticated connection tests still mandatory.
Further items to check in the authorized integration test: SQL migration parity, explicit unique constraints, real concurrent inserts, failure rollback, correct workload GRANT scopes, WABA receiver binding, and cross-tenant denial. The runner leaves synthetic test records for staging retention review.

## Gate
RUNNER_GUARDS_CODED / PG_E2E_NOT_RUN / RLS_AB_BLOCKED / META_CALLBACK_OFF / PRODUCTION_NO_GO.
