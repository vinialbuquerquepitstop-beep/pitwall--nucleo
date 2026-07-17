# Handoff Migracao Pit Wall (Nucleo) v29

Substitui a v28. Data: 17/07/2026.

---

## 1. O headline honesto: a Fase 6 NAO tem tela

O backend inteiro da Fase 6 esta no ar e provado. **E nada disso e visivel ou usavel
pelo dono.** Nao ha uma aba nova no app. Quem abrir o Pit Wall hoje ve as mesmas 5 abas
da v28.

O dono nomeou isso na hora: **"faça sempre palpável"**. Esta certo, e a licao vale mais
que a fase: encanamento provado nao e entrega. A proxima sessao **comeca pelo front**, e
so o front, ate a tela Hoje abrir.

| O que | Estado |
|---|---|
| Fase 5, captacao ativa | No ar (`6210aec`), sem mudanca. |
| **Fase 6, banco** | **Aplicado e provado. 6 migracoes, 9 objetos, 17 RPCs, 31 provas.** |
| **Fase 6, Edge Function** | **Deployada e ACTIVE. Portoes de auth provados. O laco do Notion NUNCA rodou de verdade: falta o token.** |
| **Fase 6, front** | **NAO EXISTE. Zero linha escrita.** |
| Fase 6, cron do sync | **NAO LIGADO.** Falta `pg_net` + service_role key no Vault. |
| `registrar_nota` (pendencia 2 da v28) | Continua sem uso real. |

---

## 2. A restricao que moldou a fase inteira

O Nucleo e front estatico (Cloudflare) falando direto com o Supabase. **O navegador nao
pode chamar `api.notion.com`:** CORS bloqueia, e mesmo que nao bloqueasse o token ficaria
dentro do `app.js`, que e servido publico. O Apps Script legado se safava porque **ele E
servidor**. O Nucleo nao tinha esse andar.

Por isso "conectar o Pit Wall no Notion" nunca foi uma aba: e uma **peca de servidor
inedita**. Escolhida: Supabase Edge Function. Alternativa considerada e recusada:
Cloudflare Worker com Cron Trigger, que evitaria o `pg_net`, mas poria a `service_role`
key num segundo provedor e num segundo lugar de rotacao, e inverteria o CLAUDE.md
("Supabase fica de fora de qualquer tarefa de frontend") pondo backend no pipeline do
front. Fica como plano B se o `pg_net` der problema.

---

## 3. Decisoes do dono (todas conscientes, com o custo escrito)

| # | Decisao | Custo aceito |
|---|---|---|
| 1 | Legado e Nucleo **convivem**, migracao por partes, sem data de morte. | Dado em dois lugares por um tempo. |
| 2 | Fase 6 = Conteudo + Hoje + Rotina **juntos**. | **Contra a recomendacao de fazer so Conteudo.** Defesa aceita e correta: Conteudo sem Hoje e base sem consumidor; Hoje sem Conteudo nasce com card vazio. Custo real: duas pecas de banco e uma de servidor na mesma fase, e nenhuma tela no fim. |
| 3 | Sync: **pg_cron automatico + botao manual**. | Exige `pg_net` e service_role no Vault. |
| 4 | Historico do legado (`Dias`/`Notas`/`Lembretes`) **nao migra**. | Evolucao/Metricas nascem zeradas quando existirem. |
| 5 | Molde da rotina: **comeca vazio, o dono digita na aba Rotina**. | Dissolveu o bloqueador do `defaultRoutine()`, cujo fonte so existe na nuvem do Apps Script. |
| 6 | **Aba Rotina entra na Fase 6.** | Contra a recomendacao inicial, **mas a decisao 5 a tornou mais defensavel que a recomendacao**, e a objecao foi retirada: e por onde o molde entra. Custo real e pago: policies de escrita em `rotina_*` sao **o primeiro furo** no padrao "config e so-leitura no app" (`captacao_frente`, `captacao_meta`, `cadencia_regra` sao so SELECT). |
| 7 | Barra mobile: **5 abas + "Mais"**. | **EDITA A REFERENCIA VISUAL v3**, que rejeitou hamburguer por escrito (`referencia-visual-v3.html:693`). O argumento dela era "um toque a mais em cada troca"; aqui o toque extra cai so nas 3 abas raras. Decisao consciente do dono. |
| 8 | Categoria vira **rotulo de secao**; anel de % vira **tile do pitboard**. | Zero token novo, zero uso novo do azul. |

