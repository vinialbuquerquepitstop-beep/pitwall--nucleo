# Handoff Migracao Pit Wall (Nucleo) v46

Substitui a v45. Data: 05/08/2026.

---

## 1. Headline: a aba Escopo existe, e a suite deixou passar uma tela onde nenhum botao funcionava

Pedido do dono: *"preciso de uma sessao de escopo, onde tenha todas as frentes e
acoes dessas frentes para monitoramento de progresso e processo. e que seja
editavel, para adcicionar e alterar por la mesmo."*

Entregue: a **Fatia 1** de uma aba nova, com 8 frentes de operacao, um placar que
ordena da melhor para a pior frente, e a capacidade de criar acao, mudar status no
toque, travar com motivo e descartar. 22 commits, 6 migrations, 3 tabelas novas.

**O numero que importa mais que os outros: 6 defeitos reais foram achados e
fechados, cada um reproduzido contra o banco ou o arquivo real antes da correcao.**
Cinco foram pegos durante a execucao. **O sexto foi para producao**: a aba subiu com
TODO o caminho de escrita morto em runtime, e ficou assim ate a revisao final voltar
(secao 4.6). O dono mandou subir sabendo que a revisao estava pendente; a correcao
subiu logo em seguida, no commit `4b8b93d`.

Se este handoff for lido por cima, leia so isto: **prova de escrita por
string-matching sobre a fonte casa igual com o codigo quebrado.** Foi assim que 69
assercoes verdes conviveram com quatro botoes que so lancavam TypeError.

---

## 2. O que a aba faz

Aba **Escopo**, na gaveta "Mais". Tres coisas:

1. **O placar**: as 8 frentes ordenadas pela nota, da melhor para a pior, com as
   tres parcelas sempre visiveis ao lado do numero.
2. **As frentes**: um bloco por frente, com as acoes dentro.
3. **Pendencias** separada no fim, para o backlog tecnico que nao e frente.

Frentes semeadas: `colaboradores`, `producao_marketing`, `assistencia`,
`captacao_organica`, `whatsapp` (Status como canal de post), `pitscare`,
`comercial`, `calculadoras`.

### 2.1 A nota, e por que ela mostra as parcelas

| parcela | peso | conta |
|---|---|---|
| Avanco | 40 | `feitas / total` |
| Fluidez | 30 | desconta as travadas |
| Movimento | 30 | cheio ate 7 dias sem evento, zero aos 30, linear entre |

Faixas: `a frente` >= 70 · `normal` 40 a 69 · `em baixa` < 40 · **`sem dado`** para
frente sem acao nenhuma.

`sem dado` e faixa PROPRIA de proposito. Dependendo da conta, frente vazia
apareceria como 0 ou como 100, e nos dois casos o painel mentiria: o que existe ali
e ausencia de dado, nao desempenho.

A nota nunca aparece sozinha. Nota escondida vira fe, e ninguem discute com fe.

---

## 3. Decisoes

1. **A aba vive dentro do Pit Wall**, com tabela no Supabase, e nao como Artifact,
   Notion ou markdown. Escolha do dono ciente de que era a mais cara das quatro.
2. **Frente e area permanente, nao pendencia.** A primeira versao do desenho semeou
   as frentes com o backlog do v43/v44/v45 e foi reprovada pelo dono: era backlog
   disfarcado de mapa.
3. **Grupo tecnico cortado** (banco, tela, provas, infra): nao compara com area de
   negocio na mesma coluna.
4. **`crm_legado` cortada**, morta. Ninguem usa mais a planilha.
5. **`arquivada` quer dizer DESCARTADA**, nao "guardada". A tela diz "Descartar".
   Acao concluida NAO se descarta: fica como `feito` e continua contando o Avanco.
   A RPC foi renomeada de `arquivar_acao_escopo` para `descartar_acao_escopo` ANTES
   de existir, portanto de graca. Motivo: `arquivar` acumulava "isso foi um erro" e
   "isso ja foi feito", e o segundo ja tem representacao propria no status.
6. **A auditoria e garantia do banco, nao disciplina de chamada.** Trigger
   `tg_escopo_acao_evento`, nao insert manual dentro das RPCs.
