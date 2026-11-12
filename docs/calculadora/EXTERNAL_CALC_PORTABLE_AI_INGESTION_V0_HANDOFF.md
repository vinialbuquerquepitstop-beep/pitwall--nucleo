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


## Gate 1.3: source-row to variant/price binding, fail closed (2026-11-12)
- New `variant-price-binding.js`, called from `portable-extraction-validator.js`, checks **independently supplied original source text** line location for model, price, color and capacity quotations, rather than accepting quotations merely because they exist anywhere in the source.
- Conservative review triggers: model/price references to different sources; model/price quote repeats; two prices or two model headings on a line; price before model; blank paragraph boundary; intervening model/price row without explicit color association; color quote attached to another price row; capacity quote outside the chosen model-to-price block.
- Explicit multi-color under one model heading is accepted when each price row has its own unique matching color citation, and original quote references are unambiguous. The validator routes only the affected variant to review if a blue item's price is taken from the black item's row.
- `prova_variant_price_binding_v0.js`: **12/12 PASS** using actual GitHub source in V8. Includes correct one-line and multi-color cases, crossed color, mixed Pro/Air, repeated model quote, cross-source binding, unscoped capacity, price before model, paragraph boundary.
- `prova_quality_multicolor_binding_v0.js`: **4 assertions PASS**: two valid variants staged; wrong blue price sourced from black line causes only blue to require review.
- Previous validator 11/11, independent sources 9/9 and C01 preview 17/17 regressions retested after changes and remain PASS in isolated V8. Native Node, worker and browser are still NOT demonstrated.
- Frontend existing UI now maps binding issue codes to legible Portuguese review reasons. Validation remains read-only, `persistence_allowed=false` and all C01 snapshots remain REVIEW_REQUIRED.

**Scope limitations:** evidence-location matching is conservative and deterministic, not a universal natural-language proof. Complex nested message chains, inherited stock/condition, mixed source files, temporal updates and same-row ambiguous tables may be flagged for review. Unknown or unsupported formats should not be silently accepted. Source completeness and origin authenticity are distinct gates.


## Gate 1.4 | WhatsApp message chronology, conservative dedupe (2026-11-12)
- New `temporal-offer-diagnostics.js`: identifies two common Brazilian WhatsApp export header forms (bracketed and unbracketed date/time/sender). Validates calendar dates, separates message spans by source text position, and associates unique price citations with their containing message.
- For offers of the same exact model/capacity/color/condition **within the same source and claimed sender**, repeated amounts trigger `REPEATED_SAME_PRICE_MESSAGE` (or `POSSIBLE_DUPLICATE_OFFER` when ordering is not verified). Different amounts trigger `HISTORICAL_PRICE_UPDATE_REQUIRES_REVIEW` if timestamps are uniquely ordered, otherwise `CONFLICTING_PRICE_CHRONOLOGY_UNKNOWN`.
- Separate source files or different claimed senders are *not* automatically merged; the JSON's `supplier_ref` is not authenticated identity. Date/time strings are untrusted and not authoritative for selecting a price. **The system never chooses a latest price, rewrites past C01 revisions or merges offers in this gate.**
- The validator includes chronological issues in the same selective-review routing; API returns chronology issue counts only with `latest_selected:false` and `chronological_authority:false`. Frontend checks both flags, shows counts and Portuguese explanations, no optimistic auto-update.
- `prova_temporal_offer_diagnostics_v0.js`: 7/7 PASS on actual source in V8: ordered price change, duplicate amount, different sender, missing/invalid dates, separate files. Initial regex parser syntax error was detected and corrected before pass.
- Regressions after integration: existing JSON validator 11/11, independent original 9/9, multi-color price binding 4/4 PASS in V8; frontend new contract and text checked statically.

**HOLD:** Full WhatsApp archive authenticity, date timezone corrections, multi-chat supplier reconciliation, partial updates that omit model, deduplication across files, and independently verifiable latest valid price remain unsettled. No C01 persistence/auto-promotion is enabled. Native Node/Next build and live Worker auth still pending.


## Gate 1.5 | Session-scoped supplier authority + partial message updates (2026-11-12)
**Read-only, branch implementation only, NOT deployed.**
- `supplier-session-authority.js` checks the selected supplier UUID through `GET /rest/v1/extcalc_supplier?select=supplier_id,name&supplier_id=eq.<uuid>&limit=2`, using the caller's **JWT** and `SUPABASE_ANON_KEY` only. Existing Supabase RLS migration `20261001192000_external_calc_supplier_context_v0.sql` restricts authenticated reads to `tenant_id=privado.fn_tenant_atual()` AND `privado.fn_papel_atual()='dono'`. No new security-definer RPC, service-role credential or DB mutation.
- Validation endpoint now **requires `supplier_id`** and fails closed on inaccessible or malformed ID; it rejects a non-null AI `supplier_ref` that differs from the RLS-visible supplier name, rather than trusting AI supplier assertions. It returns `supplier_authority: { verified:true, scope:'RLS_AUTHENTICATED_READ', supplier_id }` as a read-only finding, **not source authenticity**.
- Existing frontend passes selectedSupplier.supplier_id explicitly; adapter validates the returned ID and `verified=true`. The previously created Markdown prompt and input scheme stay additive.
- `temporal-offer-diagnostics.js` now marks model-less price corrections (e.g., 'Baixou para R$ 5.200,00') as `unbound_partial_updates`. This never assigns the corrected price to the preceding offer. UI displays count as a pending independent source review, not an eligible C01.
- The existing timestamp/claimed sender fields are not WhatsApp authenticity evidence. Matching user-selected registered supplier to the caller's tenant proves ownership of a **registry record**, not whether a group participant was that supplier or whether a message is trustworthy.
- The validation endpoint remains `persistence_allowed=false`, `c01_import_ready=false`, `auto_promoted=0`; all C01 snapshots remain `REVIEW_REQUIRED`.