---

## 4. A cor: por que o print do legado nao pode ser copiado

Conferido cor por cor contra a referencia v3. **Nao sobra nenhuma:**

| Cor | Ja significa | Cabe categoria? |
|---|---|---|
| `--accent` `#0025CC` | 4 usos e mais nenhum: item ativo, contador da fila, acao primaria, chip de indicacao (`:370`) | Nao. Seria o **5o uso** — o erro exato que reprovou a barra de progresso da Fase 5. |
| `--quente` / `--morno` / `--frio` | temperatura de lead | Nao. Invariante 3. Laranja=Atendimento e azul=Conteudo colidem de frente. |
| `--ok` `#17A06B` | sucesso: WhatsApp, chip Convertido (`:92,224`) | Nao. Verde=Financeiro colidiria com "deu certo". |
| `--erro` `#B01235` | falha de sistema | Nao. |

Quarta familia (roxo/ciano) e **pior que todas**: seria a unica cor da tela sem
significado, num sistema cuja tese e "cor usada so onde carrega estado" (`:362`).
Categoria nao e estado, e gaveta.

**A causa raiz e a mesma do emoji.** A v3 diz, sobre os emoji do `dicionario_rotulos`
(`:793`): *"carregam emoji porque no Sheets emoji era o unico jeito de colorir celula"*.
O ponto colorido de categoria e o mesmo fenomeno: no Apps Script nao havia como agrupar
sem pintar. **Com CSS de verdade, agrupamento e layout e tipografia.** Copiar o ponto
seria portar a limitacao do Sheets junto com o dado.

A solucao ja existe na referencia aprovada: o micro-rotulo mono, uppercase,
`letter-spacing:.14em`, `--dim` — o dispositivo de `.nav-rot` (`:121`), `.pb-rot`
(`:180`), `.scripts-rot` (`:230`).

```
ATENDIMENTO & VENDAS            <- .dia-cat-rot, irmao de .pb-rot
  [ ] Abertura: responder WhatsApp + Direct
  [x] Follow-up do dia no CRM (13h)

CONTEÚDO & MARKETING
  [ ] Preparar Reel de sexta
```

**Tarefa concluida: sem verde.** `line-through` + `--dim` + check neutro. 8 checks verdes
transformam `--ok` de sinal em decoracao, e ai ele para de significar "deu certo" no chip
Convertido.

---

## 5. `conteudo` NAO e auditada. Excecao DECIDIDA, nao esquecida.

Esta secao existe porque a v28 secao 5 mostrou o custo de nao escrever: `dicionario_rotulos`
esta sem trigger e sem `tenant_id`, **ninguem sabia**, e so virou achado quando o UPDATE do
emoji nao deixou rastro. A diferenca entre "excecao decidida" e "esquecimento" e uma linha
escrita. Aqui estao elas. **Tambem esta no `comment on table public.conteudo`, no proprio banco.**

1. **O invariante 7 e o 6 sao separados.** O 7 exige `tenant_id` + policy de RLS, e nao diz
   uma palavra sobre auditoria. Auditoria e o 6, cujo proposito e guardar a prova de por que
   o sistema fez o que fez. `conteudo` nao registra decisao de ninguem: **e fotocopia de
   sistema de terceiro.** Entao: `tenant_id` + RLS sim (o 7 cumprido de verdade), trigger nao.
2. **Custo medido, nao estimado.** ~35 cards, UPDATE em quase todos por sync diario (nem que
   seja `sincronizado_em`) = ate 35 linhas/dia de `antes`+`depois` jsonb, ~12k/ano, numa
   `auditoria` que hoje tem **526 linhas no total**. Em um ano ela seria ~96% historico de
   edicao do Notion. O dano nao e disco: e **afogar por diluicao o rastro de decisao sobre
   lead**. A auditoria vale porque e legivel.
3. **O Notion ja versiona a propria pagina.** Auditar o cache e manter copia pior de um
   historico que ja tem dono.
