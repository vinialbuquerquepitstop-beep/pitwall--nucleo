# EXTERNAL CALC — STORE TRADE-IN DEDUCTION POLICY GATE V0

Date: 2026-09-23  
Status: T03 IMPLEMENTATION / PROOF GATE  
Owner: Platform / Store Configuration  
Consumed later by: Trade-in Estimate Product service

## Canonical decision

The deduction applied to the customer's device belongs to the **store/tenant**.

```text
dono
-> ACTIVE StoreTradeInPolicy
-> trusted Trade-in Estimate resolver
-> seller consumes result
```

There is no per-seller copy or override.

V0 uses a fixed monetary deduction:

```text
estimated_credit =
max(lowest_eligible_offer - deduction_amount, 0)
```

The formula itself is **not** implemented in this gate. T03 owns configuration authority only.

## Persistence

`public.extcalc_store_trade_in_policies`

Fields:
- policy_id
- tenant_id
- version
- status ACTIVE/ARCHIVED
- currency = BRL
- deduction_amount_minor
- fingerprint
- supersedes_policy_id
- created_by
- created_at
- activated_at

Invariants:
- one ACTIVE policy per tenant;
- version unique per tenant;
- only owner can create a new version;
- historical versions immutable;
- ACTIVE may only transition to ARCHIVED during replacement;
- tenant and actor always come from authenticated membership;
- client cannot select tenant/policy/version;
- seller cannot write or override the deduction.

## Access boundary

Current privileged beta boundary is preserved:
- dono: may read and replace;
- validador: may read, cannot replace;
- vendedor: raw privileged table access remains blocked by the existing beta boundary.

This does **not** mean the seller will have a different policy. Seller inheritance happens through the trusted Product resolver in T04/Seller Projection, which resolves the store ACTIVE policy by authenticated tenant.

## Version replacement

`public.extcalc_replace_store_trade_in_policy_v0(...)`

The RPC:
1. derives actor + tenant from session;
2. requires role `dono`;
3. locks the tenant row;
4. validates BRL + non-negative minor-unit deduction;
5. fingerprints the normalized policy;
6. requires expected-version concurrency control when an ACTIVE policy exists;
7. returns idempotently for identical policy content;
8. archives the previous ACTIVE version;
9. creates the next tenant version.

## Non-goals

T03 does not:
- calculate a trade-in estimate;
- search C01 offers;
- select the lowest offer;
- alter C02/C04/C05;
- change Interpreter behavior;
- add frontend fields;
- grant seller raw privileged access.

## Exit

T03 PASS requires:
- static ownership proof green;
- migration applied;
- owner can create/version;
- seller cannot create/version;
- tenant isolation remains intact;
- one ACTIVE policy per tenant;
- history immutable;
- security advisor shows no new RLS/security regression.

Next after PASS:
`T04 — trusted Variant Resolver + Trade-in Estimate + Sales Simulation backend services`.
