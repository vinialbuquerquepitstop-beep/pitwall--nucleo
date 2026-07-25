# Handoff Migracao Pit Wall (Nucleo) v40

Substitui a v39. Data: 25/07/2026.

---

## 1. Headline: o laco de METRICA fechou (afericao de peca + painel de origem)

Duas pontas do mesmo laco, pedidas juntas pelo dono: **quanto cada post rendeu**
e **de onde cada cliente veio**. Antes desta sessao:
- peca publicada nao tinha numero nenhum no sistema;
- `lead.origem` era coletada no cadastro desde sempre e **nunca lida em lugar
  nenhum** (17 leads, todos com origem preenchida, zero telas mostrando);
- a aba Dashboard era moldura vazia com o recado "as metricas ainda nao foram
  definidas", parada desde a Fase 5.

No ar em `main` (Cloudflare publica no push): commit `183c7db`.

**O que da pra abrir agora:**
- **Aba Conteudo -> coluna Publicado**: cada card tem bloco de afericao. Sem
  numero, mostra "sem afericao" + botao **Aferir**. Com numero, mostra
  `1.240 alcance / 3 conversas / medido ontem` + **Aferir de novo**.
- **Aba Hoje -> Conteudo de hoje**: **card RETANGULAR de linha inteira**, um por
  peca do dia, com cabecalho do dia contando `3 pecas · 2 publicadas · 1 aferida`.
  E aqui que o dia se confere (correcao pedida pelo dono no meio da sessao, ver
  secao 4b). Peca ainda nao marcada como publicada mostra **Publiquei**; depois
  disso, os campos de afericao abrem sozinhos.
- **Aba Dashboard** (em "Analise", entra pelo "Mais" no celular): painel real
  com janela de **30 / 90 / 365 dias** declarada no topo. Dois blocos:
  **De onde veio** (origem x leads x clientes x conversao x R$) e
  **O que rendeu** (chips por tipo + ranking de pecas por conversas).

---

## 2. Decisoes do dono nesta sessao

Perguntado antes de construir (licao da v39: confirmar escopo):

1. **Dois numeros por peca**, nao o set completo do Instagram: `alcance` e
   `conversas`. Motivo aceito: 7 campos por peca por dia e digitacao que morre
   em duas semanas. A opcao automatica (API do Metricool, marca `pitstopimports`
   conectada) foi apresentada e **nao** escolhida: exigiria token do dono e o
   casamento post-do-Instagram <-> card-do-Notion so daria por data+tipo, o que
   quebra com varios stories no mesmo dia.
2. **Atribuicao so por CANAL**, nao por peca. O campo "veio de qual post?" no
   cadastro do lead foi recusado com o argumento de que, com 2 leads de Instagram
   na janela, numero por peca e ruido, e campo que fica vazio na maioria das vezes
   e pior que campo nenhum: parece dado e e palpite.

---

## 3. Banco (4 migrations aplicadas)

### `conteudo_metrica` (tabela nova)
```
id, tenant_id, conteudo_id -> conteudo(id), alcance int, conversas int,
medido_em timestamptz, medido_por uuid, criado_em timestamptz
```
- **Nao virou coluna em `public.conteudo`** de proposito: aquela tabela e cache
  SO-LEITURA do Notion (so `sincronizar_conteudo()` escreve). Numero medido a mao
  ali seria sobrescrito na proxima sync. O proprio comentario da `conteudo` ja
  previa: "se um dia aparecer acao de operador aqui, reabrir esta decisao".
  Reaberta e resolvida por tabela separada.
- FK segura: a sync faz upsert por `UNIQUE (tenant_id, notion_page_id)` e **nunca
  deleta** (so marca `sumiu_em`), entao `conteudo.id` e estavel.
- **APPEND-ONLY por construcao**: `authenticated` so tem SELECT e INSERT.
  Corrigir numero errado = nova linha, e a mais recente vale (invariante 6).
- `medido_em` separado de `criado_em`: o mesmo reels medido em D+0 e em D+7 sao
  numeros diferentes. Numero sem idade nao se interpreta, e a tela sempre diz
  "medido hoje / ontem / ha N dias".
- RLS por `privado.fn_tenant_atual()` + trigger `trg_auditar_conteudo_metrica`.

### `registrar_metrica_conteudo(p_conteudo_id, p_alcance, p_conversas)`
SECURITY INVOKER (convencao do projeto). Recusas provadas, todas com mensagem
legivel: peca com data no futuro ("Peca marcada para 26/07: ainda nao foi ao ar"),
numero negativo, payload sem nenhum numero, peca inexistente, sessao invalida.

### `painel_metricas(p_ini, p_fim)`
Padrao: ultimos 90 dias. Devolve `origem{itens,total}` e
`conteudo{pecas,por_tipo,total}`.
- **Janela por `data_contato`, NAO por `criado_em`.** `criado_em` de 15 dos 17
  leads e 05/07 (a data do ETL): filtrar por ele empilharia a base inteira num
  dia so e mentiria sobre quando o lead entrou.
