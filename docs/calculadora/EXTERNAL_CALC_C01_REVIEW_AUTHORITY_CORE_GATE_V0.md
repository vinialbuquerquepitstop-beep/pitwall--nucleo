# EXTERNAL CALC — C01 REVIEW AUTHORITY CORE GATE V0

Data: 19/09/2026
Status: IMPLEMENTATION CANDIDATE

## Objetivo

Fechar a autoridade da revisao humana C01 sem mover regra C01 para frontend, API,
SQL ou Platform.

O novo componente apenas:

1. recebe referencia + intencao de review;
2. carrega um candidate C01 REVIEW_REQUIRED de fonte confiavel;
3. deriva reviewer e horario do servidor;
4. delega a semantica para `applyHumanReview` canonico;
5. persiste o resultado por uma interface de repository;
6. devolve o C01 resultante.

## Comando permitido

```text
analysis_id
offer_id
offer_revision
decision
patch?
reason?
```

## Campos proibidos no cliente

```text
tenant_id
actor_id
reviewer_ref
reviewed_at
candidate
c01_candidate
reviewed_offer
offer_identity_fingerprint
offer_value_fingerprint
domain_outcome
freshness_status
execution_status
```

A verificacao e recursiva.

## Autoridade

```text
JWT / session
  -> tenant_id server-side
  -> actor_ref server-side
  -> reviewed_at server clock
  -> candidate server-side
  -> applyHumanReview (C01 canonico)
  -> review repository
```

## Regra de revisao

Este componente NAO implementa:

- MATERIAL_FIELDS;
- hash/fingerprint;
- incremento de offer_revision;
- validacao de currency;
- semantica ACCEPT/EDIT/EXCLUDE/INVALIDATE.

Tudo isso continua no C01 canonico.

## Descoberta de persistencia

A tabela atual `extcalc_offer_revision` deve continuar imutavel.

Nao e correto persistir um candidate `REVIEW_REQUIRED` nela e depois sobrescrever a
mesma revision com `VALID`, porque ACCEPT sem mudanca material preserva
`offer_revision`.

Portanto o estado pre-review precisa de armazenamento separado.

Proposta para a proxima fatia:

```text
extcalc_review_candidate
  immutable REVIEW_REQUIRED candidate
       |
       v
server review command
       |
       v
C01 applyHumanReview
       |
       +--> extcalc_offer_revision (resultado final)
       +--> extcalc_human_review
```

Essa decisao preserva:
- imutabilidade;
- revision semantics;
- provenance;
- auditoria do antes/depois.

## Gate

`C01_REVIEW_AUTHORITY_CORE_GATE_V0 = PASS` quando:

1. C01 readonly bridge continua PASS;
2. ACCEPT sem mudanca preserva revision;
3. EDIT material incrementa revision pelo C01 existente;
4. EXCLUDE preserva outcome C01;
5. reviewer_ref nao vem do browser;
6. reviewed_at nao vem do browser;
7. candidate/fingerprints nao vem do browser;
8. candidate precisa casar lineage e estar SUCCEEDED/REVIEW_REQUIRED/CURRENT;
9. falha de persistencia nao fabrica sucesso;
10. authority core nao duplica regra/fingerprint C01.

## Fora de escopo desta fatia

- criar a tabela de review candidate;
- RPC de ingestao;
- endpoint HTTP;
- alterar Screen 03;
- deploy.

Proximo gate:

`C01_REVIEW_CANDIDATE_PERSISTENCE_GATE_V0`
