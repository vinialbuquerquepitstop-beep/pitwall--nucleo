# Connect Hub — Local original-content crypto proof (2026-10-30)

Source: `cloudflare/encrypted-original.mjs`, Git blob `5575ec3eeeaad75ecc08de8ea47334c65d8af97f`. Reconstructed locally byte-identical (git hash-object). Node.js 22.16.0, six assertions passed:

```text
PASS encrypted payload round-trip
PASS random IV differs
PASS no plaintext stored
PASS wrong key rejected
PASS tampering rejected
PASS invalid key rejected
```

The payload was synthetic. No key or real message contents stored in Git.

Follow-up code change `875cdc29`: routed events require encrypted original before DB accept, closing the fail-open possibility where Inbox/Outbox were committed without content. Regression fixtures were updated accordingly but not re-executed during this checkpoint.

LIMITATIONS: Actual encrypted PostgreSQL round-trip with Hyperdrive NOT_RUN. The staging RLS record previously used a non-encrypted dummy marker. End-to-end WhatsApp/External Calc consumer flow remains NOT_RUN. No Cloudflare deployment, no Meta callback, no production modification.
