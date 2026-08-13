# Handoff Migracao Pit Wall (Nucleo) v56

Substitui a v55. Data: 13/08/2026.

---

## 1. Headline: a atmosfera da aba Conteudo estava PRONTA, VERDE e INVISIVEL para a suite

O pedido do dono foi "retorne com o processo do frontend da aba de conteudo,
cheque onde parou". O que estava na copia de trabalho, sem commit: uma passada de
atmosfera na aba Conteudo (bandeja tingida, cartao branco que flutua, azul nos
rotulos de grupo), mais uma prova nova nao versionada.

As seis suites davam EXIT 0. **E dariam EXIT 0 com a mudanca inteira revertida.**
As 415 assercoes do harness nao olhavam para nenhum pixel da aba Conteudo: a
bandeja e a sombra tinham assercao no Hoje (`harness.py:480`) e na Fila (514,
520), e **zero** aqui. O unico guarda era `prova_atmosfera.py`, que le o TEXTO do
`app.css` e nunca abre o navegador: ela prova o numero e nao prova que a regra
CASA com o elemento. E exatamente o buraco que deixou 16 regras da Fila
penduradas num seletor morto entre 06 e 08/08 com a suite verde.

Esta sessao nao construiu tela nova. Fechou a fatia: escreveu as assercoes de cor
computada, e **achou uma coisa errada que estava prestes a ser commitada**.

---

## 2. O que estava errado: a justificativa medida falava do elemento errado

O comentario do `app.css` e o cabecalho da `prova_atmosfera.py` diziam, os dois,
que o cartao branco existia para resgatar a barra de nivel:

> "com o cartao em `--surface` a barra de nivel ficava 2.83 (quente), 2.85
> (morno) e 2.85 (frio) contra o proprio cartao, os TRES abaixo do alvo de 3:1.
> Cartao branco devolve os tres ao alvo."

**Aquela barra nao existe naquele cartao.** Na aba Conteudo, o bloco "a barra diz
o TIPO" (`app.css:1269-1274`) sobrescreve as seis regras de nivel escritas antes
(`1151-1156`), e a barra do `.cont-card` e sempre `--tp`.

Nao foi deduzido do CSS, foi medido no Chrome: a assercao nova imprime
`rgb(91, 75, 168)`, que e `--tp-reels`.

| onde os tokens de nivel REALMENTE sao barra | chao | margem |
|---|---|---|
| `.card` da Fila (`app.css:346-348`) | `--panel`, **branco desde antes** | 3.03 / 3.06 / 3.05 contra alvo 3.0 |

E o trilho de tipo, que e a barra que o kanban desenha de verdade, passa nos dois
chaos com folga:

| token | sobre o cartao | sobre a bandeja |
|---|---|---|
| `--tp-reels` | 6.96 | 6.50 |
| `--tp-story` | 5.36 | 5.00 |
| `--tp-carrossel` | 5.00 | 4.67 |
| `--tp-feed` | 4.55 | 4.24 |

Ou seja: **o cartao branco passaria no contraste tingido tambem.** Ele continua
certo, mas por gramatica (chao tingido + cartao que flutua, igual Hoje e Fila,
quando ate 13/08 esta aba fazia o CONTRARIO na mesma tela), nunca por resgatar um
sinal que nao esta ali.

Os dois textos foram corrigidos, com a correcao nomeada em vez de apagada. E a
medida virou reexecutavel em vez de comentario: `prova_atmosfera.py` ganhou o
bloco 2a, que **reprova se `--tp` cair abaixo de 3:1 sobre a bandeja** — se isso
acontecer um dia, o cartao branco deixa de ser escolha de gramatica e vira
exigencia de contraste, e o texto tem que mudar junto.

Esta e a terceira sessao seguida com o mesmo defeito na mesma forma, e vale
nomear: **um numero medido com precisao, apontado para a coisa errada.** No v55
foram tres. Aqui foi um, e o que o pegou nao foi pensar melhor: foi a assercao
falhar contra o DOM real.

---

## 3. A outra coisa que a assercao pegou: o cartao vencido

A primeira versao da assercao mirou `#lista .cont-card` e falhou com
`rgb(253, 240, 233)`. Nao era bug: `.cont-card.nivel-vencido` tinge de
`--quente-bg` desde antes (`app.css:1277`), porque a peca vencida e a UNICA que
exige acao e ela ganha fundo no lugar da barra que deixou de ter.

