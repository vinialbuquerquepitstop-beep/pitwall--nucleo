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

- `c`: `iPhone`, `iPad`, `MacBook`, `Apple Watch`, `Acessório` (com acento, exato).
- `t`: `Lacrado`, `Seminovo`. Nada alem disso.

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

Portugues e ingles convivem porque cada fornecedor escreve do seu jeito, e o nome da cor
aparece na tela. **Nao unificar sozinho**: trocar `Preto` por `Black` muda o que o dono e
o consultor leem. Cor nova entra com hex plausivel e e conferida com o dono.

---

## 5. Normalizacao: como a lista do fornecedor vira nome canonico

Regras de leitura, em ordem:

1. **Modelo.** `16 pro max`, `16PM`, `iphone 16 pro max` -> `iPhone 16 Pro Max`.
   Sem numero de modelo reconhecido, a linha e pendencia, nao chute.
2. **Capacidade.** `256`, `256gb`, `256 gb` -> `256GB`. `1tb` -> `1TB`. Modelo sem
   capacidade so passa se o catalogo tiver uma unica capacidade para aquele modelo.
3. **Condicao.** `lacrado`, `novo`, `swap`, `caixa aberta` pedem cuidado: so `lacrado` e
   `novo` viram `Lacrado`; `swap` e `caixa aberta` sao pendencia ate o dono decidir.
   `seminovo`, `usado`, `vitrine` -> `Seminovo` (confirmar `vitrine` uma vez).
4. **Cor.** Casar contra a tabela acima, aceitando maiuscula/minuscula e acento faltando.
   Cor desconhecida vira pendencia; nunca inventar hex sem avisar.
5. **Preco.** `4.299`, `4299`, `R$ 4.299,00` -> `4299`. `4299,99` -> `4299.99`.
   Numero com condicao pendurada (`4200 a vista`, `so hoje`, `3 unidades`) e pendencia:
   a calc nao tem onde guardar condicao, e ignorar a condicao e mentir sobre o preco.
6. **Fornecedor.** Vem do remetente/chat do export, nao do texto da mensagem. Fornecedor
   fora da tabela das 11 pracas e pendencia: falta a praca `l`, que o validador exige.

Toda pendencia vai numerada para o dono, com a linha original copiada, para ele resolver
em bloco. Pendencia nunca vira preco por conta propria.
