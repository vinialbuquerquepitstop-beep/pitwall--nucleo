# Handoff calculadora Pit Wall v21 - Interpreter Core V1 pronto para integracao

18/09/2026. Substitui o v20 como topo da linha calculadora.

Linguagem: prosa sem acento, sem cedilha, sem travessao.

## 1. Escopo desta entrega

Esta sessao fechou o Gate 02 do Interpreter Core independente e isolou o pacote aprovado para integracao no `main`.

Nao houve migration, escrita operacional, substituicao de `calc_parse_v2` nem deploy de frontend.

O corpus real permaneceu somente leitura durante todo o benchmark.

## 2. Estado canonico do Interpreter Core

Gate canonico:

```text
Ledger = residual-adjudication-ledger/v8
supplier_aware_confirmed_silent_wrong_price = 0
supplier_aware_unresolved_price_attribution = 0
actionable_residual_after_source_adjudication = 0
PROMOTION_READY = true
REAL_CORPUS_GATE = PASS
```

Metricas observadas no corpus real:

```text
supplier_aware_matched_offers = 143
supplier_aware_core_offers = 186
actionable missing = 0
actionable extra = 0
actionable total = 0
```

As divergencias brutas contra o leitor legado continuam preservadas. O ledger apenas retira do conjunto acionavel divergencias adjudicadas por evidencia da propria fonte.

## 3. Fechamento dos cinco missing finais

Os cinco missing do Ledger V6 nao eram um unico defeito de materializacao.

Foram separados em duas causas:

1. quatro missing em que o legado transportava `condition` sem suporte local suficiente, atravessando fronteiras de dominio;
2. um missing em que o legado esperava cor nula, mas o Core tinha cor extraida diretamente da fonte.

A tentativa de relaxar a expansao de cor pos-preco foi rejeitada: criou ofertas extras sem resolver os cinco missing.

O Ledger V7 zerou os missing pela adjudicacao baseada na fonte. O Ledger V8 classificou tambem os quatro extras restantes e zerou o residual acionavel total.

## 4. Evidencias CI

Branch historica de auditoria:

- branch: `audit/interpreter-ready-runtime-v1`
- commit V8: `7ac338f6046df20ecd04b0aa5b9b9ce47a4b58f9`
- run #182: success
- Gate local: success
- Real corpus promotion gate: success

Freeze documental:

- commit: `b2fdb0b859dee154feb6aa168b5220b10c910ae7`
- run #184: success
- `docs/calculadora/INTERPRETER_READY_GATE_V1.md` agora declara `PASS / FROZEN`

Integracao limpa:

- branch: `integrate/interpreter-core-v1`
- base exata do `main`: `777f7f6ac88231b8154d05b43b2fc94d951f15b4`
- commit do pacote: `c8e50ec35fe9f2fa41f248d2642fee89d2611510`
- diferenca contra `main`: 1 commit, 0 atras antes deste handoff
- pacote transportado: 30 arquivos
- run #185: success
- Gate local: success
- Real corpus promotion gate: success
- Ledger V8 no run #185: residual acionavel 0, preco silencioso errado 0, atribuicao de preco nao resolvida 0

A branch historica estava 417 commits a frente e 2 atras do `main`. Por isso ela NAO deve ser mergeada diretamente. O pacote foi reconstruido sobre o `main` usando exatamente os blobs auditados.

## 5. Estado vivo do banco medido nesta sessao

Projeto Supabase medido em leitura.

Migration mais recente relacionada a esta linha:

- `20260915224552 calc_bench_ler`

Carga usada pelo gate real:

- id: `6c4d3491-f85b-4015-8393-9798ab1ce758`
- status: `rascunho`
- origem: `colado`
- n_lidas: 799
- n_casou: 639
- n_duvidoso: 107
- n_descarte: 4
- n_pendencia: 52
- texto_bruto presente: sim

Nenhum dado foi alterado nesta sessao.

FKs do dominio Calc:

- tabelas `calc_*` apontam para `tenant` quando aplicavel;
- `calc_pendencia` aponta internamente para `calc_carga`;
- nao foi encontrada FK de `calc_*` para tabela operacional fora do dominio Calc.

Advisors de seguranca medidos:

- 11 findings de funcoes `SECURITY DEFINER` executaveis por `authenticated`, incluindo `calc_bench_ler`;
- leaked password protection permanece desabilitado;
- nenhum DDL foi executado nesta sessao, portanto estes findings nao foram criados pela integracao do Interpreter Core.

## 6. Fronteiras que permanecem congeladas

O Interpreter Core V1:

- nao conhece Supabase ou Postgres;
- nao recebe `tenant_id`;
- nao chama rede;
- nao persiste;
- nao depende obrigatoriamente de LLM;
- nao tem branch por fornecedor;
- recebe schema, knowledge e perfis como dados externos;
- deve se abster quando a evidencia nao sustenta uma resposta;
- nao substitui `calc_parse_v2` automaticamente.

O benchmark real continua obrigatorio para qualquer mudanca que toque:

- `ferramentas/interpreter-core/v1/**`;
- `docs/calculadora/INTERPRETER_READY_GATE_V1.md`;
- `.github/workflows/interpreter_ready_runtime_audit.yml`.

## 7. Proximo passo

Abrir PR:

```text
integrate/interpreter-core-v1 -> main
```

O workflow do Interpreter Ready deve rodar novamente no contexto do pull request.

Merge somente com:

```text
GATE_LOCAL=PASS
REAL_CORPUS_GATE=PASS
PROMOTION_READY=true
Ledger V8 actionable residual=0
```

Depois do merge, o Interpreter Core passa a existir no `main` como componente independente aprovado. Isso ainda NAO autoriza substituir o leitor atual nem escrever resultado operacional pelo novo Core.

## 8. Decisao

`GATE 02 = PASS / FROZEN`

`INTEGRACAO NO MAIN = PR PENDENTE`
