# EXTERNAL CALC — STORE TRADE-IN DEDUCTION POLICY GATE V0

Date: 2026-09-23  
Status: T03 PASS — PRODUCTION MIGRATED / ROLE + VERSION + IMMUTABILITY PROVEN  
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

## Production evidence — 2026-09-23

Applied Supabase migrations:
- `20260923050015 external_calc_store_trade_in_policy_v0`;
- `20260923050300 external_calc_store_trade_in_policy_indexes_v0`.

CI on PR #65:
- Store Trade-in Policy T03 = PASS;
- Proof Governance V1 = PASS;
- Store Rate Profile Persistence regression = PASS;
- Store Rate Resolver/C02 regression = PASS;
- Store Rate G4 API regression = PASS.

Transactional production proofs, all rolled back:
- owner created v1;
- identical replacement returned idempotently at v1;
- owner created v2 with v1 archived and v2 ACTIVE;
- missing/wrong expected active version failed as `EXTCALC_TRADE_IN_POLICY_CONFLICT`;
- direct mutation of archived history failed as `EXTCALC_TRADE_IN_POLICY_IMMUTABLE`;
- seller write attempt failed as `EXTCALC_TRADE_IN_POLICY_FORBIDDEN`;
- seller raw SELECT saw zero rows under the current beta boundary;
- production table returned to zero rows / zero ACTIVE rows after proofs.

Privileges:
- anon cannot execute the replacement RPC;
- authenticated can execute the RPC entrypoint, but the function derives identity from auth and requires role `dono`;
- authenticated has SELECT only on the table;
- authenticated has no direct INSERT / UPDATE / DELETE.

Advisor review:
- the two newly reported unindexed FKs were corrected with explicit indexes;
- remaining performance notes for those indexes are only `unused_index`, expected while the table contains zero production rows;
- Supabase reports the replacement RPC under the generic `authenticated_security_definer_function_executable` lint. This is intentional and matches the existing StoreRateProfile pattern: public RPC entrypoint, anon revoked, authenticated entry allowed, internal authenticated membership + `dono` authorization enforced before mutation. The seller denial was proven against production.

No synthetic policy was left ACTIVE. The real deduction amount remains unconfigured until the owner sets it through the Product/Settings flow.

## Exit

```text
T03_STORE_TRADE_IN_POLICY = PASS
STORE_OWNERSHIP = PROVEN
OWNER_WRITE = PROVEN
SELLER_OVERRIDE = FORBIDDEN
VERSIONING = PROVEN
IMMUTABILITY = PROVEN
PRODUCTION_RESIDUE = ZERO
T04_BACKEND_SERVICES = READY
```

Next after PASS:
`T04 — trusted Variant Resolver + Trade-in Estimate + Sales Simulation backend services`.
