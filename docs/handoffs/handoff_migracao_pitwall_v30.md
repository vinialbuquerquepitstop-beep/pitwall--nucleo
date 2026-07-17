# Handoff Migracao Pit Wall (Nucleo) v30

Substitui a v29. Data: 17/07/2026.

---

## 1. Headline: a Fase 6 GANHOU TELA

A ordem da v29 era "a proxima sessao comeca pelo front e nao sai dele". Cumprida.
Tres abas novas construidas, provadas e empurradas: **Hoje, Conteúdo, Rotina**, mais o
**Mais** da barra mobile (decisao 7). O dono abre o app e ve a Fase 6.

| O que | Estado |
|---|---|
| Front da Fase 6 (3 abas + Mais) | **Construido. 107 assercoes no Chrome, 0 falhas. Empurrado.** |
| Edge Function | **v3 deployada: ganhou CORS. Sem CORS o botao Sincronizar NUNCA teria funcionado (defeito achado nesta sessao, secao 3).** |
| `NOTION_TOKEN` | **Configurado pelo dono** (Edge Functions -> Secrets). |
| Caminho feliz do Notion | **AINDA NAO PROVADO.** Falta 1 clique do dono (secao 6). |
| Cron do sync (`conteudo-sync`, jobid 3) | Agendado 05:30 BR. **Morto ate a service_role key entrar no Vault** (secao 6.2). |
| `fn_conteudo_disparar_sync` + `pg_net` | Aplicados (migracao `fase6_c_disparo_sync_conteudo`). ACL provada: so `service_role` executa. |

---

## 2. O que cada aba nova faz (contrato consumido, nada inventado)

- **Hoje** (`painel_do_dia`, 1 chamada): pitboard proprio com 4 tiles (rotina em %,
  pecas de conteudo de hoje, lembretes em aberto, idade do sync), checklist por
  categoria, tarefa avulsa, nota do dia (upsert), lembretes, conteudo de hoje, e o
  botao "Puxar do molde" (`puxar_rotina`, o reparo; quem semeia e o cron).
  O tile de % e a decisao 8 da v29: o anel do legado virou tile do pitboard.
- **Conteúdo** (`conteudo_periodo`): agrupado por data, marcador `hoje`, chip neutro de
  status, link para o card no Notion, linha de sync ("sincronizado há Xh", aviso
  `--morno` se >24h, `--erro` se falhou) e o botao **Sincronizar**
  (`functions.invoke('sincronizar-conteudo')`, capacidade nova no app.js).
- **Rotina** (`rotina_completa`): o molde. `pode_editar` liga os formularios (so dono):
  criar categoria (o `codigo` e slug estavel do rotulo, gerado uma vez; a chave nunca
  e o rotulo), criar tarefa com toggles seg..dom (ISODOW 1..7, nenhum marcado = todo
  dia), remover tarefa. Vendedor ve read-only.

Decisoes de tela tomadas nesta sessao (dentro das regras ja escritas):
- **Categoria e gaveta, nao estado:** rotulo mono uppercase `--dim` (`.dia-cat-rot`,
  irmao do `.pb-rot`). Zero cor nova, como a v29 secao 4 mandava.
- **Check de tarefa concluida e NEUTRO** (`--dim` + line-through). Verde continua
  significando so "deu certo" (WhatsApp, Convertido). Travado por regra na suite e por
  cor computada no harness.
- **Aba padrao continua a Fila.** Hoje e o primeiro item do nav, mas o app abre na
  Fila: a tela de dinheiro nao muda de lugar sem decisao do dono. Reabrir se ele pedir.
- Novo uso do azul: **so** `.btn-sync` (acao primaria da aba, mesmo papel do
  `.btn-cap`), hover de `.cont-link` (precedente do `.btn-editar:hover`) e o estado
  aberto do Mais (estado ativo de navegacao). Auditado pela regra 11.1 da suite.

**Mobile (decisao 7):** os MESMOS botoes, sem duplicar DOM. A barra vira grid de 5
colunas; as 4 raras (`.aba-rara`: Indicações, Captação, Dashboard, Rotina) tem
`grid-area` na linha 1 e `display:none`; o Mais poe `mais-aberto` no `#abas` e elas
aparecem como segunda linha. Provado no harness com cor/display computados
(o viewport headless de 800px ja e mobile).

---

## 3. O defeito que teria matado o botao: CORS

A Edge Function da v29 **nao tratava CORS**: sem resposta ao preflight `OPTIONS` e sem
`Access-Control-Allow-Origin`. Os 3 portoes da v29 foram provados por **curl, que nao
faz preflight**, entao passaram; o navegador (workers.dev -> supabase.co, com header
`Authorization`) seria bloqueado sempre. O botao Sincronizar nasceria morto.

