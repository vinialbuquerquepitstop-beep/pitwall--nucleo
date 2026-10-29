# META-03.2 — Webhook handler checkpoint (2026-10-28)
Status: CODE_COMMITTED / LOCAL_SYNTHETIC_PASS_7_7 / DEPLOY_NOT_RUN / REAL_WEBHOOK_NOT_RUN

## Ownership
Chat B PR #201 only. No F1, C01-C05, Pitwall V2 or Pitsquad changes.

## Implementation
`ferramentas/external-calc-whatsapp/v0/meta-webhook-http-handlers-v0.cjs`
Commit: `8cd535b40896f9ea5504c1dc3da5cb19b5030fd2`.

Framework-neutral GET challenge and POST handler factory. Depends on previously committed WM-01 signature verifier/parser. No HTTP listener, no deployed URL, no persistent queue, no CRM registration, no Meta credentials, no number registration.

Authorized supplier input deliberately returns HTTP 503 until a durable authorized intake exists, preventing silent acknowledgment of unsaved business events. Unknown senders are not forwarded to External Calc. This is a deliberate safety placeholder, NOT a production-ready behavior; future CRM routing requires an independently authorized restricted destination.

## Local test evidence
Node v22.16.0. The test ran a local reconstruction of the handler and a REDUCED local reconstruction of the WM-01 adapter dependency, not an exact full checkout. This means the test verifies selected handler behaviors, not end-to-end code provenance and not the complete WM-01 dependency.

```
PASS valid challenge
PASS wrong challenge token
PASS valid supplier no durable queue => 503
PASS unknown client not passed to supplier => 200
PASS invalid HMAC =>401
PASS oversize =>413
PASS missing config fail closed
META03 HANDLER PASS 7/7
```
Syntax check of local handler exited 0; test runner exited 0.

## Missing gates
- Complete checked-out branch tests: NOT_RUN
- Durable idempotent queue: NOT_RUN
- Trusted server-side tenant authorization: NOT_RUN
- CRM consumer and consent contract: NOT_RUN
- Real HTTPS deployment + security checks: NOT_RUN
- Meta callback GET/POST to owned infrastructure: NOT_RUN
- Verification of original exposed temporary Meta access token invalidation: NOT_VERIFIED
- Real number coexistence: NOT_RUN

## Next
Before providing a Meta callback URL, implement a real deployed transport endpoint and a durable authorized source intake, plus exact-source integration tests, secrets held only in host vault and fail-closed routing of customer data. Do not activate webhook, production or commercial number on this gate.
