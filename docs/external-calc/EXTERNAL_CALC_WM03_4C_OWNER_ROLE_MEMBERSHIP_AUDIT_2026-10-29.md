# TREE | WM-03.4c Role membership audit — 2026-10-29
Repository PR #201. Neon isolated staging project purple-violet-98259937.

## Live checks
`pch_runtime_a_sql` and `pch_runtime_b_sql` remain NOLOGIN, NOBYPASSRLS; old privileged API logins `pch_staging_a_login`, `pch_staging_b_login` remain deleted.
Transaction-scoped `SET LOCAL ROLE` under A returned own binding=1, synthetic A event=1; B returned own binding=1, synthetic A event=0. This is a limited selective-READ proof, not independent authenticated application connections.
Post-test pg_auth_members audit unexpectedly returned two memberships from `neondb_owner` to the two test roles, granted by `cloud_admin`, `admin_option=true`.
Attempted `REVOKE pch_runtime_a_sql FROM neondb_owner` and same for B as owner returned success but following catalog query STILL returned two memberships. Do not claim cleanup occurred. Membership removal requires Neon/cloud_admin policy review and proof.
No production DB, F1, CRM, commercial number, or Meta webhook modified.

## Decision
Partial A/B read gate: PASS limited.
Authorized scoped independent LOGIN credentials: NOT_PROVISIONED.
Owner grant cleanup: UNRESOLVED (2 memberships remain).
Cross-tenant INSERT negative: NOT_RUN.
Real Node+PG concurrency: NOT_RUN.
Overall security release: NO-GO.

## Next
Use Neon administrative route to identify and clean `cloud_admin` granted memberships, or establish that membership behavior is a documented Neon managed invariant that cannot be removed and that no application identity inherits it. Keep administrator out of webhook runtime. Provision non-bypass SQL-created login identities with dedicated secrets in a managed vault, prove all role attributes, independent connects and tenant A/B read/write negatives. Do not retry the same ambiguous REVOKE while claiming success.
