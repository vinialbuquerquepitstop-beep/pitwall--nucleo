# Handoff Migracao Pit Wall (Nucleo) v33

Substitui a v32. Data: 21/07/2026.

---

## 1. Headline: as tres abas de operacao viraram tela legivel, e o harness mentia

Obra de frontend puro, **zero mudanca de banco**. `conteudo_periodo`,
`rotina_completa` e `painel_do_dia` ja devolviam tudo.

| Aba | Antes | Agora |
|---|---|---|
| **Rotina** | Agrupada por categoria, dias escritos como texto (`seg · ter · qua`). A carga por dia era invisivel. | **Grade de 7 colunas** com a carga no topo: `seg 10 · ter 8 · qua 8 · qui 9 · sex 10 · sáb 3 · dom 0`. |
| **Conteúdo** | Lista cronologica plana. `Publicado` e `A produzir` com o mesmo chip cinza. | **Kanban de funil de 4 colunas**, ordenado por data, com contagem de vencidas e a data carregando o sinal de urgencia. |
| **Hoje** | placar, tarefas, **nota**, lembretes, conteudo | placar, tarefas, conteudo, lembretes, **nota** (a nota e o ato de fechamento). |

Branch: `frontend-hierarquia`. **Ainda NAO fundida em `main`, ou seja, ainda nao
publicada.** Push em main e o deploy neste projeto.

Spec: `docs/superpowers/specs/2026-07-20-hierarquia-frontend-design.md`
Plano: `docs/superpowers/plans/2026-07-20-hierarquia-frontend.md`

---

## 2. O sistema de cor: separacao por CANAL, nao por matiz

O dono pediu "cores que delimitem objetivos". A recomendacao foi cor = urgencia
em tudo, com categoria sem matiz. **O dono escolheu o hibrido, contra a
recomendacao.** Decisao consciente, registrada.

O problema real: ja existiam 6 regioes de matiz ocupadas (`--quente`, `--morno`,
`--frio`, `--accent`, `--ok`, `--erro`). Nao sobravam 7 matizes livres.

A saida foi nao disputar matiz:

| | Trilho (quem sou) | Sinal (quao urgente) |
|---|---|---|
| Forma | barra de 3px + cor do rotulo | chip preenchido, faixa |
| Croma | baixo, le como cinza tingido | alto |
| Reforco | **sempre com icone** | matiz + palavra |

Os 7 trilhos foram **medidos**, nao escolhidos no olho: 3.80 a 5.21 contra
branco, alvo 3:1. Prova reexecutavel: `python ferramentas/prova_trilho.py`.

**As colisoes de luminancia com as cores semanticas ficam entre 1.14 e 1.44.**
Isso nao reprova o desenho, confirma a premissa: matiz sozinho NAO separa, entao
**o icone nao e enfeite, e o que carrega a distincao**. Trilho sem icone e
regressao, e o harness assere isso.

---

## 3. Conflito com a "decisao 8", e a excecao nomeada

`ferramentas/validar.py` exigia que o bloco `:root` fosse byte a byte igual ao da
baseline (`decisao 8: zero token novo`). A regra 11.3 logo abaixo proibe hex
dentro do `app.js`. Os 7 trilhos nao tinham onde morar.

**Decisao consciente do dono: abrir excecao nomeada para exatamente os 7,
mantendo a guarda para todo o resto.** Nao derrubar a guarda.

A guarda foi provada nas **tres bocas**, cada uma com mutacao real:

| Mutacao | Resultado |
|---|---|
| Acrescentar `--tr-falso:#123456` | REPROVA, EXIT 1 |
| Remover um dos 7 trilhos | REPROVA, EXIT 1 |
| Alterar `--erro` (token nao-trilho) | REPROVA, EXIT 1 |

**Armadilha pisada no caminho:** a primeira tentativa de implementacao repontou
`ferramentas/app.css.antes` para a guarda parar de reclamar. Isso e derrotar um
guard-rail em silencio: a baseline deixa de responder "o que esta obra mudou".
Revertido. **Baseline se reponta uma vez, no inicio da obra, nunca no meio.**

