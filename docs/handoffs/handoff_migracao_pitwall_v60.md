# Handoff Migracao Pit Wall (Nucleo) v60

Data: 15/08/2026
Sessao: carga de preco das calculadoras, tres classes de custo puro, e o git
Substitui: v59 (que segue valendo para o que nao foi tocado aqui)

---

## 1. Headline: o consultor estava parado ha 5 dias e ninguem sabia

O dono abriu a sessao perguntando **qual o caminho para atualizar a calculadora
de preco**. A resposta util nao era o passo a passo: era medir o estado antes de
falar. Medido:

| | estava |
|---|---|
| `calc_dados` (calc do dono) | 411 produtos, carga de **03/08** |
| `dados.js` (consultor), local e no ar | 118 produtos, `validade 10/08/2026` |
| hoje | 15/08/2026 |

Validade vencida ha 5 dias. Pela `checkValidade()` do `/calc/consultor/`, isso
acende os dois banners vermelhos e **bloqueia as quatro funcoes de copiar
pedido**: o consultor parou de cotar em 11/08 e nada no sistema avisou.

**E a segunda vez.** A primeira foi em 27/07, nove dias vencida. Isso deixou de
ser descuido de sessao e virou defeito de desenho: um prazo que expira sozinho,
sem alerta. Enquanto nao houver alerta, a validade e a PRIMEIRA coisa a medir em
qualquer sessao que toque nas calculadoras. Ja esta no checklist da skill.

---

## 2. A carga: 17 fornecedores, 1.043 precos

O dono mandou dois exports de WhatsApp (`Fornecedores 15_08.zip` e, no meio da
sessao, `Mp lista hoje .zip`). Conferidos md5 e data da ultima mensagem antes de
parsear, pela armadilha de 03/08 em que o mesmo zip velho foi apontado tres vezes.

| | antes | depois |
|---|---|---|
| produtos | 411 | **501** |
| precos | 841 | **1.043** |
| fornecedores | 15 | **17** |

Subiram 66, cairam 180, iguais 394, novos 403, sairam 201. **Zero variacao acima
de 15%**; o maior movimento real foi +11,3% (Quality, 14 Pro Max 128GB Roxo
seminovo, 3.099 -> 3.450). Faixa do iPhone de 750 a 11.900, sem numero absurdo.

Condicao: Seminovo 468, Lacrado 439, **CPO 120**. CPO nao zerou, entao a ordem de
leitura "CPO antes de lacrado" (regra que nasceu do erro de 27/07) segue de pe.

**Dois fornecedores novos**, ambos marcados pelo dono no proprio chat: `All
imports` (São João de Meriti — RJ, praca DEDUZIDA dos pontos de retirada, nao
declarada) e `João Telles` (Bangu — RJ, 35 precos).

Descartes por regra do dono: 1 aparelho com "mensagem" (Raposa), 3 com aviso
(Quality), 2 paralelos cotados em dolar, 1 "caixa aberta" (MP), 2 "lacre
rompido", 1 `pack com 1 AirTag` (o mesmo erro de 03/08, pego de novo), e os nao
Apple da rodada.

---

## 3. As tres classes de custo puro, que exigiram CODIGO

No meio da sessao o dono mandou: **"adicione airpods, com classe de 1 linha.
garmin passe a adicionar. moto eletrica tambem, aparecendo sempre como moto
eletrica. sobre valores de lucro, nenhum. apenas o custo."**

Carregar isso no banco nao bastava, e esse foi o achado da sessao:

```js
function mg(c){return c==='MacBook'?{av:CFG.mav,pc:CFG.mpc}:{av:CFG.iav,pc:CFG.ipc}}
```

**Toda categoria diferente de MacBook caia no `else` e ganhava a margem de
iPhone.** Garmin e moto eletrica apareceriam com `+R$550 a vista / +R$650
parcelado` e preco de venda calculado, exatamente o oposto do pedido.

O que mudou em `public/calc/index.html` (4 pontos, 13 linhas):

1. `SEMMARGEM` (Set) e `semMargem(c)`, e `mg()` devolvendo `{av:0,pc:0}` para
   elas. A margem das outras segue saindo do `config`, nunca fixa no codigo.
2. `vCalc()` **esconde** o painel de preco de venda para essas classes. Exibir
   margem 0% acenderia o alerta vermelho de "margem baixa" numa moto: ruido, nao
   aviso.
3. O rotulo da categoria diz `só custo` em vez de `+R$550 / +R$650`.
4. O scanner de oportunidades as ignora, como ja fazia com `Acessório`, porque
   ranqueia por margem.

**Detalhe que evitou um erro caro:** os AirPods paralelos entraram como
`AirPods Pro 1ª linha`, nao `AirPods Pro`. A calc trata mesmo `n` + `t` como
opcoes do MESMO aparelho, entao o paralelo de R$69,99 apareceria como "opcao mais
barata" do AirPods Pro original de R$1.500.

Entraram 16 precos: `1ª Linha` 2, `Garmin` 10, `Moto Elétrica` 4.

---

## 4. O erro que quase custou 25 commits, e nao era de preco

Na hora do push: o clone local estava **25 commits atras do GitHub**. O commit
tinha sido feito em cima de `266f614`, base de tres dias antes. Um `--force`
teria apagado o painel de Performance de Vendas, a Fatia 2 do Escopo, o molde de
conteudo e o bloco de Pos-Venda.

Pior: `e95edf4` havia **renormalizado `public/calc/index.html` de CRLF para LF**
(1.443 linhas) junto com o `.gitattributes` novo. Um rebase conflitaria linha a
linha no arquivo inteiro.

O que foi feito, sem forcar nada: branch de seguranca, `git reset --hard
github/main`, **reaplicar as quatro edicoes** sobre a versao em LF, regerar o
`dados.js`. Resultado identico (134 produtos, 405 precos) e diff final de **3
arquivos, 92 linhas**.