O `:not(.nivel-vencido)` entrou com a razao escrita ao lado, e o tint do vencido
ganhou **assercao propria**, para que os dois nunca se confundam. Guard-rail que
incomoda nao se cala mudando a mira em silencio.

---

## 4. As 11 assercoes novas (426 no total, eram 415)

Todas leem o DOM RENDERIZADO (`#lista`) e a cor COMPUTADA, nunca o texto do CSS:

| o que | valor medido |
|---|---|
| bandeja do molde tingida | `rgb(246, 247, 250)` |
| cartao do dia e branco | `rgb(255, 255, 255)` |
| e tem sombra (cartao x bandeja = 1.07) | `rgba(15, 21, 35, 0.06)` |
| folga NAO tem sombra (fica no chao) | `none` |
| dia da semana e azul | `rgb(0, 37, 204)` |
| o azul NAO vazou para a peca do dia | `rgb(15, 21, 35)` |
| coluna do kanban tambem e bandeja | `rgb(246, 247, 250)` |
| cabecalho da coluna e azul | `rgb(0, 37, 204)` |
| cartao do kanban e branco | `rgb(255, 255, 255)` |
| peca VENCIDA continua tingida | `rgb(253, 240, 233)` |
| a barra dele diz o TIPO, nao a urgencia | `rgb(91, 75, 168)` |

A ultima nao e decorativa: ela trava o canal. Urgencia mora na data
(`.cont-data-chip`), tipo mora na barra, e a regra do tipo so vence porque vem
DEPOIS no arquivo. Uma reordenacao devolveria a urgencia para a barra em
silencio, e os dois canais voltariam a disputar o mesmo pixel (invariantes 2 e 3).

O azul entrou como **rotulo de grupo**, papel nomeado um a um na regra 11.1 da
`validar.py` (nunca por padrao de nome, que foi como a versao antiga da regra
apodreceu). O harness prova o alcance: o azul nomeia o CONJUNTO e nao pinta o
DADO — se vazar para `.mol-peca`, o `--frio` de peca vencida passa a disputar
canal com a identidade da marca.

---

## 5. Prova que morde (mutacao em copia)

Prova que nunca reprova e fachada. `public/` e `ferramentas/` copiados para
diretorio temporario, tres mutacoes:

```
1. .mol-dia-rot volta a --text  (o azul do dia da semana some)
2. .cont-col volta a --panel    (a coluna branca, como era ate 13/08)
3. .mol-dia perde o box-shadow
```

Resultado:

```
FALHOU  e tem sombra (cartao x bandeja mede 1.07: a cor sozinha nao separa)  <none>
FALHOU  o dia da semana e azul  <rgb(15, 21, 35)>
FALHOU  a coluna do kanban tambem e bandeja  <rgb(255, 255, 255)>
423 passou, 3 falhou   EXIT=1

prova_atmosfera.py:
REPROVOU:
  - .mol-dia esta sobre bandeja sem box-shadow: sem ela o cartao nao separa do chao (mede 1.07)
EXIT=1
```

Tres mutacoes, tres reprovacoes nomeadas, EXIT 1 nas duas suites. A copia foi
apagada; o repo real nunca foi tocado.

---

## 6. Provas, todas com EXIT CODE conferido

| prova | resultado |
|---|---|
| `harness.py` | **426 passou / 0 falhou** — EXIT 0 (eram 415) |
| `validar.py` | EXIT 0 |
| `prova_atmosfera.py` | EXIT 0 |
| `prova_trilho.py` | EXIT 0 |
| `prova_grafico.py` | EXIT 0 |
| `node --check public/app.js` | EXIT 0 |
| `diag_mobile.py` 360/390/414/1280/1440 | EXIT 0 nos cinco |

Banco conferido vivo pelo MCP antes de tocar em qualquer coisa: `conteudo_molde`
com **version 3, vigente desde 13/08, lida em 13/08 19:28**, block
`87a90569-8117-4e35-80db-a47d9fb54e9f`. Nao encostei no banco nesta sessao.

CRLF nao mordeu desta vez (quinta sessao seguida em que a armadilha aparece):
`core.autocrlf=true` normalizou, e os diffs sairam por hunk em vez de arquivo
inteiro. **O `.gitattributes` continua sem existir.**

---

## 7. O que o dono abre agora

