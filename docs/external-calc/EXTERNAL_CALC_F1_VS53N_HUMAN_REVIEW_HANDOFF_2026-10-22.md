# External Calc — F1 VS53N Human Review Staging Gate (2026-10-22)

## Objective
Complete staging foundation for genuine human review without overriding C01 auto-promotion authority, without opening direct table SELECT or claiming premature VALID quoteability. No GitHub Actions; no production DB/deploy/merge, no migration authorization implicit in this branch.

## Proven baseline (read-only)
- Staging `mfsshvckclnmftpaprxk` (PitswallV2) already has the six C01 tables and original-source record store from VS53L, Auth A/B and guarded `extcalc_persist_review_candidate_v0`, `extcalc_persist_auto_promoted_c01_v0`.
- Absent from staging: `public.extcalc_list_pending_review_candidates_v0(integer)`, `public.extcalc_persist_review_result_v0(jsonb)`, and original JS repository needs a **third** endpoint to safely load one candidate. Direct `SELECT` from `extcalc_review_candidate` was revoked.
- Canonical historical migrations in `supabase/migrations/20260919231000...`, `20260919232500...`, `20260922184500...` exist in main but **do not match VS53L staging table schema and constraints**. They must NOT be applied unchanged: existing `extcalc_offer_revision` accepts only `VALID` and has candidate FK on same revision, whereas C01 HumanReview Core supports material EDIT (revision+1), EXCLUDED and INVALID.
- F0 previously exposed `/revisao` fixture-only (`getReviewScenario` plus `scenario.saveResponse`), an isolated frontend pilot now lives on branch `pitstop-calc:feat/external-calc-f1-real-review-pilot-20261022`. Do not replace frozen /revisao before QA.

## Delivered, code only
Branch `feat/external-calc-f1-staging-human-review-20261022`:
- `ferramentas/external-calc-c01-review/v0/staging/VS53N_C01_HUMAN_REVIEW_RPC_DRAFT.sql`: exact staging-only atomic proposal with strict owner/Supabase staging preflight.
- `.../VS53N_C01_HUMAN_REVIEW_DRY_RUN_ROLLBACK.sql`: exact duplicate, only COMMIT→ROLLBACK.
- PRIVATE RLS+FORCE table `privado.extcalc_c01_review_decision_stage_v0`; all direct grants revoked; immutable, one decision per tenant+candidate revision; full JSON C01 reviewed snapshot with independent record timestamp and actor.
- Three public tenant-bound authenticated RPCs: queue `extcalc_list_pending_review_candidates_v0(integer)`, row `extcalc_load_review_candidate_v0(text,text,integer)`, audit-only receipt `extcalc_persist_review_result_v0(jsonb)`. No extra tenant ID accepted as authority. `security definer` owner postgres, explicit REVOCATION of default PUBLIC/anon EXECUTE, grant authenticated only.
- Critical write fence `extcalc_c01_no_promotion_after_review_v0` on `extcalc_offer_revision`: **if a review decision already exists on that offer**, blocks the legacy auto-promotion INSERT or UPDATE. Existing autority RPC was not edited; review record does not write offer revisions.
- `postgres-review-candidate-repository.js` backend repaired to use row load RPC, removing unsafe `GET /rest/v1/extcalc_review_candidate` direct SELECT. Existing repository test fixtures updated to require POST RPC and avoid tenant selection on the client.
- Frontend pilot counterpart upgraded: no production Worker fallback, nonproduction Review API HTTPS env var mandatory, proxy protects route, receipt must be `RECORDED_AWAITING_C01_AUTHORITY`; UI says 'decisão registrada, não liberada para cotação'. Pending status is not success at C01 domain authority.

## Verified this turn
GitHub fetched exact current SQL/files and checked 14 static controls, all PASS: staging-only guard, BEGIN/COMMIT=1, dryrun exact with ROLLBACK, quoted SQL dollar tags balanced, five functions, two triggers, client load via RPC, auth/tenant scoping, no direct quote insert, no anon grant, quarantined source rejection, promotion fence, audit-only receipt, updated test fixtures. **This is static proof only**. No SQL compiled or executed on PostgreSQL in this turn.

