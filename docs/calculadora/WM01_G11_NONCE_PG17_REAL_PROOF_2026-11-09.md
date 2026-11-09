# WM-01/G11 | Durable nonce ledger and isolated internal adapter | 2026-11-09

## Verdict
**PASS: Node isolated regression (86/86)** and **PASS: real disposable PostgreSQL 17.11 nonce-ledger concurrency and restricted-role security (9/9)**. **HOLD: deploy/operational integration**.

## Reproducible evidence
Exact branch checkout tested: `1d58692a9b346fca2712f16afc67adc6f89a8592`.
Cloud: ephemeral Vercel sandbox on an existing External Calc project, region `gru1`. PostgreSQL 17.11 initialized solely inside the sandbox using a Unix socket; no public TCP listener, no connection to production.
- Node command: `node --test ferramentas/external-calc-pch-receiver/v0/*.test.js`. TAP result: 86 tests, 86 passed, 0 failed, exit 0, 632.970574 ms (last full run).
- PG17 schemas applied **only in disposable database**: `schema-shadow-NOT-APPLY.sql`, `rls-policy-shadow-NOT-APPLY.sql`, `nonce-ledger-schema-NOT-APPLY.sql`.
- PG17 proof: `PCH_DISPOSABLE_PG17=true NODE_PATH=... node ferramentas/external-calc-pch-receiver/v0/nonce-pg17-integration-proof.cjs` with disposable role `pch_test_login` (member of `extcalc_pch_ingress` and NOBYPASSRLS).
- PG17 result: **9 PASS, 0 FAIL, exit 0**, including initial nonce, replay rejection, 20 simultaneous duplicate attempts with one winner, 20 distinct nonces, tenant-missing row invisibility, DELETE/UPDATE denials, separate tenants with separate keys, same key/nonce cross-tenant collision, and 12 identical signed concurrent requests with one authorization and 11 failures.
- Confirmed `nonce_ledger` has row security enabled and forced (`true,true`).

## Code added
- `pg-nonce-ledger-shadow.js`: injected PostgreSQL pool, transaction-local tenant binding, unique key+nonce, atomic INSERT ... ON CONFLICT DO NOTHING, commit before success, rollback and release on failure.
- `nonce-ledger-schema-NOT-APPLY.sql`: append-only role access, FORCE RLS; manual and isolated only.
- `m2m-auth-shadow.js`: tenant UUID derived from authenticated key passed to nonceLedger.
- `internal-http-adapter-shadow.js`: unmounted transport adapter that verifies signed raw body, then invokes strict domain actor and receipt/inbox operations.
- `internal-http-adapter-shadow.test.js`: 13 tests. First Node run: 81 pass / 5 fail due strict domain actor rejecting transport-only keyId. Fixed by projecting exact trusted actor fields at the boundary (commit `6a19a1d`). Retest: 86/86 PASS.
- `nonce-pg17-integration-proof.cjs`: explicitly gated test-only PG17 proof.

## Limits and next gates
These tests do not demonstrate production service identity, real provider event capture, TLS/network access controls, secure key provisioning/rotation, encryption/retention, production-grade durable audit, or end-to-end Connect Hub Outbox delivery. Adaptador HTTP is NOT registered in a live router.
Nonce ledger is append-only without lifecycle cleanup. Current `key_id,nonce` key never permits replay, even after expiry; future retention cleanup must account for the replay window and key rotation. Dedicated key ID globally bound to one tenant is mandatory, with risk review if keys could be reused across tenants. A persistent production keyring is not implemented.
The nonce reserve commits before the inbox write; after a crash, the same signed request cannot be reused. PCH must use a **new signed nonce**, with authenticated read-only receipt reconciliation first. Do not assume rollback or retry safety after an unknown COMMIT state.
There is no network adapter for the PCH producer yet, and no COMMIT-ACK loss fault injection against a real worker. Commercial processing and C01 auto-promotion remain disconnected.

## Release boundaries
No deploy, merge, migration in active DB, Meta/Cloudflare activation, QR pairing, WhatsApp capture or handling of existing four PCH HOLD messages. Next: G12 producer-side signed transport, recovery after unknown commit and full isolated two-service integration. Production HOLD.
