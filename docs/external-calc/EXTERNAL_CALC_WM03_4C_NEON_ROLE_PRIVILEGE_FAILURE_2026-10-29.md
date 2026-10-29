# WM-03.4c | SECURITY FAIL: Neon login roles bypass RLS
Date: 2026-10-29
Owner: Chat B / PR #201
Project: pitstop-connect-hub-ingress-staging, purple-violet-98259937

## Executed
Two independent Neon login roles were created using Neon API: pch_staging_a_login and pch_staging_b_login. Credentials were not committed to GitHub or printed to user. Created per-role synthetic tenant mappings and added relevant table policy targets.
Postgres live role_name queries under each independent login returned `current_user` matching requested role, but both could SELECT 4 binding records and 2 ingress rows (including data belonging to other scopes).
Privilege diagnostics from pg_roles:
- both rolbypassrls=true
- both pg_has_role(pg_read_all_data, member)=true
- neither owner membership
Attempt to ALTER ROLE ... NOBYPASSRLS failed with `permission denied to alter role`.
Direct SELECT/INSERT grants given to these roles were revoked, but read queries under these login roles still succeeded because privileged inherited membership remained. Thus the isolation gate is FAIL, not merely NOT_RUN.

## Scope and exposure
Only synthetic staging data was tested. No Meta callback or commercial number was connected, no other systems modified. Both privileged login roles currently exist in the isolated project, with password credentials managed by Neon, and require administrative deletion or privilege removal. Do not use them in workloads.
Do not deploy endpoint, store message content or customer/ supplier information, or treat enabled RLS as effective.

## Immediate remediation
Authorized Neon project administrator must remove/disable the two overprivileged test roles, or remove BOTH their BYPASSRLS and pg_read_all_data memberships with an authorized control, and re-provision nonprivileged credentials. Verify `rolbypassrls=false`, `pg_read_all_data=false`, negative cross-tenant queries and writes before gate approval. Do not attempt to bypass privileges with owner role.
No autonomous role deletion was performed.

Gate: RLS STRUCTURAL TRUE / AUTHENTICATED A-B SECURITY FAIL / PROD NO-GO.
