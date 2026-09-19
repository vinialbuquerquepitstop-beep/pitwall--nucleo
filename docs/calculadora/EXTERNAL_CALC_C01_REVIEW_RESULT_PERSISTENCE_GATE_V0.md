# EXTERNAL CALC — C01 REVIEW RESULT PERSISTENCE GATE V0

Data: 19/09/2026
Status: IMPLEMENTATION CANDIDATE
Predecessor: C01_REVIEW_CANDIDATE_PERSISTENCE_GATE_V0 = PASS

## 1. Objetivo

Persistir o C01 final produzido pelo C01 Review Authority sem mover regra de C01 para SQL.

Saidas persistidas:
- `extcalc_offer_revision`;
- `extcalc_human_review`.

O `extcalc_review_candidate` original permanece imutavel.

## 2. Regras preservadas do Core

A persistencia nao decide essas regras; apenas valida que o resultado recebido respeita a forma produzida pelo Core:

- ACCEPT sem mudanca material: mesma `offer_revision`;
- EDIT material: `offer_revision + 1`;
- EXCLUDE/INVALIDATE: revision preservada, outcome EXCLUDED/INVALID;
- fingerprints chegam prontos do Core;
- `reviewer_ref` precisa corresponder ao ator autenticado.

## 3. RPC

`extcalc_persist_review_result_v0(p_reviewed jsonb)`

A RPC:
- deriva tenant por `privado.fn_tenant_atual()`;
- deriva papel por `privado.fn_papel_atual()`;
- deriva ator por `auth.uid()`;
- carrega o candidate original de `extcalc_review_candidate`;
- valida lineage e revision;
- grava o snapshot final imutavel em `extcalc_offer_revision`;
- grava `review_snapshot` append-only em `extcalc_human_review`;
- e idempotente para o mesmo fato;
- falha em conflito para snapshot divergente na mesma chave.

Nao:
- chama `applyHumanReview`;
- recalcula fingerprint;
- recalcula materialidade;
- executa C02-C05;
- usa service_role.

## 4. Adapter

`postgres-review-result-repository.js`

O adapter recebe do C01 Review Authority:
- tenant server-derived;
- actor server-derived;
- candidate carregado server-side;
- C01 final ja calculado pelo Core.

Na rede envia somente:

```json
{"p_reviewed": "<C01 final>"}
```

Nao envia `tenant_id` nem `actor_ref` como autoridade escolhida pelo cliente.

## 5. Gate

PASS quando:

1. C01 Review Authority Core continua verde;
2. candidate persistence continua verde;
3. ACCEPT sem mudanca preserva revision;
4. EDIT material exige +1;
5. EXCLUDE/INVALIDATE preservam revision;
6. candidate original nao sofre UPDATE/DELETE;
7. final C01 e HumanReview ficam persistidos separadamente;
8. tenant/papel/ator sao derivados no servidor;
9. adapter nao envia tenant/ator no body;
10. zero `service_role`;
11. zero regra C01-C05 no adapter/SQL;
12. migration ainda nao e aplicada antes do gate verde.

## 6. Proximo passo apos PASS

1. aplicar migration;
2. rodar security advisor;
3. validar RPC real autenticada;
4. ligar o C01 Review Authority ao Runtime/API;
5. somente depois expor o comando de review ao Frontend Adapter.

Nao fazer deploy de fluxo de review antes desse roundtrip autenticado.
