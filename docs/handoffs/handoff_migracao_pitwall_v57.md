# Handoff Migracao Pit Wall (Nucleo) v57

Substitui a v56. Data: 14/08/2026.

---

## 1. Headline: a grade do molde parou de so descrever e passou a COBRAR

O pedido do dono foi "volte o processo de alteracao de front end da secao de
conteudo". O processo tinha parado num ponto NOMEADO, nao abandonado: o proprio
`app.css:2444-2446` dizia que urgencia era a Fatia 2.

Ate hoje a aba Conteudo mostrava o que estava combinado e nao cobrava nada.
Agora ela diz, na propria grade, que a terca esta sem o carrossel, que o reel de
segunda e o de quarta venceram sem ir ao ar, que ha 8 stories contra 49
previstos e que o sabado tem uma peca que o molde nao pede.

**Nenhuma dessas quatro frases existia em lugar nenhum do sistema.**

---

## 2. A correcao do enunciado: nao era frontend

O pedido chegou como tela. Medido pelo MCP antes de escrever qualquer linha: a
`molde_semana()` que estava no banco devolvia so o molde (`dia`, `data`,
`motor`, `feed_previsto`, `horario`). Os campos `existe`, `no_ar` e
`fora_do_molde`, desenhados na secao 3.4 da spec em 13/08, **nunca foram
implementados**. A grade nao tinha de onde tirar cobranca nenhuma.

Cruzar no JS, a partir do `conteudo_periodo` que o kanban ja carrega,
duplicaria a ponte `feed -> tipo_codigo` (a spec exige "num lugar so") e usaria
a janela do kanban, que nao e a semana do molde. A fatia virou RPC mais tela.

---

## 3. Banco: FATO na RPC, veredito no cliente

`molde_semana(p_ref date)` recriada. Por dia: `existe` (a peca foi criada),
`no_ar` (ela foi ao ar) e `fora_do_molde` (`text[]` dos tipos naquela data que o
molde nao pede). No topo: `stories {previstos, existentes, no_ar}`.

O caminho `tem_molde:false` **nao mudou uma linha**: e ele que faz a regra de
ouro ser real, e o item 19 da prova cobra que ele continue sem carregar `dias`
nem `stories`, para a tela nao ter de onde desenhar uma grade que nao existe.

Tres decisoes que valem registro:

- **`story` NUNCA entra no `fora_do_molde`.** Ele tem regua propria (os 7
  slots). Entrando ali, marcaria como violacao os 7 stories que o proprio molde
  manda existir. O item 15 da prova existe so para segurar isso.
- **A contagem "planejado X de Y" nao entra na RPC**, deriva no JS a partir da
  mesma lista de dias que ele desenha. Duas contagens sao duas verdades.
  `stories` fica na RPC porque o cliente nao tem o dado.
- `CREATE OR REPLACE FUNCTION` reseta ACL: REVOKE/GRANT refeitos e conferidos em
  `proacl`, com o item 20 cobrando que `anon` continue de fora.

---

## 4. Tela: dois canais que nunca se somam

Cada cartao do dia ganhou duas leituras SEPARADAS, `.mol-plan` e `.mol-exec`.
Um chip so respondendo as duas perguntas diria "Reels 3 de 3" numa semana em que
zero Reel foi ao ar: e o colapso que os invariantes 2 e 3 proibem em toque x
respondido.

| situacao | planejamento | execucao |
|---|---|---|
| tem peca, existe | `existe` (`--ok-fg`) | `no ar` / `atrasado` / `programado` |
| nao existe, data passada | `FALTA` (`--quente-fg`) | vazio |
| nao existe, data futura | `a criar` (`--morno-fg` hoje, `--frio-fg` depois) | vazio |
| folga com peca extra | — | `fora do molde` (`--dim`) |

Estado DERIVADO na leitura por `moldeEstado(d, hoje)` com `l()` (fuso do
Brasil), no precedente de `nivelPeca` (invariantes 4 e 10).

**Dia futuro nao cobra.** Sexta que ainda nao chegou nao esta em falta nem
atrasada, e marcar isso seria a tela mentindo sobre o que ja deu errado.

**`fora do molde` nao usa cor de urgencia**, por decisao: peca a mais e
divergencia, nao falha. Pintar de laranja poria dois significados no mesmo canal.

Rodape com tres vozes: `.mol-metas` (o que o molde DECLARA), `.mol-resumo` (o
que a semana TEM, planejado e no ar lado a lado) e `.mol-cobranca` (falta,
atrasado e fora do molde, cada balde com a propria cor e o proprio icone).

Zero token de cor novo.

---

## 5. Os dois achados desta sessao

