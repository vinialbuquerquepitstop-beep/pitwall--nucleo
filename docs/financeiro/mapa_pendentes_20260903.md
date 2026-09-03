# Mapa do pendente — 03/09/2026

Sucessor da `pauta_regras_20260902.md`. Aquela era uma lista de regras; esta e um
**mapa de padroes**, montado lendo a base viva depois que as 21 regras entraram.

Estado quando este mapa foi tirado: **55,42% julgado**, R$ 198.296,21 pendentes em
**619 linhas** e **327 contrapartes**. Cada R$ 4.448,21 vale **1 ponto** de cobertura.

> **Atualizado no fim de 03/09/2026: 73,90% julgado**, R$ 116.094,72 pendentes em
> **279 linhas**. Empresa R$ 169.830,80 (60) · pessoal R$ 76.550,16 (715) ·
> neutro R$ 82.345,00 (78).

### Linha do tempo da sessao de 03/09/2026

| Etapa | Cobertura | Pendentes |
|---|---|---|
| Estado inicial (medido em 02/09) | 18,55% | 785 linhas |
| + 21 regras da pauta | 55,42% | 619 |
| + 8 pares de repasse e Caique como `pessoal` | 65,21% | 575 |
| + blocos A, C e D | 71,94% | 287 |
| + 4 pares do Felipe | 73,90% | 279 |
| + 12 regras das decisoes do dono | 87,52% | 256 |
| + varredura final de pares | 88,20% | 248 |
| + 7 regras (motoboy, clientes, fornecedores) | 93,30% | 223 |
| + Bruno, familia e EBANX | **95,51%** | **199** |

## O PORTAO DO PLANO ABRIU: 95,51%

Alcancado em 03/09/2026. R$ 424.857,79 julgados de R$ 444.820,68. Pendente:
R$ 19.962,89 em 199 linhas.

### A correcao do dono sobre o Bruno, e por que ela desfaz meu diagnostico

Eu tinha escrito que os R$ 5.170 do Bruno que sairam e nao voltaram eram **custo**, e
que chamar de repasse esconderia custo atras de categoria neutra. O dono corrigiu:
*"nao e custo pois sei que nao temos essa relacao. pode ter voltado de outra forma.
compro aparelho dele."*

**Ele esta certo e o destino muda.** Bruno e FORNECEDOR: o dinheiro voltou em mercadoria,
nao em Pix. Isso nao e repasse (nao ha par de dinheiro) nem passagem neutra: e
`compra_aparelho` em `empresa`, que e exatamente onde compra de estoque mora. O ponto que
sobrevive da minha analise e so este: **nao podia virar `neutro`**, e nao virou.

| Padrao | Dominio | Categoria | Linhas |
|---|---|---|---|
| `BRUNO DA COSTA AZEVEDO` | `empresa` | `compra_aparelho` nas 4 saidas | 6 |
| `BRENDON DE ALBUQUERQUE BATISTA` | `pessoal` | `familia` nas saidas | 3 |
| `ANDREA LUISE DE ALBUQUERQUE BATISTA` | `pessoal` | `familia` nas saidas | 5 |
| `13.236.697` (EBANX) | `empresa` | (nenhuma) | 12 |

Decisoes do dono: Brendon e Andrea sao **valor dado** (familia); EBANX e a **maquininha
de cartao dele**.

**A armadilha da EBANX, evitada pela previa:** um padrao `EBANX` por NOME casaria **74**
linhas, nao 12. Sessenta e duas delas sao corrida de **UBER** processada pela EBANX, ja
classificadas `pessoal` / `transporte`. A regra por nome marcaria Uber futuro como
`empresa`. A raiz do CNPJ `13.236.697` casa exatamente as 12 transferencias reais.
Quarta vez na sessao que o CNPJ salva de um falso casamento por nome.

Categoria so foi posta nas linhas com o SINAL certo (`compra_aparelho` e `familia` sao
de natureza `saida`), por isso 4 das 6 do Bruno e 3 das 8 da familia. As entradas ficaram
com `dominio` e sem categoria, de proposito.

---

## MAS O F3 TRAVA POR PERIODO, E 4 MESES AINDA REPROVAM

O portao do `PLANO.md` mede a base inteira e abriu. O invariante **F3 mede a JANELA que
a tela mostra**, e ali o quadro e outro:

| Mes | Bruto | Julgado | % | F3 | Falta |
|---|---|---|---|---|---|
| 2026-02 | R$ 63.688,63 | R$ 60.486,97 | 94,97% | **TRAVA** | **R$ 17,23** |
| 2026-03 | R$ 35.319,22 | R$ 32.269,66 | 91,37% | **TRAVA** | R$ 1.283,60 |
| 2026-04 | R$ 82.695,73 | R$ 79.316,78 | 95,91% | ABRE | — |
| 2026-05 | R$ 117.527,86 | R$ 115.067,84 | 97,91% | ABRE | — |
| 2026-06 | R$ 30.571,49 | R$ 26.853,57 | 87,84% | **TRAVA** | R$ 2.189,35 |
| 2026-07 | R$ 43.140,74 | R$ 39.859,28 | 92,39% | **TRAVA** | R$ 1.124,42 |
| 2026-08 | R$ 71.877,01 | R$ 71.003,69 | 98,78% | ABRE | — |

**Fevereiro reprova por R$ 17,23.** Uma linha pequena resolve.

Somando os quatro: **R$ 4.614,60** abrem TODOS os meses, de R$ 19.962,89 pendentes.

### O que resolve cada mes travado

| Mes | Maiores pendentes |
|---|---|
| 02 | `CLAYSON DA COSTA FIGUEIREDO` R$ 590 (3 saidas) · `JOAO VICTOR` R$ 550 · `TUNA PAGAMENTOS` R$ 411,35 · `DLOCAL` R$ 343,52 |
| 03 | `FELIPE NUNES` R$ 900 (2 entradas) · `DLOCAL` R$ 481,68 · `BUS SERVICOS DE AGENDAMENTO` R$ 566,17 nas duas grafias |
| 06 | `JIANSHENG ZHANG` R$ 850 (2 saidas) · `O KALHETAO` (material de construcao) R$ 581 · `ISAAC F DE MORAES` R$ 500 · `FELIPE NUNES` R$ 375 |
| 07 | `VICTOR MAIA DARGAINS` R$ 980 · `RODRIGO ALVES` R$ 630 · `HIAGO SILVA DE ARAUJO` R$ 335 · `FELIPE NUNES` R$ 280 |

