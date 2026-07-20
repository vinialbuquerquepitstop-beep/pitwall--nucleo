# Handoff Migracao Pit Wall (Nucleo) v31

Substitui a v30. Data: 20/07/2026.

---

## 1. Headline: sessao NAO tocou a migracao do Nucleo. Abriu uma trilha nova, paralela

Pedido do dono nesta sessao: "criar um time de agente de marketing pra auditoria
semanal e pontual". Nada aqui mexeu em Postgres, RLS, Edge Function ou frontend do
Pit Wall. **Todos os bloqueadores da v30 (secao 6) continuam exatamente como estavam**
— ver secao 5 deste handoff, que os repete para nao se perderem.

O que nasceu: um time de auditoria de marketing (Conteudo + Social + Comercial) que
roda contra o Calendario de Conteudo do Notion e a conta real do Instagram no
Metricool, publica relatorio numa base nova do Notion, e tem uma rotina automatica
semanal em nuvem. Ja rodou uma vez de verdade, com achados reais, nao so a
infraestrutura ("faca sempre palpavel" cumprido tambem aqui — o dono abre o Notion e
ve o relatorio, nao so uma skill parada).

---

## 2. O que foi construido

| Peca | Onde | Estado |
|---|---|---|
| Skill `auditoria-marketing` | `.claude/skills/auditoria-marketing/` (SKILL.md + 2 references) | Commitada e empurrada (`213c304`, depois merge `6c25821`) |
| Base Notion "🔍 Auditorias de Marketing" | Data source `fd3f83d4-6f26-49f1-9fab-30a1a08f12cf`, dentro da pagina "Crescimento & Marketing" (`36a80e29017e815e825ff1e62e33678a`) | Criada, com properties `Auditoria`, `Data`, `Tipo` (Semanal/Pontual), `Áreas` (Conteúdo/Social/Comercial), `Achados críticos`, `Status` (Aberta/Resolvida) |
| Primeira auditoria real | Pagina `3a380e29017e8120b908cda730cc23ec` na base acima | Publicada com 5 achados criticos, numeros medidos (nao estimados) |
| Rotina em nuvem | Trigger `trig_01SF9wXiFN89NDe8VrPoRqt7` | Ativa. Toda segunda 8h10 America/Sao_Paulo (`10 11 * * 1` UTC). Le o processo direto do repo (branch main) e publica sozinha |
| GitHub App (Claude Code cloud) | Conta do dono | Conectado nesta sessao (estava faltando, bloqueava a rotina de ler o repo) |
| Conectores MCP anexados a rotina | Notion + Metricool | Anexados via `mcp_connections` no trigger |

### Os achados da primeira rodada (20/07/2026)

Maior falha, nomeada primeiro (postura de conselheiro critico, nao carimbo): **o plano
e rico, a execucao real e magra.** O Calendario de Conteudo no Notion tem 15 a 20+
cards ativos por semana em julho, mas o Metricool (Instagram real da conta
`pitstopimports`, brand id `6523734`) mostra so **11 posts publicados em 30 dias e 0
agendados para as proximas 4 semanas**. Alcance medio ~250/dia sobre ~12 mil
seguidores (~2%), e a base de seguidores em leve queda liquida (11.995 em 11/07 para
11.981 em 19/07). Agosto ja nasce fraco no proprio Notion (semanas Ago S1 e Ago S2 com
3-4 cards contra 15-20 em julho). E 2 cards ativos da semana de Dia dos Pais tem o
campo `Data` — o unico que o sync de verdade le — divergindo do titulo e da
propriedade `Dia da semana`.

Relatorio completo com todas as tabelas e o texto integral: abrir a pagina no Notion
(link acima). Nao duplicado aqui para nao virar fonte divergente — o Notion e a
fonte de registro dessas rodadas, este handoff so aponta pra ela.

---

## 3. Decisoes tomadas nesta sessao

