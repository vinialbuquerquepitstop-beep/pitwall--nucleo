# Formato dos dados e catalogo canonico

Catalogo medido no banco em 27/07/2026 (`calc_dados`, 340 linhas de produto, 690 precos).
**Este arquivo e o dicionario do parser.** Catalogo velho e o que faz uma lista nova casar
60% em vez de 90%. Atualizar sempre que entrar modelo, cor, fornecedor ou categoria.

---

## 1. Blob de custo (`public.calc_dados.dados`)

```
{ "config": {...}, "bateria": [...], "tela": [...], "produtos": [...] }
```

Produto, uma linha por **modelo x condicao x fornecedor**:

```json
{ "n":"iPhone 16 128GB", "c":"iPhone", "t":"Lacrado", "f":"Júnior", "l":"Recreio — RJ",
  "cs":[ {"n":"Preto","h":"#1c1c1e","v":4299}, {"n":"Azul","h":"#2c4f8c","v":4299} ] }
```

- `n` nome canonico, `c` categoria, `t` condicao, `f` fornecedor, `l` praca do fornecedor.
- Preco de **custo**: `v` numerico > 0 no produto, **ou** cores em `cs` com `v` proprio.
  Produto com cor usa `cs`; sem cor (ex.: seminovo sem distincao) usa `v` direto.
- `op` (opcional) alimenta o scanner: `{"k":"hot"|"hist","p":<percentual>}`.

O que `validarDados()` (`public/calc/index.html:1297`) exige, e derruba a tela inteira
com barra vermelha se faltar:

- `produtos` array nao vazio;
- todo produto com `n`, `f`, `l`, `c`, `t`;
- preco valido: `v > 0`, ou toda cor de `cs` com `n` e `v > 0`;
- `bateria` e `tela` sendo **arrays** (hoje ambos estao vazios, `[]`, e isso passa).

Campo extra nao quebra o validador. Campo faltando quebra tudo, nao so aquela linha.

### `config` do blob (valores em 27/07/2026)

| Campo | Valor | Significado |
|---|---|---|
| `d` | 300 | desconto de entrada padrao no usado |
| `iav` | 550 | margem a vista: iPhone, iPad, Apple Watch |
| `ipc` | 650 | margem parcelado: iPhone, iPad, Apple Watch |
| `mav` | 1200 | margem a vista: MacBook e Mac Mini |
| `mpc` | 1300 | margem parcelado: MacBook e Mac Mini |
| `s300` | false | exibir o desconto no card |
| `scusto` | true | exibir o menor custo no card |

**As margens vivem aqui, nunca no codigo.** Todo calculo le do `config` do blob. Fixar
550 num script e o mesmo erro que numero de cadencia dentro da funcao de varredura.

---

## 2. `dados.js` do consultor (`public/calc/consultor/dados.js`)

```
const DADOS = { "produtos":[...], "config":{...} }
```

Formato DIFERENTE do blob de custo. Uma linha por **modelo x condicao** (fornecedor nao
existe aqui, e nem pode: o consultor nao ve custo nem origem):

```json
{ "n":"Apple Watch S11 46mm", "c":"Apple Watch", "t":"Lacrado",
  "cs":[ {"n":"Jet Black","h":"#0b0b0d","pv":2949,"pp":3049} ] }
```

- `pv` preco a vista, `pp` preco parcelado. Nunca custo, nunca fornecedor.
- Acessorio **nao entra** na calc do consultor.

### `config` do consultor (valores em 27/07/2026)

- `validade`: `dd/mm/aaaa`. **Obrigatoria toda rodada.** Vencida, trava a calc inteira.
- `pb`: 100. Acrescimo aplicado sobre `pp` antes de multiplicar pela taxa do cartao.
- `taxas`: fator por parcela, de `2` a `18` (ex.: `"12":1.11284`).
- `comissao`: escada por nivel x condicao x categoria.

| Nivel | Lacrado iPhone/iPad/Watch | Lacrado MacBook | Seminovo iPhone/Watch |
|---|---|---|---|
| Embaixador | 100 | 130 | 100 |
| C1 | 180 | 220 | 145 |
| C2 | 220 | 260 | 175 |
| C3 | 250 | 300 | 200 |