`BUS SERVICOS DE AGENDAMENTO S A` e `S.A.` sao a mesma empresa (CNPJ `17.289.475`), ja
anotada no bloco B: uma regra pela raiz pega as duas grafias.

### O motoboy, os clientes e os fornecedores (03/09/2026)

Decisao do dono, com categoria onde o sinal fechava:

| Padrao | Dominio | Categoria | Linhas |
|---|---|---|---|
| `LEANDRO DAMIAO DE SOUZA` | `empresa` | `motoboy` | 18 |
| `CAIO MANHENTE CATARINO LASMAR` | `empresa` | `venda_aparelho` | 1 |
| `MANOELA DE PAIVA PASCHOAL GUIMARAES PESSOA` | `empresa` | `venda_aparelho` | 1 |
| `KATIA KEILLA DE SOUSA` | `empresa` | `venda_aparelho` | 1 |
| `ISABELLA KAROLINA CAMPOS S CAR` | `empresa` | `venda_aparelho` | 1 |
| `DAVI SOBRAL GOMES DE SOUSA` | `empresa` | `compra_aparelho` | 1 |
| `10.573.521` MERCADO PAGO | `empresa` | (nenhuma) | 2 |

25 linhas, 0 conflitos, **0 incoerencia de sinal** nas sete. O CNPJ `10.573.521` pegou
DUAS linhas, nao uma: `MERCADO PAGO INSTITUICAO DE PAGAMENTO LTDA` e `PIX MARKETPLACE`
sao a mesma empresa. Terceira vez que a raiz do CNPJ unifica grafia sozinha.

`MERCADO PAGO` ficou **sem categoria de proposito**: o dono o chamou de fornecedor, mas as
duas linhas sao ENTRADA, e `compra_aparelho` tem natureza `saida`. Carimbar teria
invertido o sinal. O `dominio = empresa` esta certo dos dois jeitos.

---

## O PORTAO ESTA TRAVADO EM R$ 7.840, E A TRAVA E DE DESENHO

Estado: **93,30%**. Faltam **R$ 7.569,90** para os 95%.

O dono declarou `BRUNO DA COSTA AZEVEDO` (R$ 5.710) e a sobra de
`FELIPE NUNES RAMOS PORTELLA` (R$ 2.130) como **repasse**. Somam **R$ 7.840** — mais do
que o suficiente para cruzar o portao. **E nao da para aplicar.**

Nenhuma das linhas pareia:

| Bruno | Felipe (sobra) |
|---|---|
| `-3.500` 19/02 · `+200` 01/04 · `-300` 08/05 | `+600` 19/03 · `+300` 28/03 · `-500` 17/04 |
| `-1.500` 21/05 · `+70` 05/07 · `-140` 05/07 | `+375` 15/06 · `+20` e `+250` 03/07 |
| | `+10` 16/07 · `-25` 02/08 · `-50` 31/08 |

`fin_repasse_marcar` exige entrada e saida com diferenca de ate 5% do maior. Nao ha
nenhum casamento possivel nos dois conjuntos.

### O achado de fundo, que ja apareceu QUATRO vezes hoje

O dono pensa **repasse como TIPO DE RELACAO** ("o Bruno e repasse"). O sistema modela
**repasse como PAR DE TRANSACAO** (esta saida voltou nesta entrada). Os dois modelos
divergiram em Caique, no residuo do Rodrigo, no Bruno e no residuo do Felipe.

E o modelo do sistema esta CERTO, e vale dizer por que: Bruno tem R$ 5.440 saindo contra
R$ 270 entrando. **R$ 5.170 sairam e nunca voltaram.** Isso nao e passagem, e custo. Se
virasse `repasse` (natureza `neutro`), R$ 5.170 de custo real sumiriam de todo total,
que e exatamente o defeito que este mapa denunciou no ALERTA da BR IPHONES.

**Chamar de repasse o que nao voltou esconde custo atras de categoria neutra.**

### As tres saidas, e a escolha e do dono

1. **Dar lado ao residuo** (`empresa` ou `pessoal`). Resolve os R$ 7.840, cruza o portao
   hoje, e mantem o invariante intacto. **Recomendada.**
2. **Deixar pendente.** O portao nao abre, e a semana 3 nao comeca.
3. **Mudar o desenho** para aceitar repasse declarado por relacao, sem par. Derruba a
   unica prova que o mecanismo tem de que o dinheiro voltou. Seria entrega nova, com
   frase propria, e contraria o que a migration de 03/09 acabou de blindar.

### Depois deles, o que resta

| Contraparte | Linhas | Valor | Entradas | Saidas |
|---|---|---|---|---|
| `BRENDON DE ALBUQUERQUE BATISTA` | 3 | R$ 1.500,00 | 2 | 1 |
| `ANDREA LUISE DE ALBUQUERQUE BATISTA` | 3 | R$ 1.350,00 | 1 | 2 |
| `EBANX` | 12 | R$ 1.288,04 | 7 | 5 |
| `DLOCAL` | 8 | R$ 1.268,71 | 8 | 0 |
| `JOAO VICTOR DA CUNHA PINHEIRO` | 7 | R$ 1.100,00 | 4 | 3 |
| `JIANSHENG ZHANG` | 3 | R$ 1.000,00 | 0 | 3 |
| `VICTOR MAIA DARGAINS` | 1 | R$ 980,00 | 1 | 0 |
| `RODRIGO ALVES RODRIGUES` (sobra) | 3 | R$ 730,00 | 1 | 2 |

