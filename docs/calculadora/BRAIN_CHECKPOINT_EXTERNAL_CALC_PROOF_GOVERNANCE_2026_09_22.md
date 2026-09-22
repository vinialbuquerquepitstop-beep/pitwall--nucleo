# BRAIN CHECKPOINT — EXTERNAL CALC PROOF GOVERNANCE — 2026-09-22

## Evidence
No PR #45, as provas Review Queue API, Review Result Persistence, Candidate -> Review Roundtrip e Cloudflare G4 passaram, enquanto seis workflows falharam exclusivamente em Enforce isolated scope. A auditoria mostrou delegacoes baseadas em nomes historicos de branch.

## Decisions
Corrigir o mecanismo de prova sem alterar C01-C05, Lifecycle, Interpreter, Service ou Design System. Scope passa a ser resolvido por changeset + ownership conhecido. Mudanca sem ownership falha fechada.

## Failures
1. A primeira implementacao de GET /review tornou candidateSource obrigatorio tambem para consumidores POST; corrigido.
2. Uma prova antiga ainda exigia GET /review = 404; atualizada para o novo contrato.
3. Isolated scope acoplado a branch name produziu falso bloqueio estrutural.

## Case
External Calc PR #45 e o primeiro caso de validacao do Proof Governance V1.

## Pattern
Gates historicos podem continuar funcionalmente corretos e ainda envelhecer na forma como determinam ownership/delegacao.

## Method Hypothesis
Gates devem proteger invariantes e ownership arquitetural, nao acidentes historicos como nomes de branches. Permanecer como hipotese ate recorrencia suficiente; nao promover silenciosamente ao canon universal.

## Impact
Impacta workflows de prova do External Calc e documentos de estado. Nao altera contracts C01-C05.

## BRAIN_CONTROL_CENTER
Sync registrado como projeto-scoped checkpoint. Promocao para regra metodologica global requer evidencia adicional fora deste caso.


## Future access-control compatibility — 2026-09-22

Canonical reference:
`EXTERNAL_CALC_ACCESS_CONTROL_MANAGER_SELLER_PLAN_V1.md`

Recorded direction:
- current Supabase identity/session foundation is preserved;
- `tenant_id`, actor, active status and authorization remain server-derived;
- current External Calc owner-only boundary remains unchanged in V0;
- future seller access is an authorization/projection evolution, not a second login system;
- restricted internal cost must be absent from seller payloads, not merely hidden by UI;
- C01-C05 remain role-agnostic;
- future Manager Panel is implemented through explicit vertical slices and audited policy changes;
- changes to RLS/API projection require their own proof gate and must not be silently folded into the current Frontend Integration Gate.