4. **A CONTENCAO, e e ela que segura tudo:** `conteudo` e **so-leitura para o app**.
   `authenticated` tem **SELECT e mais nada**, e nao executa `sincronizar_conteudo`. Escreve
   nela exclusivamente a RPC, via `service_role`. Enquanto for assim, **nao ha acao de
   operador para auditar**. Provado (P13/P14, secao 8).
5. **Se um dia aparecer "marcar como produzido" na aba Conteudo, REABRIR ESTA DECISAO.**
   Essa acao ou escreve no Notion via a function, ou ganha tabela propria auditada. Mesmo
   padrao de contencao de `captacao` vs `lead` (v28 secao 2.4).
6. `conteudo_sync_log` e a auditoria de verdade dela, na granularidade certa: responde "o
   sync rodou? deu certo? quando?", que a auditoria por linha responde mal.

**Diferenca deliberada vs `dicionario_rotulos`:** aquela nao tem `tenant_id` e e config
compartilhada. `conteudo` **tem** `tenant_id` + RLS. Nao copiamos aquele defeito.

---

## 6. O que foi construido, com nome exato

### 6.1 Migracoes (nesta ordem)

```
20260717030505  fase6_a_rotina_e_dia
20260717030743  fase6_a_rpcs_do_dia_e_rotina
20260717031655  fase6_b_conteudo
20260717031731  fase6_b_fix_temp_table_recallable
20260717031856  fase6_b_fix_desempate_do_log
20260717032106  fase6_b_view_fonte_com_janela
```

### 6.2 Objetos

| Objeto | RLS | Policies | Triggers |
|---|---|---|---|
| `rotina_categoria` | on | 3 | `trg_auditar_rotina_categoria`, `trg_touch_rotina_categoria` |
| `rotina_tarefa` | on | 3 | `trg_auditar_rotina_tarefa`, `trg_touch_rotina_tarefa` |
| `dia_tarefa` | on | 3 | `trg_auditar_dia_tarefa` |
| `dia_nota` | on | 3 | `trg_auditar_dia_nota`, `trg_touch_dia_nota` |
| `dia_lembrete` | on | 3 | `trg_auditar_dia_lembrete` |
| `conteudo` | on | 1 (select) | **(sem trigger) — excecao da secao 5** |
| `conteudo_fonte` | on | 1 (select) | `trg_auditar_conteudo_fonte`, `trg_touch_conteudo_fonte` |
| `conteudo_sync_log` | on | 1 (select) | (sem trigger) — ele E o log |
| `v_conteudo_fonte` | `security_invoker=on` **conferido em `pg_class.reloptions`** | - | - |

`authenticated` em `conteudo`, `conteudo_fonte`, `conteudo_sync_log`, `v_conteudo_fonte`:
**SELECT e mais nada**. Nas 5 do dia/rotina: SELECT, INSERT, UPDATE. **Nenhuma tem DELETE
nem TRUNCATE** (invariante 9). `anon`: zero grants em todas.

### 6.3 RPCs

`authenticated` executa (14): `painel_do_dia(date)` **stable**, `conteudo_periodo(date,date)`
**stable**, `rotina_completa()` **stable**, `puxar_rotina(date)`, `marcar_tarefa(uuid,boolean)`,
`adicionar_tarefa(text,text,date)`, `remover_tarefa(uuid)`, `salvar_nota(text,date)`,
`salvar_lembrete(text,date)`, `marcar_lembrete(uuid,boolean)`, `remover_lembrete(uuid)`,
`salvar_rotina_categoria(text,text,integer)`,
`salvar_rotina_tarefa(text,text,smallint[],uuid,integer)`, `remover_rotina_tarefa(uuid)`.

**So `service_role` executa (3, todas `security definer`):** `fn_rotina_semear()`,
`sincronizar_conteudo(uuid,text,jsonb,date,date,boolean,text,integer)`,
`registrar_falha_sync(uuid,text,text,integer)`.

### 6.4 Cron

```
jobid 1  regua_pitwall_diaria   0 8 * * *   -> fn_regua_varredura()   = 05:00 no Brasil
jobid 2  rotina-semear         10 8 * * *   -> fn_rotina_semear()     = 05:10 no Brasil
(falta)  conteudo-sync         30 8 * * *   -> fn_conteudo_disparar_sync()  = 05:30
```
`cron.timezone` = **GMT**, medido, nao presumido.

