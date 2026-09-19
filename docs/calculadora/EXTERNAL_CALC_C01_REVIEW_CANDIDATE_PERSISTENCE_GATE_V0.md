# EXTERNAL CALC — C01 REVIEW CANDIDATE PERSISTENCE GATE V0

Data: 19/09/2026
Status: IMPLEMENTATION CANDIDATE
Predecessor: C01_REVIEW_AUTHORITY_CORE_GATE_V0 = PASS

## 1. Problema

O C01 produz um candidate `REVIEW_REQUIRED` antes da decisao humana.

Esse snapshot nao pode ser gravado como `extcalc_offer_revision` final porque:

- `extcalc_offer_revision` e imutavel;
- ACCEPT sem mudanca material preserva a mesma `offer_revision`;
- persistir REVIEW_REQUIRED e depois VALID na mesma chave exigiria overwrite.

## 2. Solucao

Adicionar armazenamento separado:

```text
extcalc_review_candidate
```

Lineage:

```text
Interpreter / C01 candidate
        |
        v
extcalc_review_candidate
        |
        v
C01 Review Authority
        |
        v
C01 final
        |
        +--> extcalc_offer_revision
        +--> extcalc_human_review
```

## 3. Imutabilidade

A chave do candidate e:

```text
tenant_id
analysis_id
offer_id
offer_revision
```

Mesmo snapshot repetido:

```text
idempotent = true
```

Mesmo identity com snapshot/fingerprint diferente:

```text
EXTCALC_REVIEW_CANDIDATE_CONFLICT
```

Nao existe UPDATE ou DELETE do candidate nesta fatia.

## 4. Tenant e permissao

A RPC:

`extcalc_persist_review_candidate_v0(jsonb)`

deriva:

- tenant por `privado.fn_tenant_atual()`;
- papel por `privado.fn_papel_atual()`;
- identidade autenticada por `auth.uid()`.

Somente `dono` pode persistir.

A tabela oferece ao papel authenticated somente SELECT sob RLS.

## 5. Boundary validation

A persistencia nao calcula C01.

Ela apenas aceita o formato especifico desta fila:

```text
contract_version = external-calc-c01-readonly/v1
execution_status = SUCCEEDED
domain_outcome = REVIEW_REQUIRED
freshness_status = CURRENT
reviewed_offer = null
review = null
```

Fingerprints e IDs precisam existir, mas nao sao recalculados no SQL.

## 6. Adapter

`postgres-review-candidate-repository.js`

expoe:

```text
persistCandidate(candidate)
loadCandidate(identity)
```

O body do writer contem:

```text
p_candidate
```

e nao contem `tenant_id` separado escolhido pelo cliente.

A leitura usa tenant derivado pelo runtime e ainda fica protegida por RLS.

## 7. Gate

`C01_REVIEW_CANDIDATE_PERSISTENCE_GATE_V0 = PASS` quando:

1. C01 Review Authority Core continua PASS;
2. candidate valido e estritamente pre-review;
3. persistencia nao recebe tenant separado;
4. mesma gravação e idempotente;
5. roundtrip devolve snapshot exato;
6. estado nao REVIEW_REQUIRED falha antes de rede;
7. candidate com review previo falha antes de rede;
8. migration tem RLS + security definer + tenant/role derivado;
9. candidate store nao atualiza/apaga `extcalc_offer_revision`;
10. zero service_role;
11. zero regra `applyHumanReview`/fingerprint no adapter/SQL;
12. scope diff isolado.

## 8. Limite de seguranca V0

Assim como o writer transacional de execucao existente, a RPC roda com JWT do usuario
autenticado e valida tenant/papel.

Ela nao usa service_role.

O runtime do produto deve ser o consumidor normal do writer. Endurecimento contra um dono
que chame a RPC diretamente fora do produto e uma questao de Trusted Transport, separada
do isolamento multi-tenant. Nao sera escondida como se este V0 resolvesse esse problema.

## 9. Aplicacao da migration

A migration NAO deve ser aplicada antes do gate ficar verde.

Depois do gate verde:

1. aplicar migration;
2. rodar security advisor;
3. validar RLS/policies;
4. provar RPC real autenticada;
5. somente depois construir persistencia do resultado final do review.

## 10. Proximo gate

`C01_REVIEW_RESULT_PERSISTENCE_GATE_V0`

Objetivo:

- persistir C01 final em `extcalc_offer_revision`;
- persistir HumanReview;
- preservar candidate original;
- provar ACCEPT sem mudanca na mesma revision sem conflito;
- provar EDIT material em nova revision;
- manter SQL sem regra C01.
