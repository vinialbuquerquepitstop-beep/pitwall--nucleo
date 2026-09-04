# Plano de solucao integral do Financeiro — 04/09/2026

Escrito depois do `P-AUDITA` de 04/09 (prompt em `prompt_auditoria_20260904.md`), que
rodou em sessao separada e reprovou o fechamento do bloco 2.

Este plano fecha **tudo o que a auditoria deixou aberto** e termina numa revisao final
independente. Ele nao inventa escopo novo: cada entrega mata um item de uma lista que
ja existe.

Irmao de `PLANO.md` (mestre) e de `plano_categorias_20260903.md` (a sessao auditada).
Nao substitui nenhum dos dois.

---

## 0. O que este plano fecha

**Nove defeitos visiveis** apurados pela auditoria, mais **tres RPCs do bloco 2 do
`PLANO.md`** que nunca existiram.

| # | Item | Fecha em |
|---|---|---|
| 1 | regra `Compra no débito` carimba `dominio` sozinha, 175 contrapartes | E2 |
| 2 | portao 6.3: tres saldos mudaram sem nota na tela | E1 |
| 3 | `ini_anterior` / `fim_anterior` orfaos: `delta_pct` sem janela declarada | E3 |
| 4 | Dashboard e Financeiro filtram por datas diferentes | E9 |
| 5 | R$ 15.597,31 sem categoria, 221 linhas | E4 cobra, o dono fecha |
| 6 | `MF COMPANY LTDA` R$ 6.100,00 | trabalho do dono na tela |
| 7 | `BRUNO DA COSTA AZEVEDO` R$ 270,00 | trabalho do dono na tela |
| 8 | Rodrigo Alves R$ 630,00: par desigual sem `forcar` | E8 |
| 9 | a prioridade da regra nao tem assercao | E2 |
| — | `fin_movimento_arquivar` (P-R3) | E5 |
| — | `fin_categoria_salvar` (P-R4) | E6 |
| — | `fin_conferir_saldo` (P-R6) | E7 |

Nove entregas, uma por sessao, na ordem abaixo. O portao do bloco 3 do `PLANO.md` e
**DEFEITOS VISIVEIS = 0**: e ele que este plano existe para abrir.

---

## 1. Gate 0 — as cinco decisoes do dono

Nenhuma delas e de codigo. Nenhuma delas a Torre pode tomar. Tres travam entregas, duas
sao trabalho de tela. **Ate a D-s ser respondida, E2 nao tem forma.**

> **RESPONDIDAS EM 04/09/2026, pelo dono, no chat:**
> **D-s = A** — a regra `Compra no débito` perde o `dominio` e as 214 linhas voltam
> para a fila. Custo aceito de forma consciente: marco vai a 91,77% e apaga os numeros
> economicos ate serem julgadas 50 linhas, R$ 2.906,94.
> **D-t = A** — a divida do portao 6.3 se paga: E1 sobe a nota na tela.
> D-u, D-v e D-w seguem abertas. Nenhuma das tres trava E1 ou E2.

### D-s — a regra `Compra no débito` (trava E2)

Medido: `tipo comeca`, `dominio pessoal`, `categoria NULL`, prioridade 9000, aplicada
267 vezes, alcanca **175 contrapartes distintas**, deixa **214 linhas** hoje com lado
definido e sem categoria. Criada em 02/09/2026 23:16:53 pela sessao, usando a
credencial do dono, nao digitada por ele.

O Inv. 18 diz que `dominio` nunca tem default silencioso. O F2 diz que contraparte nova
sai com `dominio` nulo, sempre. Uma regra `comeca` sobre toda compra no debito e um
default, e prioridade 9000 nao muda isso: torna o default o ultimo a falar, que e
exatamente a definicao dele.

| | Saida | Custo medido |
|---|---|---|
| **A** | a regra **perde o `dominio`** e vira so classificadora. As 214 linhas voltam para a fila | marco cai de 100% para **91,77%** e apaga os numeros economicos ate ser julgado. Os outros seis meses ficam entre 96,06% e 99,56%, todos acima do F3. Total a julgar: 214 linhas, R$ 8.207,31, das quais R$ 2.906,94 em 50 linhas de marco sao o que trava tela |
| **B** | a regra **para so daqui para frente**: o passado ja julgado fica, o `dominio` sai da regra | zero mudanca de tela hoje. O passado continua com um lado que ninguem afirmou |
| **C** | o dono **assume a regra por escrito** como decisao consciente contra o Inv. 18 | zero custo hoje, e o Inv. 18 passa a ter uma excecao nomeada, que e o comeco do fim dele |

