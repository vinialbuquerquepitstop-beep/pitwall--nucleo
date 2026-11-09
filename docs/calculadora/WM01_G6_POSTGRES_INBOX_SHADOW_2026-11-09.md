# WM-01/G6 — PostgreSQL Inbox Shadow | 2026-11-09

Status: IMPLEMENTED ON ISOLATED BRANCH / NOT EXECUTED OR APPLIED.

## Baseline and deliverables
Baseline main: `83ebc3a6e83b89a2c1f6e726092b335bfef7745c`.
Branch: `feature/wm01-g5-receiver-shadow-20261109`.
- `v0/receiver-shadow.js`: validates identity and returns acceptance-only receipt.
- `v0/postgres-receiver-shadow.js`: transactional pg repository with parameterized INSERT ON CONFLICT DO NOTHING; SELECT FOR UPDATE; full immutable snapshot reconciliation; COMMIT before return. On conflict ROLLBACK without receipt.
- `v0/schema-shadow-NOT-APPLY.sql`: a proposed inbox schema; NO grants, NO RLS policies, NO deployment, NOT an approved migration.
- `v0/receiver-shadow.test.js`: 16 unit tests drafted.
- `v0/postgres-receiver-shadow.test.js`: 7 mock transaction tests drafted.
No runtime executor, HTTP endpoint, persistent receipt lookup or enabled consumer.

## SECURITY-CRITICAL blockers
1. Existing Calc canonical tenant identity is UUID; schema candidate currently uses TEXT for tenant ID to support the preliminary PCH source format. **HOLD** until a verified canonical UUID and tenant binding contract is adopted. Never apply this schema without revising tenant type.
2. RLS is enabled and forced with no policies or grants. Repository cannot operate against this candidate as delivered; dedicated least-privilege role and safely tenant-scoped RLS must be designed, verified on disposable database and approved. Do not use a broad service role.
3. Inbox snapshot contains identifiers including sender ID and encrypted payload reference. Resolve PII minimization, encryption, retention, audit, and secure storage. The inbox must not copy WhatsApp message plaintext.
4. An INSERT followed by SELECT FOR UPDATE in one transaction serializes duplicate-key outcomes, but live PostgreSQL concurrency, rollback, cancellation, timeout and crash tests are mandatory; mocks are not evidence of database guarantees.
5. If COMMIT acknowledgement is lost, state is UNKNOWN, not guaranteed rolled back. Caller must reconcile by durable receipt lookup before retry/settle. Existing tests simulate a thrown error, NOT real commit ambiguity.
6. Existing `list-intake` may persist and auto-promote C01 offers. Acceptance receipt has state `ACCEPTED_NOT_PROCESSED` and must never be treated as commercial approval.
7. Event provider IDs and per-tenant source authorization must be checked by trusted service middleware. `actor` passed into pure module is NOT an authentication implementation. Do not expose this code directly to callers.

## Local-only test commands
From `ferramentas/external-calc-pch-receiver/v0`:
`node --test receiver-shadow.test.js postgres-receiver-shadow.test.js`
Expected test definitions: 23. Actual execution must be recorded separately before claiming PASS.

## Gate sequence
A: verify exact branch code and run 23 tests.
B: reconcile UUID tenant scheme, authentication and RLS without privileged bypass.
C: implement audited migration on disposable PostgreSQL and real concurrent/idempotent test.
D: add durable receipt lookup and reconcile UNKNOWN on timeout/lost ACK.
E: connect separately authorized PCH consumer, deploy only after operational gate.

No merge, migration, production deploy, Meta publish, QR pairing, processing of four historical HOLD rows, or commercial ingress in this slice.