### 5.1 O terceiro chao, que existia desde a Fatia 1 e ninguem media

O cartao de HOJE nao e `--panel`, e `--accent-tint` (`.mol-dia.hoje`). Ele
entrou na Fatia 1 e nenhuma prova o media, porque ate entao so havia texto
neutro ali dentro. A Fatia 2 poe chip colorido dentro dele.

`prova_atmosfera.py` ganhou o bloco 5: `--accent-tint` COMPOSTO sobre o cartao
da `#F1F3FC`, e os cinco tokens de chip sao medidos nos tres chaos.

| token | cartao | bandeja | cartao de hoje |
|---|---|---|---|
| `--ok-fg` | 5.35 | 4.99 | 4.83 |
| `--quente-fg` | 5.18 | 4.84 | 4.68 |
| `--morno-fg` | 5.10 | 4.76 | **4.60** |
| `--frio-fg` | 5.13 | 4.79 | 4.63 |
| `--dim` | 5.81 | 5.43 | 5.25 |

Pior caso 4.60 contra o alvo de 4.5. Passa, e passa com pouca folga: o proximo
que tingir mais aquele cartao derruba a prova, que e exatamente o ponto.

### 5.2 O fixture que apodrecia na segunda 17/08

`harness.py` fixava o molde em 10 a 16/08/2026. Enquanto a grade so DESCREVIA,
era proposital e inofensivo. **No instante em que o estado passa a depender de
hoje, na segunda 17/08 os sete dias virariam passado, todo dia sem card viraria
FALTA, e a suite seguiria verde provando outra coisa.** E o mesmo modo de falha
que o v55 e o v56 documentam, e ele entrava sozinho se ninguem tocasse ali.

O fixture virou relativo (`_segISO(off, semanas)`), e o comportamento que
depende de hoje ganhou duas cenas deterministicas: semana **-4** (tudo no
passado, onde a cobranca tem que morder) e semana **+4** (tudo no futuro, onde
ela nao pode morder). Valem em qualquer dia em que a suite rodar.

---

## 6. A prova que reprovou por estar errada

O bloco 5 nasceu cobrando `ratio(--quente-fg, --dim) >= 1.5`, como se contraste
baixo entre urgencia e divergencia fosse defeito. Reprovou com **1.12**.

O numero esta certo; o limiar estava errado. **Contraste mede LUMINANCIA, nao
matiz.** Laranja queimado e cinza azulado sao obviamente diferentes aos olhos e
quase iguais em brilho. O 1.12 nao condena a cor: ele repete a licao dos 7
trilhos (colisoes de 1.14 a 1.44). Matiz sozinho nao separa, entao **o icone
carrega a distincao**.

A checagem foi invertida para a forma certa, a mesma que a secao 3 do arquivo ja
usava para a sombra: a medida decide se o icone e enfeite ou estrutura. Abaixo
de 3:1, ela passa a COBRAR que os 6 icones existam, que `atrasado` e `fora`
desenhem coisas diferentes e que `.mol-ico` tenha regra no CSS.

Um segundo erro meu no mesmo bloco, corrigido: o regex varria o `app.js` inteiro
e contava **20** icones onde existem **6**, porque pegava o `ICONE_MAPA` das 7
categorias junto. Numero inflado numa prova e pior que numero nenhum, porque
parece medido. Escopado ao bloco `MOL_ICONE`.

---

## 7. Provas, todas com EXIT CODE conferido

| prova | resultado |
|---|---|
| `harness.py` | **443 passou / 0 falhou** — EXIT 0 (eram 426) |
| `validar.py` | EXIT 0 |
| `prova_atmosfera.py` | EXIT 0 |
| `prova_trilho.py` | EXIT 0 |
| `prova_grafico.py` | EXIT 0 |
| `node --check public/app.js` | EXIT 0 |
| `diag_mobile.py` 360/390/414/1280/1440 | EXIT 0 nos cinco, 0 estouros |
| `prova_molde.sql` | **24 ok, 0 falhas** (eram 14), rollback conferido |

Banco conferido vivo antes e depois: `conteudo_molde` com 1 linha, version 3, e
zero card de prova sobrevivente (o `raise exception` no fim reverte tudo).

Integridade do minificado: linha 1 (nucleo IIFE, **24625 chars**) e linha 9
comparadas byte a byte contra `HEAD`, identicas. So os blocos legiveis mudaram.

### Prova que morde (copia temporaria, repo real intocado)