`EBANX` e `DLOCAL` sao gateways de pagamento internacional: entrada deles e recebimento
de venda, nao receita nova. `BRENDON` e `ANDREA` sao familia.

### As decisoes do dono de 03/09/2026, aplicadas

Ditas em bloco: *"marcas de modas, pessoal. felipe, rodrigo sao repasses. thay e sempre
forn. marcos antonio tbm. ronald foi venda. mf company e forn tambem"*.

| Padrao | Chave | Dominio | Linhas |
|---|---|---|---|
| `45.242.914` C&A MODAS | CNPJ | `pessoal` | 1 |
| `59.418.806` TRACK FIELD | CNPJ | `pessoal` | 1 |
| `42.538.267` NEWFIT | CNPJ | `pessoal` | 1 |
| `43.405.913` FLOR DE CALIA | CNPJ | `pessoal` | 1 |
| `20.775.988` STUDIO 17 | CNPJ | `pessoal` | 1 |
| `03.151.711` MMS BRASIL | CNPJ | `pessoal` | 1 |
| `07.498.155` 40 GRAUS AG. MODELOS | CNPJ | `pessoal` | 1 |
| `49.333.098` MONEY TREE | CNPJ | `pessoal` | 1 |
| `59.837.359` THAY DE OLIVEIRA | CNPJ | `empresa` | 8 |
| `61.816.537` MF COMPANY | CNPJ | `empresa` | 1 |
| `MARCOS ANTONIO LOPES CERQUEIRA` | nome | `empresa` | 1 |
| `RONALD DOS SANTOS SOTO` | nome | `empresa` | 3 |

**Extensao assumida e declarada:** o dono disse "marcas de moda". As TRES agencias
(`MMS BRASIL COMUNICACAO`, `40 GRAUS AGENCIA DE MODELOS`, `MONEY TREE MARKETING DE
INFLUENCIA`) foram para `pessoal` junto, por serem a mesma renda de imagem. Se estiver
errado, sao 3 regras a inverter.

**Sinal a conferir:** `THAY DE OLIVEIRA` e `MF COMPANY` foram declarados fornecedores,
mas o dinheiro vem majoritariamente NA ENTRADA (Thay: R$ 8.373 entrando contra R$ 1.400
saindo; MF Company: 1 entrada de R$ 6.100). Fornecedor que te paga e incomum. O
`dominio = empresa` esta certo de qualquer forma, e por isso NAO foi posta categoria de
compra: `compra_aparelho` numa entrada teria o sinal invertido.

### Felipe e Rodrigo como repasse: o que o mecanismo aceitou

| Contraparte | Pares gravados | Valor | Sobra pedindo dominio |
|---|---|---|---|
| `FELIPE NUNES RAMOS PORTELLA` | 4 (0% de diferenca) | R$ 8.700 | R$ 2.130 em 9 linhas |
| `RODRIGO ALVES RODRIGUES` | 1 (**1,38%**, dentro dos 5%) | R$ 10.070 | R$ 730 em 3 linhas |

O par do Rodrigo so existe pela tolerancia: entraram R$ 5.000 em 13/05 e sairam R$ 5.070
em 16/05. Exato nao havia nenhum.

**A sobra dos dois NAO pode virar `repasse`**: sem o outro lado nao ha par, e `repasse` e
`atribuivel_manual = false` justamente para impedir que se carimbe sem contraparte (a
migration de 03/09 fechou o ultimo furo disso). Dinheiro que saiu e nao voltou nao e
passagem: e custo ou transferencia, e pede lado.

Mais 4 pares vieram de uma varredura geral: `FELIPE ESTEVES RICARDO` R$ 1.000 (42 dias,
as unicas 2 linhas dele), `JOAO VICTOR` R$ 250 e R$ 200, `ANDREA LUISE` R$ 65. Os
estornos da `ADYEN` (R$ 10,99 · R$ 10,98 · R$ 9,99) e do metro (R$ 5) ficaram DE FORA:
reversao bancaria nao e repasse.

---

## A folha de resposta: 9 nomes cruzam o portao

Estado: **88,20%**, faltam **R$ 30.230,39** para os 95%.

| # | Contraparte | Linhas | Valor | Entradas | Saidas | Acumulado |
|---|---|---|---|---|---|---|
| 1 | `BRUNO DA COSTA AZEVEDO` | 6 | R$ 5.710,00 | 2 | 4 | R$ 5.710 |
| 2 | `CAIO MANHENTE CATARINO LASMAR` | 1 | R$ 4.150,00 | 1 | 0 | R$ 9.860 |
| 3 | `MANOELA DE PAIVA PASCHOAL G. PESSOA` | 1 | R$ 3.950,00 | 1 | 0 | R$ 13.810 |
| 4 | `KATIA KEILLA DE SOUSA` | 1 | R$ 3.899,99 | 1 | 0 | R$ 17.710 |
| 5 | `DAVI SOBRAL GOMES DE SOUSA` | 1 | R$ 3.450,00 | 0 | 1 | R$ 21.160 |
| 6 | `MERCADO PAGO INSTITUICAO DE PAGAMENTO` | 1 | R$ 2.590,00 | 1 | 0 | R$ 23.750 |
| 7 | `LEANDRO DAMIAO DE SOUZA` | 18 | R$ 2.369,00 | 0 | 18 | R$ 26.119 |
| 8 | `ISABELLA KAROLINA CAMPOS S CAR` | 1 | R$ 2.250,00 | 1 | 0 | R$ 28.369 |
| 9 | `FELIPE NUNES RAMOS PORTELLA` (sobra) | 9 | R$ 2.130,00 | 6 | 3 | **R$ 30.499** |

**Nove palavras cruzam os 95%.** Seis dos nove sao UMA linha so, entrada unica: quase
certamente venda para cliente. Mas quem diz e ele, nao eu.

Depois deles: `BRENDON` R$ 1.500 · `ANDREA` R$ 1.350 · `EBANX` R$ 1.288 · `DLOCAL`
R$ 1.269 · `JOAO VICTOR` (sobra) R$ 1.100 · `JIANSHENG ZHANG` R$ 1.000 · `VICTOR MAIA`
R$ 980 · `RODRIGO ALVES` (sobra) R$ 730.

