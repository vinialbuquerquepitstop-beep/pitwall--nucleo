# Handoff Financeiro v14 — a cauda acabou: 99,86%, e todo mes passa no F3

Data: 03/09/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v13.md`
como topo da linha.

---

## 1. A frase da entrega

**O dono julgou a cauda inteira em bloco, e o gargalo de nao classificado acabou:
99,86% do valor julgado, 2 linhas pendentes, e os NOVE meses passam no portao F3.**

Nao houve tela nova, migration nova nem linha de codigo. A entrega e o DADO,
aplicado pela RPC de producao (`fin_classificar`), com os guard-rails ligados.

| | 03/09 (v13) | 03/09 (agora) |
|---|---|---|
| Cobertura julgada | 95,51% | **99,86%** |
| Valor julgado | R$ 424.857,79 | **R$ 444.190,68** |
| Valor pendente | R$ 19.962,89 | **R$ 630,00** |
| Linhas pendentes | 199 | **2** |
| Meses reprovados no F3 | 4 de 7 | **0 de 9** |

---

## 2. A ordem do dono, na frase dele

> *"valores ainda em abertos sao pequenezas do cotidiano, rodrigo alves de 300 e 330
> foi repasse. coloque tudo que ainda nao foi julgado, em outros (pessoal) e acabe com
> o gargalo de valores nao classificados."*

**A leitura dele estava certa, e foi medida antes de aplicar:** das 198 linhas
pendentes, a mediana era **R$ 50,00**, a media **R$ 95,87** e a MAIOR de todas
**R$ 800,00**. Nao havia nenhum valor grande escondido na cauda.

---

## 3. O que foi aplicado

Duas chamadas de `fin_classificar`, impersonando o dono (`set_config` de
`request.jwt.claims` + `role = authenticated`), ou seja pela mesma porta da tela, com
RLS e validacao de servidor ligadas. Nenhum `UPDATE` direto na tabela.

| Chamada | Linhas | Categoria | Dominio |
|---|---|---|---|
| Saidas (`valor < 0`) | **162** | `outro_pessoal` (Outro (pessoal)) | `pessoal` |
| Entradas (`valor > 0`) | **34** | `outro_pessoal_entrada` (Outra entrada pessoal) | `pessoal` |

**Por que DUAS categorias e nao uma.** O dono disse "outros (pessoal)", que e o
`outro_pessoal`, de natureza `saida`. Por-lo numa entrada faria o proprio
`fin_classificar` devolver o aviso de sinal contrario e faria a Visao somar entrada
dentro de um grupo de gasto. As 34 entradas foram para o gemeo de entrada, mesmo
dominio, mesmo grupo de intencao. As duas chamadas voltaram `aviso: null`.

**As 196 linhas levam carimbo.** Todas gravaram a mesma `observacao`:

```
Varredura de 03/09/2026: cauda miuda julgada em bloco pelo dono como pessoal.
```

Nenhuma delas tinha `observacao` antes (conferido: 0 de 198), entao nada foi
sobrescrito. O carimbo e o que torna esta decisao em bloco auditavel e reversivel
numa consulta so. Sem ele, daqui a tres meses ninguem sabe distinguir o que foi
julgado linha a linha do que entrou na varredura.

**NENHUMA REGRA FOI CRIADA.** Deliberado. Uma regra de varredura classificaria as
importacoes FUTURAS como `pessoal` sozinha, e isso e exatamente o default silencioso
que o Inv. 18 proibe. O julgamento vale para as 196 linhas que existiam hoje; o
extrato de outubro volta a perguntar.

---

## 4. O Rodrigo NAO virou repasse, e o mecanismo esta certo

O dono disse que os R$ 300 e os R$ 330 do `RODRIGO ALVES RODRIGUES` foram repasse.
`fin_repasse_marcar` foi chamada com o par e **recusou**:

```
Par desigual: a diferenca e de 9.09%, acima dos 5% permitidos.
```

Entrada +R$ 300,00 em 10/07/2026 contra saida -R$ 330,00 em 30/07/2026. R$ 30 de
diferenca em 20 dias nao e tarifa nem arredondamento, que e para o que a folga de 5%
existe (esta escrito no comentario da propria funcao).

E o mesmo padrao ja anotado no v13 e na memoria do projeto: **repasse e RELACAO na
cabeca do dono e PAR de transacao no sistema.** O par anterior dele (R$ 5.000 contra
R$ 5.070, 1,38%) passou; este nao passa.

**Consequencia:** as 2 linhas ficaram pendentes de proposito, R$ 630,00. Nao foram
varridas para `pessoal` porque isso contrariaria a instrucao explicita dele, e nao
foram forcadas para `repasse` porque isso seria fabricar par. Elas sao 100% do
pendente que resta.

### O que a frase dele revelou: o gate percentual e o instrumento errado

Perguntado, o dono respondeu: *"rodrigo e sempre repasse. pego emprestado."*

Isso muda o diagnostico. Nao e uma contraparte teimosa, e uma CLASSE de operacao que
o mecanismo nao sabe expressar:

| Emprestimo | Devolucao | Extra | % | Gate de 5% |
|---|---|---|---|---|
| +R$ 5.000 (13/05) | -R$ 5.070 (16/05) | R$ 70 | 1,38% | passou |
| +R$ 300 (10/07) | -R$ 330 (30/07) | R$ 30 | 9,09% | **recusou** |

**A mesma operacao passa quando o valor e grande e reprova quando e pequeno**, porque
a folga de 5% foi calibrada para tarifa de banco e arredondamento, nao para o extra de
um emprestimo, que e mais perto de um valor fixo do que de um percentual. Enquanto
isso nao mudar, todo emprestimo pequeno vai emperrar do mesmo jeito.

### DECIDIDO pelo dono em 03/09/2026: ficam pendentes ate o mecanismo existir

Das tres saidas possiveis (deixar pendente / dizer o lado / construir o `forcar`), ele
escolheu **deixar pendente e construir o mecanismo na proxima entrega**. Nenhum mes
reprova por causa disso (07/2026 fica em 98,54%, acima do teto de 95), e nada falso e
gravado no meio do caminho para ter que ser desfeito depois.

**A entrega que isso vira**, com frase propria: *"o dono marca um par de emprestimo
que o gate recusaria, e a tela declara os R$ 30 de diferenca em vez de esconde-los."*
Escopo: `forcar: true` em `fin_repasse_marcar` nos moldes da decisao D-e, a tela
pedindo confirmacao com o NUMERO (9,09%) nos moldes da D-k, a Visao declarando o
residual do par forcado, assercoes novas na suite, commit unico. **A diferenca residual
NAO precisa de coluna nova**: e derivavel somando os dois lados do `repasse_id`, pelo
invariante 4.

Um item entra na secao 4 do CONTRATO junto, porque a recusa muda de texto quando
existir o `forcar`.

**A linha de -R$ 100,00 do Rodrigo (01/03) NAO tem par nenhum** e foi para `pessoal` na
varredura. Se "sempre repasse" valer para ela tambem, ela nao tem contraparte no
extrato para casar: ou fica onde esta, ou volta a pendente. Nao foi tocada.

---

## 5. O portao F3 abriu em TODOS os meses

Medido pela `fin_cobertura` de producao, mes a mes, teto 95:

| Mes | Julgado | Pendentes |
|---|---|---|
| 01/2026 | 100% | 0 |
| 02/2026 | 100,00% | 0 |
| 03/2026 | 100,00% | 0 |
| 04/2026 | 100,00% | 0 |
| 05/2026 | 100,00% | 0 |
| 06/2026 | 100,00% | 0 |
| **07/2026** | **98,54%** | 2 (o Rodrigo) |
| 08/2026 | 100,00% | 0 |
| 09/2026 | 100% | 0 |

O v13 fechou com 4 dos 7 meses reprovando o F3. Agora **zero reprova**. A tela pode
exibir numero economico em qualquer janela.

Base inteira depois da varredura, por lado:

| Lado | Linhas | Valor bruto |
|---|---|---|
| empresa | 130 | R$ 262.250,33 |
| pessoal | 949 | R$ 120.313,78 |
| neutro | 90 | R$ 96.044,57 |
| **pendente** | **2** | **R$ 630,00** |

(Soma de valor absoluto, sem netting, pelo F4.)

---

## 6. Os gateways, resolvidos pela regra do dono, medindo

Regra dada por ele depois da varredura:

> *"gateways, se tiver valor equivalente repassado a alguma conta do caique, repasse.
> ou eu peguei para mim de cartao meu."*

As 11 entradas de gateway foram cruzadas contra TODAS as saidas para contas do grupo do
Caique (`CAIQUE BARROS DE LIMA`, `FS DISTRIB`, `57.141.157 REINALDO DA COSTA COENTRO
NETO`), com o mesmo criterio de 5% que a RPC usa.

| Entrada | Saida para conta do Caique | Dif | Dias | Veredito |
|---|---|---|---|---|
| `DLOCAL` +299,57 (21/04) | `FS DISTRIB` -300,00 (22/04) | **0,14%** | **1** | **repasse, aplicado** |
| `DLOCAL` +50,12 (26/04) | `REINALDO` -50,00 (21/08) | 0,24% | **117** | recusado |
| outras 6 do `DLOCAL` (R$ 919,02) | nenhuma | | | cartao dele, fica `pessoal` |
| 3 do `ADYEN` (R$ 31,96) | nenhuma | | | cartao dele, fica `pessoal` |

**O de 117 dias foi recusado de proposito.** E a mesma armadilha que o
`mapa_pendentes_20260903.md` ja tinha nomeado no grupo do Caique: casar por valor a
quatro meses de distancia e coincidencia, nao par, e forcar isso seria fabricar prova.
O criterio de 5% sozinho nao basta; a distancia em dias tambem julga.

**Aplicado:** `fin_repasse_marcar` criou o par `53811fe3-f30e-474a-8331-38a62e1c6238`,
e depois `fin_classificar` limpou o `dominio` das duas linhas para `null`, que e a
convencao do modulo: dinheiro de terceiro nao tem lado. As duas levam `observacao`
propria explicando o par. Isso tirou R$ 599,57 do lado pessoal e pos em neutro.

**Nota sobre o `ADYEN`:** as 6 linhas dele sao 3 pares perfeitos de estorno no MESMO
dia (14/08) com valor exato (+9,99/-9,99, +10,98/-10,98, +10,99/-10,99). Cancelam-se
dentro do pessoal e somam zero. Ficaram como estao: virar `repasse` seria chamar
estorno de dinheiro de terceiro, que nao e.

---

## 7. Como desfazer tudo, se der errado

A varredura inteira e uma consulta:

```sql
select * from fin_movimento
 where observacao = 'Varredura de 03/09/2026: cauda miuda julgada em bloco pelo dono como pessoal.';
