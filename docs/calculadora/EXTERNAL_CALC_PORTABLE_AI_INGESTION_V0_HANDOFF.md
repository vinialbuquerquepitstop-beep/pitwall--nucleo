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


## Gate 1.7 | Contract parity & ZIP source reference correction (2026-11-12)
Two concrete integration bugs were fixed in existing draft PRs, with no new architecture:
1. `portable-extraction-validator.js` previously omitted `chronology.unbound_partial_updates` even though the diagnostics computed it; `portable-extraction-api.js` forwarded `undefined`, which JSON omitted and the frontend rejected as a response-shape mismatch. Fixed by propagating an integer; a validator regression now checks a real text sequence ('Baixou para R$ 5.200,00') and the API regression checks the integer field. The validator test source ran in isolated V8: 12/12 PASS.
2. Frontend `external-ai-extraction-panel.tsx` previously treated a one-file ZIP as arbitrary pasted text, dropping the actual `zip:<path>` source_ref. Fixed by keeping the extracted ZIP reference set even for a single TXT/CSV, requiring the AI JSON source_ref set to equal the extracted set, and always populating the exact ZIP original-source map. ZIP skipped-file count now prevents the UI from claiming complete coverage. Changes to manual text reset the ZIP-specific reference lock.
3. Executed an integrated isolated V8 request using real GitHub versions of the input validator, original verifier, canonical catalog resolver, C01 preview bridge and API (mocked Auth/RLS fetch and crypto shim). Returned HTTP 200, `unbound_partial_updates=1`, `persistence_allowed=false`, C01 review candidate only. Not an actual Worker, native Node or browser run.
4. Frontend ZIP source_ref and incomplete-coverage path: 5/5 static branch checks PASS; additional checks versioned in `frontend-next/scripts/prove-external-ai-extraction-static.mjs`. Actual Next build/browser gate remains not executed.

No deploy/merge/production writes. Source identity references are now checked in the browser for ZIP input, but a cryptographic proof of WhatsApp origin and an end-to-end archive import still require real authenticated operational testing.


## Gate 1.8 | Existing CI reality + model-less price hold (2026-11-12)
- Inspected **already existing GitHub Actions run** for the backend PR branch commit `42d6e5830...`, run 43320206962 (no new workflow was triggered). Existing List Intake regression was PASS, while the **separate legacy Batch Supplier Intake** proof failed at `ferramentas/external-calc-batch-intake/v0/prova_batch_list_intake_v0.js:248`: expected `result.summary.processed === 3`, got `0`. This is a real native failure in a parallel/underlying flow, **not evidence that the portable-AI suites ran or failed**. The PR cannot be declared globally green. Do not change the batch pipeline as part of the AI branch without a separate regression diagnosis.
- The frontend's already existing `External Calc Frontend CI` on prior commit `43e3db947...` reports FAILURE; logs are temporarily unavailable through the GitHub artifact redirect (BlobNotFound), so do not guess root cause or claim native build result.
- Inspected portable validator chain for partial corrections: `temporalDiagnostics` identifies model-less change and reports `unbound_partial_updates=1`, but the previous `accepted_for_staging` classification left prior offers in that same original message source marked clean. **Fixed**: any offer using a source with an unbound partial price correction now has `UNBOUND_PARTIAL_UPDATE_IN_SOURCE` and `REVIEW_REQUIRED`. No automatic price switch, no unwarranted clean candidate.
- Updated `prova_portable_extraction_v0.js` to assert original-source update causes `needs_review=1`, `accepted_for_staging=0`, with the explicit reason, while retaining `chronology.unbound_partial_updates=1`. Full JSON validator 12/12 cases PASS in isolated V8 with actual current GitHub source. Added a human-friendly Portuguese reason in the frontend.
- **No production write, deploy or merge.** Gate remains HOLD pending native AI runner, full frontend build/browser proof, owner/non-owner JWT real test, batch CI failure triage separate from AI changes, and end-to-end archive/source-to-C01 checks.


## Gate 1.9 | Batch CI failed fixture repaired, no production rule weakened (2026-11-12)
- Existing GitHub Actions backend run 43320206962 (prior SHA 42d6e5830) failed at `prova_batch_list_intake_v0.js:248`: `result.summary.processed` actual 0 versus expected 3. The previous step `Existing List Intake regression` passed.
- Root cause isolated in actual checked-in code: `processListIntakeCommand` now checks `candidateSaved?.ok===true` and `promoted?.ok===true` for required RPC acknowledgements. The legacy batch proof's mocked `extcalc_persist_review_candidate_v0` and `extcalc_persist_auto_promoted_c01_v0` previously returned only `{idempotent:false}`, so processing raised `LIST_INTAKE_PERSIST_ACK_INVALID`, which the batch handler converted to `INTAKE_FAILED` and zero processed rows.
- Repaired **only both test mocks** to return `{ok:true,idempotent:false}`. Preserved strict acknowledgement checks and existing assertions expecting 3 processed, 2 review, 1 auto-created supplier, 1 skipped and 1 rejected. No relaxed domain/DB contract.
- Branch source check after patch: 2/2 acknowledgement mocks now have `ok:true`; both actual production checks for `ok!==true` remain in place.
- **Still requires rerunning the existing native batch proof to verify full 3/3 expectation**. No claim of CI green. Avoid conflating this legacy test failure with execution of portable AI runner; separate approvals.
- No merge, deploy or production writes.


