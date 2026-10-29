# TREE | WM-03 — Durable ACK boundary verification
Date: 2026-10-29
Owner: Chat B, PR #201

## Artifacts
- `ferramentas/external-calc-whatsapp/v0/cloudflare/durable-ack-boundary.mjs`, commit `08e769dad51de55ab3e50f83b6601e78d9b1e3eb`
- `ferramentas/external-calc-whatsapp/v0/cloudflare/proof-durable-ack-boundary.mjs`, commit `b38b9923ee490814d3354829832b0e74f34ffb09`

## Local execution
Node v22.16.0, two `node --check` exit 0, proof exit 0.
Remote GitHub file blob hashes matched local `git hash-object`:
- boundary: `c607289cb4a11ef1c793f80965007ccb66e20a11`
- proof: `ccfbba55a32d1a6299671bf5e1abf1b3ecd34205`

```
PASS A01 reject unauthenticated
PASS A02 reject unauthorized
PASS A03 reject unavailable storage
PASS A04 accept durable insert
PASS A05 acknowledge durable replay
PASS A06 reject incomplete storage result
PASS A07 fail closed on storage error
DURABLE ACK CONTRACT PASS 7/7
```

## Strict interpretation
This proves ONLY a pure admission/ACK boundary with an injected mock accept callback. It is NOT wired into the existing Cloudflare Worker, Neon database, Meta webhook or external consumers. Authentication and authorization are Boolean inputs supplied by a trusted caller, so they must not be derived from untrusted provider body or from a browser. A production connector must resolve authorized tenant/receiver server-side and ensure the callback represents a committed atomic inbox/outbox transaction. The current standalone Worker still returns 503 for valid signed POST. Do not register it as Meta callback.

Read-only Neon verification in this turn: `pch_app_a_login` and `pch_app_b_login` do not exist. Independent restricted app credential gate remains unmet, preventing safe DB connection.

## Next
Provision reviewed least-privilege SQL LOGIN roles via authorized Neon SQL Editor + managed secrets, prove independently authenticated tenant A/B and full transactional commit; then connect this boundary and run exact-source HTTP sandbox tests.
Status: LOCAL 7/7 PASS | LIVE PG BRIDGE NOT_RUN | META CALLBACK OFF | PRODUCTION NO-GO.
