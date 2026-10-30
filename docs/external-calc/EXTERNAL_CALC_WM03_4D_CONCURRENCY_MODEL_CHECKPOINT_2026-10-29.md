# TREE | WM-03.4d Concurrent delivery model checkpoint
Date: 2026-10-29
Owner: Chat B, PR #201

## Change
Added `ferramentas/external-calc-whatsapp/v0/proof-ingress-concurrency-model-v0.cjs` in commit `703eb9410d37aa4b7991f0ebbe01abb89c106dbb`.

The test simulates twelve overlapping calls to the actual Node `acceptIngress` function using a shared stateful pg-compatible mock. One insert is expected, eleven duplicate results, and one outbox record; a divergent replay must fail. It intentionally models serializable insert decision behavior and is NOT proof of transaction concurrency under real PostgreSQL or correctness under connection failures.

## Execution status
Proof script committed. Automated execution NOT_RUN in this checkpoint. No PASS is claimed; code review and exact-source test execution are still required.

## Security blocker
The independent Neon staging project previously showed 0 ingress/outbox RLS policies and no per-tenant roles. A previous attempt to create roles and policies was rejected by tool security controls. Do not retry via an alternative bypass. An authorized administrative route must review and apply the RBAC/RLS migration and demonstrate two independent tenant identities.

## Gates
Model proof committed: YES
Model proof executed: NOT_RUN
Real PostgreSQL concurrency: NOT_RUN
Tenant A/B isolation: BLOCKED
M2M auth: NOT_RUN
Meta callback: OFF
Production: NO-GO

## Next
Run the new proof with Node against checked-out PR #201 and capture exact logs. For full G2, run a real pg client integration with non-owner credentials and parallel connections after approved RLS/role setup.
