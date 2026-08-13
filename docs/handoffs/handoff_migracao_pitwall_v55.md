# Handoff Migracao Pit Wall (Nucleo) v55

Substitui a v54. Data: 13/08/2026.

---

## 1. Headline: a Fatia B do Escopo estava CONSTRUIDA e NAO PROVADA

O pedido do dono nesta sessao foi "localize o ultimo processo em que estava". O
que estava na copia de trabalho, sem commit: o grafico vertical de abandono da
aba Escopo mais o seletor de urgencia (Fatia B), desenhado pela spec
`docs/superpowers/specs/2026-08-12-escopo-grafico-abandono-design.md`.

O codigo estava escrito nos quatro arquivos. **Nenhuma das 24 assercoes do
criterio de aceite tinha sido rodada.** Esta sessao nao construiu funcionalidade
nova: rodou o criterio inteiro e achou **duas coisas que estavam erradas**, uma
delas invisivel para toda a suite existente.

---

## 2. Correcao do meu proprio diagnostico: o roteador nao vive na linha 1

Ao localizar o processo eu afirmei que o patch do roteador nao tinha sido
aplicado, medindo com `head -1 public/app.js | grep esc-prio`. **Era leitura
errada do arquivo.**

O `app.js` tem **duas** regioes minificadas grandes, nao uma:

| linha | chars | o que e |
|---|---|---|
| 1 | 24.625 | o nucleo IIFE |
| **2058** | **22.729** | **o roteador `A()`**, onde vivem os `data-acao` |

A spec falava em "linha 1984 minificada", e 1984 era o numero certo **no HEAD**:
o bloco legivel cresceu 74 linhas com a Fatia B e empurrou o roteador para 2058.

O CLAUDE.md diz que so o `app.js` e minificado "numa linha so". **Nao e uma, sao
duas**, e a diferenca nao e trivia: quem procurar `data-acao` na linha 1 conclui
que o roteador nao conhece a acao e vai reaplicar um patch ja aplicado.

O proprio `patch_escopo_prioridade.js` estava certo o tempo todo e recusou rodar
de novo (`REPROVOU: o patch JA foi aplicado`, EXIT 1). A guarda de reaplicacao do
script pegou o meu erro antes que ele custasse alguma coisa.

---

## 3. Regressao de verdade: o botao de descartar caiu para fora da tela em 360px

`diag_mobile.py 360` reprovou: `ESTOURA button.link-acao [338..373] "×"`. Em uma
tela de 360, o botao de descartar acao terminava em 373: **13px fora**.

Nao aceitei "e herdado" como resposta. Montei um `git worktree` do HEAD limpo
(`c739099`) e rodei o mesmo diagnostico la:

| arvore | `diag_mobile.py 360` |
|---|---|
| HEAD `c739099` | 0 estouros, **EXIT 0** |
| copia de trabalho | 1 estouro, **EXIT 1** |

**Regressao da Fatia B, provada, nao deduzida.** A causa: `.esc-acao` e
`display:flex` **sem `flex-wrap`**, e a Fatia B inseriu `escPrio(a,pode)`
(`<select>` de `min-width:104px`) naquela mesma linha, entre o texto e o trio
chip + travar + `×`.

Correcao de uma propriedade, no padrao que a propria familia ja usava (`.esc-form`
tem `flex-wrap:wrap` desde antes): `.esc-acao{...flex-wrap:wrap...}`. Os cinco
tamanhos passaram a dar EXIT 0.

Vale registrar o que isso significa: **o botao de descartar estava inalcancavel no
celular**, que e onde o dono mais mexe no escopo. Nenhuma das 394 assercoes do
harness via isso, porque o harness roda em uma largura so.

---

## 4. O achado que muda como se le o grafico: a cor NAO separa os dois degraus de cima

O criterio de aceite (itens 12 a 14) exigia os tres degraus **medidos** por
`prova_grafico.py`. O arquivo nao tinha **uma linha** sobre abandono: `grep -c
"abandono|s-pendente|s-recente|esc-col"` devolvia **0**. Os tres tokens tinham
sido escolhidos no olho, exatamente o que a licao da 3a passada do painel de
vendas proibe.

Medido em 13/08/2026 com `validate_palette.js` da skill `dataviz`, paleta
`#5C6675,#C48808,#F26B31 --mode light --surface "#F6F7FA"`:

| check | resultado |
|---|---|
| banda de luminosidade | PASS |
| croma | FAIL (`--dim` le como cinza) -> **e a intencao** |
| separacao CVD | **FAIL: morno x quente ΔE 2,1 (deutan)** |
| piso de visao normal | **FAIL: morno x quente ΔE 10,6, piso 15** |
| contraste vs superficie | WARN: morno 2,85 · quente 2,83 |
| luminancia morno x quente | **1,01** |

Em portugues claro: **`pendente` (8-29 dias) e `abandono` (30+) sao, para o olho,
a mesma cor.** 1,01 de luminancia e ΔE 10,6 em visao NORMAL, abaixo do piso da
cartilha. Em deuteranopia, ΔE 2,1: identicas.

