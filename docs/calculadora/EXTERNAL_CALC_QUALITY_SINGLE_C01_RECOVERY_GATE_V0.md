# External Calc | Quality | Single C01 recovery gate V0
Date: 2026-11-12. Status: **READY FOR AUTHORIZED EXECUTION PREPARATION, NOT EXECUTED**.

## Strict system boundary
Only Supabase External Calc project `unjzpyexgtbcmjfgcqrx`. Do **not** operate on Pitwall V2 CRM, another project, or another tenant. No migration, DELETE, UPSERT, UPDATE, snapshot rewrite, or broad replay of source.

## Incident evidence (read-only actual DB)
- Quality: exactly one linked source.
- Analysis: `analysis_aeb7c447d3adcbfccaba2a6b`.
- Candidate rows: **25**. Revisions: **24 VALID/CURRENT**, 0 human reviews.
- Unpromoted offer: `off_9ace537c0bfa425d10e0c240`, revision `1`, iPhone 17 256GB Azul Lacrado, price R$ 5.399,99.
- Original candidate: `execution_status=SUCCEEDED`, `freshness_status=CURRENT`, `domain_outcome=REVIEW_REQUIRED` (normal for candidate stage). The C01 revision is absent.
- Source and supplier ownership links are present, single interpretation run across these 25 candidates.
- Read-only reconstruction using `auto-promotion-authority.js` current policy with `ambiguities=[]`: **24/24 existing promoted snapshots byte-equivalent by canonical JSON**; the 25th evaluates eligible without reasons.
- Limitation: global unresolved ambiguities for original list have not been independently recovered. Do not claim `ambiguities=[]` was proved for the historic source. Before any promotion confirm no material ambiguity attaches to source lines 7, 91, 97.

## Preflight for an operator with authenticated Owner session
1. Confirm project ID, tenant identity from session, permission `dono`, supplier UUID and source binding, as verified in read-only dashboard inspection.
2. Confirm this offer has exactly one candidate with the above IDs, original `interpretation_run_id`, no existing `extcalc_offer_revision` and no `extcalc_human_review` for offer/revision. If anything changes, **STOP**.
3. Retrieve the persisted `candidate_snapshot` via an authorized read-only pathway. Never substitute a newly parsed candidate: old `document_id`/run lineage is immutable.
4. Re-derive assessment from the **same** backend authority `evaluateAutoPromotion(candidate,{ambiguities})` and `promoteCandidate`. Verify original source ambiguities (or obtain an explicitly reviewed adjudication). Do not fake or omit known ambiguities.
5. Confirm promoted output matches `external-calc-c01-readonly/v1`, `VALID`, `SUCCEEDED`, `CURRENT`, `review:null`, `auto_promotion.decision=AUTO_PROMOTE` and preserves analysis/source/offer/revision/fingerprints.
6. Perform exact target precondition recheck immediately before write (single candidate; no revision; correct tenant). Prefer a narrow backend recovery endpoint with server-side checks if a race is possible; database dashboard SQL editor has **no `auth.uid()` of the owner session** and must **not** be used to spoof authentication.
7. With separate explicit production-write authorization, invoke existing `public.extcalc_persist_auto_promoted_c01_v0(p_promoted jsonb)` via the authenticated user session only; its SQL function checks `auth.uid()`, tenant and role `dono`, compares revision snapshots, and is idempotent on exact match.
8. Read back the single row. Require `VALID/CURRENT`, exact expected snapshot and fingerprints; recount Quality 25 candidates/25 revisions. Confirm offer-options and quote without rewriting existing offers.
9. If a conflict/status mismatch occurs, **STOP**, preserve record and logs; do not repair by replacing or deleting a C01 revision.

## Rollback / safety
No mutation if not explicitly authorized. Existing function inserts a C01 revision; to reverse a mistaken promotion there is **no safe generic DELETE rollback** for immutable C01 provenance. Recovery strategy is stop, record evidence, adjudicate through existing revision lifecycle. Production write is consequently a separate release gate.

## Release scope
This isolated historical repair is **not** proof that the paged backend/front-end PRs are deployed. Backend PR #208 + frontend PR #100 remain draft; native test, Worker auth, build/browser, operational rollout gates are separate.
