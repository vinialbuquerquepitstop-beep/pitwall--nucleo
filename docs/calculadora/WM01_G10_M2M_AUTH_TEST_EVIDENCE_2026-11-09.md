# WM-01/G10 | Signed Service Identity and Unknown-Outcome Recovery | 2026-11-09

## Executed proof (isolated cloud Node 22)
Branch `feature/wm01-g5-receiver-shadow-20261109`, verified HEAD `9871b7fe2c1b2e83c220be2939ba3072cda6a4b9`.
Command `node --test ferramentas/external-calc-pch-receiver/v0/*.test.js`.
**73 tests; 73 pass; 0 fail; 0 skipped; exit 0; 465.522412 ms.**

## Implemented, not deployed
- `m2m-auth-shadow.js`: server-only HMAC-SHA256 verification over method, internal route, key ID, tenant UUID, timestamp, nonce and SHA-256 of exact UTF8 body. Validates freshness (5 min), keyring-derived tenant authorization, provider=PCH and ingress permission; compares signatures in constant time; never derives service identity from JSON body.
- `authenticateOnce`: after validating signature, requires injected `nonceLedger.reserveOnce` to atomically reserve key ID + nonce before granting actor access. The **durable nonce ledger is not implemented**; using this directly without the ledger fails closed. Keys must be secret and scoped per tenant, with rotation/revocation and TLS transport.
- `m2m-auth-shadow.test.js`: 25 tests, including signature spoofing, body mutation, invalid tenant, permission violations, stale/future timestamps, replay rejection and ledger unavailable.
- `delivery-recovery-shadow.js`: pure decisions only. Unknown response/timeouts/HTTP 200 without verified durable lookup do not confirm delivery. Missing lookup is not permission to blindly replay. Mismatches HOLD; only accepted matching durable receipt may become CONFIRMED.
- `delivery-recovery-shadow.test.js`: 11 tests for unknown outcomes, HTTP and reconciliation.
- G5–G9 Node tests still passing (37 tests). 37+25+11=73.

## Earlier real database evidence
G9 real PostgreSQL 17.11 isolated tests: 12/12 PASS at commit `eae78f5`, covering unique-key concurrent insert, tenant RLS, immutable conflicts, rollback and restricted role. The current G10 update adds no changes to that PostgreSQL repository beyond G9. This is **not** a real database verification of nonce ledger nor proof of lost COMMIT ACK behavior.

## Gate still blocked
1. Independently authenticate outbound PCH connection at the HTTP boundary, then derive actor from middleware; no public route or user bearer token.
2. Implement persistent replay ledger (atomic keyID+nonce, TTL, tenant scoping) and credential rotation. The injected ledger test doubles are NOT durable.
3. Ensure transport HMAC and signed content hashes match encrypted inbound body ownership, payload/provenance, anti-replay and at-rest encryption requirements. Do not transmit unrelated WhatsApp PII.
4. Implement trusted durable authenticated receipt query; handle unknown COMMIT outcomes under real disconnect/crash, no blind retries.
5. Implement fenced Outbox worker, rate limits, circuit breakers, audits, observability and manual review before enabling.
6. Separate WhatsApp private and group-source feasibility/terms gate; no QR automation or actual Meta event proven here.
7. Explicit release authorization needed for migration/production activation; four existing HOLD_REVIEW rows remain untouched.

## Operational state
No merge, deploy, migration, Meta publication or live inbound. Ephemeral tests only. Next G11: durable nonce ledger with PostgreSQL/RLS proof, then internal HTTP adapter and lost-ACK recovery.
