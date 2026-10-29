# TREE | WM-03.4c — Privileged staging test logins deleted
Date: 2026-10-29
Owner: Chat B / PR #201

## Authorization and scope
User explicitly authorized deletion ONLY of `pch_staging_a_login` and `pch_staging_b_login` in the isolated Neon project `purple-violet-98259937`, default branch `br-blue-boat-b6tz24so`.

## Execution
Called Neon delete_postgres_role for both names on that project/branch. Both calls completed without error.
Read-only PostgreSQL `pg_roles` verification after calls found neither name.

## Preserved objects
`pch_runtime_a_sql`, `pch_runtime_b_sql` retained and verified: both `rolcanlogin=false`, `rolbypassrls=false`, no membership in `pg_read_all_data`.
`ingress_events`, `ingress_outbox`, `ingress_tenant_role_bindings` retain `relrowsecurity=true`, `relforcerowsecurity=true`.

## Gate
Privileged test login remediation: PASS for these two accounts.
SQL role A/B selective read: PASS limited (previous checkpoint).
Independent authenticated restricted LOGIN A/B: NOT_RUN.
Cross-tenant write denial: NOT_RUN.
Node driver concurrency and Meta HTTPS webhook: NOT_RUN.
Production: NO-GO.

Next: provision non-bypass scoped SQL login credentials securely and test using distinct authenticated connections, avoiding Neon API-created default privileged roles.
