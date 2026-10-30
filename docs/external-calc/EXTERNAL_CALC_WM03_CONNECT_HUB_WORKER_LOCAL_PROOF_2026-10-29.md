# TREE | Connect Hub Worker exact-source local proof
Date: 2026-10-29
Owner: Chat B, PR #201

## Source
Fetched directly from branch:
- ferramentas/external-calc-whatsapp/v0/cloudflare/connect-hub-worker.mjs
  Blob SHA 29a8bb011cb58e69ad6bfe8c4832f91c9e6cc3ad
- ferramentas/external-calc-whatsapp/v0/cloudflare/proof-connect-hub-worker.mjs
  Blob SHA 3a985aaaacfe145d7be6c90f19d287719a9ca3e0

Local reconstructed files matched both GitHub blob hashes using git hash-object.
Node.js v22.16.0. Both node --check calls exited 0. Proof exit code 0.

## stdout
```text
PASS W01 unrelated URL 404
PASS W02 challenge verified
PASS W03 wrong verify token rejected
PASS W04 invalid signature rejected
PASS W05 valid signature does not falsely acknowledge persistence
PASS W06 oversized body rejected
CONNECT HUB WORKER SANDBOX-SAFE PASS 6/6
```

## Interpretation
Proves isolated Worker protocol skeleton test behavior under Node's Web APIs, not Cloudflare production runtime, independently authenticated PostgreSQL persistence, provider Meta delivery, or consumer handoff.
An HMAC-valid POST intentionally returns 503, so no Meta callback must be registered to this endpoint in its current form. No secret values are committed.
Existing live Worker flat-resonance-09ba not modified.

Gate: LOCAL_WORKER_PROTOCOL_PASS, DURABLE_PIPELINE_BLOCKED, DEPLOY_NOT_RUN, META_SANDBOX_CALLBACK_NOT_RUN, PRODUCTION_NO_GO.