```

196 linhas. Trocar o `select *` pela chamada de `fin_classificar` com
`"dominio": null` devolve a base ao estado de antes. Foi para isso que o carimbo
existe.

---

## 8. O que continua aberto

| # | Item | Nota |
|---|---|---|
| 1 | **Os R$ 630 do Rodrigo, e a proxima entrega** | Secao 4. **Decidido em 03/09: ficam pendentes ate o `forcar` existir.** Nada e gravado errado no meio do caminho |
| 2 | ~~Gateways~~ | **FECHADO.** Secao 6: 1 par virou repasse, os outros 10 sao cartao dele e ficam `pessoal` |
| 3 | O dono NUNCA ABRIU A ABA depois disso tudo | A base foi de 18,55% a 99,86% em um dia, e ele nao viu a tela uma vez. Continua sendo o primeiro movimento |
| 4 | 4 linhas `ESTRELA MAR` / `MAR ESTRELA` com `moradia` e sem dominio | Herdado do v13. **Nota: agora foram varridas para `pessoal`**, entao a duvida deixou de travar cobertura mas continua sendo grafia dupla da mesma loja |
| 5 | 3 linhas `Aplicação RDB` rotuladas `resgate` | Cosmetico, herdado do v13 |
| 6 | Escrita de volta no Notion | Bloqueio antigo do v33, capability "Update content" |

---

## 9. Primeiro movimento do proximo chat

**Abrir a aba Financeiro e olhar.** Nao ha mais desculpa de base incompleta: os nove
meses passam no F3, entao a tela finalmente mostra NUMERO em vez da faixa de recusa.
Isso nunca foi visto por ninguem.

Depois, a entrega do `forcar` no repasse, descrita na secao 4: e a unica coisa que
ainda separa a base dos 100%, e resolve todo emprestimo pequeno futuro, nao so os
R$ 630 do Rodrigo.

**So entao a semana 3 do `PLANO.md`** (Visao Pessoal, graficos, Agente 1).