- **Semantica de coorte**, declarada na tela: conta o lead cujo PRIMEIRO CONTATO
  caiu na janela, e o R$ que ele gerou mesmo que a venda tenha saido depois.
- **`valor_venda` e `valor_historico` nunca se somam.** O primeiro vem da tabela
  `venda` (lastro linha a linha, hoje **0 registros**); o segundo de
  `lead.valor_total` (agregado herdado do CRM, sem lastro). Somar produziria um
  terceiro numero que ninguem pode auditar. A tela mostra os dois e explica.
- `cliente` = `perfil = 'comprou'`, igual a aba Clientes.

### `conteudo_periodo()` e `painel_do_dia()` (substituidas)
Cada item passa a carregar `metrica` (a ultima afericao) e, no caso do
`painel_do_dia`, tambem `data`. ACL refeita explicitamente depois do
`CREATE OR REPLACE` (que reseta grants).

---

## 4. Frontend

- `contMetrica(x)` / `contMetricaNums(m)` / `contAferivel(x)` / `salvarAfericao()`
  / `marcarPublicado()` em `public/app.js`, area legivel, logo antes de
  `contMoverCtl`.
- `contAferivel`: so peca `publicado` **e** com data <= hoje. Medir o que nao foi
  ao ar seria inventar dado; a RPC recusa igual, entao a regra vale nas duas pontas.
- Aba Dashboard: `renderDash()` + `metTopo` / `metOrigem` / `metConteudo` /
  `metPeca` / `metTipoChip` / `metBarra`. O pitboard (contador de leads, sem
  recorte) fica **oculto** nesta aba: contador sem janela em cima de painel com
  janela convida a leitura errada.
- **A tela sempre mostra publicadas x aferidas juntas**, e o chip fica em
  `--morno` quando aferidas < publicadas. "4.310 de alcance" sobre 3 de 9 pecas
  nao e o alcance da janela.
- Ranking ordenado por **conversas**, nao por alcance, e a tela diz isso.
- CSS: blocos `.cont-met-*` (afericao no card) e `.met-*` (painel) em
  `public/app.css`. Saiu o `.dash-grade` / `.dash-slot` / `.vazio-marca`, que
  eram so a moldura vazia e ficaram sem uso.

## 4b. Correcao de rumo no meio da sessao: a aba Hoje e o lugar

Dito pelo dono depois da primeira entrega: **"o botao era na aba hoje. cards
retangulares para conferir no dia. ali e onde deve deter as informacoes
necessarias do dia."**

O que estava errado: a aba Hoje reusava o `contCard` do kanban, um card estreito
(`max-width: 340px`) desenhado para caber em coluna. Pior: o botao so aparecia em
peca com status `publicado`, e as duas pecas de hoje estavam em `A produzir` no
Notion. Resultado pratico: o dono abriu a aba Hoje e **nao viu botao nenhum**.

O que passou a valer:
- `hojeContCard(x)`: card retangular de linha inteira, so da aba Hoje. Cabecalho
  com tipo (icone + cor do tipo), semana e status; titulo; link do Notion; e a
  faixa de acao embaixo. O `contCard` estreito segue valendo na aba Conteudo,
  onde a largura e a da coluna do kanban.
- `hojeContPlacar(l)`: `N pecas · N publicadas · N aferidas` no cabecalho da
  secao. Mesma regra da aba Conteudo: afericao sem o total de publicadas nao diz
  se o dia foi conferido inteiro ou pela metade.
- **Botao "Publiquei"** em peca ainda nao publicada. Reusa a MESMA escrita do
  botao Mover do kanban (Edge Function `mover-conteudo` -> PATCH no Notion), com
  a ordem ja decidida na v33: **Notion primeiro, tela depois**. Se o PATCH
  falhar, nada muda aqui e o toast diz.
- Depois do "Publiquei", os campos de afericao **abrem sozinhos** e o cursor cai
  no campo de alcance (`AFERIR_ABRIR`): quem acabou de dizer que postou esta com
  o numero na mao.
- Peca `descartado` no dia nao pede acao nenhuma.
- `.cont-solto` ficou sem uso e a regra `max-width:340px` dela saiu do CSS.

Nao se aferiu peca fora de `publicado`: medir alcance de coisa que o sistema acha
que nem foi ao ar seria numero solto. O caminho continua sendo declarar que
publicou (que e escrita real no Notion) e so entao medir.

### Bug corrigido de passagem
`hojeConteudo` e o bloco Descartado chamavam `.map(contCard)`, o que passa o
**indice** como segundo argumento (`mover`). Resultado: do segundo card em diante,
o `mover` vinha truthy e o card ganhava `draggable` e menu **Mover** em lugar
onde nao havia coluna para soltar. Agora ambos usam `.map(function(x){return
contCard(x)})`, igual ao que `contColuna` ja fazia de proposito com `true`.

