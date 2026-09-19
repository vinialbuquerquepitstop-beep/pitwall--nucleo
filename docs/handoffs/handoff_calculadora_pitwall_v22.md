# Handoff calculadora Pit Wall v22 - Interpreter Core V1 integrado no main

18/09/2026. Substitui o v21 como topo da linha calculadora.

Linguagem: prosa sem acento, sem cedilha, sem travessao.

## 1. Estado fechado

O Interpreter Core V1 foi integrado ao `main` depois de passar o Gate 02 completo.

Merge:

- PR: #13
- merge squash: `4b59d8b9c07fd5c4043c8f17d859815a1db6387d`
- branch de origem: `integrate/interpreter-core-v1`
- branch historica de auditoria NAO foi mergeada diretamente

O pacote integrado inclui:

- Core independente;
- CLI;
- adapters;
- schemas e knowledge externos;
- provas locais e de generalizacao;
- benchmark real;
- shadow comparator e divergence analyzer;
- supplier profile adapter;
- contratos JSON;
- workflow permanente do Gate 02;
- documento `INTERPRETER_READY_GATE_V1.md`.

## 2. Gate de promocao

O HEAD final do PR passou o run #188.

Resultado:

```text
Ledger = residual-adjudication-ledger/v8
supplier_aware_matched_offers = 143
supplier_aware_core_offers = 186
actionable missing = 0
actionable extra = 0
actionable total = 0
supplier_aware_confirmed_silent_wrong_price = 0
supplier_aware_unresolved_price_attribution = 0
PROMOTION_READY = true
GATE_LOCAL = PASS
REAL_CORPUS_GATE = PASS
```

O PR estava `mergeable=true` e `mergeable_state=clean` imediatamente antes do merge.

## 3. O que esta integrado e o que NAO esta ativado

Integrado:

- o Interpreter Core V1 existe no `main`;
- qualquer futuro PR que toque o Core, o documento do gate ou o workflow passa a ter o gate real disponivel a partir da propria `main`;
- o corpus real de promocao continua read-only;
- divergencias brutas contra o legado continuam preservadas no benchmark.

Nao ativado:

- o Core NAO substitui `calc_parse_v2`;
- o Core NAO escreve `calc_carga`, `calc_dados` ou qualquer tabela operacional;
- nao existe migracao de banco nesta entrega;
- nao existe LLM obrigatoria no caminho feliz;
- nao houve mudanca de frontend.

## 4. Estado vivo do banco medido antes do merge

Carga real usada no gate:

- id: `6c4d3491-f85b-4015-8393-9798ab1ce758`
- status: `rascunho`
- n_lidas: 799
- n_casou: 639
- n_duvidoso: 107
- n_descarte: 4
- n_pendencia: 52
- texto bruto presente: sim

Migration mais recente da linha observada:

- `20260915224552 calc_bench_ler`

Nenhuma escrita no banco foi realizada por esta integracao.

A topologia de FK foi conferida:

- `calc_*` referencia `tenant` quando aplicavel;
- `calc_pendencia -> calc_carga` e uma dependencia interna do dominio Calc;
- nao ha FK de `calc_*` para tabelas operacionais fora do dominio Calc.

## 5. Advisors medidos

Estado observado antes do merge:

- 11 findings de funcoes `SECURITY DEFINER` executaveis por `authenticated`, incluindo `calc_bench_ler`;
- leaked password protection desabilitado.

Nenhum DDL foi feito nesta entrega, portanto estes findings nao foram introduzidos pelo Interpreter Core.

## 6. Regra de regressao a partir daqui

Qualquer mudanca que toque:

- `ferramentas/interpreter-core/v1/**`;
- `docs/calculadora/INTERPRETER_READY_GATE_V1.md`;
- `.github/workflows/interpreter_ready_runtime_audit.yml`

deve manter simultaneamente:

```text
GATE_LOCAL=PASS
supplier_aware_confirmed_silent_wrong_price=0
supplier_aware_unresolved_price_attribution=0
actionable_residual_after_source_adjudication=0
PROMOTION_READY=true
REAL_CORPUS_GATE=PASS
```

Nao reproduzir erro do leitor legado apenas para aumentar paridade bruta.

## 7. Proximo passo tecnico

O proximo bloco deixa de ser "tornar o interpretador confiavel" e passa a ser a integracao controlada do Core com a arquitetura do External Calc.

A primeira fatia deve ser somente leitura:

```text
entrada real
-> Interpreter Core
-> InterpretationBundle
-> C01 Reviewed Offer
-> revisao humana
```

Nao escrever resultado operacional nem desligar o leitor atual nesta primeira fatia.

O leitor legado continua como caminho operacional e referencia de shadow ate existir um gate separado de substituicao.

## 8. Decisao

`GATE 02 = PASS / FROZEN`

`INTERPRETER CORE V1 = INTEGRADO NO MAIN`

`SUBSTITUICAO DO LEITOR LEGADO = NAO AUTORIZADA`
