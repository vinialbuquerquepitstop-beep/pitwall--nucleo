# Handoff Migracao Pit Wall (Nucleo) v52

Substitui a v51. Data: 12/08/2026.

---

## 1. Headline: a aba Vendas ganhou o dinheiro somado no topo

Pedido do dono: *"adicione em vendas um grafico de venda, com as informacoes
pertinentes da operacao."*

A aba era so lista de cards. Para saber quanto a operacao faturou, o dono somava
de cabeca. Agora ha um painel: **graficos estreitos a esquerda, valores a
direita**, com janela declarada (`Mes` / `Trimestre` / `Tudo`).

**Zero banco.** Nenhuma RPC, nenhuma migration, o `base` nao entrou na obra. O
painel agrega as linhas que `carregarVendas()` ja traz da `v_venda`, que e
exatamente a regra fixada na secao 4 do v51: *o que a tela ja sabe, a tela
resolve; o que so o servidor sabe, re-render silencioso*. Trocar a janela custa
**zero chamada de rede**.

Commits `dbb0141` (chore), `e37f04b` (painel + provas), e este documento.

---

## 2. O numero que definiu o desenho

A base tem **4 vendas, e uma e duplicata** (VENDA-0003, pendencia aberta desde o
v47). Real: 3 vendas, 2 meses, R$ 13.950 de faturamento, R$ 670 de lucro.
**Margem de 4,8%**, com R$ 90 de frete comendo ~26% do lucro de cada venda.

Serie temporal sobre 3 pontos e decoracao. Por isso o que se construiu foi um
**painel de operacao** (numero grande + barra curta) que ja nasce certo e vira
grafico sozinho quando o volume chegar, e nao um dashboard de series.

---

## 3. As tres passadas, e o que cada uma corrigiu

### 3.1 Primeira: o painel existe

Placar de 4 celulas + barras por mes + barra de vazamento, empilhados na
vertical. Criterio de faturamento espelhando `painel_metricas` para nao nascer um
SEGUNDO criterio no sistema: arquivada fora (a view ja filtra), cancelada fora,
**pre-venda dentro e declarada** no cabecalho.

Corrigiu, de quebra, um defeito herdado: `venda-arq-alternar` refazia as 3
leituras de rede e apagava a lista a cada toque, o mesmo que o v51 tirou do resto
do app.

### 3.2 Segunda: duas colunas, e a hierarquia certa

Pedido: *"graficos a esquerda e valores a direita. mais evidencia as informacoes
de vazamento de lucro, margem e etc."*

O problema real nao era diagramacao, era **hierarquia**: margem e vazamento
viviam no **pe** de uma celula, a menor tipografia do bloco, enquanto o
faturamento (o numero menos acionavel) tinha o maior corpo. Margem virou numero
proprio; vazamento ganhou bloco com borda forte e a decomposicao frete/taxas
visivel.

Decisao registrada: o destaque do vazamento e **estrutural, nao cromatico**. No
resto do app `--morno` significa trabalho pendente e o alerta significa "isso
esta errado agora"; vazamento existe em toda venda, entao tingir para sempre e
gritar sem novidade.

### 3.3 Terceira: o grafico construido pela cartilha

Pedido: *"graficos devem ser estreitos, use skill de frontend pra compreender
como construir. esta desproporcional."*

Eu tinha lido o recado anterior (*"nao desconsidere a importancia do grafico"*)
como **maior**, quando ele queria **significar**. Medido a 1280px: coluna de
graficos com 587px e 2 meses, ou seja **barras de ~289px de largura**.

A skill `dataviz` (carregada tarde) indictou quatro coisas objetivas:

| regra | o que estava no ar |
|---|---|
| barra **<= 24px**, nunca preenche o slot, a sobra e ar | ~289px |
| **nunca um numero em cada ponto** | valor + mes + margem + n vendas por coluna |
| separar marcas com **vao de 2px na cor da superficie**, nunca borda | `border` de 1.5px, e ainda em `--bg` quando o fundo real e `--surface` |
| `tabular-nums` **so em coluna de numeros** | estava no `.vg-num` de 25px |

---

## 4. A metrica errada (o achado que vale mais que a obra)

**Por duas passadas eu argumentei com RAZAO DE CONTRASTE (WCAG) para decidir se
duas fatias vizinhas se distinguem. E a metrica errada.**

Contraste WCAG responde *"da para ler texto sobre isso?"*. A pergunta de um
grafico e *"estas duas cores sao a mesma?"*, e essa se responde com **ΔE em
OKLab**. Quando finalmente rodei o validador da skill:

```
node scripts/validate_palette.js "#CBCED5,#C48808,#E0C58D,#0F7A52" --mode light
  [PASS] CVD separation      pior par ΔE 16.9 (deutan)
  [PASS] Normal-vision floor pior par ΔE 17.5
  [FAIL] Lightness band      #CBCED5 e #E0C58D fora da banda
  [FAIL] Chroma floor        os dois abaixo do piso, leem como cinza
```