Corrigido na v3 da function (headers CORS em toda resposta + `OPTIONS` respondido com
204 ANTES do portao de papel, porque preflight nao carrega Authorization por definicao).
`verify_jwt` continua true. **Reprovado contra o servico no ar:**

| Teste | Resultado |
|---|---|
| `OPTIONS` sem Authorization | **204** + `access-control-allow-*` (a borda do `verify_jwt` deixa preflight passar: MEDIDO, nao presumido) |
| POST sem Authorization | 401 `UNAUTHORIZED_NO_AUTH_HEADER` |
| POST com a ANON key | `{"ok":false,"msg":"Nao autorizado."}` 401 |

Licao nova para a lista: **provar endpoint de browser com curl prova o servidor, nao o
navegador.** Preflight so aparece quando ha Origin + header custom.

---

## 4. Suite: o que mudou e por que

`ferramentas/validar.py` (roda da raiz: `python ferramentas/validar.py`):
- **[10] Fase 6:** 14 RPCs + `functions.invoke` ligados; abas novas unicas no HTML;
  4 `.aba-rara`; classes fora do alcance da regex conferidas na mao; `DIAS_ISO`
  (`["","seg","ter","qua","qui","sex","sáb","dom"]`) travado, e o contrato visivel do
  `extract(isodow)` do banco.
- **[11] Regras da secao 13 da v29:** contador do azul por SELETOR novo vs baseline
  (pegaria a barra de progresso da Fase 5); `:root` byte a byte contra
  `app.css.antes` (zero token novo); zero hex no `app.js`; janela nao vaza
  (`\b28\b` proibido no app.js; 7/28 no index.ts com a linha do `Notion-Version`
  excluida ANTES, a armadilha ja pisada); zero `.insert(/.update(/.upsert(/.delete(`;
  check de concluida sem `--ok`/`--accent`.
- **Consertos em checks existentes:** `velho_html` lia `public/index.html` (o proprio
  arquivo novo!), entao "IDs perdidos" era vacuo desde a repontagem; agora le
  `ferramentas/index.html.antes` e acusou corretamente os 5 IDs novos. O check do
  pitboard oculto acompanhou a forma nova (lista de 4 abas).

`ferramentas/harness.py`: stub ganhou as 15 RPCs da Fase 6 (estado mutavel, espelhando
os contratos reais lidos de `pg_get_functiondef`) e `functions.invoke` com modo
`__SYNC_FALHA` que devolve o contrato real de token ausente (200 + ok:false).
`--virtual-time-budget` subiu de 9000 para 25000 (o teste dobrou de tamanho).
**107 assercoes, 0 falhas**, incluindo as da secao 13: cor computada da categoria =
`--dim`; check neutro; marcar risca e persiste; manual entra; remover chama
`remover_tarefa` (soft) e a linha some; nota sem `p_data` do navegador (fuso e do
banco); token ausente = toast + lista NAO esvazia; sync >24h ganha `.velho`;
pitboard de LEAD escondido em Hoje/Conteúdo; slug `Conteúdo & Marketing` ->
`conteudo_marketing`; dias `[1,3,5]`; Mais abre/fecha as raras.

Baselines `.antes` conferidas por MD5 no inicio (receita: `md5sum` direto dos arquivos,
byte a byte, iguais aos do repo).

---

## 5. Defeito meu, achado e corrigido na sessao

Escrevi o regex de remover acento do `rotSlug` com os **diacriticos combinantes
literais** dentro da classe, a MESMA armadilha que a v29 registrou no `index.ts`.
Corrigido para `̀-ͯ` escapado (via script Python, porque o editor do
ambiente converte o escape em caractere literal ao digitar). O harness prova o
resultado (`Conteúdo & Marketing` -> `conteudo_marketing`).

---

## 6. BLOQUEADORES restantes: 1 clique + 1 linha, ambos do dono

### 6.1 Provar o caminho feliz do Notion (1 clique)

O laco `authenticated -> invoke -> Notion -> conteudo` continua teoria. Agora que a
tela existe: **logar no app -> aba Conteúdo -> botao Sincronizar.** Se aparecer
"Sincronizado" e o calendario encher, a Fase 6 fecha o ciclo. Conferir no banco:

```sql
select criado_em, origem, ok, msg, vistos, inseridos, atualizados, sumidos
  from public.conteudo_sync_log order by id desc limit 5;
```