O que o `boot()` do consultor exige: `DADOS.produtos` nao vazio, `config.taxas`,
`config.comissao`, e `comissao.C1.lacrado` existindo (guarda contra config antiga sem a
escada C1/C2/C3).

---

## 3. Regra de derivacao (provada, nao suposta)

```
para cada (modelo, condicao, cor):
    custo = MENOR v entre todos os fornecedores que tem aquela cor
    pv    = custo + (config.iav se categoria != MacBook, senao config.mav)
    pp    = custo + (config.ipc se categoria != MacBook, senao config.mpc)
Mac Mini conta como MacBook. Acessorio fica de fora.
```

Prova em 27/07/2026: as 103 combinacoes do `dados.js` bateram com o custo minimo do banco
mais a margem, **103 de 103, zero divergencia**. Pontual: Apple Watch S11 46mm Jet Black,
custo 2399 (Júnior) -> `pv` 2949, `pp` 3049; Rose, custo 2599,99 (MP Imports) -> `pv`
3149,99.

Se uma rodada futura der divergencia, o certo e investigar antes de "corrigir": ou a
margem mudou no `config`, ou alguem editou o `dados.js` a mao.

---

## 4. Catalogo canonico

Escrever o nome EXATO desta lista no blob. O fornecedor escreve como quiser; a
normalizacao acontece no parse, nunca no arquivo final.

### Categorias e condicoes

- `c`: `iPhone`, `iPad`, `MacBook`, `Apple Watch`, `Acessório` (com acento, exato),
  mais as tres **classes de custo puro** que entraram em 15/08/2026: `1ª Linha`,
  `Garmin`, `Moto Elétrica`.
- `t`: `Lacrado`, `Seminovo`, `CPO`. Nada alem disso.

**Classes de custo puro (dono, 15/08/2026).** Entram na tabela pelo CUSTO e nao
recebem margem nenhuma: "sobre valores de lucro, nenhum. apenas o custo". Elas
existem porque o dono passou a comprar Garmin, moto eletrica e fone paralelo, e
quer o custo a mao sem que a calc finja um preco de venda.

Isso NAO era so carga de dado: `mg()` em `public/calc/index.html` mandava toda
categoria diferente de `MacBook` para o `else` e devolvia a margem de iPhone
(550/650). Sem tocar no codigo, uma moto eletrica apareceria com preco de venda.
O que existe hoje no arquivo:

- `SEMMARGEM` (um `Set`) e `semMargem(c)`, logo acima de `mg()`;
- `mg()` devolve `{av:0,pc:0}` para essas classes, e a margem das outras segue
  saindo do `config`, nunca fixa no codigo;
- `vCalc()` **esconde** o painel de preco de venda para elas. Exibir margem 0%
  acenderia o alerta vermelho de "margem baixa" numa moto, que e ruido, nao aviso;
- o scanner de oportunidades as ignora, como ja fazia com `Acessório`, porque
  ranqueia por margem;
- na derivacao do consultor elas ficam de fora, junto com `Acessório`.

Prova: `node ferramentas/prova_sem_margem.js`, 22 assercoes, exit 0. Ela le
`SEMMARGEM`, `semMargem` e `mg` do arquivo real, nao copia a logica.

**Nome de produto paralelo carrega a classe no nome.** Os AirPods de 1ª linha
entram como `AirPods Pro 1ª linha` e `AirPods Max 1ª linha`, nunca `AirPods Pro`.
A calc trata produtos de mesmo `n` + `t` como opcoes do MESMO aparelho
(`index.html`, funcao de troca de opcao): com o nome curto, um paralelo de
R$69,99 apareceria como "opcao mais barata" do AirPods Pro original de R$1.500.

