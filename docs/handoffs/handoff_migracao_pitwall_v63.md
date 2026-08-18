# Handoff v63 — 18/08/2026

Substitui todos os anteriores. Sessao curta e de FRONTEND puro: nenhuma migration,
nenhuma RPC nova, nenhuma chamada de rede nova. Duas ordens do dono, que sao a
mesma ordem, e um commit que finalmente pos no ar uma decisao que estava so na
working tree.

---

## 0. Para quem chega agora, em cinco linhas

1. Commit `4d010bb`, empurrado para `origin/main`. Cloudflare publica sozinha.
2. Os cards **faturamento** e **lucro** da aba Vendas ganharam **detalhar**: a
   soma abre venda a venda, com resoma na tela e as pre-vendas em bloco proprio.
3. A regra "**so venda concluida entra na soma**" chegou ao app publicado. Ela
   estava no banco desde 17/08 e na working tree desde 17/08, mas **nunca tinha
   sido commitada**: a aba Vendas no ar somava pre-venda enquanto a aba Metricas,
   servida pelo `painel_metricas`, ja nao somava.
4. Suite: **664 assercoes, 0 falhas**, EXIT 0 nos seis comandos e nas cinco
   larguras. Tres assercoes estavam VERMELHAS antes desta sessao.
5. Nada de banco mudou. `painel_metricas` ja filtrava
   `coalesce(v.status,'') = 'concluida'` (migration `painel_metricas_so_concluida`,
   de 17/08). Conferido nesta sessao por `pg_get_functiondef`.

---

## 1. O que o dono pediu, na ordem em que pediu

> "os valores devem ser contabilizados em faturamento e lucro, apenas quando as
> vendas se concluirem."

> "e lucro, faturamento, devem conter a opcao de detalhar os valores"

Sao o mesmo pedido. Numero somado por um criterio que a tela nao mostra e numero
em que so se acredita. O primeiro define o criterio; o segundo torna o criterio
verificavel sem sair da aba.

Decisoes dele nesta sessao, feitas com as opcoes na mao:

| Pergunta | Escolha |
|---|---|
| O que "detalhar" abre | **A lista das vendas que somam** (nao a decomposicao contabil custo/frete/taxas, que ja vive no card de vazamento) |
| Pre-venda entra no detalhe | **Sim, em bloco separado**, declarada como fora da soma |
| Subir agora | **Commit + push** |

---

## 2. O que entrou no app (`public/app.js`, `public/app.css`)

**Estado.** `var vgDet=""` — `""`, `"fat"` ou `"luc"`. UM card aberto por vez.

**Funcoes novas** (todas no bloco do painel de Vendas, logo depois de `vgValores`):

| Funcao | Papel |
|---|---|
| `vgDetSeparar(linhas,lim)` | mesma porta do `vgAgregar`: descarta cancelada, aplica a janela, e separa por **`vgConta`**. Devolve `{ok, pre}`, mais nova primeiro |
| `vgDetQuem(v)` | modelo + capacidade, com fallback para `modelo_texto` |
| `vgDetLin(v,modo,tot)` | uma linha por venda. Modos `fat`, `luc` e `pre` |
| `vgDetBtn(k,a)` | o "detalhar" do card. **So existe se `a.n` ou `a.pre`** |
| `vgDetBloco(linhas,lim,a)` | o bloco inteiro, com cabecalho, resoma, bloco de fora e nota |

**Onde o bloco mora.** DENTRO de `.vg-valores`, com `grid-column:1 / -1`, colado
nos cards. Nao depois dos graficos: no celular a resposta tem que nascer onde a
pergunta foi feita. Isso tambem evitou mexer no `grid-row` dos dois graficos, que
levaria um vao de 18px vazio quando o bloco estivesse fechado.

**O que cada modo mostra na cifra da direita:**

- `fat`: valor da venda, com o peso dela no faturamento (`54,3% do faturamento`).
- `luc`: lucro da venda, com `margem X% · venda R$ Y`. Lucro negativo leva
  `.neg` e a cor `--erro-fg`.
- `pre`: valor previsto, e a propria linha diz `pre-venda, fora da soma`.

**A resoma e o ponto da tela.** A ultima linha do bloco imprime `soma das linhas`
com o total. Se ela divergir do card, o defeito aparece sem ninguem somar na mao.
E o unico numero do bloco com peso de titulo.

**Zero rede.** Sai de `vendasData`, que a aba ja carregou (regra do v51, secao 4).
Provado: abrir o detalhe nao move `window.__fromChamadas`.

**Sem cor nova.** O bloco e leitura, nao estado. Quem pinta e o sinal que ja
existe: `--erro-fg` no negativo, `--morno-fg` no que ficou fora da soma (mesma
familia de "trabalho pendente" do frete e do CPF que falta). Azul nao entra: seria
o quinto uso da marca e a regra 11.1 do `validar.py` reprova.

**Toque.** `data-acao="vg-detalhe"`, tratado ao lado do `vg-janela` em
`vendaAcao`. Alternar, nao acumular: tocar no card ja aberto fecha, e o botao
Fechar manda `data-id` vazio.

---

## 3. A divida que estava na working tree, e agora esta no ar

Ao abrir a sessao, `git status` trazia `public/app.js`, `public/app.css`,
`public/index.html` e `ferramentas/harness.py` modificados **e nao commitados**.
O v62 ja registrava dois deles como "nao sao meus, ja estavam assim". Era trabalho
de 17/08 que nunca foi empurrado:

1. **pre-venda fora de toda soma de dinheiro** (`vgConta`, os quatro pontos de
   soma da tela chamando UMA funcao, e o cabecalho passando a declarar o que
   ficou de fora, com valor).
