# WM-01/G9 | PostgreSQL 17.11 Real Integration Proof | 2026-11-09

## Verdict
**PASS for isolated PostgreSQL persistence, unique-key idempotency, concurrent inserts and restricted-role tenant RLS under the exact tested configuration.** **NOT a full service-to-service production release gate.**

## Environment
Ephemeral Vercel Sandbox on existing External Calc frontend project, region gru1, Node.js 22, dedicated local PostgreSQL **17.11**; database socket `/tmp`, port 55439, no TCP listener. Database was new and disposable, with synthetic IDs only. No production/Neon/Supabase database was contacted.

Tested GitHub branch: `feature/wm01-g5-receiver-shadow-20261109`.
Verified branch checkout at commit `eae78f589835a4d3363da469a7fb9bf4fe7064ba`.

## Real blocker found and corrected
Initial run: 5 pass / 7 fail. Root cause: `SELECT ... FOR UPDATE` requires row-level UPDATE privileges under PostgreSQL; the intentionally append-only role has SELECT and INSERT only, with UPDATE and DELETE denied. Adding UPDATE would violate least privilege.
Change at commit `629fe8cd`: remove `FOR UPDATE` after `INSERT ... ON CONFLICT DO NOTHING`. The unique-key conflict waits for concurrent insert resolution; after successful insert/no-op, a plain SELECT can compare the immutable snapshot, with no writer able to UPDATE or DELETE this Inbox via the restricted role.

Retest performed after checking out updated branch (commit `eae78f5`): full Node unit/regression suite **37/37 PASS, exit 0**; PostgreSQL real tests **12/12 PASS, exit 0**.

## 12 PostgreSQL real integration checks
1. Actual committed inbox INSERT and persisted UUID receipt.
2. Duplicate delivery returns identical persisted receipt ID.
3. Immutable sender change under same key rejected.
4. Receipt lookup matches durable event.
5. Cross-tenant receipt lookup cannot see the other tenant's row.
6. Missing transaction-local tenant setting sees zero rows.
7. Restricted database role cannot UPDATE or DELETE.
8. 12 simultaneous identical inserts converge to ONE receipt.
9. 8 concurrent conflicting inserts result in ONE accepted identity, seven conflicts.
10. Rollback prior to COMMIT leaves no receipt.
11. Tenant context clears between pooled transactions.
12. Test login has `rolbypassrls=false`.

Applied shadow schema and RLS policy only in the disposable database; created an ephemeral `pch_test_login` member of the restricted NOLOGIN `extcalc_pch_ingress` role. Neither role nor schema was applied to any existing database.

Reproducible proof committed as `ferramentas/external-calc-pch-receiver/v0/postgres17-integration-proof.cjs`. It needs `pg` available, explicit `PCH_DISPOSABLE_PG17=true`, a disposable PG17 database and an isolated test role. Do not run against Neon/production.

## Security/architecture gates still OPEN
- A transaction-local `app.pch_tenant_id` GUC is **not** authentication; the server must derive tenant from trusted machine credentials and must not expose arbitrary SQL execution to clients.
- Verify dedicated service identity, producer authorization, UUID tenant binding, account key rotation, quotas and replay protection.
- Confirm correct encryption and confidentiality of inbox snapshot, retention and audit policy, especially sender IDs and encrypted payload refs.
- Crash/network disconnect during and after COMMIT, authoritative reconciliation after unknown outcomes, and disconnected worker/consumer recovery remain untested.
- No HTTP server-to-server receiver route, Outbox consumer or end-to-end webhook ingestion is enabled. No external live messages, no auto-promotion C01, no processing of four historical PCH HOLD rows.
- Review and approve migrations and role grants separately. Files ending `NOT-APPLY.sql` remain candidates and MUST NOT be applied automatically.

## Current conclusion
G8 offline suite = PASS. G9 real PG17 core persistence/tenant-RLS/concurrency subgate = PASS. Full G9 operational/security release = PARTIAL / HOLD.