**Recomendo A:** o custo e um mes de tela e R$ 2.906,94 em 50 linhas, e e o unico caminho
em que o numero na tela volta a ser algo que o dono afirmou.

### D-t — a divida do portao 6.3 (trava E1)

Tres saldos mudaram em 03/09 e nenhuma nota subiu: fev 3.872,09 -> 1.999,09, mar
3.864,20 -> 1.864,20, mai 5.635,02 -> 1.235,02. A auditoria confirmou pela `fin_painel`
de producao e pela `auditoria` append-only: 8 linhas da Thay foram de `empresa` para
`pessoal`, liquido R$ 8.273,00, que e exatamente a soma dos tres deltas.

A excecao 6.3.1 nao cobre: tres das quatro condicoes falham.

| | Saida |
|---|---|
| **A** | **pagar**: E1 sobe a nota na tela |
| **B** | **dispensar** por decisao consciente, registrada no handoff |

**Recomendo A**, e por um motivo que nao e o 6.3: E1 constroi o mecanismo de nota que
E2 vai reusar. Dispensar aqui obriga a construi-lo depois, no meio de uma entrega maior.

### D-u — `MF COMPANY LTDA`, R$ 6.100,00 em 17/04

Uma entrada, sem saida para o CNPJ em sete meses. Declarado fornecedor. Carrega o mesmo
sinal que denunciou a Thay. **Se for pessoal, abril vai de +1.238,68 para −4.861,32**, o
unico mes negativo da base. `empresa` ou `pessoal`, uma palavra.

### D-v — `BRUNO DA COSTA AZEVEDO`, R$ 270,00 em 2 entradas

Fornecedor com dinheiro entrando. `empresa`, `pessoal` ou repasse.

### D-w — Rodrigo Alves, R$ 630,00 (trava E8)

Par de repasse desigual acima dos 5%. Ou o par se forca (e E8 constroi o `forcar`), ou
as duas linhas ficam sem dominio para sempre e o F3 as carrega.

---

## 2. A ordem, e por que ela e essa

1. **E1 antes de E2** porque E1 constroi o mecanismo de nota que E2 precisa. E2 muda
   numero na tela e cai no 6.3 igual: construir a nota uma vez, usar duas.
2. **E2 antes de tudo o mais** porque e a unica **fabrica ativa** da lista. Os outros
   oito defeitos sao divida parada; esse cresce a cada extrato importado. Foi
   exatamente esse raciocinio que o v17 usou para a categoria, e ele vale de novo.
3. **E3 e E4 antes das RPCs** porque sao as duas que fazem a tela parar de omitir: uma
   declara a janela de comparacao, a outra cobra a categoria que falta. Sao baratas e
   nao dependem de decisao nenhuma.
4. **E5, E6 e E7 juntas no meio** porque sao o bloco 2 do `PLANO.md` e so elas fecham
   ele. Nenhuma depende das outras.
5. **E8 e E9 por ultimo** porque sao os dois defeitos que hoje nao erram numero nenhum:
   o do Rodrigo esta parado ha semanas e o do Dashboard e latente.

---

## 3. As nove entregas

Cada uma: `P-ABRE` -> a entrega -> `P-FECHA`. Uma por sessao, nunca duas.

### E1 — a tela diz por que fevereiro, marco e maio encolheram

**Frase:** *o saldo que mudou traz na tela a explicacao de por que mudou.*

Entra:
- mecanismo generico de **nota de mudanca de numero**: um registro com mes, valor antes,
  valor depois, causa em uma frase, e a data da mudanca;
- a nota dos tres meses da Thay, com os numeros medidos pela RPC de producao;
- a nota aparece **colada no numero**, nao numa aba de historico;
- assercao `fin6:` que prova que o numero e a nota nao se separam.

Nao entra: reverter a decisao da Thay, tocar em `dominio` de qualquer contraparte,
qualquer outro mes.

Portao proprio: rodar `fin_painel` como dono antes e depois e provar que **nenhum saldo
mudou nesta entrega**. E1 explica numero passado, nao produz numero novo.