## Remaining blockers (do not mark PASS)
1. **Dry-run in correct staging SQL Editor**: execute **only** the `VS53N_C01_HUMAN_REVIEW_DRY_RUN_ROLLBACK.sql` with an admin in `mfsshvckclnmftpaprxk`; all transactional changes discarded. Report full error if any. No production. A successful dry run proves SQL compilation and postflight, not behavioral AB.
2. If dry-run PASS, review exact COMMIT version and apply only in this staging with explicit operator step; verify functions + table + RLS + ACL + fence. SQL Editor apply is not a recorded Supabase migration; reconcile separately.
3. Run synthetic AB signed-JWT **positive + negative** queue/read/ACCEPT/EDIT/EXCLUDE/idempotency/races, owner v non-owner, quarantine and fence. Verify audit rows exist only during test transaction, no quote revisions created by human review, cleanup. No service keys in chat/logs.
4. Configure a separate **nonproduction Worker review API** wired to the above RPCs. Existing Worker production origin must never be used as shortcut. Run local TypeScript/build and browser proof on `/revisao-c01-piloto` against live staging.
5. Design/implement missing-item recovery, lineage and validator-controlled promotion; the existing Core `applyHumanReview` acts on a preexisting candidate only. Until then F1 not PASS for complete list intake.
6. Independent generalization holdout is still unavailable and DEV benchmark 3/33 strict matches — no automatic intake release.
7. Production #178/#179/#180 draft quarantine untouched. **NO_GO**.

## Gate results
- `F0_BOUNDED_AUDIT=PASS`.
- `F1_VS53N_STAGING_REVIEW_SQL=STATIC_PASS`.
- `F1_VS53N_DATABASE_DEPLOYED=NO`.
- `F1_REAL_REVIEW_BROWSER_E2E=NOT_RUN`.
- `F1_COMPLETE_LIST_RECOVERY=BLOCKED`.
- `CONTROLLED_V0=NO_GO`.


## VS53N Functional rollback proof ready (same-day continuation)

New single SQL test `ferramentas/external-calc-c01-review/v0/staging/VS53N_C01_HUMAN_REVIEW_FUNCTIONAL_DRY_RUN.sql` contains the **exact current reviewed DDL (minus COMMIT)** followed by synthetic A/B tests all inside one BEGIN/ROLLBACK. It seeds a synthetic A supplier/source, binds source, persists candidate with verified model/cor/price, tests A's queue/load, B's isolation, wrong reviewer denial, ACCEPT receipt + same-result idempotence, disappearance from pending queue, and the **database trigger preventing legacy auto-promotion after review**. Postflight checks exactly 1 audit decision, 1 candidate, 0 offer revisions before ROLLBACK; SELECT `VS53N_C01_HUMAN_REVIEW_RESULT=PASS` if all assertions pass.

Static integrity checks on the GitHub file **12/12 PASS**: one transaction, identical foundation, no COMMIT, synthetic corpus, positive queue/load, A/B negatives, reviewer forgery denial, idempotence, fence, zero quote revisions, and visible PASS. **The complete SQL has NOT yet been executed on PostgreSQL**. An admin must execute only this rollback proof on `external-calc-staging` `mfsshvckclnmftpaprxk` in Supabase SQL Editor, then provide full result or SQL error. Do NOT run `VS53N_C01_HUMAN_REVIEW_RPC_DRAFT.sql` (COMMIT) before this success and explicit inspection.

Postgres staging remains at VS53L with **no installed VS53N queue/load/decision functions** in the last read-only inventory. QA tokens must never be pasted. This synthetic proof injects role claims in a SQL transaction and does not constitute signed HTTP/JWT testing.

`F1_VS53N_STATIC=PASS`; `F1_VS53N_REAL_SQL=AWAITING_ROLLBACK_PROOF`; `F1_VS53N_APPLIED=NO`; `CONTROLLED_V0=NO_GO`; `PRODUCTION=NO_GO`. GitHub Actions unused.


## Correction — first real PostgreSQL 17 functional rollback attempt (2026-10-22)

User executed the VS53N single-transaction functional test in the designated staging and received PostgreSQL error `42883 function pg_catalog.coalesce(integer, integer) does not exist` from `extcalc_list_pending_review_candidates_v0`.

Root cause: the prepared SQL incorrectly **schema-qualified PostgreSQL syntactic expressions** `COALESCE(...)` and `NULLIF(...)` as `pg_catalog.coalesce(...)` and `pg_catalog.nullif(...)`. Their qualified forms are looked up as nonexistent normal functions. This is a test/DDL authoring defect, **not evidence of a failed tenant isolation or domain constraint**.

