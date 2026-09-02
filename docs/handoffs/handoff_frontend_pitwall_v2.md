# Handoff frontend (vitrine) v2 — 02/09/2026

Etapa 2 (tela) da Fatia 4 do Financeiro. Complementa, nao substitui, o
`handoff_migracao_pitwall_v68.md` e o `handoff_financeiro_pitwall_v11.md`.
O indice fica com a Torre.

**Nada foi commitado.** O commit e UNICO, no fim, com banco, tela e assercao
juntos (C6 do CONTRATO), e quem commita e a Torre.

---

## 1. Headline

A sub-view Movimentos passou a dizer, em cada linha, de quem o dinheiro veio ou
para quem foi, e ganhou o resumo POR contraparte com valor pendente visivel, que
troca 290 decisoes linha a linha por 68 decisoes por contraparte, com o recorte
de 200 de 364 declarado na tela em vez de escondido atras de um "e mais...".

---

## 2. O que mudou nesta sessao

| Arquivo | Delta | O que entrou |
|---|---|---|
| `public/app.js` | +155 / -3 | `FIN_CP`, `finCpLin`, `finCpChave`, `finCpItem`, `finCpCorte`, `finCpPainel`, `finCpBarra`, o `p_contraparte` na chamada da RPC, tres acoes novas no delegado e o estado vazio proprio do filtro |
| `public/app.css` | +99 | secao `resumo por contraparte` e o bloco `.fin-lin-cp`, zero token novo no `:root`, zero matiz novo |

Nada em `supabase/`, nada em `ferramentas/`, nada em `docs/financeiro/`.

### Os blocos, um a um

**`FIN_CP` (estado).** `""` = sem filtro, `"sem_contraparte"` = sentinela do
balde de nome nulo, qualquer outra coisa = o nome como o dono ve. Quem normaliza
e o servidor, pela mesma helper que gravou a coluna: normalizar no cliente seria
a segunda implementacao da mesma regra, e no dia em que divergissem a tela
devolveria zero linha em silencio.

**`finCpLin(x)` (a contraparte na linha).** Botao dentro de `.fin-lin-pe`, com o
rotulo SEMPRE visivel. Com nome, o rotulo e a direcao (`veio de` / `foi para`),
derivada do SINAL do valor, o mesmo criterio que a linha ja usava para separar
entrada de saida. Sem nome, o rotulo vira o neutro `contraparte` e o valor vira
`não identificada`. E botao porque o gesto que esta entrega existe para dar
comeca na linha que o dono esta olhando.

**`finCpPainel(mv)` (o resumo).** `<details open>` com a lista PRONTA do
servidor, sem reordenar e sem cortar. Cada entrada carrega nome, `bruto`,
`n` e o par `valor_pendente` + `n_pendente` (`R$ 38.120,00 a julgar em 14`, ou
`tudo julgado` quando `n_pendente` e zero). O balde de nome nulo entra como
`sem contraparte` e e clicavel pela sentinela.

**`finCpCorte(lista, mv)` (a declaracao do recorte).** Ver secao 3.

**`finCpBarra(mv, itens)` (o filtro ativo).** Le o ECO do servidor
(`contraparte` na raiz), nunca o estado local, e traz `Selecionar os N` +
`Ver todas as contrapartes`. O caminho de volta fica sempre na tela.

**As tres acoes.** `fin-cp` (liga, e desliga se clicada de novo, com
`aria-pressed` dizendo em qual estado esta), `fin-cp-limpar`, `fin-cp-todos`.

---

## 3. Decisoes tomadas, e o que foi RECUSADO