**Nao troquei os tokens**, e a razao esta gravada no codigo da prova:
`--morno` e `--quente` sao cor de IDENTIDADE do projeto, calibrados em 16/07/2026
e no ar em outras telas. Inventar um par so para este grafico criaria uma quarta
regua de cor para a mesma pergunta, que e o defeito que a propria spec proibiu no
eixo. Trocar paleta calibrada e decisao do dono, nao minha.

O que sustenta a leitura nao e a cor, e a **altura**: o eixo Y ja e `dias_parada`,
entao a cor e redundante com a posicao. **Mas a redundancia se rompe justamente na
fronteira**: 29 dias (97% de altura) e 30 dias (100%) tem quase a mesma altura E
quase a mesma cor. La, quem separa e SO a marca `30+` e a linha de corte de 30d.

Por isso as duas deixaram de ser enfeite e viraram **condicao de alivio exigida em
codigo**. `prova_grafico.py` agora reprova se sumirem.

### Prova de que a prova morde

Prova que nunca reprova e fachada (a licao das 69 assercoes verdes do v46). Copiei
`public/` e `ferramentas/` para um diretorio temporario, **removi a marca `30+` do
JS e a hachura do CSS**, e rodei:

```
REPROVOU:
  - a marca 30+ sumiu do app.js: sem ela, abandono e pendente ficam
    indistinguiveis (ΔE 10.6 normal, 2.1 deutan) e a coluna satura em silencio
  - a hachura da coluna sem acao em andamento sumiu: em-andamento voltaria a
    disputar o canal da cor, que ja carrega abandono
EXIT=1
```

A mutacao rodou em copia; o repo real nunca foi tocado.

Reparo de leitura que ficou escrito na prova: **a hachura nao separa os degraus.**
Ela separa `tem acao em andamento` de `ninguem tocou`. Dois canais, duas
perguntas, sem disputa.

---

## 5. Provas, todas com EXIT CODE conferido

Depois da ultima mudanca, nesta maquina:

| prova | resultado |
|---|---|
| `python ferramentas/harness.py` | **394 passou / 0 falhou** — EXIT 0 (eram 366) |
| `python ferramentas/validar.py` | EXIT 0 |
| `python ferramentas/prova_trilho.py` | EXIT 0 |
| `python ferramentas/prova_grafico.py` | EXIT 0 (agora com o bloco 7, do Escopo) |
| `node --check public/app.js` | EXIT 0 |
| `diag_mobile.py` 360 / 390 / 414 / 1280 / 1440 | **EXIT 0 nos cinco** |
| `prova_escopo_prioridade.sql` (MCP) | **34 ok, 0 falhas** |

As 28 assercoes novas do harness cobrem os itens 1 a 11: contagem de colunas,
altura proporcional a `dias_parada`, saturacao em 35 dias com a marca `30+`,
solida x hachurada, o ponto de em-andamento, a marca `!!` de urgencia alta,
ausencia de marca na baixa, o rodape que cobra as frentes sem urgencia, a RPC
chamada **com os argumentos** (nunca por `SRC.indexOf`), cancelar sem chamar RPC,
`r.error` visivel, `pode_editar=false` sem seletor no DOM e zero TypeError.

A prova SQL confirmou a assercao 18, que **sustenta o eixo do grafico**: quatro
escritas de prioridade geraram **0 evento** (26 antes, 26 depois), `dias_parada`
continuou em 40, e o contraste ficou provado porque mudar STATUS ainda grava
exatamente 1 evento. Sem esse contraste, a assercao 18 ficaria verde com o trigger
inteiro apagado.

### Integridade do minificado (item 23)

Feita do jeito que o v46 exige, e **quase errei aqui tambem**: comparei primeiro a
linha mais longa dos dois arquivos, que e a linha 1, e a linha 1 nao e a que o
patch altera. Prova refeita apontando para a linha do roteador:

```
ROTEADOR (a linha que o patch altera)
  baseline HEAD + patch reaplicado: 22729
  working copy                    : 22729
  IGUALDADE TOTAL BYTE A BYTE     : True

NUCLEO IIFE (linha 1, que o patch NAO deve tocar)
  igual ao do HEAD                : True | 24625 chars
```

Comparacao de prefixo e sufixo nao vale; esta e byte a byte, com CRLF normalizado.

---

## 6. O que o dono abre agora (dado real de 13/08/2026)

Aba Escopo, **6 colunas** ordenadas do mais parado para o menos:

| frente | dias parados | coluna |
|---|---|---|
| Pitscare | 7 | hachurada |
| Status do WhatsApp | 7 | hachurada |
| Calculadoras | 2 | **solida** (1 acao em andamento) |
| Assistência técnica | 2 | hachurada |
| Produção e marketing | 2 | hachurada |
| Colaboradores | 2 | hachurada |

