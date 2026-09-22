# EXTERNAL CALC — ACCESS CONTROL, MANAGER & SELLER PLAN V1

Date: 2026-09-22
Status: CANONICAL FUTURE ARCHITECTURE / NON-BLOCKING
Current gate: Frontend Integration Gate V0
Execution timing: after authenticated single-user product flow is proven

## 1. Objective

Prepare External Calc for multi-user operation without coupling authorization to C01-C05 or exposing internal commercial cost data to sellers.

Target capability:
- organization/account boundary;
- individual user login;
- organization membership;
- roles/policies;
- manager administration of sellers;
- seller access with restricted financial projection;
- per-user/per-organization commercial configuration;
- tenant isolation;
- auditable administrative and operational actions.

This is the cross-layer canonical future-access plan. It does not implement the capability now. It constrains current Auth V0 and future API/RLS evolution so the capability can be added without reworking the domain core.

## 2. Architectural invariant

Authentication, authorization and domain authority are separate concerns.

```text
Identity -> Organization -> Membership -> Role/Policy
                                      |
                                      v
                              Application operation
                                      |
                                      v
                                  C01-C05
                                      |
                                      v
                           Authorized projection
                                      |
                                      v
                                   Browser
```

C01-C05 remain domain authority.
Roles do not fork or duplicate C01-C05.

Forbidden future patterns:
- C02_MANAGER / C02_SELLER variants;
- cost fields sent to the browser and hidden with CSS;
- tenant_id trusted because the browser submitted it;
- seller access directly to privileged persistence;
- frontend-calculated commercial authority.

## 3. Roles V1

### OWNER
May manage organization-level access/configuration and privileged commercial visibility.

### MANAGER
May manage sellers and approved commercial configuration within policy.

### SELLER
May perform permitted selling workflows but must not receive restricted internal cost information.

Role names may evolve, but the separation of authority must remain explicit.

## 4. Seller projection

Cost hiding is a server-side data contract, not presentation logic.

Incorrect:

```text
API -> full financial object -> browser -> UI hides cost
```

Required:

```text
Domain output -> access policy -> seller projection -> API -> browser
```

Restricted data must be absent from seller payloads, including:
- acquisition/internal cost where classified as restricted;
- repair cost;
- internal margin;
- internal markup/parameters when they allow reconstruction of restricted cost;
- privileged supplier/commercial inputs;
- other fields classified INTERNAL_COST or restricted INTERNAL_COMMERCIAL.

The seller may receive the authorized selling price, installment choices and operational information needed to sell.

## 5. Organization and membership model

Conceptual model:

```text
Organization
  -> Membership
      -> User identity
      -> Role
      -> Policy
```

The server must resolve the active organization/membership from trusted authenticated context.

A client-supplied organization/tenant identifier is never sufficient authority by itself.

## 6. Commercial configuration

Future configuration resolution must support:

```text
Organization defaults
      +
optional user commercial profile
      =
resolved server-side configuration
```

The existence of a per-user configuration does not imply that the seller can view or edit its internal parameters.

C02/Service remains the calculation authority.

## 7. Manager panel capability

Future Manager Panel vertical slices:

1. Team list
2. Invite/add seller
3. Activate/deactivate seller
4. Assign allowed role/policy/profile
5. Review relevant usage/activity
6. Audit access/configuration changes

Managers never view user passwords.
Credential lifecycle belongs to the auth provider.

## 8. Tenant isolation

Required proof:

```text
Organization A user -> Organization B resource = DENIED
```

Also required:
- no cross-membership privilege escalation;
- inactive membership cannot continue protected operations;
- client-provided tenant hints cannot override server-resolved authorization context.

## 9. Audit trail

Future privileged actions must be attributable to:
- actor/user;
- organization;
- action;
- target resource;
- time;
- relevant before/after metadata where safe;
- result.

At minimum cover:
- invitation/user creation;
- activation/deactivation;
- role/policy change;
- commercial profile change;
- privileged review/action.

## 10. Current Auth V0 compatibility requirements

Auth V0 is still minimal, but from now on it must avoid decisions that block later authorization.

Current implementation SHOULD expose a narrow browser session abstraction such as:

```text
AuthenticatedSession
- user identity (opaque/stable identifier)
- getAccessToken()
- signOut()
```

Current implementation MUST NOT:
- hardcode a permanent single-user identity into application/domain code;
- put service_role/admin secrets in the browser;
- make C01-C05 depend on role;
- make browser tenant selection authoritative;
- encode seller/manager permission rules inside frozen screens;
- require C01-C05 schema changes for future organization/membership support.

Organization, membership and role may remain unresolved in Auth V0 if they are not needed for the current single-user gate. Their future resolution point must remain server-side/extensible.

