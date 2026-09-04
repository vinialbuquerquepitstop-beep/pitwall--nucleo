# Plano para fechar as CATEGORIAS — 03/09/2026

Irmao do `mapa_pendentes_20260903.md`. Aquele fechou o **`dominio`** (99,86%). Este
fecha a **`categoria`**, que e outro buraco, foi medido depois e ninguem tinha visto.

---

## 0. Por que ninguem viu, e a correcao de portao que sai daqui

**A cobertura que perseguimos o dia inteiro mede `dominio`, nao `categoria`.**

`fin_cobertura` chama de julgado o que tem `dominio` preenchido OU categoria neutra. Um
lancamento com lado definido e **sem categoria nenhuma** conta como julgado, passa no
portao F3 e sobe para a tela. La ele cai inteiro no bloco cinza `Sem categoria`.

Resultado medido: **99,86% de cobertura e R$ 207.810,29 sem categoria.** O portao verde
e o buraco convivendo, exatamente como o `transferencia_interna` em terceiro convivia
com o F3 verde em 02/09.

**Proposta de portao (decisao do dono, nao aplicada):** a tela passa a exibir DUAS
coberturas lado a lado, `dominio` e `categoria`, porque elas respondem perguntas
diferentes:

- cobertura de **dominio** responde *"esse dinheiro e da loja ou meu?"* — e o Inv. 18;
- cobertura de **categoria** responde *"em que eu gastei?"* — e a unica pergunta que
  sobra depois que o saldo esta certo.

Nao proponho que a categoria trave a tela como o F3 trava (95%): o saldo, o lucro e o
caixa nao dependem dela. Ela deve **cobrar**, nao **bloquear**.

---

## 1. O tamanho, medido em 03/09/2026

| Lado | Linhas | Valor | Contrapartes |
|---|---|---|---|
| **empresa** | **51** | **R$ 130.123,34** | **19** |
| pessoal | 431 | R$ 77.686,95 | 188 |
| sem dominio | 2 | R$ 630,00 | 1 (o Rodrigo, ja decidido) |

**O lado da empresa e o que importa e e o mais barato: R$ 130 mil em 19 nomes e 51
linhas.** O lado pessoal tem 8x mais linhas e vale 60% do valor.

Por isso a ordem deste plano NAO e por valor: e empresa primeiro, inteiro, depois
pessoal.

---

## 2. BLOCO A — fornecedores. 9 nomes, 16 linhas, R$ 65.750,80

Todas SAIDAS, todas com nome de loja ou importadora. Destino: `compra_aparelho`.

| Contraparte | Linhas | Valor |
|---|---|---|
| `ASTERION B2C LTDA` | 4 | R$ 16.165,00 |
| `CROSS INTERMEDIACAO LTDA` | 3 | R$ 10.400,00 |
| `MARCOS ANTONIO LOPES CERQUEIRA` | 1 | R$ 9.400,00 |
| `P&S ELETRONICOS` | 2 | R$ 7.450,00 |
| `BALDEZ STORE` | 1 | R$ 6.950,00 |
| `S IMPORT` | 1 | R$ 4.800,00 |
| `GUINA ELETRONICOS` | 1 | R$ 3.635,80 |
| `REI DO AI FONE` | 1 | R$ 3.600,00 |
| `LBR IMPORTADOS` | 1 | R$ 3.350,00 |

**Confianca alta**, mas o dono confirma em bloco antes de aplicar: `ASTERION` ja e
fornecedor provado (casou com a VENDA-0005 em agosto) e `MARCOS ANTONIO` ja foi
declarado empresa por ele em 03/09.

**ARMADILHA REGISTRADA:** `S IMPORT` como padrao de regra casou **23 lancamentos em vez
de 1** numa sessao anterior. Usar CNPJ, nunca o nome curto. Vale para qualquer nome de
duas letras ou palavra comum.

---

## 3. BLOCO B — recebimentos. 5 nomes, R$ 27.040,00

Todas ENTRADAS. Destino: `venda_aparelho`, com uma excecao a decidir.

