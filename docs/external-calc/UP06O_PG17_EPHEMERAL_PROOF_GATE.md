# UP-06O — PostgreSQL 17 ephemera / real concurrency gate
Date: 2026-11-09. PR #202 DRAFT. No migration, no merge, no deployment.
## Delivered
A self-contained local PG17 harness `ferramentas/external-calc-public-upgrade/v0/pg17-ephemeral-proof.sh`:
- Refuses root and environments without PG17.
- Creates an isolated temporary cluster and owner-only Unix socket; disallows TCP.
- Creates local `privado` ledger, a column-limited writer role, RLS policies and roles to assert denied anonymous/authenticated access.
- Runs 32 independent `psql` sessions against the same hash, requires one winner, and checks SQL privilege denials.
- Always stops and erases the isolated cluster.
## Executed in this session
- Node unit tests: **27/27 PASS** using existing test doubles, not PostgreSQL.
- Bash syntax check: PASS.
- Attempted harness as OS user `nobody`: **BLOCKED: initdb not installed**.
- Therefore **DO NOT CLAIM PG17 proof**, real concurrency, real permission or DB credentials as homologated.
## Security and limitations
- Do not run against active Supabase, staging, production or an existing PostgreSQL cluster.
- On a genuine PG17 environment, execute as a dedicated unprivileged OS user; preserve proof logs.
- Column-level SELECT grants nonce digest to writer for `RETURNING`; requires review against production threat model.
- Writer is not by itself tenant-authorized: verified service identity and tenant-scoped repository remain required.
- No Worker route is wired. No production identity, nonce storage, key management or SQL privileges were configured.
## Gates
G0 branch + no prod change: PASS.
G1 executable harness, static syntax: PASS.
G2 existing local Node regression: PASS 27/27.
G3 isolated PG17 concurrency and role proof: BLOCKED.
G4 operational service integration: BLOCKED.
G5 deployment: NOT AUTHORIZED.
