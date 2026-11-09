# WM-01/G8 | Transaction-local RLS and PostgreSQL 17 test gate | 2026-11-09

State: **CODE REVIEW CANDIDATE / LOCAL REGRESSIONS NOT EXECUTED / PG17 NOT HOMOLOGATED**.

## Implementation evidence
- `postgres-receiver-shadow.js`: validates canonical UUID tenant before pool acquisition; each acceptance now starts BEGIN and binds `app.pch_tenant_id` with parameterized `set_config(..., true)`, before any Inbox query. Read-only receipt reconciliation uses BEGIN READ ONLY, the same transaction-local tenant binding, COMMIT/ROLLBACK and release.
- `rls-policy-shadow-NOT-APPLY.sql`: draft dedicated NOLOGIN permission role, SELECT+INSERT only, FORCE RLS, tenant predicates; **not a migration** and requires privilege/security review before execution.
- Updated G6/G7 simulated tests to account for tenant binding.
- Added 6 focused G8 regression tests for tenant-before-query, read-only lookup, rollback on binding failure, invalid UUID before DB connection, immutable replay conflicts and cross-tenant receipt denial.
- The 31 pre-existing G5-G7 tests plus six new G8 cases = **37 defined tests**, NOT 37 passes.

## Critical limitations
A PostgreSQL custom configuration variable is not a standalone authentication guarantee. Only a separately authenticated, tenant-bound and SQL-injection-resistant backend with a dedicated restricted login may set `app.pch_tenant_id`. It must not be writable by untrusted SQL clients. Database role must have `rolbypassrls=false`; use NOLOGIN group role with no membership until approval. Enforce no direct browser access to this receiver.

Postgres tests must verify behavior under actual RLS, concurrent duplicate insert, concurrent differing snapshot, failure before commit, lost client connection around commit, cross-tenant query, role grants, database owner bypass and connection-pool tenant switching.

Never infer exactly-once delivery from INSERT ON CONFLICT. Lost COMMIT ACK requires separately authenticated read-only receipt reconciliation.

## Test commands (Windows PowerShell; branch checkout)
`cd ferramentas/external-calc-pch-receiver/v0`
`node --test receiver-shadow.test.js postgres-receiver-shadow.test.js receipt-reconciliation-shadow.test.js tenant-rls-binding-shadow.test.js`

Expected definitions: 37. Record actual output and terminal exit code before marking local gate PASS. Do not run an unreviewed SQL file on Neon, Supabase or CRM production.

## Disposable PG17 integration gate prerequisites
1. Dedicated disposable local PostgreSQL 17 cluster/database, with no connection string reused from production or Neon.
2. Review schema candidate `schema-shadow-NOT-APPLY.sql` and role/policy candidate `rls-policy-shadow-NOT-APPLY.sql`; grant only to a dedicated test login after security review.
3. Migrate test fixture to exact UUID mapping, add realistic concurrent connections under restricted login, and confirm FORCE RLS prevents cross-tenant reads/writes.
4. Verify idempotent receipt reuse, immutable conflict, transient transaction errors, COMMIT uncertainty, and read-after-unknown-state reconciling by key.
5. Do not activate PCH consumer, Meta app, WhatsApp Web/QR or commercial auto-promotion.

## Release state
G8 shadow files authored in isolated branch. No commit merged to main, no DB migration applied, no deploy, no live supplier data ingested. The four historical PCH HOLD rows remain untouched. Next evidence needed: actual Node regression output, then disposable PG17 tests and review of machine-to-machine authentication.