Depende de: **D-t = A**.

### E2 — nenhuma regra julga sozinha

**Frase:** *nenhuma regra grava `dominio` para contraparte que o dono nunca julgou, e a
tela mostra quantas linhas voltaram para a fila.*

Entra:
- a saida escolhida na **D-s**;
- defesa no servidor em `fin_regra_salvar`: regra que grava `dominio` sem `categoria` e
  cujo padrao nao nomeia uma contraparte e **recusada**, com recusa nomeada nova na
  secao 4 do CONTRATO;
- a tela declara quantas linhas voltaram para a fila e quanto valem, com atalho para
  Movimentos filtrado e ordenado por valor;
- se a saida for A, a nota do E1 sobe junto para os meses que mudarem;
- assercoes `fin6:`: a prioridade 9000 fica fixada, e a recusa nova fica provada.

Nao entra: mexer nas outras 57 regras, criar categoria nova, julgar linha nenhuma.

Custo declarado, medido: marco vai a 91,77% e apaga numero economico ate ser julgado.
**Isso e a entrega funcionando, nao um defeito dela.**

Depende de: **D-s**, e de E1 se D-s = A.

Nota sobre a defesa existente: `fin_regra_salvar` ja recusa padrao que casa acima de 60%
da base (D-e). `Compra no débito` casou 267 de 1.132, 23,6%, e passou legitimamente. A
defesa de hoje mede **largura**, nao mede se a regra afirma um lado sem ter quem o
afirme. E o buraco que E2 fecha.

### E3 — todo delta diz contra o que compara

**Frase:** *todo numero de variacao na tela declara a janela contra a qual compara.*

Entra:
- `ini_anterior` e `fim_anterior` ganham leitor em `public/app.js` (hoje: 0 ocorrencias,
  orfaos desde a fatia 1 de 26/08, carregados por 9 migrations);
- todo `delta_pct` e `delta_pct_lucro` passa a exibir `vs. de X a Y`;
- o caso `null` continua escrevendo `novo` (D-n), e a janela `Tudo` continua dizendo que
  nao tem periodo anterior;
- assercao `fin6:` de campo orfao zero.

Nao entra: mudar o calculo do delta, mudar `D-m` (a janela para em hoje no mes corrente).

So frontend. Zero migration.

### E4 — a tela cobra a categoria que falta

**Frase:** *a tela mostra as duas coberturas, e a de categoria cobra sem bloquear.*

E a proposta registrada e nao aplicada do v17 secao 5.

Entra:
- `fin_cobertura` passa a devolver tambem a cobertura de **categoria**;
- a tela exibe as duas lado a lado: `dominio` trava pelo F3, `categoria` **cobra**;
- o numero de hoje: R$ 15.597,31 em 221 linhas (216 pessoal / 3 empresa / 2 sem dominio);
- assercoes `fin6:` provando que a de categoria **nao** bloqueia numero economico.

Nao entra: fazer a categoria travar a tela. Saldo, lucro e caixa nao dependem dela.

### E5 — movimento errado sai da conta sem sumir do historico (P-R3)

**Frase:** *o lancamento errado sai dos totais e continua no historico, dizendo quem o
tirou e quando.*

`fin_movimento_arquivar`, soft delete por `arquivado_em` (Inv. 9), botao na linha de
Movimentos, o arquivado visivel sob filtro proprio, assercoes `fin6:`.

### E6 — categoria nova nasce na tela (P-R4)

**Frase:** *o dono cria categoria pela tela, sem migration.*

`fin_categoria_salvar`, respeitando Inv. 12 (`codigo` imutavel e chave, `rotulo`
editavel), C5 (grupo desconhecido cai em hash deterministico do `codigo`, zero token de
cor novo) e `atribuivel_manual`. Assercoes `fin6:`.

Cobre a divida declarada em `plano_categorias_20260903.md` secao 8: pet e academia nao
tinham casa obvia e foram para `outro_pessoal` e `saude` por falta de ferramenta.

### E7 — a importacao fecha com o saldo do banco (P-R6)

**Frase:** *a tela diz se o que foi importado bate com o saldo do extrato, e de quanto e
a diferenca.*

`fin_conferir_saldo`, o alerta 6 do `PLANO.md` secao 5 (dispara acima de R$ 1,00),
assercoes `fin6:`.

### E8 — o par desigual pode ser forcado, com o numero na cara

