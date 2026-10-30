# Connect Hub | encrypted original, staging execution
Date 2026-10-30 | PR #201 | Chat B

Completed:
- Added ingress_originals table in isolated Neon project purple-violet-98259937 with ingress_event_id FK, AES-GCM ciphertext+IV schema, forced RLS and role-specific policy.
- Privileges SELECT, INSERT granted only to pch_app_a_login and pch_app_b_login (among app roles).
- INSERT marker under pch_app_a_login succeeded on existing *synthetic* event 8fa3d775-bbb0-442a-a5b3-82b9fa162901. Role A SELECT count=1; independently authenticated role B SELECT count=0.
- Marker is NOT AES ciphertext and is not evidence of encryption round trip.
- Code now supports AES-GCM encryption at Worker ingress, encrypted original insertion in same transaction, and an internal decryption helper. The key PCH_ORIGINAL_AES256_KEY is not configured in Cloudflare in this evidence, no keys or message bodies are committed.

Remaining: exact-source encryption round-trip test, secure provider-content reference/consumer contract, atomic DB adapter integration, dedicated Worker deployment+Hyperdrive and Meta sandbox callback. Do not enable PCH_STAGING_INGRESS_ENABLED; no real message ingestion confirmed.
