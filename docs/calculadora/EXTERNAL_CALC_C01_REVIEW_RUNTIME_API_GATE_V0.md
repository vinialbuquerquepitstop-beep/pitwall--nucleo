# EXTERNAL CALC — C01 REVIEW RUNTIME API GATE V0

Data: 19/09/2026
Status: IMPLEMENTATION CANDIDATE

Predecessores:

C01_REVIEW_AUTHORITY_CORE_GATE_V0 = PASS
C01_REVIEW_CANDIDATE_PERSISTENCE_GATE_V0 = PASS
C01_REVIEW_RESULT_PERSISTENCE_GATE_V0 = PASS

## 1. Objetivo

Expor o C01 Review Authority pelo Runtime/API real sem mover regra C01 para a camada HTTP.

Nova rota: POST /api/external-calc/v0/review

## 2. Browser command

O browser pode enviar somente a intencao humana e a referencia do candidate:

{
  "analysis_id": "...",
  "offer_id": "...",
  "offer_revision": 1,
  "decision": "ACCEPT | EDIT | EXCLUDE | INVALIDATE",
  "patch": {},
  "reason": "..."
}

O patch e opcional e pertence ao comando humano de EDIT. O reason e opcional.

## 3. Autoridade proibida no browser

Continuam server-owned: tenant_id, actor_id, reviewer_ref, reviewed_at, candidate/c01_candidate, reviewed_offer final, offer_identity_fingerprint, offer_value_fingerprint, execution_status, domain_outcome e freshness_status.

Esses campos sao rejeitados pelo C01 Review Authority antes de carregar o candidate.

## 4. Derivacao server-side

Bearer JWT -> Supabase Auth /auth/v1/user -> subject = actor_ref -> app_usuario -> tenant_id/papel/ativo -> Review API -> C01 Review Authority -> extcalc_review_candidate -> applyHumanReview() no Core -> extcalc_persist_review_result_v0.

A API nao conhece fingerprint, materialidade ou regra de revisao.

## 5. Runtime binding

O Runtime instancia PostgresReviewCandidateRepository, PostgresReviewResultRepository, C01ReviewAuthority e C01ReviewApiV0.

A rota de execucao existente continua sob o handler anterior. A rota de review usa o handler dedicado.

Nenhuma mudanca e feita em C01 contract, C02-C05, Service V0, Lifecycle/Persistence V0 ou Interpreter.

## 6. Fail closed

- sem JWT -> 401;
- usuario inativo/sem identidade -> 401;
- papel sem permissao -> 403;
- campo de autoridade no body -> 400;
- candidate inexistente/divergente -> 400;
- persistencia recusada -> 400;
- zero fallback client-side.

## 7. Gate

PASS quando:

1. C01 Review Authority Core continua PASS;
2. Candidate Persistence continua PASS;
3. Review Result Persistence continua PASS;
4. API fina passa 7 checks;
5. Runtime review binding passa 6 checks;
6. Runtime V0 anterior continua 11/11;
7. reviewer_ref vem de auth.uid();
8. tenant vem do contexto autenticado;
9. body enviado a RPC nao inclui tenant_id/actor_ref;
10. regra C01 permanece somente no Core;
11. zero service_role;
12. Wrangler dry-run PASS;
13. scope diff isolado.

## 8. Nao inclui

Este gate nao cria candidate a partir da Screen 03, nao decide politica C03/C04, nao executa C02-C05, nao faz deploy Cloudflare, nao conecta ainda o Frontend Adapter e nao executa roundtrip live com JWT real.

## 9. Depois do PASS

C01_REVIEW_RUNTIME_API_GATE_V0 = PASS -> deploy manual G4 / smoke unauthenticated -> C01_REVIEW_LIVE_ROUNDTRIP_GATE_V0 -> Frontend Adapter review method -> Screen 03 real.

A Screen 03 so pode trocar o estado local por persistencia real depois do roundtrip autenticado.
