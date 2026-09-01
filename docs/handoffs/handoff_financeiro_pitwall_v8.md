# Handoff Financeiro v8 — o painel desconta devolucao e a tela diz que descontou

Data: 31/08/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v7.md`
como topo da linha.

Entrega `P-R1` do bloco 1, retomada na ordem depois de o dono ter escolhido o desfazer
de repasse (v7) fora de sequencia.

**Entrega de frontend puro. Zero SQL, zero migration, zero mudanca de banco.**

---

## 1. A frase da entrega

**O painel desconta devolucao e a tela diz que descontou.**

Sujeito visivel: a linha de categoria ganha a nota
`2.131,02 gastos menos 131,02 devolvidos · 3 linhas`, e a linha de extrato que produz
esse abatimento ganha o selo `devolução`.

---

## 2. O que estava aberto

`fin_painel` devolve `bruto` e `abatido` por categoria desde a fatia 2.1
(`20260826201829_fin_fatia21_painel_abatimento`), e o `total` que ele entrega ja e
`bruto - abatido`. **O `app.js` nunca leu nenhum dos dois** (`grep abatido public/app.js`
= 0 antes desta entrega). Dois campos orfaos, que e o item 3 do portao de saida 6.2.

Efeito na base viva: **Transporte caiu de 624,95 para 493,93 e a tela nao dizia por que.**
Numero visivel que muda de valor sem a explicacao na tela e literalmente o portao 6.3 do
CONTRATO. Esta entrega existe para fechar esse portao, nao para enfeitar a Visao.

Segundo buraco, o outro lado do mesmo: a linha positiva dentro de uma categoria de gasto
lia como "entrou dinheiro" no meio de uma lista de despesa. Quem fosse conferir a nota da
categoria nao achava a linha que a explica.

---

## 3. O que mudou

### 3.1 `public/app.js`

- **`finN2(x)`**: o formato de `brlV` SEM o `R$`. A nota vive debaixo de um valor que ja
  carrega a moeda, e repetir `R$` tres vezes na mesma linha e ruido.
- **`finCatNota(x, ent)`**: so desenha quando `abatido > 0`. Separador em ponto do meio
  (U+00B7), plural respeitando a contagem (`1 linha` / `3 linhas`).
- **`finCatLin(x, ent)`, `finSecao(sc, ent)`, `finBloco(..., ent)`**: `ent` desce do bloco
  ate a categoria. Os `map(finCatLin)` viraram wrapper explicito de proposito: `Array.map`
  passa `(valor, indice, array)`, e sem o wrapper `ent` receberia o INDICE, o que faria a
  primeira categoria de cada secao ser a unica a falar de gasto. Bug silencioso, de tela.
- **`finNatDe(cod)` / `finEhDevolucao(x)`**: a natureza vem do `fin_config`, **nunca do
  sinal do valor**. Positivo em categoria de ENTRADA e receita normal, nao devolucao.
- **`finMovLin`**: o selo `devolução` entra no rodape da linha, ao lado do selo
  `em par de repasse`.

**Uma decisao de desenho, tomada por mim e declarada aqui:** o `P-R1` especificou UMA
frase (`X gastos menos Y devolvidos`), e `finCatLin` serve os DOIS blocos. No bloco
`De onde o dinheiro veio` o `abatido` e estorno de receita, e a frase de gasto ali seria
a tela mentindo com numero certo. A conta e identica nos dois lados; **so a palavra
espelha**: `2.015,40 recebidos menos 15,40 estornados · 1 linha`.

### 3.2 `public/app.css`

**Zero token de cor novo.**

- `.fin-cat-nota`: `flex:1 0 100%` (a `.fin-cat` ja e `flex-wrap:wrap`), `--dim`, mono,
  10.5px. E explicacao do numero acima, nao um segundo numero disputando com ele. `--dim`
  e nao `--morno`: nota que cobra faria a Visao parecer ter pendencia onde nao ha nenhuma.
- `.fin-lin-dev`: entrou como seletor a mais na regra que ja existia para `.fin-lin-par`.
  Regra nova nenhuma. Os dois selos sao informacao sobre a linha, nao alerta.

---

## 4. O que foi PROVADO

### 4.1 Na suite

**943 -> 955 assercoes, 0 falhas.** As 12 novas cobrem:

- categoria com devolucao explica o abatimento na propria linha, com a string exata;
- **a conta da nota fecha com o valor exibido logo acima** (2.131,02 - 131,02 = 2.000,00).
  Nota que nao fechasse seria uma segunda mentira em cima da primeira;
- o separador e o ponto do meio U+00B7, nao um hifen;
- categoria com `abatido` zero NAO ganha nota (nota em toda linha vira ruido e ensina o
  dono a ignorar a nota, que e o oposto do que ela existe para fazer);
- categoria em que o servidor **nem mandou o campo** nao quebra;
- no bloco de entradas a palavra espelha, e o singular respeita a contagem;
- a nota le em `--dim`, medido em cor computada;
- **valor positivo em categoria de ENTRADA nao ganha selo**;
- **a MESMA linha, mesmo valor, em categoria de GASTO ganha o selo** (e a unica forma de
  provar que o selo le o `fin_config` e nao o sinal do valor);
- todo selo esta em linha de valor positivo, nunca num gasto;
- nenhuma linha de categoria de entrada carrega o selo;
- o selo le em `--dim`.

### 4.2 Fixture

O fixture do `fin_painel` no harness passou a trazer `bruto`/`abatido` **respeitando a
identidade do servidor** (`total = bruto - abatido`): fixture que nao fechasse provaria
uma aritmetica que o banco nao produz. Quatro casos, um por erro possivel: `abatido` zero,
`abatido` com plural, **campo ausente**, e o espelho de entrada no singular.

Tentei antes acrescentar uma linha `f14` ao `FIN_MOVS` e **desfiz**: o denominador da
trava de padrao amplo demais e o tamanho de `FIN_MOVS`, e a linha nova movia `4 de 15`
para `4 de 16`, quebrando um teste de limiar que nada tem a ver com esta entrega. O selo
se prova trocando a NATUREZA da categoria da mesma linha (`f10`, +15,40), que e prova mais
forte e colateral zero.

### 4.3 Comandos

| comando | EXIT |
|---|---|
| `git status --porcelain` (antes de comecar) | limpo |
| `python ferramentas/validar.py` | 0 |
| `python ferramentas/harness.py` | 0 (955/955) |
| `python ferramentas/prova_trilho.py` | 0 |
| `python ferramentas/prova_grafico.py` | 0 |
| `python ferramentas/prova_atmosfera.py` | 0 |
| `node --check public/app.js` | 0 |
| `diag_mobile.py` 360 / 390 / 414 / 1280 / 1440 | 0 / 0 / 0 / 0 / 0 |

O `diag_mobile` importava aqui: a nota e um item de flex que ocupa a linha inteira, e
360px e onde ela poderia estourar. Nao estoura.

### 4.4 Git contra banco

Inalterado, porque nada foi ao banco: **21 `fin_` no git, 21 `fin_` aplicadas.**

---

## 5. Portao de saida

| # | Item | Resposta |
|---|---|---|
| 1 | SQL rodado no banco de verdade | **NAO SE APLICA.** Entrega de frontend puro, zero DDL |
| 2 | RLS testada como dono E como vendedor | **NAO SE APLICA** nesta entrega. Segue pendente desde a v4 para as RPCs de repasse |
| 3 | a tela le todo campo novo, zero campo orfao | **SIM.** E o proprio objeto da entrega: `bruto` e `abatido` deixaram de ser orfaos |
| 4 | assercao nova com prefixo de fatia | **SIM.** 12 `fin3:` |
| 5 | EXIT 0 nos comandos e nas 5 larguras | **SIM** |
| 6 | commit unico | **SIM** |
| 7 | handoff atualizado | **SIM.** Este arquivo |
| 8 | nenhuma recusa nova fora da secao 4 | **SIM.** Nenhuma recusa nova foi criada |

### 5.1 Portao de confianca

**Nenhum numero mudou de valor nesta entrega.** Ela nao altera calculo nenhum: o servidor
ja subtraia e o `total` ja era `bruto - abatido`. O que entra e **a explicacao que
faltava** para uma mudanca que ja tinha acontecido na fatia 2.1 sem nota nenhuma. E o
portao 6.3 sendo pago com atraso, e o atraso fica registrado aqui.

---

## 6. Ressalvas

1. **A nota mede o que o servidor manda, e o servidor conta `n` como TODAS as linhas da
   categoria**, gastos e devolucoes juntos. Na frase `624,95 gastos menos 131,02
   devolvidos · 27 linhas`, as 27 sao 22 gastos + 5 reembolsos, nao 27 gastos. E o numero
   correto para "quantas linhas produziram este valor", mas alguem pode ler como "27
   gastos". Nao mudei: quebrar `n` em dois exigiria campo novo no `fin_painel`, e o `P-R1`
   declara `fin_painel` fora de escopo.
2. **O selo depende de `FIN_CFG` ja estar carregado.** Esta sempre, porque a aba carrega
   `fin_config` antes de renderizar, mas se um dia a ordem mudar o selo some em silencio
   em vez de errar.
3. O selo cobre positivo-em-categoria-de-gasto. **O espelho (negativo em categoria de
   entrada, o estorno de receita) nao ganhou selo**, porque o `P-R1` pediu um so. A nota
   do bloco de entradas ja declara o valor, entao o numero nao fica mudo, mas a LINHA que
   o produz nao se identifica na lista. Fica nomeado aqui.

---

## 7. Pendencias

- **`P-R2`** e o proximo do bloco 1: a faixa mostra entradas e saidas separadas, nao a
  soma com sinal. Contexto ja medido no `PROMPTS.md`: 131 linhas sem dominio somam
  R$ 39.664,38 de entrada e R$ -38.277,63 de saida, e a faixa exibe R$ 1.386,75,
  subestimando o trabalho pendente em 56 vezes.
- Depois de `P-R2`, **`P-AUDITA` fecha o bloco 1, em SESSAO SEPARADA**.
- RLS das RPCs de repasse como vendedor: pendente desde a v4.
- Tarefa do dono, sem prompt, antes do bloco 2: baixar os OFX dos ultimos seis meses e
  importar um por vez. O dedupe por `hash_dedupe` e `fitid` torna periodo sobreposto
  seguro (D-d).

---

## 8. Invariantes reforcados

- **Portao 6.3**: numero que muda pede a explicacao na MESMA entrega. Esta entrega e a
  divida do 6.3 sendo paga, com o atraso declarado.
- **Item 3 do portao 6.2**: campo que o servidor devolve e a tela ignora e campo orfao, e
  campo orfao e trabalho de banco que nao virou entrega.
- **C2**: nenhum numero de config chumbado no JS. A natureza da categoria vem do
  `fin_config`, nunca do sinal do valor.
- **Zero token de cor novo**: `--dim` para as duas coisas, porque as duas sao informacao.
  `--morno` cobra trabalho, e aqui nao ha trabalho a cobrar.
- **Tela que omite recorte mente**: a nota declara bruto, abatido e contagem, os tres.

---

## 9. Primeiro movimento do proximo chat

`P-ABRE`. Depois `P-R2`, que fecha a faixa do invariante 18 e e o ultimo prompt de
construcao do bloco 1.
