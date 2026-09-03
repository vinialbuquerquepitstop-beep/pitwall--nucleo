# Handoff Financeiro v13 — a base saiu de 18,55% e o portao abriu

Data: 03/09/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v12.md`
como topo da linha.

---

## 1. A frase da entrega

**O dono julgou a base inteira numa sessao, e o portao entre a semana 2 e a 3 abriu:
de 18,55% para 95,51% do valor.**

Nao houve tela nova nem migration nova de produto. A entrega e o DADO: 933 linhas
saindo de "nao classificado" para um lado declarado por ele, mais 14 pares de repasse
provados, mais o conserto que estava escrito e nao aplicado.

| | 02/09 | 03/09 |
|---|---|---|
| Cobertura julgada | **18,55%** | **95,51%** |
| Valor julgado | R$ 82.521,33 | R$ 424.857,79 |
| Valor pendente | R$ 362.299,35 | R$ 19.962,89 |
| Linhas pendentes | 785 | 199 |
| Regras vivas | 5 | ~40 |
| Pares de repasse | 2 | 16 |

---

## 2. O que foi aplicado, em ordem

| # | O que | Cobertura depois |
|---|---|---|
| 0 | `20260902_fin_fatia4_regra_recusa_categoria_nao_manual.sql` por `apply_migration` | 18,55% |
| 1 | 21 regras da `pauta_regras_20260902.md` | 55,42% |
| 2 | 8 pares de repasse + grupo do Caique como `pessoal` | 65,21% |
| 3 | Blocos A (raiz do CNPJ), C (o proprio dono), D (cartao de débito) | 71,94% |
| 4 | 4 pares do Felipe | 73,90% |
| 5 | 12 regras (moda, agencias, Thay, MF Company, Marcos Antonio, Ronald) | 87,52% |
| 6 | Varredura geral de pares (4 novos) | 88,20% |
| 7 | 7 regras (motoboy, 4 clientes, 2 fornecedores) | 93,30% |
| 8 | Bruno, familia, EBANX | **95,51%** |

Todas as escritas passaram por `fin_regra_prever` ANTES de gravar, e todas as aplicacoes
usaram alcance `nao_classificados`: **nenhuma decisao anterior do dono foi sobrescrita**,
e o servidor reportou `conflitos: 0` em todas.

---

## 3. A migration que estava pendente desde 02/09

`fin_regra_salvar` passou a recusar categoria com `atribuivel_manual = false`, como o
`fin_classificar` ja fazia. Aplicada por `apply_migration` (nunca pelo SQL Editor, que
nao gera linha no ledger).

| | |
|---|---|
| `version` no ledger | `20260903010231` |
| `name` | `fin_fatia4_regra_recusa_categoria_nao_manual` |
| Corpo de `fin_regra_salvar` | md5 `4bbc1e82…` (7.327 chars) → `45d5e012…` (8.170) |
| ACL | `authenticated` true · `service_role` true · **`anon` false** |
| `prosecdef` / `proconfig` | `false` / `search_path=public, privado`, preservados |

**Prova**, `ferramentas/prova_regra_repasse.sql`, os tres casos:

```
PASSOU caso 1: Categoria nao pode ser escolhida a mao: repasse
PASSOU caso 2: regra normal aceita (sera desfeita). msg: Regra criada. Nenhum lancamento pendente para ela agora.
PASSOU caso 3: nenhuma regra viva aponta para categoria travada.
ROLLBACK PROPOSITAL: os casos passaram e nada foi gravado.
```

O MCP nao devolve `RAISE NOTICE`, so o erro final. As tres linhas acima vieram de rodar o
MESMO bloco com os avisos acumulados na mensagem da excecao, sem mudar uma assercao.

### 3.1 O ledger, casado por nome

**27 contra 27 virou 28 contra 28** na era financeira (>= 26/08), cruzando os NOMES e nao
so as contagens: zero arquivo sem par no ledger, zero linha do ledger sem arquivo. Total
do ledger: 171 → 172.

Registrado tambem: o `version` (`20260903010231`) **nao bate** com o prefixo do arquivo
(`20260902_`), porque o `apply_migration` carimba UTC e ja tinha passado da meia-noite. O
casamento se sustenta pelo `name`. O arquivo ganhou o cabecalho
`-- migration aplicada: <versao>` dizendo isso, que e a convencao da secao 6.1 do v12.

---

## 4. Os cinco achados que valem mais que o percentual

### 4.1 O CNPJ e a unica chave real de contraparte

Nome de contraparte nao tem chave. A **raiz de 8 digitos** do CNPJ tem, e ela unificou
grafias sozinha, sem apelido nem heuristica:

| Raiz | Grafias que sao a mesma empresa |
|---|---|
| `26.426.950` | `BR IPHONES IMPORTACAO LTDA` · `BR IPHONES IMP LTDA` · `AZEVEDO IMPORTS AND BUSINESS` |
| `59.837.359` | `THAY DE OLIVEIRA COMERCIO DE BEBIDAS LTDA` · `THAY DE O. C. DE B. LTDA` |
| `10.573.521` | `MERCADO PAGO INSTITUICAO DE PAGAMENTO LTDA` · `PIX MARKETPLACE` |
| `17.289.475` | `BUS SERVICOS DE AGENDAMENTO S A` · `S.A.` |
| `27.486.182` | `VIACAO AGUIA BRANCA S A` · `AGUIA BRANCA` |

**Usar a raiz, nunca a filial.** A `BR IPHONES` tem duas (`/0001` com 25 linhas e `/0002`
com 5). A regra criada com `/0001-76` deixou 3 linhas e R$ 11.422 de fora.

### 4.2 A previa pegou dois falsos casamentos por nome que teriam feito estrago

| Padrao | Deveria casar | Casava | Por que |
|---|---|---|---|
| `S IMPORT` | 1 | **23** | substring de `BR IPHONE`**`S IMPORT`**`ACAO LTDA` |
| `EBANX` | 12 | **74** | 62 sao corrida de UBER processada pela EBANX |

Os dois foram trocados pela raiz do CNPJ. **`fin_regra_prever` antes de gravar deixou de
ser opcional.**

### 4.3 `transferencia_interna` estava em terceiro, e o portao nao ve isso

A categoria significa "conta do proprio dono" e tem natureza `neutro`: tudo que cai nela
sai de TODO total. Tinha **28 linhas, R$ 24.380**, e a maioria nao era o dono:
`BR IPHONES` R$ 18.800, `JOAO VICTOR` R$ 3.050, `REINALDO` R$ 1.830, `RICARDO MEIRELES`
R$ 700.

**O portao do F3 conta linha JULGADA, nao linha julgada CERTO.** Categoria neutra conta
como julgada, entao esses R$ 24.380 contavam para a cobertura E estavam fora dos totais
ao mesmo tempo.

Resolvido em parte: 8 pares legitimos viraram `repasse`, e `transferencia_interna` caiu
para **13 linhas, R$ 13.080**. Dentro deles, **R$ 12.000 de entradas da BR IPHONES ficam
neutros por DECISAO CONSCIENTE do dono** (*"nao e nada relevante, nao precisa entrar em
nada"*), apresentada com o numero na cara. **Nao reabrir sem que ele peca.**

### 4.4 Repasse: o dono pensa relacao, o sistema exige par

Divergiu quatro vezes:

| Contraparte | Declarado | Pareavel |
|---|---|---|
| Grupo do Caique (52 linhas, R$ 45.360) | repasse | **zero**: e conta corrente |
| `RODRIGO ALVES RODRIGUES` | repasse | 1 par (1,38%), sobra R$ 730 |
| `FELIPE NUNES RAMOS PORTELLA` | repasse | 4 pares, sobra R$ 2.130 |
| `BRUNO DA COSTA AZEVEDO` | repasse | **zero** |

**Simetria no agregado nao implica transacao pareavel.** O grupo do Caique fecha com 6,2%
de desequilibrio somado e nao tem UM par: os valores nunca se repetem entre ida e volta.
Casar por coincidencia de valor a 100+ dias seria fabricar prova, e nao foi feito.

O modelo do sistema esta certo: `repasse` e `neutro`, entao marcar sem par esconderia
dinheiro real, que e o defeito de 4.3.

### 4.5 Fluxo assimetrico nao prova custo (correcao do dono)

Eu tinha escrito que os R$ 5.170 do Bruno que sairam e nao voltaram eram custo. O dono
corrigiu: *"pode ter voltado de outra forma. compro aparelho dele."* Bruno e FORNECEDOR,
o dinheiro voltou em MERCADORIA. Virou `empresa` + `compra_aparelho`.

**O extrato so enxerga dinheiro.** Assimetria de Pix nao decide a natureza da relacao;
so o dono decide.

---

## 5. O F3 trava por PERIODO, e 4 meses ainda reprovam

O portao do `PLANO.md` mede a base inteira e ABRIU. O invariante F3 mede a **janela que a
tela mostra**, e ali:

| Mes | % julgado | F3 | Falta para 95% |
|---|---|---|---|
| 2026-02 | 94,97% | **TRAVA** | **R$ 17,23** |
| 2026-03 | 91,37% | **TRAVA** | R$ 1.283,60 |
| 2026-04 | 95,91% | abre | — |
| 2026-05 | 97,91% | abre | — |
| 2026-06 | 87,84% | **TRAVA** | R$ 2.189,35 |
| 2026-07 | 92,39% | **TRAVA** | R$ 1.124,42 |
| 2026-08 | 98,78% | abre | — |

**R$ 4.614,60 abrem os quatro**, de R$ 19.962,89 pendentes. Priorizar por quanto falta
NAQUELE mes, nao por valor absoluto.

Maiores pendentes por mes travado:

| Mes | Alvos |
|---|---|
| 02 | `CLAYSON DA COSTA FIGUEIREDO` R$ 590 · `JOAO VICTOR` R$ 550 · `TUNA PAGAMENTOS` R$ 411 · `DLOCAL` R$ 344 |
| 03 | `FELIPE NUNES` R$ 900 · `BUS SERVICOS` R$ 566 (CNPJ `17.289.475`, duas grafias) · `DLOCAL` R$ 482 |
| 06 | `JIANSHENG ZHANG` R$ 850 · `O KALHETAO` R$ 581 · `ISAAC F DE MORAES` R$ 500 |
| 07 | `VICTOR MAIA DARGAINS` R$ 980 · `RODRIGO ALVES` R$ 630 · `HIAGO SILVA DE ARAUJO` R$ 335 |

---

## 6. O que NAO foi provado, e o que nao foi feito

1. **A suite NAO foi rodada nesta sessao**, e nao precisava: **zero arquivo de
   `public/` ou de `ferramentas/` foi tocado**. O ultimo verde de record continua sendo
   o de 02/09 (1037 assercoes, EXIT 0 nas 5 larguras de celular e nas 3 de monitor).
   Sessao que MEXER em codigo tem que rodar os sete comandos de novo.
2. **RLS nao foi retestada** (dono, vendedor, tenant errado). Nenhuma tabela nova, mas a
   afirmacao segue herdada.
3. **As escritas saíram por fora do app**, chamando as RPCs com `set_config` de
   `request.jwt.claims` simulando a sessao do dono (a mesma tecnica do
   `prova_regra_repasse.sql`). Funciona e e reversivel, mas a claim foi setada no nivel
   da CONEXAO: **sempre limpar com `set_config('request.jwt.claims','',false)` no fim**,
   e foi limpa em toda etapa desta sessao.
4. **`fin_repasse_marcar` nao limpa `dominio`.** Linha que ja tinha lado e virou repasse
   ficou com os dois. `neutro` vence na cobertura, entao nao muda numero, mas o dado tem
   os dois campos preenchidos.
5. **A tela nao foi aberta.** Toda a medida veio do banco. Vale o "entregar palpavel":
   a proxima sessao deveria ABRIR a aba Financeiro e conferir que os numeros que agora
   destravaram fazem sentido na tela.

---

## 7. Pendencias

| # | Pendencia | Nota |
|---|---|---|
| 1 | 4 meses travados no F3 | R$ 4.614,60 resolvem. Secao 5 |
| 2 | Sobra de repasse sem par: `FELIPE` R$ 2.130, `RODRIGO` R$ 730 | Precisam de `dominio`, nao podem virar `repasse`. Secao 4.4 |
| 3 | `DLOCAL`, `JIANSHENG ZHANG`, `VICTOR MAIA`, `JOAO VICTOR`, `TUNA PAGAMENTOS`, `CLAYSON`, `HIAGO`, `ISAAC`, `O KALHETAO` | Dono respondeu *"restante desconheco"* |
| 4 | 13 linhas em `transferencia_interna` | R$ 12.000 sao decisao fechada do dono. Os outros R$ 1.080 sao 4 estornos + sobras |
| 5 | 4 linhas `ESTRELA MAR` / `MAR ESTRELA` com `moradia` e sem dominio | Mesma loja, duas grafias, e 2 linhas dela estao como `empresa`. Uma das duas esta errada |
| 6 | 3 linhas `Aplicação RDB` rotuladas `resgate` | Cosmetico: as duas categorias sao neutras, so o rotulo mente |
| 7 | Escrita de volta no Notion | Bloqueio antigo do v33, capability "Update content" |

---

## 8. Onde o mapa mora

**`docs/financeiro/mapa_pendentes_20260903.md`** e o documento de trabalho desta sessao:
a linha do tempo completa, os blocos A a G, as decisoes do dono registradas com a frase
dele, a tabela do F3 por mes e a folha de resposta do que sobrou.

Ele sucede a `pauta_regras_20260902.md`, que fica como historico. **Atencao: a pauta
diverge do banco em dois pontos** e nao foi corrigida: a regra 6 dela diz `S IMPORT` (o
banco tem o CNPJ `34.263.791/0001`) e ela previa UMA regra de RDB (o banco tem duas,
`APLICACAO RDB` e `RESGATE RDB`). Quem ler a pauta sem ler este handoff vai reaplicar o
bug do `S IMPORT`.

---

## 9. Primeiro movimento do proximo chat

Abrir a aba Financeiro na tela e olhar. A base saiu de 18,55% para 95,51% sem que
ninguem tenha aberto o app uma vez, e o dono nunca viu o resultado disso. Depois,
resolver os R$ 4.614,60 que destravam os quatro meses do F3.

**So entao a semana 3 do `PLANO.md`** (Visao Pessoal, graficos, Agente 1).