Se falhar: 404 = o Calendário nao foi compartilhado com a integracao `Pit Wall Nucleo`
(Notion -> `...` -> Connections); 401 = token errado no secret `NOTION_TOKEN`.

### 6.2 Cron automatico (1 linha no SQL editor)

Tudo pronto menos a chave. `pg_net` instalado, `fn_conteudo_disparar_sync` criada
(ACL: so `service_role`, provado), cron `conteudo-sync` agendado (jobid 3,
`30 8 * * *` GMT = 05:30 BR). O job vai FALHAR todo dia com "Vault sem ... 
service_role_key" ate rodar, no SQL editor do Supabase (a key vem de Project
Settings -> API Keys -> `service_role`; nao passa pelo chat):

```sql
select vault.create_secret('COLE_AQUI_A_SERVICE_ROLE_KEY', 'service_role_key');
```

Conferir depois (cada select e uma chamada separada):
```sql
select jobid, jobname, schedule, active from cron.job order by jobid;
select id, created, status_code from net._http_response order by id desc limit 3;
select criado_em, origem, ok, msg from public.conteudo_sync_log order by id desc limit 3;
```

Custo consciente ja aceito na v29: a chave-mestra do banco passa a viver dentro do
proprio banco (Vault), caminho documentado do Supabase.

---

## 7. Pendencias

| # | Item | Nota |
|---|---|---|
| 1 | Prova do caminho feliz do Notion | Secao 6.1. **1 clique do dono.** |
| 2 | service_role key no Vault | Secao 6.2. **1 linha do dono.** Sem ela o cron falha em silencio diario. |
| 3 | **O dono digitar o molde na aba Rotina** | A porta existe agora. Ate la, Hoje mostra o estado vazio apontando para a Rotina (pendencia 4 da v29, metade resolvida: falta o conteudo). |
| 4 | Calibrar a meta de captacao | 10/dia segue chute. `update captacao_meta set alvo = N where codigo='abordagens_dia';` |
| 5 | Ligar captacao -> lead | `captacao.virou_lead_id` sem nada preenchendo. Reabrir consentimento (v28 2.4) quando construir. |
| 6 | Dashboard: metrica antes da view | Segurado. |
| 7 | `registrar_nota` sem uso real | Continua. |
| 8 | Aba padrao: Fila ou Hoje? | Decisao guardada para o dono (secao 2). Custo de mudar: 1 linha no app.js. |
| 9 | Leaked Password Protection | Bloqueada: plano Pro. |
| 10 | `Desktop/pitwall deploy/` | Monolito morto, candidato a apagar. |
| 11 | Token do GitHub em texto puro | `Desktop\CLAUDE\Agente Criação de conteudo\...txt` tem um `ghp_...`. Revogar se ainda valer. |
| 12 | Legado: `Estratégia`, `Métricas`, `Evolução` | Fase 7+. |
| 13 | Baselines `.antes` | Repontar (`cp public/* -> ferramentas/*.antes`) ao COMECAR a proxima obra, nao no meio. |

---

## 8. Armadilhas (as novas primeiro)

- **curl nao prova CORS.** Endpoint chamado de browser se prova com preflight
  (`OPTIONS` + Origin + Access-Control-Request-Headers) ou com o browser de verdade.
- **O editor converte `\uXXXX` em caractere literal ao digitar.** Regex com faixa
  unicode entra por script (Python controlando os bytes), e a suite confere depois.
- **`velho_*` que aponta para o arquivo novo e check vacuo.** Baseline e `.antes`,
  sempre. O de HTML ficou vacuo por duas fases sem ninguem notar.
- **O viewport do Chrome headless (800px) ja e mobile** (`max-width:860px`). Assercao
  de layout desktop nao funciona ali sem `--window-size`.
- Todas as da v29 continuam valendo (md5 vs `git show HEAD:`, 307 do `/index.html`,
  grep ingenuo do 28, CREATE OR REPLACE resetando ACL/security_invoker, etc.).

---

## 9. Invariantes reforcados

- **"Faça sempre palpável" cumprido:** a fase terminou em tela aberta, e a prova que
  falta (6.1) e um clique NELA, nao um curl.
- **Quando eu afirmo uma defesa, eu testo a defesa** valeu de novo: o `verify_jwt`
  barrando ou nao o OPTIONS foi medido contra o servico, nao presumido.
- **A chave e o que e estavel:** o `codigo` da categoria nasce como slug do rotulo e
  nunca mais deriva dele; o rotulo fica editavel.
- **Regra de negocio num lugar so:** o front nao produz data de negocio (todos os
  `p_data` omitidos; fuso do Brasil no Postgres) e nao decide janela nenhuma.