**`Acessório` continua ganhando margem de iPhone**, e isso NAO foi mexido em
15/08 porque o dono nao pediu. Efeito medido: AirPods Pro original de R$1.500
aparece com venda de R$2.050. Se a regra "so custo" valer para acessorio, e
acrescentar a categoria ao `SEMMARGEM`. Pendencia do dono.

  `CPO` entrou em 03/08/2026 a pedido do dono. E o refurbished certificado pela Apple:
  vem lacrado, em caixa branca, com **1 ano de garantia Apple**. Nao e lacrado comum nem
  seminovo, e por isso e a terceira condicao em vez de um rotulo dentro do nome.
  Regras que valem em toda a cadeia: paga **comissao de lacrado** (decisao do dono,
  03/08/2026), exibe **1 ano** de garantia, badge azul `.bdg-b` no consultor, chip
  proprio na calc do dono. Provado por `node ferramentas/prova_cpo.js`.

### Fornecedores e pracas (11)

| Fornecedor (`f`) | Praca (`l`) | Precos na ultima carga |
|---|---|---|
| Júnior | Recreio — RJ | 198 |
| MP Imports | Campo Grande — RJ | 147 |
| Quality | Barra da Tijuca — RJ | 79 |
| Cristiano | Méier — RJ | 70 |
| LBR Importados | Centro — Niterói/RJ | 47 |
| Five Cell | Caxias — RJ | 42 |
| Revel | Nova Iguaçu — RJ | 32 |
| Davi/Fábio | Bangu — RJ | 24 |
| M Apple | Campo Grande — RJ | 24 |
| FMATA | Centro — RJ | 16 |
| Real Comércio | Centro — RJ | 11 |

Tres entraram em 27/07/2026 e ja carregaram em 03/08/2026:

| Fornecedor (`f`) | Praca (`l`) | Como se identifica na lista |
|---|---|---|
| Raposa | Niterói — RJ | `ATACADO E REVENDA DA RAPOSA`, retirada Niteroi |
| DG Jacarepaguá | Taquara — RJ | `Dg JPA`, `DG Jacarepaguá`, retirada Taquara |
| Rafael | Barra da Tijuca — RJ | `Raphael barra da Tijuca` (com PH na lista dele) |

Entrou em 03/08/2026, marcado pelo proprio dono como "Novo fornecedor":

| Fornecedor (`f`) | Praca (`l`) | Como se identifica na lista |
|---|---|---|
| BR10 | Irajá — RJ | `Br 10, iraja`, `ATACADO BR10 - dd/mm/aa`, retirada Iraja |

Entraram em 15/08/2026, os dois marcados pelo dono no proprio chat:

| Fornecedor (`f`) | Praca (`l`) | Como se identifica na lista |
|---|---|---|
| All imports | São João de Meriti — RJ | `All imports, fornecedor novo`; retirada em `shopping grande rio`, `shopping nova América`, `villar dos Teles` |
| João Telles | Bangu — RJ | `Lista nova, fornecedor João Telles, Retirada em bangu` |

A praca da **All imports foi DEDUZIDA**, nao declarada: a lista so cita os tres
pontos de retirada. Bangu ja era a praca do Davi/Fábio, entao Bangu com dois
fornecedores e correto, nao duplicata.

**Fornecedor total em 15/08/2026: 17.** Eram 15 no blob anterior.

**Rafael e DG Jacarepaguá mandam a MESMA lista**, preco a preco, mudando so a
retirada (Barra da Tijuca contra Taquara). Medido em 15/08/2026: 21 itens
identicos. Seguem como dois fornecedores porque a retirada e diferente, mas na
pratica sao a mesma fonte, e o menor custo nunca vai distinguir os dois.

Duas listas chegam SEM nome no cabecalho, so com `🚨SWAP GRADE A / IPHONE STOCK (VITRINE)`
e `🚨IPHONE NEW LACRADO NA CAIXA`. Sao da **FMATA**: as duas trazem o mesmo link de grupo
no rodape (`chat.whatsapp.com/FJVlVp2TEI...`) e em 21/07/2026 vinham com o cabecalho
`Fábio Fmata`. Identificacao por link, nao por adivinhacao.

