# EXTERNAL CALC V0 — GATE 02 / INTERPRETER READY

Data: 2026-09-17
Status: EM EXECUCAO
Branch: `audit/interpreter-ready-runtime-v1`

## Objetivo do gate

Declarar o Interpreter Core seguro o suficiente para virar a primeira dependencia real do External Calc.

Este gate NAO promove o Core para producao e NAO autoriza escrita de preco.

Ele apenas responde:

> o interpretador ja pode ser consumido como componente independente e previsivel pela futura Calc Service?

## Regra de passagem

O Gate 02 somente passa quando os quatro blocos abaixo estiverem verdes simultaneamente.

### A. Independencia estrutural

- [x] Core sem Supabase/Postgres
- [x] Core sem `tenant_id`
- [x] Core sem chamadas de rede
- [x] Core sem codigo `calc_*`
- [x] Core sem hardcode Apple/iPhone
- [x] Core sem branch por fornecedor
- [x] Core sem persistencia
- [x] Core sem dependencia obrigatoria de LLM

Evidencia estatica atual:
`ferramentas/interpreter-core/v1/core.js`

Resultado da auditoria:
```text
supabase                false
postgres                false
tenant                  false
network                 false
consumer_calc           false
supplier_branch         false
domain_iphone           false
domain_apple            false
filesystem dependency   false
```

Observacao:
o acoplamento com a Calculadora permanece fora do Core, no adapter legado.

### B. Superficie independente

- [x] interface publica `interpretResolved()`
- [x] CLI generica criada
- [x] schema externo por arquivo
- [x] KnowledgeSnapshot externo por arquivo
- [x] execucao possivel sem knowledge, com abstinencia em vez de invencao
- [x] prova runtime da CLI observada em CI

Arquivos:
- `ferramentas/interpreter-core/v1/cli.js`
- `ferramentas/interpreter-core/v1/prova_cli.js`

Uso esperado:

```bash
node ferramentas/interpreter-core/v1/cli.js \
  --input lista.txt \
  --schema schema.json \
  --knowledge knowledge.json
```

A CLI:
- le somente arquivos/stdin;
- nao conhece Supabase;
- nao chama rede;
- nao grava operacao;
- devolve `InterpretationBundle`.

### C. Regressao deterministica

Suite consolidada:

```bash
node ferramentas/interpreter-core/v1/gate_interpreter_ready_local.js
```

Ela executa:

1. `prova_core.js`
2. `prova_generalization.js`
3. `prova_cli.js`
4. `prova_apple_domain.js`
5. `prova_shadow_comparator.js`
6. `prova_divergence_analyzer.js`
7. `prova_offer_expansion_v1.js`
8. `prova_supplier_profile_adapter.js`
9. `prova_real_shadow_semantic.js`

Criterio:

```text
GATE_LOCAL=PASS
```

Estado:
- [x] execucao runtime observada

### D. Corpus real / seguranca semantica

Este e o bloqueio principal de promocao.

O mesmo corpus real deve ser processado por:

```text
calc_parse_v2 / leitor atual
vs
Interpreter Core
```

Gate obrigatorio:

```text
supplier_aware_confirmed_silent_wrong_price = 0
supplier_aware_unresolved_price_attribution = 0
actionable_residual_after_source_adjudication = 0
GATE_LOCAL = PASS
```

O multiconjunto bruto contra o leitor legado continua sendo medido, mas nao e mais tratado como verdade absoluta quando a propria fonte contradiz o legado. Uma divergencia somente sai do conjunto acionavel quando existe evidencia estrutural/proveniencia suficiente e a categoria e registrada como adjudicada, sem alterar os dados brutos do benchmark.

O gate local inclui prova sintetica nao-Apple para impedir overfitting ao corpus atual.

A promocao usa um ledger por instancia residual. Cada missing/extra pode ser adjudicado no maximo uma vez. Contagens historicas calculadas por diagnosticos independentes continuam visiveis, mas nao entram no gate quando reutilizam a mesma instancia. No corpus atual, isso corrigiu a estimativa anterior de 34 para 44 residuos acionaveis.

Tambem revisar:

- extras;
- abstinencias;
- divergencias de modelo;
- divergencias de capacidade;
- divergencias de condicao;
- divergencias de cor;
- formatos nao suportados;
- vazamento de contexto entre mensagens/fornecedores.

Estado:
- [x] corpus representativo executado
- [x] `supplier_aware_confirmed_silent_wrong_price = 0` no corpus atual
- [x] `supplier_aware_unresolved_price_attribution = 0` no corpus atual
- [ ] residuos acionaveis no ledger = 0 (atual: 44 = 21 missing + 23 extras)
- [ ] divergencias restantes classificadas
- [ ] erros transformados em fixtures permanentes

## Relacao com a definicao de pronto do Core independente

Estado atual:

1. CLI sem Supabase — IMPLEMENTADO / runtime pendente
2. mesma lista em hosts distintos produz mesmo bundle — PARCIAL
3. trocar KnowledgeSnapshot por JSON sem mudar Core — ESTRUTURALMENTE PASS
4. fornecedor novo sem mudar Core — ESTRUTURALMENTE PASS / prova real pendente
5. alias novo sem mudar Core — ESTRUTURALMENTE PASS
6. executar sem LLM — PASS
7. trocar host sem regra semantica nova — PASS estrutural
8. registro final explica fontes — coberto pela arquitetura/testes; runtime pendente
9. ambiguidade explicita — coberto pela arquitetura/testes; runtime pendente
10. zero preco errado silencioso no corpus real — PASS no corpus atual; continua requisito permanente
11. nenhum banco no Core — PASS
12. nenhum ramo por fornecedor no Core — PASS

## O que NAO fazer antes deste gate

Nao:

- criar microservico definitivo;
- acoplar auth;
- escrever no banco;
- substituir `calc_parse_v2`;
- ativar aprendizado automatico;
- criar LLM no caminho feliz;
- construir billing;
- redesenhar frontend completo.

## Proximo passo operacional

Executar o benchmark real existente sobre o corpus representativo e gerar um relatorio de divergencias.

Entrada:

```text
raw real
+
snapshot do leitor legado
```

Executor:

```bash
node ferramentas/interpreter-core/v1/benchmark_real_load.js \
  raw.txt \
  legacy-bench.json
```

Resultado exigido antes de Gate 02 = PASS:

```text
GATE_LOCAL=PASS
supplier_aware_confirmed_silent_wrong_price=0
supplier_aware_unresolved_price_attribution=0
actionable_residual_after_source_adjudication=0
divergencias brutas preservadas e classificadas
nenhuma escrita operacional
```

## Decisao atual

`GATE 02 = NOT READY YET`

Motivo:
a independencia estrutural, o gate local e a seguranca de preco estao verdes no corpus atual. O bloqueio restante e reduzir a zero os residuos realmente acionaveis apos adjudicacao baseada na fonte, sem reproduzir divergencias comprovadamente erradas do leitor legado.