## 11. Future slices

### A — Multi-user Foundation
User + organization + membership resolution.

Gate:
- authenticated membership proven;
- tenant isolation proven;
- tenant not trusted from browser.

### B — Roles & Policies
OWNER / MANAGER / SELLER policy layer.

Gate:
- policy matrix tests green;
- no C01-C05 forks.

### C — Seller Projection
Server-side restricted-data projection.

Gate:
- seller payload contains zero restricted cost information;
- no restricted cost in JSON, hydration state or browser-visible error payloads.

### D — Manager Panel
Manager can add/activate/deactivate sellers through authorized application actions.

Gate:
- seller lifecycle works;
- no direct privileged persistence from browser;
- actions audited.

### E — Commercial Profiles
Organization defaults + optional user profile resolved server-side.

Gate:
- C02 remains calculation authority;
- frontend contains no rate/margin authority.

### F — Audit Trail
Administrative and relevant commercial actions become queryable/auditable.

## 12. Future proof matrix

| Scenario | Required result |
|---|---|
| Owner authorized for privileged cost | PASS |
| Manager authorized according to policy | PASS |
| Seller requests restricted cost | DENIED / field absent |
| Seller inspects network payload | restricted cost absent |
| Seller tampers with browser request | no authority gained |
| Org A requests Org B resource | DENIED |
| Disabled seller reuses old session | DENIED according to revocation policy |
| User without membership accesses protected org resource | DENIED |
| Browser submits arbitrary tenant | ignored/rejected |
| Per-user commercial profile resolves correctly | PASS |
| C02 remains sole calculation authority | PASS |
| Role/profile change emits audit event | PASS |

## 13. Impact map

Impacted now:
- Auth Contract V0: compatibility constraints only;
- Frontend Integration Gate V0: record future extensibility invariant;
- Brain checkpoint: future capability/reference;
- future authorization/API/security work.

Not impacted now:
- C01-C05;
- Interpreter;
- Service/Persistence domain rules;
- Screen 01/02/03 visual freezes;
- Design System canon.

Future envelope changes such as actor_id, organization_id or authorization_context require explicit versioning/proposal; they must not be inserted silently into a frozen contract.

## 14. Audit adjudication

ARCHITECTURE = COHERENT
DOMAIN COMPATIBILITY = PASS
CURRENT GATE IMPACT = NON-BLOCKING
SECURITY CONDITION = SERVER-SIDE AUTHORIZATION + PROJECTION REQUIRED
C01-C05 IMPACT = NONE

Key invariants:
1. C01-C05 remain role-agnostic.
2. Restricted cost is removed server-side before seller payload delivery.
3. Tenant/membership authority comes from trusted authenticated context.
4. Per-user rates/config never create calculation authority in the frontend.
5. Manager Panel uses authorized application boundaries, not privileged browser persistence.
6. Auth V0 remains narrow and extensible rather than prematurely implementing the whole multi-user system.


## 15. Current runtime bridge discovered

The current External Calc worker already authenticates bearer tokens against Supabase Auth and resolves the authenticated user in `public.app_usuario` using:

```text
user.id -> app_usuario.id
         -> tenant_id
         -> papel
         -> ativo
```

Current execution permission is intentionally narrower:

```text
can_execute_external_calc = app_usuario.papel === "dono"
```

This is useful infrastructure for Auth V0, but it is not the final Manager/Seller policy model.

Migration rule:
- reuse the real Supabase session now;
- keep tenant/user resolution server-side;
- do not reproduce `papel === "dono"` in frontend code;
- later replace/extend the backend boolean capability with an explicit policy resolver;
- treat `app_usuario` as the current identity/profile bridge, not as proof that the final organization/membership schema is complete.

Therefore adding Manager/Seller later is an authorization evolution, not a login rewrite.


## 16. Database audit evidence — 2026-09-22

Production schema inspection confirmed:
- `public.tenant` already exists and has RLS enabled;
- `public.app_usuario` already stores `id`, `tenant_id`, `papel` and `ativo`;
- current `papel` constraint already includes `dono` and `vendedor`;
- current data contains active owner and seller identities;
- `app_usuario` RLS allows a user to read self and allows the owner to read users from the current tenant;
- current `extcalc_*` SELECT policies are tenant-scoped and owner-only.

Adjudication:
- existing identity/tenant foundation is reusable;
- seller identity is already representable;
- future seller access must be enabled by deliberate authorization/RLS/API projection evolution;
- current owner-only RLS must not be loosened merely to make the frontend render;
- a future `gestor` capability can be modeled through an explicit role/policy evolution rather than by bypassing the current owner boundary.

This evidence strengthens the plan but does not change the current gate scope.
