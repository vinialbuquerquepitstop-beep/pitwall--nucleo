# WM-01/G5 — External Calc PCH Receiver Shadow | 2026-11-09

Status: ISOLATED IMPLEMENTATION, NOT DEPLOYED OR HOMOLOGATED.

Baseline: `pitwall--nucleo` main `83ebc3a6e83b89a2c1f6e726092b335bfef7745c`.
Branch: `feature/wm01-g5-receiver-shadow-20261109`.

## Implemented
- `receiver-shadow.js`: pure ingestion contract boundary, no HTTP handler, no DB or networking. Explicit trusted server-side `actor` with PCH producer, tenant and ingress permission required. Reject unknown event fields, identity mismatch, wrong hash, malformed dates. Normalizes `META_PRIVATE` and `GROUP_CONNECTOR`.
- Receiver requires injected `repository.acceptAtomic(prepared)`, which is NOT implemented. It returns receipt only for an accepted record with matching tenant, event, key, digest. Calls no commercial list interpreter.
- `receiver-shadow.test.js`: 16 offline Node test cases with a simulated in-memory repository; not a PostgreSQL concurrency or durable commit proof. Run from directory using `node --test receiver-shadow.test.js` and record actual evidence; no pass claimed before execution.

## Required atomic persistent repository contract
1. Authenticate service in HTTP/router middleware using a platform-approved machine identity, not an end-user Bearer. Resolve tenant and permissions server-side.
2. Reject conflicting immutable metadata on re-delivery. Unique key: `tenant_id, producer_scope, ingress_event_id`. Provider message ID and source ID must be scoped to provider/tenant for collision and authorization review. Treat duplicate as accepted only with full identical immutable record, not merely identical digest.
3. Store encrypted payload reference, encrypted/raw provenance separately with minimal privileged access, strong at-rest controls, audit, retention and RLS. Do not store unencrypted message content in logs.
4. Atomic transaction: insert inbox, receipt and audit; only acknowledge after COMMIT. No partial acceptance. Conflict => 409 with no state mutation.
5. Authenticated status/receipt lookup by idempotency key; never expose receipt cross-tenant. Receipt ID is persisted, not generated anew on retry.
6. Release to commercial review is independent from transport acceptance. No C01 auto-promotion or execution of existing `processListIntakeCommand` at ingestion time.
7. Under failed COMMIT, do not return an accepted receipt. After lost network ACK, reconcile by querying persisted receipt; prohibit blind duplicate promotion.
8. Confirm permissions/GRANT/RLS with dedicated read/write role and separate migration gate. Prove concurrency on real Postgres and recovery before integrating PCH Outbox.

## Explicit non-goals
No migration, no deployment, no Meta app publishing, no QR pairing, no PCH Worker import, no real WhatsApp messages, no processing historical 4 HOLD rows. Adapter remains invisible to users and does not grant runtime service authorization.

## Gate checklist
- Pure core and tests authored: YES.
- GitHub file readback: pending.
- Node test execution: pending.
- Real database repository + atomic receipts: NOT IMPLEMENTED.
- Production/Cloudflare/API integration: NOT IMPLEMENTED.
