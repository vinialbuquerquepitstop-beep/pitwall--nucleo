# TREE | WM-03.4c — Cloud-admin membership interpretation corrected
Date: 2026-10-29
Owner: Chat B | PR #201 | Neon staging purple-violet-98259937

## Why this checkpoint
The previous checkpoint treated two remaining cloud_admin-granted administrative memberships as an unresolved security issue. This update checks their actual PostgreSQL 17 membership options and corrects the interpretation.

## Live evidence
pg_auth_members query, neondb_owner member of pch_runtime_a_sql and pch_runtime_b_sql, grantor cloud_admin:
- admin_option = true
- inherit_option = false
- set_option = false

pg_roles and pg_has_role cross-check:
- pch_runtime_a_sql / pch_runtime_b_sql both NOLOGIN and NOBYPASSRLS
- neither role member of pg_read_all_data
- pg_has_role('neondb_owner', role, 'usage') = false for both
- pg_has_role('neondb_owner', role, 'set') = false for both

This reflects a non-inheritable, non-settable administrative membership. It is NOT a direct capability to SELECT other tenants' rows using application identity, nor is its persistence alone a fail. Prior revokes did not remove it because the grantor was cloud_admin. Do not attempt to bypass or change cloud_admin's managed administrative grants.

## Security conclusion
The previous blocker 'owner has 2 role memberships' is resolved as an interpretation issue: they remain, but neither automatically inherit nor permit SET ROLE to tenant roles. Do not claim that the database owner's broader administrative rights are restricted by RLS; owner credentials must never be used for app runtime.

The previous explicit privileged Neon API-created LOGIN test roles were deleted and verified absent. Synthetic read A/B tests using temporary SET LOCAL ROLE passed selectively.

## Still missing
- Independent SQL-created, non-bypass LOGIN credentials A/B managed by a secure secret manager.
- Negative cross-tenant INSERT and UPDATE, as well as positive same-tenant writes under independently authenticated login sessions.
- Node pg driver genuine concurrent delivery with least privilege.
- Reviewed policy version + migration parity; retention and protected content.
- HTTPS Meta webhook end-to-end.

## Gate
Admin membership interpretation: REVIEWED, NO ACTION REQUIRED
RLS structural flags: PASS
SQL test-role selective read: PASS limited
Independent workload A/B: NOT_RUN
PG concurrency / Meta webhook / production: NO-GO