7. **Travar nao entra no ciclo do chip.** Um ciclo que passasse por `travado`
   obrigaria a inventar motivo toda vez que a acao anda de `fazendo` para `feito`.
   Travar e interrupcao, nao etapa: ganhou controle proprio. Destravar volta para
   `fazendo`, nao para `a_fazer`, porque o trabalho ja tinha comecado.
8. **`em baixa` reusa `var(--erro-fg)`**, sem token novo. Ver secao 5.
9. **`prompt()` do navegador para o motivo da trava na Fatia 1.** Feio e bloqueante,
   escolha consciente do dono; campo decente entra na Fatia 3.
10. **Criterio de aceite por acao ficou FORA**, a pedido do dono. Consequencia
    aceita: o painel aceita "feito" declarado sem prova anexada.

---

## 4. Os 6 defeitos, e o que cada um ensina

### 4.1 O placar nascia manipulavel (Task 1b)

`UPDATE` direto em `escopo_acao` mudava o status e gerava **0 eventos**. E a policy
de INSERT em `escopo_acao_evento` so checava `tenant_id`, sem exigir `dono`, entao
um **vendedor inseria evento na mao**. Como `dias_parada` vale 30 dos 100 pontos,
qualquer usuario do tenant podia inflar a nota de uma frente parada.

Reproduzido antes de corrigir. Virou trigger, que garante o evento venha de onde
vier. **Licao: auditoria que depende de todo mundo lembrar de chamar a RPC certa
nao e auditoria, e convencao.**

### 4.2 Descartar comprava 30 pontos de Movimento (Task 2)

A subquery de `ult_evento` nao filtrava `arquivada`, enquanto `total`, `feitas` e
`travadas` filtravam. Numa frente parada ha 40 dias, **criar e descartar uma acao
descartavel derrubava `dias_parada` para 0 e dobrava a nota, de 30 para 60.**

Medido:
```
ANTES : dias_parada=40 nota=30 total=1
DEPOIS: dias_parada=0  nota=60 total=1
```

**Licao: quando parte de uma conta filtra uma populacao e outra parte nao filtra,
existe um vetor de manipulacao ali, sempre.**

### 4.3 Titulo de 5000 caracteres entrava inteiro (Task 3b)

Teto de 160 com recusa explicita. **Nunca truncar em silencio**: texto cortado sem
aviso e pior que texto recusado. Duas assercoes, nao uma: 5000 recusado E 160
exatos passando, senao o teto poderia estar em qualquer lugar entre 1 e 5000.

### 4.4 O requisito numero um do dono era codigo morto (Task 5b)

O ciclo do chip era `prox="a_fazer"===st?"fazendo":"fazendo"===st?"feito":"feito"===st?"a_fazer":"a_fazer"`.
Os quatro ramos sao `fazendo`, `feito`, `a_fazer`, `a_fazer`: **`travado` nunca era
destino.** Logo o `if("travado"===prox&&prompt(...))` era inalcancavel, e o unico
`prompt(` do arquivo vivia dentro dele.

A Fatia 1 prometia "status + o que trava" (o requisito que o dono escolheu primeiro)
e **nao entregava caminho nenhum de UI**. Acao so apareceria travada por escrita
direta no banco.

**Licao: codigo que existe nao e funcionalidade que roda. Uma condicao sempre falsa
e indistinguivel de uma feature completa, para quem so le o diff.**

### 4.5 A aba nao abria no clique, e nenhuma prova clicava nela (Task 5c)

Das 12 abas do app, 11 tinham `Y("abaX","click",function(){G("...")})`. A
`abaEscopo` **nao tinha**. Clicar nao fazia nada: sem erro, sem toast, sem tela.

Isso conviveu com **57 assercoes verdes e cinco suites no baseline**, porque:
- `prova_escopo.js` recorta funcoes e as executa isoladas, nunca navega;
- a lista `abasIds` do `diag_mobile.py` nao incluia `abaEscopo`;
- `harness.py` nao tinha stub de `escopo_completo` nem clicava na aba.

**Esta e a licao mais cara da sessao, e ela ja estava escrita no `CLAUDE.md`:
encanamento provado nao e entrega.** A suite media tudo, menos se a porta abria.

Consertar so o binding deixaria a armadilha armada para a proxima aba. Entrou junto:
teste de navegacao real no harness (6 assercoes que FALHARAM antes do patch),
`abaEscopo` no `diag_mobile`, e uma guarda que cobre **as 12 abas**, nao so a nova.

---

