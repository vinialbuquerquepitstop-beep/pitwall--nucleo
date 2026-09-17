# SHADOW COMPARATOR V0

## 1. Objetivo

O Shadow Comparator V0 mede, sobre a mesma entrada, a diferença entre:

```text
LEITOR ATUAL
vs
INTERPRETER CORE
```

Ele existe para provar equivalência, localizar divergências e tornar abstinências explícitas antes de qualquer promoção do novo motor.

Esta fatia é somente shadow. Não altera o leitor operacional, não grava preço, não aplica migration e não promove o Interpreter Core para produção.

---

## 2. Fronteira arquitetural

```text
mesmo documento
     |
     +--> leitor atual ----------------> legacy-reader-snapshot/v1
     |
     +--> Interpreter Core ------------> interpretation-bundle/v1
                                                |
                                                v
                                      Shadow Comparator V0
                                                |
                                                v
                                    shadow-comparison-report/v1
```

O comparador é externo ao Core.

O Core continua sem:

- acesso a banco;
- tenant;
- regra operacional;
- persistência;
- escrita de preço;
- código específico de fornecedor;
- código específico de consumidor.

---

## 3. Princípio de pareamento

O V0 não tenta adivinhar a identidade de um produto por lógica Apple dentro do pipeline.

O pareamento primário usa proveniência da mesma entrada:

- snapshot legado: `source_lines` ou `source_line`;
- Core: `record.trace[*].sources`.

Registros com sobreposição de linhas são candidatos a par.

A escolha é determinística:

1. maior sobreposição de linhas;
2. menor distância entre linhas;
3. ordem original.

Isso preserva o comparador como componente genérico.

---

## 4. Contratos

### 4.1 Entrada do leitor atual

Contrato:

`legacy-reader-snapshot/v1`

Forma mínima:

```json
{
  "contract_version": "legacy-reader-snapshot/v1",
  "document_id": "doc-001",
  "records": [
    {
      "legacy_record_id": "legacy-1",
      "source_lines": [10],
      "fields": {}
    }
  ],
  "metrics": {
    "parse_ms": 0
  }
}
```

O snapshot deve ser produzido pelo adapter/bench do leitor atual. O Core não acessa o banco para obtê-lo.

### 4.2 Entrada do Core

Contrato existente:

`interpretation-bundle/v1`

O comparador consome:

- `records`;
- `records[*].trace[*].sources`;
- `ambiguities[*].sources`;
- `metrics.parse_ms`.

### 4.3 Profile de comparação

Contrato:

`shadow-comparison-profile/v1`

O profile declara quais campos comparar e como normalizá-los.

Para Apple Domain V0 existe:

`ferramentas/interpreter-core/v1/domains/apple-iphone-v0.comparison-profile.json`

Conhecimento Apple fica no profile/schema/knowledge, nunca no comparador genérico.

### 4.4 Saída

Contrato:

`shadow-comparison-report/v1`

---

## 5. Métricas V0

O relatório mede:

- registros do leitor atual;
- registros do Core;
- registros pareados;
- matches exatos;
- matches divergentes;
- registros faltantes;
- registros extras;
- divergência por campo;
- ambiguidades;
- abstinências;
- perda silenciosa;
- preço silenciosamente errado;
- tempo de parse de cada motor;
- delta de tempo.

Para Apple V0, as divergências são discriminadas em:

- modelo;
- capacidade;
- condição;
- cor;
- preço.

---

## 6. Ambiguidade e abstinência

A regra principal é:

> ambiguidade explícita é preferível a interpretação errada silenciosa.

Quando o leitor atual possui um registro e o Core não produz esse registro:

- se existe ambiguidade do Core nas mesmas linhas, conta como `abstention`;
- se não existe explicação por ambiguidade, conta como `silent_loss`.

Uma abstinência não é tratada como equivalência. Ela é uma divergência conhecida e explicada.

---

## 7. Preço

Preço recebe gate específico.

`silent_wrong_price` conta divergências de preço em registros pareados quando não existe ambiguidade explícita nas linhas correspondentes.

Gate obrigatório:

```text
silent_wrong_price = 0
```

Uma divergência de preço jamais deve ser escondida por uma métrica agregada de equivalência.

---

## 8. Gates

Gates calculados diretamente pelo V0:

```text
silent_wrong_price = 0
silent_loss = 0
```

Invariantes arquiteturais da linha de desenvolvimento:

```text
database_calls_from_core = 0
consumer_specific_code_in_core = 0
supplier_specific_branch_in_core = 0
domain_hardcode_in_pipeline = 0
```

Os invariantes arquiteturais devem ser verificados na revisão da branch e permanecem bloqueadores de promoção.

---

## 9. Prova determinística

Executar:

```bash
node ferramentas/interpreter-core/v1/prova_shadow_comparator.js
```

A prova cobre:

1. equivalência limpa;
2. pareamento por proveniência;
3. comparação de `entity_id`;
4. tempo de parse;
5. controle negativo de preço errado;
6. fechamento do gate quando preço diverge;
7. abstinência explicada por ambiguidade;
8. perda silenciosa sem ambiguidade;
9. registro extra no Core;
10. divergência discriminada de modelo;
11. divergência discriminada de condição;
12. divergência discriminada de cor;
13. ausência de falso positivo de preço.

O controle negativo é intencional: a prova só passa se o comparador detectar o preço incorreto e fechar o gate naquele cenário.

---

## 10. Próxima prova depois desta fatia

Depois que a prova determinística estiver verde, o próximo passo é ligar o comparador ao **benchmark real do leitor atual**, ainda em shadow, para gerar snapshots dos dois motores a partir da mesma lista real.

Essa integração deve ocorrer em adapter/harness, não dentro do Interpreter Core.

O leitor atual permanece a verdade operacional até que uma bateria representativa de listas prove segurança suficiente para promoção.

---

## 11. Regra de promoção

Não promover o Interpreter Core apenas porque o número total de registros coincide.

Antes de qualquer troca operacional é obrigatório demonstrar, sobre corpus real representativo:

```text
silent_wrong_price = 0
silent_loss = 0
```

além de revisar individualmente divergências conhecidas, extras e abstinências.

A promoção deve ser uma decisão separada, explícita e reversível.
