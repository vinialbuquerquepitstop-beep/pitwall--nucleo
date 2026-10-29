# WM-03 | Corrected transaction regression
Date: 2026-10-29. PR #201, Chat B.

Executed Node.js v22.16.0 locally after reading exact source from the PR branch.
Git blob SHA matches:
- ingress-transaction-v0.cjs: `23147ccdc936438a4837b4fe6c9f43d131828e5a`
- proof-ingress-transaction-v0.cjs: `b4ee39d068ab2ae8d32b8fa27005af7d792a87be`

`node --check` both files: exit 0.
`node proof-ingress-transaction-v0.cjs`: exit 0.

```text
PASS A01 insert inbox and outbox in one transaction
PASS A02 duplicate identity no second outbox
PASS A03 conflict changed original hash rolls back
PASS A04 outbox failure rolls back transaction
PASS A05 ignored event has no outbox
PASS A06 invalid event fails before database
WM034B TRANSACTION MOCK PASS 6/6
```

The duplicate SELECT no longer requests FOR UPDATE, so it can work with a SELECT/INSERT-only app identity. This proves a mock-backed adapter regression only; real independent app credentials, cross-tenant deny, actual DB transactional ingress and Cloudflare/Meta E2E remain pending. No production changes made.
