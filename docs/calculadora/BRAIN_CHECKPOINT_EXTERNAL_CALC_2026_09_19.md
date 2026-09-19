# BRAIN CHECKPOINT — EXTERNAL CALC — 2026-09-19

Tipo: CHECKPOINT / SAVE POINT
Escopo: External Calc — autoridade C01, runtime/API, deploy G4 e lacuna de candidate runtime
Canon do Brain: INALTERADO

## 1. Estado de entrada

O External Calc já tinha Service, Lifecycle/Persistence, API, Runtime, Cloudflare G4 e Interpreter fechados. O Frontend Integration Gate havia exposto uma quebra de authority boundary: o browser não pode carregar regras C01–C05, profiles ou Evidence[] autoritativos.

Também já existiam C01 Review Authority Core e candidate persistence como peças separadas, mas o fluxo completo de review ainda não estava publicado.

## 2. Estado atual comprovado

- C01 Review Result Persistence implementada, migrada e mergeada.
- C01 Review Runtime/API implementada e mergeada.
- Rota publicada: POST /api/external-calc/v0/review.
- Deploy G4 controlado executado no Worker flat-resonance-09ba.
- Deploy G4 run 35476614139 = SUCCESS.
- main publicado no deploy: 68457d2acf680e845a34c6ce3b7384c5f28fb74e.
- Smoke /execute sem auth = 401.
- Smoke /calc = 200.
- Smoke /review sem auth = 401 + UNAUTHENTICATED.
- Smoke /review run 35476721012 = SUCCESS.
- Banco de produção no checkpoint: 0 review_candidates, 0 offer_revisions, 0 human_reviews, 0 analyses, 0 executions.
- PR #41 permanece proposta-only para C01_REVIEW_CANDIDATE_RUNTIME_GATE_V0.

## 3. Evidence

### E-EC-20260919-01 — Authority server-side preservada no review

O browser envia somente referência + decisão humana. tenant_id, actor/reviewer_ref, reviewed_at, fingerprints, C01 final e persistência são derivados/produzidos server-side.

### E-EC-20260919-02 — Review Runtime/API publicado de verdade

O Worker publicado respondeu fail-closed na nova rota /review: requisição sem JWT retorna 401 + UNAUTHENTICATED.

### E-EC-20260919-03 — Produção ainda não possui fato C01 para revisar

As tabelas extcalc_review_candidate, extcalc_offer_revision, extcalc_human_review, extcalc_analysis e extcalc_execution estavam vazias no momento deste checkpoint.

### E-EC-20260919-04 — Candidate persistence já cuida da lineage mínima

A RPC extcalc_persist_review_candidate_v0 já cria extcalc_analysis e extcalc_offer transacionalmente antes de persistir o candidate REVIEW_REQUIRED.

### E-EC-20260919-05 — G4 preservou invariantes antigos

Na mesma linha de evolução ficaram verdes Core de review, candidate persistence, result persistence, Runtime Postgres, Authority Runtime, Production Config e Wrangler/G4 package validation.

## 4. Decisions

### D-EC-20260919-01 — Não fabricar candidate para fechar roundtrip

Decisão: não criar usuário, JWT, analysis, offer ou candidate artificiais em produção apenas para marcar o gate live como PASS.

Motivo: o teste deixaria de provar o fluxo operacional real e introduziria autoridade/test data fora do caminho canônico.

### D-EC-20260919-02 — Não publicar silenciosamente API browser texto-cru -> Interpreter

Decisão: não transformar imediatamente o caminho de entrada em contrato público.

Motivo: isso acoplaria o produto diretamente ao Interpreter antes do fechamento da trilha Universal Input / CanonicalDocument.

### D-EC-20260919-03 — Próxima fronteira é orquestração interna

Próximo gate proposto: C01_REVIEW_CANDIDATE_RUNTIME_GATE_V0.

Responsabilidade proposta: consumir entrada canonical/trusted, resolver schema/knowledge/supplier profiles server-side, executar o C01 readonly existente e persistir candidates REVIEW_REQUIRED sem executar review ou C02–C05.

## 5. Failures / Corrections

### F-EC-20260919-01 — Fixture de runtime não preservava fingerprint real

Falha observada: um teste de ACCEPT esperava offer_revision preservada, mas a fixture usava offer_value_fingerprint fictício. O Core corretamente identificou mudança material e incrementou a revision.

Correção: fixture passou a calcular o fingerprint canônico do offer usado no teste.

Aprendizado: fixtures de contrato precisam preservar fingerprints semanticamente válidos; valor placeholder pode alterar comportamento de domínio e produzir diagnóstico falso.

### F-EC-20260919-02 — Migration de review result passou por falhas sintáticas antes da aplicação

Falhas observadas durante a implementação: delimitador/serialização e terminação PL/pgSQL inadequadas impediram aplicação inicial da migration.