Fix on this branch: replace all 12 such calls **in each of the three files** — staged DDL with COMMIT, staging-only DDL ROLLBACK, and full functional ROLLBACK — by unqualified uppercase `COALESCE`/`NULLIF` expressions, no C01 logic changes. Re-read exact blobs and prove **8/8 file-integrity checks PASS**: no residual invalid calls, precisely one COMMIT only in DDL, rollback equivalence and single rollback/no commit in test, exact migration prefix, PASS sentinel.

Independent read-only Supabase query after the failed test confirmed:
- no VS53N decision table, queue RPC, review result RPC (entire failed transaction reverted)
- 0 `extcalc_review_candidate` rows, 0 `extcalc_offer_revision` rows
- 3 original source rows, 0 `vs53n-%` synthetic source rows
- direct PostgreSQL expression `COALESCE(NULLIF('', ''), 'COALESCE_OK')` worked.

**Next safe operator step:** re-fetch **updated** `VS53N_C01_HUMAN_REVIEW_FUNCTIONAL_DRY_RUN.sql` through GitHub Raw (do NOT reuse the old copied SQL), execute full contents **only in `external-calc-staging`**, check last statement `ROLLBACK;`, and return SQL results/error. DO NOT apply `VS53N_C01_HUMAN_REVIEW_RPC_DRAFT.sql` (COMMIT) until reviewed and approved after successful rollback test. This correction remains **static PASS / real re-test pending**; `F1_VS53N_REAL_SQL=RETEST_REQUIRED`, `V0=NO_GO`, `PRODUCTION=NO_GO`.


## G3 — VS53N REAL PG17 functional rollback PASS (2026-10-22)
- User supplied a staging SQL Editor screenshot from `mfsshvckclnmftpaprxk` showing one result row, `VS53N_C01_HUMAN_REVIEW_RESULT=PASS`; labels read "A/B isolamento, decisão, idempotência e bloqueio de promoção" and "ROLLBACK descarta todos os dados sintéticos". This is a real PostgreSQL transaction with **simulated auth claims**, **not signed HTTP/JWT**.
- Independent Supabase read-only reconciliation after screenshot confirms **public suppliers, source bindings, analyses, offers, candidates, revisions = 0**, original sources = 3, synthetic VS53N sources = 0, and the VS53N decision table + queue/load/result RPCs **do not exist** after rollback.
- Security advisor: existing baseline includes three `authenticated`-executable `SECURITY DEFINER` RPC warnings, leaked password protection disabled; expected guards do not replace a live A/B proof. No new VS53N security finding can exist before install.
- Re-fetched exact `VS53N_C01_HUMAN_REVIEW_RPC_DRAFT.sql` install SQL at blob `62495d91cdaa8583738c9241faf7b717e20851cc` and functional rollback at `4027518ed7d19466d818bb42a996fd05385979d6`. Their DDL prefixes are identical (except terminal COMMIT replaced by test). Eight important preflight controls pass: one COMMIT in install, zero COMMIT/single ROLLBACK in functional, strict stage guard, revoked direct ledger grants, write fence, no quoteable revision insert.
- **Gate decisions:** `F1_VS53N_REAL_PG17_SYNTHETIC=PASS`, `F1_VS53N_ROLLBACK_CLEAN=PASS`, `F1_VS53N_STAGING_INSTALL=NOT_RUN`, `F1_VS53N_SIGNED_HTTP_E2E=NOT_RUN`, `F1_REVIEW_UI_BUILD=NOT_PROVEN`, `F1_OMITTED_ITEM_RECOVERY=NOT_IMPLEMENTED`; `CONTROLLED_V0=NO_GO`; `PRODUCTION=NO_GO`.
- The next **operator-only** action is the installation candidate `ferramentas/external-calc-c01-review/v0/staging/VS53N_C01_HUMAN_REVIEW_RPC_DRAFT.sql` on **the same staging project's SQL Editor**, checking `COMMIT;` as terminal statement, not the rollback version. It creates only isolated private audit + 3 RPCs + DB promotion fence; **does not** deploy frontend or approve C01 quotes. Do not copy to any commercial production project. After install, read-only audit table/RPC grants/fence and run real signed HTTP user A/B; later separate approved nonproduction Worker review endpoint. SQL Editor deployment not registered in migrations; reconcile the migration history before any release.