**Frase:** *o par de repasse acima dos 5% se fecha por decisao explicita, e a tela
registra que foi forcado.*

Entra: `forcar: true` em `fin_repasse_marcar`, no molde do D-e (a tela **nunca** forca
sozinha, o dono confirma com o numero: `Par desigual: a diferenca e de X%`), o par do
Rodrigo Alves de R$ 630,00 fechado, marca visivel de "forcado" na linha, assercoes
`fin6:`.

Depende de: **D-w**.

### E9 — Dashboard e Financeiro declaram a data que usam

**Frase:** *cada tela diz por qual data esta contando, e as duas param de parecer
iguais por acaso.*

O Dashboard conta por `data_contato` do lead; o Financeiro por `data_venda`. Hoje batem
porque as 10 vendas tem contato e venda no mesmo mes. O primeiro lead que atravessar a
virada faz as duas discordarem sem erro e sem aviso.

Provavelmente conserto de **rotulo**, nao de conta: cada tela declara sua data. Se a
medicao na hora mostrar que e conta, E9 vira duas entregas e o dono decide qual data
manda.

---

## 4. O trabalho que e do dono na tela, nao entrega de codigo

Nao ocupa sessao. Sao cliques na aba Movimentos, e o Inv. 18 diz que so ele pode faze-los.

| O que | Tamanho |
|---|---|
| **D-u**, `MF COMPANY` | 1 linha, R$ 6.100,00. Muda o sinal de abril |
| **D-v**, `BRUNO` | 2 linhas, R$ 270,00 |
| depois de E2, se D-s = A: as **50 linhas de marco** | R$ 2.906,94. E o que devolve a tela de marco |
| depois de E2, o resto da fila | 164 linhas, R$ 5.300,37, media R$ 32. **Nao urgente:** nenhuma delas sozinha trava um mes |

A cauda pessoal de 218 linhas e R$ 9.227,31, media R$ 42, **continua declarada como coisa
que nao se julga** (`plano_categorias_20260903.md` secao 6). Nao entra em lista de
pendencia e nao e defeito.

---

## 5. A revisao final

Depois de E9, e so depois, em **sessao nova**, que nao tenha construido nada:

1. `P-AUDITA` completo, checklist da secao 7 do CONTRATO pergunta por pergunta, com a
   mesma exigencia desta rodada: sem evidencia, o item reprova.
2. O **medidor semanal** do `PLANO.md` secao 9, os tres numeros:

| Numero | Alvo |
|---|---|
| % do valor bruto julgado | >= 95% em **todos** os meses, medido por mes, nao na base inteira |
| defeitos visiveis abertos | **0** |
| divergencia git x banco | **0**, casada por md5 do corpo, nunca por nome |

3. Atualizar o inventario da secao 1 do CONTRATO, que a auditoria mediu desatualizado em
   quatro linhas: RPCs publicas 11 -> 14, categorias ativas 33 -> 34, assercoes do
   Financeiro 223 -> 301, helpers privadas 5 -> 8. E atualizar o `CLAUDE.md`, que diz
   1037/1042 e mede hoje **1087/1092**.
4. So entao o bloco 3 do `PLANO.md` comeca.

---

## 6. O que este plano NAO faz, declarado

- **Nao comeca o bloco 3.** A Visao Pessoal, os agentes, meta e provisao ficam onde
  estao ate o portao abrir.
- **Nao infere `dominio` de contraparte nenhuma**, em nenhuma entrega, nem como exemplo.
- **Nao mexe na cauda pessoal** de R$ 9.227,31.
- **Nao reabre a excecao 6.3.1.** Ela pegou quem a escreveu, no mesmo dia, e isso e
  argumento para mante-la como esta.
- **Nao corrige `CONTRATO.md` nem `PLANO.md` no meio do caminho.** O inventario
  desatualizado e trabalho da revisao final, com os numeros ja medidos.
- **Nao promete prazo.** Nove entregas sao orcamento, nao calendario. Se a aba parar de
  ser aberta, o escopo congela onde estiver, que e o risco 4 do `PLANO.md`.

---

## 7. Primeiro movimento

Responder **D-s** e **D-t**. Duas frases. Sem elas, E1 nao tem portao de saida e E2 nao
tem forma.

Depois: `P-ABRE` · **E1** · `P-FECHA`.
