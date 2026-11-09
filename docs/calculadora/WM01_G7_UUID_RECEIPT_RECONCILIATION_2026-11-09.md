# WM-01/G7 | UUID tenant and read-only receipt reconciliation | 2026-11-09

Status: CODE READY FOR LOCAL REGRESSION / NOT DEPLOYED / NOT DATABASE-HOMOLOGATED.

## Changes on isolated branch
- Aligned the shadow receiver's tenant identity to canonical PostgreSQL UUID, rather than arbitrary text. Existing G5/G6 test fixtures now use UUIDs.
- Updated schema candidate (explicitly NOT APPLY) to `tenant_id uuid`, with RLS enabled and forced but no policy/grants. The schema remains deliberately non-functional until approved role/RLS strategy.
- Added `repository.findReceipt(prepared)` with tenant+idempotency-key scoped parameterized SELECT and immutable field comparison; no data mutation.
- Added `reconcileIngress` to perform the same server-supplied actor and event validation as acceptance, returning a matching durable receipt or NOT_FOUND_RECONCILE_REQUIRED.
- Added 8 offline test definitions for lookup success, missing receipt, mismatch, unauthorized actor, cross-tenant, invalid UUID, missing repository and connection release.
- 16 original receiver tests + 7 G6 repository mocks + 8 G7 reconciliation tests = **31 test definitions**. Execution has not been proven; do not claim 31/31 PASS.

## Security caveats
- The pure module's `actor.authenticated` flag is NOT a security boundary; no HTTP service authentication exists. Future middleware must derive actor and tenant exclusively from trusted credentials and binding.
- The repository's query tenant filter is defense in depth. Database role and effective tenant RLS must be designed, verified and approved; no user session or overly privileged service-role bypass.
- Schema tenant UUID correction does not alone establish correct PCH-to-Calc tenant binding. That requires external trusted mapping and multi-tenant tests.
- On loss of COMMIT ACK, a best-effort ROLLBACK is not proof the transaction did not commit. Caller must perform authenticated read-only lookup and avoid treating absence immediately as permission for unsafe commercial replay.
- Outbox worker, HTTP receiver, encrypted payload ownership and actual receipt durability not yet implemented or exercised.
- Existing list-intake auto-promotes some candidates; acceptance does NOT trigger it.

## Reproduction plan
On a checkout of this branch:
`cd ferramentas/external-calc-pch-receiver/v0`
`node --test receiver-shadow.test.js postgres-receiver-shadow.test.js receipt-reconciliation-shadow.test.js`

Expected 31 definitions, not a verified PASS. Test on disposable PostgreSQL 17 with least-privilege role only after schema/RLS review. Supply connection via secure local configuration, not credentials in docs.

## Prohibited activation
No merge, deploy, migration, live data, Meta publish, QR pairing, or handling of four PCH HOLD messages.
