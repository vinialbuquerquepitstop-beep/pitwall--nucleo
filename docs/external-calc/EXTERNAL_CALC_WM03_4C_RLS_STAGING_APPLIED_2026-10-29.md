# TREE | WM-03.4c — RLS staging migration, 2026-10-29

## Authorization
The user explicitly authorized RLS configuration for the isolated staging database, not production or other systems.

## Environment
Neon project `purple-violet-98259937`, `pitstop-connect-hub-ingress-staging`.

## Applied in a single database transaction
- Created NOLOGIN, NOBYPASSRLS test roles `pch_tenant_a_test`, `pch_tenant_b_test`.
- Created role-to-tenant mapping table `ingress_tenant_role_bindings` with synthetic bindings.
- Enabled and forced RLS for `ingress_events`, `ingress_outbox`, and `ingress_tenant_role_bindings`.
- Added policies `pch_ingress_tenant`, `pch_outbox_tenant`, `pch_tenant_binding_select`.
- Granted SELECT/INSERT on event and outbox to the two roles, SELECT on binding table; did not create external login credentials.

## Post-apply read evidence
`pg_class` returned `relrowsecurity=true` and `relforcerowsecurity=true` for all three tables.
`pg_policies` returned three policies explicitly scoped to the two test roles.

## Execution blocker
Attempt to run `SET LOCAL ROLE pch_tenant_a_test` within a transaction was rejected:
`permission denied to set role "pch_tenant_a_test"`.
This is NOT proof that cross-tenant read/write is denied under independently authenticated tenant credentials. Administrative owner was not given membership or BYPASSRLS to circumvent the access control.

## Audit notes
Roles are NOLOGIN test roles; application identities A/B are not provisioned. The current event/outbox policy references other RLS-protected tables and should be reviewed for recursion/permission implications. Existing application INSERT/UPDATE/DELETE privileges and transaction integration need explicit tests under actual scoped identities. The current SQL has not been committed as an approved, reproducible, reviewed migration; this checkpoint records observed live state only.

## Gates
- Live RLS/force flags: PASS structural
- Three policies present: PASS structural
- Two independent tenant role access tests: NOT_RUN
- Security review of policy effectiveness: NOT_RUN
- M2M/authenticated driver execution: NOT_RUN
- Meta webhook: OFF
- Production: NO-GO

Next: review per-role login/service binding and authorized independent testing, inspect RLS behavior under actual workload credentials; keep webhook disconnected.