### 6.5 Decisoes de modelagem que sao o coracao (nao mexer sem entender)

- **`dia_tarefa.categoria`/`titulo` sao SNAPSHOT, denormalizados de proposito.** Editar o
  molde amanha nao pode reescrever o que se fez ontem (logica do invariante 6).
  `rotina_tarefa_id` existe **so** para idempotencia, **nunca para display**.
- **`removida_em` em vez de DELETE.** Nao e so o invariante 9: e idempotencia. O
  `on conflict (tenant_id, usuario_id, data, rotina_tarefa_id) do nothing` bate na linha
  que continua existindo, entao **a tarefa removida nao ressuscita**. Com DELETE de
  verdade, ela voltaria no proximo `puxar_rotina`. Provado (P4).
- **`dias_semana smallint[]`, ISODOW 1=segunda..7=domingo, NULL = todo dia.** Singular nao
  serve: "seg, qua e sex" viraria 3 linhas com o mesmo titulo. Casa com
  `extract(isodow from p_data)`. **Off-by-one aqui gera a rotina do dia errado, em
  silencio, todo dia.** Provado contra quinta e sabado reais (P1, P2).
- **`usuario_id` no unique desde ja.** O dia e por pessoa. Hoje ha 1 operador; com um
  vendedor, dia por tenant = dois dividindo checkbox. Cabe no "barato entra agora" do 17.
- **`painel_do_dia` NAO chama `puxar_rotina`.** Ler nao pode semear (invariante 1: o sensor
  registra, a regua decide). Quem semeia e o cron; o botao repara. Provado STABLE (P6).
- **`painel_do_dia` NAO devolve numero de lead.** O dia e outro laco.
- **O `saveDay` do legado NAO foi portado.** Ele faz delete-all-da-data + reinsert. Aqui
  isso destruiria `concluida_em` (a hora em que voce fez) e afogaria a auditoria numa chuva
  de DELETE+INSERT a cada salvamento. A escrita e cirurgica.

---

## 7. A Edge Function: um cano burro, e isso e a regra

`supabase/functions/sincronizar-conteudo/index.ts`. Deployada, `ACTIVE`, `verify_jwt=true`.

**Ela nao tem regra de negocio, e isso nao e detalhe de estilo.** Janela, upsert, soft
delete e escopo sao regra, e "regra de negocio mora num lugar so" (v28 secao 8). Ela le
`v_conteudo_fonte` -> busca no Notion -> normaliza -> entrega o `jsonb` para
`sincronizar_conteudo()` -> grava o log. Zero decisao.

**Se um numero de janela aparecer no `index.ts`, trocamos o `defaultRoutine()` chumbado no
`Index.html` por janela chumbada no `index.ts`, e nao migramos nada.** A janela vive em
`conteudo_fonte` (7/28) e as datas chegam prontas de `v_conteudo_fonte`, calculadas **no
Postgres, no fuso do Brasil** (invariante 10: a function nao faz matematica de data).

Detalhes que custaram pensamento:

- **O titulo se acha pelo TIPO, nunca pelo nome.** Existe exatamente uma propriedade
  `type:"title"` por database do Notion. Isso **sobrevive ao dono renomear a coluna** —
  chumbar o nome quebraria o sync em silencio, com titulo nulo em toda linha e `ok:true`.
  Invariante 12 aplicado a um sistema de terceiro. **Por isso o nome da propriedade de
  titulo, que a v28 listava como buraco, deixou de importar.**
- Para `Data`/`Tipo`/`Status`/`Semana` o **nome E a chave**. Renomear quebra. Mitigacao:
  propriedade ausente vira aviso, **nunca null calado**.
- `Notion-Version` **pinada** em `2022-06-28`. Versao nao pinada e quebra futura sem deploy.
- Paginacao com `has_more`/`next_cursor`. 35 cards cabem em 1 pagina hoje; o loop entra agora.

### Contrato de erro (espelha o das RPCs: 200 + `{ok:false, msg}`; 5xx so para bug)