2. **Painel de Motoboys com porta propria** no topo da aba Vendas, pelo relato do
   dono de que "a adicao de motoboy na lista esta perdida, aparece apenas quando
   clico em relatorio".

Consequencia medida: o `origin/main` servido pela Cloudflare ainda tinha
`pre_venda CONTA` no `app.js`, enquanto o `painel_metricas` do banco ja filtrava
`concluida`. **A mesma palavra dava dois numeros em duas abas.** Isso durou de
17/08 ate este commit.

Licao para o arranque: `git status` sujo no inicio da sessao nao e ruido, e
trabalho pronto que nao chegou ao ar. Conferir contra o `origin` antes de afirmar
o que o app tem.

---

## 4. As tres assercoes vermelhas que vieram junto

Rodando o harness ANTES de tocar em qualquer coisa: **638 passou, 3 falhou**. As
tres eram herdadas da mudanca de 17/08 e descreviam a aritmetica antiga. Nao
foram silenciadas nem tiveram baseline repontada: foram reescritas para o criterio
novo, com o numero novo medido.

| Assercao | Era | Virou | Por que |
|---|---|---|---|
| faixa negativa de agosto | `7%` (200/3000) | `50%` (500/1000) | agosto e a v5 sozinha desde que a pre-venda de 2.000 saiu |
| grupos do recorte por fornecedor | `3` | `2` | o recorte chama o mesmo `vgConta`: o grupo que so existia pela pre-venda sumiu |
| maior grupo do fornecedor | `R$ 5.200,00` | `R$ 4.200,00`, 2 vendas | v1 (3.200) + v5 (1.000). A v4 (2.000) e pre-venda |

Entrou junto uma assercao NEGATIVA que trava o caminho de volta: se a pre-venda
voltar a somar, o grupo pula para 5.200 e a suite reprova.

---

## 5. A prova (EXIT CODE, nunca o texto da saida)

```
node --check public/app.js                      -> 0
python ferramentas/validar.py                   -> 0
python ferramentas/harness.py                   -> 0   664 passou, 0 falhou
python ferramentas/prova_trilho.py              -> 0
python ferramentas/prova_grafico.py             -> 0
python ferramentas/prova_atmosfera.py           -> 0
python ferramentas/diag_mobile.py 360           -> 0   com o bloco ABERTO
python ferramentas/diag_mobile.py 390           -> 0
python ferramentas/diag_mobile.py 414           -> 0
python ferramentas/diag_mobile.py 1280          -> 0
python ferramentas/diag_mobile.py 1440          -> 0
```

459 -> 664 assercoes: **+22 do detalhe** nesta sessao, o resto ja tinha vindo com
a mudanca de 17/08.

**O `diag_mobile.py` passou a abrir o bloco antes de medir** (`[data-acao=
vg-detalhe][data-id=fat]`) e **reprova se ele nao renderizar**. Bloco que nasce
fechado passaria verde sem nunca ter sido medido, que e o mesmo cinto ja escrito
ali para o "Detalhes" da venda. A 360px, com o bloco aberto: **0 sobreposicoes,
0 estouros, 0 documento mais largo que a tela**.

Foto conferida com o olho, nao so com a prova:
`python ferramentas/foto.py vendas 1280 2400 "[data-acao=vg-detalhe][data-id=fat]"`
(a foto vai para `docs/design/foto_*.png`, que e gitignored).
**Armadilha:** `foto.py` numa largura de celular NAO da um viewport de celular
(o headless do Chrome no Windows tem piso de ~500px). Para celular, quem mede e o
`diag_mobile.py`, que roda a pagina dentro de um iframe.

---

## 6. O que este commit NAO faz

- **Nao toca no banco.** Nenhuma migration, nenhuma RPC. `painel_metricas` ja
  estava certo desde 17/08.
- **Nao muda a aba Metricas nem o Dashboard.** O detalhe existe so no painel da
  aba Vendas, que e onde os dois cards vivem.
- **Nao lista venda arquivada nem cancelada**, e diz isso na tela, no rodape do
  proprio bloco.
- **Nao exporta.** Se a proxima pergunta for "quero isso em CSV", e obra nova.

---

## 7. Aberto, na ordem em que dói

1. **`public/calc/consultor/dados.js` continua publico** (herdado do v62, sem
   andamento nesta sessao). A saida desenhada e a opcao B, RPC com projecao por
   papel. Bloqueio: decidir se o painel mostra CUSTO para vendedor. O dono ja
   decidiu que **vendedor nunca ve custo** (commit `693050e`), entao a decisao
   pendente virou so o desenho da projecao.
2. **Escrita de volta no Notion** (kanban da aba Conteudo), bloqueada pela
   capability "Update content" da integracao, que e ato do dono no
   notion.so/profile/integrations.
3. O detalhe hoje ordena por **data, mais nova primeiro**. Se o uso mostrar que a
   pergunta real e "qual venda puxou o mes", ordenar por valor vira uma linha.

---

## 8. Onde cada coisa ficou

| O que | Onde |
|---|---|
| estado `vgDet`, `vgDetSeparar`, `vgDetLin`, `vgDetBtn`, `vgDetBloco` | `public/app.js`, bloco do painel de Vendas |
| acao `vg-detalhe` | `public/app.js`, em `vendaAcao`, ao lado de `vg-janela` |
| `.vg-det*` | `public/app.css`, fim do arquivo |
| 22 assercoes do detalhe | `ferramentas/harness.py`, antes do bloco das arquivadas |
| abertura do bloco na medicao de celular | `ferramentas/diag_mobile.py`, no ramo `abaVendas` |
| commit | `4d010bb`, `origin/main` |