## Gate 2.0 | Native backend CI successful, frontend runner blocked without logs (2026-11-12/13)
- Existing backend workflow `External Calc - Batch Supplier Intake V0` now includes a new **read-only, no-deploy** step `npm run test:external-ai:native`. GitHub Actions run **43336083460** on commit `8b11799489403c6caad73c93f59187102b389937` finished **SUCCESS**. The actual GitHub job logs report `EXTERNAL_AI_NATIVE_GATE=PASS 10/10`, including native ZIP parser, JWT API mocks, original-source verifier, variant binding, temporal corrections, C01 bridge and catalog proof. All existing batch/list intake and worker syntax steps also passed. Batch fixture report: processed=3, review_required=2, auto_created_suppliers=1, skipped=1, rejected=1, failed=0. This is genuine native Node 22 execution, unlike earlier V8-only checks.
- This native proof does **not** test live Supabase JWT or actual published Cloudflare Worker, does not persist C01, and does not establish WhatsApp sender authenticity.
- In frontend PR #101, added independent job `portable-ai-native-frontend-gate` to existing `External Calc Frontend CI` workflow: npm dependencies install, `prove:external-ai-extraction:static`, TypeScript `typecheck`, Next.js production `build` with fixture public envs, no deploy. Workflow run **43336218436**, commit `56bbe624360e2f776dac3cc5cdff4cde7eb1a892`, shows both legacy and new jobs as FAILURE, **without step summaries**; attempted log download failed with GitHub BlobNotFound. Consequently **TypeScript/build have not been proven to execute**, and root cause remains unknown; do NOT claim code compile failure or CI pass.
- The prior restriction to refrain from unsupported native PASS is closed for the backend only, with exact official GitHub Actions evidence. Frontend/UX remains a blocking gate. No merge, deployment, SQL or production write.


## Gate 2.1 | Frontend CI pre-run failure and stale static assertion (2026-11-12/13)
- Inspected GitHub Actions frontend workflow run `43336218436` via GitHub jobs REST. Both `screen-01-to-03-gate` and `portable-ai-native-frontend-gate` ended in ~2 seconds, `runner_name=""` and `steps=[]`. A later run `43338341663` reproduced: both jobs terminated after ~3 seconds with zero steps, no runner. Logs endpoint returned BlobNotFound. This points to **job startup/infrastructure blockage**; cannot infer TypeScript/build failure or confirm GitHub billing/minute quota without account evidence.
- Independently found a stale versioned static assertion: `prove-external-ai-extraction-static.mjs` expected `validateExternalAiExtraction(json: string)`, while the current tenant-scoped adapter signature requires `(json, originals, supplierId)`. Updated the assertion, added selected `supplier_id` propagation and authority checks (no change to operational adapter). The actual JS source clauses over current frontend GitHub branch files evaluated in isolated V8: **22/22 PASS**; this does not establish native `npm run prove:external-ai-extraction:static`, `npm run typecheck`, or `npm run build` PASS.
- A new workflow run after the static corrections was still marked FAILURE with no usable runner evidence. Stop making speculative application changes solely because the workflow is red. Investigate GitHub Actions account/repository runner provisioning, billing/usage/policy controls separately; alternatively use an authorized non-production checkout to run the exact frontend commands.
- Native backend Gate 2.0 remains PASS 10/10 in run 43336083460, plus Batch CI PASS. Frontend is still release HOLD. No merge, deploy, migration, credentials or DB mutation.


