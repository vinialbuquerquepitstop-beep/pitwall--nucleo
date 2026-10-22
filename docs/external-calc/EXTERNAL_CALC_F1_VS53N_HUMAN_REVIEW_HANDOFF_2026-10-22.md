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
