# EXTERNAL CALC — AI ADVISOR A2 EXECUTION GATE V0

Date: 2026-09-24  
Status: IMPLEMENTATION CANDIDATE  
Depends on: AI Advisor A1 = PASS / merged  
Scope: provider-neutral execution + audit envelope  
Visual change: NONE  
C01-C05 change: NONE

## 1. Objective

Transform the trusted A1 Advisor context into an auditable AI execution boundary without coupling the product to one model provider.

Flow:

~~~text
C05
 ↓
A1 Trusted Advisor Context
 ↓
A2 Executor
 ↓
Provider-neutral structured generation
 ↓
A1 Candidate Validator
 ↓
AI Execution Envelope
~~~

The model never becomes operational authority.

## 2. Fixed capability

A2 exposes one capability:

~~~text
EXTERNAL_CALC_ADVISOR_INSIGHTS
~~~

The provider receives:
- capability;
- prompt_version;
- a clone of the trusted A1 model_input.

Provider/model selection is server-side configuration, not browser authority.

## 3. Execution envelope

Every attempted execution records:

~~~text
execution_contract_version
executor_version
execution_id
capability

provider_name
model_name
model_version
adapter_version
prompt_version

analysis_id
offer_id
offer_revision
decision_output_id

context_fingerprint
input_hash
source_refs

requested_at
completed_at

execution_status
validator_version
validator_status

candidate_output
candidate_output_hash
error
~~~

## 4. Statuses

### SUCCEEDED

Provider returned structured output and A1 validator accepted it.

### REJECTED

Provider returned output, but contract/evidence validation rejected it.

The raw untrusted candidate is not exposed as accepted Advisor output. Only its hash is retained in the envelope.

### FAILED

Provider execution failed or timed out.

Provider exception text is not propagated into the envelope.

### BLOCKED

A1 already classified the context as insufficient.

No provider call occurs.

## 5. Authority invariants

A2 MUST NOT:
- recalculate price;
- change C01-C05;
- accept a tampered A1 context;
- let the provider choose its own trusted model metadata;
- let candidate output add operational authority fields;
- let candidate output cite unknown evidence;
- mutate the original trusted context;
- call the provider when A1 is blocked.

A2 MUST:
- verify the A1 context fingerprint before provider invocation;
- verify immutable guardrails;
- clone model input before provider invocation;
- run every candidate through the A1 validator;
- fail closed.

## 6. Provider-neutral interface

Required adapter method:

~~~text
provider.generateStructured({
  capability,
  prompt_version,
  input
})
~~~

Trusted server configuration supplies:

~~~text
provider_name
model_name
model_version
adapter_version
timeout_ms
~~~

This allows future adapters for different LLM vendors without changing the Advisor domain contract.

## 7. Security behavior

Provider failures are sanitized:

~~~text
PROVIDER_ERROR
PROVIDER_TIMEOUT
~~~

A raw provider error message must not enter the execution envelope.

Invalid candidate output becomes:

~~~text
execution_status = REJECTED
validator_status = REJECTED
candidate_output = null
error.code = CANDIDATE_VALIDATION_FAILED
~~~

## 8. Proof Matrix

A2 requires 15 executable checks:

1. READY context calls provider once;
2. capability and prompt version are fixed/preserved;
3. provider metadata comes from trusted configuration;
4. envelope preserves analysis/offer/revision identity;
5. input hash is deterministic;
6. source refs come from A1 allowlist;
7. valid candidate passes A1 validator;
8. extra authority field is rejected;
9. forged evidence ref is rejected;
10. provider error is sanitized;
11. blocked context never calls provider;
12. provider cannot mutate original context;
13. tampered context fingerprint blocks pre-call;
14. tampered guardrail blocks pre-call;
15. invalid provider config or prompt fails closed.

## 9. Exit gate

A2 = PASS only when:
- A1 regression remains PASS;
- A2 15/15 fixtures PASS;
- C01-C05 regressions remain PASS;
- Proof Governance PASS;
- no runtime/API/frontend/persistence change;
- diff check PASS.

No merge before positive CI.

## 10. Not included in A2

Still outside this slice:
- concrete OpenAI/Anthropic/etc adapter;
- secret configuration;
- live network model call;
- database persistence of execution envelopes;
- API route;
- frontend rendering;
- seller-safe Advisor projection.

## 11. Next frontier

A3 — Runtime Loader + Persistence.

Target:

~~~text
authenticated tenant
 ↓
load persisted CURRENT C05 + exact evidence
 ↓
build A1 context
 ↓
execute A2
 ↓
persist AI execution envelope
~~~

A3 still must not expose Advisor output to the frontend until its runtime authority and persistence proof are green.
