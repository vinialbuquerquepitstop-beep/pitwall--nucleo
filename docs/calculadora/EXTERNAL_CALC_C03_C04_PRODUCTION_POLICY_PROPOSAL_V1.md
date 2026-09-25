# EXTERNAL CALC — C03/C04 PRODUCTION POLICY PROPOSAL V1

Date: 2026-09-24
Status: PROPOSAL — HUMAN APPROVAL REQUIRED
Activation: NOT AUTHORIZED
Depends on:
- C03 Current Reviewed Offers Evidence Source V0 = PASS / merged
- C01–C05 core = PASS
- AI Advisor A1–A4 = PASS / merged
- A3.1 production persistence = PASS

## 1. Purpose

Close the policy gap that intentionally remained open after the production authority audit.

This document proposes concrete V1 values for:
- C03 Research Profile;
- C04 Price Indicator Profile.

It does not activate them.

No value in this proposal becomes production authority until explicit human approval.

## 2. Existing hard constraints

The following are not optional policy choices:

1. C03 consumes Evidence[] only through the trusted server-side authority path.
2. Browser does not submit Evidence, profiles, thresholds or as_of.
3. The evaluated offer is excluded from its own Evidence[].
4. C04 market reference remains the median V0.
5. C04 evaluated price remains C01 reviewed_offer.price.
6. AI Advisor remains post-C05 and read-only.
7. Advisor exact-variant validation requires model, storage, condition, color and currency to match the selected offer before evidence reaches the model.

## 3. Proposed C03 Production Profile V1

~~~json
{
  "profile_id": "external-calc-research-production-v1",
  "profile_version": "1",
  "required_match_fields": [
    "model_id",
    "capacity_gb",
    "condition",
    "color"
  ],
  "min_evidence_confidence": 0.90,
  "max_age_seconds": 604800
}
~~~

### 3.1 Exact matching fields

PROPOSED:

~~~text
model_id
capacity_gb
condition
color
~~~

Reason:
- Pro vs Pro Max must never be treated as the same product;
- storage changes market price;
- used/sealed condition changes market price;
- colors can have different supplier prices;
- Advisor A1 already fails closed if evidence belongs to another exact variant.

This aligns C03 market comparability with the product's downstream Advisor guardrail instead of allowing C03 to accept evidence that the Advisor must later reject.

### 3.2 Minimum evidence confidence

PROPOSED:

~~~text
0.90
~~~

Reason:
- production C01 observations currently available carry interpretation confidence between 0.93 and 0.99;
- V1 should fail closed rather than use weakly interpreted supplier evidence;
- no confidence value is synthesized by the current-offers Evidence source.

This is a proposed operational threshold, not a fact derived from the C03 contract.

### 3.3 Maximum evidence age

PROPOSED:

~~~text
7 days
604800 seconds
~~~

Reason:
- supplier pricing for current iPhones is operationally dynamic;
- a 30-day fixture window is too permissive for a negotiation assistant intended to describe the current market;
- seven days allows accumulation across recent supplier lists without treating older observations as current indefinitely.

This is a proposed business freshness policy and requires approval.

## 4. Proposed C04 Production Profile V1

~~~json
{
  "profile_id": "external-calc-indicator-production-v1",
  "profile_version": "1",
  "min_evidence_count": 3,
  "cheap_at_or_below_percent": -5,
  "expensive_at_or_above_percent": 5
}
~~~

### 4.1 Minimum comparable evidence count

PROPOSED:

~~~text
3
~~~

Reason:
- one peer is not a market;
- two peers still leave the reference highly sensitive to one observation;
- three exact comparables is the minimum proposed V1 sample before C04 emits CHEAP / MARKET / EXPENSIVE.

When fewer than three exact eligible comparables exist:

~~~text
C04 = INSUFFICIENT_DATA
C05 = INSUFFICIENT_DATA
Advisor = BLOCKED_INSUFFICIENT_DATA
~~~

No AI inference should fill this gap.

### 4.2 Price-position band

PROPOSED:

~~~text
CHEAP     <= -5% from market median
MARKET    > -5% and < +5%
EXPENSIVE >= +5% from market median
~~~

Reason:
- preserves a neutral symmetric band around the median;
- avoids labeling small price differences as commercially meaningful;
- matches the already exercised fixture semantics, but fixture use alone is not approval.

These thresholds are explicitly subject to human approval.

## 5. Current production impact

Production currently has three CURRENT / VALID / SUCCEEDED reviewed C01 revisions.

Grouped by exact variant, each group has only one offer:

~~~text
iPhone 15 128GB / Seminovo / Azul  -> 1
iPhone 15 128GB / Seminovo / Preto -> 1
iPhone 17 Pro 256GB / Lacrado / Preto -> 1
~~~

Observed interpretation confidence in those rows:
- 0.93;
- 0.93;
- 0.99.

Therefore, under the proposed exact-match policy, the evaluated offer would currently have zero peer evidence after excluding itself.

Expected current result:

~~~text
C03 eligible exact peer evidence = 0
C04 = INSUFFICIENT_DATA
C05 = INSUFFICIENT_DATA
AI Advisor = BLOCKED_INSUFFICIENT_DATA
~~~

This is correct fail-closed behavior.

Activating this policy alone will not manufacture useful market insight from insufficient production data.

## 6. Consequence for product readiness

Two independent things are required for a useful live Advisor:

### A. Approved C03/C04 policy

Needed so /execute can run with production profiles.

### B. Enough exact market Evidence

Can come from:
- more CURRENT reviewed supplier offers of the same exact variant;
- a future concrete external Research Provider that normalizes verifiable market hits into Evidence[].

The policy must not be weakened merely to force the Advisor to return an insight.

In particular, removing color from required_match_fields just because current data is sparse would conflict with the known business fact that color can change supplier price and with the Advisor exact-variant guardrail.

## 7. Proposed production configuration after approval

Only after approval, Worker configuration would gain:

~~~text
EXTCALC_RESEARCH_PROFILE_JSON
EXTCALC_INDICATOR_PROFILE_JSON
~~~

with exactly the approved values.

The browser would still receive no authority to alter them.

## 8. Activation gate after approval

Required:

1. merge approved policy document;
2. add exact approved server configuration;
3. run C01–C05 regressions;
4. run Product Execution Authority;
5. run Runtime Postgres;
6. run Advisor A1–A4 regressions;
7. Cloudflare dry-run;
8. controlled deploy;
9. authenticated /execute proof;
10. verify persisted C05;
11. if C05 READY, run Advisor;
12. if C05 INSUFFICIENT_DATA, preserve blocked state and do not bypass it.

## 9. Approval decision

Recommended V1 package for approval:

~~~text
C03
- exact match: model_id + capacity_gb + condition + color
- min confidence: 0.90
- max age: 7 days

C04
- minimum exact comparables: 3
- CHEAP: <= -5%
- MARKET: between -5% and +5%
- EXPENSIVE: >= +5%
~~~

Status remains:

~~~text
C03_PRODUCTION_PROFILE = POLICY_PENDING
C04_PRODUCTION_PROFILE = POLICY_PENDING
~~~

until explicit human approval.