Cabecalhos que enganam, ja resolvidos: `MELHOR DE CAXIAS` e **Five Cell**;
`ATENÇÃO! NÃO TROCAMOS APARELHO SEM OS SELOS` e `TABELA ATUALIZADA - dd/mm` sao as duas
partes da lista da **MP Imports** (confirmado pelo dono em 27/07/2026); `Charles revel`,
`REVEL IMPORTS` e `APARELHOS AMERICANOS` sao **Revel**; `Fábio souza`, `davi fabio` e
`Fábio Sousa davi Sobral` sao **Davi/Fábio**; `Júnior recreio` e `Recreio` sao **Júnior**.
`CHIQ CELL` aparece no chat e **nao esta no banco**: pendencia ate o dono decidir.

Acentos e o travessao das pracas sao valores reais do sistema: copiar exato.

### iPhone (66 nomes)

iPhone XR 64GB · iPhone 11 64GB · iPhone 11 128GB · iPhone 11 256GB · iPhone 11 Pro 64GB
· iPhone 11 Pro 256GB · iPhone 11 Pro 512GB · iPhone 11 Pro Max 64GB · iPhone 11 Pro Max
256GB · iPhone 12 64GB · iPhone 12 128GB · iPhone 12 256GB · iPhone 12 Pro 128GB · iPhone
12 Pro 256GB · iPhone 12 Pro 512GB · iPhone 12 Pro Max 128GB · iPhone 12 Pro Max 256GB ·
iPhone 12 Pro Max 512GB · iPhone 13 128GB · iPhone 13 256GB · iPhone 13 512GB · iPhone 13
Pro 128GB · iPhone 13 Pro 256GB · iPhone 13 Pro 512GB · iPhone 13 Pro Max 128GB · iPhone
13 Pro Max 256GB · iPhone 13 Pro Max 512GB · iPhone 14 128GB · iPhone 14 256GB · iPhone
14 Plus 128GB · iPhone 14 Plus 256GB · iPhone 14 Pro 128GB · iPhone 14 Pro 256GB · iPhone
14 Pro 512GB · iPhone 14 Pro 1TB · iPhone 14 Pro Max 128GB · iPhone 14 Pro Max 256GB ·
iPhone 14 Pro Max 512GB · iPhone 15 128GB · iPhone 15 256GB · iPhone 15 Plus 128GB ·
iPhone 15 Plus 256GB · iPhone 15 Pro 128GB · iPhone 15 Pro 256GB · iPhone 15 Pro Max
256GB · iPhone 15 Pro Max 512GB · iPhone 15 Pro Max 1TB · iPhone 16 128GB · iPhone 16
256GB · iPhone 16 Plus 128GB · iPhone 16 Plus 256GB · iPhone 16 Pro 128GB · iPhone 16 Pro
256GB · iPhone 16 Pro Max 256GB · iPhone 16 Pro Max 512GB · iPhone 16e 128GB · iPhone 17
256GB · iPhone 17 512GB · iPhone 17 Air 256GB · iPhone 17 Pro 256GB · iPhone 17 Pro 512GB
· iPhone 17 Pro 1TB · iPhone 17 Pro Max 256GB · iPhone 17 Pro Max 512GB · iPhone 17 Pro
Max 1TB · iPhone 17e 256GB

### iPad (6)

iPad 9 256GB · iPad 11 128GB · iPad 11 256GB · iPad A16 11" 128GB · iPad Air M4 11" 128GB
· iPad Pro M5 11" 256GB

### MacBook e Mac Mini (8)

MacBook Neo 13" 8/256GB · MacBook M4 16/256GB · MacBook Air M4 13" 16/256GB · MacBook Air
M5 13" 16/512GB · MacBook Pro M5 14" 16/1TB · MacBook Pro M5 Pro 14" 24/1TB · Mac Mini M4
16/256GB · Mac Mini M4 16/512GB

### Apple Watch (7)

Apple Watch SE 2 44mm · Apple Watch SE 3 40mm · Apple Watch SE 3 44mm · Apple Watch S10
46mm · Apple Watch S11 42mm · Apple Watch S11 46mm · Apple Watch Ultra 3 49mm

### Acessorio (12, so na calc do dono)

AirPods 4 · AirPods 4 ANC · AirPods Pro 2 · AirPods Pro 3 · AirPods Max 2 · AirPods Max
USB-C · AirTag Pack 4 · Apple Pencil 2 · Apple Pencil Pro · Apple Pencil USB-C · Cabo
Tipo-C Apple · Fonte Turbo Apple