**Correcao de fato que a skill afirmava errado desde 27/07:** o push SAI daqui.
O remote morto e o `origin` (proxy em `127.0.0.1:41729`); existe um remote
`github` com a URL real que faz fetch e push. `git push github HEAD:main`
funcionou, exit 0, sem precisar do prefixo `!`. Cinco versoes de skill cobraram
do dono um passo que a maquina podia dar.

---

## 5. Duas armadilhas tecnicas novas

**Postgres dobra `1/0` em tempo de planejamento.** A trava da gravacao escrita
como `case when contagem_ok then true else (select 1/0)::boolean end` estourou
`division by zero` ANTES de olhar o dado, reprovando uma carga correta. Guard-rail
se escreve em bloco `DO ... raise exception` depois do insert, dentro da mesma
transacao. Mesmo padrao ja usado para provar RPC sem sujar producao.

**Payload grande vai para staging antes de transformar.** Quando a trava furada
derrubou a transacao, os 35 KB do payload foram junto. Passou a gravar em
`privado.carga_1508` primeiro; dai a transformacao vira retentavel de graca. A
forma compacta (`n|c|t|f|cor:v`) cabe em 35 KB contra 91 KB do JSON.

**`/calc/index.html` mente.** O worker roda com `not_found_handling:
single-page-application`: essa URL devolve outra pagina sem erro e fez parecer
que o deploy nao tinha subido. A URL real e `/calc/`.

---

## 6. Provas, todas com EXIT CODE conferido

| prova | resultado |
|---|---|
| `node ferramentas/prova_sem_margem.js` (**nova**) | 22/22, exit 0 |
| `node ferramentas/prova_cpo.js` | 39/39, exit 0, sem regressao |
| `python ferramentas/validar.py` | TUDO PASSOU, exit 0 |
| `node --check public/app.js` | exit 0 |

A `prova_sem_margem.js` le `SEMMARGEM`, `semMargem` e `mg` **do arquivo real**,
nao copia a logica, e cobra tambem que a margem continue vindo do `config`
(roda `mg()` com um config diferente e exige que acompanhe).

**Checksum dos dois lados, que e o que prova que o dado atravessou:**

- blob: 501 produtos, 1.043 precos, soma `4.176.656,24`, iguais no Node e no
  Postgres, com zero cor sem hex, zero fornecedor sem praca, zero preco invalido;
- derivacao do consultor conferida contra o BANCO, nao contra o proprio calculo:
  405 precos, soma pv `1.819.793,99` e pp `1.860.293,99`, identicas.

Deploy provado por `curl` no worker: `134 produtos, 405 precos, validade
22/08/2026`, e `SEMMARGEM` presente 3x em `/calc/`. Do push ao ar: ~30 segundos.

---

## 7. Onde encostou

- `public/calc/index.html` — 4 pontos, 13 linhas (as tres classes sem margem).
- `public/calc/consultor/dados.js` — regerado, 134 produtos, validade 22/08/2026.
- `ferramentas/prova_sem_margem.js` — novo, 22 assercoes.
- `public.calc_dados` (tenant `...0001`) — blob novo, `config` preservado byte a
  byte (`d 300 · iav 550 · ipc 650 · mav 1200 · mpc 1300 · s300 false · scusto true`),
  `bateria` e `tela` seguem `[]`.
- `.claude/skills/calculadoras/` — `SKILL.md` mais os 4 `references/`.
- Commit `c760722`, no ar.

Nao encostou em: `app.js`, `app.css`, `index.html` do painel, schema, RLS, RPC.

---

## 8. Pendencias

1. **`Acessório` continua ganhando margem de iPhone.** Um AirPods Pro original de
   R$1.500 aparece com venda de R$2.050. Se a regra "so custo" valer para
   acessorio, e acrescentar a categoria ao `SEMMARGEM`. Nao foi feito porque o
   dono nao pediu.
2. **`calc_dados` tem uma linha orfa**, tenant `...0004`, com o blob de 27/07 (341
   produtos). A RLS filtra e a tela do dono le a certa, mas o `.single()` do
   `index.html` quebraria se alguem logasse num tenant que enxergasse as duas.
3. **A validade continua sem alerta.** Venceu calada duas vezes em tres semanas.
   Enquanto nao houver aviso, depende de alguem lembrar de olhar.
4. **`dados.js` do consultor segue publico** e sem RLS: `curl` sem sessao baixa
   preco de venda e a escada de comissao completa. Aberto desde 27/07.
5. **Netlify aposentada mas ainda publicada**, com custo de fornecedor aberto.
   Despublicar e clique no painel, fora do alcance do Claude Code.
6. **Rafael e DG Jacarepaguá mandam a mesma lista**, preco a preco, mudando so a
   retirada. Seguem como dois fornecedores; vale o dono decidir se unifica.

---

## 9. Licao desta sessao

**O risco maior nao estava onde a skill olhava.** Toda a disciplina da
`calculadoras` foi construida em torno de erro de leitura de preco: trava de 15%,
faixa de sanidade, pilha de pendencias. Isso funcionou, e a carga saiu com zero
variacao suspeita.

O que quase deu errado foi o git: uma base velha e um arquivo renormalizado, que
nenhuma trava de preco pegaria. E a segunda vez que este projeto descobre que uma
afirmacao repetida por varias versoes de documento nunca tinha sido medida (a
primeira foi o "diff gigante" do `.gitattributes`, na v59). Aqui foram duas ao
mesmo tempo: "o push sempre falha" e "so tres provas Python".

Medir antes de repetir vale tanto para o que a skill diz sobre o mundo quanto
para o preco que o fornecedor manda.