| Situacao | Efeito no banco |
|---|---|
| `NOTION_TOKEN` ausente | 1 log `ok=false`. **ZERO escrita em `conteudo`.** |
| 401 / 404 / 429 | idem |
| Fetch quebra na pagina 2 de 3 | **aborta, nao chama a RPC.** Nada alterado. |

**A trava que impede o pior caso:** token ausente ou invalido **nunca chega no soft
delete**. Sem ela, configurar o token errado apagaria a aba Conteudo e pareceria que o
calendario esvaziou. Reforcada no banco por `p_completo`: o soft delete so roda com `true`.

---

## 8. Validacao: 31 provas, todas em transacao revertida

**Tecnica usada, e vale repetir:** o bloco termina em `raise exception` com o resultado na
mensagem. **O rollback fica garantido pelo Postgres, nao pela minha memoria de digitar
ROLLBACK.** Confirmado depois em cada rodada que as tabelas voltaram a 0.

**Logica (9):** ISODOW na quinta e no sabado; `puxar_rotina` 2x = `novas=0`; removida nao
ressuscita; 1 escrita = **exatamente 1** auditoria com antes/depois e autor certos;
`painel_do_dia` nao escreve; varias tarefas manuais convivem; categoria invalida recusada;
nota faz upsert.

**RLS (10):** dono tenant A = 2 (o proprio + o do vendedor); **vendedor = 1 (so o proprio
dia)**; **TENANT ERRADO = 0** em `dia_tarefa`, `dia_nota` e `conteudo`; `rotina_tarefa` do
tenant errado devolve so a linha dele; `anon` recusado.

**Defesa em profundidade (6), e esta importa:** o vendedor foi barrado pelo `if` na funcao,
o que **nao prova nada sobre a RLS**. Testado por fora: INSERT direto em `rotina_tarefa`
RECUSADO; UPDATE direto = 0 linhas; mexer no dia do dono = 0 linhas; DELETE RECUSADO;
TRUNCATE RECUSADO; escrever no dia de outrem RECUSADO. **A RLS e o portao; o `if` e
cosmetico.** Agora provado em vez de alegado.

**Conteudo (16):** payload 2x = ins=0/upd=3/sumidos=0; **card fora da janela intacto**;
`p_completo=false` nao marca nada; card que some e volta tem `sumiu_em` preenchido e
limpo; fonte invalida recusada; **sync gera 0 auditoria e exatamente 1 log**;
`authenticated` recusado em `sincronizar_conteudo`, `registrar_falha_sync`, INSERT e
UPDATE em `conteudo`.

**Portoes da Edge Function (3), contra o servico no ar:**

| Teste | Resultado |
|---|---|
| Sem `Authorization` | 401 `UNAUTHORIZED_NO_AUTH_HEADER` (a borda barra) |
| **Com a ANON key** | **`{"ok":false,"msg":"Nao autorizado."}` 401** |
| JWT forjado com `role=service_role` | 401 `UNAUTHORIZED_LEGACY_JWT` (assinatura morre na borda) |

**O teste da anon key e o mais importante da fase.** A anon key **e um JWT valido do
projeto** e **passa pelo `verify_jwt`** da plataforma. Ela esta publica dentro do `app.js`.
Se eu tivesse confiado so no `verify_jwt`, qualquer pessoa dispararia sync. **Quem barrou
foi a checagem explicita da claim `role`.** E o 3o teste prova que decodificar a claim sem
re-verificar e seguro: assinatura falsa nao chega no codigo.

**Ainda NAO provado, e precisa estar escrito:** o caminho feliz do Notion nunca rodou. O
laco `authenticated -> invoke -> Notion -> conteudo` e o laco `cron -> pg_net -> function`
sao **teoria** ate o token existir.

---

## 9. Tres defeitos MEUS, achados e corrigidos

Registrados porque a proxima sessao vai reintroduzi-los se nao souber:

1. **Agendei `rotina-semear` em `0 8 * * *`, o mesmo minuto da `regua_pitwall_diaria`.** O
   meu proprio plano dizia "nao rodar os dois no mesmo minuto" e eu fiz. Movido para `10 8`.
2. **`sincronizar_conteudo` criava a temp table `_paginas` sem soltar antes.** Duas chamadas
   na mesma transacao quebravam com "relation already exists". Em producao cada sync e sua
   propria transacao, entao **ficaria latente por meses**. Corrigido na origem com
   `drop table if exists`, nao contornado no teste.
