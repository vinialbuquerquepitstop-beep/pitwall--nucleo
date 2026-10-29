# TREE | WM-03.4c Privileged login remediation gate
Date: 2026-10-29
Scope: Neon isolated staging project purple-violet-98259937 only.

## Verified facts
SQL roles pch_runtime_a_sql / pch_runtime_b_sql are NOLOGIN, NOBYPASSRLS and not members of pg_read_all_data. Previous real SELECT proof using transaction-scoped SET ROLE showed A can see synthetic A fixture and B cannot.
API-provisioned LOGIN roles pch_staging_a_login / pch_staging_b_login remain LOGIN=true, BYPASSRLS=true, pg_read_all_data membership=true. They must NEVER be used as application credentials.
Attempted ALTER ROLE ... NOLOGIN for both using database owner: permission denied to alter role; no change applied.
Attempted cross-tenant negative INSERT under restricted role, but tool security rejected the call before valid proof; NOT_RUN. Do not report it as SQL denial.

## Security decision
No real customer or supplier data, no webhooks, no deployment and no production gate.
Two privileged login roles require explicit authorized deletion or Neon administrative disablement and credential rotation. Deleting roles is destructive, so do not execute without the user's explicit instruction identifying the two test roles.
For authentic workload access create two SQL-defined LOGIN roles with NOBYPASSRLS, strong credentials stored only in an approved secret manager, independent connection tests and role-policy review. An account default that includes BYPASSRLS cannot satisfy the gate.

## Next gates
1. Remove/disable both privileged test logins using authorized Neon administration.
2. Prove role attributes, connectivity and tenant identity from distinct non-owner authenticated DB sessions.
3. Pass positive same-tenant and negative cross-tenant SELECT/INSERT plus real PostgreSQL concurrent insert tests.
4. Only then enable signed Meta webhook staging with durable-commit ACK semantics.

Status: A/B READ TEST PASS LIMITED; PRIVILEGED LOGINS ACTIVE; WRITE NEGATIVE NOT_RUN; RELEASE NO-GO.
