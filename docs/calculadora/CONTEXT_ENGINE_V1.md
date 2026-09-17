# CONTEXT ENGINE V1

Data: 17/09/2026
Branch: `feat/calculadora-interpretador-context-v1`
Status: shadow mode, sem persistencia e sem resolucao canonica

## Objetivo

Fazer o Interpreter Core entender continuidade estrutural entre linhas sem conhecer fornecedor, produto Apple, tenant ou banco.

Exemplo abstrato:

```text
DEVICE ALPHA16
256GB
6999
DEVICE BETA20
7999
```

O Core deve entender:

- linha 1 abre contexto de `model=ALPHA16`;
- linha 2 abre `capacity=256`;
- linha 3 herda os dois;
- linha 4 abre novo anchor de modelo e limpa contexto dependente anterior;
- linha 5 herda apenas `model=BETA20`.

A regra nao esta escrita para `DEVICE`, `model` ou `capacity` dentro do motor. Ela vem de `DomainSchema`.

---

## Principio arquitetural

> O Core executa contexto. O schema declara o que pode virar contexto.

Isso evita trocar hardcode de fornecedor por hardcode de categoria.

Cada campo de dominio pode declarar:

```json
{
  "context_inheritable": true,
  "context_anchor": true,
  "extractors": []
}
```

`context_inheritable` significa que o valor pode sobreviver para segmentos seguintes.

`context_anchor` significa que encontrar um novo valor daquele campo abre um novo bloco estrutural e, por padrao, limpa outros contextos anteriores para impedir vazamento.

---

## Extractors declarativos

V1 suporta dois tipos.

### regex

Extrai um campo a partir do texto normalizado.

```json
{
  "kind": "regex",
  "pattern": "^(64|128|256|512)\\s*(?:GB)?$",
  "group": 1,
  "transform": "integer",
  "score": 0.9
}
```

### role_raw

Usa a linha inteira quando um papel estrutural ja foi detectado.

Esse caminho existe para schemas simples e para evolucao futura do classificador.

Transforms permitidos na V1:

- `identity`
- `trim`
- `lower`
- `number`
- `integer`

O parser numerico e generico e aceita formatos comuns com ponto/virgula, sem assumir moeda operacional.

---

## Trace de contexto

Cada segmento passa a carregar:

```text
field_candidates
context_before
context_after
inherited_context
context_events
```

Cada valor de contexto guarda:

```text
value
source_line
source_segment_id
score
evidence
```

Logo, nenhuma heranca e invisivel.

Exemplo conceitual:

```json
{
  "capacity": {
    "value": 256,
    "source_line": 2,
    "source_segment_id": "line-2",
    "score": 0.9,
    "evidence": {
      "kind": "regex"
    }
  }
}
```

---

## Resets

A V1 implementa dois resets declarados por `context_policy`.

### timestamp boundary

Quando `reset_on_timestamp=true`, uma linha de timestamp limpa o contexto anterior.

Finalidade: impedir que modelo/capacidade de uma mensagem vazem para a mensagem seguinte.

### new context anchor

Quando `anchor_resets_other_context=true`, um novo anchor limpa o contexto atual antes de abrir o novo valor.

Finalidade: impedir que atributo de um produto/bloco seja herdado por outro.

Politica inicial e conservadora de proposito. Depois o schema pode evoluir para resets parciais por dependencia de campo, se o corpus provar necessidade.

---

## O que esta fatia ainda NAO faz

- nao monta produto final;
- nao consulta catalogo;
- nao resolve alias;
- nao reconhece fornecedor;
- nao persiste memoria;
- nao cria pendencia operacional;
- nao chama LLM;
- nao substitui `calc_parse_v2`;
- nao altera `calc_carga_abrir`;
- nao grava no Supabase.

O resultado continua em shadow mode.

---

## Fixture propositalmente nao-Pitwall

Arquivo:

`ferramentas/interpreter-core/v1/fixtures/generic-device-domain.json`

Ele usa termos artificiais (`DEVICE ALPHA16`, `DEVICE BETA20`) para provar uma propriedade importante:

> heranca e reset funcionam sem o motor conhecer Apple, iPhone ou qualquer fornecedor real.

Nao usar fixture Apple como unica prova desta camada, porque isso poderia mascarar hardcode acidental.

---

## Provas adicionadas

`ferramentas/interpreter-core/v1/prova_core.js` agora mede:

1. comportamento estrutural anterior;
2. extracao de campo definida pelo schema;
3. abertura de contexto de modelo;
4. abertura de contexto de capacidade;
5. heranca por linha seguinte;
6. reset ao abrir novo anchor;
7. reset em timestamp;
8. origem rastreavel da heranca;
9. permanencia em shadow mode e sem persistencia.

O conector GitHub usado nesta sessao nao executa Node. Portanto a prova foi escrita, mas precisa ser executada localmente antes de qualquer promocao:

```bash
node ferramentas/interpreter-core/v1/prova_core.js
```

Resultado esperado nesta versao:

```text
PASSOU: 14 assercoes
```

Nenhuma alegacao de PASSA deve ser feita antes de medir o EXIT CODE.

---

## Gate desta fatia

Para considerar Context Engine V1 fechado:

- prova nova EXIT 0;
- suite anterior continua verde;
- nenhuma chamada de banco no `core.js`;
- nenhum nome de fornecedor no `core.js`;
- nenhuma familia Apple no Context Engine;
- novo anchor nao herda atributo do bloco anterior;
- timestamp nao deixa contexto vazar;
- todo valor herdado aponta para sua linha de origem.

Depois disso, a proxima fatia e Candidate Engine + Resolver: usar `KnowledgeSnapshot` para converter candidatos crus em entidades canonicas, ainda sem escrita operacional.