3. **`criado_em default now()` e o timestamp da TRANSACAO.** Todos os logs escritos na mesma
   transacao empatam, e `order by criado_em desc limit 1` escolhia qualquer um: "qual foi o
   ultimo sync" era nao-deterministico. **Mesma classe da pendencia 6 da v28**, mas aqui o
   desempate era de graca: `conteudo_sync_log.id` e identity monotonico. Passou a ordenar
   por `id`. **A prova pegou isto sozinha** (a P5b saiu vazia quando devia trazer a msg do
   sync parcial).

E um quarto, de higiene: um caractere CJK (`配`) entrou por acidente numa string do
`index.ts`, e o regex de remover acento estava com os diacriticos literais em vez de
`̀-ͯ`. Varredura de nao-ASCII no arquivo agora acusa so `á`, `ã`, `ç` em
mensagens de tela, que e onde o acento **deve** estar.

---

## 10. BLOQUEADORES: exatamente o que fazer

### 10.1 `NOTION_TOKEN` (bloqueia o sync inteiro)

**Nao mandar o token pelo chat.**

1. https://www.notion.so/profile/integrations -> **New integration**. Nome: `Pit Wall Nucleo`.
   **Criar nova, nao reusar a do Apps Script:** legado e Nucleo convivem sem data de morte
   (decisao 1), entao token compartilhado significa que revogar por causa de um derruba o
   outro, e um vazamento leva os dois. Custo: 5 minutos.
2. Copiar o **Internal Integration Secret** (`ntn_...`).
3. Abrir o **Calendário de Conteúdo** no Notion -> `...` -> **Connections** -> adicionar
   `Pit Wall Nucleo`. **Sem este passo o Notion responde 404, nao 403.** O 404 parece
   "database nao existe" e manda cacar o bug no lugar errado.
4. Supabase -> **Edge Functions -> Secrets** -> **Add new secret**.
   Nome **exato**: `NOTION_TOKEN`. Valor: o `ntn_...`.
5. Testar (o dono, logado no app, aperta o botao "Sincronizar" quando a aba existir). Ou,
   pelo SQL editor, conferir que o log parou de acusar token ausente:
   ```sql
   select criado_em, origem, ok, msg, vistos, inseridos, atualizados, sumidos
     from public.conteudo_sync_log order by id desc limit 5;
   ```

O DB id ja esta semeado em `conteudo_fonte` (`ab0fc93f-d964-4f32-8c81-4be5343687b3`,
janela 7/28). Mudar a janela e UPDATE, **sem deploy**:
```sql
update public.conteudo_fonte set janela_frente_dias = 45 where codigo = 'calendario';
```

### 10.2 `pg_net` + `service_role` key no Vault (bloqueia so o sync AUTOMATICO)

O botao manual funciona sem isto. So o cron depende.

**Custo consciente, e o dono precisa aceitar antes:** isto poe a `service_role` key (a
chave-mestra do banco) **dentro do proprio banco que ela abre**. E o caminho documentado do
Supabase, mas fica registrado aqui e nao descoberto depois.

Pegar a key em Supabase -> **Project Settings -> API Keys -> `service_role`** e rodar no
SQL editor (**substituindo os dois valores**):

```sql
create extension if not exists pg_net with schema extensions;

select vault.create_secret(
  'https://unjzpyexgtbcmjfgcqrx.supabase.co/functions/v1/sincronizar-conteudo',
  'edge_url_sincronizar_conteudo');
select vault.create_secret('COLE_AQUI_A_SERVICE_ROLE_KEY', 'service_role_key');

create or replace function public.fn_conteudo_disparar_sync()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_url text; v_key text; v_req bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'edge_url_sincronizar_conteudo';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise exception 'Vault sem edge_url_sincronizar_conteudo ou service_role_key.';
  end if;
  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object('origem', 'cron'),
    timeout_milliseconds := 30000) into v_req;
  return v_req;
end $$;

revoke all on function public.fn_conteudo_disparar_sync() from public, anon, authenticated;
grant execute on function public.fn_conteudo_disparar_sync() to service_role;

select cron.schedule('conteudo-sync', '30 8 * * *', $$select public.fn_conteudo_disparar_sync();$$);
```

