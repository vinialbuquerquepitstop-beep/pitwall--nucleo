# TREE | WM-03.4e — PostgreSQL concurrency integration runner gate
Date: 2026-10-29
Owner: Chat B, PR #201

## Added
`ferramentas/external-calc-whatsapp/v0/proof-ingress-postgres-integration-v0.cjs`, commit `c8d5d258b366bcf43f91a435c1014fad4af11cc1`.

Runner uses the real checked-in Node `acceptIngress` and PostgreSQL `pg` pool with 12 overlapping synthetic provider deliveries and an altered-content replay. Requires a dedicated staging credential via `PCH_STAGING_DATABASE_URL` and a server-authorized `PCH_AUTHORIZED_TENANT_BINDING`. Does not print secrets. Initial checks reject the owner role and require RLS + FORCE RLS on both tables and at least two policies.

## Current execution
NOT_RUN: administrative creation of roles/policies previously blocked by security controls. Prior read-only audit: zero tenant roles, zero RLS policies and RLS off on both tables. No bypass or DB change attempted here.

## Scope and limitations
Passing runner later proves one authenticated connection role and live concurrency behavior under configured policies. Two-tenant isolation still requires separate independently authenticated tenant A and B credentials plus positive/negative cross-tenant tests. This runner is not a substitute for that gate.
Synthetic data is intentionally written on successful run; staging cleanup/retention policy must be settled. Real callback Meta remains off.

## Gates
Runner committed: PASS
Runner executed: NOT_RUN
Real PG concurrency: NOT_RUN
Tenant A/B RLS: BLOCKED
M2M/Meta integration: NOT_RUN
Production: NO-GO

## Next
An authorized administrator approves and provisions non-owner roles and RLS policies on the isolated Neon project. Then run exact-source tests and capture stdout/exit code; prove cross-tenant A/B and safely reconcile synthetic test data. Never run using privileged database owner credentials.
