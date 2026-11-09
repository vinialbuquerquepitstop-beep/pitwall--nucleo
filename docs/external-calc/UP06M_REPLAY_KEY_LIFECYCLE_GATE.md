# TREE | UP-06M — Replay distribuído e rotação de chaves (proposta)
Data: 2026-11-09
Branch: `feature/up06k-public-upgrade-port` | PR #202 (draft)
State: CODE ONLY / NOT WIRED / NO MIGRATION / NO DEPLOY.

## Implementado
- `replay-store.js`: nonce hashed SHA-256, interface `atomicInsert`, replay fails closed when unavailable or invalid.
- `key-registry.js`: lookup read-only, accepts only active/retiring public Ed25519 keys inside validity window; revocation denies immediately at lookup.
- `replay-store.test.js` and `key-registry.test.js`: 9 newly added tests; with inherited service-identity tests, **21/21 tests pass locally** (Node 22).
- SQL proof-of-concept only in downloadable UP-06M package, explicitly **NOT for execution**, showing private table, unique digest and no public grants. No SQL pushed as a migration.

## Unverified live dependencies
1. Implement transactional atomic insert-if-absent in durable shared persistence and provision isolated principal — NOT PRESENT.
2. Secure private signing service, key lifecycle and rotation/revocation — NOT PRESENT.
3. Worker wiring to existing domain/rate/tenant mechanisms — NOT PRESENT.
4. Prove role/tenant isolation in actual DB; validate service token against actual endpoint — NOT DONE.
5. Cross-instance concurrency, audit, rate-limiting, abuse/operational failure and rollback proofs — NOT DONE.

## Gates
A0 branch+PR: PASS.
G1 local replay contract: PASS (synthetic shared insert).
G2 public key lookup: PASS (test key).
G3 persistent replay database: BLOCKED.
G4 issuance/rotation in service: BLOCKED.
G5 E2E production readiness: BLOCKED.
G6 merge/deploy: NOT AUTHORIZED.

**Don't merge or publish.** This slice does not make public Upgrade requests operational.