### 4.6 O sexto defeito, achado DEPOIS do deploy: todo o caminho de escrita estava morto

A revisao final voltou depois do push, por decisao do dono de subir sem esperar
por ela. Ela achou o pior defeito de todos.

O delegado e `function A(a){var e=a.target...closest("[data-acao]")...}`: **`a` e o
EVENTO, `e` e o ELEMENTO.** Os 11 handlers que ja existiam usam `e.getAttribute`.
O bloco do Escopo entrou usando `a.getAttribute`, que nao existe em `Event`.

Medido: os **7** unicos `a.getAttribute` do `app.js` inteiro estavam nesse bloco, e
`e.getAttribute` la dentro: **0**. Cada toque em chip, travar, adicionar ou
descartar morria em `a.getAttribute is not a function`, sem chamar RPC nenhuma, e o
dono via toast vermelho.

Eram **12 pontos, nao 7**: 5 chamadas passavam o Event como argumento "botao" de
`q()`, e `O()` faz `o.disabled=!0` nele, entao a trava de toque duplo nunca se
aplicava ao botao de verdade.

**Por que passou por TRES revisoes:** toda prova do caminho de escrita era
string-matching sobre a fonte (`SRC.indexOf('p_status:"travado"')`), que casa igual
com o codigo quebrado. As 69 assercoes do `prova_escopo.js` eram verdadeiras e
irrelevantes para escrita. Nenhuma prova CLICAVA no controle.

A correcao da Task 5c consertou o ponto cego de **navegacao** (a aba nao abria) e
declarou o problema resolvido. O ponto cego de **acao** continuou aberto, uma camada
abaixo. Corrigir a categoria errada de um ponto cego e pior que nao corrigir: da a
sensacao de que a lacuna fechou.

O harness ganhou 7 assercoes que clicam de verdade e conferem a chamada de RPC
resultante, incluindo `prompt` cancelado e ausencia de TypeError. Elas FALHARAM
antes da correcao (`chamadas: 0`) e passam depois. 165 -> **172 passou / 3 falhou**.

Junto, a mesma correcao fechou: o **placar de LEAD aparecia empilhado em cima do
placar de frentes**, porque a aba nova nao entrou na lista que esconde o
`#pitboard`. A guarda que pegaria isso (`validar.py` linha 172) esta vermelha e
herdada desde a v45, e a obra passou por cima dela sem alarme.

---

## 5. Cor: nenhum token novo

A primeira versao criava `--escopo-baixa-fg:#B01235` e `--escopo-baixa-bg:#FBEAEE`,
e o `validar.py` REPROVOU. Ele estava certo: **`--erro-fg:#B01235` e
`--erro-bg:#FDEDF0` ja existem no `:root`.** Cor identica com nome diferente nao e
organizacao, e drift garantido: no dia em que alguem retunar uma das duas, a outra
fica para tras em silencio.

O implementador tinha aberto uma excecao `TOKENS_ESCOPO` dentro do `validar.py`
para acomodar a duplicata. Foi revertida. **Guard-rail que aponta um problema real
nao se cala abrindo excecao para o problema.**

`em baixa` usa `var(--erro-fg)` direto. Isso NAO e o mesmo que reusar `--quente`:
reusar o quente INVERTERIA significado (la quente e bom, lead novo). Medido: 7.04:1
sobre branco, 6.22:1 sobre o tint.

---

## 6. Estado das provas

| prova | resultado |
|---|---|
| `ferramentas/prova_escopo.sql` (novo) | **45 ok / 0 falhas** |
| `node ferramentas/prova_escopo.js` (novo) | **69 assercoes / 0 falhas**, EXIT 0 |
| `node --check public/app.js` | EXIT 0 |
| `python ferramentas/harness.py` | **165 passou / 3 falhou** (era 158/4) |
| `python ferramentas/validar.py` | EXIT 1, **4 reprovacoes herdadas** (era 5) |
| `python ferramentas/prova_trilho.py` | EXIT 0 |
| `python ferramentas/diag_mobile.py 360 / 390 / 414` | EXIT 0 nos tres, 0 sobreposicoes |
| `node ferramentas/prova_{cliente,nf,metricas,regua,sessao,venda_editar}.js` | EXIT 0 nos seis |

As 3 falhas do harness sao de Vendas e NF, sem relacao com o Escopo.

### 6.1 A assercao das abas raras, corrigida nas DUAS ferramentas

