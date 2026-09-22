# EXTERNAL CALC — PRODUCTION STATUS INDEX — 2026-09-22 V1

Status: CURRENT STATUS INDEX  
Purpose: give engineering one discoverable snapshot of implemented, open and held areas. This index references authoritative documents; it does not replace them.

## Implemented / PASS

- Interpreter Core V1 under its corpus gate.
- C01–C05 core contracts/pipeline under their own gates.
- Service / Persistence / API / Runtime / Cloudflare G4 baseline.
- C01 Review Authority and immutable candidate/result persistence.
- Trusted review runtime and candidate → Human Review → final C01 roundtrip.
- Human Review Learning Capture: explicit EDIT → immutable PROPOSED learning candidate.
- Source review evidence / lineage.
- Pending-review projection separate from immutable candidate store.
- Beta Store Team Access for `dono|validador`.

## Open production work

### StoreRateProfile
- architecture: PASS — tenant/store-owned; dono write authority;
- backend G2 Persistence/RLS: PASS / corrected production migration 20260922231648;
- G3 Resolver/C02: PASS — PR #60 merged at 0947b88; trusted session user → membership → tenant → ACTIVE StoreRateProfile → existing C02; CI G3/C02/G2/Proof Governance green;
- G4 API: pending;
- G5 Settings: pending;
- G6 Screen 01 authoritative quote: pending;
- G7 replay/live proof: pending.

Backend handoff:
`docs/calculadora/EXTERNAL_CALC_STORE_RATE_PROFILE_BACKEND_IMPLEMENTATION_V1.md`

### Frontend Integration
Gate remains OPEN until its live authenticated/public-env/human visual evidence closes.

## Holds

### Seller production
`vendedor` remains blocked from privileged External Calc until Seller Projection removes restricted cost data server-side.

### Interpreter emoji/color promotion
Open experiment. Do not treat mappings as promoted knowledge until PR/gate/corpus regression closes.

### Learning promotion
Capture is implemented. Promotion to Interpreter knowledge remains a separate human-gated process.

## Role summary

```text
dono       = beta privileged / own tenant
validador  = temporary beta privileged / own tenant
vendedor   = production hold
```

After StoreRateProfile Settings:
- dono edits the store profile;
- validador consumes but cannot edit;
- vendedor inherits the store profile through the trusted quote path after Seller Projection;
- browser never supplies tenant/profile/rate authority.

## Documentation state rule

Historical foundation/spec documents may preserve their original build-time status, but current-state addenda should record later implementation/live transitions.

Implementation docs must not stay labeled `IMPLEMENTATION CANDIDATE` after the corresponding implementation is merged and its gate has passed.

## Next exact action

StoreRateProfile G4 — expose the trusted resolver through the authenticated API without accepting tenant/profile/rate authority from the browser.
