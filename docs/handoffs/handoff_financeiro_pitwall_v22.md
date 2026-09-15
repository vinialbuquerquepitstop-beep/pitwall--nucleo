# Handoff financeiro v22 — E2, Fase 1 conferida e pronta para execucao

**Data:** 15/09/2026
**Tipo:** CONFERENCIA DE RAIO GRANDE, Fase 1 da E2. Nenhuma mudanca de produto ou banco aplicada nesta fase.
**Branch:** `financeiro-e2`
**Base da branch:** `7f8ac69213b0ca43d66c4e00e60caca0926ab859`
**Substitui:** `handoff_financeiro_pitwall_v21.md` como topo da branch `financeiro-e2`.

> O `main` continua com o v21 como ultimo estado integrado do Financeiro ate a E2 ser fechada e integrada. Este v22 registra o estado de trabalho validado da branch, para Claude Code e ChatGPT/Codex retomarem a mesma Fase 2 sem depender de memoria de conversa.

---

## 0. Estado em uma linha

A Fase 1 da E2 foi concluida so com leitura e medicao. O desenho previsto pelo plano foi confirmado no banco vivo e no codigo. A Fase 2 pode comecar sem decisao pendente nova.

Frase da E2:

> nenhuma regra grava `dominio` para contraparte que o dono nunca julgou, e a tela mostra quantas linhas voltaram para a fila.

---

## 1. Git e isolamento

A branch `financeiro-e2` nasceu do mesmo HEAD do `main`:

`7f8ac69213b0ca43d66c4e00e60caca0926ab859`

A branch foi criada antes de qualquer escrita da E2 para isolar a entrega do trabalho paralelo de outros agentes.

Nenhuma migration, RPC, arquivo de `public/`, regra financeira ou dado de producao foi alterado durante a Fase 1.

---

## 2. Regra `Compra no débito`, estado vivo medido

No banco vivo, a regra continua assim:

- padrao: `Compra no débito`;
- tipo: `comeca`;
- categoria: `NULL`;
- dominio: `pessoal`;
- prioridade: `9000`;
- ativa: sim;
- origem: `manual`;
- `aplicada_n`: 267.

A leitura dos movimentos que casam com o padrao mediu:

- 409 movimentos casam com o texto;
- 407 estao hoje com `dominio = pessoal`;
- 214 estao em `pessoal` e sem categoria, que e o conjunto que perde o dominio automatico na saida A da D-s;
- esses 214 movimentos somam **R$ 8.207,31**;
- a medicao viva encontrou 155 contrapartes nesse subconjunto.

O numero historico de 175 contrapartes pertence ao momento da auditoria original. Para a Fase 2, o banco vivo de 15/09 e a medida operacional de record.

---

## 3. Simulacao da saida A da D-s

A decisao do dono continua sendo **D-s = A**: a regra perde o `dominio`; o passado que so tinha esse julgamento automatico volta para a fila.

A simulacao sem escrita reproduziu o efeito esperado do plano sobre a cobertura mensal:

| Mes | Cobertura simulada | Pendentes |
|---|---:|---:|
| 2026-02 | 98,03% | 44 |
| 2026-03 | **91,77%** | **50** |
| 2026-04 | 98,63% | 44 |
| 2026-05 | 98,93% | 37 |
| 2026-06 | 99,12% | 16 |
| 2026-07 | 96,06% | 14 |
| 2026-08 | 99,56% | 11 |

Conclusao: o efeito que o plano declarava continua verdadeiro. Marco cai abaixo do gate F3 de 95% e deve esconder os numeros economicos daquele periodo ate julgamento suficiente. Isso e comportamento correto da E2, nao regressao.

---

## 4. Buraco confirmado em `fin_regra_salvar`

A funcao viva `public.fin_regra_salvar(payload jsonb)` foi lida inteira.

Ela hoje valida:

- sessao e papel;
- id e estado arquivado;
- padrao, tipo, origem, categoria, dominio e prioridade;
- categoria atribuivel manualmente;
- padrao generico acima de 60%;
- escrita e conflito de unicidade.

Ela **nao possui** a defesa da E2 que recusa uma regra genérica capaz de gravar `dominio` sem categoria para um padrao que nao nomeia uma contraparte julgada.

Portanto, o defeito continua ativo e pode reaparecer em regra futura se a E2 apenas limpar a regra atual sem fechar a porta de entrada.

---

## 5. Defeito da unidade da nota confirmado