`esperava 6 abas raras` estava em `validar.py:212` E em `harness.py:712`. Notas
fiscais (v40+) e Escopo entraram e ninguem atualizou o numero. Subiu para 8 nos dois,
**item unico e nomeado**. A baseline `.antes` NAO foi repontada: repontar calaria as
outras reprovacoes herdadas de carona.

### 6.2 Como provar integridade do `app.js` minificado

O v45 mandava comparar prefixo e sufixo. **Isso e furado**: so vale para UMA insercao
contigua. Com 6 costuras espalhadas, a primeira ja desalinha a comparacao e o numero
vira lixo (acusou 93301 bytes removidos onde nada foi removido).

O metodo que prova de verdade e **reaplicar o patch sobre o baseline e exigir
igualdade total**. Normalizar CRLF e obrigatorio (`git checkout` converte fim de linha
nesta maquina, e o `app.js` tem blocos multi-linha colados abaixo do nucleo).

---

## 7. Objetos novos no banco

| objeto | o que e |
|---|---|
| `escopo_frente` | 9 linhas: 8 frentes + `pendencias` (`grupo='pendencia'`, ordem 99) |
| `escopo_acao` | acoes, com CHECK que barra `travado` sem motivo |
| `escopo_acao_evento` | append-only, `authenticated` so tem SELECT e INSERT |
| `privado.fn_escopo_evento()` | trigger que garante o evento, em `privado` (invariante 8) |
| `escopo_completo()` | leitura da aba inteira, com a nota derivada |
| `criar_acao_escopo(p_frente, p_titulo)` | teto de 160 chars |
| `mudar_status_acao_escopo(p_id, p_status, p_motivo)` | travar exige motivo; destravar LIMPA o motivo |
| `descartar_acao_escopo(p_id)` | `arquivada = true`, nunca DELETE |

Migrations, em ordem: `escopo_fatia1_schema`, `escopo_fatia1_harden`,
`escopo_fatia1_rpc_leitura`, `escopo_fix_movimento_arquivada`,
`escopo_fatia1_rpcs_escrita`, `escopo_teto_titulo_acao`.

---

## 8. Como conferir (caminho exato)

O app **NAO foi publicado**: por decisao do dono, os 22 commits estao na `main`
local e o `git push` nao foi rodado. Neste projeto push E deploy.

Local:
```
node ferramentas/servir.js
```

No app: tocar em **Mais**, depois em **Escopo**. As 8 frentes aparecem em
`sem dado`, porque nenhuma acao foi criada ainda. Digitar uma acao em Pitscare e
tocar em Adicionar: ela aparece, a frente sai de `sem dado` e ganha nota. Tocar no
chip circula `a fazer` → `fazendo` → `feito`. Tocar em **travar** pede o motivo.

Para subir:
```
git push
```

---

## 9. Pendencias

1. **As 4 reprovacoes herdadas do `validar.py`** seguem abertas, por decisao
   consciente do dono na v45: classe emitida pelo JS sem estilo no CSS; botao do
   historico; pitboard de lead; uso novo de `var(--accent)`. **Nenhuma e desta
   sessao**, e a quinta (abas raras) foi fechada aqui.
2. **As 3 falhas do harness** (venda do fixture, lucro derivado, `rodar()` da NF)
   sao de Vendas e NF, herdadas.
3. **Buracos de cobertura do Escopo**, nomeados pela revisao final: erro da RPC
   (`r.error`), `pode_editar=false` fim a fim, e lista de frentes vazia nao tem
   assercao. As quatro fronteiras de faixa (**39/40/69/70**) tambem nao: o SQL so
   testa 100 e 0, e a faixa `normal` nunca e assertada. A logica le correta por
   inspecao, entao e buraco de cobertura, nao defeito conhecido.
4. **CORTE DECLARADO: o trilho da frente nao tem cor de frente.** A spec 4.1 e 6
   prometem cor por hash deterministico do `codigo`. O que subiu e
   `border-left:3px solid var(--line-forte)` fixo: medido, `rgb(211,216,226)` nas
   quatro frentes renderizadas. Um trilho so, cinza, para todas.
   `ferramentas/prova_trilho.py` tambem nao foi estendida, apesar de a spec secao 9
   pedir. **Nao e ilegivel**: o icone existe e carrega a distincao, que era o papel
   dele no sistema Trilho x Sinal. Fica para a Fatia 3, e este paragrafo e a
   declaracao do corte, que a propria spec exige em vez do silencio.
