# EXTERNAL CALC — AI ADVISOR A4 OPENAI RUNTIME GATE V0

Date: 2026-09-24  
Status: IMPLEMENTATION CANDIDATE  
Depends on: A1 PASS + A2 PASS + A3 PASS + A3.1 production DB PASS  
Scope: concrete provider adapter + controlled Worker API  
Frontend change: NONE  
Production provider secret: NOT CONFIGURED BY REPOSITORY

## 1. Objective

Connect the first concrete model provider to the already-governed Advisor pipeline without giving the model or browser operational authority.

Target flow:

~~~text
authenticated browser
  sends source_execution_id only
        ↓
Worker /api/external-calc/v0/advisor
        ↓
server-resolved tenant + role
        ↓
A3 persisted source loader
        ↓
A1 trusted context
        ↓
A2 execution envelope
        ↓
OpenAI Responses API
        ↓
A1 candidate validator
        ↓
A3 envelope persistence
        ↓
narrow public Advisor response
~~~

## 2. Concrete provider

A4 adds an OpenAI Responses API adapter.

Provider contract remains the A2 interface:

~~~text
provider.generateStructured({
  capability,
  prompt_version,
  input
})
~~~

The rest of the Advisor domain does not depend on OpenAI-specific response objects.

## 3. Model configuration

Non-secret Worker configuration:

~~~text
EXTCALC_ADVISOR_OPENAI_MODEL = gpt-6-sol
EXTCALC_ADVISOR_PROMPT_VERSION = advisor-prompt/v1
EXTCALC_ADVISOR_TIMEOUT_MS = 30000
~~~

Secret:

~~~text
OPENAI_API_KEY
~~~

OPENAI_API_KEY MUST be configured as a Worker secret.

It MUST NOT exist in:
- wrangler vars;
- repository files;
- frontend variables;
- browser payloads;
- public API responses.

If API key, model, prompt version or timeout are invalid/missing:

~~~text
ADVISOR_NOT_CONFIGURED
HTTP 503
~~~

No provider call occurs.

## 4. OpenAI request boundary

Endpoint:

~~~text
POST https://api.openai.com/v1/responses
~~~

A4 uses:
- server-selected model;
- store=false;
- Structured Outputs via text.format;
- type=json_schema;
- strict=true;
- max 3 insights;
- no OpenAI tools;
- no model web search;
- no function calling;
- no conversation state.

The model only receives the trusted A1 model input.

## 5. Structured output

OpenAI is constrained to return:

~~~text
{
  insights: [
    {
      insight_id,
      type,
      severity,
      evidence_refs,
      summary,
      confidence
    }
  ]
}
~~~

The JSON Schema is not the final authority.

Every provider result still passes through A1 validateAdvisorCandidate.

Therefore:
- unknown evidence refs are rejected;
- extra operational fields are rejected;
- more than 3 insights are rejected;
- invalid types/severity/confidence are rejected.

## 6. Public API contract

Path:

~~~text
POST /api/external-calc/v0/advisor
~~~

Browser request:

~~~text
{
  source_execution_id
}
~~~

No other request key is accepted.

Server-owned:
- tenant_id;
- actor role;
- advisor_execution_id;
- prompt_version;
- provider;
- model;
- API key.

Allowed roles:
- dono;
- validador.

Blocked:
- vendedor.

## 7. Public response projection

The browser receives only:
- API version;
- source execution id;
- Advisor execution id;
- Advisor status;
- execution status;
- validated insights;
- provider/model identity.

The public response does NOT expose:
- internal commercial context;
- store cost;
- raw evidence records;
- source_refs;
- input_hash;
- context fingerprint;
- OpenAI API key;
- raw provider response;
- rejected candidate output.

## 8. Failure semantics

### Not configured

HTTP 503 / ADVISOR_NOT_CONFIGURED.

### Unauthenticated

HTTP 401.

### Unauthorized role

HTTP 403.

### Missing source

HTTP 404.

### Provider error

A2 records FAILED with sanitized PROVIDER_ERROR / PROVIDER_TIMEOUT semantics.

### Invalid model output

A2 records REJECTED.

Provider content does not become trusted output.

## 9. A4 Proof Matrix

A4 requires 20 executable checks:

1. Responses endpoint + POST + auth header;
2. model server-side + store=false;
3. strict text.format JSON Schema;
4. output_text JSON parsed + stable adapter metadata;
5. refusal fails closed;
6. incomplete response fails closed;
7. HTTP provider failure fails closed;
8. invalid structured JSON fails closed;
9. API accepts only source_execution_id;
10. API requires authentication;
11. seller blocked before service;
12. missing provider config returns 503;
13. execution id + prompt version are server-owned;
14. missing secret fails configuration closed;
15. complete server configuration activates provider;
16. Worker route without secret returns 503;
17. full fixture path auth→A3→OpenAI→persistence succeeds;
18. repository contains no OPENAI_API_KEY value;
19. Worker explicitly routes Advisor before generic API;
20. public response omits internal context/evidence/hashes.

## 10. Regression gates

Must remain green:
- C01;
- C02;
- C03;
- C04;
- C05;
- A1;
- A2;
- A3;
- Proof Governance;
- existing External Calc financial gates.

## 11. Exit gate

A4 IMPLEMENTATION = PASS only when:
- A4 20/20 PASS;
- all upstream regressions PASS;
- secret boundary PASS;
- Proof Governance PASS;
- no frontend change;
- diff check PASS.

A4 production model activation remains BLOCKED until:
- Worker has OPENAI_API_KEY secret;
- deployment gate is green;
- authenticated live smoke uses an actual persisted External Calc execution;
- resulting AI envelope is persisted and audited.

## 12. Next frontier

A4.1 — Provider Secret + Worker Deployment + Live Smoke.

Then:

A5 — Advisor Frontend Surface.

No frontend work begins before live runtime proof.