Conferir depois (cada verificacao e uma chamada separada; `execute_sql` so devolve o ultimo
statement):
```sql
select jobid, jobname, schedule, active from cron.job order by jobid;
select id, created, status_code, content from net._http_response order by id desc limit 3;
select criado_em, origem, ok, msg from public.conteudo_sync_log order by id desc limit 3;
```

---

## 11. Pendencias

| # | Item | Nota |
|---|---|---|
| 1 | **O FRONT DA FASE 6** | **A proxima sessao comeca aqui e nao sai daqui.** Abas Hoje, Conteúdo, Rotina. Ver secao 12. |
| 2 | `NOTION_TOKEN` | Secao 10.1. Bloqueia o sync inteiro. |
| 3 | `pg_net` + Vault + cron `conteudo-sync` | Secao 10.2. Bloqueia so o automatico. |
| 4 | **O dono digitar a rotina** | O seed nasceu VAZIO por decisao 5. A aba Rotina e a porta. Ate la, `painel_do_dia` devolve `categorias: []` e a tela Hoje fica legitimamente vazia. |
| 5 | Calibrar a meta de captacao (era pendencia 1 da v28) | 10/dia continua chute. `update captacao_meta set alvo = N where codigo='abordagens_dia'`. |
| 6 | Ligar captacao -> lead (era 2 da v28) | `captacao.virou_lead_id` segue sem nada preenchendo. **Quando construir, reabrir a conversa de consentimento da v28 secao 2.4.** |
| 7 | Dashboard: conteudo (era 3 da v28) | Segurado. Definir metrica ANTES da view. |
| 8 | `registrar_nota` sem uso real (era 2 da v28) | Continua. |
| 9 | `CLAUDE.md` descreve a estrutura errada | Diz `nucleo/public/` e "o diretorio de trabalho NAO e um repo git". **Ambos falsos:** o repo E o diretorio de trabalho e os arquivos estao em `public/` na raiz. Corrigir. |
| 10 | Leaked Password Protection | BLOQUEADA: exige plano Pro. |
| 11 | `Desktop/pitwall deploy/` | Monolito morto. Candidato a apagar. |
| 12 | Token do GitHub em texto puro | `Desktop\CLAUDE\Agente Criação de conteudo\algum token que não lembro.txt` tem um `ghp_...`. **Revogar se ainda valer.** |
| 13 | Legado: `Estratégia`, `Métricas`, `Evolução` | Nao portadas. Fase 7+. `getEstrategia` e os Vetores seguem so na nuvem do Apps Script. |

---

## 12. O front que falta: contrato ja congelado

| Arquivo | Estado real |
|---|---|
| `public/index.html` | **LEGIVEL, nao minificado** (10529 bytes). A v28 dizia que os 3 eram minificados: **errado num terco**. Barateia a estrutura. |
| `public/app.css` | minificado, 32006 bytes |
| `public/app.js` | minificado, 31502 bytes |

Baseline atualizada no **inicio** da obra (v28 pendencia 5), com MD5 conferido:
`ferramentas/app.js.antes`, `index.html.antes` e `app.css.antes` (esta ultima **nem existia**).

O que o front consome, ja pronto e provado:
- `painel_do_dia()` devolve **tudo da tela Hoje numa chamada**: `data`, `isodow`,
  `contagem {feitas,total}`, `categorias[] -> tarefas[]`, `nota`, `lembretes[]`,
  `conteudo[]`, `sync {ok,quando,horas}`.
- `rotina_completa()` devolve a aba Rotina + `pode_editar`.
- `conteudo_periodo()` devolve a aba Conteudo com a janela vinda da config.
- O botao manual: `supabase.functions.invoke('sincronizar-conteudo')`. **Capacidade nova no
  `app.js`.**

Regras que a suite tem que travar (secao 13).

**Nav:** Hoje -> `Operação`, **primeiro item**, acima de Fila do dia. Conteúdo -> `Operação`
(precedente v28 2.3: "Captacao e acao, nao analise"). Rotina -> `Operação`, por ultimo.
`Análise` continua so com o Dashboard, e continua vazia.

