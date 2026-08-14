# Handoff Migracao Pit Wall (Nucleo) v58

Substitui a v57. Data: 14/08/2026.

---

## 1. Headline: as regras do molde sairam do payload, e uma delas nao pode ser cobrada

Fatia 3, a ultima da spec de 13/08. Desde a Fatia 1, cinco blocos do molde
viviam guardados em `conteudo_molde.payload` e nunca chegavam na tela:
`story_slots`, `tetos`, `proibicoes`, `garantia` e `caixinha`.

O achado que definiu o desenho: **`tetos` nao e verificavel.** O teto e
`humor_mes: 2`, `humor_intervalo_dias: 7`, `humor_substitui: reel_sexta`. Para
cobrar isso o app teria que contar pecas de humor, e **nao existe codigo de
humor em `public.conteudo`**: `tipo_codigo` so tem `carrossel`, `feed`, `reels`
e `story`, e a palavra "humor" aparece em 3 TITULOS. Contar pelo titulo violaria
o invariante 12 (a chave e o `codigo`, nunca o `rotulo`) e produziria um numero
errado com cara de medido, que e o defeito que as tres ultimas sessoes
documentam.

Entao a Fatia 3 e **consulta declarada, nao cobranca** — e a tela e obrigada a
dizer isso, senao mente por omissao. As 8 `proibicoes` pela mesma razao: sao
regras que o app nao tem como conferir, e listadas em vermelho leriam como 8
violacoes, com a tela acusando o dono de algo que ela nunca mediu.

---

## 2. Banco

`molde_semana()` recriada devolvendo `regras`, com os cinco blocos AGRUPADOS em
vez de soltos no topo: o contrato passa a dizer o que eles sao. A RPC nao mede
nenhum deles e nao pode fingir que mede.

`jsonb_strip_nulls` no `regras`: bloco apagado no Notion **some da resposta**,
em vez de virar `null`. Sem isso a tela desenharia um cartao vazio de garantia,
que e pior do que nao desenhar, porque parece que a garantia acabou (item 22).

ACL refeita e conferida em `proacl` depois do terceiro `CREATE OR REPLACE` do
dia.

---

## 3. Tela

Gaveta `<details>` nativa, DEPOIS do rodape de cobranca e FECHADA por padrao.
`<details>` de proposito: o handler de clique delegado vive na linha minificada,
e abrir uma gaveta nao vale reescrever aquilo.

Cinco blocos, todos neutros: rotina de stories (7 slots com janela e funcao),
caixinha, tetos, nunca fazer, garantia.

Duas decisoes de leitura:

- **Codigo vira frase, e o que nao casa aparece cru.** `sabado_slot5` le
  "sáb, slot 5"; `quinta_slots2a5` le "qui, slots 2 a 5". Codigo que a leitura
  nao entende aparece CRU e marcado em `--erro-fg`, nunca vira vazio: mesmo
  tratamento que `.mol-peca.desconhecida` ja dava ao tipo desconhecido.
- **Renderizacao generica por chave, sem mapa de rotulo.** Chave nova vinda do
  Notion (`garantia.airpods`) aparece sozinha em vez de sumir. Mapear nome por
  nome faria o dado novo desaparecer em silencio.

A ressalva do teto fica COLADA nele, nao solta no rodape, e o topo da gaveta
declara que o Pit Wall nao confere nenhuma das cinco.

---

## 4. O defeito que a prova pegou: a gaveta nao estava fechada

`diag_mobile.py` reprovou em 360, 390 e 414px com **30 sobreposicoes** entre o
bloco de regras e o kanban.

Causa: `.mol-regras-corpo{display:grid}` e regra de AUTOR, e vence o
`display:none` que o navegador aplica ao conteudo de um `<details>` fechado. A
gaveta nascia permanentemente aberta, por cima do kanban.

**E a minha assercao passava feliz**, porque ela conferia a PROPRIEDADE
`reg.open === false`, que estava correta. O elemento dizia estar fechado e a
tela mostrava tudo. E a mesma familia do v56: assercao apontada para o lugar
errado.

Duas correcoes, nao uma:

1. O fechamento virou EXPLICITO no CSS (`display:none` + `[open]` restaurando),
   sem depender da folha do agente.
2. A assercao passou a medir o **display COMPUTADO**, que e o que a tela faz.

---

## 5. E a ferramenta que nao olhava para gaveta nenhuma

`diag_mobile.py` media as abas com todo `<details>` fechado. Gaveta fechada
nunca estoura: **o que pode estourar e o conteudo dela**, e ele nunca era
medido. Qualquer colapsavel futuro entraria cego pelo mesmo buraco.

O diagnostico passou a abrir todo `details:not([open])` antes de medir. Provado
que a mudanca vale: com `min-width:900px` injetado em `.mol-slot-jan`, dentro da
gaveta, o 360px agora acusa **7 estouros e EXIT 1**. Antes, passaria em silencio.

---

## 6. Um terceiro erro meu, no codigo de teste

A mutacao que apaga a ressalva reprovou por **crash**
(`getComputedStyle` recebendo `null`), nao pela assercao nomeada, e o crash
derrubava as 458 assercoes seguintes. Guard-rail que reprova por acidente so faz
barulho: a mensagem nao explicava nada e o resto da suite nem rodava.

