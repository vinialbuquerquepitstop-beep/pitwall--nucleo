# WM-01/G13 | Real HTTPS loopback, PostgreSQL 17.11 and lost-ACK recovery | 2026-11-09

## Verdict
**PASS for an isolated HTTPS two-component test and actual PostgreSQL 17.11-backed persistence, nonce ledger and reconciliation after forced TCP connection loss.** Operational release remains **HOLD**.

## Reproducible environment and evidence
Branch `feature/wm01-g5-receiver-shadow-20261109`, tested commit `12e90ab67e91618462732719653a36bfd4326c20`.
Ephemeral Vercel sandbox, Node.js 22, PostgreSQL 17.11 bound only to a Unix socket, short-lived self-signed certificate with SAN `127.0.0.1` (trusted solely in test process). HTTPS server listened on loopback `127.0.0.1` with dynamic port. No exposed domain or app deployment.
- The exact current PCH sender module `pch-calc-transport-shadow.mjs` was fetched via the GitHub connector from `feature/wm01-delivery-receipt-shadow-20261109` and copied into the isolated sandbox as `/tmp/pch-g13-sender.mjs`.
- The real Calc G11 HTTP adapter, Postgres inbox repository, and PostgreSQL nonce ledger were imported from this backend branch.
- PostgreSQL candidate schema, RLS and nonce ledger policy SQL ran only in the disposable database under a restricted `pch_test_login` role. No production database/schema touched.
- Explicit test-only proof committed at `ferramentas/external-calc-pch-receiver/v0/g13-https-postgres-proof.mjs`. Requires `PCH_G13_DISPOSABLE=true`, local trusted ephemeral TLS key/cert and `PCH_G13_CLIENT_MODULE`; not an application route.
- Actual command exit: **0**, **7/7 PASS**.
- Full Node regression from the same commit: **86/86 PASS**, **0 fails**, exit 0.

## Seven real-network scenario checks
1. HTTPS POST accepted and committed into PG17, then server forcibly destroyed the socket before returning HTTP response. PCH reported RECONCILE, not DELIVERED.
2. A separately signed HTTPS receipt lookup with a new nonce recovered the durable PG receipt.
3. Another HTTPS POST for the identical event with another nonce returned the original idempotent receipt.
4. Reusing the event identity with mutated immutable sender was rejected and resulted in HOLD.
5. A different tenant UUID was blocked by the PCH client before any network request.
6. Exactly one durable inbox row existed after the lost-ACK and duplicate send.
7. Exactly five HTTPS requests consumed five separate durable nonces in PG17.

The certificate was intended for disposable loopback testing only. This proof verifies genuine TLS encrypted requests inside one sandbox, **not** multi-host networking, deployed DNS/cert lifecycle, deployment environment configuration, or a real WhatsApp webhook.

## Security and release holds
- Dedicated production sender and receiver M2M key lifecycle, rotation/revocation, trusted tenant mapping, rate limits, auditable credentials and nonce retention remain unapproved.
- Worker Outbox still has no durable claim/settle consumer with CAS/fencing; no actual delivery or production persistence routing.
- HTTPS listener exists only in test proof and is not deployed, exposed or registered.
- PG17 proof did not cover killing the database process mid-commit or cross-host network partitions; only forced HTTPS TCP disconnection after committed acceptance.
- Need PCH-to-Calc deployment topology confirmation, receipt verification from the authoritative server, real multi-service tests and release authorization.
- No active DB migration, merge, deployment, Meta/Webhook or QR pairing; no real commercial messages or four historical HOLD entries processed.

**G13 scoped technical validation: PASS. Full operational production gate: HOLD.** Next G14 should implement isolated persistent Outbox CAS+lease fencing, then end-to-end controlled consumer proof before any activation.