### Nomes que ENTRARAM em 15/08/2026

Nao reescrevi as listas acima: estes sao os nomes que a carga de 15/08 trouxe e
que nao existiam no blob anterior. Todos foram aprovados pelo dono em bloco.

- **iPhone**: `iPhone 14 512GB` · `iPhone 16 Plus 256GB` · `iPhone 17e 512GB`
  (o `iPhone 14 Pro 1TB` e o `iPhone 17 Pro Max 2TB` ja estavam no catalogo, so
  nao tinham preco).
- **iPad**: `iPad Air M2 11" 128GB` · `iPad Air M4 11" 256GB` · `iPad Pro M4 13" 256GB`.
- **MacBook**: `MacBook Neo 13" 8/512GB` · `MacBook Air M4 13" 16/512GB` ·
  `MacBook Air M5 15" 24/1TB` · `MacBook Pro M5 14" 16/512GB` ·
  `MacBook Pro M5 14" 24/1TB` · `MacBook Pro M5 Pro 14" 24/2TB`.
- **Apple Watch**: `Apple Watch SE 2 40mm`.
- **1ª Linha**: `AirPods Pro 1ª linha` · `AirPods Max 1ª linha`.
- **Garmin**: `Garmin Forerunner 55` · `Garmin Forerunner 165` ·
  `Garmin Forerunner 165 Music` · `Garmin Vivoactive 5` · `Garmin Vivoactive 6` ·
  `Garmin Fênix 8 47mm`.
- **Moto Elétrica**: `Moto Elétrica Fine 500W`.

`Series 2` e `Series 3` do BR10 seguem sendo `SE 2` e `SE 3` (decisao de 03/08).
Foi assim que o `Apple Watch SE 2 40mm` apareceu.

### Nomes que ENTRARAM em 17/08/2026

Aprovados pelo dono, um a um, na carga de 17/08:

- **iPhone**: `iPhone 13 mini 512GB` (Quality, seminovo) · `iPhone 16 Pro Max 1TB`
  (MP, seminovo).
- **MacBook**: `MacBook Air M5 13" 512GB` — a MP escreve `MACBOOK AIR M5 512GB`,
  **sem RAM**. Decisao do dono: o preco entra e a **RAM sai do nome**, mesma regra
  do MacBook Pro sem polegada (03/08). Consequencia aceita: nao funde com o
  `MacBook Air M5 13" 16/512GB` dos outros seis fornecedores, e aparece como linha
  propria. Sem impacto em preco de venda (a 7.899,99 nunca e o menor).
- **MacBook**: `MacBook Air M4 15" 16/256GB` (Real Comercio, 7.386) entrou na
  mesma carga; o dono nao se pronunciou sobre este, foi comunicado depois.

**Android nao entra.** Decisao do dono, 17/08/2026: `Poco F8 Pro`, `Poco F8 Ultra`,
`Poco X8 Pro` e `Xiaomi 15T Pro` aparecem nas listas do Real Comercio, LBR e
Cristiano (6 precos) e **ficam fora do catalogo**. O parser precisa reconhece-los
para poder DESCARTAR: sem fechar o bloco, o preco deles cola no produto de cima.

**Preco com condicao pendurada fica de fora** (decisao do dono, 17/08/2026, agora
fechada): `caixa aberta`, `lacre rompido`, `deslacrado / somente para midia` e
`c/caixa`. Ate 15/08 `swap` e `caixa aberta` eram "pendencia ate o dono decidir";
agora sao descarte declarado no diff.

**Numero malformado se corrige por COERENCIA, com tabela explicita.** Decisao do
dono, 17/08/2026. Nao existe regra generica: cada token entra numa tabela
`token -> valor` no parser, para ficar auditavel. Os quatro desta carga:
`4,850,00` -> 4850,00 (virgula de milhar, Quality) · `4.3999,99` -> 4399,99
(digito a mais, MP) · `7.200,00,00` -> 7200,00 (centavos duplicados, LBR) ·
`1.1550` -> 1550,00 (ponto fora do lugar, Davi/Fabio). Token que **nao** estiver
na tabela continua sendo pendencia, nunca preco.