## Gate 2.2 | Frontend runner pre-start investigation and alternate build evidence (2026-11-12)
- Confirmed from native GitHub REST run `43338341663` at frontend SHA `4d14a9c1`: both legacy and portable-AI jobs finished with `runner_name=""`, `steps=[]` after ~3 seconds. This was repeated across previous frontend commits and persisted after the stale static check was fixed. No job executed checkout/install/TypeScript/build, and logs are unavailable. The precise administrative root cause remains **unverified**; billing/budgets, Actions permissions and runner assignment should be inspected by an account administrator in GitHub UI before modifying application code.
- Direct `git ls-remote` for private pitstop-calc from ephemeral local Node 22 host still fails DNS to `github.com`; this is not a compiler outcome.
- Connected Vercel project `external-calc-frontend-v1-preview` (project ID `prj_RU8lhoDkZwPMSXM0Au6QWIflXFNa`) exists, but listing deployments filtered to feature branch `feat/external-calc-ai-portable-ingestion-v0` returned none. Consequently no valid Next build for this code is available via Vercel; no new preview/deploy was created.
- Frontend source-only proof was previously corrected to check 3-argument `validateExternalAiExtraction(json, originals, supplierId)` and selected supplier ID. Versioned static checks pass 22/22 when evaluated over current GitHub files in isolated JS. **No native frontend build or browser pass**.
- GitHub documentation indicates GitHub Actions may be blocked by billing/usage budgets or repository/organization policy, but zero-step jobs alone do not identify which cause. Owner action: inspect `Settings → Actions → General` for the repository and account `Settings → Billing and licensing → Budgets and alerts / Usage`; use the exact run URL to inspect the job summary banner and runner assignment.
- Backend native 10/10 in GitHub Actions 43336083460 is unaffected. Release still HOLD, no backend/CRM/bank writes, merge or deploy.


## Gate 2.3 | Read-only operator offer preview, no GitHub Actions (2026-11-12/13)
- Owner explicitly requested **ignore GitHub Actions**. This gate made no workflow edits or invocation. Previous native backend run 43336083460 remains historical evidence (10/10); frontend full Next build is still not proven.
- Source checkout attempted via `git ls-remote` in Node 22 runtime, but GitHub DNS lookup failed, so no legitimate full frontend `tsc`/`next build` was possible. Existing connected Vercel project has no deployment for the unmerged AI branch. No new preview/deploy requested or created.
- Found real UX gap: prior frontend displayed only totals, not the actual extracted offers. The authenticated read-only validation API now returns `review_preview` with `total_offers`, `shown<=20`, and an array of bounded display fields (model, capacity, color, condition, price in BRL minor units), `status:'REVIEW_REQUIRED'`, and deterministic issue reason codes. This is a **preview, NOT an import/review approval feature**. No mutation, persistence enabled or auto-promotion.
- Privacy: preview omits ZIP paths, original text, evidence excerpts, sender/supplier claims and raw AI `offer_ref`. Both per-offer and top-level issue references are mapped to opaque `item-N`. Common phone/email strings in displayed fields are redacted. Phone redaction had an initial partial-match defect (left trailing digits); fixed with digit boundaries and verified on 11-digit, formatted and +55 patterns without damaging 'iPhone 17 Pro Max 256GB'.
- Frontend types and adapter fail-closed validation updated for 20-item cap and review-only statuses; panel renders bounded list with readable price and issue reasons using existing styles. Frontend versioned structural proof evaluated in isolated V8 against current GitHub files: **25/25 PASS** before final redaction-only changes.
- API/review-redaction source executed in isolated V8 with mocked Auth/RLS and verification/C01 components: **7/7 PASS** for HTTP 200, redaction of phone and email including issue refs, opaque linkage, mandatory review status and forbidden persistence. NOT a deployed-Worker or full Next/browser proof.
- Follow-on HOLD: full checkout/native TypeScript and Next build, actual authenticated Worker/WhatsApp ZIP operator pilot, human acceptance of UI, C01 persistence as separate gated decision. No merge, deploy, database write or changes to Pitwall V2 CRM.


## Gate 2.4 | Clarify coverage vs review status in operator UI (2026-11-12)
- Following owner instruction, **no GitHub Actions calls/workflow changes** in this gate. A direct attempt to access the private Github checkout from the available Node 22 host still failed at DNS resolution (`Could not resolve host: github.com`). Therefore no full Next.js typecheck/build/browser proof is claimed.
- Real UX gap fixed in frontend PR #101: prior UI used a positively worded success line whenever `coverage_complete=true` and ZIP skipped files = 0, even when `needs_review>0` or the chronology contained model-less repricing. The status message now distinguishes: (a) incomplete coverage or skipped ZIP archive entries; (b) originals checked but offers/repricing/catalog/other items require review; (c) originals and coverage checked but **all offers still require C01 human approval**. The message explicitly states that no offers were approved or persisted.
- Added static contract checks to ensure the status considers `needs_review`, `unresolved_count`, `chronology.review_flags`, `chronology.unbound_partial_updates`, `catalog_needs_review` and skipped ZIP files. Replaced outdated static assertion looking for the previous condition.
- Evaluated real current frontend branch source inside isolated JS: **28/28 structure checks PASS**, plus **5/5 isolated status scenario checks** (incomplete, review pending, partial price correction, ignored ZIP entry, fully sourced yet C01-human-required). NOT a native Next/TypeScript/browser result.
- Gate remains **HOLD** for full frontend build, real authenticated Worker/ZIP pilot, and C01 authorization. No merge, deploy, DB write or CRM changes.
