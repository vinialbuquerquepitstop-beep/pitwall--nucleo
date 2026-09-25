# EXTERNAL CALC — AI ADVISOR A1 GATE V0

Date: 2026-09-24  
Status: IMPLEMENTATION CANDIDATE  
Scope: backend contract / guardrails only  
Visual change: NONE  
C01-C05 change: NONE

## 1. Objective

Materialize the first executable boundary for the External Calc AI Advisor.

The Advisor exists only after validated operational output:

~~~text
C01 -> C02 -> C03 -> C04 -> C05
                         |
                         v
                validated operational data
                         |
                         v
                    AI Advisor
                         |
                         v
                 advisory insights
~~~

A1 does not call an LLM and does not change the frontend.

It prepares a trusted, auditable model context and validates future candidate insight output.

## 2. Product intent

Advisor V0 supports the operator in understanding the selected supplier offer and preparing negotiation.

Initial behavior:
- explain the selected offer;
- expose up to 3 insights;
- ground every insight in approved evidence references;
- preserve selected model, storage, condition and color;
- preserve server-calculated values;
- block when data is insufficient;
- never replace operational data.

## 3. Execution Preflight

PASS.

Existing authority chain is already stable:
- C01 = reviewed offer authority;
- C02 = calculation authority;
- C03 = research;
- C04 = price indicator;
- C05 = composed decision output.

A1 consumes C05 and trusted evidence records. It does not fork or modify the core.

## 4. Gap Check

The minimum missing boundary was:

~~~text
validated C05
  + authenticated tenant/role
  + exact evidence records
        ->
safe Advisor model context
        ->
candidate output validator
~~~

No new database entity, frontend component, LLM provider or API route is required for A1.

## 5. Authority rules

The Advisor is read-only.

Forbidden:
- changing supplier price;
- changing C02 calculation;
- changing C03/C04 result;
- changing provenance;
- generating missing operational values;
- writing directly to C01-C05;
- accepting a stale C05;
- accepting another offer/revision;
- accepting another tenant resource;
- allowing seller access before a restricted seller projection exists.

A1 authorized roles:
- dono;
- validador.

A1 explicitly blocks:
- vendedor.

This is temporary capability gating, not a permanent role model.

## 6. Exact variant rule

The Advisor is stricter than broad market research.

Every C03 evidence id passed to the Advisor must be reloaded from a trusted source and must match the selected offer exactly on:
- model;
- storage;
- condition;
- color;
- currency.

Reason:

colors and variants may carry different prices. A market comparison that is acceptable for a broader C03 profile must not silently become negotiation advice for a different exact SKU.

Failure is fail-closed:

~~~text
ADVISOR_EVIDENCE_MISMATCH
~~~

## 7. A1 output

The context contract returns:
- selected offer identity;
- selected supplier price;
- market position;
- market reference and delta;
- exact evidence records;
- internal calculation facts for authorized roles;
- allowed evidence refs;
- immutable guardrails;
- context fingerprint.

Status:
- READY_FOR_MODEL;
- BLOCKED_INSUFFICIENT_DATA.

When blocked, model_input is null.

## 8. Candidate insight schema

Future model output must contain only:

~~~text
insights[]
  insight_id
  type
  severity
  evidence_refs[]
  summary
  confidence
~~~

Maximum:
- 3 insights.

Every evidence_ref must already exist in the trusted model context.

Extra authority fields are rejected by exact-schema validation.

## 9. Initial insight vocabulary

A1 permits these structured types:
- MARKET_POSITION;
- NEGOTIATION_OPPORTUNITY;
- SUPPLIER_COMPETITIVENESS;
- ANOMALY;
- SPREAD;
- TREND;
- PROMOTION_POTENTIAL.

The vocabulary can evolve only through an explicit contract version.

## 10. Proof Matrix

A1 requires 15 executable checks:

1. owner READY context;
2. validator READY context;
3. seller blocked;
4. tenant mismatch blocked;
5. analysis mismatch blocked;
6. offer mismatch blocked;
7. revision mismatch blocked;
8. stale C05 blocked;
9. failed C05 blocked;
10. insufficient data blocks model call;
11. model/storage/color/price preserved;
12. C02 values copied without recalculation;
13. evidence refs remain traceable;
14. candidate insight schema/evidence allowlist enforced;
15. mixed model/color research blocked before model input.

Upstream gates C01-C05 must remain green.

## 11. Exit gate

A1 = PASS only when:
- 15/15 Advisor fixtures pass;
- C01-C05 gates pass;
- read-only boundary check passes;
- Proof Governance recognizes the new slice;
- diff check passes.

No merge should occur before positive CI.

## 12. What A1 does not prove

Still pending after A1:
- live tenant-scoped C05/evidence loader wiring;
- provider-neutral LLM gateway invocation;
- AI execution envelope persistence/logging;
- prompt version;
- model selection;
- cost/latency observability;
- frontend rendering;
- seller-safe projection;
- live browser proof.

## 13. Next slice after A1

A2 — Provider + Execution Envelope.

Target:

~~~text
trusted Advisor context
      ->
provider-neutral model interface
      ->
structured candidate JSON
      ->
A1 candidate validator
      ->
auditable AI execution envelope
~~~

A2 must still remain read-only and post-C05.
