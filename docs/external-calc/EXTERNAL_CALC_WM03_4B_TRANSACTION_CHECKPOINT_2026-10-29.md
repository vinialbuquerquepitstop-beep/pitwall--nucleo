# TREE WM-03.4b | Transaction adapter checkpoint
Date: 2026-10-29
Owner: Chat B / PR #201
Status: CODE_COMMITTED / LOCAL_MOCK_PROOF_PASS_6_6 / POSTGRES_INTEGRATION_NOT_RUN / NO_DEPLOY

## Inspected environment
Connected Neon projects include `tree-ingest-gate-isolated-free`, `stakes-ai-system-factory-l4-mcp-sandbox` and `commercial-ai`. NONE was identified as a purpose-built authorized Pitstop Connect Hub Ingress datastore. No database writes, new projects, migrations, secrets or deployments were performed.

## Implementation
- `ferramentas/external-calc-whatsapp/v0/ingress-transaction-v0.cjs`, commit `b37705baa548e4dff64b725586e20e4d038167c4`
- `ferramentas/external-calc-whatsapp/v0/proof-ingress-transaction-v0.cjs`, commit `2107361ea25df1e045f8527a0a0049c6b878aeba`
- Proposed SQL is in `sql/ingress-outbox-isolated-proposal.sql`, commit `c2b9d79b3914f97ed312d25c8f8d504bc3e81470`, NOT applied.

The PG adapter uses a single client and BEGIN/COMMIT/ROLLBACK, inserts inbox then outbox, uses an idempotent unique-key conflict lookup, and refuses a changed hash, route, tenant binding or routing policy on replay. No actual PG execution was performed.

## Proof
A local Node v22.16.0 test of the adapter logic and mock pg client ran with six PASS lines, exit 0. The local test files were constructed before the remote commits and are not asserted to be byte-for-byte the remote GitHub files. This is a mock orchestration check, NOT database atomicity/concurrency proof.
```text
PASS A01 successful event atomically inserts inbox and outbox
PASS A02 duplicate same identity does not insert outbox
PASS A03 same identity with changed hash is rejected
PASS A04 outbox failure rolls back entire transaction
PASS A05 IGNORE persists minimal event without outbox
PASS A06 unauthorized/invalid event rejected before pool access
WM034B TRANSACTION MOCK PASS 6/6
```
The initial local version rejected route IGNORE; it was corrected and rerun before commits.

## Mandatory gate before PostgreSQL tests
1. Provision or explicitly authorize a new isolated Ingress staging project; never reuse F1, Pitwall CRM, Pitsquad or unrelated Neon data stores.
2. Review DDL, isolation and DB roles, retention and protected content storage. Current SQL is only a draft.
3. Connect real PG and prove same-ID concurrency, two-ID same-body, DB failure rollback, duplicate replay, crash-after-commit, tenant isolation and outbox retries.
4. Authenticated server must derive tenant/supplier from allowlist, not provider payload. No meta HTTP endpoint wired yet.
5. Decide CRM-disabled HOLD policy before any real customer events.
6. Do not connect Meta callback nor production number without gates G0–G4.

## Decision
Pure mock logic: PASS limited. Durable DB gate: NOT_RUN. HTTPS callback: NOT_RUN. External Calc/CRM consumer delivery: BLOCKED. Production: NO_GO.
