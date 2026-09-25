# EXTERNAL CALC — AI ADVISOR A4.1 PRODUCTION ACTIVATION V0

Date: 2026-09-24
Status: IMPLEMENTATION CANDIDATE
Depends on: A1-A4 PASS / merged + A3.1 production DB PASS
Target Worker: flat-resonance-09ba
Frontend change: NONE

## 1. Objective

Activate the concrete OpenAI provider on the existing External Calc Worker without committing or exposing the provider credential.

A4.1 is operational activation only.

It does not change:
- C01-C05;
- A1-A4 contracts;
- Advisor output schema;
- database schema;
- frontend.

## 2. Activation mechanism

A dedicated workflow_dispatch gate performs:

~~~text
main + exact Worker confirmation
→ A1-A4 regression
→ Wrangler dry-run
→ verify Cloudflare/OpenAI secrets exist
→ minimal OpenAI Responses structured-output smoke
→ put OPENAI_API_KEY as Cloudflare Worker secret
→ deploy existing Worker
→ unauthenticated Advisor route smoke
→ existing External Calc API regression smoke
~~~

No production mutation occurs before:
- target validation;
- regression pass;
- package dry-run;
- all required secrets present;
- direct OpenAI provider smoke succeeds.

## 3. Required GitHub Actions secrets

~~~text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
OPENAI_API_KEY
~~~

The workflow can use these secrets but cannot print or persist their values in the repository.

OPENAI_API_KEY is copied to Cloudflare using:

~~~text
wrangler secret put OPENAI_API_KEY
~~~

It never becomes a wrangler.jsonc variable.

## 4. Provider pre-deploy smoke

Before any Worker secret mutation, the workflow sends one minimal request to:

~~~text
POST https://api.openai.com/v1/responses
~~~

Properties:
- model = gpt-6-sol;
- store = false;
- strict JSON Schema;
- output only { ok: true };
- max_output_tokens = 128;
- no operational/customer data;
- no External Calc data.

Purpose:
- verify the GitHub OpenAI secret is valid;
- verify the selected model is available;
- verify Structured Outputs is accepted;
- fail before Cloudflare mutation if provider activation is not viable.

This request incurs only the minimal provider usage needed for activation proof.

## 5. Worker deployment

The activation workflow:
- runs only by manual workflow_dispatch;
- requires ref main;
- requires exact confirmation text flat-resonance-09ba;
- deploys the existing Worker name;
- uses the existing external-calc-production environment;
- preserves the current static + API Worker target.

## 6. Post-deploy smoke

### Advisor route

~~~text
POST /api/external-calc/v0/advisor
without Authorization
→ HTTP 401
→ UNAUTHENTICATED
~~~

This proves:
- A4 route is deployed;
- route remains protected by authentication.

### Existing API

~~~text
POST /api/external-calc/v0/execute
without Authorization
→ HTTP 401
→ UNAUTHENTICATED
~~~

This protects against deployment regression of the existing External Calc API.

## 7. Fail-closed rules

Activation must stop before deploy if:
- branch is not main;
- target confirmation differs;
- A1-A4 regression fails;
- Wrangler dry-run fails;
- any required secret is absent;
- OpenAI provider smoke fails.

The workflow must not substitute a fake provider or disable authentication to obtain a green result.

## 8. What A4.1 proves

After successful activation:
- OpenAI provider credential is usable;
- selected model accepts the structured request;
- credential is installed as Worker secret;
- current Worker is deployed with A4;
- Advisor route is live and authenticated;
- existing External Calc API still answers correctly.

## 9. What A4.1 does not prove

A4.1 alone does not prove:
- authenticated owner → real persisted External Calc execution → real Advisor insight;
- live validator identity;
- frontend rendering.

At A3.1 production had zero real extcalc_execution rows, and no authenticated automation token is stored for a live owner roundtrip.

These must not be faked.

## 10. Next gate after activation

A4.2 — Authenticated Real Execution Roundtrip.

Required real chain:

~~~text
real persisted extcalc_execution
→ authenticated owner
→ Advisor API
→ A3 source load
→ A1
→ A2 / OpenAI
→ A3 persistence
→ validated insight
→ persisted extcalc_ai_advisor_execution
~~~

Only after A4.2 is green should the Advisor frontend slice begin.