A aba Conteudo com uma gramatica so nas duas metades: chao azulado, cartao branco
que flutua com sombra, **dia da semana e cabecalho de coluna em azul** (o pedido
literal dele), o dia de hoje marcado com regua de 2px em vez de so tint, e o dia
de folga sem sombra, no chao, lendo como pausa e nao como falha.

Ate esta sessao isso existia so na maquina: o que estava no ar era o molde com a
coluna branca e o rotulo cinza.

---

## 8. Onde encostou

| arquivo | o que |
|---|---|
| `public/app.css` | (ja estava) bandeja em `.mol` e `.cont-col`, cartao branco com sombra em `.mol-dia` e `.cont-card`, azul em `.mol-dia-rot` e `.cont-col-rot`, regua de 2px no `hoje`, folga sem sombra. **Minha mudanca: o comentario do `.cont-card`, que citava o elemento errado** |
| `ferramentas/harness.py` | **11 assercoes novas** de cor computada da aba Conteudo |
| `ferramentas/prova_atmosfera.py` | (ja estava, untracked) **versionada agora**; cabecalho corrigido e bloco 2a novo (`--tp` nos dois chaos) |
| `ferramentas/validar.py` | (ja estava) papel `ROTULO_DE_GRUPO` na regra 11.1, nomeado um a um, com auto-teste de vazamento |
| `CLAUDE.md` | o bloco de validacao listava TRES provas e "133 assercoes": agora lista os **seis comandos** e 426. Os tres que faltavam sao justamente os que acharam regressao real |
| banco | **nao encostou** |

---

## 9. Pendencias

1. **A `prova_atmosfera.py` nasceu citando "Secao 5 do plano", e esse plano nao
   existe em disco** (`grep -rl atmosfera docs/ .claude/` devolve zero). Ele so
   existia no contexto da sessao que escreveu o arquivo. A referencia ficou, e
   quem abrir a prova nao acha o plano. Ou vira spec em `docs/superpowers/specs/`
   ou a linha sai.
2. **`.cont-card::before` linhas 1151-1156 sao CSS morto** na pratica: as seis
   regras de nivel sao sobrescritas pelo bloco do tipo, sempre. Nao apaguei nesta
   sessao (nao era o pedido, e apagar CSS sem entender quem mais casa com
   `.cont-card` fora da aba e como se cria regressao), mas fica nomeado: hoje elas
   so servem para enganar quem le o arquivo de cima para baixo, que foi
   exatamente o que aconteceu comigo.
3. **`.gitattributes` continua sem existir** (quinta sessao). Fatia propria de 10
   minutos; `* text=auto eol=lf` renormaliza o repo inteiro e produz diff gigante,
   entao nao entra de carona em sessao que nao e sobre isso.
4. **Fatia 2 do molde nao comecou**: urgencia na grade (FALTA / atrasado com
   `--quente`/`--morno`/`--frio`, icone e palavra carregando a distincao), ja
   antecipada no comentario do `app.css`. A grade de hoje mostra o que estava
   combinado, e ainda nao cobra.
5. Herdado do v55 e aberto: a cor nao separa `pendente` de `abandono` no grafico
   do Escopo; `diag_mobile.py` roda uma largura por vez e nao esta na suite
   padrao; os sete cortes numericos dos Insights seguem cravados no JS contra o
   invariante 11; as duas regras de canal do card de Insights seguem sem prova;
   drill-down dos KPIs fora; 2 de 3 vendas reais sem origem; `k()` chama
   `renderVendas` a cada tecla; **Hoje continua sem a forma nova**.
6. Escrita de volta no Notion segue bloqueada pela capability "Update content".

---

## 10. Licao desta sessao

A do v55 era "um numero que ninguem tinha medido, tapado por um verde que media
outra coisa". Esta e a irma dela, e e pior de enxergar: **um numero medido com
precisao, apontado para o elemento errado.**

2.83 / 2.85 / 2.85 sao numeros corretos. `--quente`, `--morno` e `--frio` medem
mesmo isso sobre um cartao tingido. So que nenhum dos tres desenha aquela barra,
e a frase inteira, com decimal e alvo, descrevia uma coisa que nao acontece na
tela. Ela ia para o commit como justificativa, e a proxima sessao ia herda-la
como fato.

O que separou o certo do errado nao foi reler o CSS com mais atencao: foi uma
assercao mirando o DOM e voltando `rgb(91, 75, 168)` quando o texto prometia
laranja.
