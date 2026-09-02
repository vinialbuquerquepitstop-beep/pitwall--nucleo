# Pauta de regras — 02/09/2026

Lista para criar em **Financeiro > Regras > Nova regra**, na ordem. Foi montada a
partir da base viva (1.132 lancamentos, R$ 362.299,35 pendentes em 785 linhas) e das
decisoes do dono em 02/09/2026.

**Como ler.** `padrao` e o texto exato a digitar. `tipo` e o casamento (`contem`,
`comeca`, `exato`). `dominio` e o lado. A categoria fica no seletor do app, pelo
rotulo: os codigos nao entram aqui de proposito, porque quem escolhe e voce, na tela.

**Regra que so define dominio ja basta para o portao.** A cobertura do F3 conta
`tem dominio OU categoria de natureza neutro` — categoria nao entra na conta. Categoria
serve para a Visao ficar util depois, nao para cruzar os 95%.

**Alcance.** Deixe o padrao (`nao_classificados`). Sobrescrever o que ja foi julgado
exige confirmacao com o numero na cara, e nao e o caso de nenhuma regra desta lista.

---

## 1. A regra que mais rende: BR IPHONES pelo CNPJ

| campo | valor |
|---|---|
| **padrao** | `26.426.950/0001-76` |
| **tipo** | `contem` |
| **dominio** | `empresa` |
| categoria sugerida | Compra de aparelho |
| alcance esperado | **22 linhas, R$ 55.197,00** |

O CNPJ e a chave, o nome nao. O MESMO CNPJ aparece com **tres** nomes diferentes no
seu extrato:

- `BR IPHONES IMPORTACAO LTDA` — 16 entradas, R$ 44.287,00
- `BR IPHONES IMP LTDA` — 5 saidas, R$ 7.110,00
- `AZEVEDO IMPORTS AND BUSINESS` — 1 saida, R$ 3.800,00 (mesmo CNPJ E mesma conta)

Uma regra pelo nome pegaria um terco. Pelo CNPJ pega os tres, hoje e em todo extrato
futuro, mesmo que a grafia mude de novo.

**Confira o terceiro nome antes de aplicar.** `AZEVEDO IMPORTS AND BUSINESS` no mesmo
CNPJ e coerente com nome fantasia, mas quem sabe se e a mesma empresa e voce, nao o
extrato.

---

## 2. Fornecedores de aparelho

| # | padrao | tipo | dominio | linhas | valor |
|---|---|---|---|---|---|
| 2 | `ASTERION B2C` | contem | empresa | 4 saidas | R$ 16.165,00 |
| 3 | `CROSS INTERMEDIA` | contem | empresa | 3 saidas | R$ 10.400,00 |
| 4 | `P&S ELETRONICOS` | contem | empresa | 2 saidas | R$ 7.450,00 |
| 5 | `BALDEZ STORE` | contem | empresa | 1 | R$ 6.950,00 |
| 6 | `S IMPORT` | contem | empresa | 1 | R$ 4.800,00 |
| 7 | `GUINA ELETRONICOS` | contem | empresa | 1 | R$ 3.635,80 |
| 8 | `REI DO AI FONE` | contem | empresa | 1 | R$ 3.600,00 |
| 9 | `LBR IMPORTADOS` | contem | empresa | 1 | R$ 3.350,00 |

`CROSS INTERMEDIA` sem o `CAO` de proposito: o extrato traz `Cross Intermediação
LTDA` com cedilha, e o padrao casa depois de normalizar, mas cortar antes do acento
evita depender disso.

Categoria sugerida para todas: Compra de aparelho.

---

## 3. Clientes (decisao do dono, 02/09)

| # | padrao | tipo | dominio | linhas | valor |
|---|---|---|---|---|---|
| 10 | `RODRIGO ALMEIDA DA ROCHA` | contem | empresa | 6 (5 entradas) | R$ 26.000,00 |
| 11 | `LUCAS DA SILVA DOS SANTOS` | contem | empresa | 2 entradas | R$ 9.750,00 |

Categoria sugerida: Venda de aparelho.

**Atencao na 10:** Rodrigo Almeida tem 5 entradas e **1 saida** de R$ 26.000 no total.
Cliente que recebeu dinheiro de volta e devolucao ou troco, e nao venda. Olhe essa
saida antes de aplicar; se for devolucao, a categoria certa muda o sinal na Visao.

---

## 4. Vida pessoal

Pouco dinheiro, **muita linha**: some ruido da tela sem mover quase nada o percentual.
Vale fazer, mas depois das de cima.

