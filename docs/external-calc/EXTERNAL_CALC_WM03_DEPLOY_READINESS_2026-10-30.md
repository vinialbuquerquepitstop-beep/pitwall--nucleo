# WM03 | Post-encryption transactional regression and deploy readiness
Date: 2026-10-30. Chat B, PR #201.

## Local execution
Node.js 22.16.0: reconstructed the current `ingress-transaction-v0.cjs` algorithm and current `proof-ingress-transaction-v0.cjs` fixture from their GitHub contents and executed the eight-case suite locally. All 8 passed, including mandatory encrypted_original and rollback upon original persistence failure.

Result: `WM034B TRANSACTION MOCK PASS 8/8`.

Caveat: this was a local reconstruction of the fetched implementation, **not a byte-for-byte verified checkout** and not an actual Postgres client integration. The real staging SQL concurrency evidence is recorded in prior checkpoints and remains separate.

## Current deployment preflight
Dedicated `cloudflare/wrangler.json` points to `pitstop-connect-hub-staging` and Hyperdrive ID `6a35651fc97f4a34b0850fbc9abc0de7`; `nodejs_compat` enabled. The existing production Worker `flat-resonance-09ba` is a separate configuration.
Cloudflare account/control-plane access is not connected to this assistant. No deploy or secret injection occurred in this step.
Secrets that must be bound to the dedicated Worker: `META_APP_SECRET`, `META_VERIFY_TOKEN`, `PCH_ORIGINAL_AES256_KEY`. Sandbox-only routing settings: `PCH_SANDBOX_PHONE_NUMBER_ID`, `PCH_SANDBOX_ALLOWED_SENDER`, `PCH_SANDBOX_PROVIDER_SCOPE`, `PCH_STAGING_TENANT_BINDING=pch_app_tenant_a`. `PCH_STAGING_INGRESS_ENABLED` must remain unset/false until a real Hyperdrive + DB acceptance proof.
Before registering a callback in Meta: deploy dedicated Worker, check Worker HMAC negative tests, test Hyperdrive role/tenant, test encrypted content stored and readable under A / denied under B, verify consumer reference and payload batch atomicity. Do not claim Meta E2E before it exists.

## Outstanding architectural defect to resolve
Current POST handles each event in a batch sequentially and may commit a prefix before returning 503 on later failure. Meta may retry the whole batch. Deduplication should avoid duplicates but this is not a truly batch-atomic commit. Document or implement batch transaction / retry contract before production approval.
