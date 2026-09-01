# Handoff Financeiro v10 — a suite para de mentir por omissao

Data: 01/09/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v9.md`
como topo da linha.

Conserto de portao, aberto por `P-AUDITA`. **Nao e entrega de feature: nenhuma
migration, nenhuma RPC, nenhuma mudanca em `public/app.js` ou `public/app.css`.**
Um arquivo tocado: `ferramentas/harness.py`.

---

## 1. A frase da entrega

**A suite executa todas as assercoes que declara, e reprova sozinha quando parar
de executar.**

Sujeito visivel: o rodape do `harness.py` deixa de ser so `965 passou, 0 falhou`
e passa a trazer a linha que faltava:
`967 declaradas, 962 executadas, 0 nao executaram (5 de ramo alternativo, previstas)`.

---

## 2. O que estava errado

Em 31/08/2026 o handoff v9 declarou `harness.py` EXIT 0, 962/962. Em 01/09/2026,
sem ninguem tocar em uma linha de codigo, a mesma arvore deu **EXIT 1, `774 passou,
10 falhou`**, com `rodar()` abortando na assercao 784.

O rodape contava so o que rodou. **178 assercoes declaradas nunca executaram**, e
o numero impresso nao dizia isso. Quanto mais cedo a suite morresse, melhor ela
parecia. Entre as 178:

- **73 das 80 assercoes `fin3:`** da entrega que o v9 tinha acabado de aprovar;
- **as 56 `fin2:` de regras, inteiras**;
- os blocos de Importar (previa OFX, encoding ISO-8859-1, dedupe, caminho do
  Storage com `tenant_id`), lote, classificacao na linha, desfazer par, a nota do
  abatimento.

Isolamento medido em worktree no commit anterior (`15ab208`), no mesmo dia e na
mesma maquina: **903 assercoes executadas, 8 falhas, todas `dash/mes`, sem crash.**
Depois do range: 784 executadas, as mesmas 8 mais duas novas. As duas eram desta
entrega.

**Causa raiz:** a tela deriva a janela de `new Date()` (`l()` -> `finMes()` ->
`finJanela()`, e o mesmo caminho no Dashboard), enquanto os fixtures tem **79
datas chumbadas em 27 escopos, nenhuma depois de 31/08/2026**. Enquanto o relogio
da maquina esteve em agosto os dois casaram. No dia 1 de setembro a janela virou
`01/09 a 01/09` e os fixtures ficaram inteiros fora dela: `fin_movimentos`
devolveu zero linha, `finQ('.fin-lin')` voltou `null`, `.className` estourou e
`rodar()` caiu no `catch`.

---

## 3. O que mudou

Tudo em `ferramentas/harness.py`. Zero mudanca de produto.

### 3.1 A trava: declaradas contra executadas

O lado Python passa a extrair do proprio `TESTE` a lista de rotulos declarados
(967 chamadas reais de `ok(`, todas com rotulo literal; a unica sem literal e a
definicao da funcao), casa cada linha do log com o rotulo pelo **prefixo mais
longo** (o `extra` sai como `  <...>` no fim e ha rotulo que contem `<`), e
**reprova com EXIT 1 nomeando cada assercao declarada que nao executou**.

Essa trava fica ligada em definitivo. E o guard-rail desta entrega.

### 3.2 `okRamo`, para o ramo que nao pode executar

Existem ramos mutuamente exclusivos: o mes corrente tem venda **ou** esta vazio.
Metade dos rotulos nao pode rodar na mesma corrida. Marcar com `okRamo` diz isso
**no proprio ponto do codigo**, em vez de manter lista de excecao longe dali, que
e o tipo de lista que apodrece calada.

Cinco rotulos marcados, e so cinco:
- os 3 do ramo `vgMesVazio` e os 2 do `else`;
- a guarda de falha rapida `LEAD-0005 na fila`;
- `quando o card discorda da faixa do topo, ele EXPLICA a divergencia`, que
  depende da forma do dado (queda bruta alta com ritmo baixo).

**Regra escrita no codigo:** so vira `okRamo` quem esta dentro de um `if/else`
cujo outro lado tambem afirma alguma coisa. Nao e para silenciar assercao que
deixou de rodar.

### 3.3 O relogio congelado, que e o mecanismo

**Redatar os fixtures a partir de hoje NAO resolve.** O Financeiro precisa de 12
dias distintos dentro do mes corrente, e no dia 1 do mes esses 12 dias nao
existem. Nenhuma aritmetica de data cria dia que o calendario nao tem.

Entao congelou-se o relogio, nao os dados. Um `Proxy` sobre `Date`, instalado no
topo do `STUB` (antes do `app.js`, senao ele ja leu o relogio), fixa a pagina em
**25/08/2026 12:00 em Sao Paulo**. So a construcao sem argumento e `Date.now()`
sao interceptadas: `new Date(x)` continua real, senao data de fixture pararia de
ser interpretada.

Por que 25/08: cai depois da linha mais nova do `FIN_MOVS` (20/08), deixa o mes
anterior povoado (julho tem v1, v2 e v3 do `VENDAS_STUB`, que e o que as
assercoes `dash/mes` existem para cobrir) e mantem `f12` (30/07) FORA da janela,
que e o caso de proposito do par de repasse que atravessa a virada do mes.

Isso conserta os 27 escopos de uma vez, sem tocar em nenhuma das 79 datas.

### 3.4 A prova nova: uma assercao que vigia o mecanismo

`a suite mede com o relogio congelado, nao com o da maquina`. O Python injeta a
data REAL da maquina no `TESTE` (fora do alcance do `Proxy`) e a assercao compara
os dois relogios. Hoje ela imprime:

```
PASSOU  a suite mede com o relogio congelado, nao com o da maquina  <pagina=2026-08-25 maquina=2026-09-01>
```

Sem ela, alguem tira o congelamento e a suite volta a depender do dia sem que
ninguem descubra ate a proxima virada de mes.

### 3.5 Guardas de null, so onde abortava

Quatro pontos guardados, e so os que de fato abortavam: `.fin-lin` em duas
assercoes, e o `.value =` de `fxCat`, `fxDom` e `fxLimpa`. **So o TOQUE ficou
condicional; as assercoes seguem executando e caem vermelhas sozinhas.** Envolver
as assercoes no `if` as faria sumir da contagem, trocando um jeito de mentir por
outro.

Os outros 166 pontos de leitura sem guarda continuam la, nomeados na secao 6.

### 3.6 Watchdog e orcamento de tempo virtual, quarta vez

Medido em serie: em 5 corridas do mesmo commit, **uma travou na assercao 704**, no
bloco `veredito:`, com as outras quatro indo ate o fim. Nao era estouro
determinista, era margem curta. Os dois subiram juntos, como a regra ja escrita no
arquivo manda: watchdog `100000 -> 150000`, `--virtual-time-budget 120000 ->
200000`, folga de 20s para 50s.

### 3.7 Uma corrida instavel, consertada

`fin: OFX sem lancamento diz o que houve` caia em 1 de cada 3 corridas com
`<sem recado>`: `finSoltar` espera por `.fin-previa` **ou** `.estado.erro`, que e
generico demais ali. Entrou uma espera limitada (15 tentativas) pela condicao que
a propria assercao afirma. Se o recado nunca vier, ela continua vermelha.

---

## 4. O que foi PROVADO

### 4.1 A trava, provada ANTES de consertar qualquer outra coisa

Com a trava ligada e o crash ainda presente:

```
EXIT 1
774 passou, 10 falhou
966 declaradas, 779 executadas, 187 nao executaram

REPROVOU: 187 assercoes declaradas NAO executaram.
A suite parou antes do fim e o rodape contou so o que rodou.
  NAO EXECUTOU  LEAD-0005 na fila
  NAO EXECUTOU  janela do mes corrente tem venda: o painel mostra as barras
  ...
```

### 4.2 Determinismo, medido em serie

Seis corridas seguidas depois do conserto:

| corrida | EXIT | resultado |
|---|---|---|
| 1 a 6 | **0** | `965 passou, 0 falhou` · `0 nao executaram (5 de ramo alternativo, previstas)` |

Antes do conserto, 5 corridas davam 4 verdes e 1 travada. **Guard-rail que dispara
sozinho em 20% das corridas nao mede a suite, mede a sorte.**

### 4.3 Comandos, EXIT code

| comando | EXIT |
|---|---|
| `python ferramentas/validar.py` | 0 |
| `python ferramentas/harness.py` | **0 (966 passou, 0 falhou; 967 declaradas, 962 executadas)** |
| `python ferramentas/prova_trilho.py` | 0 |
| `python ferramentas/prova_grafico.py` | 0 |
| `python ferramentas/prova_atmosfera.py` | 0 |
| `node --check public/app.js` | 0 |
| `diag_mobile.py` 360 / 390 / 414 / 1280 / 1440 | 0 / 0 / 0 / 0 / 0 |

Baselines `.antes` NAO foram repontadas. `git status` mostra um arquivo modificado.

---

## 5. O que NAO foi provado

1. **A prova por fuso horario falhou como prova.** Rodei com `TZ=Pacific/Kiritimati`,
   `Pacific/Midway` e `Asia/Tokyo`: os tres deram EXIT 0, mas a data local nao
   chegou a virar em nenhum, entao a corrida nao demonstrou o que eu queria. A
   prova que vale e a da secao 3.4, que compara os dois relogios dentro da pagina.
   **Nao existe hoje, nesta stack, um jeito barato de rodar a suite com a data do
   sistema deslocada.** Fica nomeado.
2. **O estado vazio da Visao geral continua sem prova deterministica.** Com o
   relogio em 25/08 o mes corrente tem venda, entao o ramo `vgMesVazio` nao roda.
   As tres assercoes dele estao declaradas como `okRamo` e nao executam. Antes
   disso elas tambem nao rodavam, por outro motivo: o mes corrente quase sempre
   tinha venda.
3. **Os 166 pontos restantes de leitura sem guarda de null.** So os 4 que abortavam
   hoje foram guardados. Qualquer um dos outros pode abortar a suite inteira no dia
   em que o elemento faltar.

---

## 6. Achado que muda o entendimento do defeito

**A decima falha nao era defeito da tela. Era a prova que estava quebrada.**

`e o aviso fica DENTRO da coluna de graficos, sem derrubar os valores` procurava
`#lista .vg-graficos .vg-vazio`. **A classe `vg-graficos` nunca existiu**: nao esta
no `public/app.js` nem no `public/app.css`, so no proprio harness. A coluna de
graficos e `.vg-graf`, e `vgVazio(a)` ja e desenhado dentro de
`<div class="vg-graf g-meses">`, que e exatamente o que a assercao queria afirmar.

Ou seja: **a tela sempre esteve certa e a assercao nunca poderia passar.** Ela so
nao aparecia vermelha porque o ramo nunca tinha sido alcancado. O seletor foi
corrigido; `public/app.js` nao foi tocado.

Consequencia para o plano: a etapa que existia para "consertar o defeito do estado
vazio" nao tinha defeito para consertar.

---

## 7. Pendencias, nomeadas e nao consertadas

- **Os 9 campos orfaos** (campo devolvido por RPC sem leitor em `public/app.js`):
  `entrada_id`, `saida_id` e `diferenca_pct` em `fin_repasse_marcar` (os tres
  nascidos no bloco 1); `ini_anterior` e `fim_anterior` em `fin_painel`;
  `linhas_pendentes` e `valor_pendente` em `fin_cobertura`; `dominio_sugerido` em
  `fin_config.categorias[]`; `dominio_padrao` em `fin_config.contas[]`.
  Os 6 ultimos sao da fatia 1.
- **`fin_repasse_desmarcar` escreve "1 lancamento voltaram"** quando `v_n = 1`
  (orfao de par): o singular foi tratado no substantivo e esquecido no verbo.
- **4 recusas fora da secao 4 do CONTRATO**, todas de
  `20260826_fin_fatia1_rpcs_escrita.sql`: `Informe os lancamentos a classificar.`,
  `Lista de lancamentos invalida.`, `Categoria desconhecida neste tenant.`,
  `Classificacao recusada pelo banco: confira o dominio.`
- **A contagem 119 contra 118** entre a faixa (`fin_movimento` com `dominio is
  null`) e a cobertura (`privado.fn_fin_cobertura`, que trata categoria neutra como
  julgada). A diferenca e correta e explicavel, mas as duas aparecem na mesma aba
  sem que a tela diga por que diferem.
- **`CLAUDE.md` e o handoff v9 declaram numeros de suite que nunca foram verdade
  nesta data.** O `CLAUDE.md` diz "885 assercoes, 0 falhas" (medido em 26/08) e o
  v9 diz "962/962, EXIT 0" (01/09). Em 01/09 a suite dava 774/784 com EXIT 1.
  **Nao corrigi nenhum dos dois: os dois arquivos estao fora do escopo desta
  entrega, por instrucao explicita.** Entram no proximo prompt.
- **As 8 falhas `dash/mes` nunca foram registradas em handoff nenhum.** `grep -rn
  "dash/mes" docs/` devolvia zero linha antes desta entrega. Ficam registradas aqui
  como o que eram: regressao de calendario, nao divida declarada.
- **RLS das RPCs de repasse: FECHADA.** Era pendencia desde a v4. A auditoria
  provou no banco, com `set local role authenticated`: vendedor ve 0 movimentos,
  dono ve 1132, sem sessao ve 0; `fin_repasse_marcar` e `fin_repasse_desmarcar`
  devolvem `Financeiro e restrito ao dono.` como vendedor e `Sessao invalida.` sem
  claims.

---

## 8. Portao de saida

| # | Item | Resposta |
|---|---|---|
| 1 | SQL rodado no banco de verdade | **N/A.** Nenhum SQL nesta entrega |
| 2 | RLS testada como dono E como vendedor | **N/A** aqui, mas provada na auditoria (secao 7) |
| 3 | a tela le todo campo novo, zero campo orfao | **N/A.** Nenhum campo novo. Os 9 orfaos existentes estao na secao 7 |
| 4 | assercao nova com prefixo de fatia | **1 assercao nova**, e ela e guard-rail, nao feature: `a suite mede com o relogio congelado, nao com o da maquina` |
| 5 | EXIT 0 nos comandos e nas 5 larguras | **SIM.** Secao 4.3 |
| 6 | commit unico | **SIM** |
| 7 | handoff atualizado | **SIM.** Este arquivo |
| 8 | nenhuma recusa nova fora da secao 4 | **SIM.** Nenhuma recusa criada |

### 8.1 Portao de confianca

**NAO. Nenhum numero visivel na tela mudou de valor nesta entrega.** `public/app.js`
e `public/app.css` nao foram tocados: `git diff --stat` mostra um arquivo,
`ferramentas/harness.py`. O unico numero que mudou e o rodape da suite, que e
ferramenta de quem constroi, nao tela do dono, e ele mudou justamente para passar
a declarar o que antes omitia.

---

## 9. Invariantes reforcados

- **CONTRATO 6.1**: item reprovado no portao vira a entrega da vez. Foi o que
  aconteceu: `P-AUDITA` reprovou a suite e o bloco 2 nao comecou.
- **Disciplina de validacao**: "conferir o EXIT CODE, nunca o texto da saida" ganha
  um segundo andar. Nao basta o EXIT: **o numero de assercoes que EXISTEM no
  arquivo faz parte do criterio.** Suite que encolhe calada passa no EXIT e mente.
- **Invariante 10, do lado do teste.** O invariante proibe `CURRENT_DATE` onde se
  produz data de negocio, porque o relogio tem que ser declarado. O harness fazia
  exatamente o que o invariante proibe: dependia do relogio da maquina, sem
  declarar. Agora o relogio dele e explicito e afirmado.
- **Entrega vertical (C6)**: esta entrega e de ferramenta, e termina em algo que o
  dono abre e le: o rodape do comando que ele mesmo roda no portao.

---

## 10. Primeiro movimento do proximo chat

`P-ABRE`. O portao agora tem tres numeros para conferir, nao dois: **EXIT 0,
`0 falhou`, e `0 nao executaram`.**

Depois dele, a divida de documentacao que esta entrega nomeou e nao pode corrigir:
`CLAUDE.md` (que ainda diz "885 assercoes") e o handoff v9 (que diz "962/962,
EXIT 0" para uma data em que a suite dava 774/784). Os dois sao arquivos de raio
grande e pedem o molde de duas fases.