### Cores e hex (38 nomes em uso)

Amarelo `#f5e050` · Azul `#2c4f8c` · Black `#1c1c1e` · Black Ocean Band `#1c1c1e` · Black
Titanium `#2a2a2a` · Blue `#2c4f8c` · Blue Anatel `#2c4f8c` · Branco `#f5f5f0` · Desert
`#e8cfa9` · Dourado `#f4e4b8` · Gold `#f4e4b8` · Grafite `#4a4a4c` · Green `#a7c4a0` ·
Índigo `#2c4f8c` · Jet Black `#0b0b0d` · Laranja `#e8863f` · Lavanda `#b9afd4` · Lilás
`#7b6b9e` · Midnight `#1a1f2b` · Natural `#d6cfc4` · Orange `#e8863f` · Orange Anatel
`#e8863f` · Prateado `#e3e4e6` · Preto `#1c1c1e` · Rosa `#f4c2c2` · Rosa Blush `#f4c2c2`
· Rose `#f4c2c2` · Rose Gold `#f4c2c2` · Roxo `#7b6b9e` · Silver `#e3e4e6` · Silver
Anatel `#e3e4e6` · Sky Blue `#a8cbe6` · Space Black `#4a4a4c` · Space Gray `#4a4a4c` ·
Starlight `#faf6ef` · Verde `#a7c4a0` · Vermelho `#c0392b` · White `#f5f5f0`

**UNIFICADAS em 03/08/2026, por ordem do dono** ("unifica cores que possuem nomes
diferentes, mas o mesmo sentido"). Ate a v45 a regra era o contrario, e o custo apareceu:
a DG e o Rafael escreveram `Preto` em 27/07 e `Black` em 03/08, e o mesmo Apple Watch S11
46mm ficou listado duas vezes, a 2.400 como Black e a 3.750 como Preto (esse ultimo orfao
de uma lista velha). O consultor cotava o mesmo relogio com 1.350 de diferenca conforme a
cor que escolhesse.

Direcao da unificacao: **a forma dominante ganha**, medida no proprio blob, para mexer o
minimo no que o dono ja le. Aplicado: `Black`->`Preto`, `Blue`->`Azul`, `White`->`Branco`,
`Green`->`Verde`, `Orange`->`Laranja`, `Rose`->`Rosa`, `Blue Anatel`->`Azul Anatel`,
`Orange Anatel`->`Laranja Anatel`, e no sentido inverso `Prateado`->`Silver` (56 usos
contra 3) e `Dourado`->`Gold` (33 contra 8). De 38 nomes para **29**.

**NAO unificar** (sao cores proprias da Apple, nao traducao): Jet Black, Black Titanium,
Black Ocean Band, Space Gray, Space Black, Midnight, Starlight, Natural, Desert, Grafite,
Lavanda, Lilás, Roxo, Rosa Blush, Rose Gold, Sky Blue, Índigo, Amarelo, Vermelho.
As variantes `Anatel` seguem SEPARADAS da cor base: e produto homologado, com preco
proprio (FMATA, 03/08: `Orange` 6.400 e `Orange Anatel` 7.000 no mesmo 17 Pro 256GB).

Cor nova entra com hex plausivel e e conferida com o dono.

**Entraram em 15/08/2026, as duas com hex proposto por mim e aprovadas em bloco:**
`Cítrus` `#d9e04a` (colorway do MacBook Neo, aparece no Cristiano e no BR10) e
`Azul Profundo` `#1b3a6b` (cor da moto eletrica da Quality, separada de `Azul`
porque a lista traz as duas na mesma linha). Total em uso: **32 nomes**.

Mapeamentos que esta carga exigiu e que valem para as proximas:
- MacBook Neo: `Azul` da Five Cell e o `Índigo` do Cristiano e do BR10; `Rosa` da
  Five Cell e `Rosa Blush`. Sem isso o mesmo Neo aparece com duas cores e dois precos.
- iPhone 14 e 14 Plus: roxo se escreve **`Lilás`** (forma dominante entre Júnior,
  LBR, Revel e Davi/Fábio). Do 14 **Pro** para cima e `Roxo`. O Davi/Fábio escreve
  `PURPLE` e `LILÁS` para o mesmo emoji, o que confirma a leitura.
- `ULTRAMARINE` (16 Plus) e `PACIFIC BLUE` (12 Pro) sao `Azul`.
- `MIDNIGHT` continua NAO unificando com `Preto`, pela regra de 03/08. Efeito
  visivel: o 14 128GB tem `Midnight` a 2.049 (Davi/Fábio) e `Preto` a 2.100
  (Júnior) como linhas separadas. Custa 51 reais de confusao e foi mantido de
  proposito, porque Midnight e nome de cor da Apple, nao traducao.

---

## 4b. Mac e iPad: regras de faixa (implantadas em 27/07/2026)

Mac e iPad quebravam o parse porque o nome canonico junta quatro coisas
(`MacBook Air M4 13" 16/256GB` = linha, chip, polegada, RAM/SSD) e o fornecedor
escreve em qualquer ordem. As faixas nao se cruzam, entao a leitura e determinista:

| Numero | Faixa | E |
|---|---|---|
| RAM | 8, 16, 24, 32 (com `GB` ou antes de `Memoria`) | memoria |
| Armazenamento | 128, 256, 512 GB, ou 1TB / 2TB | SSD |
| Polegada | 11, 13, 14, 15, 16 sem `GB` (com `"`, entre parenteses, ou logo apos a linha) | tela |

Padrao `16/512` (com ou sem `GB`) e sempre RAM/SSD nessa ordem.

Deducoes seguras quando o fornecedor omite: **Air** e 13" (a 15" sempre vem escrita),
**Neo** e 13" e 8GB de RAM, **Mac Mini** nao tem polegada.

