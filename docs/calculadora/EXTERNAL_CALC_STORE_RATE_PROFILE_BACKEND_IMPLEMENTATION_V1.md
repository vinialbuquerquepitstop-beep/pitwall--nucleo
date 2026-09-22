# EXTERNAL CALC — STORE RATE PROFILE BACKEND IMPLEMENTATION V1

Data: 22/09/2026  
Status: G2 CORRECTED / PASS — G3 NEXT  
Scope owner: Backend / Platform + C02 trusted domain path.  
Cross-cutting authority: `EXTERNAL_CALC_STORE_RATE_PROFILE_V1` and its gate/impact map in the External Calc frontend architecture branch.  
Project production map: `EXTERNAL_CALC_PRODUCTION_INTEGRATION_MAP_2026_09_22_V1`.

## 1. Purpose

Materialize the store-owned installment-rate architecture without moving commercial math into the browser.

The rate schedule belongs to the tenant/store. `dono` defines it; sellers inherit it through the trusted quote path. No per-user or per-seller copies are authoritative.

## 2. Frozen authority

```text
JWT/session
  -> tenant/store
  -> ACTIVE StoreRateProfile
  -> trusted server resolver
  -> C02/domain
  -> authoritative installment quote
  -> API
  -> frontend presentation
```

Write authority:

```text
dono
  -> store Settings
  -> new StoreRateProfile version
```

Rules:
- one active profile per tenant/store;
- `dono` alone may create a new rate version;
- `validador` may consume the same store profile during privileged beta but may not edit it;
- `vendedor` never owns or overrides rates;
- once Seller Projection is released, seller quote requests resolve the same store active profile;
- no client-selected tenant/profile/version/rate authority;
- C03/C04 remain independent;
- rate changes are configuration, not Interpreter learning.

## 3. G2 — Persistence / RLS

Status: PASS after ownership correction.

Initial per-user migration:
`20260922230617 external_calc_user_rate_profile_persistence_v1`

Before any profile data existed, the business rule was corrected. The old model contained 0 profiles.

Corrective production migration:
`20260922231648 external_calc_store_rate_profile_correction_v1`

Current persistence:

```text
extcalc_store_rate_profiles
- profile_id
- tenant_id
- version
- status
- currency
- rate_scale
- fingerprint
- supersedes_profile_id
- created_by
- created_at
- activated_at

extcalc_store_rate_profile_entries
- profile_id
- installment_count
- rate_units
```

Invariants:
- exactly one ACTIVE profile per tenant;
- unique tenant/version;
- unique installment count per profile;
- activated versions and entries immutable;
- only ACTIVE -> ARCHIVED lifecycle mutation is allowed;
- `created_by` records the owner actor but does not make the profile user-owned;
- active-profile switch serialized at tenant level;
- no legacy/global rate silently copied;
- no per-user rate profile remains.

Production proof:
- dry-run correction failed once due trigger/function drop ordering and was corrected before apply;
- corrected dry-run passed;
- production migration applied;
- owner created store profile;
- validator same tenant read same active profile and was forbidden to update it;
- seller raw privileged access remained blocked;
- second tenant could not read profile;
- transactional proof rolled back with zero synthetic residue;
- old user-owned tables no longer exist.

## 4. G3 — Trusted resolver / C02

Next exact flow:

```text
JWT/session
-> authenticated membership
-> tenant_id
-> ACTIVE StoreRateProfile
-> validate active/version/fingerprint
-> select installment rate
-> build trusted C02 input
-> C02 authoritative quote
```

The resolver must not select a profile by user id.

C02 remains the sole calculation owner.

Minimum authoritative quote output:
- base amount/currency;
- installment_count;
- applied rate units/scale;
- total;
- installment amount;
- calculation version;
- rounding version;
- rate_profile_id;
- rate_profile_version;
- rate_profile_fingerprint.

Required failures:
- RATE_PROFILE_NOT_CONFIGURED;
- RATE_PROFILE_INVALID;
- INSTALLMENT_RATE_NOT_CONFIGURED;
- RATE_PROFILE_CONFLICT;
- RATE_PROFILE_FORBIDDEN;
- QUOTE_RECALCULATION_REQUIRED where lifecycle requires it.

## 5. G4 — Product API

Target semantic capabilities:
- read current store rate profile for authorized context;
- update store rate profile only as `dono`;
- request authoritative installment quote.

Client must not submit as authority:
- tenant_id;
- user_id;
- selected profile id/version;
- applied rate;
- authoritative total/installment amount.

## 6. Role policy

```text
dono       = edits + consumes store profile
validador  = consumes in privileged beta, no edit
vendedor   = inherits store profile through trusted quote after Seller Projection
```

Seller-specific rate overrides are forbidden by V1 contract.

## 7. Lifecycle / replay

Owner update:

```text
edit store values
-> server validate
-> create new tenant version
-> activate
-> archive previous active
-> future authorized store quotes use new version
```

Historical results remain bound to their original profile/version/fingerprint.

## 8. Learning boundary

Store rate updates never create Interpreter learning candidates.

## 9. Gate state

```text
G1_CONTRACT_AUTHORITY = PASS
G2_PERSISTENCE_RLS = PASS / CORRECTED
G3_RESOLVER_C02 = NEXT
G4_API = PENDING
G5_OWNER_SETTINGS = PENDING_FRONTEND
G6_SCREEN01_QUOTE = PENDING_FRONTEND
G7_REPLAY_LIVE = PENDING
```

Next exact action: implement G3 Resolver/C02 against the session tenant's ACTIVE StoreRateProfile.
