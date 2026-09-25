# EXTERNAL CALC — C03 CURRENT REVIEWED OFFERS EVIDENCE SOURCE V0

Date: 2026-09-24
Status: IMPLEMENTATION CANDIDATE
Scope: Research Evidence source only
C03/C04 production policy: STILL PENDING
Frontend change: NONE
Advisor change: NONE

## 1. Problem found

The production execution path had a first-run dependency cycle:

~~~text
execute
→ AuthoritySource.loadEvidence()
→ extcalc_evidence
→ but extcalc_evidence is populated only by a persisted execution
~~~

With zero prior extcalc_execution rows, a first real execution could not obtain market evidence from this source.

Separately, the provider-neutral Research Provider contract already existed, but no concrete research runtime was wired.

## 2. Correction

V0 introduces a deterministic Evidence source from already reviewed CURRENT C01 offers:

~~~text
authenticated tenant
→ extcalc_product_current_offers_v0()
→ CURRENT / VALID / SUCCEEDED C01 snapshots
→ current-offers-evidence adapter
→ Evidence[]
→ C03
~~~

This removes the first-execution cycle without moving research logic to the browser.

## 3. Authority

The adapter does not decide C03 eligibility.

It only converts existing reviewed-offer facts into the existing Evidence shape.

Copied facts:
- model id/label;
- capacity;
- condition;
- color;
- reviewed price;
- currency;
- interpretation confidence;
- human review timestamp;
- offer/revision lineage.

C03 remains responsible for matching fields, confidence threshold and freshness policy.

## 4. No invented facts

An offer is skipped as evidence when:
- it is not SUCCEEDED / VALID / CURRENT;
- price is invalid;
- interpretation_confidence.overall is missing/invalid;
- review.reviewed_at is missing/invalid;
- model/currency identity is unusable.

There is no confidence default and no synthetic observed_at.

## 5. Circularity protection

The selected/evaluated offer is excluded from its own Evidence[].

C04 evaluates the selected C01 price against peer evidence; it must not use the evaluated price itself as a market comparable.

## 6. Provenance

Evidence id is deterministic from:
- source analysis_id;
- source offer_id;
- source offer_revision;
- source offer_value_fingerprint.

source_ref format:

~~~text
reviewed_offer:<analysis_id>:<offer_id>:<offer_revision>
~~~

## 7. Existing persistence remains

extcalc_evidence is still useful as an immutable snapshot of the Evidence[] that actually fed a completed execution.

It is no longer the authority source for creating the first Evidence[].

New lifecycle:

~~~text
CURRENT reviewed offers
→ derive Evidence[]
→ execute C03-C05
→ persist request snapshot + extcalc_evidence
→ replay/audit
~~~

## 8. Production policy remains blocked

This slice does NOT choose or promote:
- C03 required_match_fields;
- C03 min_evidence_confidence;
- C03 max_age_seconds;
- C04 min_evidence_count;
- C04 CHEAP threshold;
- C04 EXPENSIVE threshold.

The existing canonical hold remains:

~~~text
C03_PRODUCTION_PROFILE = POLICY_PENDING
C04_PRODUCTION_PROFILE = POLICY_PENDING
~~~

No wrangler production profile values are added by this slice.

## 9. Proof

New deterministic evidence source gate proves:
- selected offer excluded;
- no price recalculation;
- no confidence default;
- no timestamp default;
- stale/review-required offers excluded;
- deterministic evidence id;
- offer lineage retained;
- direct C03 compatibility;
- exact matching remains controlled by C03 profile;
- input immutability.

Authority/runtime regression proofs are updated to use current reviewed offers instead of reading extcalc_evidence as first-run input.

## 10. Next required decision

After implementation is green, production C03/C04 still requires an explicit policy approval.

Only after that approval may the selected profile values be added to Worker production configuration and a real C05 execution be expected to reach READY instead of failing closed or returning INSUFFICIENT_DATA.