**MacBook Pro sem polegada: ENTRA, com a polegada OMITIDA do nome.** Decisao do dono em
03/08/2026, contra a regra anterior desta secao: "se nao tem polegada, coloque mesmo
assim, nao deixe de colocar preco por falta de polegada". A saida honesta e gerar
`MacBook Pro M5 Pro 16/1TB` (sem `14"`), nunca chutar 14 ou 16: **o preco entra, o spec
nao e inventado.** Ate a v45 isso era pendencia e o preco ficava de fora.

O fornecedor tambem escreve RAM e SSD por extenso (`M4 16GB Memória 256GB Armazenamento`,
Five Cell). As faixas nao se cruzam, entao ler por rotulo e deterministico: numero antes
de `Memória`/`RAM` e RAM, antes de `Armazenamento`/`SSD` e SSD. `MacBook MINI 4` e o
**Mac Mini M4** (o fornecedor cola as duas palavras).

`iPad A16 11"` e o MESMO produto que `iPad 11` (confirmado pelo dono em 27/07/2026).
Consolidar no nome curto `iPad 11 <capacidade>`.

**Trava de outlier**, obrigatoria nesta categoria: preco acima de 1.6x o menor da mesma
combinacao entre fornecedores e descarte. Pegou um `iPad 11 128GB` lido a 5.100 quando o
menor real era 2.570.

Resultado medido na carga de 27/07/2026: 15 combinacoes, 35 precos, 2 pendencias, ambas
o mesmo caso legitimo (MacBook Pro da Five Cell sem polegada).

---

## 5. Normalizacao: como a lista do fornecedor vira nome canonico

Regras de leitura, em ordem:

1. **Modelo.** `16 pro max`, `16PM`, `iphone 16 pro max` -> `iPhone 16 Pro Max`.
   Sem numero de modelo reconhecido, a linha e pendencia, nao chute.
2. **Capacidade.** `256`, `256gb`, `256 gb` -> `256GB`. `1tb` -> `1TB`. Modelo sem
   capacidade so passa se o catalogo tiver uma unica capacidade para aquele modelo.
