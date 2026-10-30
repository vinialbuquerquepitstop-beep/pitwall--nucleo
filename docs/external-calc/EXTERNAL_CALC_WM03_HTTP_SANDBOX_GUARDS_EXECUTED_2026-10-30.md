# WM-03 | HTTP sandbox guard proof and deployment blocker
Date: 2026-10-30 | PR #201 | Chat B

## Exact-source local test
Source Git blob hashes matched freshly reconstructed Node files:
- `cloudflare/connect-hub-worker.mjs`: `95d15ec90629a81ccbe7ffa57ffa6519e8df02f5`
- `cloudflare/proof-sandbox-guards.mjs`: `6b7a66e18eff6a8fe10663af8dd510125c56e481`
Node v22.16.0. `node --check`: PASS. `node proof-sandbox-guards.mjs`: exit 0.

```text
PASS B01 disabled by default
PASS B02 reject unknown receiver
PASS B03 reject unknown sender
PASS B04 reject unsupported event
PASS B05 no event not acknowledged
PASS B06 malformed JSON rejected after valid signature
SANDBOX GUARDS 6/6
```

## Material functional blocker identified
The enabled POST route reduces Meta messages to a sha256 digest and identification fields. `ingress-transaction-v0.cjs` persists only those metadata fields. The current Inbox/Outbox schema contains no original body or durable encrypted original reference, so the authorized External Calc consumer cannot retrieve a supplier's offer content. Storing a digest alone is not equivalent to content lineage. This is not resolved by a green ingress HTTP test.

**Decision:** do not enable the Meta callback, do not enable `PCH_STAGING_INGRESS_ENABLED`, and do not claim end-to-end business intake until original content persistence/reference with retention/privacy and authorized destination lookup is implemented and tested. Keep commercial number and existing `flat-resonance-09ba` untouched.

## Status
HTTP guard tests PASS (local); Hyperdrive Worker real runtime NOT_RUN; original offer content contract BLOCKED; Cloudflare worker NOT_DEPLOYED; Meta sandbox callback NOT_CONFIGURED.
