# Handoff Financeiro v5 — conserto: o par de repasse atravessa a virada do mes

Data: 31/08/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v4.md`
como topo da linha e **corrige duas afirmacoes dele**.

Nao e entrega nova. E conserto de portao, na mesma sessao S1, pelo `CONTRATO.md` 6.1.

---

## 1. O defeito

A v4 subiu dizendo que o dono podia marcar o par Ford. **Nao podia.**

| fato medido | |
|---|---|
| `finJanela()` | a janela e **um mes calendario**, sempre |
| trocar de mes | `FIN_SEL={}`, **apagava a selecao** |
| entrada Ford | `ade61039`, **30/07/2026** |
| saida Ford | `efa4fa7d`, **06/08/2026** |

Os dois lados nunca aparecem juntos, e trocar de mes apagava o que ja estava marcado.
**Nao existia caminho de clique que marcasse o par Ford**, que e o primeiro exemplo
nomeado dentro do proprio `P-W1-REPASSE`. E nao e caso raro: repasse quase sempre
atravessa a virada do mes, porque o dinheiro entra num dia e se repassa dias depois.

**Por que a suite nao pegou:** o fixture do harness tinha os dois lados no MESMO mes
(`f11` em 09/08, `f12` em 08/08), e o stub do `fin_movimentos` **ignorava
`p_ini`/`p_fim`**, entao trocar de mes nao mudava nada na tela. A prova mediu o caso
facil que eu construi, nao o caso real que estava no banco na minha frente.

O portao de saida nao pega isso: nenhum dos 8 itens pergunta se a frase da entrega
acontece com o DADO REAL. O item 13 da secao 7 pergunta ("a entrega resolve o pedido
real, ou um parecido?"), mas essa auditoria roda em sessao separada, depois do commit.

### 1.1 O segundo defeito, que o conserto do primeiro expos

Com o par atravessando o mes, `repasse.valor` somava **so o lado positivo**. Na janela
de agosto existe so a perna negativa, entao a tela declararia **R$ 0,00** tendo tirado
R$ 4.800,00 do `saiu`.

A pergunta que a linha responde nao e "quanto passou no par", e sim **"quanto deixou de
entrar nos totais DESTA janela"**. Isso e a soma dos MODULOS dos movimentos de repasse
da janela.

---

## 2. O que mudou

### 2.1 `supabase/migrations/20260831_fin_fatia3_repasse_janela.sql`

Aplicada como `20260831233621_fin_fatia3_repasse_janela`. Corpo de `20260831231416`
com **uma linha diferente**: `sum(abs(b.valor))` no lugar de
`sum(b.valor) filter (... and b.valor > 0)`.

### 2.2 `public/app.js`

- `FIN_SEL` passa a guardar o LANCAMENTO (`id`, `valor`, `data`), nao so a marca. As
  chaves continuam sendo os ids, entao tudo que usa `Object.keys(FIN_SEL)` segue igual.
- `fin-mes` **deixa de apagar a selecao**. Trocar de sub-view, de dominio ou de filtro
  continua limpando, porque ali a selecao perde sentido.
- O handler de repasse le a SELECAO, nao a lista do mes aberto.
- `finForaDoMes()`: a barra de lote **declara** quantos selecionados estao fora do mes
  aberto. Contador dizendo "2 selecionados" com um so visivel mente por omissao, e este
  projeto ja pagou por isso na aba Conteudo, na v33.
- A linha da Visao passa a contar LANCAMENTOS da janela, nao pares: com o par
  atravessando o mes, contar pares diria meio.

### 2.3 `ferramentas/harness.py`

- O fixture passa a ter o par ATRAVESSANDO o mes (`f12` foi para 30/07), igual ao Ford
  real.
- O stub do `fin_movimentos` passa a **respeitar `p_ini`/`p_fim`**. Ele ignorava a
  janela, e era essa a cegueira que deixou o defeito passar.
- O stub do `fin_painel` respeita a janela e soma modulos.
- Assercoes novas: o outro lado nao esta neste mes, trocar de mes nao apaga a selecao,
  a acao aparece com os dois em meses diferentes, a barra declara "1 fora deste mes", e
  cada mes declara o valor da perna que tem.

---

## 3. O que foi PROVADO

### 3.1 O par Ford REAL, no banco vivo, desfeito em seguida

DO block com `raise exception`. Conferido depois: `0` linhas com `repasse_id`.

| leitura | resultado |
|---|---|
| marcar o par (30/07 x 06/08) | `true` |
| `fin_painel` julho | `{"n": 1, "valor": 4800.00}` |
| `fin_painel` agosto | `{"n": 1, "valor": 4800.00}` |
| `fin_painel` os dois meses | `{"n": 2, "valor": 9600.00}` |
| cobertura de agosto | 2,69% -> **9,36%** |

**Um par marcado leva a cobertura de agosto de 2,69% para 9,36%.**

### 3.2 A suite

917 -> **922 assercoes, 0 falhas**. EXIT 0 nos seis comandos e nas cinco larguras.

Duas contagens antigas mudaram porque o `f12` mudou de mes (agosto foi de 13 para 12
linhas, e de 7 para 6 sem classificacao). Conferidas: contagem, nao comportamento.

### 3.3 Git contra banco

**17 de 17 `fin_` batem por corpo normalizado**, nos dois sentidos.
A nova: `972e96c78da33015489d3bfbf1e6ce8f`.

---

## 4. O que a v4 dizia e esta ERRADO

- v4 secao 1: "selecionar os dois lados na aba Movimentos" — **nao era possivel** para
  par que atravessa o mes, que e o caso normal.
- v4 secao 3.1: a linha declarava o valor "contando so o lado positivo do par". Passou a
  contar os modulos da janela.
- v4 4.1 prova 9: `{"n": 4, "valor": 5100.00}` era o comportamento antigo. Com a regra
  nova os mesmos dois pares dariam `{"n": 4, "valor": 10200.00}`.

---

## 5. Portao de saida, item a item

| # | Item | Resposta |
|---|---|---|
| 1 | SQL rodado no banco de verdade | **SIM.** Mais a prova do par Ford real |
| 2 | RLS testada como dono E como vendedor | **NAO.** Segue como na v4: a `fin_repasse_marcar` so foi rodada como dono |
| 3 | a tela le todo campo novo, zero campo orfao | **SIM.** Nenhum campo novo; `repasse.valor` mudou de definicao, nao de nome |
| 4 | assercao nova com prefixo de fatia | **SIM.** 5 `fin3:` novas, todas sobre a virada do mes |
| 5 | EXIT 0 nos comandos e nas 5 larguras | **SIM** |
| 6 | commit unico | **SIM** |
| 7 | handoff atualizado | **SIM.** Este arquivo e o indice |
| 8 | nenhuma recusa nova fora da secao 4 | **SIM.** Nenhuma recusa nova |

### 5.1 Portao de confianca

Nenhum numero mudou de valor: nenhum par esta marcado em producao. Quando o dono marcar,
`entrou` e `saiu` encolhem e a linha que explica ja esta na mesma tela.

---

## 6. Invariantes reforcados

- **Novo, e o mais caro desta sessao:** fixture que so tem o caso facil e prova que
  mede a si mesma. O par do fixture agora atravessa o mes porque o par REAL atravessa.
  Stub que ignora a janela cega qualquer defeito de navegacao entre janelas.
- **Tela que omite recorte mente** (v33) vale tambem para SELECAO: "2 selecionados"
  mostrando um so precisa dizer onde esta o outro.

---

## 7. Pendencias

Todas as da v4 secao 7 seguem valendo, sem mudanca, mais estas:

- **Nao existe caminho para DESMARCAR um par.** Continua aberto, e agora incomoda mais:
  marcar ficou facil.
- **Item 2 do portao de saida (RLS como vendedor) segue NAO** para a
  `fin_repasse_marcar`.
- **O portao de saida nao tem item que cobre o dado real.** Foi o que deixou a v4 subir
  quebrada. Proposta para o dono decidir: acrescentar ao `CONTRATO.md` 6.2 o item
  "a frase da entrega foi executada contra uma linha REAL do banco, nomeada no handoff".

---

## 8. Primeiro movimento do proximo chat

`P-ABRE` em sessao nova, e depois **`P-R1`** (sessao S2).

Antes, tarefa do dono, sem prompt: **marcar o par Ford no app**, agora que da.
Julho: `AGENCY FORD SUL C MODELOS`, +R$ 4.800,00, 30/07. Setinha para agosto:
`FORD MODELS SUL`, −R$ 4.800,00, 06/08. A selecao sobrevive a troca de mes.
