# EXTERNAL CALC — AI ADVISOR A3 RUNTIME + PERSISTENCE GATE V0

Date: 2026-09-24  
Status: IMPLEMENTATION CANDIDATE  
Depends on: A1 PASS + A2 PASS  
Scope: persisted-source loader + AI execution persistence  
Visual change: NONE  
Concrete model provider: NONE  
C01-C05 change: NONE

## 1. Objective

Connect the AI Advisor to the real External Calc lifecycle without creating a second operational truth.

A3 must reuse the already persisted External Calc execution:

~~~text
extcalc_execution.response_snapshot.outputs.c05
+
extcalc_evidence.evidence_snapshot[]
        ↓
A1 trusted context
        ↓
A2 provider-neutral execution
        ↓
extcalc_ai_advisor_execution
~~~

C05 and evidence remain owned by the existing lifecycle.

## 2. No duplicated domain state

A3 MUST NOT create:
- Advisor copy of C01;
- Advisor copy of C02;
- Advisor copy of C03;
- Advisor copy of C04;
- Advisor copy of C05;
- Advisor evidence table.

The only new persisted entity is the AI execution envelope.

## 3. Source loading boundary

The source loader accepts only:

~~~text
source_execution_id
~~~

Tenant and actor authority are derived from the authenticated JWT in a SECURITY DEFINER RPC.

Allowed current roles:
- dono;
- validador.

Blocked:
- vendedor;
- unauthenticated;
- cross-tenant source.

The RPC returns only:
- resource_tenant_id;
- source_execution_id;
- analysis_id;
- offer_id;
- offer_revision;
- CURRENT C05 snapshot;
- evidence snapshots from that same persisted execution.

Raw External Calc table RLS stays unchanged.

## 4. Why RPC instead of loosening RLS

Existing External Calc lifecycle tables are owner-only for raw SELECT.

A3 does not loosen them.

This preserves the distinction:

~~~text
raw operational persistence
  !=
authorized Advisor input projection
~~~

A validator may execute the Advisor through the narrow RPC without gaining unrestricted raw-table access.

## 5. Runtime service

Trusted runtime request:

~~~text
identity
  tenant_id
  actor_role

source_execution_id
advisor_execution_id
prompt_version
~~~

Flow:

~~~text
load trusted source
→ verify source tenant + lineage
→ A1 buildAdvisorContext
→ A2 execute
→ persist AI envelope
→ return execution result
~~~

The browser never supplies resource tenant authority.

## 6. Persistence entity

A3 adds:

~~~text
extcalc_ai_advisor_execution
~~~

It stores only audit/execution facts:
- source execution reference;
- provider/model metadata;
- prompt version;
- context/input hashes;
- source refs;
- timestamps;
- execution + validator statuses;
- accepted candidate output when applicable;
- candidate output hash;
- sanitized error;
- exact execution envelope;
- authenticated actor id.

It has an FK to the existing External Calc execution.

## 7. Idempotency

advisor_execution_id is append-only.

If the same id is persisted again with the exact same envelope:
- idempotent = true.

If the same id is reused with a different envelope:
- fail closed with execution-id conflict.

## 8. A3 Proof Matrix

A3 requires 15 executable checks:

1. source execution id is the only load selector;
2. owner executes A1 + A2 + persistence;
3. validator executes through the same narrow boundary;
4. seller blocked before provider/persistence;
5. cross-tenant source blocked;
6. source lineage mismatch blocked;
7. missing source blocked;
8. exact-color evidence guardrail preserved;
9. insufficient data persists BLOCKED without provider call;
10. persistence receives only AI envelope + source reference;
11. persistence idempotency is surfaced;
12. load adapter sends no tenant authority;
13. persist adapter sends no tenant/actor authority;
14. migration preserves raw RLS and JWT-derived role authority;
15. migration creates only an AI execution envelope linked to existing execution.

## 9. Exit gate

A3 = PASS only when:
- C01-C05 regressions PASS;
- A1 15/15 PASS;
- A2 15/15 PASS;
- A3 15/15 PASS;
- Proof Governance PASS;
- raw External Calc RLS remains unchanged;
- no frontend change;
- no concrete LLM provider;
- diff check PASS.

## 10. Still outside A3

Not included:
- OpenAI/Anthropic/Gemini adapter;
- model API secret;
- live network call;
- public Advisor API route;
- frontend rendering;
- seller-safe projection;
- production migration activation.

## 11. Next frontier after A3

A4 — Concrete Provider + Controlled Runtime API.

Only after A3 is merged and the migration is safely proven should a real model provider be connected.

A4 target:

~~~text
authenticated request
→ A3 runtime source
→ A1
→ A2 with concrete provider adapter
→ A3 persistence
→ narrow Advisor API response
~~~

Frontend remains after runtime/API proof.