| # | Decisao | Argumento |
|---|---|---|
| 1 | **RECUSADO: escrever na tela que "as 200 cobrem 99,28% do valor pendente".** | A tela nao consegue provar esse numero. A RPC devolve `valor_pendente` das 200 que vieram, e nao o pendente total dos 364 grupos: dividir o que chegou por si mesmo daria 100% sempre, e chumbar o 99,28 medido hoje seria dado de config dentro do JS, que e o C2. No lugar, a tela declara o que o payload PROVA: `Mostrando as 200 de 364 contrapartes desta janela, as de maior valor movimentado. As 200 na tela somam R$ X ainda a julgar. As 164 de fora sao as menores desta janela: estreite o período para alcançá-las.` |
| 2 | A palavra e **movimentado**, nunca saldo | F4. `bruto` e soma de valor absoluto: entrada e saida somam em vez de se cancelar. A nota do rodape do painel diz isso com todas as letras, para que ninguem leia "saldo" onde esta escrito "movimentado" |
| 3 | Zero netting, zero "quanto fulano me deve", zero receita, margem ou meta | F4 e o escopo declarado. O erro de netting sobre janela ja custou tres numeros publicados errados sobre a contraparte BR IPHONES |
| 4 | **RECUSADO: reordenar ou cortar a lista no cliente** | O servidor ja manda ordenado por `bruto` desc com teto de 200. Reordenar aqui seria mentira assim que o teto cortasse: a tela ordenaria as 200 que recebeu, nao as maiores da janela |
| 5 | **RECUSADO: reimplementar no JS a regra de "o resumo ignora o proprio filtro"** | Ja esta provado no servidor. O JS so desenha o que chega |
| 6 | Nenhuma frase de recusa nova | C3. Toda copy nova e descricao de tela, nao vocabulario de erro. A secao 4 do CONTRATO fica intacta |
| 7 | O filtro de dominio **nao** virou porta de entrada | A base esta 271 para 1: quem clicar em `empresa` ve uma linha. O filtro continua onde estava, nao ganhou destaque, e nao foi escondido |
| 8 | Trocar de MES **nao** zera o filtro; sair da sub-view zera | O dono persegue a mesma contraparte pelos meses, e a barra do filtro fica declarando que ele esta ligado. Voltar em Movimentos dias depois e achar a lista cortada por um nome que ninguem lembra de ter clicado seria a armadilha do formulario preso a uma linha que nao existe mais |
| 9 | Estado vazio PROPRIO para o filtro sem resultado | Sem ele o caso caia no `finVazio()`, que manda importar o extrato. Estado vazio que aponta para a acao errada faz o dono desfazer o que estava certo |
| 10 | `fin-cp-todos` so preenche `FIN_SEL` | Nenhum caminho novo de escrita: quem grava continua sendo `fin-lote-ok` -> `fin_classificar` |
| 11 | O botao conta os itens NA TELA, nao o `n` do recorte | Com a lista truncada em 500, o `n` seria maior do que da para selecionar, e o botao prometeria o que nao cumpre |
| 12 | `overflow-x:hidden` (nao `auto`) na lista rolante | Com `auto`, o `diag_mobile` passaria a classificar estouro daqui como "rola por desenho" e pararia de acusa-lo. Guard-rail nao se afrouxa para caber conteudo |
| 13 | Zero token de cor novo, zero matiz para contraparte | C5. Contraparte nao e trilho e nao e sinal: e nome. O unico uso de cor e o `--morno` do que falta julgar, o mesmo token de `.fin-sec.cobra` e `.fin-lin.nc`. O azul entra so por `[aria-pressed="true"]`, papel MECANICO da regra 11.1 |

---

## 4. Provas

| O que | Comando exato | Resultado | Exit |
|---|---|---|---|
| Sintaxe do JS | `node --check public/app.js` | sem saida | **0** |
| Suite estatica (inclui a regra 11.1 do azul, zero hex no JS, `:root` intacto, classe emitida com estilo) | `python ferramentas/validar.py` | `TUDO PASSOU`, 704 classes emitidas, 0 sem regra no CSS | **0** |
| Comportamento, Chrome headless | `python ferramentas/harness.py` | `997 passou, 0 falhou` · `1002 declaradas, 997 executadas, 0 nao executaram` | **0** |
| Contraste dos 7 trilhos | `python ferramentas/prova_trilho.py` | passou | **0** |
| Degraus do grafico do Escopo | `python ferramentas/prova_grafico.py` | passou | **0** |
| Contraste da aba Conteudo | `python ferramentas/prova_atmosfera.py` | passou | **0** |
| Celular e desktop, 5 larguras | `python ferramentas/diag_mobile.py 360` (e 390, 414, 1280, 1440) | `0 sobreposicoes, 0 estouros, 0 abas com documento mais largo que a tela` nas cinco | **0** nas cinco |
| Contraste do bloco novo, por cor computada | calculo WCAG sobre os pares reais (`--dim`, `--text`, `--morno-fg`, `--accent` contra `--bg`, `--surface` e `--accent-tint` mesclado = `#F1F3FC`) | menor valor **4,60** (`--morno-fg` sobre a linha ativa), alvo 4,5 | — |

Uma reprovacao real foi pega e corrigida no meio do caminho: em 360px o
`diag_mobile` acusou `SOBREPOE 1362px (74%)` entre `.fin-cp-tit` e `.fin-cp-pe`.
Causa: `<span>` inline que quebra em duas linhas tem UM retangulo cobrindo as
duas. Corrigido com `display:inline-block` no `.fin-cp-pe`, e as cinco larguras
voltaram a 0.

