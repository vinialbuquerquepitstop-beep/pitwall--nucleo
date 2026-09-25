# EXTERNAL CALC — AI ADVISOR A3.1 PRODUCTION ACTIVATION V0

Date: 2026-09-24  
Status: PASS  
Environment: Production Supabase  
Depends on: A1 PASS + A2 PASS + A3 PASS / merged  
Runtime/API provider activation: NOT INCLUDED

## 1. Objective

Activate the A3 database boundary in production and prove it without leaving synthetic operational data behind.

Scope:
- apply A3 migration;
- verify RLS / grants / SECURITY DEFINER functions;
- prove owner access;
- prove seller denial;
- prove cross-tenant isolation;
- prove AI envelope persistence;
- prove idempotent replay;
- prove cleanup/rollback;
- run post-DDL security/performance checks.

## 2. Production migration

Applied successfully:

~~~text
external_calc_ai_advisor_a3_v0
~~~

The production migration registry recorded a new migration entry on 2026-09-25.

Created:
- public.extcalc_ai_advisor_execution;
- public.extcalc_load_ai_advisor_source_v0(uuid);
- public.extcalc_persist_ai_advisor_execution_v0(uuid, uuid, jsonb).

Existing C01-C05 persistence tables were not replaced.

## 3. Production state before proof

Observed:
- extcalc_execution real rows: 0;
- extcalc_ai_advisor_execution real rows: 0;
- one active owner identity;
- one active seller identity;
- no active validator identity.

Therefore the production proof used a controlled synthetic lifecycle inside an exception-backed PostgreSQL subtransaction so the complete fixture could be reverted after assertions.

No fake operational record was intentionally retained.

## 4. Transactional proof

The controlled proof returned:

~~~text
owner_load_ok = true
first_persist_ok = true
idempotent_replay_ok = true
cross_tenant_hidden = true
seller_load_denied = true
seller_persist_denied = true
envelope_row_created_inside = true
~~~

Meaning:
- owner loaded the selected persisted source through the narrow RPC;
- first Advisor envelope persistence succeeded;
- exact replay returned idempotent=true;
- an execution belonging to another tenant was not visible;
- seller could not load Advisor source;
- seller could not persist Advisor execution;
- the AI envelope row existed during the controlled transaction.

## 5. Rollback proof

After the subtransaction rollback:

~~~text
advisor_fixture_rows = 0
source_fixture_rows = 0
analysis_fixture_rows = 0
advisor_total_rows = 0
~~~

No production fixture survived the proof.

## 6. RLS / grant proof

Production state:

~~~text
extcalc_ai_advisor_execution RLS = enabled
authenticated SELECT = granted
authenticated INSERT = false
owner SELECT policy count = 1

load RPC executable by authenticated = true
persist RPC executable by authenticated = true
~~~

This is intentional.

The table does not accept direct authenticated INSERT.

The SECURITY DEFINER RPCs are the narrow application boundary and independently validate:
- auth.uid();
- current tenant;
- current role;
- source lineage.

## 7. Post-DDL structural proof

New Advisor table:
- one FK to extcalc_execution;
- primary key present;
- tenant/advisor execution unique index present;
- source lookup covering index present;
- exactly one authenticated SELECT RLS policy.

No separate Advisor C05 or Advisor Evidence persistence was created.

## 8. Supabase security advisor

The Supabase linter reports the generic warning:

~~~text
authenticated_security_definer_function_executable
~~~

for the two new Advisor RPCs, alongside existing application RPCs.

Adjudication for A3.1:

EXPECTED / ACCEPTED FOR THIS APPLICATION BOUNDARY.

Reason:
- authenticated invocation is deliberate;
- raw-table RLS remains closed;
- the functions re-resolve auth.uid(), tenant and role internally;
- production proof confirms seller denial and tenant isolation;
- direct authenticated INSERT into the Advisor table is not granted.

This warning must be reconsidered if either RPC stops enforcing those internal checks.

## 9. Performance advisor

No A3-specific blocking performance issue was found.

The Advisor table has a covering source lookup index:

~~~text
(tenant_id, source_execution_id, criado_em desc)
~~~

Existing project-wide performance notices remain separate technical debt and are not introduced by A3.1.

## 10. Validator limitation in current production data

A3 code permits:
- dono;
- validador.

Production currently has no active app_usuario with papel=validador.

Therefore:
- owner allow path = production proven;
- seller deny path = production proven;
- validator allow path = code/CI proven, not live-identity proven.

This does not block A3.1 because the validator identity does not currently exist in production. A future validator activation must include a live authorization proof.

## 11. Gate result

A3.1 PRODUCTION DATABASE ACTIVATION = PASS

Proven:
- migration applied;
- source loader available;
- envelope persistence available;
- tenant isolation;
- seller denial;
- owner allow;
- idempotency;
- no fixture residue;
- RLS preserved;
- direct authenticated write remains closed.

Not yet proven:
- concrete LLM provider;
- live model call;
- Worker/API route for Advisor;
- frontend Advisor surface;
- real persisted External Calc execution feeding the Advisor.

## 12. Next frontier

A4 — Concrete Provider + Controlled Runtime API.

Sequence:

~~~text
authenticated request
→ source_execution_id
→ A3 production loader
→ A1 trusted context
→ A2 executor
→ concrete provider adapter
→ A3 production persistence
→ narrow API response
~~~

A4 must first be proven with a non-production provider fixture and runtime/API gate before any frontend work.
