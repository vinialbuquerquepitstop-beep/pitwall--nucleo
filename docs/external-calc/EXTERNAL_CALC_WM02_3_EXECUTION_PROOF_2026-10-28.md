# TREE / WM-02.3 — Synthetic execution evidence
Date: 2026-10-28
State: PASS (PURE SYNTHETIC ADAPTER ONLY) / NO_RUNTIME_INTEGRATION / NO_DEPLOY

## Provenance
Source code fetched from GitHub branch `feat/external-calc-whatsapp-source-adapter-wm00-20261028` of `vinialbuquerquepitstop-beep/pitwall--nucleo`, via connector, then reconstructed as two files in isolated Node execution container; this is NOT a Git checkout SHA-verification.
GitHub file blob SHAs at fetch:
- `whatsapp-supervised-source-adapter-v0.cjs`: `2a598d672ef5a4c789e1a8584cf6bd687a4aacd4`
- `proof-whatsapp-supervised-adapter-v0.cjs`: `03f4687d82483719cb8b44f797565871301e0c3b`
Local SHA256 of reconstructed files:
- adapter: `e497d72e8a2287d9d89f5903351d0c653f9750aab98186b6aa5b9dd889661346`
- proof: `4b6b3f88d404fb1399dc4ac296f7d1c97ab8118e95a95a4b187ee40b858cd9f1`

## Commands, environment, and exit status
Node: `v22.16.0`.
`node --check whatsapp-supervised-source-adapter-v0.cjs` -> exit 0.
`node --check proof-whatsapp-supervised-adapter-v0.cjs` -> exit 0.
`node proof-whatsapp-supervised-adapter-v0.cjs` -> exit 0.

## Actual stdout
```text
PASS T01 valid approved group yields review-only event
PASS T02 unknown supplier rejected
PASS T03 unknown group rejected
PASS T04 cross-tenant supplier and group rejected
PASS T05 blank or oversized text rejected
PASS T06 key uses trusted intake id not text hash
PASS T07 identical text separate ids have different source keys
PASS T08 same intake id yields deterministic source key
PASS T09 submitted tenant and operator spoofing ignored
PASS T10 no commercial offer authority emitted
PASS T11 only supported methods accepted
PASS T12 provenance operator asserted only
WM02 SUPERVISED ADAPTER PASS 12/12
```

## Scope limitations
This proves only input validation and transformation for synthetic inputs to a pure adapter. The `trustedContext` is test-generated, not backed by authenticated server identity or DB access controls. The function does not persist originals, deduplicate transactionally, prove A/B JWT isolation, validate consent, or integrate with F1. Some risks remain outside this module: real group capture, authoritative attribution of forwarded messages, trusted intake ID generation, and privacy in logs. No Meta connection or production change made.

## Tree transition
REALIDADE/MODELO/FUNDAÇÃO (WM-02.1) documented.
EXECUÇÃO (WM-02.2) code committed.
PROVA (WM-02.3) PASS 12/12.
CONSOLIDAÇÃO: WM-02.3 closed for pure transport, WM-02.4 preparation authorized as planning/synthetic only. Integration gate remains BLOCKED pending F1 bridge design and authentication homologation from Chat A.