**A separacao para daltonismo PASSAVA o tempo todo.** Todo o discurso das duas
primeiras passadas ("matiz nao separa, quem carrega e o corte de 1.5px") estava
apoiado em medida errada. O que reprovava era outra coisa: as fatias eram `--dim`
e `--morno` **com opacidade**, e cor lavada sai da banda de luminosidade e le
como papel, nao como marca.

A licao esta gravada no cabecalho de `ferramentas/prova_grafico.py`, junto com o
comando para remedir.

---

## 5. O corte de 4 fatias para 3

Com custo / frete / taxas / lucro, o par possivel para frete e taxas era
`--morno` contra `--morno-fg` (sao a mesma natureza de despesa, entao tinham de
sair da mesma familia): **ΔE 13.0 na visao normal**, abaixo do piso de 15
("dificil distinguir mesmo com visao de cores completa"). A cartilha e explicita:
FAIL duro, **nao se resolve com codificacao secundaria** — ou re-escalona, ou
corta series.

Cortar foi o certo, e nao custou nada: **frete e taxas ja sao um numero so no
placar** (`vazamento = frete + taxas`), e a quebra continua em R$ dentro do
bloco. O grafico passou a ter exatamente as mesmas tres partes que o numero ao
lado: **custo · vazamento · lucro**.

Paleta final, medida em 12/08/2026:

```
node scripts/validate_palette.js "#5C6675,#C48808,#0F7A52" --mode light
  [PASS] Lightness band      os 3 dentro de L 0.43-0.77
  [PASS] CVD separation      pior par lucro x vazamento  ΔE 12.3 protan · 22.1 tritan
  [PASS] Normal-vision floor pior par lucro x vazamento  ΔE 22.9
  [FAIL] Chroma floor        #5C6675 le como cinza      -> ACEITO
  [WARN] Contrast vs surface #C48808 = 2.98             -> ACEITO
```

**Os dois pendentes ficam de proposito, e o motivo mora no codigo** para a
proxima sessao nao "consertar" e piorar:

- **croma do cinza**: o teste existe para uma cor de IDENTIDADE nao virar cinza
  sem querer. Aqui custo e neutro **de proposito**, pela regra da `.met-barra` do
  proprio projeto (quantidade nao e estado; barra colorida ja foi reprovada duas
  vezes). Ler como cinza e a intencao.
- **contraste 2.98 do `--morno`**: a cartilha diz que WARN obriga rotulo visivel
  ou table view, e nao e dispensavel. Cumprido pela legenda nomeada com
  quadradinho e pelo bloco de vazamento em R$. As duas condicoes de alivio sao
  **exigidas** por `prova_grafico.py`, senao o "aceito" viraria desculpa.

`lucro x prejuizo` mede 1.32 de luminancia (verde e vermelho no mesmo tom, o caso
classico de daltonismo vermelho-verde): a fatia negativa leva **hachura**, e a
prova reprova se ela sumir.

---

## 6. Dois bugs de layout que so a GEOMETRIA pegou

Os dois teriam passado por uma prova que le propriedade computada.

1. **`grid-row` faltando.** Com os valores primeiro no DOM (a ordem do celular) e
   so `grid-column` declarado, o auto-placement do Grid e **sparse**: ele nunca
   volta a uma coluna anterior na mesma linha, entao os graficos caiam para a
   linha de baixo. Medido a 1280px: `graficos top=463, valores top=117`. Ler
   `gridColumnStart` devolvia `1` e `2` e dizia que estava tudo certo.
2. **Media query nao acrescenta especificidade.** `.vg-graf` (0,1,0) perdia para
   `.vg-graf.g-vaza` (0,2,0) da regra de cima, e a 390px os dois graficos ficavam
   **lado a lado** num viewport de celular.

Por isso a prova de layout vive em `diag_mobile.py`, que monta o app num iframe da
largura pedida e **mede geometria real**: posicao, largura da barra, ordem
empilhada. Geometria ganha de propriedade computada.

---

## 7. O buraco de 200px que so a FOTO pegou

Nenhuma prova automatica olha para a tela. Rodando `python ferramentas/foto.py
vendas 1280` e **olhando**, apareceram dois defeitos que a suite verde nao via:

- um **buraco de ~200px** sob os graficos (coluna de valores com ~330px de
  altura, graficos com ~150px). Tubo subiu de 118px para 200px e fechou;
- o bloco de ticket medio quebrando **"TICKET MEDIO" e "R$ 2.800,00" em duas
  linhas cada** (`flex:1 1 100%` no pe, sem `nowrap`).

E a razao pela qual `foto.py` existe, escrita no proprio docstring dele: em
08/08/2026 o Claude passou horas grepando CSS e afirmando o que a tela "ganhou",
sem nunca ter olhado. **Passo 7 da cartilha: renderizar e olhar.**

**Armadilha nova:** `foto.py` **nao serve para celular**. Ele nao usa o truque de
iframe do `diag_mobile.py`, e o headless do Chrome no Windows tem piso de ~500px
de largura: pedir 390 devolve um render de 500 cortado em 390, e o retrato sai
decepado (a MARGEM some, o ticket aparece pela metade). Quem verifica celular
aqui e o `diag_mobile.py`, que **aborta** se `innerWidth` divergir.