| mutacao | resultado |
|---|---|
| 1. colapsar `.mol-plan` e `.mol-exec` num chip so | **EXIT 1**, 4 reprovacoes |
| 2. tirar a comparacao com hoje do `moldeEstado` | **EXIT 1**, 3 reprovacoes na cena FUTURO |
| 3. tirar o `<svg>` dos chips | **EXIT 1**, `chips=11 sem icone=11` |
| 4. `atrasado` e `fora` com o mesmo icone | **EXIT 1** na `prova_atmosfera.py` |

Sem elas, "dois canais" e "o icone nao e enfeite" seriam slogan. A copia foi
apagada.

---

## 8. O que o dono abre agora

A aba Conteudo, com a grade oficial no topo cobrando a semana:

```
MOLDE DA SEMANA   v3 · vigente desde 13/08        10/08 a 16/08   lido há 2h

 seg 10        ter 11        qua 12        qui 13   sex 14        sáb 15
 reel topo     carrossel     reel          —        reel          —
 10h-11h       10h-11h       10h-11h                10h-11h
 ✓ existe      ▲ FALTA       ✓ existe               ✓ existe      ⊗ fora do
 ▲ atrasado                  ▲ atrasado             · programado    molde:
                                                                    carrossel

 meta da semana: 3 reels · 1 carrossel · 49 stories
 esta semana: planejado 3 de 4 peças · no ar 0 de 4 · stories 8 de 49 · 1 no ar
 ▲ falta: carrossel de ter   ▲ atrasado: reel topo seg, reel qua
 ⊗ fora do molde: carrossel sáb
```

---

## 9. Onde encostou

| arquivo | o que |
|---|---|
| banco | `molde_semana(date)` recriada com o cruzamento; REVOKE/GRANT refeitos e conferidos em `proacl` |
| `public/app.js` | `MOL_ICONE`, `iconeMol`, `moldeEstado`, `molChip`, `moldeResumo`; `moldeDia` e `moldeSecao` estendidos |
| `public/app.css` | bloco "Fatia 2: a cobranca" (chips, icone, rodape); comentario do topo atualizado |
| `ferramentas/harness.py` | fixture relativo a semana corrente + **17 assercoes novas**, incluindo as cenas PASSADO e FUTURO |
| `ferramentas/prova_atmosfera.py` | bloco 5: os chips nos TRES chaos, com o composto do `--accent-tint`, e a contraprova do icone |
| `ferramentas/prova_molde.sql` | itens 11 a 20: o cruzamento |
| `docs/superpowers/plans/2026-08-14-molde-fatia2.md` | o plano em disco |

---

## 10. Pendencias

1. **Fatia 3 nao comecou**: os `tetos`, `proibicoes`, `garantia` e `caixinha` do
   JSON do molde sao lidos e guardados no payload, e nao aparecem em lugar
   nenhum. Slots de story dia a dia e historico de aderencia por semana tambem
   seguem cortados, declarados na secao 5 da spec.
2. **Herdadas do v56, as tres seguem abertas**: a `prova_atmosfera.py` ainda cita
   "Secao 5 do plano", plano que nao existe em disco (agora existe um plano da
   Fatia 2, que **nao** e aquele); `.cont-card::before` linhas 1151-1156 continua
   CSS morto na pratica; `.gitattributes` continua sem existir (sexta sessao).
3. Herdado do v55 e aberto: a cor nao separa `pendente` de `abandono` no grafico
   do Escopo; `diag_mobile.py` roda uma largura por vez e nao esta na suite
   padrao; os sete cortes numericos dos Insights seguem cravados no JS contra o
   invariante 11; as duas regras de canal do card de Insights seguem sem prova;
   drill-down dos KPIs fora; 2 de 3 vendas reais sem origem; `k()` chama
   `renderVendas` a cada tecla; **Hoje continua sem a forma nova**.
4. Escrita de volta no Notion segue bloqueada pela capability "Update content".

---

## 11. Licao desta sessao

A do v55 era "um numero que ninguem tinha medido, tapado por um verde que media
outra coisa". A do v56 era a irma dela: "um numero medido com precisao, apontado
para o elemento errado".

Esta e a terceira da familia, e e a mais util: **um numero medido com precisao,
apontado para o elemento certo, com o limiar errado.** 1.12 e a separacao real
entre `--quente-fg` e `--dim`. A prova estava certa em medir e errada em
concluir, porque contraste responde "quao diferente em BRILHO", e a pergunta que
eu estava fazendo era "quao diferente aos OLHOS".

O conserto nao foi baixar o limiar nem apagar a checagem. Foi virar a medida do
avesso: quando a separacao e baixa, a prova para de julgar a cor e passa a exigir
a estrutura que compensa a colisao. Guard-rail que incomoda nao se cala; ou se
abre excecao nomeada, ou se descobre que ele estava perguntando a coisa errada.
