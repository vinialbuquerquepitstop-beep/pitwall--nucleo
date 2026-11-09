# TREE | UP-06L — Identidade criptográfica do Pitstop Upgrade
Data: 2026-11-09
Branch: feature/up06k-public-upgrade-port
PR: #202 (draft)
State: LOCAL IMPLEMENTED / NOT WIRED / NO DB WRITE / NO DEPLOY

## Realidade verificada
- External Calc canonical runtime is in `worker/external-calc-worker.mjs` and `ferramentas/external-calc-runtime/v0/runtime.js`.
- Existing user sessions are Supabase bearer tokens, checked at `/auth/v1/user` and `app_usuario`.
- Existing SQL product RPCs derive tenant with `auth.uid()`; existing grants exclude `anon`.
- UP-06K isolated internal port remains disabled by default.

## UP-06L implementation
`ferramentas/external-calc-public-upgrade/v0/service-identity.js`
- Ed25519 JWS/JWT signature check with strict compact, canonical base64url encoding and exact claim allowlist.
- Validate issuer, audience, `pitstop-upgrade-service` subject, tenant, exact single scoped action, timestamps and `jti`.
- Enforce max 300-second lifespan, key-ID lookup, active public key, and deny unknown key and algorithm substitution.
- **Replay prevention is NOT implemented**: requires injected `consumeNonce` that atomically persists-if-absent across all instances and fails closed on storage errors. Tests use a Set as a double only.
- Production key management, signing identity and nonce persistence are not provisioned.
- No runtime registration, public route, Supabase SQL grant, migration, secret or deployment included.

## Local tests
12/12 UP-06L crypto tests PASS with Node 22; generated ephemeral test-only keypair.
Remote CI and integrated regression are PENDING and must not be reported as complete.

## Gates
G0 canonical source: PASS
G1 crypto parser/claim checks: PASS LOCAL
G2 replay contract: PASS LOCAL DOUBLE; DISTRIBUTED PERSISTENCE BLOCKED
G3 key management, issuance, revocation: BLOCKED
G4 Worker wiring and tenant-scoped DB access: BLOCKED
G5 server-side publication and authorized quote: BLOCKED
G6 live security & operational homologation: BLOCKED
Deploy: NOT AUTHORIZED.

## Next slice UP-06M
1. Design and prove non-user, narrow-purpose identity issuance and key rotation.
2. Implement atomic per-`jti` nonce/replay store and fail-closed storage integration, without changing existing user auth.
3. Authorize only read-only public projections through tenant-scoped SQL, with no `anon` grants and no browser secrets.
4. Integrate with existing product calculation services and run cross-tenant, vendor-regression, quota and adversarial tests.
5. Require explicit release authorization, source-SHA preflight and rollback before touching production.