**Evidence:** 6/6 scenarios in the supplier check's actual JS source with network mocked (visible supplier, cross-tenant empty read, mismatched supplier, forbidden, missing JWT, malformed ID); endpoint with actual supplier authority, Auth/RLS responses mocked: 5/5 HTTP cases (200/403/401/422/401). Temporal parser 8/8 assertions with added unbound partial update case. Frontend 9/9 structural supplier/temporal contract checks. Tests executed in V8 isolate; **native Node, Next build, live authenticated Worker and RLS behavior in deployed Supabase are not yet proven in this gate.**

**Next release gates:** actual Node/Next/ZIP tests; live authorization with real owner and non-owner sessions; exhaustive supplier alias/phone identity adjudication; original WhatsApp export provenance, multi-file/long-list coverage and safe persisted offer replay; C01 preview→persistence idempotency and read-after-write. Review-only partial update must never overwrite historic price without explicit source and operator adjudication.


## Gate 1.6 | Native harness prepared + production RLS policy inspected (2026-11-12)
- Added `ferramentas/external-calc-ai-extraction/v0/prova_native_gate_v0.js`, an **offline, no-network** Node runner for 10 suites: JSON, original sources, variant-price, two-color, WhatsApp chronology, canonical catalog, real C01 bridge, selected supplier session, API JWT, ZIP reader.
- Exposed `npm run test:external-ai:native` in the backend repository package.json. In the frontend, `npm run prove:external-ai-extraction:static`, `npm run typecheck` and `npm run build` are the follow-up commands.
- **Current limit:** The available execution host has Node v22, but GitHub cannot be cloned directly due DNS/network restrictions. Connector fetches files for isolated V8 exercises, but no verified native checkout has been built. Consequently `test:external-ai:native`, TypeScript/build and browser gates are **NOT EXECUTED**. Avoid reporting native PASS.
- Real External Calc Supabase project `unjzpyexgtbcmjfgcqrx` was inspected with SELECT only: `public.extcalc_supplier` has `relrowsecurity=true`, an authenticated SELECT grant and SELECT policy expression `tenant_id = privado.fn_tenant_atual() AND privado.fn_papel_atual() = 'dono'`. This confirms the RLS policy exists in the live DB, but does not replace testing actual owner/non-owner access JWTs.
- The deployed Worker `flat-resonance-09ba` already has `nodejs_compat` in its tracked wrangler config. No new Worker created.
- **HOLD:** no merge, no deploy, no writes, no production test using personal WhatsApp archives; no release until native/backend API tests and Next typecheck/build/browser are really green. Gate 2 C01 authority and paginated persistence remain distinct from validating this staging UX.


## Gate 1.6 follow-up | Private text sanitization and syntax audit (2026-11-12)
- Direct clone of private GitHub repository from the available Node 22 runtime was independently attempted and failed at DNS resolution (`Could not resolve host: github.com`). Therefore neither `npm run test:external-ai:native` nor full Next typecheck/build was executed; do not elevate isolated V8 checks to native PASS.
- All 20 backend external-AI `.js` implementation/test/runner files were fetched from the current GitHub branch and individually compiled with the JavaScript Function parser: **20/20 syntax checks PASS**. This is syntax-only, not an execution, test suite or bundler proof.
- Security issue found: `portable-extraction-api.js` used to return raw `String(e.message)`; malformed JSON parser exceptions can include excerpts of uploaded supplier/group messages in a response. Fixed by `safeApiError()`, which emits only allowlisted error codes and controlled generic messages, never raw parse exceptions or ZIP filenames.
- Added regression to `prova_portable_extraction_api_v0.js`: submit deliberately malformed JSON containing a private marker; request invalid ZIP with private marker; assert that responses do not echo the markers. Test remains committed but not executed in native Node.
- Ran latest real API source through V8 with mocked Supabase RLS/Auth, original verification, ZIP and C01 preview: malformed JSON returned 400 without leaked text; invalid ZIP returned 422 without leaked text; valid validation returned 200. **3/3 isolated checks PASS**; not a production Worker or native Node result.
- Actual External Calc supplier RLS policy had already been verified read-only in Supabase; this proves policy presence, not live HTTP role isolation with real JWTs.

**Release HOLD:** run the ten suites natively from a fully checked-out branch, run Next typecheck/build, validate real Worker and JWT role cases, then decide on bounded persistence C01 separately. No merge, deploy, migration or write on production in this follow-up.
