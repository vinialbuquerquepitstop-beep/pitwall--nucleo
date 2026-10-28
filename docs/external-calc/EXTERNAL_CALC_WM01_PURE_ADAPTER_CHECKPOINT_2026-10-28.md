# WM-01 — WhatsApp source transport adapter checkpoint (2026-10-28)

## Status
`CODE_COMMITTED` / `REMOTE_FILES_VERIFIED` / `NODE_TESTS_NOT_RUN` / `NO_DEPLOY` / `NO_META_CONNECTION`.

## Artifacts
- `ferramentas/external-calc-whatsapp/v0/whatsapp-source-adapter-v0.cjs`
- `ferramentas/external-calc-whatsapp/v0/proof-whatsapp-source-adapter-v0.cjs`

## Scope
Pure CommonJS transport normalization; no routes, background jobs, database, C01 writes, Meta credentials or calls.
Checks payload byte limit before parsing; verifies raw-byte `X-Hub-Signature-256` HMAC with constant-time comparison before reading JSON; GET challenge token verification; parses WhatsApp messages-only webhooks and plain-text messages; uses server-owned allowlist indexed by phone_number_id and sender to identify tenant and supplier. Ignores non-text/status/unknown phone number/unknown contact. Emits non-authoritative `external-calc-whatsapp-source-event/v0` records with source_event_key based on Meta message identity and original SHA-256.

## Limitations / mandatory downstream gate
- In-memory within-payload duplicate suppression only. Transactional dedup across deliveries is NOT IMPLEMENTED.
- Signature authentication does not establish tenant authorization on its own. Allowlist must be loaded from trusted DB. Cross-tenant JWT A/B still required.
- App webhook GET/POST HTTP route and Meta deployment are NOT IMPLEMENTED.
- Original append-only storage, atomic persistence and handoff to F1 are NOT IMPLEMENTED.
- Privacy: rejected client text is not returned by adapter; prohibit logging whole webhook payload upstream.
- No access to ordinary WhatsApp groups via coexistence.
- F1 staging E2E/Cloudflare still blocked; no merge to main or production.

## Execute proof on appropriate local Codex checkout
```bash
node --check ferramentas/external-calc-whatsapp/v0/whatsapp-source-adapter-v0.cjs
node --check ferramentas/external-calc-whatsapp/v0/proof-whatsapp-source-adapter-v0.cjs
node ferramentas/external-calc-whatsapp/v0/proof-whatsapp-source-adapter-v0.cjs
```
Expect 15 named synthetic checks if the script executes successfully. Do not claim PASS before inspecting actual stdout and exit status.

## Order
1. Complete F1 staging Worker deploy and real JWT A/B E2E through PR #200.
2. Execute WM-01 local proof on committed files; fix failures without touching frozen Core.
3. Design durable idempotent queue and server authorization bridge (least privilege).
4. Verify Meta number coexistence eligibility and customer-care impact with real onboarding evidence.
5. Pilot only private-message allowlisted supplier test contacts, no outbound send.
