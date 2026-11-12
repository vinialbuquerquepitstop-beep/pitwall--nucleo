# External Calc | Portable External AI Ingestion V0

Status: GATE 1 (protocol + authenticated validation + read-only C01 preview) implemented, NOT deployed. 2026-11-12.

## Objective
The operator copies a Markdown extraction protocol from the existing Calculadora; takes it to the AI service of their choice along with a supplier list, WhatsApp text or a ZIP that the AI can open; returns JSON; the External Calc inspects the JSON and source evidence, previews C01 review candidates and routes missing/conflicting data to review instead of silently inventing it.

## User path
1. Select existing supplier in Calculadora.
2. Expand `Nova opção: interpretar com IA externa (JSON estruturado)`.
3. Click `Copiar protocolo .md` and paste into any AI chat.
4. Paste data in that chat. Do not send group phone numbers, private addresses, credentials, or other unnecessary PII. Third-party AI privacy/retention policies apply. The AI must be able to read the attachment/ZIP; no guarantee all models support them.
5. Paste or upload the resulting JSON in the app and click `Validar extração`.
6. UI displays staged counts, C01 preview counts, unresolved evidence and review issues. **No offers are written or promoted in this gate**.

## Executable contracts
- `external-calc-extraction-v0.schema.json` (2020-12) for portable file format.
- `portable-extraction-validator.js`: strict allowlist, up to 1MB JSON, 100 sources, 300 offers, source excerpt quote inclusion, field-specific evidence, invalid source refs and unknown properties rejected, numeric prices in integer minor units, coverage reconciliation, conflicting price for same variant, unresolved source context.
- `external-ai-c01-preview.js`: uses existing `mapBundleToC01ReviewQueue` to produce C01 **REVIEW_REQUIRED** candidate previews, deterministic staging IDs, model ID null, no fake C01 authority confidence, no auto promotions or DB calls, source_ref retained in lineage. Candidate with absent model or price stays pre-C01 review only.
- `portable-extraction-api.js`: authenticated POST `/api/external-calc/v0/ai-extraction/validate` on the EXISTING Worker. Check JWT via Supabase Auth, no DB writes, no untrusted source text echoed. Returns `persistence_allowed=false` and `c01_import_ready=false`.
- Frontend optional disclosure; existing supplier-intake remains unchanged.

## Grounded security caveats
**A literal quote in a source only proves the quote exists in submitted text. It does NOT prove that the quote belongs to the declared model, price, supplier or variant.** An external AI is not an authority on C01. The extracted source text is also supplied by the operator/AI and can be adulterated; original source/archive verification must occur in the next gate.

No supplier selected in the UI can be treated as authenticated tenancy in the JSON. The staging source IDs are not persisted; the final source ID must be namespaced by server-authenticated tenant and supplier and original source digest.

## Next gate: C01 authority + controlled persistence
- Independent reconciliation of raw source/archive, per-field quote ownership, sender/timestamp when available, de-dup and updates, per-supplier linking, model catalog resolver and price semantics.
- Deterministic C01 promotion only if required evidence and internal independent authority checks pass. Other candidates go to actionable human review, not a blanket approval.
- Authenticated server-side tenant ownership/RLS and supplier binding, paginated write <=8 candidates, existing immutable C01 conflict detection. No new parallel C01 engine.
- Prove long ZIP, text, forwarded WhatsApp messages, multi-supplier collisions, prompt injection, fake price, quoted different variant, truncation and partial retry. Test native Node, Next typecheck/build, Cloudflare Worker and read-after-write before rollout.
- End-user consent/privacy and retention for files sent outside the app.

## Evidence currently executed
- JSON validator: 11/11 source-level V8 harness cases (real validator source from GitHub, Buffer shim).
- C01 preview bridge: actual C01 bridge from backend, 11 assertions PASS with fake crypto in V8. No Node native/DB.
- Auth endpoint: mocked Supabase Auth shows 401 no bearer, 401 invalid bearer, 200 valid, 422 fabricated quote; no source text returned. No live network auth test.
- Frontend static: 10/10 structural checks over actual GitHub source. Not Next build/browser.
- Worker route exists in `worker/external-calc-worker.mjs`, not deployed.

## Ownership & release
Backend PR #209 based on #208; frontend PR #101 based on #100. No merge/deploy/migration, no changes to Pitwall V2 CRM. External Calc Quality 24/25 legacy reconciliation is a distinct operational recovery gate.