5. **Cada escrita no Escopo recarrega a base de leads inteira.** `q()` termina em
   `B()`, que faz `select` em `v_lead` completo. As abas Rotina e Hoje usam
   `qF(..., renderHoje)` justamente para nao pagar isso. No celular, cada toque em
   chip pisca "Lendo a base…". Trocar por `qF` e barato e entra na Fatia 2.
6. **`harness.py` aborta apos a secao Vendas** (`rodar() estourou: Cannot read
   properties of null`), entao o numero "172 passou" nao deve ser lido como
   cobertura total: o que vem depois daquele ponto nunca executa. Condicao herdada,
   ja presente na v45.
4. **VENDA-0003 duplicada continua viva no banco** (pendencia da v44 e v45,
   intacta): faturamento inflado em R$ 8.400. A ferramenta existe e esta provada;
   o ato e do dono.
5. Tudo o que a v43, v44 e v45 deixaram aberto segue aberto: Fila ordenada por
   `proximo_contato` em vez de `bola_com`; speed-to-lead sem tile; `permite_esfriar`
   inalcancavel em 4 dos 6 perfis; `etapa_cadencia` decorativa; paisagem e tablet
   (560 a 860px) nunca medidos.

---

## 10. As proximas fatias, ja desenhadas

Spec: `docs/superpowers/specs/2026-08-04-escopo-frentes-design.md`.

- **Fatia 2: o escopo semanal.** Molde fixo de 7 dias mais ajuste datado, com N
  frentes por dia. A tela e OBRIGADA a declarar qual dos dois esta valendo, com selo
  `ajustado`: duas fontes para o mesmo dia sem declaracao e o defeito que a aba
  Rotina ja tem. O placar ganha quantos dias de semana cada frente recebe, o que
  torna obvia a frente em baixa que tambem nao tem dia.
- **Fatia 3: gestao e tendencia.** `data_alvo` com vencida derivada, prioridade,
  esforco, editar titulo, criar e desligar frente pela tela, e a seta de tendencia
  lendo o log que **ja existe desde a Fatia 1**. A quarta parcela (Atraso) entra na
  nota e os pesos mudam: a tela tera de DECLARAR o corte, senao a tendencia mistura
  duas reguas no mesmo grafico.

---

## 11. O que esta sessao ensina para as proximas

1. **Suite verde nao prova que a porta abre, nem que o botao faz alguma coisa.**
   Cinco suites no baseline conviveram com uma aba que nao abria, e depois com uma
   aba onde nenhum botao funcionava. **Prova de escrita por string-matching sobre a
   fonte casa igual com o codigo quebrado.** Toda tela nova precisa de provas que
   CLIQUEM: uma que navegue ate ela, e uma por controle que assere a chamada
   resultante.
1b. **Corrigir a categoria errada de um ponto cego e pior que nao corrigir.** A
   Task 5c fechou o ponto cego de navegacao e declarou a lacuna resolvida. O ponto
   cego de acao seguiu aberto uma camada abaixo, agora com falsa sensacao de
   cobertura.
2. **Guard-rail que aponta problema real nao se cala com excecao.** O `validar.py`
   reprovou um token duplicado e a primeira resposta foi abrir excecao para ele.
3. **Condicao sempre falsa e indistinguivel de feature completa** para quem le o
   diff. O `prompt` do motivo da trava passou por duas revisoes assim.
4. **Onde uma conta filtra e outra nao filtra, existe vetor de manipulacao.**
5. **Revisao pendente e portao, nao formalidade.** A revisao final foi despachada,
   o dono mandou subir sem esperar por ela, e ela voltou com um CRITICO que
   derrubaria o deploy. A correcao subiu 15 minutos depois. Custou pouco desta vez;
   a licao e que o gate existia e funcionou, so foi consultado tarde.
6. **Reproduzir antes de aceitar.** Todo achado de revisao foi reproduzido contra o
   banco ou o arquivo real antes de virar correcao. Dois achados de revisor foram
   RECUSADOS por serem falsos: `criar_acao_escopo` aceitar `grupo='pendencia'` nao e
   furo (a secao Pendencias existe para receber acao), e a excecao no `validar.py`
   seria matar o guard-rail em vez de ouvi-lo.
