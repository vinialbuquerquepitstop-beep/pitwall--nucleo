# TREE | WM-03.4b — Neon isolated staging checkpoint
Date: 2026-10-29
Owner: Chat B / PR #201

## Verified live environment
Neon project: `pitstop-connect-hub-ingress-staging`
Project ID: `purple-violet-98259937`
Region: `aws-sa-east-1`
PostgreSQL: 17
Separate project from existing External Calc, Pitwall V2 and other Neon projects.

## Executed migration (staging only)
Applied 4 statements as one SQL transaction using Neon connector:
1. CREATE TABLE ingress_events
2. CREATE TABLE ingress_outbox
3. CREATE INDEX ingress_outbox_pending_idx
4. REVOKE ALL on both tables FROM PUBLIC

Follow-up live read returned `created_tables: 2`, `outbox_index: 1`.

Important: the live DDL is a reduced/minimal subset of the PR #201 proposal; it does not yet contain all proposed lifecycle, retry, retention or content-reference columns. Do not claim exact migration parity. No storage of actual WhatsApp content.

## Real PostgreSQL synthetic transaction proof
Used one database transaction with:
- First synthetic event `scope_synthetic/phone_synthetic/wamid.synthetic.001` inserts into `ingress_events`, then an `ingress_outbox` row from the inserted result.
- Repeated insert of the exact same Meta identity with a distinct row UUID using `ON CONFLICT DO NOTHING RETURNING id` returned an empty array.
- Read asserted `inbox_count=1`, `outbox_count=1`.
This proves PostgreSQL unique-key duplicate suppression in one sequential transaction. It does NOT prove the checked-in Node transaction adapter ran against the Neon DB, concurrent race behavior, full crash/recovery, tenant-bound authorization, endpoint security or worker processing.

## Release gates
- Isolated staging project: PASS
- Two tables and pending index: PASS
- Single sequential duplicate and outbox cardinality: PASS
- Exact SQL schema parity: NOT_RUN
- Actual PG adapter E2E: NOT_RUN
- Concurrent same-ID test: NOT_RUN
- Rollback on outbox failure: NOT_RUN
- Two-tenant RLS/role test: NOT_RUN
- Encrypted storage, retention and LGPD: NOT_RUN
- HTTP Meta webhook with durable ACK: BLOCKED
- Meta commercial number: UNCHANGED
- Production: NO_GO

## Next
1. Reconcile migration version and live schema, add database migration tracking.
2. Create limited-permission ingest and delivery workload roles and test tenant isolation.
3. Run exact-source Node PostgreSQL adapter against staging under non-owner credentials.
4. Wire webhook to the authorized durable acceptance path only after full negative test and queue proof.
