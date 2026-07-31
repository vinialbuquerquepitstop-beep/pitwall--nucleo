# Handoff Migracao Pit Wall (Nucleo) v45

Substitui a v44. Data: 31/07/2026.

---

## 1. Headline: a barra de abas do celular cobria o conteudo, e ninguem media isso

Pedido do dono: *"organizar e melhorar o layout na versao mobile, esta
desorganizada e com letras em cima de letras"*.

A queixa era literal e tinha numero. Rodando o `app.js` REAL em Chrome headless
num viewport de 390px: **37 sobreposicoes, todas com a mesma causa**, a barra
inferior de abas pintando por cima do texto do card.

A raiz nao era CSS mal escrito, era **mapa incompleto**. A decisao 7 da v29
desenhou uma barra de 5 lugares e mapeou cada aba por id (`#abaHoje{grid-area:3/1}`
...). Depois entraram **Vendas** (v40+) e **Notas fiscais**, e ninguem as
acrescentou ao mapa. O grid entao auto-posicionava as duas numa linha extra:

| estado | antes | depois |
|---|---|---|
| barra fechada | **109px** (2 linhas, "Vendas" flutuando sozinho) | **63px** (1 linha) |
| respiro do `.conteudo` | 76px fixos | 79px, derivado de `--nav-alt` |
| gaveta "Mais" aberta | 230px (4 linhas) | 179px (3 linhas) |

Barra de 109px contra respiro de 76px = **33px de card permanentemente embaixo da
barra fixa**. Com o "Mais" aberto piorava, porque `#abaClientes` ainda carregava
`grid-area:1/1/2/6` (largura inteira), sobra da epoca de 8 abas.

---

## 2. Decisoes

1. **Barra de 6 lugares, ninguem sai** (escolha do dono, 31/07/2026): Hoje ·
   Fila · Todos · Vendas · Conteudo · Mais. Medido antes de propor: 63px por
   botao a 390px e 58px a 360px, os dois acima do alvo de toque de 44px, e o
   rotulo mais largo (`Conteudo`, 49px de min-content) cabe. A decisao 7 da v29
   rejeitou 8 abas por darem ~45px; 6 nao cai nessa faixa. Recusadas as duas
   alternativas que tiravam algo da barra (Todos ou Vendas para a gaveta).
2. **Tirar a armadilha da classe, nao so o sintoma.** A BARRA e a linha 3 e e a
   unica coisa curada por id. A GAVETA sao as linhas 1 e 2, **sem placement
   nenhum**: toda `.aba-rara` auto-posiciona ali. Aba nova nunca mais cai fora
   do mapa, basta marcar `.aba-rara`. Se isso ja fosse assim, Vendas e Notas
   fiscais nao teriam quebrado nada.
3. **O respiro deixa de ser numero magico.** `--nav-item-h` e `--nav-alt` fazem a
   altura da barra e o respiro do `.conteudo` sairem da MESMA fonte. Enquanto
   eram dois numeros soltos, um cresceu e o outro nao.
4. **Os dois tokens moram no `.app` dentro da media query, nao no `:root`.** Sao
   medida de layout de celular, nao paleta global. Primeira versao os colocou no
   `:root` e o `validar.py` (secao 13) REPROVOU, com razao. Guard-rail nao se
   cala repontando baseline: mudou-se o codigo.
5. **Rotulo travado em uma linha na barra, livre na gaveta.** Rotulo que quebra e
   o que muda a altura da barra por baixo do pano, entao na barra ele e
   `nowrap` + reticencia. Na gaveta, que e transitoria e nao entra no respiro,
   ele pode ocupar duas linhas: a 360px `Notas fiscais` virava `Notas fisc…`, e
   rotulo pela metade nao serve de navegacao.
6. **`Calculadora` sozinha na segunda linha da gaveta fica.** 7 raras em 6
   colunas deixam uma orfa, e ela cai exatamente na fronteira do grupo
   `Ferramentas` da barra lateral do desktop. Le como grupo, nao como sobra.

---

## 3. A sobreposicao de verdade fora da barra (so aparece a 360px)

Na Fila embutida no Hoje, `.fila-ident` tinha `flex:1`, ou seja **base ZERO**. A
linha nunca quebrava: ela espremia o bloco do nome abaixo do proprio conteudo e o
`Quente` saia pintando POR CIMA de `Lead — Consulta`. Medido: **265px de
sobreposicao, 49% do menor elemento**. Letra sobre letra, exatamente a queixa.

Corrigido com base real (`flex:1 1 170px`) mais `overflow:hidden` como fecho do
caso limite, e `.fila-cad` com reticencia. No desktop nada muda: o `flex-grow`
continua enchendo a linha (conferido em screenshot a 1280px).

---

## 4. Ferramenta nova: `ferramentas/diag_mobile.py`

Reusa o stub do `harness.py` (Supabase falso com linha real do banco) e MEDE
geometria em vez de assertar comportamento. Tres medidas:

1. sobreposicao par a par entre elementos com texto;
2. estouro horizontal (elemento a elemento e `scrollWidth` do documento);
3. altura real da barra contra o respiro do `.conteudo`.

```
python ferramentas/diag_mobile.py 360
python ferramentas/diag_mobile.py 390
python ferramentas/diag_mobile.py 414
```

Ela **REPROVA** (exit 1) se a barra fechada voltar a ficar mais alta que o
respiro. Quem adicionar a proxima aba quebra um teste, nao a tela do dono.

### 4.1 Duas armadilhas que a ferramenta pagou (valem para qualquer medicao futura)