3. **Condicao.** Testar **CPO primeiro**, antes de qualquer outra regra de condicao.
   A linha tipica do fornecedor traz as duas palavras juntas
   (`13 256 lacrado importado cpo caixa branca 1 ano de garantia Apple`), entao quem
   casar `lacrado` antes engole o CPO em silencio e a distincao se perde na carga. Foi
   exatamente o que aconteceu na carga de 27/07/2026: medido em 03/08/2026, os 341
   produtos do banco eram 161 `Lacrado` e 180 `Seminovo`, **zero CPO**, mesmo com CPO
   farto nas listas do Cristiano, da MP Imports e do M Apple.

   Ordem obrigatoria:
   1. `cpo`, `(CPO)`, `certified pre-owned` em qualquer posicao da linha -> `CPO`.
      Vale mesmo com `lacrado` na mesma linha: **CPO ganha de lacrado, sempre.**
   2. `lacrado`, `novo` -> `Lacrado`. `swap` e `caixa aberta` seguem pendencia ate o
      dono decidir.
   3. `seminovo`, `usado`, `vitrine` -> `Seminovo` (confirmar `vitrine` uma vez).

   Conferencia barata no diff: se a carga trouxer **zero CPO**, tem erro de ordem, nao
   ausencia de CPO nas listas.
4. **Cor.** Casar contra a tabela acima, aceitando maiuscula/minuscula e acento faltando.
   Cor desconhecida vira pendencia; nunca inventar hex sem avisar.
5. **Aparelho com "mensagem": DESCARTAR.** Decisao do dono em 27/07/2026. Aparelho com
   peca trocada que faz o iOS exibir aviso de peca nao genuina nao e revendido pela
   Pitstop. Linha que trouxer `mensagem`, `msg`, `aviso`, `peca nao genuina` ou
   equivalente **sai da carga**: nao vira preco e nao vira pendencia, vira descarte.
   Reportar so a contagem no diff, para o dono ver que existiram.

   O efeito colateral e o que torna essa regra critica: e comum o mesmo modelo aparecer
   duas vezes na mesma lista, um com mensagem e mais barato, outro sem e mais caro (visto
   em 27/07: iPhone 15 Pro 128GB a 3200 "C/ tela nova e mensagem", e a 3550 "PERFEITO").
   Como a derivacao usa o MENOR custo, deixar o barato entrar puxaria o preco de venda
   para baixo em cima de um aparelho que a loja nao vende. **Descartar primeiro, calcular
   o minimo depois.**

   `tela nova` SEM mensagem nao e descarte automatico. Se o mesmo modelo, cor e condicao
   vier com dois precos e nenhum tiver mensagem, e pendencia: o dono decide.

6. **Paralelo e replica: DESCARTAR.** Decisao do dono em 27/07/2026 ("tire o fone
   paralelo"). A Pitstop vende Apple original; produto paralelo na tabela de custo
   contamina a comparacao de menor preco. Sinais: `1ª linha`, `primeira linha`,
   `réplica`, `similar`, `genérico`, e **preco cotado em dolar** (`$69,99`), que nas
   listas observadas so aparece em item paralelo. Descarte, com contagem reportada no
   diff.

7. **Preco.** `4.299`, `4299`, `R$ 4.299,00` -> `4299`. `4299,99` -> `4299.99`.
   Numero com condicao pendurada (`4200 a vista`, `so hoje`, `3 unidades`) e pendencia:
   a calc nao tem onde guardar condicao, e ignorar a condicao e mentir sobre o preco.
8. **Fornecedor: vem do CABECALHO da mensagem, nunca do remetente.** Medido em
   27/07/2026 e corrigido no mesmo dia: o chat `FORNECEDORES PITS` e um agregador de
   listas ENCAMINHADAS. O remetente do WhatsApp e quase sempre o mesmo numero, entao
   agrupar por remetente da a conclusao errada de "um fornecedor so". Quem identifica e a
   primeira linha (`🦊 ATACADO E REVENDA DA RAPOSA`, `Quality`, `_ LBR IMPORTADOS_`,
   `Cristiano`, `MELHOR DE CAXIAS`...). Duas listas seguidas com o mesmo link de grupo no
   rodape sao do MESMO fornecedor, partidas em duas mensagens (ex.: seminovos e lacrados).
   Fornecedor que nao casar com a tabela das pracas e pendencia: falta a praca `l`, que o
   validador exige.

Toda pendencia vai numerada para o dono, com a linha original copiada, para ele resolver
em bloco. Pendencia nunca vira preco por conta propria.
