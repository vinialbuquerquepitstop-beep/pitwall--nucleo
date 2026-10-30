# Tree META-03.3 — webhook handler negative test checkpoint
Date: 2026-10-28
Owner: Chat B; PR #201; branch `feat/external-calc-whatsapp-source-adapter-wm00-20261028`
State: LOCAL_SYNTHETIC_12_OF_12_PASS / INTEGRATION_NOT_RUN / DEPLOY_NOT_RUN

## Code
New executable test: `ferramentas/external-calc-whatsapp/v0/proof-meta-webhook-http-handlers-v0.cjs`
Commit: `4af54d6de0c9582b09febeab787622384aee41f7`
Existing handler remains unchanged. No CRM, F1, C01-C05, Meta credentials, number or production changes.

## Execution and provenance
Node v22.16.0 in isolated /mnt/data/meta03 directory.
Executed the proof tests with the webhook handler reconstructed from GitHub connector content and a REDUCED local WM-01 parser/signature implementation. This is not exact source reproduction of the full WM-01 dependency, nor an authenticated Git checkout. Do not describe it as full integration testing.
All 3 `node --check` syntax checks returned 0. Test command exited 0.

## Actual stdout
```
PASS H01 matching verification challenge
PASS H02 wrong verification token
PASS H03 authorized supplier yields retryable 503 until durable queue exists
PASS H04 unknown sender not emitted to supplier sink
PASS H05 wrong phone ID not emitted to supplier sink
PASS H06 altered bytes rejected
PASS H07 missing signature rejected
PASS H08 oversized payload rejected
PASS H09 status-only notification ignored
PASS H10 unsupported media ignored
PASS H11 no secrets configured fails closed
PASS H12 handler never returns original text in HTTP body
META03 WEBHOOK EXACT-SOURCE SYNTHETIC PASS 12/12
```
Note the test runner's own label 'EXACT-SOURCE' refers to proof fixture content, NOT to all dependent GitHub source bytes; this distinction is essential.

## Safety observation
Authorized supplier events return 503 because no durable queue exists. This prevents misleading 200 acknowledgements but can cause provider retries and eventual message loss if webhook were connected. Therefore NOT production-ready and do not configure a Meta callback yet.
Unknown senders are acknowledged with 200 but not delivered to a CRM consumer; the future CRM contract must decide lawful restricted handling, retention and authorized handoff.

## Next gate
Implement and prove a durable inbox with transactional idempotency and tenant authority in an isolated service after contract approval by Chat A/CRM. Then use exact-source checkout tests and deploy isolated staging HTTPS. Until then callback is NOT_RUN and no connection of commercial phone is permitted.