---

## 4. O harness mentia em tres pontos. Este e o achado mais caro

1. **`document.body.textContent` inclui o texto das tags `<script>`**, e o
   harness injeta o `app.js` inteiro dentro do `<body>`. As 6 assercoes de texto
   liam o **CODIGO-FONTE**, nao a tela. Provado com a string `TRILHO_ANEL`, um
   identificador JS impossivel de renderizar, sendo encontrada por uma assercao
   de conteudo de tela. Criado `telaTxt()`, que le so `#lista`.
2. **O guard `'RESULTADO' not in dom` era enganado pelo mesmo vazamento:**
   passava, e o `split` seguinte estourava com `IndexError` sem dizer onde parou.
   Agora procura a TAG (`id="RESULTADO">`).
3. **`rodar()` sem `catch`:** se estourasse no meio, o `<pre>` de resultado nunca
   nascia e nao havia como saber em que assercao quebrou.

Licao: **suite verde nao prova nada se a assercao nao consegue distinguir tela de
codigo-fonte.** Ao escrever assercao de UI, consultar o DOM renderizado, nunca
uma varredura de texto do documento inteiro.

O stub tambem foi repontado para o dado REAL: 7 categorias, 17 tarefas, e os
CINCO `status_codigo` que existem. O stub antigo usava `planejado`, que **nao
existe em lugar nenhum do banco**.

**Datas do stub agora sao relativas a hoje.** Com data fixa, toda assercao de
nivel apodreceria no dia seguinte.

Estado atual: **133 assercoes, 0 falhas.**

---

## 5. A janela do Conteudo: a coluna Publicado mostrava 3 de 8

`conteudo_fonte` tem `janela_atras_dias = 7` e `janela_frente_dias = 28`, entao a
chamada padrao cobre hoje-7 a hoje+28.

Na base inteira sao 66 cards e 8 publicados. **Dentro da janela padrao, publicado
e 3**, porque 5 sao de 10 a 12/07 e caem fora.

Por isso o cabecalho do painel **DECLARA a janela** (`de X a Y`). Sem isso a
coluna Publicado mente por omissao, e mentir sobre publicacao e exatamente o
defeito que esta obra veio consertar.

O spec original dizia 8 no criterio de pronto. Estava errado, e foi corrigido.

---

## 6. Correcoes ao CLAUDE.md e ao LEIA-ME

- **A suite NAO e acorn + jsdom.** O CLAUDE.md pede isso, mas a suite real e
  Python: `esprima` para sintaxe (`validar.py`) e **Chrome headless** para
  comportamento (`harness.py`). O Chrome e melhor que jsdom para esta obra
  porque aplica CSS, o que permite assertar sobre **cor computada**.
  Comandos reais, da raiz:
  ```
  python ferramentas/validar.py
  python ferramentas/harness.py
  python ferramentas/prova_trilho.py
  ```
  **Conferir o EXIT CODE, nunca o texto.** `validar.py` imprime dezenas de linhas
  verdes e pode terminar com `REPROVOU:`. Duas tentativas nesta obra commitaram
  vermelho por lerem o texto por cima.
- **`node` EXISTE nesta maquina.** `ferramentas/LEIA-ME.md` afirma que nao, e
  isso esta desatualizado. Nao muda a escolha de ferramenta, mas o arquivo mente.
- `app.css` tem 793+ linhas e **e legivel**, nao minificado. So o `app.js` e uma
  linha so.

---

## 7. Como a mudanca entra num `app.js` minificado

`ferramentas/patch_hierarquia.py`, no molde de `patch_historico.py`: funcoes
legiveis inseridas, call-sites trocados por ancora de texto exato que **aborta se
a ancora nao aparecer exatamente 1x**.

Duas armadilhas novas, ambas pisadas e documentadas no proprio script:

- **O arquivo inteiro e UM unico `ExpressionStatement` de topo.** Inserir
  `var`/`function` fora do IIFE quebra a sintaxe (`Unexpected token var`), porque
  declaracao nao e expressao. A ancora certa e `var scriptsData={};`, que fica
  dentro do corpo do IIFE. Os helpers tambem PRECISAM estar la dentro para
  enxergar `l()` e `c()`, que sao privados.
- **Ancorar em `function renderRotina(` casa DENTRO de `async function
  renderRotina(`**, e o bloco entra entre o `async` e o `function`. Ancorar
  sempre na forma completa.

---

## 8. Provas de que a Fila nao foi tocada (invariantes 13 a 16)

Comparacao byte a byte dos corpos das funcoes, entre `87030b7` e o topo da branch:

```
sugerirMensagem  IDENTICA (1402b)
pintarVariante   IDENTICA (934b)
copiarScript     IDENTICA (460b)
copiarFallback   IDENTICA (331b)
mencoes a 'consentimento': antes 7 | depois 7 (trava LGPD preservada)
```

**O teste que o plano previa (`git log -p | grep -c` = 0) e INUTIL aqui** e deu 4:
`app.js` e uma linha so, entao qualquer mudanca faz o diff exibir a linha inteira,
que contem esses nomes. Para arquivo minificado, a prova valida e extrair o corpo
da funcao e comparar. Fica registrado para nao repetir o teste errado.

---

## 9. Pendencias

Herdadas da v32 e ainda abertas:

| # | Item | Nota |
|---|---|---|
| 1 | 401 da Edge Function nao gera log | Ponto cego, v32 secao 3.2 |
| 1b | Fidelidade do `index.ts`: repo vs deployed | Medir MD5 no proximo deploy |
| 3 | Calibrar meta de captacao | 10/dia segue chute |
| 4 | Ligar captacao -> lead | `captacao.virou_lead_id` sem preenchimento |
| 5 | Dashboard: metrica antes da view | Segurado |
| 6 | `registrar_nota` sem uso real | Continua |
| 7 | Aba padrao: Fila ou Hoje? | Decisao do dono, custo 1 linha |
| 8 | Leaked Password Protection | Bloqueada, plano Pro |
| 9 | `Desktop/pitwall deploy/` | Monolito morto |
| 10 | Token do GitHub em texto puro | Revogar se ainda valer |
| 11 | Legado: Estrategia, Metricas, Evolucao | Fase 7+ |

**Fechada nesta sessao:** a pendencia 12 (baselines `.antes` repontadas).

Novas:

| # | Item | Nota |
|---|---|---|
| 13 | **Fundir `frontend-hierarquia` em `main`** | So depois do dono abrir e aprovar. O merge e o deploy. |
| 14 | `contItem` virou codigo morto | 422 bytes. `renderConteudo` e `hojeConteudo` agora usam `contCard`. Remover num patch futuro. |
| 15 | `ferramentas/LEIA-ME.md` afirma que nao ha node | Falso. Corrigir. |
| 16 | Calibrar o molde da rotina com uso real | Continua valendo: se o % viver abaixo de 60% por duas semanas, cortar tarefa. Agora a grade mostra QUAL dia cortar. |

---

## 10. Armadilhas novas

- **`document.body.textContent` enxerga o codigo dentro de `<script>`.** Assercao
  de UI baseada em varredura de texto do documento inteiro pode passar lendo o
  proprio fonte.
- **Guard-rail que incomoda nao se cala repontando a baseline.** Ou se abre
  excecao nomeada e documentada, ou se derruba a guarda conscientemente.
- **Ler o texto da saida nao substitui o EXIT CODE.**
- **Em arquivo minificado de uma linha, `git diff` nao serve para provar que algo
  NAO mudou.** Comparar corpos de funcao extraidos.
- **Ancora de patch tem que casar a forma completa** (`async function X(`), senao
  ela casa dentro de outra construcao e insere no lugar errado.