Abaixo do eixo: **sem acao nenhuma: Captação orgânica · Comercial**.
No rodape: **sem urgencia declarada: 8 de 8 frentes**.

Dois avisos honestos sobre esta primeira leitura:

1. **O grafico sai inteiro cinza hoje.** Todas as frentes estao em 7 dias ou
   menos, ou seja, todas no degrau `s-recente`. Os degraus morno e quente, e com
   eles o achado da secao 4, so aparecem quando alguma frente passar de 7 dias.
   O escopo esta mais movimentado do que a spec previa em 12/08 (ela projetava
   Colaboradores no topo com 8 dias; hoje sao 2).
2. **Nenhuma marca de urgencia vai aparecer**, porque as 12 acoes vivas seguem com
   `prioridade` nula. Isso nao e defeito: e a tela cobrando o dono, exatamente
   como as cinco metas em branco da Fatia 2. A marca so nasce quando ele usar o
   seletor.

---

## 7. Onde encostou

| arquivo | o que |
|---|---|
| `public/app.js` | (ja estava) `escGrafico`, `escGrau`, `escParcelas`, `ESC_PRIO`, `ESC_MARCA`, `ESC_TETO`, `ESC_CORTE`; `escPlacar` fora do topo; roteador com `esc-ir` e `esc-prio` na linha 2058. **Nao encostei nesta sessao** |
| `public/app.css` | **`flex-wrap:wrap` em `.esc-acao`** + comentario com o numero medido (unica mudanca minha no CSS) |
| `ferramentas/prova_grafico.py` | **bloco 7 novo**: itens 12, 13 e 14, com o achado de ΔE registrado e os alivios exigidos em codigo |
| `ferramentas/harness.py` | (ja estava) 28 assercoes da Fatia B |
| `ferramentas/prova_escopo_prioridade.sql` | (ja estava) rodado pela primeira vez: 34 ok |
| `ferramentas/patch_escopo_prioridade.js` | (ja estava) confirmado aplicado, guarda de reaplicacao funcionou |
| banco | **nao encostou nesta sessao.** `definir_prioridade_acao` e a `escopo_completo()` estendida ja estavam aplicadas |

---

## 8. Pendencias

1. **A cor nao separa `pendente` de `abandono`** (secao 4). Hoje nao aparece
   porque nenhuma frente passou de 7 dias, e a marca `30+` cobre a fronteira. Se
   o dono quiser separacao real por cor, e trocar token calibrado: **decisao
   dele**, e ai `prova_grafico.py` remede.
2. **O `.gitattributes` continua sem existir**, e a armadilha de CRLF pegou pela
   **QUARTA sessao seguida** (v52, v53, v54, v55). Desta vez foi o
   `prova_grafico.py`: o Edit devolveu o arquivo inteiro em CRLF com o indice em
   LF. Pego com `git ls-files --eol` antes do commit e convertido. **Nao criei o
   `.gitattributes` por conta propria**: `* text=auto eol=lf` renormaliza o repo
   inteiro e produz um diff gigante numa sessao que nao era sobre isso. E uma
   fatia propria, de 10 minutos, e ja custou quatro sessoes de atrito.
3. **`diag_mobile.py` roda em uma largura por vez e nao esta na suite padrao.**
   A regressao da secao 3 so apareceu porque a spec exigia os cinco tamanhos
   explicitamente. As 394 assercoes do harness rodam numa largura so.
4. Os sete cortes numericos das regras de Insights seguem cravados no JS, contra
   o espirito do invariante 11 (herdado do v54, item 3).
5. As duas regras de canal do card de Insights seguem sem prova (v54, item 1).
6. O drill-down dos KPIs continua fora (v53, item 1; v54, item 4).
7. 2 de 3 vendas reais seguem sem origem (v54, item 5).
8. Herdado e aberto: `k()` chama `renderVendas` a cada tecla; relatorio de entrega
   sem `despachado_em`; `privado.fn_venda_atualizar` com EXECUTE para
   `authenticated` e SECURITY DEFINER; **Conteudo e Hoje continuam sem a forma
   nova** (oitava vez atropelados).
9. Escrita de volta no Notion segue bloqueada pela capability "Update content".

---

## 9. Licao desta sessao

As tres coisas que estavam erradas tinham a mesma forma: **um numero que ninguem
tinha medido, tapado por um verde que media outra coisa.**

- 394 assercoes verdes, e o botao de descartar fora da tela em 360px.
- Uma spec que exigia cor medida, e `prova_grafico.py` com zero linha sobre o
  grafico que a spec descrevia.
- Um `grep` meu na linha 1 concluindo que o roteador nao tinha o patch, quando o
  roteador nunca esteve na linha 1.

Nos tres casos a correcao veio de **rodar contra a coisa certa**, nao de pensar
melhor: o worktree do HEAD para separar regressao de herdado, o
`validate_palette.js` para separar "parecem diferentes" de "sao diferentes", e a
mutacao em copia para separar prova de fachada.
