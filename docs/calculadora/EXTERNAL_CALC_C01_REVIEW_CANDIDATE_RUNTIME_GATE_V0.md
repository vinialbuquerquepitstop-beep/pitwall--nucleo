# EXTERNAL CALC — C01 REVIEW CANDIDATE RUNTIME GATE V0

Data: 19/09/2026
Status: PROPOSAL ONLY

## Evidencia atual

- C01 Review Runtime/API esta deployado no Worker flat-resonance-09ba.
- POST /api/external-calc/v0/review sem JWT responde 401 + UNAUTHENTICATED.
- Producao possui 0 extcalc_review_candidate.
- Producao possui 0 extcalc_offer_revision.
- Producao possui 0 extcalc_human_review.
- Producao possui 0 extcalc_analysis e 0 extcalc_execution.
- extcalc_persist_review_candidate_v0 ja cria extcalc_analysis e extcalc_offer antes do candidate.

## Problema

O review final esta operacional, mas nao existe ainda no runtime um produtor real de C01 REVIEW_REQUIRED.

O repositorio possui:
- Interpreter Core V1 congelado;
- C01 readonly bridge;
- PostgresReviewCandidateRepository;
- RPC extcalc_persist_review_candidate_v0;
- C01 Review Authority e rota /review.

Falta somente a orquestracao trusted entre interpretacao e candidate persistence.

## Decisao proposta

Adicionar uma fronteira interna C01 Candidate Runtime que:

1. recebe uma entrada canonica/trusted;
2. resolve server-side o dominio/schema/knowledge/supplier profiles;
3. chama o C01 readonly existente sem alterar o Interpreter;
4. persiste somente candidates REVIEW_REQUIRED pelo repository existente;
5. devolve lineage e fila de review;
6. nao executa review humano;
7. nao executa C02-C05.

## O que NAO deve ser decidido silenciosamente

Nao publicar agora um contrato browser de texto cru diretamente para o Interpreter.

A forma publica de entrada deve respeitar a trilha Universal Input / CanonicalDocument. Enquanto esse contrato nao estiver fechado, o Candidate Runtime deve permanecer desacoplado da superficie publica.

## Ownership

- Interpreter Core: interpreta.
- C01 readonly: transforma InterpretationBundle em candidates REVIEW_REQUIRED.
- Candidate Runtime: orquestra somente.
- Platform/Postgres: persiste fatos imutaveis.
- Review Authority: aplica decisao humana.
- Frontend: apresenta fila e envia apenas comando humano de review.

## Gate tecnico proposto

C01_REVIEW_CANDIDATE_RUNTIME_GATE_V0 = PASS quando:

1. Interpreter Core permanece byte/semanticamente preservado;
2. C01 readonly permanece preservado;
3. schema/knowledge/supplier profiles nao vem do browser;
4. tenant e ator continuam server-derived;
5. candidate produzido pelo Core e persistido sem recalculo no SQL;
6. mesma execucao e idempotente;
7. zero service_role;
8. zero regra C02-C05;
9. candidate persistido consegue ser consumido pela rota /review;
10. roundtrip candidate -> review -> extcalc_offer_revision funciona;
11. nenhuma API publica nova de input e criada antes do contrato Universal Input.

## Proximo passo permitido sem novo canon

Construir e testar a orquestracao interna usando fixtures/canonical document trusted.

## Passo que exige decisao estrutural separada

Definir a superficie publica de entrada do produto:
- CanonicalDocument / Universal Input;
- referencia de source persistida;
- ou outro adapter aprovado.

Nao promover essa escolha automaticamente.