1. **`--window-size=390,844` NAO da um viewport de 390px.** O headless do Chrome
   no Windows tem piso de ~500px de largura de janela. A pagina renderiza a 500,
   a media query de celular mede errado, e o primeiro diagnostico acusou **110px
   de estouro horizontal que nao existia**. A ferramenta agora roda o app dentro
   de um IFRAME com a largura pedida e **ABORTA (exit 2)** se `innerWidth`
   divergir do pedido. Nunca confiar em `--window-size` como viewport.
2. **Barra fixa cruzando conteudo rolado NAO e defeito.** A primeira versao
   contava 37 sobreposicoes depois do conserto tambem: era o conteudo passando
   por tras da barra durante a rolagem, que e o comportamento certo de qualquer
   barra inferior. Camada flutuante (qualquer ancestral `position:fixed`) agora
   fica fora do teste par a par; o que vale nela e so a medida de altura x
   respiro. Sem esse corte a ferramenta grita para sempre e vira ruido.

---

## 5. Provas

| prova | resultado |
|---|---|
| `python ferramentas/diag_mobile.py 360 / 390 / 414` | **0 sobreposicoes, 0 estouros, barra em 1 linha nas tres** |
| `python ferramentas/harness.py` | 157 passou / 4 falhou, **identico ao HEAD anterior** |
| `python ferramentas/validar.py` | **as mesmas 5 reprovacoes do HEAD, zero nova** |
| `python ferramentas/prova_trilho.py` | EXIT 0 |
| `node ferramentas/prova_cliente.js` | EXIT 0 |
| `node ferramentas/prova_nf.js` | EXIT 0 |
| `node ferramentas/prova_metricas.js` | EXIT 0 |
| `node ferramentas/prova_regua.js` | EXIT 0 |
| `node ferramentas/prova_sessao.js` | EXIT 0 |
| `node ferramentas/prova_venda_editar.js` | EXIT 0 |
| `node --check public/app.js` | EXIT 0 |
| desktop a 1280px | screenshot conferido, barra lateral e Fila intactas |

**O metodo importa mais que o numero:** as suites foram rodadas TAMBEM contra o
`app.css` do HEAD (`git checkout -- public/app.css`, roda, restaura) para separar
falha herdada de regressao propria. Sem essa comparacao, as 5 reprovacoes do
`validar.py` teriam sido lidas como estrago desta sessao. Repetir esse
procedimento sempre que um guard-rail ja estiver vermelho ao chegar.

Nenhuma mudanca de banco. Nenhum token de cor novo. Nenhum uso novo do azul.

---

## 6. Correcao de fato ao ambiente (a v44 errou)

**Python ESTA instalado nesta maquina: 3.14.5** (`python --version`). A v44
afirmou que a suite Python "segue sem rodar nesta maquina por falta de Python" e
por isso commitou sem rodar `validar.py`, `harness.py` e `prova_trilho.py`. As
tres rodam. Conferir antes de repetir a afirmacao.

---

## 7. Pendencias

1. **`validar.py` esta VERMELHO no HEAD, com 5 reprovacoes herdadas, e o dono
   decidiu conscientemente deixar como pendencia** (31/07/2026). Elas NAO sao
   desta sessao, e nenhuma foi introduzida aqui:
   - `classe emitida pelo JS sem estilo no CSS: ['cliente','nf-topo','respondeu','venda-cli-btn']`
   - `o botao que abre o historico sumiu ou duplicou`
   - `o pitboard de lead apareceria em Captacao/Hoje/Conteudo/Rotina`
   - `esperava 6 abas raras, achei 7` (a 7a e `abaNfs`, legitima; o numero
     esperado no `validar.py` e que ficou para tras)
   - `uso NOVO de var(--accent) fora da lista aprovada` (9 seletores)

   Cada uma e ou drift acumulado desde que a baseline `.antes` foi apontada, ou
   uma assercao que envelheceu. Enquanto ficarem assim, `validar.py` nao serve de
   porta: quem rodar vai ver vermelho e aprender a ignorar, que e como um
   guard-rail morre. **Antes de consertar, decidir item a item: e o codigo que
   esta errado ou a assercao?** Repontar a baseline em bloco seria calar o
   guard-rail, nao conserta-lo.
2. A duplicata **VENDA-0003 continua viva no banco** (pendencia 1 da v44,
   intacta): faturamento inflado em R$ 8.400 e LTV do Victor em 2 vendas. A
   ferramenta existe e esta provada; o ato e do dono.
3. Tudo o que a v43 e a v44 deixaram aberto segue aberto: Fila ordenada por
   `proximo_contato` em vez de `bola_com`; speed-to-lead sem tile no Dashboard;
   `permite_esfriar` inalcancavel em 4 dos 6 perfis; `etapa_cadencia`
   decorativa.
4. Fora de escopo nomeado: o diagnostico so cobre 360/390/414px em retrato.
   Paisagem, tablet (entre 560 e 860px) e `prefers-reduced-motion` nao foram
   medidos nesta sessao.

---

## 8. Como conferir (caminho exato)

```
python ferramentas/diag_mobile.py 390      # espera: 0 sobreposicoes, exit 0
python ferramentas/harness.py              # espera: 157 passou / 4 falhou
```

No celular: abrir o app, rolar a Fila do dia ate o fim. O ultimo card tem que
terminar ACIMA da barra, com respiro. Tocar em **Mais**: a gaveta abre com 6
atalhos em uma linha e a Calculadora na seguinte, todos com o rotulo inteiro.
