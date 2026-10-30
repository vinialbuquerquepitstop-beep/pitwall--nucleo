# TREE WM-03.4c — RLS role workaround verified in isolated staging
Date: 2026-10-29
Neon project: purple-violet-98259937 (pitstop-connect-hub-ingress-staging)
Owner: Chat B / PR #201

## Root cause
The two roles provisioned using Neon create_postgres_role API (`pch_staging_a_login`, `pch_staging_b_login`) have `rolbypassrls=true` and inherit `pg_read_all_data`. Their previous authenticated reads exposed cross-tenant synthetic records. Direct GRANT revocation did not remove the inherited privileges. Those two login roles remain unsafe and MUST NOT be used.

## Alternative executed
Created two NON-LOGIN SQL PostgreSQL roles:
- `pch_runtime_a_sql` tenant binding `pch_runtime_a_tenant`
- `pch_runtime_b_sql` tenant binding `pch_runtime_b_tenant`
Both roles have `rolbypassrls=false`, `pg_read_all_data=false` and no login. Extended existing staging RLS policies and narrow table grants to these roles.

## Live proof
Used transaction-scoped temporary membership granted to staging database owner, `SET LOCAL ROLE`, select under resulting `current_user`, then RESET ROLE + REVOKE membership in same transaction.
A read: own tenant bindings = 1; before synthetic insertion visible ingress events = 0.
B read: own tenant bindings = 1; visible ingress events = 0.
Inserted synthetic event with `tenant_binding_ref='pch_runtime_a_tenant'` via staging owner as a fixture.
A read: `current_user=pch_runtime_a_sql`, visible event count for isolation_proof_a = 1, own binding count = 1.
B read: `current_user=pch_runtime_b_sql`, visible event count for isolation_proof_a = 0, own binding count = 1.
The test confirms RLS selective reads when `current_user` is a constrained role. It does NOT prove authenticated independent connections, cross-tenant INSERT refusal, service JWT authentication, long-running worker permissions, or all INSERT/UPDATE policies.

## Remediation remaining
1. Existing API-created test logins stay dangerous: administrator must delete or revoke credentials and ensure they cannot access sensitive future content. Do not use in deployed services.
2. Provision proper LOGIN roles by *direct SQL* with `NOBYPASSRLS` and strong independent credentials managed in an approved secret manager. Neon API default privileges are not acceptable for ingestion workload.
3. Apply reviewed final migrations for RLS policies, GRANTs, account-to-tenant binding and migration tracking. Restrict policy target roles and review cross-table RLS.
4. Prove real independent connection A/B, cross-tenant write denied, replay, concurrent ingest and delivery worker isolation.
5. Do not connect Meta callback, real messages, or commercial number yet.

## Gate
Root cause: IDENTIFIED
Non-login constrained SQL roles: PASS privileges
SQL role simulation for A/B SELECT: PASS limited
Authentic workload login A/B: NOT_RUN
Real HTTP Meta callback: OFF
Production: NO-GO
