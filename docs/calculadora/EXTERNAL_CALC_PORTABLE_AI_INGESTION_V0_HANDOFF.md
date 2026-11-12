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


## Gate 1.1: independent operator originals and ZIP text source (2026-11-12)
**Actual implemented branch changes:**
- `original-source-verifier.js` now requires request envelope `{extraction,original_sources:[{source_ref,text}]}`; all sources must be present. Exact source text comparison stops a model from fabricating both an offer and the alleged original quote. A changed/omitted original fails 422.
- `original-zip-unpacker.js` reuses the existing constrained ZIP parser via a new authenticated, **read-only** `/api/external-calc/v0/ai-extraction/unpack` endpoint. Limit: 2MB ZIP compressed, 32 entries, 1MB total uncompressed. Only UTF-8 TXT/CSV is returned; media/unsupported files are explicitly flagged as skipped. Path traversal/ZIP64/bombs are governed by the established reader; a native Node regression is versioned, not yet executed.
- The browser can upload an original ZIP, then populate the original source text or source_ref→text mapping. References from ZIP must use `zip:<entry-path>` and preserve each full TXT/CSV without rewriting it. Raw chat data stays in memory/response for the authenticated operator; this endpoint intentionally returns uploaded original text to the same operator, unlike the validation endpoint, which only returns a summary.
- Validator also marks model, color, condition, capacity and price **value-vs-quote mismatches** for review, rather than trusting confidence scores. Conflicting prices / unresolved source contexts likewise trigger review.
- The operator must supply the original separately. For multi-source input without ZIP, provide exact source_ref→text mapping. Multi-file ZIP coverage is not proven if files are skipped, if content is too large, or if the AI cannot read attachments; never claim complete coverage based solely on the AI's declared count.

**Evidence:** 9/9 independent-original negative/positive cases run in V8 using the actual GitHub code with a Buffer shim. Authenticated endpoint + real C01 staging source in V8 with simulated Auth/ZIP reader: valid source 200, original mismatch 422, invalid JWT 401, ZIP TXT extracted and ignored media reported. Frontend 16/16 static checks on the current branch. ZIP parser's native Node test `prova_original_zip_unpacked_v0.js` and full Next build are **not run**. Supabase/Cloudflare production unmodified.

**Trust limitation:** Independently submitted original text prevents the AI from falsifying the text *relative to the operator's copy*. It cannot cryptographically verify sender authenticity, WhatsApp origin or completeness of an export; that is a separate gate. Source coverage counters remain claims until independently reconciled. `C01 VALID` remains backend-owned, and every staged C01 preview is `REVIEW_REQUIRED` pending a safe authority path.


## Gate 1.2: Canonical model recognition, no implicit C01 approval (2026-11-12)
- Added `canonical-model-resolver.js`: reuses `interpreter-core/v1/core.js` `buildKnowledgeIndex` + `resolveEntityCandidate` and existing `apple-iphone-v0.knowledge.json`. Exact alias/label + capacity match ONLY; never generates fallback identity, never accepts AI-assigned model IDs.
- The read-only C01 preview now carries the existing catalog entity (including model ID) where a unique valid match exists, so `offer_identity_fingerprint` is constructed by the canonical C01 bridge over the real model identity. Unknown models remain human-review candidates with `model.id = null`.
- `resolvePortableOfferStates` groups offers into `CATALOG_RESOLVED_PREVIEW` (recognized in catalog with no detected issue) versus `REVIEW_REQUIRED` (missing/contradictory original, inconsistent declared price/model/capacity, unknown catalog variant, unresolved source or incomplete coverage). This status is **not** `C01 VALID`; ALL candidate snapshots remain `REVIEW_REQUIRED` and none is persisted.
- API returns `c01_preview.catalog_resolved` and `catalog_needs_review`, UI exposes these as informational metrics. Displaying a recognized model is not enough to auto-promote an offer because matching evidence to the *correct* source line/variant is not proven by literal substring alone.
- `prova_canonical_model_resolver_v0.js` versioned: exact iPhone 17 256GB/512GB, 17 Air 256GB, wrong 128GB, unknown iPhone 18 Pro Max, capacity mismatch, unknown variant, missing capacity, source/coverage/price issues. **14 checks PASS** in V8 with actual GitHub resolver/core and catalog.
- Integrated V8 test: external AI JSON + validated independent original -> real C01 bridge in memory -> `iphone_17_256gb`, `REVIEW_REQUIRED`, 0 auto promotions, 0 DB mutations. Not native Node, Cloudflare nor database E2E.

**Regression fixed in Gate 1.2:** initial real-bridge regression found catalog IDs were being attached to C01 previews even without independent original verification. The bridge now attaches canonical model identity only if the offer is classified `CATALOG_RESOLVED_PREVIEW` (verified original + no detected issues). Otherwise it keeps `model.id=null` and requires review. The versioned real C01 bridge proof now passes **17/17 assertions** (V8, crypto shim), including both unverified and verified paths.\n\n**Remaining blocker**: source-line-to-variant binding, multi-message chronology and duplication/reprice adjudication, operator-confirmed supplier tied to JWT tenant, native Node/build/runtime and read-after-write. Do not enable C01 write until these checks are demonstrated and authorized.