A tabela `fin_nota_numero` viva ainda nao possui coluna `unidade`.

No frontend, `finNota()` formata `valor_antes` e `valor_depois` sempre com `brlV(...)`.

Isso significa que uma nota de `escopo = pct_julgado` seria desenhada como dinheiro, por exemplo `R$ 100,00` para `R$ 91,77`, em vez de porcentagem.

Esse defeito ja estava previsto no v20/v21 e entra de carona na E2. A Fase 2 precisa criar unidade fechada, no minimo `brl` e `pct`, fazer a RPC devolver a unidade e fazer a tela escolher o formatador correto. A prova precisa verificar o texto renderizado, nao apenas a existencia da nota.

---

## 6. CONTRATO ainda precisa ser atualizado na Fase 2

O `docs/financeiro/CONTRATO.md` atual nao contem a nova recusa da E2.

Como a Fase 2 cria uma recusa nova, o mesmo commit precisa adiciona-la ao vocabulario fechado da secao 4, preservando C3.

A E2 e de raio grande justamente porque toca `CONTRATO.md`. Por isso esta Fase 1 existiu e terminou antes de qualquer escrita.

---

## 7. O que foi PROVADO nesta fase

Foi provado por leitura do banco vivo e do repo:

- a regra `Compra no débito` continua ativa e com prioridade 9000;
- o subconjunto de retorno a fila existe e hoje mede 214 movimentos / R$ 8.207,31;
- a simulacao leva marco a 91,77%, abaixo do F3;
- os outros seis meses medidos permanecem acima de 95%;
- `fin_regra_salvar` ainda nao fecha o buraco que a E2 existe para fechar;
- `fin_nota_numero` ainda nao tem unidade;
- `finNota()` ainda trata porcentagem como BRL;
- o `CONTRATO.md` ainda nao possui a recusa nova da E2;
- nenhuma escrita de producao aconteceu nesta Fase 1.

---

## 8. O que NAO foi provado

Ainda nao foi provado, porque pertence a Fase 2:

- que retirar o dominio da regra e das 214 linhas produz exatamente o estado final esperado depois da escrita real;
- que a nova defesa de `fin_regra_salvar` recusa o vetor perigoso sem bloquear regras validas por contraparte;
- que prioridade 9000 permanece preservada como contrato;
- que a nota percentual aparece como `%` na tela;
- que a tela mostra quantas linhas e quanto valor voltaram para julgamento;
- que o atalho abre Movimentos no recorte correto e ordenado por valor;
- RLS, grants e regressao da nova migration;
- suite completa e diagnosticos de largura depois da implementacao.

---

## 9. Primeiro movimento do proximo chat

**Executar a Fase 2 da E2 na branch `financeiro-e2`.**

Escopo fechado:

1. aplicar a saida A da D-s sem inventar julgamento novo;
2. remover o `dominio` automatico da regra `Compra no débito` e devolver somente o conjunto correto para julgamento;
3. criar a defesa permanente em `fin_regra_salvar` para impedir a repeticao do defeito;
4. adicionar a recusa nova na secao 4 do `CONTRATO.md` no mesmo commit;
5. corrigir `fin_nota_numero` para carregar unidade e corrigir `finNota()` para renderizar `pct` como porcentagem;
6. criar as notas exigidas pelo portao 6.3 para os numeros que mudarem;
7. fazer a tela declarar quantas linhas e quanto valor voltaram para a fila, com atalho para Movimentos ordenado por valor;
8. provar prioridade 9000, F3, texto da nota, RLS, migrations, suite e larguras;
9. somente depois fechar a E2, criar novo handoff e decidir integracao no `main`.

Nao entram nesta Fase 2: E3, E4, E5, E6, E7, E8 ou E9; nenhuma classificacao manual de contraparte; nenhuma revisao das outras regras fora do necessario para provar a nova defesa.

---

## 10. Invariantes reforcados

- Inv. 18: sem `dominio`, fora dos totais; dominio nunca nasce de default silencioso.
- F3: abaixo de 95% em valor, numero economico some e a tela declara base incompleta.
- C1: um unico motor de classificacao continua soberano.
- C3: recusa nova nasce no servidor e entra no vocabulario do CONTRATO no mesmo commit.
- C6: a E2 fecha verticalmente, banco, tela e prova juntos.
- Portao 6.3: numero que muda precisa trazer explicacao na mesma entrega.
- Handoff commitado e imutavel: este v22 nao deve ser editado depois de commitado; novo estado gera v23.