- **A skill orquestra, nao substitui.** `auditoria-marketing` nao reescreve o
  conhecimento de `pitwall-conteudo`, `socialmedia` nem `apple-strategist` — ela le o
  Calendario de Conteudo e a conta do Metricool com a metodologia de cada uma e
  junta o resultado. Se o processo de auditoria de conteudo mudar em
  `pitwall-conteudo/references/auditoria.md`, atualizar la primeiro.
- **Notion e o registro, Pit Wall e decisao manual.** A pagina de auditoria "depois
  vai pra Pit Wall" no sentido de virar decisao do dono (editar um Vetor, um card, o
  Escopo) — a skill audita e registra, nao edita o Calendario nem os Vetores por
  conta propria. Nenhuma automacao de escrita no Calendario foi criada.
- **Rotina em nuvem ficou autossuficiente por seguranca, depois trocada para ler o
  repo.** Primeira versao do trigger tinha o processo inteiro escrito no prompt
  (GitHub nao estava conectado ainda). Depois que o dono conectou o GitHub App, o
  trigger foi atualizado (`action: update`) para usar `sources.git_repository` e ler
  `SKILL.md` na hora — assim o processo acompanha mudancas futuras na skill sem
  precisar recriar o trigger.
- **Metricas do Metricool pedidas uma por chamada, nao combinadas.** `getAnalyticsDataByMetrics`
  devolve linhas posicionais sem nome de coluna; combinar metricas na mesma chamada
  arrisca desalinhar coluna com metrica. Os numeros citados no relatorio (alcance,
  posts, seguidores) vieram de chamadas isoladas por metrica. Documentado em
  `references/metricool-metricas.md` para a proxima rodada nao repetir a
  investigacao.

---

## 4. Armadilhas novas (para nao repetir)

- **`RemoteTrigger` (schedule) precisa de `action` e `body` como parametros
  separados do tool call, nunca um JSON gigante escrito a mao dentro de um unico
  parametro.** Tentar montar o body inteiro como string escapada manualmente falhou
  repetidas vezes com erro de parse; passar `body` como objeto estruturado (parametro
  proprio) funcionou de primeira. `mcp_connections` tambem e campo de `body`, nao
  parametro solto do tool.
- **Cloud routine sem GitHub conectado nao le o repo.** O erro que aparece e HTTP 401
  "Connect your GitHub account before saving a routine that uses a GitHub repository"
  — so aparece na hora de criar/atualizar, nao antes. Se a rotina precisa do checkout,
  conectar primeiro em `claude.ai/code/onboarding?magic=github-app-setup`.
- **Metricool `getAnalyticsDataByMetrics` e posicional, sem nome de coluna na
  resposta.** Pedir metrica isolada quando o numero for virar afirmacao no relatorio.
- **`getScheduledPosts` vazio nao prova que nada sera publicado** — so prova que nada
  esta na fila de agendamento automatico do Metricool. Publicacao manual direto no
  Instagram nao aparece ali. Citar essa ressalva sempre que o numero for zero.
- **Push direto na `main` pode colidir com o backup automatico do banco.** Nesta
  sessao o `git push` foi rejeitado porque `backups/` (dumps `.gpg` datados,
  aparentemente um job de backup criptografado rodando fora desta sessao) tinha
  commits novos no remoto. Resolvido com `git fetch` + `git pull --no-edit` (merge
  sem conflito, arquivos binarios distintos) antes do push. Verificar sempre
  `git fetch` + `git log HEAD..origin/main` antes de push nesta repo, ja que ha
  automacao externa escrevendo nela.

---

## 5. Bloqueadores da migracao do Nucleo — INALTERADOS desde a v30

Nao tocados nesta sessao. Repetidos aqui na integra porque este handoff substitui a
v30 como ponto de partida de leitura.

### 5.1 Provar o caminho feliz do Notion (1 clique do dono)

O laco `authenticated -> invoke -> Notion -> conteudo` continua teoria. Logar no app,
aba Conteúdo, botao Sincronizar. Conferir:

```sql
select criado_em, origem, ok, msg, vistos, inseridos, atualizados, sumidos
  from public.conteudo_sync_log order by id desc limit 5;
```

Se falhar: 404 = Calendario nao compartilhado com a integracao `Pit Wall Nucleo`
(Notion -> Connections); 401 = token errado no secret `NOTION_TOKEN`.

### 5.2 Cron automatico do sync de conteudo (1 linha do dono, SQL editor)

`pg_net` instalado, `fn_conteudo_disparar_sync` criada (ACL: so `service_role`,
provado), cron `conteudo-sync` agendado (jobid 3, `30 8 * * *` GMT = 05:30 BR). Falha
todo dia em silencio ate a service_role key entrar no Vault:

```sql
select vault.create_secret('COLE_AQUI_A_SERVICE_ROLE_KEY', 'service_role_key');
```

(chave em Project Settings -> API Keys -> `service_role`, nao passa pelo chat)

---

## 6. Pendencias (Nucleo v30 + marketing v31 juntas)

| # | Item | Trilha | Nota |
|---|---|---|---|
| 1 | Prova do caminho feliz do Notion | Nucleo | Secao 5.1. 1 clique do dono. |
| 2 | service_role key no Vault | Nucleo | Secao 5.2. 1 linha do dono. |
| 3 | Dono digitar o molde na aba Rotina | Nucleo | Porta existe desde a Fase 6. |
| 4 | Calibrar meta de captacao | Nucleo | 10/dia e chute. |
| 5 | Ligar captacao -> lead | Nucleo | `captacao.virou_lead_id` sem preenchimento. |
| 6 | Dashboard: metrica antes da view | Nucleo | Segurado. |
| 7 | `registrar_nota` sem uso real | Nucleo | Continua. |
| 8 | Aba padrao: Fila ou Hoje? | Nucleo | Decisao do dono, custo 1 linha. |
| 9 | Leaked Password Protection | Nucleo | Bloqueada, plano Pro. |
| 10 | `Desktop/pitwall deploy/` | Nucleo | Monolito morto, candidato a apagar. |
| 11 | Token do GitHub em texto puro | Nucleo | Arquivo local do dono, revogar se ainda valer. |
| 12 | Legado: Estrategia, Metricas, Evolucao | Nucleo | Fase 7+. |
| 13 | Baselines `.antes` | Nucleo | Repontar so ao comecar a proxima obra. |
| 14 | **Publicacao real no Instagram muito abaixo do plano no Notion** | Marketing | 11 posts/30 dias, 0 agendado no Metricool. Achado #1 da auditoria de 20/07. Decisao do dono: apurar se e atraso ou publicacao fora do Metricool. |
| 15 | **Agosto sem conteudo no Calendario** | Marketing | Semanas Ago S1/S2 com 3-4 cards. Achado #2. Precisa producao antes de meados de agosto. |
| 16 | Cards com `Data` divergente de titulo/`Dia da semana` | Marketing | 2 cards da semana de Dia dos Pais. Achado #5, acao sugerida na pagina do Notion. |
| 17 | Aba Vetores (Google Sheets) nao auditada | Marketing | Fora do acesso direto do time de auditoria. Avaliar dar acesso via Google Drive/Sheets MCP numa proxima rodada. |
| 18 | Pico de alcance de 24/06 (2.344) nao investigado | Marketing | Identificar o post e replicar se for formato replicavel. |

---

## 7. IDs novos desta sessao (somar ao bloco de IDs de sistema)

- Notion, pagina "Crescimento & Marketing": `36a80e29017e815e825ff1e62e33678a`
- Notion, data source Calendario de Conteudo: `db8e6c04-275b-4ba2-b5cd-9a7548945cea`
- Notion, data source "🔍 Auditorias de Marketing": `fd3f83d4-6f26-49f1-9fab-30a1a08f12cf`
- Metricool, brand id `pitstopimports`: `6523734`
- Cloud routine trigger id: `trig_01SF9wXiFN89NDe8VrPoRqt7`