| Contraparte | Linhas | Valor | Nota |
|---|---|---|---|
| `LUCAS DA SILVA DOS SANTOS` | 2 | R$ 9.750,00 | **e o cliente da VENDA-0001** (15 Pro Max, 22/07) |
| `RONALD DOS SANTOS SOTO` | 3 | R$ 7.300,00 | o dono ja disse "ronald foi venda" |
| `MF COMPANY LTDA` | 1 | R$ 6.100,00 | declarado fornecedor, mas o dinheiro ENTRA |
| `MERCADO PAGO` | 1 | R$ 2.590,00 | gateway, mesmo caso do BR |
| `THAY DE O. C. DE B. LTDA` | 1 | R$ 1.300,00 | segunda grafia da Thay do bloco C |

**`MF COMPANY` e o unico que nao fecha:** foi declarado fornecedor e so tem entrada.
Fornecedor que te paga e incomum, e ja estava anotado como sinal a conferir no
`mapa_pendentes`. Nao aplicar sem uma palavra do dono.

---

## 4. BLOCO C — os que so o dono resolve. 5 nomes, R$ 37.332,54

| Contraparte | Linhas | Valor | Entra | Sai | A pergunta |
|---|---|---|---|---|---|
| **`RODRIGO ALMEIDA DA ROCHA`** | 6 | **R$ 26.000,00** | 5 | 1 | **o maior item aberto do Financeiro.** Nao confundir com `RODRIGO ALVES RODRIGUES`, que e o do emprestimo |
| `THAY DE OLIVEIRA COM. DE BEBIDAS` | 7 | R$ 9.773,00 | 4 | 3 | declarada fornecedora, mas entram R$ 8.373 e saem R$ 1.400 |
| `EBANX` | 12 | R$ 1.288,04 | 7 | 5 | gateway. Entrada e recebimento de venda? Mesmo tratamento do BR? |
| `BRUNO DA COSTA AZEVEDO` | 2 | R$ 270,00 | 2 | 0 | e fornecedor, mas essas duas ENTRAM |
| `PIX MARKETPLACE` | 1 | R$ 1,50 | 0 | 1 | taxa. Cosmetico |

**`RODRIGO ALMEIDA DA ROCHA` sozinho vale 20% do buraco da empresa.** Cinco entradas e
uma saida, de 16/02 a 17/06. Uma frase dele resolve R$ 26 mil.

---

## 5. BLOCO D — pessoal por Pix. 101 linhas, R$ 41.481,94, so 14 contrapartes

Concentradissimo, e a maior parte ja tem decisao tomada:

| Contraparte | Linhas | Valor | Situacao |
|---|---|---|---|
| `CAIQUE BARROS DE LIMA` | 32 | R$ 32.980,00 | conta corrente, ja decidido `pessoal` em 03/09 |
| `FS DISTRIB` | 10 | R$ 9.250,00 | conta do Caique, mesma decisao |

**Esses dois sao 87% do bloco e ja tem `dominio`.** Falta so a categoria, e como e conta
corrente entre pessoas, `outro_pessoal` / `outro_pessoal_entrada` e o destino honesto:
nao existe categoria melhor e inventar uma seria afirmar mais do que se sabe.

Os outros blocos de moda e agencia (`MMS BRASIL` R$ 5.200, `C&A` R$ 3.200,
`TRACK FIELD` R$ 2.800, `NEWFIT` R$ 2.400, `FLOR DE CALIA` R$ 1.630,30) sao a renda de
imagem, ja decidida `pessoal`: destino `outro_pessoal_entrada`.

---

## 6. BLOCO E — pessoal no debito. 310 linhas, R$ 13.575,01, 171 contrapartes

**A cauda de verdade: 72% das linhas e 6,5% do valor. Media de R$ 43,79 por lancamento.**

Aqui NAO se julga linha a linha. Aqui se escrevem regras por padrao, e ~10 regras
cobrem a maior parte:

| Padrao | Linhas | Valor | Destino |
|---|---|---|---|
| `IFOOD` | 31 | R$ 2.939,04 | `alimentacao_fora` |
| `99 TECNOLOGIA` | 32 | R$ 1.186,45 | `transporte` |
| `SUPERMERCADOS VIANENSE` | 11 | R$ 612,13 | `mercado` |
| `AUTO POSTO` / `POSTO ANJO` | 18 | R$ 622,08 | `transporte` |
| `PANIFICACAO` / `PADARIA` | 18 | R$ 481,90 | `alimentacao_fora` |
| `HIPERPET` | 6 | R$ 625,61 | decisao do dono: nao existe categoria de pet |
| `SMARTFIT` | 4 | R$ 619,20 | `saude` ou `lazer`, decisao do dono |
| `FARMACIAS` / `DROGARIAS` | 10 | R$ 392,63 | `saude` |
| `PEDRAMERCADIN` | 4 | R$ 254,00 | `mercado` |
| `MAIS.MOBI` | 8 | R$ 102,70 | `transporte` |

Isso e **142 linhas com 10 regras**. Sobram ~168 linhas somando ~R$ 6 mil, com media de
R$ 36, em contraparte que aparece uma vez so.

**Recomendacao explicita para a sobra: NAO julgar.** R$ 6 mil pulverizados em 168
padarias e estacionamentos nao respondem nenhuma pergunta de negocio, e o custo de
julgar e maior que o valor da resposta. Ela fica como `outro_pessoal`, que e uma
resposta honesta: gasto pessoal miudo.

---

## 7. Ordem recomendada, por retorno

| # | Bloco | Esforco do dono | Fecha |
|---|---|---|---|
| 1 | **C** — 4 perguntas (Rodrigo Almeida, Thay, EBANX, Bruno) | 4 frases | **R$ 37.332,54** |
| 2 | **A** — confirmar 9 fornecedores em bloco | 1 sim | R$ 65.750,80 |
| 3 | **B** — confirmar 5 recebimentos, com a duvida do MF Company | 1 sim + 1 frase | R$ 27.040,00 |
| 4 | **D** — aplicar categoria no que ja tem dominio decidido | 0 | R$ 41.481,94 |
| 5 | **E** — 10 regras de padrao + 2 decisoes (pet, academia) | 2 frases | R$ 7.835,74 |
| 6 | sobra do E | **nenhum, por decisao** | ~R$ 6.000 fica em `outro_pessoal` |

**Os passos 1 a 3 fecham a EMPRESA INTEIRA (R$ 130.123,34) com 6 frases do dono.** E ai
a pergunta "em que a loja gastou" passa a ter resposta, que hoje nao tem.

---

## 8. O que este plano NAO faz, declarado

- **Nao inventa categoria nova.** As 33 existentes bastam, com duas excecoes que o dono
  decide: pet (`HIPERPET`) e academia (`SMARTFIT`) nao tem casa obvia.
- **Nao usa nome curto como padrao de regra.** `S IMPORT` casou 23 em vez de 1. CNPJ, ou
  o nome inteiro.
- **Nao julga a cauda de R$ 6 mil.** Custa mais que vale, e esta escrito para que a
  proxima sessao nao ache que foi esquecimento.
- **Nao mexe em nenhum saldo.** Todas essas linhas JA tem `dominio` e JA contam no
  caixa. Isto e sobre o "para onde foi", nao sobre "quanto sobrou". Nenhum numero do
  placar muda por causa deste plano.

---

## 9. Estado quando este plano foi tirado

Cobertura de dominio **99,86%**, 2 linhas pendentes (o par do Rodrigo Alves, decisao
tomada de deixar pendente ate existir o `forcar`).

Saldo de caixa da empresa, mes a mes, **todos positivos**: fev +3.872,09 · mar
+3.864,20 · abr +1.238,68 · mai +5.635,02 · jun +2.689,70 · jul +2.205,00 · ago
+2.425,00.

Agosto: caixa +R$ 2.425,00 contra lucro de R$ 2.925,98.
