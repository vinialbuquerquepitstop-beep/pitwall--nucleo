# EXTERNAL CALC — HUMAN REVIEW LEARNING CAPTURE V0

Data: 22/09/2026
Status: IMPLEMENTATION CANDIDATE

## Objetivo

Transformar correcoes humanas de C01 em sinais de aprendizado auditaveis, sem alterar o Interpreter automaticamente.

## Fluxo

```text
Interpreter
  ↓
C01 REVIEW_REQUIRED
  ↓
HumanReview EDIT
  ↓
C01 final persistido
  ↓
Learning Candidate = PROPOSED
  ↓
Promotion Gate futuro
  ↓
Schema/Knowledge versionado
```

## Regra V0

Somente `EDIT` gera Learning Candidate.

`ACCEPT` confirma a operacao, mas nao cria regra nova em V0.

Para cada campo material realmente alterado, o capture guarda:

- campo;
- valor interpretado antes;
- valor humano final;
- review_id;
- revisao original e final;
- source_id;
- reviewer_ref;
- review_evidence;
- trace;
- provenance_refs;
- status `PROPOSED`.

Campos materiais observados:

- model
- capacity_gb
- condition
- color
- price

## Exemplo

Fonte:

```text
📲IPHONE 15 128GB ⚫️
R$2.550/ BATERIA 🔋 🟰100%
```

Interpreter:

```json
{ "color": null }
```

Humano:

```json
{ "color": "Preto" }
```

Learning Candidate:

```text
field = color
before = null
after = "Preto"
evidence = linhas originais + trace
status = PROPOSED
```

Isso nao altera o schema automaticamente.

## Separacao de responsabilidades

### Review
Decide a oferta atual.

### Learning Capture
Registra o que o humano corrigiu.

### Learning Promotion
Decide se a recorrencia/evidencia deve virar vocabulario, alias, regra de schema ou knowledge.

### Interpreter
So muda depois que uma promocao versionada passa pelos gates de regressao e corpus real.

## Por que nao autoaprender no clique

Uma cor/simbolo pode ter semantica diferente entre fornecedores.

Exemplo de vocabulario aprovado neste dominio:

```text
🟡 = Amarelo = Dourado = Gold -> Gold
```

Mas novos equivalentes nao devem ser inferidos globalmente a partir de um unico clique sem gate.

## Gate

PASS quando:

1. HumanReview EDIT continua autoritativo e operacional;
2. cada campo material alterado gera exatamente um Learning Candidate;
3. candidate original continua imutavel;
4. before vem do `interpreted_offer`;
5. after vem do `reviewed_offer`;
6. evidencia original e trace sao preservados;
7. capture e idempotente por review + campo;
8. status inicial e sempre PROPOSED;
9. nenhuma escrita em schema/knowledge ocorre no capture;
10. nenhuma regra C01-C05 e recalculada;
11. review nao depende de service_role;
12. promocao continua sendo gate separado.

## Proximo gate

`HUMAN_REVIEW_LEARNING_PROMOTION_V0`

Esse gate devera classificar proposals, agrupar recorrencias, distinguir vocabulario global de fornecedor e executar regressao/corpus real antes de promover uma mudanca de Interpreter.
