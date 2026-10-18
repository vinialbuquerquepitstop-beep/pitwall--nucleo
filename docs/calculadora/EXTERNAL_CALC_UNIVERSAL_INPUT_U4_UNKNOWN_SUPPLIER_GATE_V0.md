# EXTERNAL CALC — UNIVERSAL INPUT U4 UNKNOWN SUPPLIER GATE V0

Data: 2026-09-26
Status: IMPLEMENTATION CANDIDATE
Origem: Chat B / Universal Input Backend AI Master V1

## Objetivo

Executar o Gate U4 de generalizacao segura:

```text
fornecedor nao conhecido pelo desenvolvimento/perfil
→ Universal Input
→ CanonicalDocument
→ Interpreter Core
→ CORE / REVIEW
```

O teste mede explicitamente:

- recognition;
- Core rate;
- Review rate;
- unresolved;
- wrong price.

## Duas provas obrigatorias

### 1. Controlled unknown supplier

Uma fixture deterministica usa um fornecedor deliberadamente ausente do schema/perfis entregues ao caminho testado.

O baseline recebe o perfil apenas para formar a referencia de comparacao.
O caminho U4 recebe zero perfil para esse fornecedor.

Obrigatorio:

```text
recognition_rate = 1.000
core_rate = 1.000
review_rate = 0.000
unresolved = 0
wrong_price = 0
silent_missing = 0
supplier_invented = 0
```

### 2. Private real-corpus stress

O mesmo corpus privado read-only usado pelo U2 e processado duas vezes:

```text
A) supplier-aware: perfis reais do tenant
B) unknown-supplier stress: nenhum supplier profile
```

A comparacao ignora a identidade de supplier na assinatura semantica e compara:

- model;
- capacity_gb;
- condition;
- color;
- price.

Este teste nao imprime conteudo privado.

## Regra de seguranca

U4 nao exige que supplier desconhecido tenha a mesma taxa de Core do baseline.

Queda de reconhecimento e permitida somente como degradacao explicita para Review/ambiguidade.

PASS exige:

```text
wrong_price = 0
supplier_invented = 0
silent_missing = 0
price provenance completa
```

Assim, um fornecedor novo pode reduzir automacao, mas nao pode:

- criar preco novo silenciosamente;
- inventar identidade de fornecedor;
- apagar oferta sem sinalizacao;
- remover provenance do preco.

## Definicoes das metricas

### recognition_rate

Quantidade de records do baseline cuja assinatura semantica continua existindo no caminho unknown-supplier / quantidade de records baseline.

### core_rate

Quantidade de records emitidos no caminho unknown-supplier / quantidade de records baseline.

### review_rate

Quantidade de records baseline ausentes cujo source line possui ambiguidade/review explicita no caminho unknown-supplier / quantidade de records baseline.

### unresolved

Records baseline que nao possuem assinatura equivalente no caminho unknown-supplier.

### wrong_price

Records novos no caminho unknown-supplier cuja assinatura semantica nao existe no baseline supplier-aware.

P0:

```text
wrong_price = 0
```

### silent_missing

Record baseline ausente sem ambiguidade/review tocando sua origem fisica.

Obrigatorio:

```text
silent_missing = 0
```

## Invariantes

- zero alteracao em Interpreter Core;
- zero alteracao C01-C05;
- zero alteracao de regra de preco;
- zero write no banco;
- corpus real somente leitura;
- zero frontend;
- zero LLM;
- supplier profile continua externo ao Core;
- provenance U3 continua obrigatoria.

## Gate

```text
U4 controlled = PASS
+
U4 private real corpus = PASS
+
U2 local regression = PASS
+
U3 provenance regression = PASS
+
Interpreter frozen regression = PASS
+
Proof Governance = PASS
```

## Proximo passo

Somente apos U4 verde:

```text
B9 / U5 — Complex Documents
```

PDF/imagem/DOCX continuam proibidos antes deste fechamento.