**Mobile:** barra de 5 — Hoje, Fila, Todos, Conteúdo, **Mais** (Indicações, Captação,
Dashboard, Rotina). Hoje sao 5 e o comentario do `app.css` diz "barra de 4 icones"; 8
dariam ~45px por item em 360px, abaixo do alvo de toque. **Decisao 7: edita a referencia v3.**

**Acento correto na UI** (`Conteúdo`, `Rotina`): a referencia decidiu "Acento na UI: corrige".

---

## 13. Regras novas para `ferramentas/validar.py`

1. **Contador de uso do azul:** contar `var(--accent)` no `app.css` e falhar fora da lista
   aprovada (item ativo, contador da fila, acao primaria, chip de indicacao) + `outline` de
   foco. **Esta e a regra que teria pego a barra de progresso da Fase 5.**
2. **Zero token de cor novo:** diff de `:root{...}` contra `app.css.antes`.
3. **Zero hex no `app.js`.**
4. **A janela nao vaza:** grep por numero de janela no `app.js` e no `index.ts`.
   **ARMADILHA JA PISADA:** o grep ingenuo por `28` casa com `'2022-06-28'`, o
   `Notion-Version`. Excluir a string de versao, senao a regra vira falso positivo eterno e
   alguem a desliga.
5. **`app.js` sem escrita direta:** `.insert(`/`.update(`/`.upsert(`/`.delete(` = zero.
6. **Sem emoji nos rotulos novos:** faixa Unicode explicita, conferida a mao. A regex
   "esperta" ja deu 27/27 falso-positivo (v28 secao 7).
7. `contraste.py`/`paleta.py`: rodar para provar que **nada mudou**. Saldo de cor zero.

**Harness Chrome**, assercoes que so o Chrome pega: **cor computada** do rotulo de categoria
e `--dim`, **nao** accent/quente/morno/frio/ok. Mais: marcar risca e persiste; tarefa manual
entra; remover nao apaga; nota e lembrete persistem; "sincronizado ha X" aparece e o aviso
aparece com `ok=false` ou >24h; **token ausente mostra mensagem, nao trava, e a lista nao
esvazia**; **o pitboard de LEAD nao aparece na aba Hoje**; voltar pra Fila nao deixa residuo.

---

## 14. Armadilhas (nao repetir)

- **Entregar fase sem tela.** Foi o erro desta. "Faça sempre palpável."
- **Conferir deploy com o md5 da copia de trabalho.** `core.autocrlf=true`: a copia tem
  CRLF, o blob tem LF. Comparar com `git show HEAD:public/app.js`.
- **`/index.html` devolve 307 para `/`.** Baixar a raiz.
- **Handoff que declara deploy antes do push.**
- **Desenhar sem reler a referencia.** A regra do azul esta escrita.
- **Confiar so no `verify_jwt` numa Edge Function.** A anon key passa. Provado.
- **Grep ingenuo por numero de janela.** Casa com o `Notion-Version`.
- **`CREATE OR REPLACE FUNCTION` reseta ACL** e **`CREATE OR REPLACE VIEW` derruba
  `security_invoker`** em silencio. Refazer e **conferir em `pg_class.reloptions`**.
- **Regex esperta para "achar emoji".**

---

## 15. Invariantes reforcados

- **Encanamento provado nao e entrega.** Cortar a obra para que cada fase termine em tela.
- **Quando eu afirmo uma defesa, eu testo a defesa.** O `if` na funcao nao prova a RLS.
- **Excecao a invariante e uma linha escrita, senao vira esquecimento.** `dicionario_rotulos`
  ensinou; `conteudo` foi escrita em 3 lugares (handoff, `comment on table`, comentario da
  migracao).
- **Terminar prova com `raise exception`:** o rollback fica com o Postgres, nao com a minha
  memoria.
- **A prova pega o defeito que a leitura nao pega.** A P5b vazia revelou o empate de `now()`.
- **Cano burro:** a peca de integracao nao decide nada. Se decidir, a config virou codigo.
- **A chave e o que e estavel, nunca o rotulo.** Vale ate para sistema de terceiro: o titulo
  do Notion se acha por `type:"title"`, nao pelo nome da coluna.
- **Medir, nao presumir.** `cron.timezone` era GMT. Minha primeira conversao de horario saiu
  invertida e so o teste mostrou.