**Blocos A, C e D aplicados em 03/09/2026** (autorizacao: *"aplica o que tem pra
aplicar"*), com previa antes e alcance `nao_classificados` nos tres:

| Bloco | Regra | Linhas | Valor |
|---|---|---|---|
| **A** | regra 1 corrigida para a raiz `26.426.950` (era `/0001-76`) | 3 | R$ 11.422,00 |
| **C** | `VINICIUS DE ALBUQUERQUE BATISTA` → `transferencia_interna` | 18 | R$ 8.857,00 |
| **D** | `Compra no débito` (tipo `comeca`) → `pessoal` | 267 | R$ 9.692,49 |

Total exato: **+R$ 29.971,49**, 288 linhas, 0 conflitos. A regra D casa 36,1% da base,
abaixo do teto de 60% do D-e, e as 2 linhas que voce marcou `empresa` (`MAR ESTRELA`)
nao foram tocadas pelo alcance.

**Mais 4 pares de repasse, do `FELIPE NUNES RAMOS PORTELLA`**, todos com
`diferenca_pct` = 0: R$ 3.000 e R$ 1.000 no mesmo dia, R$ 300 e R$ 50 com 2 dias de
distancia. Somam R$ 8.700 e sobram R$ 2.130 dele pedindo dominio.

**`RODRIGO ALVES RODRIGUES` nao tem par nenhum**, apesar do desequilibrio agregado de
1,9%. Segunda confirmacao da licao do Caique: **simetria no agregado nao implica
transacao pareavel.** Os R$ 10.800 dele pedem `dominio`, nao pareamento.

**Como ler.** Cada bloco diz o que eu encontrei, o que proponho, **por que** (a evidencia
medida, nao a minha impressao) e quanto vale. Bloco marcado `VOCE DECIDE` eu nao executo
sozinha: nada no extrato responde a pergunta.

---

## ALERTA — achado que vale mais que o portao

**`transferencia_interna` esta sendo usada em terceiros, e isso tira dinheiro real de
todos os totais.**

A categoria significa "transferencia entre contas SUAS". Ela tem natureza `neutro`,
entao tudo que cai nela sai de **todo** total de resultado, de gasto e de meta. Hoje ela
tem **28 linhas, R$ 24.380,00**, e a maioria nao e voce:

| Contraparte | Linhas | Valor fora dos totais | Entradas | Saidas |
|---|---|---|---|---|
| `BR IPHONES IMPORTACAO LTDA` | 5 | **R$ 15.400,00** | R$ 15.400 | — |
| `BR IPHONES IMP LTDA` | 1 | **R$ 3.400,00** | — | R$ 3.400 |
| `JOAO VICTOR DA CUNHA PINHEIRO` | 10 | R$ 3.050,00 | R$ 1.650 | R$ 1.400 |
| `REINALDO DA COSTA COENTRO NETO` | 8 | R$ 1.830,00 | R$ 1.300 | R$ 530 |
| `RICARDO MEIRELES DE OLIVEIRA` (2 grafias) | 4 | R$ 700,00 | R$ 350 | R$ 350 |

**BR IPHONES e seu maior fornecedor.** R$ 18.800,00 de movimento com ele esta marcado
como transferencia entre contas suas. Movimento interno deveria fechar perto de zero;
este nao fecha: entraram R$ 15.400 e sairam R$ 3.400, um liquido de **R$ 12.000
entrando** que hoje nao aparece em lugar nenhum.

O mesmo CNPJ tem **cinco tratamentos diferentes** na base:

| Categoria | Dominio | Efeito | Linhas | Entradas | Saidas |
|---|---|---|---|---|---|
| (sem categoria) | `empresa` | entra nos totais | 19 | R$ 32.865 | R$ 10.910 |
| `transferencia_interna` | `empresa` | **FORA de todo total** | 6 | R$ 15.400 | R$ 3.400 |
| (sem categoria) | (pendente) | — | 3 | R$ 11.422 | — |
| (sem categoria) | **`pessoal`** | entra nos totais | 1 | — | R$ 220 |
| `venda_aparelho` | `empresa` | entra nos totais | 1 | R$ 479 | — |

Uma linha do seu maior fornecedor esta como `pessoal`.

### Por que isto e mais grave que os 95%

**O portao do F3 conta linha JULGADA, nao linha julgada CERTO.** Categoria neutra conta
como julgada. Entao esses R$ 24.380 ja contam para a cobertura **e** estao fora dos
totais ao mesmo tempo. Da para cruzar os 95%, abrir a Visao Pessoal e ver numero errado,
com o portao verde.

Corrigir isto nao move a cobertura um ponto. Move a **verdade** dos numeros, que e a
razao de a aba existir.

### O que eu recomendo

`transferencia_interna` deveria valer so para conta sua. Para terceiro com dinheiro indo
e voltando, a categoria certa e **`repasse`**, e ela existe justamente porque **exige
par**: prova que o dinheiro voltou, em vez de so afirmar. Hoje a base tem **4 linhas** em
`repasse` contra **28** em `transferencia_interna`.

Foi por isso que a migration de hoje (`fin_regra_salvar` recusando categoria nao
atribuivel a mao) importa: `repasse` so entra pelo fluxo de par, e agora nem por regra
da para furar isso.

**Decisao sua**, e nao e pequena: revisar as 28. Eu nao mexo em linha que voce ja julgou.

### A revisao das 28, feita em 03/09/2026

Casei entrada com saida por valor exato dentro de cada contraparte. Achei **8 pares
legitimos (16 linhas)**, prontos para `fin_repasse_marcar`:

| # | Contraparte | Valor | Saida | Entrada | Distancia |
|---|---|---|---|---|---|
| 1 | `BR IPHONES` | R$ 3.400,00 | 24/08 | 24/08 | mesmo dia |
| 2 | `JOAO VICTOR DA CUNHA PINHEIRO` | R$ 800,00 | 13/08 | 13/08 | mesmo dia |
| 3 | `JOAO VICTOR DA CUNHA PINHEIRO` | R$ 300,00 | 20/08 | 21/08 | 1 dia |
| 4 | `JOAO VICTOR DA CUNHA PINHEIRO` | R$ 200,00 | 24/08 | 24/08 | mesmo dia |
| 5 | `JOAO VICTOR DA CUNHA PINHEIRO` | R$ 100,00 | 18/08 | 06/08 | 12 dias |
| 6 | `RICARDO MEIRELES DE OLIVEIRA` | R$ 300,00 | 01/08 | 08/08 | 7 dias |
| 7 | `RICARDO MEIRELES DE OLIVEIRA` | R$ 50,00 | 13/08 | 13/08 | mesmo dia |
| 8 | `REINALDO DA COSTA COENTRO NETO` | R$ 1.000,00 | 31/07 | 06/08 | 6 dias |

**APLICADO em 03/09/2026, autorizado pelo dono.** Os 8 pares foram gravados por
`fin_repasse_marcar`, **todos com `diferenca_pct` = 0** (par exato, nao aproximado).
`repasse` foi de 4 para **20 linhas** em **10 pares**; `transferencia_interna` caiu de 28
para **13 linhas** (R$ 24.380 para R$ 13.080).

Os R$ 13.080 que ficaram sao, por construcao: R$ 12.000 da BR IPHONES (decisao do dono,
ver abaixo), R$ 600 dos quatro estornos, R$ 250 do Joao Victor e R$ 230 do Reinaldo.

O par 8 e um **achado extra**: a saida de 31/07 esta PENDENTE (sem categoria), fora das
28. Parear resolve a linha julgada e a nao julgada de uma vez.

O par 6 confirma outra identidade: `RICARDO MEIRELES DE OLIVEIRA` e
`51.916.661 RICARDO MEIRELES DE OLIVEIRA` (nome + CNPJ MEI) sao a mesma pessoa, igual ao
seu proprio caso.

**4 linhas sao ESTORNO BANCARIO, nao repasse.** Reinaldo, 18/08: tres saidas de R$ 150 e
duas entradas de R$ 150 descritas `Estorno - Transferência enviada`. O banco desfez a
transferencia; o dinheiro nunca saiu. Marcar como `repasse` diria que passou por alguem, e
nao passou. Efeito no total e zero de qualquer jeito. **Sugiro deixar como estao** e
tratar estorno como assunto separado.

### O que sobra depois dos 8 pares, e e o que importa

| Contraparte | Sobra | O que e |
|---|---|---|
| **`BR IPHONES`** | **+R$ 12.000,00** em 4 entradas | 10/08 R$ 4.000 · 18/08 R$ 3.500 · 21/08 R$ 3.500 · 22/08 R$ 1.000 |
| `JOAO VICTOR` | +R$ 250,00 em 2 entradas | 17/08 R$ 100 · 27/08 R$ 150 |
| `REINALDO` | -R$ 230,00 em 3 saidas | 18/08 R$ 150 · 19/08 R$ 30 · 21/08 R$ 50 |
| `RICARDO MEIRELES` | zero | fecha inteiro nos pares 6 e 7 |

**Os R$ 12.000 da BR IPHONES sao a questao.** Quatro entradas seguidas, sem nenhuma saida
que as explique, vindas do seu maior fornecedor, hoje invisiveis em todo total. Nao e
transferencia interna: transferencia interna fecha. Nao e repasse: nao ha o outro lado.

Pergunta que so voce responde: **esses R$ 12.000 sao devolucao de compra, venda que voce
fez para eles, ou emprestimo?** Cada resposta cai numa categoria diferente e muda o
resultado da loja no mesmo valor.

### DECIDIDO pelo dono em 03/09/2026: fica fora dos totais

Resposta do dono, textual: *"nao e nada relevante. nao precisa entrar em nada."*

Os R$ 12.000 de entradas da BR IPHONES **ficam neutros, fora de todo total**, por decisao
consciente dele depois de o efeito ter sido apresentado com numero. **Assunto encerrado:
nao reabrir**, nem por auditoria, nem por sessao nova, sem que ele peca.

Consequencia que fica registrada, nao como discordancia mas como fato: as linhas seguem
rotuladas `transferencia_interna`, que significa "conta do proprio dono". O rotulo nao
descreve o que elas sao, entao toda varredura futura vai aponta-las de novo. Se ele quiser
calar isso de vez, o caminho e uma categoria neutra com nome honesto (algo como
`nao_operacional`), e ai o rotulo passa a dizer a verdade sem mudar efeito nenhum. Nao e
urgente e nao muda numero.

---

## O achado que organiza tudo: o canal separa os mundos

Cruzei o canal do lancamento contra o que **voce ja julgou**. Nao e inferencia minha, e
repeticao da sua propria decisao:

| Canal | Ja `empresa` | Ja `pessoal` | Leitura |
|---|---|---|---|
| Compra no débito | 2 (R$ 129) | **140** | 98,6% pessoal |
| Pix >= R$ 1.500 | **46** | **0** | 100% empresa |
| Pix < R$ 100 | 4 | 206 | 98,1% pessoal |

O valor do Pix separa os dois mundos quase perfeitamente:

| Faixa do Pix | ja empresa | ja pessoal | % empresa | pendentes | valor pendente |
|---|---|---|---|---|---|
| < 100 | 4 | 206 | 1,9% | 149 | R$ 5.254,75 |
| 100 a 300 | 4 | 31 | 11,4% | 76 | R$ 12.861,53 |
| 300 a 700 | 4 | 7 | 36,4% | 31 | R$ 13.419,42 |
| 700 a 1.500 | 3 | 2 | 60,0% | 18 | R$ 18.608,00 |
| 1.500 a 3.000 | 11 | **0** | 100% | 13 | R$ 28.570,30 |
| >= 3.000 | 35 | **0** | 100% | 21 | R$ 89.716,99 |

**Mas nao existe regra por valor.** `fin_regra` casa TEXTO, nunca numero. Isso e leitura
para priorizar, nao um filtro que da para automatizar. E ha uma armadilha real: das 34
linhas de Pix grande pendentes, **18 (R$ 54.370) sao de contraparte com dinheiro nos dois
sentidos**, ou seja candidatas a repasse, nao a empresa. Carimbar `empresa` por tamanho
erraria essas 18.

---

## A. Conserto: a regra 1 esta estreita demais

**Estado: erro meu, aplicado em 03/09. Vale R$ 11.422,00 (+2,57 pontos).**

A regra 1 usa `26.426.950/0001-76`, o CNPJ **com filial**. A BR IPHONES tem duas:

| CNPJ | Linhas | Valor | Pendentes |
|---|---|---|---|
| `26.426.950/0001` | 25 | R$ 55.774,00 | 0 |
| `26.426.950/0002` | 5 | R$ 18.922,00 | **3 (R$ 11.422,00)** |

Proposta: trocar o padrao da regra 1 para a **raiz** `26.426.950`, sem filial. Pega as
duas filiais e as tres grafias (`BR IPHONES IMPORTACAO LTDA`, `BR IPHONES IMP LTDA`,
`AZEVEDO IMPORTS AND BUSINESS`) hoje e em todo extrato futuro.

**Regra geral que sai daqui: padrao de CNPJ usa a raiz de 8 digitos, nunca a filial.**

Nota de honestidade: essas 3 linhas estavam sendo pegas por acidente pelo padrao bugado
`S IMPORT` (que casava `BR IPHONE`**`S IMPORT`**`ACAO`). Quando corrigi o bug, a cobertura
acidental caiu junto. Foi exatamente a diferenca entre os 57,99% que eu previ e os 55,42%
que sairam.

---

## B. O CNPJ unifica nomes que sao a mesma empresa

**Estado: mecanico, sem julgamento. Chave real, nao apelido.**

O extrato traz a mesma empresa com grafias diferentes. A raiz do CNPJ resolve sem
precisar de decisao:

| Raiz | Nomes que aparecem | Linhas | Valor |
|---|---|---|---|
| `59.837.359` | `THAY DE OLIVEIRA COMERCIO DE BEBIDAS LTDA` · `THAY DE O. C. DE B. LTDA` | 8 | R$ 11.073,00 |
| `10.573.521` | `MERCADO PAGO INSTITUICAO DE PAGAMENTO LTDA` · `PIX MARKETPLACE` | 2 | R$ 2.591,50 |
| `17.289.475` | `BUS SERVICOS DE AGENDAMENTO S A` · `BUS SERVICOS DE AGENDAMENTO S.A.` | 5 | R$ 616,08 |
| `27.486.182` | `VIACAO AGUIA BRANCA S A` · `AGUIA BRANCA` | 4 | R$ 476,96 |

Isto respeita a regra do projeto de **nao unificar fornecedor sozinha**: o que unifica
aqui e o CNPJ, que e chave de verdade, nao a semelhanca do nome.

---

## C. Voce mesmo: dinheiro que nao e gasto nem receita

**Estado: alta confianca, e `VOCE DECIDE` so no rotulo. Vale R$ 8.857,00 (+1,99 pontos).**

| Contraparte | Linhas | Valor | O que e |
|---|---|---|---|
| `VINICIUS DE ALBUQUERQUE BATISTA` | 15 | R$ 7.399,00 | voce, pessoa fisica |
| `40.196.708 VINICIUS DE ALBUQUERQUE BATISTA` | 3 | R$ 1.458,00 | voce, o CNPJ MEI |

Transferencia entre contas suas nao e despesa nem receita. A categoria
`transferencia_interna` tem natureza **neutro**, entao ela conta como julgada **sem voce
escolher lado nenhum** — o mesmo caminho de graca que o RDB usou.

Cuidado que faz diferenca: o saldo dessas 15 linhas e desequilibrado (R$ 709 entrando,
R$ 6.690 saindo). Se parte disso for aporte seu na loja e nao vaivem entre contas, o
rotulo muda. **Confira antes.**

---

## D. As miudezas: o cartao de débito

**Estado: alta confianca, lastreada em 140 decisoes suas. Vale R$ 9.692,49 (+2,18 pontos)
em 267 linhas.**

267 linhas pendentes, **43% de tudo que falta em quantidade e 4,9% em valor**. Todo o
canal e varejo de consumo: padaria (13x), farmacia (6x), supermercado, posto, bar,
barbearia, transporte. Maior linha pendente do canal inteiro: **R$ 380,60**.

Proposta: uma regra sobre o proprio canal, `Compra no débito` → `pessoal`.

**As 2 excecoes que voce mesmo marcou `empresa`, e que provam que a regra nao e perfeita:**

| Data | Valor | Contraparte |
|---|---|---|
| 24/08/2026 | -R$ 20,00 | `MAR ESTRELA MATERIAL D` |
| 24/08/2026 | -R$ 109,00 | `MAR ESTRELA MATERIAL D` |

Material de construcao, e cabe como obra da loja. Duas linhas, R$ 129,00. Se a regra do
canal entrar, ela nao mexe nessas (ja tem dominio), mas mexeria em compras futuras da
mesma loja.

**Detalhe a conferir:** existem quatro linhas pendentes de `ESTRELA MAR DA FREGUES` e
`MAR ESTRELA MATERIAL D` (R$ 226,00) com categoria `moradia` e sem dominio, vindas de uma
regra antiga sua. Sao a mesma loja com duas grafias, e uma esta como obra da loja e a
outra como moradia. Alguem esta errado.

---

## E. O terceiro fluxo: moda, agencia e influencia — `VOCE DECIDE`

**Estado: eu NAO proponho lado. Vale R$ 16.650,30 (+3,74 pontos).**

Existe dinheiro **entrando** de um ramo que nao e venda de aparelho nem consumo pessoal:

| Bloco | Linhas | Valor | Quem |
|---|---|---|---|
| Moda e vestuario | 5 | R$ 10.480,30 | `C&A MODAS S.A.` · `TRACK FIELD CO S A` · `NEWFIT COMERCIO DE ROUPAS A. LTDA.` · `FLOR DE CALIA ... VESTUARIO LTDA` · `STUDIO 17 DECORACAO E MODA LTDA.` |
| Agencia, midia e influencia | 3 | R$ 6.170,00 | `MMS BRASIL COMUNICACAO LTDA` · `40 GRAUS AGENCIA DE MODELOS LTDA` · `MONEY TREE MARKETING DE INFLUENCIA LTDA.` |

Marca de roupa e agencia de modelos **pagando voce** e receita de trabalho de imagem, nao
da revenda Apple. A pergunta que so voce responde: **isso e `empresa` (atividade que voce
conta como negocio) ou `pessoal` (renda sua, fora da loja)?**

Nao proponho lado porque nao ha nada no extrato que responda, e um palpite meu aqui
contamina o invariante 18 exatamente como um default silencioso contaminaria.

---

## F. Os dois sentidos: repasse, medido pela simetria — `VOCE DECIDE quem`

**Estado: eu monto os pares, voce diz quais nomes sao repasse. Vale ate R$ 95.391,86
(+21,44 pontos), o maior bloco de todos.**

14 contrapartes tem dinheiro indo E voltando. O **desequilibrio** (quanto a soma que entra
difere da que sai) e o melhor sinal disponivel: perto de zero indica repasse de verdade;
alto indica relacao comum com um vaivem ocasional.

### F.0 — O grupo do Caique, informado pelo dono em 03/09/2026

**`FS DISTRIB` e `REINALDO DA COSTA COENTRO NETO` sao contas secundarias do
`CAIQUE BARROS DE LIMA`.** Informacao do dono, nao deduzida do extrato. Isso junta tres
entradas da tabela abaixo num relacionamento so:

| Conta | Chave | Linhas | Valor | Entradas | Saidas |
|---|---|---|---|---|---|
| `CAIQUE BARROS DE LIMA` | nome | 32 | R$ 32.980,00 | R$ 11.430 | R$ 21.550 |
| `FS DISTRIB` | CNPJ `54.811.040` | 11 | R$ 9.550,00 | R$ 8.550 | R$ 1.000 |
| `REINALDO DA COSTA COENTRO NETO` | CNPJ `57.141.157` | 9 | R$ 2.830,00 | R$ 1.300 | R$ 1.530 |
| **GRUPO** | | **52** | **R$ 45.360,00** | **R$ 21.280** | **R$ 24.080** |

**A uniao se prova sozinha pela simetria:**

| | Desequilibrio |
|---|---|
| Caique isolado | 30,7% |
| **Grupo unificado** | **6,2%** |

Contas da mesma pessoa fecham entre si. Juntar derrubou o desequilibrio de 30,7% para
6,2%, o que e evidencia de que a uniao esta certa **e** de que a relacao e repasse de
verdade. Isolado, o Caique parecia uma relacao torta; junto, e um vaivem que quase fecha.

O residuo de **R$ 2.800** (saiu mais do que entrou) nao vira repasse: dinheiro que saiu e
nao voltou pede lado, e so voce sabe qual.

Precedente seu, ja na base: 8 das 9 linhas do Reinaldo voce marcou
`transferencia_interna` + `pessoal`. Pelo ALERTA la em cima, a categoria certa para conta
de terceiro e `repasse`, nao `transferencia_interna` — e o pareamento do grupo e a chance
de arrumar isso de uma vez.

**Como parear:** os pares tem que cruzar as tres contas (entrada no Caique casando com
saida na FS, por exemplo). Parear nome a nome perderia justamente o que a uniao revelou.

### F.0.1 — Tentei montar os pares em 03/09 e NAO DA. E conta corrente.

Rodei o casamento por valor exato nas 52 linhas do grupo. Resultado: **11 pares, apenas
R$ 5.450 de R$ 45.360** (12%), e a maioria com 107, 125, 130, 134 e **160 dias** de
distancia, ou seja coincidencia de valor, nao par.

Olhando as linhas, o motivo fica obvio:

| Data | Movimento |
|---|---|
| 10/02 | `+200` e `-1.600` |
| 29/04 | `+3.100`, `+280`, `+220` |
| 08/05 | `+2.000`, `+1.000`, `-1.300`, `-3.000` |
| 21/05 | `+2.000`, `+800`, `-2.800` |

**Os valores nunca se repetem entre ida e volta.** Isso e uma CONTA CORRENTE: dinheiro
circula em valores sempre diferentes e so fecha no agregado, ao longo de 7 meses. Nao e
repasse, que e a mesma quantia saindo e voltando.

`fin_repasse_marcar` exige par 1 para 1 com diferenca de ate 5% do maior. Uma conta
corrente **nao tem como ser expressa nesse mecanismo**, e forcar pares por coincidencia
de valor a 160 dias de distancia seria fabricar prova para atingir um numero.

**Consequencia, dita sem rodeio:** os R$ 45.360 do grupo do Caique **nao vao virar neutro
por pareamento**. Eles pedem `dominio`, e a pergunta que so voce responde e: **o Caique e
socio de operacao da loja (`empresa`) ou relacao pessoal (`pessoal`)?** Uma resposta
resolve 52 linhas e 10,2 pontos de cobertura de uma vez.

Se a relacao for mesmo de socio com conta corrente, o desenho que faltaria e um saldo por
contraparte sobre toda a base (o invariante F4 ja preve isso), nao pareamento. Seria
entrega nova, com frase propria.

### DECIDIDO pelo dono em 03/09/2026: o Caique e `pessoal`

**APLICADO.** 43 linhas (32 do `CAIQUE BARROS DE LIMA` + 11 do `FS DISTRIB`),
**R$ 42.530,00**, de 10/02/2026 a 30/07/2026, marcadas `dominio = pessoal` por
`fin_classificar`. As linhas do Reinaldo ja estavam resolvidas: 8 julgadas por ele antes e
2 agora no par 8.

Zero linha do grupo continua pendente.

Nota para quem auditar depois: como o grupo e conta corrente e nao repasse, o valor entra
inteiro no lado pessoal, **bruto, sem netting**. R$ 21.280 entraram e R$ 24.080 sairam; a
tela mostra a soma dos absolutos (F4: `bruto` e soma de valor absoluto, zero netting), nao
o saldo de R$ 2.800. Isso e o comportamento contratado, nao um defeito.

| Contraparte | Tipo | Linhas | Valor | Entra | Sai | Desequilibrio | Leitura |
|---|---|---|---|---|---|---|---|
| `FELIPE ESTEVES RICARDO` | PF | 2 | R$ 2.000,00 | R$ 1.000 | R$ 1.000 | **0,0%** | par perfeito |
| `ADYEN LATIN AMERICA` | PJ | 6 | R$ 63,92 | R$ 31,96 | R$ 31,96 | **0,0%** | sao estornos, nao repasse |
| `RODRIGO ALVES RODRIGUES` | PF | 5 | R$ 10.800,00 | R$ 5.300 | R$ 5.500 | **1,9%** | repasse muito provavel |
| `FELIPE NUNES RAMOS PORTELLA` | PF | 17 | R$ 10.830,00 | R$ 5.905 | R$ 4.925 | **9,0%** | repasse provavel |
| `JOAO VICTOR DA CUNHA PINHEIRO` | PF | 11 | R$ 2.000,00 | R$ 1.200 | R$ 800 | 20,0% | possivel |
| `CAIQUE BARROS DE LIMA` | PF | 32 | **R$ 32.980,00** | R$ 11.430 | R$ 21.550 | 30,7% | o maior de todos |
| `BRENDON DE ALBUQUERQUE BATISTA` | PF | 3 | R$ 1.500,00 | R$ 350 | R$ 1.150 | 53,3% | familia |
| `ANDREA LUISE DE ALBUQUERQUE BATISTA` | PF | 5 | R$ 1.480,00 | R$ 265 | R$ 1.215 | 64,2% | familia |
| `THAY DE OLIVEIRA COM. DE BEBIDAS` | PJ | 7 | R$ 9.773,00 | R$ 8.373 | R$ 1.400 | 71,3% | provavel cliente |
| `FS DISTRIB` | PJ | 11 | R$ 9.550,00 | R$ 8.550 | R$ 1.000 | 79,1% | provavel cliente |
| `VINICIUS DE ALBUQUERQUE BATISTA` | PF | 15 | R$ 7.399,00 | R$ 709 | R$ 6.690 | 80,8% | **e voce, ver bloco C** |
| `EBANX` | PJ | 12 | R$ 1.288,04 | R$ 1.207 | R$ 81 | 87,4% | gateway |
| `BRUNO DA COSTA AZEVEDO` | PF | 6 | R$ 5.710,00 | R$ 270 | R$ 5.440 | 90,5% | provavel fornecedor |
| `CONCESSAO METROVIARIA DO RIO` | PJ | 3 | R$ 17,90 | R$ 5 | R$ 12,90 | 44,1% | metro, pessoal |

**Aviso do invariante F4:** repasse so existe **em par**, e o par se mede sobre TODA a
base, nunca sobre a janela. Pareamento nao cobre a sobra: em `CAIQUE`, por exemplo, saem
R$ 21.550 e entram R$ 11.430; a diferenca de R$ 10.120 **nao vira repasse** e continua
pedindo dominio. Ou seja, os +21,44 pontos sao o **teto**, nao o resultado.

**O que preciso de voce:** dos 14, quais sao relacao de repasse. Uma palavra por nome.

---

## G. O que sobra sem atalho

Depois de A + C + D + E + F, a conta chega a cerca de **87%**, ainda abaixo dos 95%.

Sobram aproximadamente **R$ 56 mil** numa cauda de ~300 contrapartes, quase todas pessoa
fisica com **uma** transacao e sem nada no texto que diga o lado. Ai nao existe padrao a
encontrar: existe voce olhando linha a linha, do maior para o menor.

Se os 95% se mostrarem caros demais nessa cauda, a conversa honesta nao e afrouxar o
julgamento, e discutir se o portao deve olhar uma **janela** (por exemplo os ultimos 3
meses) em vez da base inteira desde sempre. Isso e mudanca de contrato e decisao sua.

---

## Ordem recomendada, por retorno

| # | Bloco | Esforco | Ganho |
|---|---|---|---|
| 0 | **ALERTA** — revisar as 28 de `transferencia_interna` | 28 linhas | **0 pontos, e o mais importante da lista.** Devolve R$ 24.380 aos totais, R$ 18.800 deles do maior fornecedor |
| 1 | **A** — raiz do CNPJ na regra 1 | 1 edicao | +2,57 pontos |
| 2 | **D** — regra do débito | 1 regra | +2,18 pontos, mata 267 linhas de ruido |
| 3 | **C** — voce mesmo como transferencia interna | 1 regra | +1,99 pontos |
| 4 | **F** — dizer quais dos 14 sao repasse | 14 palavras | ate +21,44 pontos |
| 5 | **E** — decidir o lado da renda de imagem | 1 decisao | +3,74 pontos |
| 6 | **G** — a cauda | ~300 decisoes | +8 pontos |

Os quatro primeiros somam **~34 pontos com 17 decisoes**.

---

## Conferencias que este mapa deixa em aberto

1. `AZEVEDO IMPORTS AND BUSINESS` (20/04/2026, -R$ 3.800) entrou como `empresa` pela regra
   do CNPJ da BR IPHONES. Mesmo CNPJ, mas o nome e outro. Confirma?
2. As 4 linhas de `ESTRELA MAR` / `MAR ESTRELA` com categoria `moradia` e sem dominio,
   enquanto duas linhas da mesma loja estao como `empresa`. Qual das duas esta certa?
3. Tres linhas descritas `Aplicação RDB` carregam categoria `resgate` (11/08, 18/08,
   21/08). Continuam contando como julgadas porque as duas categorias sao neutras, mas o
   rotulo esta trocado.
