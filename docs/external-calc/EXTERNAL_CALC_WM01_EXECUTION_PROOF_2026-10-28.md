# WM-01 — Proof execution / 2026-10-28
Status: SYNTHETIC_UNIT_TEST_PASS_15_15 / NO_DEPLOY / NO_META_CONNECTION / NO_PRODUCTION

## Code fix
Proof script literal backslash-n tokens replaced with real newlines on branch `feat/external-calc-whatsapp-source-adapter-wm00-20261028`.
Fix commit: `4868d98041ed70de21bab11f77a76a6cc06e0d59`.
Remote refetch confirmed zero literal backslash-n tokens in proof script (blob `177be0a58fb0b1881b2dc2273fe281e012076568`).

## Execution context
- Node.js v22.16.0, isolated container environment.
- Both GitHub connector-fetched source texts reconstructed locally as standalone files.
- Git remote checkout unavailable in runtime (DNS to github.com unavailable), hence this is a reconstructed-source execution, not a git checkout SHA-verified run. Do not claim stronger provenance.
- Commands: `node --check whatsapp-source-adapter-v0.cjs`, `node --check proof-whatsapp-source-adapter-v0.cjs`, `node proof-whatsapp-source-adapter-v0.cjs`.
- Both syntax checks exit 0. Test runner exit 0, 15/15.

## Actual stdout
```text
PASS authorized supplier text yields transport record only
PASS client is ignored with no text leakage
PASS cross-tenant spoofing in payload ignored
PASS wrong phone id denies source
PASS media unsupported
PASS status update ignored
PASS duplicate delivery within same payload ignored
PASS same text different message id different keys
PASS encoded Meta message id accepted
PASS invalid signature denied
PASS tampered bytes rejected
PASS malformed json after valid signature rejected
PASS too large payload rejected before signature
PASS GET challenge allowed only with matching token
PASS signature helper uses exact raw bytes
WM01 PURE ADAPTER PASS 15/15
```

## Scope and residual risks
This proves only the synthetic pure-adapter unit-test set. The tests do NOT prove persisted idempotency across webhook retries, real tenant A/B identity, append-only originals, privacy in HTTP logs, webhook availability, authorized bridge into F1, Meta coexistence, live provider events, or ordinary group capture.

F1 staging remains an external prerequisite owned by the other workstream/Codex. No C01–C05 changes, Cloud API activation, Pitwall V2 changes, production deployment or merge are authorized.

## Next
Design supervised operator intake against existing trusted original source contract, preserving operator-asserted group provenance. Keep implementation behind explicit staging and authenticated gate.