Separado em duas assercoes com guarda de nulo. Agora a mesma mutacao devolve
`457 passou, 2 falhou` com os dois defeitos nomeados.

---

## 7. Provas, todas com EXIT CODE conferido

| prova | resultado |
|---|---|
| `harness.py` | **459 passou / 0 falhou** — EXIT 0 (eram 443) |
| `validar.py` | EXIT 0 |
| `prova_atmosfera.py` | EXIT 0 |
| `prova_trilho.py` | EXIT 0 |
| `prova_grafico.py` | EXIT 0 |
| `node --check public/app.js` | EXIT 0 |
| `diag_mobile.py` 360/390/414/1280/1440 | EXIT 0 nos cinco, **agora com as gavetas abertas** |
| `prova_molde.sql` | **26 ok, 0 falhas** (eram 24), rollback conferido |

Integridade do minificado: linha 1 (24625 chars) e linha 9 byte a byte iguais.

### Prova que morde (copia temporaria, apagada no fim)

| mutacao | resultado |
|---|---|
| A. devolver o `display:grid` solto (gaveta nasce aberta) | **EXIT 1** no harness, `open=false corpo=grid` |
| B. apagar a frase "nao confere" | **EXIT 1**, 2 reprovacoes nomeadas |
| C. pintar as proibicoes com `--quente-fg` | **EXIT 1**, "regra nao e acusacao" |
| D. estourar 900px DENTRO da gaveta | **EXIT 1** no `diag_mobile` 360, 7 estouros |

A mutacao A tambem mostra a divisao de trabalho nova: com o `diag_mobile` agora
abrindo as gavetas de proposito, "nasce aberta" deixou de aparecer la e passou a
ser guardada pelo harness. Cada ferramenta cobra uma coisa.

---

## 8. O que o dono abre agora

A aba Conteudo com a grade cobrando a semana (Fatia 2) e, abaixo dela, fechada,
a gaveta **Regras do molde**. Ao abrir: os 7 slots de story com janela e funcao,
a caixinha em frase legivel, os tetos com a ressalva colada, as 8 proibicoes e a
tabela de garantia. Tudo em cinza, tudo declarado como consulta.

---

## 9. Onde encostou

| arquivo | o que |
|---|---|
| banco | `molde_semana(date)` devolve `regras`, com `jsonb_strip_nulls`; ACL refeita |
| `public/app.js` | `rotCod`, `molSlotRef`, `molPares`, `moldeRegras` |
| `public/app.css` | bloco "Fatia 3: as regras do molde", com o fechamento explicito |
| `ferramentas/harness.py` | fixture com `regras` + **16 assercoes novas** |
| `ferramentas/diag_mobile.py` | abre todo `<details>` antes de medir |
| `ferramentas/prova_molde.sql` | itens 21 e 22, e o item 19 passou a cobrar `regras` |

---

## 10. Pendencias

1. A spec de 13/08 esta **inteira executada** (Fatias 0 a 3). O que ficou fora
   dela e declarado: slots de story dia a dia (49 celulas), historico de
   aderencia por semana, e escrita de volta no Notion (bloqueada pela capability
   "Update content").
2. **Herdadas do v56 e do v57, seguem abertas**: a `prova_atmosfera.py` ainda
   cita "Secao 5 do plano", que nao existe em disco; `.cont-card::before`
   1151-1156 continua CSS morto; `.gitattributes` continua sem existir (sexta
   sessao).
3. Herdado do v55: a cor nao separa `pendente` de `abandono` no grafico do
   Escopo; `diag_mobile.py` roda uma largura por vez e nao esta na suite padrao;
   os sete cortes numericos dos Insights seguem cravados no JS contra o
   invariante 11; as duas regras de canal do card de Insights seguem sem prova;
   drill-down dos KPIs fora; 2 de 3 vendas reais sem origem; `k()` chama
   `renderVendas` a cada tecla; **Hoje continua sem a forma nova**.
4. **Sugestao para a proxima sessao**, e nao e cosmetica: se o dono quiser que o
   teto de humor seja COBRADO em vez de exibido, o caminho nao e o app adivinhar
   pelo titulo. E o Calendario do Notion ganhar um campo proprio (um tipo
   `humor`, ou uma marca), e a ponte da RPC passar a conhece-lo. Enquanto isso
   nao existir, qualquer contagem de humor no Pit Wall e chute com decimal.

---

## 11. Licao desta sessao

A v57 fechou com "um numero medido com precisao, apontado para o elemento
certo, com o limiar errado". Esta e outra especie: **uma assercao que media a
propriedade em vez do resultado.**

`reg.open === false` era verdade. O elemento estava fechado. E a tela mostrava a
gaveta inteira aberta por cima do kanban, porque uma regra de autor vencia a
folha do agente. A propriedade e o que o DOM declara; o `display` computado e o
que o navegador faz. Quando os dois divergem, quem manda e o segundo, e foi o
`diag_mobile` — uma ferramenta que nem estava olhando para esse bloco — que
descobriu.

E a segunda metade da licao: aquela ferramenta so achou por acidente, porque a
gaveta quebrada invadia o kanban. Fechada e correta, ela seria invisivel para o
diagnostico. Por isso a correcao nao parou no CSS: o `diag_mobile` passou a
abrir as gavetas, e agora um estouro DENTRO delas reprova de proposito, e nao
por sorte.