---

## 5. Provas

| prova | resultado |
|---|---|
| `node --check public/app.js` | EXIT 0 |
| `node ferramentas/prova_metricas.js public/app.js` (**novo**) | 65 assercoes, 0 falhas, EXIT 0 |
| RLS como dono (`fb2aad8e…`) | insere e le |
| RLS como vendedor (Brendon, `130353b1…`) | le 1 linha, painel ok |
| RLS como tenant errado (uid sem `app_usuario`) | 0 linhas, "Sessao invalida", insert negado |
| append-only como `authenticated` | UPDATE, DELETE e TRUNCATE negados (`insufficient_privilege`) |
| auditoria | exatamente 1 registro por escrita, `antes` nulo no INSERT, `usuario_id` correto |
| CSS aplicado | conferido no Chrome com pagina estatica gerada a partir do `app.css` e das funcoes reais |

**Nao conferido: o layout no CELULAR.** O resize da janela do Chrome nao pegou em
duas tentativas, entao o card retangular e o painel foram vistos so em largura de
desktop. O CSS usa `flex-wrap` em toda linha e ha regra em `@media`, mas isso e
argumento, nao medicao. Conferir no celular ao abrir.

**A suite Python do repo (`validar.py`, `harness.py`, `prova_trilho.py`) NAO
rodou: nao ha Python nesta maquina** (so o stub da Microsoft Store). Existe node
em `C:\Program Files\nodejs\node.exe`. O `prova_metricas.js` novo cobre o HTML
gerado, nao a cor computada; para cor computada, rodar `harness.py` na maquina
de dev.

A linha de teste inserida durante a prova (alcance 1240 na Story de 19/07) foi
**apagada**: `conteudo_metrica` esta com 0 linhas. A trilha de auditoria guardou
o INSERT e o DELETE. O primeiro numero de verdade e o que o dono aferir.

---

## 6. Como usar (caminho exato)

1. Publicou o post no Instagram.
2. No Pit Wall, aba **Hoje**, secao **Conteudo de hoje**. Cada peca do dia e um
   card retangular.
3. Toque em **Publiquei** (isso marca Publicado no Notion). Os campos abrem
   sozinhos: digite alcance e conversas, **Salvar**.
   Se a peca ja estava marcada como publicada, o botao ja e **Aferir**.
4. Aba **Dashboard** para ver o acumulado por origem e por peca.

Peca publicada em dia ANTERIOR nao aparece na aba Hoje: essa mora na aba
**Conteudo**, coluna Publicado, onde o card estreito tem o mesmo **Aferir**.

Aferir de novo dias depois nao apaga nada: entra como nova leitura e a mais
recente e a que aparece.

---

## 7. O que esta faltando para o painel valer de verdade

1. **`venda` tem 0 linhas.** Enquanto ninguem registrar venda, a coluna
   "R$ vendido" fica R$ 0,00 em todas as origens e quem paga a conta some. O
   painel ja esta ligado na tabela certa; falta alimentar.
2. **Sujeira nos agregados herdados**, achada ao montar o painel e nao corrigida
   (nao foi pedido): `LEAD-0008` tem `qtd_compras = 1` mas perfil `em_espera` e
   `valor_total` nulo; `LEAD-0014` tem perfil `comprou` com `qtd_compras = 0` e
   `valor_total` 7600; `LEAD-0003` tem perfil `repescagem` com 2 compras e 3150.
   O painel conta cliente por `perfil = 'comprou'` (igual a aba Clientes), entao
   esses tres divergem do que o agregado diz. Decidir qual e a verdade e
   trabalho de dado, nao de codigo.
3. **9 pecas publicadas na janela, 0 aferidas.** O painel de conteudo so ganha
   sentido depois de algumas semanas de afericao.

---

## 8. Pendencias herdadas da v39 (nao tocadas)

- Vazamento do `dados.js` publico da Netlify (custo de fornecedor baixavel sem
  login). Exige push no repo `calculadora-pitstop`, sem acesso a partir daqui.
- Esconder o custo DE VERDADE na `/calc/` da Cloudflare (hoje o botao some, mas
  o dado chega no navegador). Adiado conscientemente pelo dono.
- Escrita do kanban de volta no Notion ja existe (`mover-conteudo`), commit
  anterior a esta sessao.

---

## 9. Aviso de ambiente

Durante esta sessao o clone local **recebeu sozinho** o commit `361f650`
("vendedor cai na calc do consultor"), feito por outra sessao as 15:20 e
sincronizado pelo OneDrive. Ou seja: este clone nao so atrasa em relacao ao
GitHub, ele tambem **pula para frente no meio do trabalho**. Conferir
`git log -1` antes de commitar, nao so no arranque.

O push desta sessao levou os dois commits (`c29c68e..183c7db`), com autorizacao
explicita do dono depois de avisado de que o `361f650` iria junto para producao.
