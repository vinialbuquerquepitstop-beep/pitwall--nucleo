# Handoff Financeiro v16 — agosto nao deu prejuizo de 9 mil, deu lucro de 2.925,98

Data: 03/09/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v15.md`
como topo da linha.

A TELA desta mesma entrega esta no `handoff_frontend_pitwall_v3.md`, escrito por outra
sessao (ver secao 7). Este documento cobre a AUDITORIA e o SERVIDOR; nao repete o que
esta la.

---

## 1. A frase da entrega

**O Financeiro para de chamar caixa de resultado: mostra o lucro do mes ao lado do
caixa, separa o custo da mercadoria da despesa de operacao, e para de acusar linha
neutra como nao classificada.**

> A frase original desta entrega dizia *"separa o que virou estoque"*. **Estava errada**,
> e o dono a derrubou no mesmo dia: nada virou estoque. Ver secao 7-A. A frase acima e a
> corrigida, e a secao 3 ja esta reescrita com ela.

Nasceu de o dono abrir a tela e escrever: *"cara, agosto ta ridiculo. que diferenca de
9 mil e essa? fechei o mes com 9 mil de despesa?"*

**Ele estava certo, e a tela e que estava errada.**

---

## 2. A auditoria de agosto, que e a substancia deste handoff

| Agosto/2026 | Valor | Que verdade e |
|---|---|---|
| Faturado, 7 vendas | R$ 23.628,98 | resultado, por competencia |
| **Lucro** | **R$ 2.925,98** | resultado |
| Entrou nesta conta | R$ 6.479,00 | caixa |
| Saiu desta conta | R$ 16.054,00 | caixa |
| Saldo desta conta | -R$ 9.575,00 | caixa |

**Por que so R$ 6.479 caiu, de R$ 23.628,98 vendidos.** Cinco das sete vendas foram no
**cartao** (R$ 17.628,98), e cartao nao entra nesta conta por Pix. As duas que nao foram
cartao (Renata R$ 2.000 + Aretusa R$ 4.000) mais R$ 479 da BR IPHONES dao exatamente os
R$ 6.479 recebidos. **Bate na virgula**, e essa conferencia e o que transforma a
explicacao em prova.

**Dos R$ 16.054 que sairam, R$ 15.400 sao compra de aparelho** (TROCA FONE 4.400 e
2.750, ASTERION 3.400, JN TECH 3.350, DOMVOLT 1.500). **Custo da mercadoria, e nao
estoque nem despesa de operacao**: os cinco pagamentos casam com venda de agosto, de 0 a
2 dias (secao 7-A). **A despesa de operacao de agosto foram R$ 654,00**: motoboy R$ 525
e moradia R$ 129.

### O achado estrutural, que nenhum ajuste de tela resolve

**O dono paga fornecedor por Pix desta conta e recebe a maior parte por cartao fora
dela.** Enquanto isso for verdade, esta conta vai parecer negativa em TODO mes
lucrativo. Nao e erro de lancamento e nao e defeito de software.

A tela agora explica em vez de esconder. Trazer o dinheiro da maquininha para dentro do
Financeiro e **entrega nova, nao prometida em lugar nenhum**, e sem ela o caixa do
modulo nunca sera o caixa do negocio.

---

## 3. Os quatro defeitos, e como cada um fechou

| # | Defeito | Evidencia antes | Depois |
|---|---|---|---|
| 1 | `resultado` rotulava CAIXA | tela -9.351,21 · lucro real +2.925,98 | dois blocos com fonte declarada; a palavra so rotula resultado |
| 2 | Custo de mercadoria somado a despesa | `Mercadoria` valia 74,2% do "gasto" | `saiu` declara `compra de aparelho` + `despesa de operacao`; empresa mostra R$ 654 de despesa |
| 3 | `nao_classificado` contava linha NEUTRA | acusava -R$ 4.725 em 3 linhas num mes 100% julgado | **0 / 0**. As 3 eram 1 `repasse` + 2 `transferencia_interna`, `dominio` null POR DESENHO |
| 4 | `tudo` somava empresa + pessoal | -9.351,21 = -9.575,00 + 223,79 | dois placares lado a lado, sem saldo combinado |

O defeito 3 era o pior tecnicamente: **dois numeros da mesma tela se contradiziam**. A
correcao nao foi ajustar a conta, foi fazer `nao_classificado` usar a MESMA definicao de
"julgado" que a `fin_cobertura` ja usava. Agora concordam por construcao, nao por
coincidencia.

---

## 4. O servidor: `fin_painel`

Migration `20260903_fin_painel_caixa_x_resultado`, aplicada. Ledger **173 -> 174**,
subconjunto `fin_` **28 -> 29**, 1:1 com o git.

```
placar: { entrou, saiu, estoque, gasto, saldo, nao_classificado_* }
placar_empresa / placar_pessoal    -- so quando p_dominio = 'tudo', senao null
resultado_venda: { n, faturado, lucro, delta_pct_lucro }   -- null em 'pessoal'
```

**A chave `resultado` FOI REMOVIDA do payload**, nao renomeada em silencio. Decisao
consciente da Torre: campo orfao tem que quebrar alto. Custou o que esta na secao 6.

Payload medido em agosto:

| campo | tudo | empresa | pessoal |
|---|---|---|---|
| estoque | 15400,00 | 15400,00 | 0 |
| gasto | 5342,17 | **654,00** | 4688,17 |
| saldo | -9351,21 | -9575,00 | 223,79 |
| nao_classificado | 0 / 0 | 0 / 0 | 0 / 0 |

`resultado_venda` em `tudo` e `empresa`: `{n: 7, faturado: 23628.98, lucro: 2925.98,
delta_pct_lucro: 336.7}`.

**Caixa e resultado NAO se somam em lugar nenhum do payload.** Sao dois blocos, com
nomes distintos e fonte declarada. Por-los lado a lado e permitido; somar, nao. O lucro
vem da `venda` e so de la, nunca do extrato.

### O que o `base` achou e nao estava no brief

1. **`venda.status` admite `pre_venda` e `cancelada`.** O brief mandava filtrar so
   `arquivado_em is null`, e com isso uma pre-venda entraria no lucro do mes, que e o
   mesmo genero de defeito que esta entrega existe para matar. Ele acrescentou
   `status = 'concluida'`, alinhado ao Dashboard. Hoje as 9 vendas ativas sao todas
   concluidas, entao o numero e identico nos dois filtros.
2. **`venda.data_venda` e NULLABLE.** Caiu para `coalesce(data_venda, criado_em)` no
   fuso de Sao Paulo, senao venda sem data some da janela em silencio.
3. **`estoque` nao e `sum(abs(valor))` solto**, e a mesma composicao de `saiu` restrita
   ao grupo `Mercadoria`. Com `abs()`, devolucao de fornecedor inflaria o total e
   `gasto = saiu - estoque` poderia ficar negativa.
4. **`nao_classificado_valor` e LIQUIDO, `fin_cobertura.valor_pendente` e ABSOLUTO.** Na
   janela do ano: -30,00 contra 630,00 sobre as MESMAS 2 linhas (+300 e -330). A
   contagem concorda, o valor nao. **A tela nao pode por os dois lado a lado**, e por
   isso a celula do placar carrega contagem, nao valor.

`estoque` (a CHAVE do payload; a tela nao usa mais essa palavra, ver 7-A) conta por
GRUPO e nao por codigo, para que categoria de mercadoria nova entre sozinha. RLS provada: vendedor recebe `Financeiro e restrito ao dono.`, e um `sub` de
outro tenant ve **zero** das 7 vendas pela mesma view. ACL refeita apos o
`CREATE OR REPLACE` e conferida byte a byte contra o snapshot anterior.

---

## 5. Provas

Suite completa, rodada pela Torre depois de tudo: **EXIT 0 nos 14 comandos**,
**1087 assercoes, 0 falhas** (1092 declaradas, 5 de ramo alternativo previstas), **38
delas `fin5:`**.

`pl.resultado` tem 0 ocorrencias em `public/app.js`; todos os campos novos tem leitor.

**Deploy conferido no worker, nao presumido:** apos o push,
`flat-resonance-09ba.pitstopimports.workers.dev/app.js` passou a servir
`resultado_venda` e `placar_empresa`, com `pl.resultado` zerado, em ~15 segundos.

---

## 6. O erro de sequenciamento, registrado

Remover a chave `resultado` do payload **enquanto o banco de producao ja estava
atualizado e o app publicado ainda era o antigo** abriu uma janela real: entre a
migration e o push da tela, **o placar do dono mostrava R$ 0,00**.

Foi decisao consciente da Torre ("quebrar alto e melhor que silenciar"), mas o alto
quebrou na tela dele, nao no commit. O C6 manda servidor e tela subirem no MESMO commit
e isso foi respeitado no git; **o que nao foi respeitado foi a ordem de APLICACAO**: a
migration foi ao banco antes de a tela existir.

**Regra que sai daqui:** migration que REMOVE ou RENOMEIA chave de payload so se aplica
no banco depois de a tela que a le estar pronta. Aditiva pode ir antes; destrutiva, nao.

---

## 7. Duas sessoes na mesma pasta, ao mesmo tempo

O `vitrine` desta sessao **travou** (`no progress for 600s`). Ao conferir a arvore, a
Torre encontrou a tela **ja pronta e commitada** por OUTRA sessao do Claude Code
(`session_01J2SiFKLkjLjiXfNRtN4Rms`) rodando na mesma pasta, no commit `3b6b3bb`, junto
com a migration desta sessao. Um segundo commit (`bbaa43b`, navegacao de mes no
Dashboard) nunca passou por aqui.

A Torre **nao desfez nada e nao assumiu o trabalho como seu**: conferiu por fora
(suite, campos lidos, chave morta ausente) e aprovou.

**O risco vale registro:** duas sessoes editando o mesmo `app.js` e como as duas perdem
trabalho, e por pouco a foto da tela nao foi entregue ao dono como trabalho desta
sessao. Se as duas ficarem abertas, cada uma precisa de um dominio proprio.

---

## 7-A. A CORRECAO DO DONO, no mesmo dia: nada virou estoque

> *"o sistema conta como saida o pagamento de telefones. nada virou estoque. apenas um
> 14 pro max."*

**Ele estava certo e a tela que subiu horas antes ja mentia de novo**, dizendo que os
R$ 15.400 "viraram estoque" e "voltam a ser dinheiro quando vender".

Medido depois da correcao, os CINCO pagamentos de agosto casam com venda de agosto:

| Pago | Contraparte | Valor | Venda | Modelo | Custo | Distancia |
|---|---|---|---|---|---|---|
| 10/08 | ASTERION | 3.400,00 | VENDA-0005 | iPhone 14 | 3.400 | -2 dias |
| 13/08 | DOMVOLT | 1.500,00 | VENDA-0007 | Airpods Pro 3 | 1.500 | 0 |
| 18/08 | TROCA FONE | 2.750,00 | VENDA-0009 | iPad 11 | 2.750 | -1 |
| 22/08 | TROCA FONE | 4.400,00 | VENDA-0013 | iPhone 16 | 4.399 | +2 |
| 24/08 | JN TECH | 3.350,00 | VENDA-0014 | iPhone 14 Pro | 3.350 | 0 |

R$ 15.400 pagos contra R$ 15.399 de custo casado, tudo dentro de dois dias.
**Ele compra POR VENDA, nao para prateleira. Estoque em agosto: zero.**

### Por que NAO construi casamento automatico

A tentacao era o servidor separar "custo de venda casada" de "estoque". **Nao da, e
fingir que da seria o terceiro erro do dia:**

1. a tabela `venda` tem **9 vendas em toda a historia** (2 em julho, 7 em agosto) e
   ZERO de fevereiro a junho. Pagamento de fevereiro nao tem contra o que casar, e
   apareceria como "estoque" quando na verdade a VENDA nunca foi registrada;
2. o casamento por valor fora de agosto ja produziu dois pares FALSOS, a 108 e 84 dias,
   contra vendas que ja estavam casadas com pagamentos de agosto. Uma venda nao se paga
   duas vezes. E a mesma armadilha do repasse.

### O 14 Pro Max: estoque que o sistema inteiro nao ve

O dono explicou: *"14 pro max foi uma venda que ele entrou de upgrade"*. E **trade-in**,
nao compra. Conferido: **nenhuma das 9 vendas tem trade-in registrado** (`tem_trade_in`
false nas nove, `entrada_modelo` vazio, `entrada_valor` nulo).

**Nao sai dinheiro, entao o extrato nao pode ve-lo; e a venda tambem nao registrou.** O
unico estoque real do negocio e invisivel para o Financeiro E para o Dashboard. Nenhuma
mudanca no modulo de caixa alcanca isso: o caminho e registrar o trade-in na venda.

### O que a tela passou a dizer

Sem heuristica, so o que e verdade: **compra de aparelho e CUSTO DA MERCADORIA**, motoboy
e **DESPESA DE OPERACAO**, e nenhum dos dois e estoque.

| Antes (falso) | Depois |
|---|---|
| `R$ 130,00 em estoque · R$ 20,00 de gasto` | `R$ 130,00 de mercadoria · R$ 20,00 de despesa` |
| `tudo gasto, nada em estoque` | `tudo despesa, nada de mercadoria` |
| "viraram **estoque** ... Estoque nao e despesa: virou aparelho na prateleira e **volta a ser dinheiro quando vender**" | "foram **compra de aparelho** ... e o custo da mercadoria, nao o custo de manter a loja de pe: **quase sempre e um aparelho que ja tem dono**" |
| "a compra de estoque sai dela inteira no mes em que foi paga" | "a compra do aparelho sai dela no mes em que foi paga, **que nem sempre e o mes da venda**" |

A chave `pl.estoque` do servidor **nao foi renomeada**: mudou a PALAVRA na tela, que era
a mentira. Renomear chave de payload foi o que abriu a janela de regressao da secao 6, e
nao ha ganho para o dono em repetir isso hoje. Fica como divida nomeada.

**Uma assercao nasceu errada e foi corrigida junto:** a `fin5:` exigia a frase *"volta a
ser dinheiro quando vender"*. Ela agora cobra o CONTRARIO: que a nota nao prometa que o
dinheiro volta e nao use a palavra estoque. Prova que fixa uma mentira e pior que prova
nenhuma, porque defende a mentira de quem tentar corrigi-la.

---

## 8. O que continua aberto

| # | Item | Nota |
|---|---|---|
| 1 | **O dinheiro da maquininha nao entra no Financeiro** | Secao 2. Sem isso o caixa do modulo nunca e o caixa do negocio. Entrega nova, nao prometida |
| 1-A | **Trade-in nao e registrado em venda nenhuma** | Secao 7-A. O unico estoque real do negocio e invisivel aos dois modulos. Comeca por registrar o trade-in na venda, nao por mexer no caixa |
| 1-B | A chave `pl.estoque` do servidor guarda mercadoria, nao estoque | Secao 7-A. Divida nomeada; renomear payload so junto de uma tela pronta |
| 2 | Os R$ 630 do Rodrigo e o `forcar` no repasse | v14 secao 4. Decidido: pendentes ate o mecanismo existir |
| 3 | `comissao_paga` | v15 secao 5.2. So quando ele pagar o consultor por esta conta |
| 4 | 3 linhas `Aplicação RDB` rotuladas `resgate` | Cosmetico, herdado |
| 5 | Escrita de volta no Notion | Bloqueio antigo do v33 |

---

## 9. Primeiro movimento do proximo chat

**Perguntar ao dono se ele abriu a aba e se o numero agora bate com a cabeca dele.**
Tres handoffs seguidos pediram que ele abrisse; quando abriu, achou um defeito real em
menos de um minuto. A tela mudou por causa disso, e ninguem confirmou ainda que a
correcao respondeu a pergunta dele.

Depois, decidir o item 1 da secao 8, que e o unico que ainda separa o Financeiro de
mostrar o caixa de verdade.
