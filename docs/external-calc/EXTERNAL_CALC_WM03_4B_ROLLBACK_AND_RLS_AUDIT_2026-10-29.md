# TREE | WM-03.4b — Real PostgreSQL rollback and security check
Date: 2026-10-29
Owner: Chat B, PR #201
Staging Neon: pitstop-connect-hub-ingress-staging (purple-violet-98259937)

## Evidence
Read-only metadata query on `pg_tables` returned:
- ingress_events: rowsecurity=false
- ingress_outbox: rowsecurity=false
No claim of tenant isolation is permitted on that basis.

## Transaction negative test (synthetic only)
Initial query: zero ingress rows in scope_rollback_test, zero human_review outbox rows.
Single Neon SQL transaction:
1. INSERT synthetic message into ingress_events.
2. INSERT into ingress_outbox with deliberately invalid destination.
PostgreSQL returned check constraint failure: ingress_outbox_destination_check.
Separate post-failure read:
- ingress rows with scope_rollback_test = 0
- outbox rows with synthetic ingress_event_id = 0
Verdict: PASS for rollback on one concrete DB constraint failure. It does not establish all failure or concurrency behaviors.

## Gates
- Basic real PG sequential dedup: PASS limited (prior checkpoint)
- Rollback on invalid outbox row: PASS limited
- RLS/role tenant isolation: BLOCKED, RLS disabled
- Runtime PG adapter under restricted role: NOT_RUN
- Concurrent duplicate: NOT_RUN
- Exact migration parity: NOT_RUN
- Webhook signed HTTPS: NOT_RUN
- Production: NO_GO

## Next authorized design steps
Review tenant ownership, separate role matrix, and policies before enabling RLS. Draft limited-privilege schema migration and test with distinct tenant identities. Do not turn on a provider callback or send customer messages to this database.
