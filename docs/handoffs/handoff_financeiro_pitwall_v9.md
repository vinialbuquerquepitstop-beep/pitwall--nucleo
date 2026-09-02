# Handoff Financeiro v9 — a faixa cobra o numero certo

> **NOTA DE CORRECAO, acrescentada em 01/09/2026 pela v11.** A secao 5 deste arquivo
> declara `962 assercoes, 0 falhas, EXIT 0`. **Esse numero era FALSO na propria data
> em que foi escrito**: no mesmo 01/09 a suite dava `774 passou, 10 falhou`, EXIT 1,
> abortando na assercao 784 de 962. O rodape contava so o que rodou, entao 178
> assercoes declaradas nunca executaram e o numero impresso nao dizia isso.
> A causa e o conserto estao em `handoff_financeiro_pitwall_v10.md`.
> **O corpo abaixo NAO foi reescrito: historico e append-only.** Leia o numero da
> secao 5 como o que ele era, uma leitura de um contador que mentia por omissao.

Data: 01/09/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v8.md`
como topo da linha.

Entrega `P-R2` do bloco 1. **Ultimo prompt de construcao do bloco 1.** Depois dela,
`P-AUDITA` em sessao separada.

**Entrega vertical: migration + RPC + tela + assercao, no mesmo commit.**

---

## 1. A frase da entrega

**A faixa mostra quanto entrou e quanto saiu sem julgamento, nao a diferenca entre
os dois.**

Sujeito visivel: a manchete da faixa do invariante 18 deixa de ser
`R$ 350,33 em 119 lançamentos ainda sem classificação` e passa a ser
`R$ 35.148,38 entraram e R$ 34.798,05 saíram, em 119 lançamentos ainda sem
classificação`, com o liquido um degrau abaixo, em 12px.

---

## 2. O que estava errado

`fin_painel` devolvia so `nao_classificado_valor`, que e a soma COM SINAL. Uma entrada
de 4.800 e uma saida de -4.800 se cancelam, e a faixa declara quase zero de trabalho
com duas linhas esperando julgamento.

**Medido em 01/09/2026, janela de 01/08 a 31/08, chamando `fin_painel` como o proprio
dono (JWT dele, nao como postgres):**

| campo | valor |
|---|---|
| `nao_classificado_n` | 119 |
| entradas sem dominio | R$ 35.148,38 |
| saidas sem dominio | R$ -34.798,05 |
| `nao_classificado_valor` (o que a faixa exibia) | **R$ 350,33** |

**A faixa subestimava o trabalho pendente em 100 vezes.** O `PROMPTS.md` registrava 56
vezes sobre 131 linhas (medicao anterior, antes de o trabalho de repasse da v4 a v7
reclassificar parte da base). O defeito piorou, nao melhorou.

**Achado novo, que o `P-R2` nao previa e que e a parte mais grave:** no MESMO produto,
`fin_cobertura` ja contava em valor ABSOLUTO e, para a mesma janela, dizia
`R$ 65.146,43 pendentes em 118 linhas` (a 119a e a linha de categoria neutra do repasse,
que tem lado por natureza e por isso conta como julgada). **Duas telas do Financeiro
davam dois tamanhos para o mesmo trabalho, com duas ordens de grandeza de diferenca.**
Nao era so um numero pequeno demais: era uma contradicao interna.

---

## 3. O que mudou

### 3.1 Banco — `supabase/migrations/20260901_fin_fatia3_nc_dois_lados.sql`

`create or replace function public.fin_painel(date, date, text)`. Dois campos NOVOS no
`placar`:

- `nao_classificado_entradas` — soma das linhas sem dominio com valor > 0
- `nao_classificado_saidas` — soma das linhas sem dominio com valor < 0

**Nada foi removido.** `nao_classificado_valor` e `nao_classificado_n` continuam, com o
mesmo significado e o mesmo valor. Nenhuma outra parte da funcao mudou: `entrou`, `saiu`,
`resultado`, `secoes`, `entradas`, `repasse` e `pct_julgado` sao byte a byte os de antes.

**Decisao de sinal, tomada por mim e declarada aqui.** `nao_classificado_saidas` sai
**NEGATIVO**, nao em modulo, ao contrario de `saiu`, que sai positivo. Motivo: o par
`entrou` / `saiu` do placar economico e APRESENTACAO (os dois positivos, o rotulo carrega
o lado); este trio e DECOMPOSICAO, e vale `entradas + saidas = valor`. Decomposicao que
nao soma obriga o leitor a decorar uma segunda convencao para conferir a conta na propria
tela, e a suite prova a identidade nos numeros RENDERIZADOS, nao nos que o stub mandou.

`CREATE OR REPLACE FUNCTION` reseta ACL: o `revoke all` + `grant execute` foi refeito
explicitamente no fim da migration, e conferido em `pg_proc.proacl` depois de aplicar
(`{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`, identico ao
de antes).

### 3.2 `public/app.js`

- **`finFaixaNc(pl)`**: le os dois campos novos. Manchete (`<b>`, 14px, `--erro-fg`) com
  os dois lados; a saida sai em MODULO ali, porque a palavra `saíram` ja carrega o lado e
  `R$ -34.798,05 saíram` seria sinal duplicado. O liquido desce para um `<span>` de 12px
  com a frase que diz POR QUE ele engana (`Entrada e saída do mesmo valor se cancelam,
  então é o líquido que esconde o tamanho do trabalho`). A frase do filtro
  Empresa/Pessoal e a de que os numeros abaixo ignoram o valor continuam intactas.
- **`finPlacar(pl)`**: a celula `não classificado` passa a carregar a CONTAGEM
  (`119` / `lançamentos fora de todo total`) em vez do modulo da soma com sinal.

**Por que a celula do placar entrou numa entrega que fala da faixa.** Ela exibia
`R$ 350,33` para as MESMAS 119 linhas que a faixa, logo acima, passaria a descrever como
R$ 35.148,38 entrando e R$ 34.798,05 saindo. Dois valores de dinheiro diferentes para o
mesmo trabalho, a poucos pixels um do outro. Mudar so a faixa nao seria escopo menor,
seria **criar a contradicao com a propria entrega**. O dinheiro ficou onde ha largura
para os dois lados (a faixa); a celula conta linhas, que e o que cabe em 20px sem
truncar, e `.fin-placar .pb-num` tem `text-overflow:ellipsis` justamente porque dinheiro
truncado parece outro numero.

### 3.3 `public/app.css`

**Zero token de cor novo. Zero cor nova. Uma regra, de uma propriedade:**

```
.fin-alerta-liq{font-variant-numeric:tabular-nums}
```

A hierarquia (14px negrito `--erro-fg` contra 12px `--text`) ja vinha das regras que
existiam. A classe existe para dar nome a linha do liquido e para a suite medir a
diferenca de tamanho na fonte COMPUTADA, nao no CSS lido a olho.

---

## 4. O que foi PROVADO

### 4.1 Na suite

**955 -> 962 assercoes, 0 falhas.** Sete novas, todas `fin3:`:

- a faixa mostra os DOIS lados, com a string exata (`R$ 4.800,00 entraram e
  R$ 5.045,20 saíram`);
- a saida vem em modulo na manchete, sem sinal duplicando a palavra;
- o liquido saiu da manchete e desceu para a linha de baixo (`R$ -245,20` esta no span,
  e NAO esta no `<b>`);
- **e ele e MENOR que o par, medido na fonte computada** (12px contra 14px). Sem medir na
  cor/fonte computada, "menor" seria opiniao sobre o CSS;
- **a conta fecha na propria tela**: os tres valores sao extraidos do `textContent`
  RENDERIZADO por regex e conferidos, `4.800,00 - 5.045,20 = -245,20`;
- a faixa diz por que o liquido engana, em vez de so exibi-lo;
- a celula do placar conta linhas e nao repete um dinheiro diferente (`textContent` da
  celula nao contem `R$`).

Uma assercao `fin:` existente foi reescrita, nao removida: `ela diz o VALOR e a CONTAGEM`
virou `ela diz a CONTAGEM do que falta julgar`, porque o valor unico que ela media deixou
de ser o que a manchete carrega. As outras quatro assercoes da faixa (`ignoram esse
valor`, `nao muda com o filtro Empresa/Pessoal`, `soma COM SINAL`, cor `--erro` medida,
botao `fin-ir-nc`) passam sem alteracao.

### 4.2 Fixture

O stub do `fin_painel` calcula `nao_classificado_entradas` e `nao_classificado_saidas`
do MESMO `FIN_MOVS` de onde ja saia o liquido, e com `saidas` negativo, como o servidor.
Numero chumbado no stub faria a assercao da identidade medir o stub, nao a tela. No
fixture: R$ 4.800,00 entrando, R$ 5.045,20 saindo, liquido R$ -245,20, ou seja o liquido
sozinho declara 20 vezes menos do que existe.

O caminho `__FIN_VAZIO` tambem ganhou os dois campos em zero: estado vazio que nao mande
o campo faria a tela cair no `||0` e passar por engano.

### 4.3 Banco, com o sistema rodando

Bloco `DO` executado no banco de verdade, trocando `request.jwt.claims` entre os tres
papeis. Passou inteiro (qualquer um dos guards abaixo levantaria excecao):

| prova | resultado |
|---|---|
| como **dono** (`fb2aad8e…`), `ok` | `true` |
| identidade `entradas + saidas = valor` | **fecha**: 35148.38 + (-34798.05) = 350.33 |
| `saidas` sai NEGATIVO, nao em modulo | **sim** (-34798.05) |
| com `p_dominio = 'empresa'`, os dois lados **nao mudam** | **sim**, 35148.38 nos dois (Inv. 18: quem nao tem dominio nao tem lado) |
| como **vendedor** (`130353b1…`) | `ok:false`, `Financeiro e restrito ao dono.`, **sem `placar` no retorno** |
| **sem sessao** (claims vazias) | `ok:false`, `Sessao invalida.` |

Nenhuma linha foi escrita: `fin_painel` e `STABLE` e a prova e so leitura.

### 4.4 Comandos

| comando | EXIT |
|---|---|
| `git status --porcelain` (portao de entrada) | limpo, zero linha |
| `python ferramentas/validar.py` | 0 |
| `python ferramentas/harness.py` | 0 (**962 / 962**) |
| `python ferramentas/prova_trilho.py` | 0 |
| `python ferramentas/prova_grafico.py` | 0 |
| `python ferramentas/prova_atmosfera.py` | 0 |
| `node --check public/app.js` | 0 |
| `diag_mobile.py` 360 / 390 / 414 / 1280 / 1440 | 0 / 0 / 0 / 0 / 0 |

O `diag_mobile` importava aqui por dois motivos: a manchete da faixa ficou bem mais longa
(dois valores em moeda numa linha so) e a celula do placar mudou de conteudo. Nenhuma das
duas estoura em 360px.

### 4.5 Git contra banco

**22 `fin_` no git, 22 `fin_` aplicadas.** Eram 21 e 21 no portao de entrada; entrou
`20260901_fin_fatia3_nc_dois_lados` dos dois lados, no mesmo commit.

---

## 5. Portao de saida

| # | Item | Resposta |
|---|---|---|
| 1 | SQL rodado no banco de verdade | **SIM.** `apply_migration` + prova `DO` nos tres papeis |
| 2 | RLS testada como dono E como vendedor | **SIM**, e tambem sem sessao. Ver 4.3 |
| 3 | a tela le todo campo novo, zero campo orfao | **SIM.** Os dois campos novos aparecem na manchete da faixa, e os numeros que a suite mede so podem vir deles (o campo antigo vale -245,20 e nao produz nenhum dos dois) |
| 4 | assercao nova com prefixo de fatia | **SIM.** 7 `fin3:` |
| 5 | EXIT 0 nos comandos e nas 5 larguras | **SIM** |
| 6 | commit unico | **SIM.** Migration, RPC, tela, CSS e suite juntos |
| 7 | handoff atualizado | **SIM.** Este arquivo |
| 8 | nenhuma recusa nova fora da secao 4 | **SIM.** Nenhuma recusa nova foi criada |

### 5.1 Portao de confianca

**SIM, numero visivel mudou de valor, em dois lugares, e a explicacao subiu junto.**

1. **A manchete da faixa** deixou de ser `R$ 350,33` e passou a ser o par
   `R$ 35.148,38 entraram e R$ 34.798,05 saíram`. A explicacao esta na linha imediatamente
   abaixo, na propria faixa: `Líquido R$ 350,33, a diferença entre os dois. Entrada e
   saída do mesmo valor se cancelam, então é o líquido que esconde o tamanho do trabalho.`
   O numero antigo **nao sumiu da tela**: ele continua visivel, nomeado como liquido, um
   degrau abaixo. Numero que muda e desaparece nao da ao dono como conferir que mudou.
2. **A celula `não classificado` do placar** deixou de mostrar `R$ 350,33` e passou a
   mostrar `119`, com o pe `lançamentos fora de todo total`. O valor em dinheiro esta na
   faixa, na mesma tela, poucos pixels acima.

---

## 6. Ressalvas

1. **Na Visao da base viva de hoje, a faixa nao aparece.** `pct_julgado` da janela de
   agosto e **9,36**, abaixo do teto de 95, entao o F3 troca o placar inteiro pelo bloco
   de base incompleta e `semFaixa` suprime a faixa na Visao para nao cobrar duas vezes.
   **A entrega e visivel em Movimentos e em Importar**, onde a faixa vive sem o F3. Na
   Visao ela volta assim que a cobertura cruzar o teto. Isso vale tambem para a celula do
   placar: com base incompleta o placar nao e desenhado. **Onde clicar para ver hoje:
   aba Financeiro, chip `Movimentos`, topo da tela.**
2. **A contradicao que a v9 fecha era com `fin_cobertura`, e ela nao foi tocada.** Os dois
   agora contam em valor absoluto, mas por caminhos diferentes: a faixa soma
   `fin_movimento` com `dominio is null`; a cobertura usa `privado.fn_fin_cobertura`, que
   trata categoria neutra como julgada. Por isso a faixa diz 119 linhas e a cobertura diz
   118. **A diferenca e correta e explicavel** (a linha de repasse tem lado por natureza),
   mas as duas contagens aparecem na mesma aba sem que a tela diga por que diferem. Nao
   mudei: unificar as duas e mudanca de `fin_cobertura`, fora da frase desta entrega.
   Fica nomeado como candidato a prompt proprio.
3. **`nao_classificado_saidas` negativo diverge de `saiu` positivo no mesmo objeto.**
   Escolha consciente, justificada em 3.1, mas e uma segunda convencao dentro do mesmo
   `placar`. Quem for ler o JSON sem ler este handoff pode tropecar. Esta escrita em
   comentario na migration e no `app.js`.
4. A faixa continua **sem provar o caminho singular** (`1 lançamento`). O fixture tem 7
   linhas sem dominio e nenhum teste desce para 1. Ja era assim antes desta entrega.

---

## 7. Pendencias

- **`P-AUDITA` fecha o bloco 1, em SESSAO SEPARADA.** Auditor que audita o proprio
  trabalho e carimbo (CONTRATO secao 7).
- RLS das RPCs de **repasse** como vendedor: pendente desde a v4. Esta entrega provou a
  RLS de `fin_painel`, nao a das de repasse.
- Contagem 119 x 118 entre faixa e cobertura (ressalva 2).
- Tarefa do dono, sem prompt, antes do bloco 2: baixar os OFX dos ultimos seis meses e
  importar um por vez. O dedupe por `hash_dedupe` e `fitid` torna periodo sobreposto
  seguro (D-d). **Enquanto isso nao acontece, a Visao segue no bloco de base incompleta**
  e o dono nao ve nem placar nem faixa nela.

---

## 8. Invariantes reforcados

- **Inv. 18**: a faixa continua fora de todo total e continua ignorando o filtro
  Empresa/Pessoal, agora provado no banco (`p_dominio = 'empresa'` nao move os dois
  lados). Quem nao tem dominio nao tem lado, e recortar por lado esconderia o trabalho.
- **Portao 6.3**: dois numeros mudaram de valor e as duas explicacoes subiram no MESMO
  commit. O numero antigo continua na tela, nomeado, em vez de sumir.
- **C6 / secao 3, entrega vertical**: migration, RPC, tela, CSS e assercao num commit so.
  Servidor devolvendo campo novo sem leitor na tela seria entrega reprovada.
- **C5, zero token de cor novo**: uma regra de CSS, de uma propriedade, sem cor.
- **Uma tela nao pode dar dois numeros para o mesmo trabalho.** Foi por isso que a celula
  do placar entrou numa entrega que fala da faixa.

---

## 9. Primeiro movimento do proximo chat

`P-ABRE`. Depois **`P-AUDITA`, em sessao nova**, que fecha o bloco 1.
