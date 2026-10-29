# TREE | Connect Hub isolated Worker staging checkpoint
Date: 2026-10-29
Owner Chat B, PR #201.

## New code
- `ferramentas/external-calc-whatsapp/v0/cloudflare/connect-hub-worker.mjs` (commit `0e7a27e2485e4f33a88be53a092a70b647cf2892`)
- `ferramentas/external-calc-whatsapp/v0/cloudflare/wrangler.json` (commit `77836c62dade31e8766da435bebb1a86dee8a17c`)
- `ferramentas/external-calc-whatsapp/v0/cloudflare/proof-connect-hub-worker.mjs` (commit `d9be4eecebc2e2d6b2b4a331d1d372db94ca8252`)

## Separation
This is a new Worker named `pitstop-connect-hub-staging`, NOT existing live `flat-resonance-09ba`. The main live wrangler configuration remains untouched, along with existing Pitsquad privileged WhatsApp route.

## Behavior
GET /meta/webhook validates verify token, responds with challenge; POST verifies HMAC SHA256 over raw bytes with 256 KiB cap. Even with a valid HMAC the endpoint intentionally returns 503 (not durable). No DB client or event routing is wired. The endpoint MUST NOT be registered as a Meta callback while it has this behavior. Secrets are expected from Cloudflare secret environment, not git.

## Execution state
Code committed. Test file committed but NOT EXECUTED under Node/Workers in this checkpoint. Deployment NOT_RUN. No claim of Meta callback delivery, inbox persistence or consumer integration.

## Next
1. Run exact-source local protocol test and record output.
2. Review correct Cloudflare account/Worker project; only deploy isolated staging under explicit credentials.
3. Complete restricted Neon workload connections, real Inbox/Outbox commit and security gates.
4. Wire only approved durable path, then Meta sandbox callback; never the commercial number implicitly.