---

## 8. Provas

Todas nesta maquina, **exit code conferido**, depois da ultima mudanca:

| prova | resultado |
|---|---|
| `python ferramentas/harness.py` | **352 passou / 0 falhou** — EXIT 0 |
| `python ferramentas/validar.py` | EXIT 0 |
| `python ferramentas/prova_trilho.py` | EXIT 0 |
| `python ferramentas/prova_grafico.py` | **nova.** EXIT 0 |
| `python ferramentas/diag_mobile.py` 360/390/414/1280/1440 | EXIT 0 nos cinco |
| `node --check public/app.js` | EXIT 0 |

**Prova nos dois sentidos**: rodadas contra o `app.js` do HEAD numa copia isolada,
as assercoes novas **reprovam 61 vezes** e a rodada **completa sem estourar**.

Isso ultimo custou duas correcoes, e a licao e a mesma da secao 6 do v51: a
primeira versao das assercoes **estourou num `null.click()`** e derrubou 115
assercoes que nunca chegaram a ser avaliadas; a segunda estourou num
`getComputedStyle(null)` e derrubou 147. **Falha tem que reprovar, nao derrubar a
rodada.** Todo leitor novo (`vgCel`, `vgSub`, `vgAlt`, `vgCor`, `vgCls`,
`vgAria`, `vgEstilo`) e tolerante a ausencia.

E **quatro assercoes eram vacuosas**: "nao leu rede" e verdade trivial num app
onde o botao nem existe para ser clicado. Todas passaram a exigir que o clique
tenha acontecido. Uma quinta estava **morta** — a das arquivadas nunca rodou em
rodada nenhuma, porque o fixture nao tinha venda arquivada e o botao nunca
existia. Assercao que nao roda parece cobertura e nao e.

---

## 9. Onde encostou

| arquivo | o que |
|---|---|
| `public/app.js` | bloco `vg*` novo (~200 linhas legiveis): janela, agregacao, valores, grafico empilhado, barra de vazamento, balao; `pintarVendas()` extraido de `renderVendas`; `vendaAcao` ganha `vg-janela` e `vg-mes`. **Linha 1 minificada intacta** (md5 igual ao HEAD) |
| `public/app.css` | ~235 linhas novas: grid de 3 colunas, coluna de 24px, fatias, legenda, blocos de valor, balao |
| `ferramentas/harness.py` | fixture com cancelada, pre-venda, prejuizo e arquivada + ~90 assercoes |
| `ferramentas/prova_grafico.py` | **novo.** Prova de cor do painel, com a licao da metrica errada no cabecalho |
| `ferramentas/diag_mobile.py` | medicao geometrica do painel, com reprovacao por largura de barra |
| `ferramentas/contraste.py` | guarda `__main__` |
| banco | **nao encostou** |

Diff: **+1025 / -29**. As fotos de `docs/design/foto_*.png` seguem no
`.gitignore` (carregam nome e telefone de cliente real, decisao do v50).

---

## 10. Pendencias

1. **VENDA-0003 duplicada continua no banco** (R$ 8.400 inflando o faturamento).
   Herdada do v47 e agora VISIVEL: o painel mostra R$ 24.750 onde o certo e
   R$ 16.350, e margem 5,9% em vez de 6,7%. O caminho e um clique do dono:
   **Vendas -> VENDA-0003 -> Editar -> Arquivar**.
2. **Achado novo:** `k()` chama `renderVendas` a cada tecla digitada na busca
   (`Y("inputBusca","input",k)`), o que custa **3 leituras de rede por tecla** na
   aba Vendas. Nao entrou nesta obra porque a correcao exige patch na linha 1
   minificada. Fatia propria, barata.
3. `foto.py` nao serve para celular (secao 7). Ensinar o truque de iframe do
   `diag_mobile.py` a ele e barato e evitaria uma leitura errada de tela.
4. Herdado e ainda aberto: `.gitattributes` com `* text=auto eol=lf`; relatorio
   de entrega sem `despachado_em`; texto do relatorio nao configuravel;
   `privado.fn_venda_atualizar` com EXECUTE para `authenticated` e SECURITY
   DEFINER; **Conteudo e Hoje continuam sem a forma nova** (agora atropelados
   pela quinta vez).
5. Escrita de volta no Notion segue bloqueada pela capability "Update content".

---

## 11. Armadilha de fim de linha, que quase entrou de novo

Os `.py` de `ferramentas/` sao **LF no indice**. A 2a passada os converteu para
CRLF sem querer, e `git diff` passou a acusar **3.425 linhas mudadas num arquivo
de 1.858** — reescrita completa, ilegivel para revisao. `git diff -w` mostrava a
mudanca real: +342/-10.

**O comando que responde de verdade e `git ls-files --eol`**, nao `grep` por
`\r`: numa das checagens o grep afirmou "CRLF em 100% das linhas" para arquivos
que estavam em LF limpo, e essa afirmacao errada chegou a ser reportada ao dono
antes de ser corrigida. `public/app.js` e `public/app.css` sao LF nos dois lados.