---

## 8bis. Evolucao da skill: auditoria virou diagnostico + proposta (20/07/2026)

Pedido do dono na mesma sessao, depois da primeira rodada: a auditoria do Instagram
tem que ter a premissa de sugerir formas de evolucao (engajamento e alcance local),
propor novas producoes, novas estrategias e novos Vetores como opcoes, com um time
completo de agentes de pesquisa e sugestao. A skill `auditoria-marketing` foi
reescrita para carregar isso em toda rodada, semanal e pontual.

O que mudou (arquivos, nao banco):

- **Dois deveres, nao um.** A auditoria agora entrega diagnostico (o que ja fazia) E
  proposta de evolucao na mesma rodada. Novo braco: **Evolucao & Propostas**.
- **Time de agentes de pesquisa e proposta** — cinco papeis novos alem dos tres
  olhares de diagnostico: Campo (alcance local no Rio), Sazonal, Estrategia de mercado,
  Posicionamento social, Branding. Cada um mapeia numa skill que ja existe
  (`socialmedia`, `apple-strategist`, referencia visual v3) — a skill orquestra, nao
  reescreve. Campo/Sazonal/Mercado podem rodar como subagents em paralelo.
- **Junho como linha de base.** O pico de 24/06 (2.344) e o ritmo junho vs. julho
  viraram baseline a bater no braco propositivo — absorve as pendencias #18 (pico nao
  investigado) e parte da #17 (Vetores).
- **Novos Vetores como opcoes, nunca escrita automatica.** Invariante preservado:
  propor no esquema exato da aba (`Semana` · `Periodo` · `Gancho` · `Ancora` · `Peças`
  · `Trava` · `Status`, com `Status` = proposto), 2-3 por rodada, com recomendacao.
  Quem abre e o dono.
- **A trava anti-jato.** A maior falha da rodada de 20/07 foi plano rico + execucao
  magra. O braco propositivo tem trava embutida: checar capacidade (executado vs.
  planejado) antes de propor, no maximo 3 producoes e 2-3 Vetores por rodada, sempre
  com recomendacao e gancho medido, ressalva explicita quando a execucao esta abaixo
  do plano. Proposta sem execucao vira plano de gaveta, e o projeto ja tem plano
  demais.

Arquivos tocados: `.claude/skills/auditoria-marketing/SKILL.md` (reescrito),
`references/formato-relatorio.md` (secoes 5 e 6 novas: Evolucao & Propostas e Opcoes de
Vetor), `references/evolucao-e-propostas.md` (novo, processo do braco propositivo).
A rotina em nuvem le a skill do repo na hora, entao o proximo disparo de segunda ja
sai no formato novo sem recriar o trigger — mas so depois de commitar e empurrar estes
arquivos (a rotina le `main`, nao o working tree local).

Pendencia nova: **rodar uma vez de verdade no formato novo** (com o braco propositivo e
as opcoes de Vetor) e conferir se o relatorio no Notion ficou palpavel — nao foi rodado
nesta troca, so o processo foi reescrito.

## 8. Invariantes reforcados

- **"Faca sempre palpavel" vale para qualquer trilha, nao so o Nucleo.** A sessao
  nao parou em "skill criada" — rodou a auditoria de verdade, com numero medido, e
  colocou o relatorio num lugar que o dono abre sem precisar de mim.
  Ver [[entregar-palpavel]] na memoria.
- **Nomear a maior falha primeiro, nao a lista inteira sem hierarquia.** O relatorio
  de auditoria abre com o achado mais caro (execucao real vs. plano), nao com a lista
  de tudo que foi checado.
- **Numero medido, nunca estimado.** Onde a fonte nao garantia precisao (soma manual
  de serie diaria do Metricool), o relatorio disse que era aproximado em vez de
  fingir exatidao.