Correção: SQL corrigido antes de aplicação final e teste estrutural adicionado para evitar corpo PL/pgSQL não terminado.

Aprendizado: gate JavaScript não prova compilação SQL. Migration só é considerada concluída após aplicação real no banco.

## 6. Cases

### CASE-EC-20260919-A — Authority Boundary descoberta pelo Frontend Integration Gate

O frontend revelou que uma API tecnicamente funcional pode ainda ser inadequada para produto quando o request deixa o cliente influenciar profiles/evidence autoritativos. O problema foi tratado como boundary de autoridade, não como bug visual ou de adapter.

### CASE-EC-20260919-B — Deploy controlado como prova separada do package gate

Wrangler dry-run e gates verdes não foram tratados como produção. O deploy só ocorreu após workflow_dispatch manual no main e foi seguido por smokes live.

### CASE-EC-20260919-C — Roundtrip live bloqueado por ausência de fato real, não por falha técnica

A rota /review está operacional, mas não há candidate real em produção. O bloqueio atual é upstream: materialização do C01 REVIEW_REQUIRED.

## 7. Pattern Candidates

### PC-EC-20260919-01 — 'Authority before integration'

Recorrência observada: antes de conectar frontend/API, identificar explicitamente quem é autoridade de cada campo e impedir que adapters carreguem semântica de domínio.

Status: PATTERN CANDIDATE. Não promover a canon sem validação em outro slice/projeto.

### PC-EC-20260919-02 — 'Dry-run != production proof'

Recorrência observada: build, fixture parity, mock runtime e dry-run são provas intermediárias; operação só fecha após deploy real + smoke/roundtrip da superfície publicada.

Status: PATTERN CANDIDATE. Forte evidência no External Calc, ainda sem promoção global.

### PC-EC-20260919-03 — 'Do not fabricate the missing upstream fact'

Quando um gate downstream não pode rodar porque falta um fato upstream real, a resposta correta é mapear o produtor desse fato, não fabricar estado para atravessar o gate.

Status: PATTERN CANDIDATE.

## 8. Method Hypotheses

### MH-EC-20260919-01 — Authority Map como subgate antes de Frontend Integration

Hipótese: todo Frontend Integration Gate de produto com regras de domínio deve ter um subgate explícito Authority Map: para cada campo do request/response, classificar browser-owned, presentation-only, user-intent, server-owned ou provider-owned.

Teste futuro: aplicar em outro vertical slice do External Calc e em um slice do Tree antes de propor promoção ao método.

### MH-EC-20260919-02 — Production Evidence Ladder

Hipótese de método: separar formalmente prova em níveis: contract test -> adapter test -> runtime mock -> build/bundle -> dry-run -> deploy -> unauth smoke -> authenticated roundtrip -> frontend operational test.

Teste futuro: observar se a sequência reduz falsos PASS sem aumentar burocracia desnecessária em pelo menos dois slices.

## 9. Impactos em artefatos do projeto

Impactados diretamente:
- C01 Review Authority Core
- C01 Review Candidate Persistence
- C01 Review Result Persistence
- C01 Review Runtime/API
- External Calc Runtime V0
- Cloudflare G4 runbook/workflow
- Frontend Integration Gate V0
- futura Screen 03 real
- proposta C01_REVIEW_CANDIDATE_RUNTIME_GATE_V0

Não reabrir neste checkpoint:
- Interpreter Core
- C01–C05 contracts
- Service V0
- Lifecycle/Persistence V0
- API execute V0
- Frontend visual freeze

## 10. Proposals / Canon

Nenhuma regra nova foi promovida ao canon.

Propostas abertas:
- C01_REVIEW_CANDIDATE_RUNTIME_GATE_V0 — PR #41, proposal-only.
- MH-EC-20260919-01 — Authority Map antes de integração.
- MH-EC-20260919-02 — Production Evidence Ladder.

## 11. Próximo ponto de retomada

Retomar por:

C01_REVIEW_CANDIDATE_RUNTIME_GATE_V0

Sequência permitida:
1. construir orquestração interna com entrada canonical/trusted;
2. preservar Interpreter e C01 readonly;
3. resolver schema/knowledge/supplier profiles server-side;
4. persistir candidate REVIEW_REQUIRED;
5. provar candidate -> /review -> offer_revision + HumanReview;
6. somente depois decidir superfície pública de Universal Input;
7. então conectar Screen 03 ao fluxo real.

## 12. Brain Control

Checkpoint registrado como evidência project-scoped.
Canon alterado: NÃO.
Method release alterado: NÃO.
Proposal de canon criada: NÃO; apenas Method Hypotheses e Pattern Candidates.
Próxima ação do Brain: comparar MH-EC-20260919-01/02 em slices futuros antes de qualquer promoção.

BRAIN_CHECKPOINT_EXTERNAL_CALC_2026_09_19 = SAVED
