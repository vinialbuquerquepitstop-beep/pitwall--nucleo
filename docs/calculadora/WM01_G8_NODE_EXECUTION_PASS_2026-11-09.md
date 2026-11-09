# WM-01/G8 | Node regression execution evidence | 2026-11-09

## Environment
- Execution: Vercel ephemeral sandbox on existing External Calc frontend project; no app deployment.
- Runtime: Node.js 22, branch `feature/wm01-g5-receiver-shadow-20261109`.
- Verified HEAD: `27bc3430318367c23c17af97a71838e7ad5b3d74`.
- Command: `node --test ferramentas/external-calc-pch-receiver/v0/*.test.js`.
- Observed TAP: **37 tests, 37 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo**.
- Test suite duration: **313.074562 ms**. Command exit code: **0**.

## Evidence scope
PASS: G5–G8 local unit/regression tests, mock transactions, UUID validation, fail-closed matching, tenant-binding command sequence, receipt recovery logic.
NOT PROVEN: real PostgreSQL transaction/RLS permissions or concurrent inserts, lost COMMIT acknowledgement under real network failure, end-to-end PCH delivery, machine-to-machine authentication, Cloudflare runtime or Meta commercial ingress.
The sandbox did not have `psql`, `postgres`, `pg_ctl` or Docker; no PostgreSQL integration test was run.
No production/staging database contacted or modified. Existing four Connect Hub HOLD rows were not processed.
Next: disposable PostgreSQL 17 and security approval before schema/RLS implementation.