---

## 11. Invariantes reforcados

- **Nivel e derivado na leitura, sempre.** `nivelPeca` calcula no cliente a partir
  de `l()` (fuso do Brasil), nunca vira coluna no banco. Vale para peca de
  conteudo exatamente como valia para lead.
- **A chave e o `codigo`, nunca o `rotulo`.** `trilhoDe` chaveia por codigo, e
  categoria nova entra por hash deterministico: mesma categoria, mesma cor, em
  toda sessao.
- **Cor semantica se mede.** Vale tambem para cor de identidade: os 7 trilhos
  passaram por medicao antes de entrar.
- **Tela que omite recorte mente.** Declarar a janela e parte do dado.

---

## 12. Fase seguinte, ja decidida: mover card no kanban (escrita de volta no Notion)

Pedido do dono em 21/07/2026, logo apos aprovar as tres abas.

**O problema que isso levanta, e nao e de frontend.** `sincronizar_conteudo()` faz
`on conflict ... do update set status_codigo = excluded.status_codigo`, ou seja,
**sobrescreve o status a cada rodada do cron**. Mover um card so no Pit Wall seria
revertido as 05:30 do dia seguinte, em silencio. O dono descobriria semanas depois
achando que o kanban "nao salva".

**Decisao do dono: escrever de volta no Notion.** O Notion continua sendo a fonte
unica e o Pit Wall vira controle remoto. As alternativas recusadas foram coluna de
override local (cria duas verdades sobre o mesmo card) e kanban de leitura.

Encaixe confirmado lendo o schema real do Calendario: a propriedade `Status` e um
`select` com exatamente as 5 opcoes que existem no banco (`A produzir`,
`Em produção`, `Pronto`, `Publicado`, `Descartado`). Mapeamento um-para-um, sem
tabela de traducao.

**BLOQUEADOR, e e do dono:** a Edge Function fala com o Notion por `NOTION_TOKEN`
(env do Deno) e hoje so faz `POST /v1/databases/{id}/query`, que e leitura. Escrever
exige `PATCH /v1/pages/{page_id}`. Integracao do Notion tem capacidade separada para
ler e escrever.

Conferir em **notion.so/profile/integrations** -> a integracao -> **Capabilities** ->
precisa estar marcado **"Update content"**. Se estiver so "Read content", o PATCH
volta 403 e nada do que for construido funciona. **Nao da para eu verificar isso:** a
conexao MCP desta sessao usa credencial DIFERENTE da `NOTION_TOKEN`, entao testar por
ela nao provaria nada sobre a que importa.

**Decisao do dono sobre interacao, contra a recomendacao:** arrastar no desktop E
botao no celular, as duas superficies. A recomendacao era so botao de avancar, pelo
argumento de que o funil e linear (`A produzir -> Em produção -> Pronto ->
Publicado`), de que arrastar e ruim em celular e de que acessibilidade por teclado
sai de graca no botao e cara no drag. O dono escolheu as duas. **Custo aceito: duas
superficies para manter e testar, e o dobro de casos de falha.** Se o drag comecar a
gerar movimento errado ou virar peso de manutencao, a correcao e cortar o drag, nao
adicionar mais tratamento.

**Tempo real:** decidido apenas UI otimista com rollback (a propria acao reflete na
hora). Supabase Realtime foi recusado por ora. Teto a lembrar: o Pit Wall pode ficar
em tempo real com o BANCO, mas o banco so e tao fresco quanto o sync com o Notion,
que roda 1x por dia as 05:30. Kanban em tempo real nao faz edicao feita no Notion
aparecer na hora.

**Ordem de escrita a definir na fase:** escrever no Notion primeiro e so entao no
local (se o PATCH falhar, nada muda e a tela diz por que) e mais seguro que o
inverso. Propriedade util do desenho: como o sync reconcilia todo dia, uma
divergencia local sobrevive no maximo ate a proxima rodada.