| # | padrao | tipo | dominio | linhas | valor |
|---|---|---|---|---|---|
| 12 | `IFOOD` | contem | pessoal | 31 | R$ 2.939,04 |
| 13 | `99 TECNOLOGIA` | contem | pessoal | 32 | R$ 1.186,45 |
| 14 | `VETERINARIA XATO` | contem | pessoal | 3 | R$ 1.410,00 |
| 15 | `HIPERPET` | contem | pessoal | 6 | R$ 625,61 |
| 16 | `SUPERMERCADOS VIANENSE` | contem | pessoal | 11 | R$ 612,13 |
| 17 | `SMARTFIT` | contem | pessoal | 3 | R$ 434,40 |
| 18 | `AUTO POSTO ML AYRTON` | contem | pessoal | 13 | R$ 409,81 |
| 19 | `ASSAI ATACADISTA` | contem | pessoal | 3 | R$ 395,41 |

Categorias sugeridas: Alimentacao fora (12), Transporte (13, 18), Pet (14, 15),
Mercado (16, 19), Saude ou Vida (17) — o rotulo exato e o que estiver no seu seletor.

---

## 5. O balde sem contraparte: aplicacao e resgate

| campo | valor |
|---|---|
| **padrao** | `RDB` |
| **tipo** | `contem` |
| **dominio** | **deixe VAZIO** |
| categoria | Aplicacao (ou Resgate, conforme o rotulo do seu seletor) |
| alcance esperado | **12 linhas, R$ 19.900,00** |

Este e o caso de graca: aplicacao e resgate tem natureza **neutro**, e pelo F3 isso
ja conta como julgado **sem voce escolher lado nenhum**. Sao 5,5% do pendente numa
regra so.

**Cuidado real:** se `Aplicacao` e `Resgate` forem categorias separadas no seu
seletor, uma regra so vai carimbar as 12 com a mesma. Nesse caso faca DUAS, com
padrao `APLICACAO RDB` e `RESGATE RDB`. O sinal do valor diz qual e qual: saida e
aplicacao, entrada e resgate.

---

## 6. Os quatro do repasse NAO entram nesta lista

Decisao do dono em 02/09: Caique, Felipe, Rodrigo Alves e FS Distrib sao repasse.
**Repasse nao se faz por regra**, e a partir do commit desta data o servidor recusa
quem tentar (a trava existia so no `fin_classificar` e passou a existir tambem no
`fin_regra_salvar`).

Repasse existe **so em par**: uma entrada e uma saida, valores dentro de **5% do
maior**, marcados a mao no botao `Marcar repasse` com as duas linhas selecionadas.

| Contraparte | Entradas | Saidas | Pares possiveis | Sobram |
|---|---|---|---|---|
| CAIQUE BARROS DE LIMA | 17 | 15 | ate 15 | 2 |
| FELIPE NUNES RAMOS PORTELLA | 10 | 7 | ate 7 | 3 |
| RODRIGO ALVES RODRIGUES | 2 | 3 | ate 2 | 1 |
| **FS DISTRIB** | **9** | **2** | **ate 2** | **7** |

As que sobrarem continuam pendentes e vao precisar de `empresa` ou `pessoal`.

**FS DISTRIB merece um olhar antes:** 9 entradas contra 2 saidas nao tem cara de
repasse, tem cara de cliente que tambem te vendeu alguma coisa.

**O caminho pratico:** abra Movimentos, clique no nome no painel Por contraparte, e a
lista mostra so as linhas daquela pessoa. Casar entrada com saida olhando valores lado
a lado e o que torna as 15 marcacoes do Caique viaveis. Foi para isso que o filtro
subiu hoje.

---

## 7. Onde isso te deixa

| Bloco | Caminho | Valor |
|---|---|---|
| BR IPHONES (CNPJ) | regra | R$ 55.197,00 |
| Fornecedores | regra | R$ 56.350,80 |
| Clientes | regra | R$ 35.750,00 |
| Vida pessoal | regra | R$ 8.012,85 |
| Balde RDB | regra | R$ 19.900,00 |
| Repasse | pareamento a mao | R$ 64.160,00 |
| **Total** | | **R$ 239.370,65** |

Cobertura sai de **18,55% para cerca de 72,4%**.

**Nao chega aos 95%.** Faltam ~R$ 100 mil espalhados da posicao 26 ate a 351 da lista
de contrapartes: cauda longa, muitas linhas de valor pequeno. E mais uma rodada, e ela
so faz sentido depois que esta aqui estiver aplicada e medida.

Depois de aplicar, rode o workflow **Medir o Financeiro** para ver onde a cobertura
parou de verdade, em vez de confiar nesta projecao.
