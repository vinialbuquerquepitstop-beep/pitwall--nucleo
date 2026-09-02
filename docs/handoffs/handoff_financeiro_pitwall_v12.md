# Handoff Financeiro v12 — cada linha sabe de quem veio ou para quem foi

Data: 02/09/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v11.md`
como topo da linha.

Fecha a **Fatia 4** inteira: Etapa 1 (banco, 4 migrations), Etapa 2 (tela, `app.js` e
`app.css`) e Etapa 3 (prova). As tres sobem no MESMO commit, pelo C6 do
`docs/financeiro/CONTRATO.md`. As Etapas 1 e 2 ja estavam na working tree, prontas e
NUNCA commitadas; o `handoff_frontend_pitwall_v2.md` (vitrine) descreve a Etapa 2 em
detalhe e continua valendo como registro dela.

---

## 1. A frase da entrega

**Cada linha de Movimentos diz de quem o dinheiro veio ou para quem foi, e da para
julgar uma contraparte inteira de uma vez.**

Sujeito visivel na tela: a linha `veio de / foi para <nome>` e o painel
**Por contraparte** no topo da sub-view Movimentos.

O numero que justifica, medido na base viva de 1.132 movimentos em 02/09/2026: julgar
o pendente linha a linha custa **290 decisoes** para cobrir 95% do valor; julgar por
contraparte custa **68**, e 30 cobrem 80%. Mesma cobertura, um quarto do trabalho.

---

## 2. O que entrou no commit

| Camada | Arquivo | Delta |
|---|---|---|
| Banco | `supabase/migrations/20260902_fin_fatia4_contraparte_helper.sql` | 123 linhas, novo |
| Banco | `supabase/migrations/20260902_fin_fatia4_contraparte_backfill.sql` | 28, novo |
| Banco | `supabase/migrations/20260902_fin_fatia4_importar_contraparte.sql` | 234, novo |
| Banco | `supabase/migrations/20260902_fin_fatia4_movimentos_contraparte.sql` | 201, novo |
| Tela | `public/app.js` | +155 / -3 |
| Tela | `public/app.css` | +99 (Fatia 4) +9 (o conserto da secao 4) |
| Prova | `ferramentas/harness.py` | mock enriquecido + **40 assercoes `fin4:`** |
| Prova | `ferramentas/diag_mobile.py` | `retVis()`, o retangulo visivel |
| Documento | `docs/handoffs/handoff_frontend_pitwall_v2.md` | 172, novo |
| Documento | `docs/handoffs/handoff_financeiro_pitwall_v12.md` | este |
| Documento | `CLAUDE.md` | contadores da suite e a ferramenta nova |

`privado.fn_fin_contraparte` e o motor UNICO da extracao (C1): serve o backfill e a
importacao. A tela nao normaliza nada, manda o nome como o dono ve e deixa o servidor
decidir, senao no dia em que as duas implementacoes divergissem a tela devolveria zero
linha em silencio.

---

## 3. A Etapa 3, que e o motivo deste handoff existir

O v11 (ressalva 2 do handoff da vitrine) tinha deixado escrito, com todas as letras,
que o painel **nunca tinha sido medido populado**: o mock de `fin_movimentos` no
`harness.py` nao devolvia `contrapartes`, e como o `diag_mobile.py` reusa esse mesmo
stub, as cinco larguras mediram o bloco novo com a lista VAZIA. Os 997 verdes provavam
que nada tinha regredido, e nao provavam uma linha do comportamento novo.

Fechar essa ressalva era a Etapa 3. Ela pegou **dois defeitos reais**.

### 3.1 O `<b>` do recorte cobrindo 100% do valor em 360px

Com o painel populado, o `diag_mobile` acusou, em 360px:

```
SOBREPOE 1257px (100%): b "7 contrapartes"  x  b "R$ 5.045,20"
```

Causa: `<b>` inline que quebra entre as duas palavras tem **UM** retangulo cobrindo as
duas linhas. E exatamente o mesmo defeito que a Etapa 2 ja tinha corrigido no
`.fin-cp-pe`, na mesma tela, e que reapareceu no vizinho. Conserto igual ao precedente:
`display:inline-block` em `.fin-cp-corte b`, com o motivo escrito no CSS.

### 3.2 O resumo por contraparte era invisivel para o guard-rail de celular

Com a lista vazia, o painel inteiro (`.fin-cp-item`, `.fin-cp-nome`, `.fin-cp-pend`,
o corte, a nota) nunca chegava ao DOM na medida das cinco larguras. Populado o mock, ele
passou a ser medido nas cinco. O nome mais longo da base viva
(`MERCADOLIVRE PAGAMENTOS SERVICOS DE CONVENIENCIA LTDA`, 52 chars) entrou no fixture de
proposito: nome curto nao mede quebra de linha nenhuma.

---

## 4. A mudanca no `diag_mobile.py`, e por que ela APERTA em vez de afrouxar

Com o painel populado, a ferramenta passou a acusar de 8 a 14 "sobreposicoes" por
largura, nas cinco. Todas pareadas assim:

```
span.fin-cp-n "1 lançamento"  x  p.fin-cp-nota "Movimentado é a soma dos valores..."
```

Causa medida: o `.fin-cp-lista` tem `max-height:264px` e `overflow-y:auto`. Item que
fica abaixo desses 264px esta **clipado na tela**, mas `getBoundingClientRect()`
continua devolvendo a posicao real, la embaixo, em cima da nota e da barra de lote. O
`rolaDentro()` da ferramenta so olhava `overflowX`, entao o eixo Y nao existia para ela.

O conserto NAO foi silenciar o par. Foi `retVis(el)`: o retangulo do elemento **cortado
por todo ancestral que esconde o que passa dele**, nos dois eixos. Elemento parcialmente
visivel passa a ser comparado pela parte que aparece; elemento totalmente rolado para
fora tem area zero e nao pode cobrir letra nenhuma, que e a verdade fisica da tela.

Isso e o oposto de repontar baseline: a medida ficou mais exata, nao mais permissiva.
O estouro horizontal continua medido pelo rect cheio, com a regra do `rolaDentro()`
intacta.

**Prova de que a ferramenta continua mordendo** (mutacao, 02/09/2026): com
`.fin-cp-nome{position:absolute;margin-top:22px}` colado no fim do `app.css`, o
`diag_mobile 390` voltou a **EXIT 1**, acusando as sobreposicoes reais do painel
(`sem contraparte` 30%, `AGENCY FORD SUL C MODELOS` 32%, `MERCADOLIVRE...` 90%). O
mutante foi removido em seguida.

---

## 5. O que foi PROVADO, com EXIT code

| O que | Comando | Resultado | EXIT |
|---|---|---|---|
| Sintaxe | `node --check public/app.js` | sem saida | **0** |
| Suite estatica | `python ferramentas/validar.py` | `TUDO PASSOU` | **0** |
| Comportamento | `python ferramentas/harness.py` | `1037 passou, 0 falhou` · `1042 declaradas, 1037 executadas, 0 nao executaram (5 de ramo alternativo)` | **0** |
| Trilhos | `python ferramentas/prova_trilho.py` | passou | **0** |
| Grafico do Escopo | `python ferramentas/prova_grafico.py` | passou | **0** |
| Atmosfera | `python ferramentas/prova_atmosfera.py` | passou | **0** |
| Celular e desktop | `diag_mobile.py` em 360, 390, 414, 1280, 1440 | `0 sobreposicoes, 0 estouros` nas cinco, **com o painel populado** | **0** nas cinco |
| Monitor grande | `diag_largo.py` em 1500, 1920, 2560 | 14 abas no teto contratado e centradas | **0** nas tres |

A suite saiu de **997** para **1037** assercoes: sao **40 novas com prefixo `fin4:`**,
e nenhuma das 997 anteriores mudou de valor.

### 5.1 As 40, em uma frase cada

- **A linha (5):** saida diz `foi para`, entrada diz `veio de`, a direcao vem do SINAL
  do valor; linha sem nome mantem o rotulo visivel e diz `não identificada`, em `--dim`;
  o nome e botao, com a sentinela `sem_contraparte` no lugar do vazio.
- **O resumo (13):** uma entrada por contraparte; ordem do servidor preservada
  (`5765.5 > 4800 > 4300 > 2000 > 320.5 > 105.1 > 50`); valor em BRL; o balde de nome
  nulo aparece e e clicavel; `R$ 4.800,00 a julgar em 1` em quem cobra e `tudo julgado`
  em quem nao cobra; o pendente segue a definicao literal do F3 e **nao conta a
  categoria de natureza neutro**; so quem cobra ganha a marca, e ela le em `--morno-fg`,
  nunca `--erro`; a nota diz que movimentado nao e saldo; o recorte declara o total e a
  soma pendente, e essa soma **fecha com as entradas da propria lista** (4995,50).
- **O corte de 200 (3):** `Mostrando as 7 de 364`, `357 de fora são as menores`,
  `estreite o período`, e a lista continua com as 7 que chegaram.
- **O filtro (19):** `p_contraparte` vai NULO sem filtro e com o nome no clique; a
  lista encolhe de 14 para 4; **o resumo NAO encolhe**; `aria-pressed` em um so item; a
  barra declara o nome e `4 lançamentos na tela`; o cabecalho do recorte tambem declara
  a contraparte; `Selecionar os 4` marca 4 caixas e **nao grava nada**; trocar de mes
  mantem o filtro; contraparte sem linha no mes cai em **estado vazio proprio**, que nao
  manda importar extrato; clicar de novo desliga; a sentinela traz as 5 sem nome; sair
  da sub-view zera.

### 5.2 A assercao que mais importa, provada por mutacao

`fin4: mas o resumo NAO encolhe, senao o caminho de volta sumia`.

Mutacao aplicada no stub (o resumo passando a respeitar o proprio filtro, que e
exatamente o erro que o SQL evita de proposito):

| Codigo | EXIT | rodape |
|---|---|---|
| como esta | **0** | `1037 passou, 0 falhou` |
| com o resumo respeitando o filtro | **1** | `1036 passou, 1 falhou` · `itens=1` |

Sem essa mutacao, a assercao seria uma frase bonita sem prova de que morde.

---

## 6. O que NAO foi provado

1. **`migrations aplicadas == migrations versionadas` NAO foi conferido via MCP nesta
   sessao.** Os dois servidores MCP do Supabase estavam fora: o `claude.ai Supabase`
   respondeu `not connected` nas duas tentativas, e o `supabase` (http) exige OAuth que
   so o dono completa. O que existe e o cabecalho de cada uma das 4 migrations, escrito
   pela sessao que as aplicou, com o md5 normalizado do corpo conferido contra o ledger
   (`9d299c1e...`, `5439cdbb...`, `2cd78f63...`, `7219f124...`). **Isso e testemunho de
   documento, nao medida.** E o item 2 do portao 6.1, e ele fica ABERTO.
2. **RLS nao foi retestada nesta sessao** (dono, vendedor, tenant errado). As migrations
   nao criam tabela nova; `fin_movimentos` foi derrubada e recriada com os REVOKE/GRANT
   refeitos no proprio arquivo, mas a execucao como vendedor nao foi repetida aqui.
3. **A gravacao em lote com o filtro ligado foi provada ate a borda da escrita.** A
   suite prova que `Selecionar os 4` preenche a selecao e que **nada** foi gravado; quem
   grava continua sendo `fin-lote-ok` -> `fin_classificar`, com prova propria anterior.
4. **A colisao da sentinela com um nome real `sem contraparte`** continua sem prova
   contra a base (ressalva 5 do handoff da vitrine). A normalizacao do servidor produz
   `SEM CONTRAPARTE`, que nao colide com `sem_contraparte` em minusculas com sublinhado.

---

## 7. Portao de saida 6.2, item a item

| Item | Estado |
|---|---|
| SQL rodado no banco de verdade | **sim**, em 02/09/2026, por `apply_migration` (Etapa 1) |
| RLS testada como dono E como vendedor | **nao nesta sessao** (secao 6.2) |
| a tela le TODO campo novo, zero campo orfao | **sim**: os 5 campos novos (`contraparte` no item, `contraparte`, `contrapartes`, `contrapartes_n`, `contrapartes_truncado` na raiz) tem leitor, e cada um tem assercao |
| assercao nova com prefixo que identifica o alvo | **sim**, `fin4:`, 40 delas |
| EXIT 0 nos 7 comandos e nas 5 larguras | **sim** (secao 5) |
| commit unico, incluindo spec e plano | **sim** |
| handoff atualizado | **sim**, este arquivo |
| nenhuma recusa nova fora da secao 4 | **sim**, zero frase de recusa nova |

Portao de entrada 6.1: `git status` limpo apos o commit, suite verde, frase da entrega
escrita. **O item 2 (MCP) fica aberto e esta declarado na secao 6.1 acima.**

---

## 8. A entrega irma, no mesmo push e em commit separado

**O layout parou de desperdicar monitor grande.**

`public/app.css` nao tinha UMA media query de `min-width` acima de 1080px. O
`.conteudo` travava em `max-width:1080px` e, sendo item de grid com teto, encostava na
ESQUERDA. Medido em 02/09/2026: a 1920px eram 1080px de conteudo e **608px de vazio a
direita, identico nas 14 abas**; a 2560px, **1248px**. A suite inteira passava verde
porque nenhuma ferramenta olhava acima de 1440px.

Agora o teto sobe por degrau e o bloco e CENTRADO: 1280px a partir de 1500, 1440px a
partir de 1800, 1600px a partir de 2300. O teto nao some, porque linha de texto sem
limite cansa de ler. Armadilha medida no caminho: `margin-inline:auto` sozinho faz o
item de grid parar de esticar e virar shrink-to-fit, e a largura passou a depender do
conteudo de cada aba (488px na Indicacoes, 1440px na Rotina, com o bloco pulando de
lugar a cada clique). `width:100%` conserta, e o motivo esta comentado no CSS.

Ferramenta nova: **`ferramentas/diag_largo.py`**, irmao do `diag_mobile.py`. Um mede
tela estourando, o outro mede tela SOBRANDO. Reprova por degrau nao atingido, por
descentragem maior que 4px e por pico fora da tela. Ja registrada no `CLAUDE.md`, que
passou de SEIS para SETE comandos de validacao.

---

## 9. Pendencias

| # | Pendencia | Bloqueio ou nota |
|---|---|---|
| 1 | Conferir `migrations aplicadas == versionadas` via MCP | **Bloqueio**: OAuth do Supabase, so o dono completa. E a primeira coisa da proxima sessao |
| 2 | Porcentagem de cobertura do pendente por contraparte | Bloqueio: exige campo novo na RPC (pendente TOTAL do recorte, antes do teto de 200). Decisao do dono |
| 3 | Escrita de volta no Notion (kanban) | Bloqueio antigo, do v33: capability "Update content" na integracao |
| 4 | Ultrawide acima de 2300px para em 1600px de conteudo | Nota: proposital. Se o dono usar 3440px e quiser mais, e subir um degrau |

---

## 10. Primeiro movimento do proximo chat

Autenticar o MCP do Supabase e rodar `list_migrations`, comparando com
`supabase/migrations/`. Se as quatro `20260902_fin_fatia4_*` estiverem no ledger com o
md5 que o cabecalho de cada arquivo declara, o item 2 do portao 6.1 fecha e a Fatia 4
esta encerrada de verdade. Se NAO estiverem, a entrega da vez passa a ser fechar esse
item, e nada se constroi em cima ate la.

---

## 11. Invariantes reforcados

- **Inv. 18**: o resumo por contraparte nao grava nem sugere `dominio`. Ele diz de quem
  veio ou para quem foi; quem decide o lado e o dono.
- **F3**: o pendente por contraparte e a definicao literal do F3, e a assercao
  `o pendente segue a definicao do F3` prova que a categoria de natureza `neutro` fica
  de fora.
- **F4**: `bruto` e soma de valor absoluto. Zero netting, zero saldo. A palavra na tela
  e `movimentado`, e a nota explica.
- **C1**: motor unico da extracao no banco. A tela nao normaliza nome.
- **C2**: nenhuma lista de contraparte chumbada no JS.
- **C5**: zero token de cor novo. O azul so por `[aria-pressed="true"]`.
- **C6**: banco, tela e assercao no mesmo commit.
- **Tela que omite recorte mente**: `200 de 364` dito com numero, e o balde de nome nulo
  renderizado em vez de omitido.
- **Campo vazio tem que aparecer**: o rotulo da contraparte fica visivel na linha mesmo
  sem nome, e o painel tem estado vazio proprio.
- **Guard-rail nao se cala**: a ferramenta que incomodou ficou mais exata, e a prova de
  que ela continua mordendo esta na secao 4.
