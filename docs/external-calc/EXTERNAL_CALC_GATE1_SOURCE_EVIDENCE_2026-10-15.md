# Gate 1 — Source evidence pass — 2026-10-15

**Status: IN_PROGRESS / NO-GO.** Follow-up to `EXTERNAL_CALC_GATE1_TRUTH_MATRIX_CHECKPOINT_2026-10-15.md`.

## New evidence
Using the original private 14 TXT files and the private 86-row review matrix, a *separate auditor* (not the app parser) extracted price tokens and context hints from all 68 source-only lines:
- 62 with numeric price tokens, with `PRICE_EVIDENCE_REVIEW_REQUIRED`; exact price/model/color/supplier ownership NOT YET adjudicated.
- 6 `NON_PRICE_MARKER` (money emoji but no numeric amount).
- 18 pre-existing golden cases `REFERENCE_UNVALIDATED`, not replayed.
- The evidence extractor initially missed 3 formatting patterns of `💵. 6700` kind; evidence regex was adjusted locally; **production parser untouched**.

Private evidence CSV: `GATE1_EVIDENCE_PROPOSALS_PRIVATE.csv`, not committed, includes supplier text and price. GitHub receives only aggregate counts and contract. No supplier data, monetary values or original lines here.

## Next gate conditions
Independently adjudicate each candidate's exact product, storage, color, condition, supplier and price by source-block scope; `UNKNOWN_REVIEW_ONLY` for unknown supplier. Compare against actual backend outputs on the **same commit**. The presence of a price string is not proof it was assigned to a correct offer. Run regression tests on generic shape patterns before any parser changes.

No changes to C01, Service, frontend or production. Gate 1 remains NO-GO.
