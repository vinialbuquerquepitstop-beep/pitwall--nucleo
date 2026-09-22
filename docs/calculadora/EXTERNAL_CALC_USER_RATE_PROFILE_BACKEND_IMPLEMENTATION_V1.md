# EXTERNAL CALC — USER RATE PROFILE BACKEND IMPLEMENTATION V1

Data: 22/09/2026  
Status: READY TO IMPLEMENT — G2 NEXT  
Scope owner: Backend / Platform + C02 trusted domain path.  
Cross-cutting authority: `EXTERNAL_CALC_USER_RATE_PROFILE_V1` and its impact/gate documents in the External Calc frontend architecture branch.  
Project production map: `EXTERNAL_CALC_PRODUCTION_INTEGRATION_MAP_2026_09_22_V1` in the Brain External Calc project folder.

## 1. Purpose

Materialize the accepted per-authenticated-user installment-rate architecture without changing C01–C05 dependency ownership and without moving commercial math into the browser.

This document is a backend implementation handoff. It does not create a second rate contract.

## 2. Frozen authority

```text
authenticated user
  -> own active UserRateProfile
  -> trusted server resolver
  -> C02/domain
  -> authoritative installment quote
  -> API
  -> frontend presentation
```

Rules:
- percentages vary by authenticated user;
- client never selects `user_id`;
- client never selects authoritative profile/version/rate;
- activated profile versions are immutable;
- old executions remain reproducible;
- C03 and C04 remain independent;
- UserRateProfile changes are configuration changes, not Interpreter learning events.

## 3. Gate sequence owned by backend

Backend is responsible for production evidence for:

- G2 Persistence / RLS;
- G3 Resolver / C02;
- G4 API;
- backend portions of G7 Replay / audit.

G5 Settings and G6 Screen 01 integration consume these server boundaries and do not replace them.

## 4. G2 — Persistence / RLS

Target persistence semantics:

```text
extcalc_user_rate_profile
- profile_id
- user_id
- version
- status
- currency
- rate_scale
- fingerprint
- supersedes_profile_id
- created_at
- activated_at

extcalc_user_rate_profile_entry
- profile_id
- installment_count
- rate_units
```

Names may be adapted to repository naming conventions during implementation; semantics above are frozen.

Required invariants:
- exactly one active profile per user;
- unique profile/version and unique installment count per profile;
- activated versions immutable;
- profile update creates a new version;
- active-profile switch is transaction-safe;
- ownership derived from authenticated user;
- cross-user read/write denied;
- profile history preserved;
- no legacy/global rate silently becomes every user's profile.

Required proof:
- migration applies cleanly;
- RLS owner can read own;
- user A cannot read/write user B;
- update cannot spoof user B;
- old active version stays immutable;
- activation conflict is deterministic;
- rollback leaves no partial active state.

## 5. G3 — Trusted resolver / C02

Resolver responsibilities:

```text
JWT/session
-> auth user
-> role/tenant authorization
-> own active UserRateProfile
-> validate active/version/fingerprint
-> build trusted C02 input
```

C02 must own one canonical formula/rounding implementation.

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

No API handler/frontend helper may reproduce the fee/total/parcel formula.

## 6. G4 — Product API

Semantic endpoints/capabilities:

### Read own active profile
Authenticated user receives only own profile according to role/product policy.

### Update own profile
Client submits percentage/rate values only.
Server derives:
- user_id;
- profile id;
- next version;
- fingerprint;
- activation timestamps/status.

### Request installment quote
Client may submit:
- base amount;
- currency;
- installment count;
- allowed analysis/offer reference if useful.

Client must not submit as authority:
- user_id;
- selected profile id/version;
- applied rate;
- authoritative total;
- authoritative installment amount.

## 7. Role policy during beta

Allowed privileged runtime roles remain:
- dono;
- validador.

For rate Settings after G5:
- each authorized account edits only its own profile;
- dono does not automatically edit validator profiles;
- validador does not administer team;
- vendedor stays blocked from the privileged product until Seller Projection.

Do not reinterpret per-user ownership as tenant-global ownership without a new explicit contract decision.

## 8. Lifecycle / replay

Every quote/execution must preserve enough provenance to replay the result.

Rate update:
```text
draft/edit values
-> server validate
-> create new version
-> activate
-> archive previous active
-> future quotes use new version
```

Historical result:
- remains bound to original profile/version/fingerprint;
- is never rewritten by later rate changes.

G7 backend proof must replay an old quote after a new profile becomes active and reproduce the old result from recorded provenance.

## 9. Interaction with Learning

Human Review Learning and UserRateProfile are separate domains.

- Human material EDIT may create `extcalc_learning_candidate`.
- Rate Settings updates must never create Interpreter learning candidates.
- A rate change is explicit user configuration, not a correction to interpreted supplier data.

## 10. Interaction with Frontend Integration

Frontend Integration cannot close the rate path until:
- G2 persistence/RLS passes;
- G3 resolver/C02 passes;
- G4 API passes;
- G5 Settings consumes real API;
- G6 Screen 01 consumes authoritative quote.

CI or fixtures alone are insufficient to declare live rate production complete.

## 11. Implementation order

1. migration + RLS + proof;
2. repository/persistence adapter;
3. active-profile resolver;
4. C02 rate/rounding implementation + contract tests;
5. profile read/update application boundary;
6. quote API/runtime route;
7. auth/cross-user/idempotency/conflict tests;
8. replay/audit proof;
9. handoff to frontend G5/G6;
10. live owner + validator evidence.

## 12. Gate result

```text
G1_CONTRACT_AUTHORITY = PASS
G2_PERSISTENCE_RLS = READY_TO_IMPLEMENT
G3_RESOLVER_C02 = PENDING
G4_API = PENDING
G5_SETTINGS = PENDING_FRONTEND
G6_SCREEN01_QUOTE = PENDING_FRONTEND
G7_REPLAY_LIVE = PENDING
```

Next exact action: implement G2 Persistence/RLS with a two-user isolation proof.