Previa visual conferida em 360px e 390px com o mock enriquecido em memoria (sem
tocar em `ferramentas/`), com nome longo de contraparte, o balde nulo e o estado
filtrado.

---

## 5. Ressalvas (o que NAO foi provado)

1. **Nenhuma assercao nova entrou na suite.** A prova e a Etapa 3, por ordem do
   prompt. O que os 997 verdes provam e que **nada regrediu**; eles nao provam o
   comportamento novo.
2. **O mock de `fin_movimentos` no `ferramentas/harness.py` ainda nao devolve
   `contrapartes`, `contrapartes_n` nem `contrapartes_truncado`.** Como o
   `diag_mobile.py` reusa o STUB do harness, o painel foi medido nas cinco
   larguras com a lista VAZIA. O caminho populado foi conferido a parte, por
   previa, mas nao pelo guard-rail. **Vetor exato para a Etapa 3:** enriquecer o
   mock com pelo menos 4 entradas, uma delas com `nome: null` e uma com nome
   longo (`MERCADOLIVRE PAGAMENTOS SERVICOS DE CONVENIENCIA LTDA`), e
   `contrapartes_truncado: true`; a medida de celular passa a cobrir o bloco
   sozinha, sem tocar em `diag_mobile.py`.
3. **Nada foi provado contra o banco de verdade.** A `vitrine` nao tem acesso ao
   Supabase de proposito. A paridade da RPC foi lida no arquivo de migration
   `supabase/migrations/20260902_fin_fatia4_movimentos_contraparte.sql`, nao
   medida no banco.
4. **A composicao filtro + lote + `fin_classificar` foi provada so ate a borda da
   escrita.** O preenchimento de `FIN_SEL` foi conferido por codigo e por previa;
   a gravacao em si nao foi executada contra a base viva.
5. O texto `sem_contraparte` viaja em `data-cp` no HTML. Se algum dia existir uma
   contraparte real chamada literalmente `sem contraparte`, ela normalizaria para
   `SEM CONTRAPARTE` e nao colidiria com a sentinela, que o servidor testa em
   minusculas com o sublinhado. Nao foi provado contra a base.

---

## 6. Pendencias

| # | Pendencia | Bloqueio ou nota |
|---|---|---|
| 1 | Assercoes da Etapa 3, com prefixo proprio | Nota: e a proxima etapa, ja combinada |
| 2 | O `n_pendente` do balde nulo cobra 19 linhas de Aplicacao e Resgate | Nota: pelo F3 elas so contam como pendentes se nao tiverem categoria de natureza `neutro`. O numero vem do servidor e a tela nao interfere |
| 3 | Porcentagem de cobertura do pendente por contraparte | Bloqueio: exige campo novo na RPC (pendente TOTAL do recorte, antes do teto de 200). Fora do escopo desta etapa, decisao do dono |
| 4 | Commit unico com banco + tela + assercao | Bloqueio: e da Torre, depois da Etapa 3 |

---

## 7. Primeiro movimento do proximo chat

Ler este handoff e o `docs/financeiro/CONTRATO.md`; abrir
`ferramentas/harness.py` no mock de `fin_movimentos` (procurar
`if (nome === 'fin_movimentos')`) e acrescentar os tres campos de raiz e o
`contraparte` do item, como descrito na Ressalva 2. So depois escrever as
assercoes. Nao repontar baseline `.antes`: ela nao foi tocada nesta sessao.

---

## 8. Invariantes reforcados

- **Inv. 18** e o corolario: o resumo por contraparte NAO grava nem sugere
  dominio. Ele diz de quem veio ou para quem foi. Quem decide o lado e o dono.
- **F3**: valor pendente por contraparte e exatamente o numero que o F3 manda
  mostrar no lugar do numero economico. Nenhuma receita, margem, meta ou saldo
  foi desenhada.
- **F4**: `bruto` e soma de valor absoluto. Zero netting, zero saldo, zero
  "quanto fulano me deve". A palavra na tela e `movimentado`, e a nota explica.
- **C2**: nenhuma lista de contraparte chumbada no JS. Tudo vem da RPC a cada
  chamada.
- **C3**: nenhuma frase de recusa nova. A secao 4 do CONTRATO nao mudou.
- **C5**: zero token de cor novo. O azul so por `[aria-pressed="true"]`.
- **Tela que omite recorte mente**: 200 de 364 dito com numero, e o balde de nome
  nulo renderizado em vez de omitido.
- **Campo vazio tem que aparecer**: o rotulo da contraparte fica visivel na linha
  mesmo sem nome, e o painel tem estado vazio proprio.
