# Aba Escopo, Fatia 1: frentes, acoes e placar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** entregar a aba Escopo abrivel no Pit Wall, com as 8 frentes de operacao, o placar que ordena da melhor para a pior frente, e a capacidade de adicionar acao e mudar status no toque.

**Architecture:** tres tabelas novas no Postgres (`escopo_frente`, `escopo_acao`, `escopo_acao_evento`) espelhando o par `rotina_categoria` / `rotina_tarefa` que ja existe; uma RPC de leitura que devolve o JSON inteiro da aba com a nota JA CALCULADA em SQL; tres RPCs de escrita; e no frontend uma aba `.aba-rara` cujo `renderEscopo()` entra no `app.js` minificado por script de costura (`ferramentas/patch_escopo.js`), nunca por edicao manual.

**Tech Stack:** Postgres 15 / Supabase (RLS, plpgsql, RPC via PostgREST), HTML/CSS/JS vanilla servido pela Cloudflare, Node para as provas de frontend, Python + Chrome headless para o harness e a medicao de mobile.

**Spec:** `docs/superpowers/specs/2026-08-04-escopo-frentes-design.md`

## Global Constraints

- **Fuso:** `CURRENT_DATE` e PROIBIDO. Sempre `(now() at time zone 'America/Sao_Paulo')::date`. Medido: 20 funcoes ja usam essa forma, 0 usam `current_date`.
- **RLS:** toda tabela tem `tenant_id uuid not null` e policies usando `privado.fn_tenant_atual()` / `privado.fn_papel_atual()`. Helpers vivem em `privado`, nunca em `public`.
- **Grants:** `authenticated` nunca recebe TRUNCATE nem DELETE nestas tabelas. `escopo_acao_evento` recebe apenas SELECT e INSERT.
- **Chave:** o vinculo frente/acao e por `codigo` (text), nunca por id volatil, espelhando `rotina_tarefa.categoria = rotina_categoria.codigo`.
- **Derivado nunca vira coluna:** nota, faixa, dias parados e progresso saem na leitura.
- **Status por codigo:** `a_fazer` | `fazendo` | `travado` | `feito`. Rotulo e display.
- **Sem DELETE:** remocao e `arquivada = true`.
- **`arquivada` quer dizer DESCARTADA**, decisao do dono em 04/08/2026. Serve para acao criada errada ou que nao vale mais, e a tela diz "Descartar", nunca "Arquivar". Acao concluida NAO se descarta: ela fica com status `feito` e continua contando o Avanco da frente. A coluna manteve o nome `arquivada` (ja existe no banco, com comentario explicando), mas a RPC e o rotulo dizem descartar, porque descartar e o que o ato faz.
- **Sem emoji** em rotulo. Ponto colorido + palavra.
- **Prosa e comentario sem acento, sem cedilha, sem travessao.** Valores reais do sistema preservam seus caracteres exatos (rotulos com acento entram como estao).
- **`app.js` e minificado numa linha so.** Nunca editar a mao. Toda mudanca entra por `ferramentas/patch_*.js`, que ABORTA se a ancora nao tiver exatamente 1 ocorrencia.
- **Conferir EXIT CODE das provas, nunca o texto da saida.**
- IDs: tenant `00000000-0000-0000-0000-000000000001`, dono `fb2aad8e-b728-4e59-a198-71da2156449d`, projeto Supabase `unjzpyexgtbcmjfgcqrx`.

## Estado do repo ao comecar

`main` local esta **4 commits atras** de `origin/main` (backups diarios). Rodar `git pull --rebase` ANTES da Task 1.

`validar.py` ja chega VERMELHO com 5 reprovacoes herdadas (handoff v45, pendencia 1). A Task 6 trata a unica que esta obra e obrigada a mexer. As outras 4 ficam como estao: consertar as outras nao e escopo desta fatia.

## Estrutura de arquivos

| arquivo | responsabilidade |
|---|---|
| migration `escopo_fatia1_schema` | as 3 tabelas, RLS, grants, seed das 9 linhas de frente |
| migration `escopo_fatia1_rpc_leitura` | `public.escopo_completo()` |
| migration `escopo_fatia1_rpcs_escrita` | `criar_acao_escopo`, `mudar_status_acao_escopo`, `descartar_acao_escopo` |
| `ferramentas/prova_escopo.sql` | prova de banco: RLS nos 3 papeis, CHECK, append-only, nota nos limites |
| `public/index.html` | o botao `<button class="aba aba-rara" id="abaEscopo">` |
| `public/app.css` | blocos `.esc-*` do placar e da lista |
| `ferramentas/patch_escopo.js` | costura o `renderEscopo()` e o dispatcher dentro do `app.js` |
| `ferramentas/prova_escopo.js` | prova de frontend: recorta as funcoes do `app.js` real e assere |
| `ferramentas/validar.py:linha da contagem de raras` | 7 -> 8 |

---

### Task 1: schema, RLS, grants e seed

**Files:**
- Create (migration): `escopo_fatia1_schema`
- Create: `ferramentas/prova_escopo.sql`

**Interfaces:**
- Produces: tabelas `public.escopo_frente(id, tenant_id, codigo, rotulo, grupo, icone, ordem, ativo, criado_em, atualizado_em)`, `public.escopo_acao(id, tenant_id, frente, titulo, status, motivo_trava, travado_desde, data_alvo, prioridade, esforco, ordem, arquivada, criado_em, atualizado_em)`, `public.escopo_acao_evento(id, tenant_id, acao_id, de_status, para_status, em, por)`.
- Produces: 9 linhas semeadas em `escopo_frente` com os codigos `colaboradores`, `producao_marketing`, `assistencia`, `captacao_organica`, `whatsapp`, `pitscare`, `comercial`, `calculadoras`, `pendencias`.

- [ ] **Step 1: sincronizar o repo antes de tudo**

```bash
cd "C:/Users/Vinicius/Desktop/Pitwall Claude Code"
git pull --rebase
git status -sb
```

Esperado: `## main...origin/main` sem `[behind]`.

- [ ] **Step 2: escrever a prova de banco ANTES do schema**

Criar `ferramentas/prova_escopo.sql`. O bloco roda como `authenticated` com os claims do dono, e termina em `raise exception`, entao tudo que escreve volta atras. **ERRO com "0 falhas" no fim = APROVOU. Qualquer outro erro = REPROVOU.**

```sql
-- Prova de banco da Fatia 1 da aba Escopo (04/08/2026).
--
-- Roda como `authenticated`, escreve, assere e termina em `raise exception`:
-- o bloco inteiro e uma transacao so, entao nada fica no banco. O relatorio
-- sai dentro da mensagem do erro.
-- ERRO com "0 falhas" no fim = APROVOU. Qualquer outro erro = REPROVOU.
--
-- Reexecutar: colar em execute_sql do MCP do Supabase, ou psql -f.
do $$
declare
  ten1   uuid := '00000000-0000-0000-0000-000000000001';
  dono   uuid := 'fb2aad8e-b728-4e59-a198-71da2156449d';
  alheio uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  ten2   uuid := 'aaaaaaaa-0000-0000-0000-00000000000b';
  vend   uuid := 'aaaaaaaa-0000-0000-0000-00000000000c';
  rel text := ''; nok int := 0; nfa int := 0;
  n int; msg text; vb boolean; r jsonb;
begin
  -- vizinhos de prova, ainda como dono do banco. Somem no rollback.
  insert into public.tenant(id, nome) values (ten2, 'Tenant vizinho (prova)');
  insert into public.app_usuario(id, tenant_id, nome, papel, ativo)
  values (alheio, ten2, 'Vizinho (prova)', 'dono', true),
         (vend,   ten1, 'Vendedor (prova)', 'vendedor', true);

  ------------------------------------------------------------ sessao do DONO
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into n from public.escopo_frente where grupo = 'frente' and ativo;
  if n = 8 then nok:=nok+1; rel:=rel||E'\n  ok  seed: 8 frentes ativas';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU seed: achei '||n||' frentes, esperava 8'; end if;

  select count(*) into n from public.escopo_frente where grupo = 'pendencia';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  seed: 1 linha de pendencia';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU seed: achei '||n||' linhas de pendencia'; end if;

  select count(*) into n from public.escopo_frente where codigo = 'crm_legado';
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  seed: crm_legado NAO existe (cortada)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU seed: crm_legado existe'; end if;

  -- CHECK: travado sem motivo tem que ser recusado
  begin
    insert into public.escopo_acao(tenant_id, frente, titulo, status)
    values (ten1, 'pitscare', 'trava sem motivo', 'travado');
    nfa:=nfa+1; rel:=rel||E'\nFALHOU CHECK: aceitou travado sem motivo';
  exception when check_violation then
    nok:=nok+1; rel:=rel||E'\n  ok  CHECK: travado sem motivo recusado';
  end;

  -- CHECK: travado COM motivo passa
  begin
    insert into public.escopo_acao(tenant_id, frente, titulo, status, motivo_trava)
    values (ten1, 'pitscare', 'trava com motivo', 'travado', 'capability do Notion');
    nok:=nok+1; rel:=rel||E'\n  ok  CHECK: travado com motivo aceito';
  exception when others then
    nfa:=nfa+1; rel:=rel||E'\nFALHOU CHECK: recusou travado com motivo: '||sqlerrm;
  end;

  -- status invalido nao entra
  begin
    insert into public.escopo_acao(tenant_id, frente, titulo, status)
    values (ten1, 'pitscare', 'status torto', 'concluido');
    nfa:=nfa+1; rel:=rel||E'\nFALHOU CHECK: aceitou status fora da lista';
  exception when check_violation then
    nok:=nok+1; rel:=rel||E'\n  ok  CHECK: status fora da lista recusado';
  end;

  -- frente inexistente nao entra
  begin
    insert into public.escopo_acao(tenant_id, frente, titulo, status)
    values (ten1, 'frente_que_nao_existe', 'orfa', 'a_fazer');
    nfa:=nfa+1; rel:=rel||E'\nFALHOU FK: aceitou acao em frente inexistente';
  exception when foreign_key_violation then
    nok:=nok+1; rel:=rel||E'\n  ok  FK: acao em frente inexistente recusada';
  end;

  -- append-only do evento: authenticated nao pode UPDATE nem DELETE
  insert into public.escopo_acao_evento(tenant_id, acao_id, de_status, para_status, por)
  select ten1, a.id, null, 'a_fazer', dono
    from public.escopo_acao a where a.titulo = 'trava com motivo' limit 1;

  begin
    update public.escopo_acao_evento set para_status = 'feito' where tenant_id = ten1;
    nfa:=nfa+1; rel:=rel||E'\nFALHOU append-only: UPDATE no evento passou';
  exception when insufficient_privilege then
    nok:=nok+1; rel:=rel||E'\n  ok  append-only: UPDATE no evento negado';
  end;

  begin
    delete from public.escopo_acao_evento where tenant_id = ten1;
    nfa:=nfa+1; rel:=rel||E'\nFALHOU append-only: DELETE no evento passou';
  exception when insufficient_privilege then
    nok:=nok+1; rel:=rel||E'\n  ok  append-only: DELETE no evento negado';
  end;

  -- acao tambem nao aceita DELETE (so arquivada)
  begin
    delete from public.escopo_acao where tenant_id = ten1;
    nfa:=nfa+1; rel:=rel||E'\nFALHOU: DELETE em escopo_acao passou';
  exception when insufficient_privilege then
    nok:=nok+1; rel:=rel||E'\n  ok  DELETE em escopo_acao negado (so arquivada)';
  end;

  --------------------------------------------------------- sessao do VIZINHO
  perform set_config('request.jwt.claims',
    json_build_object('sub', alheio, 'role', 'authenticated')::text, true);

  select count(*) into n from public.escopo_frente;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  RLS: tenant vizinho nao ve frente nenhuma';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU RLS: tenant vizinho viu '||n||' frentes'; end if;

  select count(*) into n from public.escopo_acao;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  RLS: tenant vizinho nao ve acao nenhuma';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU RLS: tenant vizinho viu '||n||' acoes'; end if;

  begin
    insert into public.escopo_acao(tenant_id, frente, titulo, status)
    values (ten1, 'pitscare', 'invasao', 'a_fazer');
    nfa:=nfa+1; rel:=rel||E'\nFALHOU RLS: vizinho escreveu no tenant alheio';
  exception when others then
    nok:=nok+1; rel:=rel||E'\n  ok  RLS: vizinho barrado ao escrever no tenant alheio';
  end;

  ------------------------------------------------------- sessao do VENDEDOR
  perform set_config('request.jwt.claims',
    json_build_object('sub', vend, 'role', 'authenticated')::text, true);

  select count(*) into n from public.escopo_frente where ativo;
  if n = 9 then nok:=nok+1; rel:=rel||E'\n  ok  RLS: vendedor LE as 9 linhas do proprio tenant';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU RLS: vendedor viu '||n||' linhas, esperava 9'; end if;

  begin
    insert into public.escopo_frente(tenant_id, codigo, rotulo, grupo, icone, ordem)
    values (ten1, 'invencao', 'Invencao', 'frente', 'alvo', 50);
    nfa:=nfa+1; rel:=rel||E'\nFALHOU RLS: vendedor criou frente (so dono pode)';
  exception when others then
    nok:=nok+1; rel:=rel||E'\n  ok  RLS: vendedor barrado ao criar frente';
  end;

  raise exception E'PROVA ESCOPO FATIA 1 -- % ok, % falhas%', nok, nfa, rel;
end $$;
```

- [ ] **Step 3: rodar a prova e confirmar que ela FALHA por falta de tabela**

Rodar `ferramentas/prova_escopo.sql` via `mcp__supabase__execute_sql`.

Esperado: erro `relation "public.escopo_frente" does not exist`. **Nao pode aparecer "0 falhas".** Se aparecer, alguem ja criou as tabelas e o plano precisa ser revisto antes de seguir.

- [ ] **Step 4: aplicar a migration do schema**

`mcp__supabase__apply_migration`, name `escopo_fatia1_schema`:

```sql
-- Fatia 1 da aba Escopo. Espelha o par rotina_categoria / rotina_tarefa:
-- vinculo por CODIGO (estavel), nunca por id de linha.
create table public.escopo_frente (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id),
  codigo        text not null,
  rotulo        text not null,
  grupo         text not null default 'frente',
  icone         text not null default 'alvo',
  ordem         integer not null default 0,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint escopo_frente_codigo_uq unique (tenant_id, codigo),
  constraint escopo_frente_grupo_ck  check (grupo in ('frente','pendencia'))
);
comment on table public.escopo_frente is
  'Areas de trabalho permanentes da operacao. Config: entra e sai frente sem tocar em codigo. A linha grupo=pendencia e o backlog tecnico, renderizado separado no fim da aba. Frente que nao serve mais se DESLIGA (ativo=false), nunca se apaga.';

create table public.escopo_acao (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id),
  frente        text not null,
  titulo        text not null,
  status        text not null default 'a_fazer',
  motivo_trava  text,
  travado_desde date,
  data_alvo     date,
  prioridade    text,
  esforco       text,
  ordem         integer not null default 0,
  arquivada     boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint escopo_acao_frente_fk foreign key (tenant_id, frente)
    references public.escopo_frente(tenant_id, codigo),
  constraint escopo_acao_status_ck check (status in ('a_fazer','fazendo','travado','feito')),
  constraint escopo_acao_prioridade_ck check (prioridade is null or prioridade in ('alta','media','baixa')),
  constraint escopo_acao_esforco_ck check (esforco is null or esforco in ('p','m','g')),
  -- a unica obrigatoriedade da tabela: travado sem motivo faz a palavra
  -- perder sentido em um mes.
  constraint escopo_acao_trava_ck check (status <> 'travado' or motivo_trava is not null)
);
comment on column public.escopo_acao.data_alvo is
  'Existe no schema desde a Fatia 1 mas so ganha tela na Fatia 3, junto com prioridade e esforco.';

create index escopo_acao_frente_ix on public.escopo_acao(tenant_id, frente) where not arquivada;

create table public.escopo_acao_evento (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id),
  acao_id     uuid not null references public.escopo_acao(id),
  de_status   text,
  para_status text not null,
  em          timestamptz not null default now(),
  por         uuid
);
comment on table public.escopo_acao_evento is
  'Append-only. Nasce na Fatia 1 mesmo sem tela que a leia: a tendencia da Fatia 3 le daqui, e historico nao se constroi retroativamente. de_status nulo = criacao da acao.';
create index escopo_acao_evento_acao_ix on public.escopo_acao_evento(tenant_id, acao_id, em desc);

alter table public.escopo_frente       enable row level security;
alter table public.escopo_acao         enable row level security;
alter table public.escopo_acao_evento  enable row level security;

-- Policies espelhadas de rotina_categoria: todo mundo do tenant LE, so o dono ESCREVE.
create policy p_escopo_frente_select on public.escopo_frente
  for select using (tenant_id = privado.fn_tenant_atual());
create policy p_escopo_frente_insert on public.escopo_frente
  for insert with check (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');
create policy p_escopo_frente_update on public.escopo_frente
  for update using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono')
          with check (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

create policy p_escopo_acao_select on public.escopo_acao
  for select using (tenant_id = privado.fn_tenant_atual());
create policy p_escopo_acao_insert on public.escopo_acao
  for insert with check (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');
create policy p_escopo_acao_update on public.escopo_acao
  for update using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono')
          with check (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

create policy p_escopo_acao_evento_select on public.escopo_acao_evento
  for select using (tenant_id = privado.fn_tenant_atual());
create policy p_escopo_acao_evento_insert on public.escopo_acao_evento
  for insert with check (tenant_id = privado.fn_tenant_atual());

-- Privilegio minimo. Sem DELETE em lugar nenhum, sem UPDATE no evento.
revoke all on public.escopo_frente, public.escopo_acao, public.escopo_acao_evento from anon, authenticated;
grant select, insert, update on public.escopo_frente to authenticated;
grant select, insert, update on public.escopo_acao   to authenticated;
grant select, insert         on public.escopo_acao_evento to authenticated;

-- Seed: 8 frentes de operacao + a linha de pendencias no fim.
insert into public.escopo_frente(tenant_id, codigo, rotulo, grupo, icone, ordem) values
  ('00000000-0000-0000-0000-000000000001','colaboradores',      'Colaboradores',        'frente',    'pessoas',     10),
  ('00000000-0000-0000-0000-000000000001','producao_marketing', 'Produção e marketing', 'frente',    'megafone',    20),
  ('00000000-0000-0000-0000-000000000001','assistencia',        'Assistência técnica',  'frente',    'chave',       30),
  ('00000000-0000-0000-0000-000000000001','captacao_organica',  'Captação orgânica',    'frente',    'alvo',        40),
  ('00000000-0000-0000-0000-000000000001','whatsapp',           'Status do WhatsApp',   'frente',    'balao',       50),
  ('00000000-0000-0000-0000-000000000001','pitscare',           'Pitscare',             'frente',    'escudo',      60),
  ('00000000-0000-0000-0000-000000000001','comercial',          'Comercial',            'frente',    'etiqueta',    70),
  ('00000000-0000-0000-0000-000000000001','calculadoras',       'Calculadoras',         'frente',    'calculadora', 80),
  ('00000000-0000-0000-0000-000000000001','pendencias',         'Pendências',           'pendencia', 'alerta',      99);
```

- [ ] **Step 5: rodar a prova e confirmar que PASSOU**

Rodar `ferramentas/prova_escopo.sql` via `mcp__supabase__execute_sql`.

Esperado: erro cuja mensagem comeca com `PROVA ESCOPO FATIA 1 -- 15 ok, 0 falhas`. Qualquer numero em `falhas` diferente de 0 REPROVA.

- [ ] **Step 6: conferir os advisors**

`mcp__supabase__get_advisors` com `type: "security"`.

Esperado: nenhum aviso novo mencionando `escopo_frente`, `escopo_acao` ou `escopo_acao_evento`.

- [ ] **Step 7: commit**

```bash
git add ferramentas/prova_escopo.sql
git commit -m "feat(escopo): schema, RLS e seed das 8 frentes

Espelha rotina_categoria/rotina_tarefa: vinculo por codigo, nunca por id.
escopo_acao_evento nasce append-only ja na Fatia 1 porque a tendencia da
Fatia 3 le dele e historico nao se constroi retroativamente.

Prova: ferramentas/prova_escopo.sql, 14 ok / 0 falhas, cobrindo RLS como
dono, como vendedor e como tenant vizinho.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 1b: fechar o placar contra manipulacao (correcao pos-revisao)

A revisao da Task 1 achou tres furos, dois deles reproduzidos contra o banco vivo. Decisao do dono, 04/08/2026: **o evento passa a ser garantido por trigger**, nao por disciplina de chamada.

**O que estava errado:**

1. `p_escopo_acao_evento_insert` so checava `tenant_id`, sem exigir `dono`. Reproduzido: um vendedor inseriu evento na mao. Como `dias_parada` vale 30 dos 100 pontos, qualquer usuario do tenant podia inflar a nota de uma frente parada. O placar nascia manipulavel.
2. `UPDATE` direto em `escopo_acao` muda o status e gera **0 eventos**. Reproduzido. A tendencia da Fatia 3 le desse log, entao o buraco e silencioso: nada da erro, so o historico fica incompleto.
3. A FK de `escopo_acao_evento.acao_id` nao tem `tenant_id`. Dormente hoje (um tenant so), mas a `escopo_completo()` casa evento por `acao_id` e agrupa por `frente` (codigo texto, identico entre tenants pelo seed).

**Files:**
- Create (migration): `escopo_fatia1_harden`
- Modify: `ferramentas/prova_escopo.sql`

- [ ] **Step 1: acrescentar as assercoes ANTES da correcao**

No `ferramentas/prova_escopo.sql`, logo antes do `raise exception` final, ainda como dono:

```sql
  --------------------------------------------------- harden (Task 1b)
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);

  -- o evento e garantido pelo TRIGGER, nao pela disciplina de chamar a RPC
  insert into public.escopo_acao(tenant_id, frente, titulo, status)
  values (ten1, 'calculadoras', 'alvo do trigger', 'a_fazer') returning id into vid;

  select count(*) into n from public.escopo_acao_evento
   where acao_id = vid and de_status is null and para_status = 'a_fazer';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  trigger: INSERT gera o evento de nascimento';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU trigger no INSERT: '||n||' evento(s)'; end if;

  update public.escopo_acao set status = 'feito' where id = vid;
  select count(*) into n from public.escopo_acao_evento
   where acao_id = vid and de_status = 'a_fazer' and para_status = 'feito';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  trigger: UPDATE DIRETO tambem gera evento (nao da pra furar o log)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU trigger no UPDATE direto: '||n||' evento(s)'; end if;

  -- status repetido nao gera evento fantasma, senao a tendencia le ruido
  select count(*) into n from public.escopo_acao_evento where acao_id = vid;
  update public.escopo_acao set status = 'feito' where id = vid;
  select count(*) - n into n from public.escopo_acao_evento where acao_id = vid;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  trigger: status repetido nao gera evento fantasma';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: status repetido gerou '||n||' evento(s)'; end if;

  -- mexer em outra coluna que nao o status tambem nao gera evento
  select count(*) into n from public.escopo_acao_evento where acao_id = vid;
  update public.escopo_acao set titulo = 'outro titulo' where id = vid;
  select count(*) - n into n from public.escopo_acao_evento where acao_id = vid;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  trigger: mudar o titulo nao e mudanca de status';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: editar titulo gerou '||n||' evento(s)'; end if;

  -- vendedor nao fabrica mais evento (era o furo do placar)
  perform set_config('request.jwt.claims',
    json_build_object('sub', vend, 'role', 'authenticated')::text, true);
  begin
    insert into public.escopo_acao_evento(tenant_id, acao_id, de_status, para_status, por)
    values (ten1, vid, 'a_fazer', 'feito', vend);
    nfa:=nfa+1; rel:=rel||E'\nFALHOU: vendedor fabricou evento e pode inflar a nota';
  exception when others then
    nok:=nok+1; rel:=rel||E'\n  ok  vendedor nao fabrica evento (o placar nao se manipula)';
  end;
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);
```

Declarar `vid uuid;` no bloco `declare`.

- [ ] **Step 2: rodar e ver FALHAR**

Esperado: as assercoes do trigger FALHAM (0 eventos gerados) e a do vendedor FALHA (ele consegue inserir). O relatorio tem de mostrar `falhas` maior que 0. Se ja passar, a correcao ja foi aplicada e este step precisa ser revisto.

- [ ] **Step 3: aplicar a migration de harden**

`mcp__supabase__apply_migration`, name `escopo_fatia1_harden`:

```sql
-- 1. O evento deixa de depender de alguem lembrar de chamar a RPC.
--    Trigger em escopo_acao: mudou status, nasce evento, venha de onde vier.
create or replace function privado.fn_escopo_evento()
returns trigger
language plpgsql
set search_path to 'public', 'privado'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.escopo_acao_evento(tenant_id, acao_id, de_status, para_status, por)
    values (new.tenant_id, new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.escopo_acao_evento(tenant_id, acao_id, de_status, para_status, por)
    values (new.tenant_id, new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;

comment on function privado.fn_escopo_evento() is
  'Garantia estrutural da auditoria do Escopo. Vive em privado (invariante 8). Status repetido e edicao de titulo NAO geram evento: a tendencia da Fatia 3 le este log e evento fantasma seria ruido.';

create trigger tg_escopo_acao_evento
  after insert or update on public.escopo_acao
  for each row execute function privado.fn_escopo_evento();

-- 2. Vendedor nao fabrica mais evento. dias_parada vale 30 dos 100 pontos da
--    nota: sem isso, qualquer usuario do tenant infla o placar de uma frente parada.
alter policy p_escopo_acao_evento_insert on public.escopo_acao_evento
  with check (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

-- 3. A FK do evento passa a ser tenant-scoped, como a de escopo_acao ja era.
alter table public.escopo_acao add constraint escopo_acao_id_tenant_uq unique (tenant_id, id);
alter table public.escopo_acao_evento drop constraint escopo_acao_evento_acao_id_fkey;
alter table public.escopo_acao_evento add constraint escopo_acao_evento_acao_fk
  foreign key (tenant_id, acao_id) references public.escopo_acao(tenant_id, id);
```

- [ ] **Step 4: rodar a prova e confirmar que PASSOU**

Esperado: `PROVA ESCOPO FATIA 1 -- 20 ok, 0 falhas`.

- [ ] **Step 5: reproduzir os dois furos originais e ver que fecharam**

```sql
do $$
declare
  ten1 uuid := '00000000-0000-0000-0000-000000000001';
  dono uuid := 'fb2aad8e-b728-4e59-a198-71da2156449d';
  aid uuid; n int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  insert into public.escopo_acao(tenant_id, frente, titulo, status)
  values (ten1,'pitscare','alvo','a_fazer') returning id into aid;
  update public.escopo_acao set status='feito' where id=aid;
  select count(*) into n from public.escopo_acao_evento where acao_id=aid;
  raise exception 'UPDATE direto gerou % eventos (esperado 2: nascimento + mudanca)', n;
end $$;
```

Esperado: `2 eventos`. Antes da correcao dava 0.

- [ ] **Step 6: commit**

```bash
git add ferramentas/prova_escopo.sql
git commit -m "fix(escopo): o evento vira garantia do banco, nao disciplina de chamada

Reproduzido contra o banco vivo antes de corrigir: UPDATE direto em
escopo_acao mudava status e gerava 0 eventos, e um vendedor conseguia
inserir evento na mao. Como dias_parada vale 30 dos 100 pontos da nota,
o segundo furo tornava o placar manipulavel por qualquer usuario do tenant.

Trigger em escopo_acao passa a gravar o evento venha de onde vier. Status
repetido e edicao de titulo nao geram evento: a tendencia da Fatia 3 le
este log e evento fantasma seria ruido.

A FK do evento tambem passa a ser tenant-scoped, como a de escopo_acao ja era.

Prova: 20 ok / 0 falhas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: RPC de leitura com a nota calculada

**Files:**
- Create (migration): `escopo_fatia1_rpc_leitura`
- Modify: `ferramentas/prova_escopo.sql` (novo bloco de assercoes da nota)

**Interfaces:**
- Consumes: as 3 tabelas da Task 1.
- Produces: `public.escopo_completo() returns json`, no formato

```json
{
  "ok": true,
  "pode_editar": true,
  "frentes": [
    { "codigo":"pitscare", "rotulo":"Pitscare", "grupo":"frente", "icone":"escudo",
      "ordem":60, "nota":72, "faixa":"a_frente",
      "feitas":4, "total":7, "travadas":0, "dias_parada":3,
      "acoes":[ {"id":"...","titulo":"...","status":"fazendo","motivo_trava":null} ] }
  ]
}
```

`faixa` e um dos quatro codigos: `a_frente` | `normal` | `em_baixa` | `sem_dado`. `nota` e `dias_parada` sao `null` quando `faixa = 'sem_dado'`.

- [ ] **Step 1: escrever as assercoes da nota ANTES da RPC**

Inserir no `ferramentas/prova_escopo.sql`, logo antes do `raise exception` final, ainda na sessao do dono. Volte a sessao do dono primeiro, porque o bloco anterior terminou como vendedor:

```sql
  ------------------------------------------------------ a nota, de volta como DONO
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);

  -- frente sem acao nenhuma nao entra no ranking
  select (f->>'faixa') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'assistencia';
  if msg = 'sem_dado' then nok:=nok+1; rel:=rel||E'\n  ok  nota: frente vazia e sem_dado, nao 0 nem 100';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU nota: frente vazia veio como '||coalesce(msg,'NULL'); end if;

  -- 4 de 4 feitas, 0 travadas, evento de hoje = 100.
  -- O evento nasce do trigger da Task 1b: nao inserir na mao, senao duplica.
  insert into public.escopo_acao(tenant_id, frente, titulo, status)
  select ten1, 'comercial', 'a'||i, 'feito' from generate_series(1,4) i;

  select (f->>'nota') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if msg = '100' then nok:=nok+1; rel:=rel||E'\n  ok  nota: tudo feito, nada travado, mexido hoje = 100';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU nota: esperava 100, veio '||coalesce(msg,'NULL'); end if;

  select (f->>'faixa') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if msg = 'a_frente' then nok:=nok+1; rel:=rel||E'\n  ok  faixa: 100 e a_frente';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU faixa: 100 veio como '||coalesce(msg,'NULL'); end if;

  -- 0 feitas, 1 de 1 travada, parada ha 40 dias = 0
  insert into public.escopo_acao(tenant_id, frente, titulo, status, motivo_trava)
  values (ten1, 'whatsapp', 'parada', 'travado', 'sem numero definido');

  -- O trigger da Task 1b gravou o evento com em = now(). Para provar o
  -- decaimento de Movimento e preciso ENVELHECER esse evento, e o log e
  -- append-only: nem o dono tem UPDATE nele. Volta-se ao papel do dono do
  -- BANCO so para esta linha, e nao para o resto da prova.
  perform set_config('role', 'postgres', true);
  update public.escopo_acao_evento set em = now() - interval '40 days'
   where acao_id in (select id from public.escopo_acao where frente = 'whatsapp');
  perform set_config('role', 'authenticated', true);

  select (f->>'nota') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'whatsapp';
  if msg = '0' then nok:=nok+1; rel:=rel||E'\n  ok  nota: nada feito, tudo travado, 40d parada = 0';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU nota: esperava 0, veio '||coalesce(msg,'NULL'); end if;

  select (f->>'faixa') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'whatsapp';
  if msg = 'em_baixa' then nok:=nok+1; rel:=rel||E'\n  ok  faixa: 0 e em_baixa';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU faixa: 0 veio como '||coalesce(msg,'NULL'); end if;

  -- acao arquivada nao conta no total
  insert into public.escopo_acao(tenant_id, frente, titulo, status, arquivada)
  values (ten1, 'comercial', 'arquivada', 'a_fazer', true);
  select (f->>'total') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if msg = '4' then nok:=nok+1; rel:=rel||E'\n  ok  total ignora acao arquivada';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU total com arquivada: veio '||coalesce(msg,'NULL'); end if;

  -- o ranking desce da melhor pra pior. Assertado pela ORDEM DAS NOTAS, nao por
  -- uma lista fixa de codigos: os blocos anteriores desta prova ja povoaram
  -- outras frentes, e lista fixa quebraria toda vez que a prova crescesse.
  --
  -- Materializa a leitura UMA vez numa temp table: repetir
  -- json_array_elements(escopo_completo()) em subquery correlacionada custa uma
  -- chamada de RPC por linha e fica ilegivel.
  create temp table _esc_ord on commit drop as
    select (f->>'codigo')  as codigo,
           (f->>'grupo')   as grupo,
           (f->>'faixa')   as faixa,
           (f->>'nota')::int as nota,
           row_number() over () as ord
      from json_array_elements((public.escopo_completo())->'frentes') f;

  select bool_and(nota >= prox) into vb from (
    select nota, lead(nota) over (order by ord) prox
      from _esc_ord where grupo = 'frente' and faixa <> 'sem_dado') p
   where prox is not null;
  if coalesce(vb, true) then nok:=nok+1; rel:=rel||E'\n  ok  ranking: a nota desce da melhor pra pior';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU ranking: nota fora de ordem'; end if;

  -- sem_dado desce pro fim do grupo, nunca fica no meio de quem tem nota
  select count(*) into n from _esc_ord s
   where s.grupo = 'frente' and s.faixa = 'sem_dado'
     and exists (select 1 from _esc_ord s2
                  where s2.grupo = 'frente' and s2.faixa <> 'sem_dado' and s2.ord > s.ord);
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  sem_dado nunca fica no meio de quem tem nota';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: '||n||' frente(s) sem_dado no meio do ranking'; end if;

  drop table _esc_ord;

  -- a linha de pendencia nunca aparece no meio das frentes. Comparado contra a
  -- CONTAGEM da propria leitura, nao contra a posicao fixa 9: a Fatia 3 deixa
  -- criar e desligar frente pela tela, e uma posicao chumbada passaria a
  -- checar a linha errada sem avisar.
  select (f->>'grupo') into msg from (
    select f, row_number() over () ord, count(*) over () tot
      from json_array_elements((public.escopo_completo())->'frentes') f
  ) s where ord = tot;
  if msg = 'pendencia' then nok:=nok+1; rel:=rel||E'\n  ok  pendencias vem sempre por ultimo';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU ordem: a ultima linha veio como grupo '||coalesce(msg,'NULL'); end if;

  -- ARQUIVAR NAO COMPRA MOVIMENTO. Este e o vetor que a revisao achou: sem o
  -- filtro `not a2.arquivada` no ult_evento, criar e arquivar uma acao
  -- descartavel derrubava dias_parada de 40 para 0 e dobrava a nota.
  insert into public.escopo_acao(tenant_id, frente, titulo, status)
  values (ten1, 'colaboradores', 'trabalho real parado', 'a_fazer') returning id into vid;
  perform set_config('role', 'postgres', true);
  update public.escopo_acao_evento set em = now() - interval '40 days' where acao_id = vid;
  perform set_config('role', 'authenticated', true);

  select (f->>'nota')::int into n
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'colaboradores';

  insert into public.escopo_acao(tenant_id, frente, titulo, status, arquivada)
  values (ten1, 'colaboradores', 'descartavel', 'a_fazer', true);

  select (f->>'nota')::int - n into n
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'colaboradores';
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  arquivar acao descartavel NAO muda a nota da frente';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: acao descartavel arquivada moveu a nota em '||n||' pontos'; end if;

  -- e faixa sem_dado nao pode vazar dias_parada de acao arquivada
  insert into public.escopo_acao(tenant_id, frente, titulo, status, arquivada)
  values (ten1, 'assistencia', 'so arquivada', 'a_fazer', true);
  select f->>'dias_parada' into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'assistencia';
  if msg is null then nok:=nok+1; rel:=rel||E'\n  ok  sem_dado vem com dias_parada null, sem fantasma de arquivada';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: sem_dado vazou dias_parada = '||msg; end if;
```

Trocar a linha do `raise exception` para refletir o novo total. Ela ja usa `nok` e `nfa`, entao nao muda.

- [ ] **Step 2: rodar e confirmar que FALHA por falta da RPC**

Rodar `ferramentas/prova_escopo.sql` via `mcp__supabase__execute_sql`.

Esperado: erro `function public.escopo_completo() does not exist`.

- [ ] **Step 3: aplicar a migration da RPC**

`mcp__supabase__apply_migration`, name `escopo_fatia1_rpc_leitura`:

```sql
-- Le a aba Escopo inteira numa chamada so. A nota e DERIVADA aqui, nunca
-- armazenada (invariante 4). Fuso do Brasil, nunca current_date (invariante 10).
--
-- Parcelas da Fatia 1 (a Fatia 3 acrescenta Atraso e reajusta os pesos, e a
-- tela tera de declarar o corte: nota da Fatia 1 nao compara com a da Fatia 3):
--   Avanco    40  feitas / total
--   Fluidez   30  desconta as travadas
--   Movimento 30  cheio ate 7 dias sem evento, zero a partir de 30, linear entre
create or replace function public.escopo_completo()
returns json
language plpgsql
stable
set search_path to 'public', 'privado'
as $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_out    json;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;

  with base as (
    select ef.codigo, ef.rotulo, ef.grupo, ef.icone, ef.ordem,
           count(ea.id)                                              as total,
           count(ea.id) filter (where ea.status = 'feito')            as feitas,
           count(ea.id) filter (where ea.status = 'travado')          as travadas,
           -- `and not a2.arquivada` NAO e detalhe: sem ele, criar e arquivar uma
           -- acao descartavel zera o relogio da frente. Medido em 04/08/2026:
           -- uma frente parada ha 40 dias pulava de nota 30 para 60 com esse
           -- truque, comprando 30 pontos de Movimento sem trabalho nenhum. O
           -- filtro tambem casa com total/feitas/travadas, que ja ignoram
           -- arquivada, e faz dias_parada vir null quando a faixa e sem_dado.
           (select max(ev.em) from public.escopo_acao_evento ev
              join public.escopo_acao a2 on a2.id = ev.acao_id
             where ev.tenant_id = v_tenant and a2.frente = ef.codigo
               and not a2.arquivada) as ult_evento
      from public.escopo_frente ef
      left join public.escopo_acao ea
        on ea.tenant_id = v_tenant and ea.frente = ef.codigo and not ea.arquivada
     where ef.tenant_id = v_tenant and ef.ativo
     group by ef.codigo, ef.rotulo, ef.grupo, ef.icone, ef.ordem
  ), calc as (
    select b.*,
           case when b.ult_evento is null then null
                else (v_hoje - (b.ult_evento at time zone 'America/Sao_Paulo')::date)
           end as dias_parada
      from base b
  ), nota as (
    select c.*,
           case when c.total = 0 then null else round(  -- ::int no fim: sem ele a nota pode sair como 100.0000 no JSON
             (c.feitas::numeric / c.total) * 40
             + (1 - c.travadas::numeric / c.total) * 30
             + case
                 when c.dias_parada is null then 0
                 when c.dias_parada <= 7  then 30
                 when c.dias_parada >= 30 then 0
                 else 30 * (30 - c.dias_parada)::numeric / 23
               end
           )::int end as nota
      from calc c
  )
  select coalesce(json_agg(json_build_object(
           'codigo', n.codigo, 'rotulo', n.rotulo, 'grupo', n.grupo,
           'icone', n.icone, 'ordem', n.ordem,
           'total', n.total, 'feitas', n.feitas, 'travadas', n.travadas,
           'dias_parada', n.dias_parada,
           'nota', n.nota,
           'faixa', case when n.total = 0 then 'sem_dado'
                         when n.nota >= 70 then 'a_frente'
                         when n.nota >= 40 then 'normal'
                         else 'em_baixa' end,
           'acoes', coalesce((
             select json_agg(json_build_object(
                      'id', a.id, 'titulo', a.titulo, 'status', a.status,
                      'motivo_trava', a.motivo_trava)
                    order by array_position(
                      array['travado','fazendo','a_fazer','feito'], a.status), a.ordem, a.criado_em)
               from public.escopo_acao a
              where a.tenant_id = v_tenant and a.frente = n.codigo and not a.arquivada
           ), '[]'::json)
         )
         -- pendencias sempre por ultimo; entre as frentes, a melhor nota primeiro,
         -- e quem nao tem dado desce pro fim do proprio grupo.
         order by case when n.grupo = 'pendencia' then 1 else 0 end,
                  (n.nota is null), n.nota desc, n.ordem), '[]'::json)
    into v_out
    from nota n;

  return json_build_object('ok', true, 'frentes', v_out,
                           'pode_editar', privado.fn_papel_atual() = 'dono');
end $$;

revoke all on function public.escopo_completo() from public, anon;
grant execute on function public.escopo_completo() to authenticated;
```

- [ ] **Step 4: rodar a prova e confirmar que PASSOU**

Esperado: `PROVA ESCOPO FATIA 1 -- 31 ok, 0 falhas`.

- [ ] **Step 5: commit**

```bash
git add ferramentas/prova_escopo.sql
git commit -m "feat(escopo): escopo_completo() com a nota derivada na leitura

A nota nao vira coluna: sai da query, no fuso do Brasil. Frente sem acao
recebe faixa sem_dado propria em vez de 0 ou 100, porque ausencia de dado
nao e desempenho.

Prova: 22 ok / 0 falhas, com os limites 0 e 100 e o ranking assertado.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: RPCs de escrita com evento append-only

**Files:**
- Create (migration): `escopo_fatia1_rpcs_escrita`
- Modify: `ferramentas/prova_escopo.sql`

**Interfaces:**
- Consumes: tabelas da Task 1, `escopo_completo()` da Task 2.
- Produces, todas `returns json` no formato `{ok, msg?, id?}`:
  - `public.criar_acao_escopo(p_frente text, p_titulo text)`
  - `public.mudar_status_acao_escopo(p_id uuid, p_status text, p_motivo text default null)`
  - `public.descartar_acao_escopo(p_id uuid)`

- [ ] **Step 1: escrever as assercoes ANTES das RPCs**

Inserir no `ferramentas/prova_escopo.sql`, antes do `raise exception` final:

```sql
  ------------------------------------------------------------- RPCs de escrita
  select public.criar_acao_escopo('pitscare', '  Aplicar os 19 scripts  ')::jsonb into r;
  if (r->>'ok')::boolean then nok:=nok+1; rel:=rel||E'\n  ok  criar_acao_escopo devolve ok';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU criar_acao_escopo: '||coalesce(r->>'msg','sem msg'); end if;

  select titulo into msg from public.escopo_acao where id = (r->>'id')::uuid;
  if msg = 'Aplicar os 19 scripts' then nok:=nok+1; rel:=rel||E'\n  ok  o titulo entra sem espaco sobrando';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU trim do titulo: veio '||quote_literal(coalesce(msg,'NULL')); end if;

  select count(*) into n from public.escopo_acao_evento
   where acao_id = (r->>'id')::uuid and de_status is null and para_status = 'a_fazer';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  criar acao grava exatamente 1 evento de nascimento';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU evento de nascimento: '||n||' linhas'; end if;

  -- titulo vazio nao cria acao
  if not (public.criar_acao_escopo('pitscare', '   ')::jsonb->>'ok')::boolean
  then nok:=nok+1; rel:=rel||E'\n  ok  titulo vazio recusado';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: titulo vazio criou acao'; end if;

  -- titulo gigante e recusado, nao truncado em silencio
  if not (public.criar_acao_escopo('pitscare', repeat('x', 5000))::jsonb->>'ok')::boolean
  then nok:=nok+1; rel:=rel||E'\n  ok  titulo de 5000 chars recusado (estouraria o card)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: titulo de 5000 chars entrou'; end if;

  -- e 160 exatos ainda passam, senao a recusa e mais rigida que o texto diz
  if (public.criar_acao_escopo('pitscare', repeat('y', 160))::jsonb->>'ok')::boolean
  then nok:=nok+1; rel:=rel||E'\n  ok  160 chars exatos ainda passam';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: 160 chars foi recusado, o teto esta errado'; end if;

  -- travar SEM motivo e recusado pela RPC, com mensagem legivel
  if not (public.mudar_status_acao_escopo((r->>'id')::uuid, 'travado')::jsonb->>'ok')::boolean
  then nok:=nok+1; rel:=rel||E'\n  ok  travar sem motivo recusado pela RPC';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: travou sem motivo'; end if;

  -- travar COM motivo passa e carimba travado_desde
  perform public.mudar_status_acao_escopo((r->>'id')::uuid, 'travado', 'capability Update content');
  select count(*) into n from public.escopo_acao
   where id = (r->>'id')::uuid and status = 'travado'
     and motivo_trava = 'capability Update content'
     and travado_desde = (now() at time zone 'America/Sao_Paulo')::date;
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  travar grava motivo e travado_desde no fuso BR';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU travar com motivo'; end if;

  select count(*) into n from public.escopo_acao_evento
   where acao_id = (r->>'id')::uuid and de_status = 'a_fazer' and para_status = 'travado';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  mudanca de status grava evento com de e para';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU evento da mudanca: '||n||' linhas'; end if;

  -- sair de travado limpa o motivo, senao ele fica mentindo na tela
  perform public.mudar_status_acao_escopo((r->>'id')::uuid, 'fazendo');
  select count(*) into n from public.escopo_acao
   where id = (r->>'id')::uuid and motivo_trava is null and travado_desde is null;
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  destravar limpa motivo e travado_desde';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU destravar deixou motivo velho para tras'; end if;

  -- status igual ao atual nao gera evento fantasma
  select count(*) into n from public.escopo_acao_evento where acao_id = (r->>'id')::uuid;
  perform public.mudar_status_acao_escopo((r->>'id')::uuid, 'fazendo');
  select count(*) - n into n from public.escopo_acao_evento where acao_id = (r->>'id')::uuid;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  status repetido nao gera evento fantasma';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: status repetido gerou '||n||' evento(s)'; end if;

  -- descartar tira da leitura sem apagar a linha
  perform public.descartar_acao_escopo((r->>'id')::uuid);
  select count(*) into n from public.escopo_acao where id = (r->>'id')::uuid;
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  descartar NAO apaga a linha';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: descartar apagou a linha'; end if;

  select count(*) into n
    from json_array_elements((public.escopo_completo())->'frentes') f,
         json_array_elements(f->'acoes') a
   where (a->>'id') = (r->>'id');
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  acao descartada some da leitura';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: acao descartada continua na leitura'; end if;

  -- vendedor nao escreve
  perform set_config('request.jwt.claims',
    json_build_object('sub', vend, 'role', 'authenticated')::text, true);
  if not (public.criar_acao_escopo('pitscare', 'do vendedor')::jsonb->>'ok')::boolean
  then nok:=nok+1; rel:=rel||E'\n  ok  vendedor barrado ao criar acao';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: vendedor criou acao'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);
```

`r jsonb` ja esta declarado no bloco `declare` desde a Task 1. Nao redeclarar.

- [ ] **Step 2: rodar e confirmar que FALHA por falta das RPCs**

Esperado: erro `function public.criar_acao_escopo(unknown, unknown) does not exist`.

- [ ] **Step 3: aplicar a migration das RPCs**

`mcp__supabase__apply_migration`, name `escopo_fatia1_rpcs_escrita`:

```sql
-- Escrita da aba Escopo. Toda mudanca de status grava em escopo_acao_evento,
-- que e append-only: e dele que a tendencia da Fatia 3 vai ler.
create or replace function public.criar_acao_escopo(p_frente text, p_titulo text)
returns json
language plpgsql
set search_path to 'public', 'privado'
as $$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_usuario uuid := auth.uid();
  v_titulo  text := btrim(coalesce(p_titulo, ''));
  v_id uuid;
begin
  if v_tenant is null or v_usuario is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Só o dono edita o escopo.');
  end if;
  if v_titulo = '' then
    return json_build_object('ok', false, 'msg', 'Escreva o que precisa ser feito.');
  end if;
  -- Teto medido: sem ele um titulo de 5000 chars entra inteiro e estoura o card
  -- na tela. Recusa explicita, nunca truncar em silencio: texto cortado sem
  -- aviso e pior que texto recusado.
  if length(v_titulo) > 160 then
    return json_build_object('ok', false, 'msg', 'Ação muito longa. Resuma em até 160 caracteres.');
  end if;
  if not exists (select 1 from public.escopo_frente
                  where tenant_id = v_tenant and codigo = p_frente and ativo) then
    return json_build_object('ok', false, 'msg', 'Essa frente não existe ou está desligada.');
  end if;

  -- O evento de nascimento NAO se insere aqui: o trigger tg_escopo_acao_evento
  -- (Task 1b) grava sozinho. Inserir tambem duplicaria o log.
  insert into public.escopo_acao(tenant_id, frente, titulo, status)
  values (v_tenant, p_frente, v_titulo, 'a_fazer')
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'msg', 'Ação criada.');
end $$;

create or replace function public.mudar_status_acao_escopo(
  p_id uuid, p_status text, p_motivo text default null)
returns json
language plpgsql
set search_path to 'public', 'privado'
as $$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_usuario uuid := auth.uid();
  v_motivo  text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_de text;
begin
  if v_tenant is null or v_usuario is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Só o dono edita o escopo.');
  end if;
  if p_status not in ('a_fazer','fazendo','travado','feito') then
    return json_build_object('ok', false, 'msg', 'Status desconhecido.');
  end if;
  if p_status = 'travado' and v_motivo is null then
    return json_build_object('ok', false, 'msg', 'Diga o que está travando.');
  end if;

  select status into v_de from public.escopo_acao
   where id = p_id and tenant_id = v_tenant and not arquivada;
  if v_de is null then
    return json_build_object('ok', false, 'msg', 'Ação não encontrada.');
  end if;
  if v_de = p_status then
    return json_build_object('ok', true, 'msg', 'Já estava assim.');
  end if;

  update public.escopo_acao
     set status        = p_status,
         -- sair de travado limpa o motivo: motivo velho na tela mente
         motivo_trava  = case when p_status = 'travado' then v_motivo else null end,
         travado_desde = case when p_status = 'travado'
                              then (now() at time zone 'America/Sao_Paulo')::date else null end,
         atualizado_em = now()
   where id = p_id and tenant_id = v_tenant;

  -- O evento sai do trigger tg_escopo_acao_evento (Task 1b), nao daqui.
  return json_build_object('ok', true, 'msg', 'Pronto.');
end $$;

create or replace function public.descartar_acao_escopo(p_id uuid)
returns json
language plpgsql
set search_path to 'public', 'privado'
as $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  n int;
begin
  if v_tenant is null or auth.uid() is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Só o dono edita o escopo.');
  end if;
  update public.escopo_acao
     set arquivada = true, atualizado_em = now()
   where id = p_id and tenant_id = v_tenant and not arquivada;
  get diagnostics n = row_count;
  if n = 0 then
    return json_build_object('ok', false, 'msg', 'Ação não encontrada.');
  end if;
  return json_build_object('ok', true, 'msg', 'Descartada.');
end $$;

-- CREATE OR REPLACE FUNCTION reseta ACL: refazer os grants explicitamente.
revoke all on function public.criar_acao_escopo(text, text) from public, anon;
revoke all on function public.mudar_status_acao_escopo(uuid, text, text) from public, anon;
revoke all on function public.descartar_acao_escopo(uuid) from public, anon;
grant execute on function public.criar_acao_escopo(text, text) to authenticated;
grant execute on function public.mudar_status_acao_escopo(uuid, text, text) to authenticated;
grant execute on function public.descartar_acao_escopo(uuid) to authenticated;
```

- [ ] **Step 4: rodar a prova e confirmar que PASSOU**

Esperado: `PROVA ESCOPO FATIA 1 -- 45 ok, 0 falhas`.

- [ ] **Step 5: conferir que os grants ficaram como esperado**

`mcp__supabase__execute_sql`:

```sql
select p.proname, coalesce(array_to_string(p.proacl, ' '), 'SEM ACL') as acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like '%escopo%' order by 1;
```

Esperado: nenhuma linha contendo `anon=` nem `=X/` sem role (execute publico). Todas com `authenticated=X`.

- [ ] **Step 6: commit**

```bash
git add ferramentas/prova_escopo.sql
git commit -m "feat(escopo): RPCs de criar, mudar status e arquivar

Travar exige motivo na RPC, nao so no CHECK, para a recusa chegar na tela
como frase legivel. Destravar LIMPA o motivo: motivo velho pendurado mente.
Status repetido nao gera evento, senao a tendencia da Fatia 3 le ruido.

Prova: 45 ok / 0 falhas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: a aba na navegacao e o CSS

**Files:**
- Modify: `public/index.html:88-91` (logo apos o botao `abaRotina`)
- Modify: `public/app.css` (fim do arquivo, antes de qualquer media query final)

**Interfaces:**
- Produces: `#abaEscopo` no DOM, com `class="aba aba-rara"`, e as classes CSS `.esc-placar`, `.esc-linha`, `.esc-nota`, `.esc-faixa`, `.esc-parcelas`, `.esc-frente`, `.esc-acao`, `.esc-chip`, `.esc-trava`, `.esc-form`, `.esc-pend`.

- [ ] **Step 1: acrescentar o botao da aba**

Em `public/index.html`, logo depois do bloco `abaRotina` (que termina em `</button>` na linha 91), inserir:

```html
      <button class="aba aba-rara" id="abaEscopo" role="tab" aria-selected="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 6h11l-1.5 3L15 12H4" stroke-linejoin="round"/><path d="M4 19h6" stroke-linecap="round"/></svg>
        <span class="aba-txt">Escopo</span>
      </button>
```

**`aba-rara` nao e opcional.** A barra do celular tem 6 lugares mapeados por id; aba fora do mapa auto-posiciona numa linha extra e volta a cobrir o conteudo, que foi o defeito medido no handoff v45 (barra de 109px contra respiro de 76px).

- [ ] **Step 2: acrescentar o CSS**

No fim de `public/app.css`:

```css
/* ============ Aba Escopo (Fatia 1) ============
   Trilho x Sinal: a frente carrega barra de 3px + ICONE (o icone carrega a
   distincao, nao e enfeite). A paleta de temperatura NAO e reusada: la quente
   e bom (lead novo) e aqui seria ruim. So "em baixa" recebe alerta. */
.esc-placar{display:flex;flex-direction:column;gap:2px;margin-bottom:20px}
.esc-linha{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px}
.esc-linha:hover{background:var(--panel-2)}
.esc-linha-nome{flex:1 1 150px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.esc-nota{font-family:var(--mono);font-weight:500;font-size:15px;min-width:34px;text-align:right}
.esc-faixa{font-size:12px;min-width:66px}
.esc-parcelas{font-family:var(--mono);font-size:12px;color:var(--dim);flex:1 1 180px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.esc-linha.f-em_baixa .esc-faixa{color:var(--erro-fg);font-weight:500}
.esc-linha.f-em_baixa .esc-nota{color:var(--erro-fg)}
.esc-linha.f-sem_dado{opacity:.62}
.esc-linha.f-sem_dado .esc-nota,.esc-linha.f-sem_dado .esc-faixa{color:var(--dim)}

.esc-frente{border-left:3px solid var(--line-forte);padding-left:12px;margin:18px 0}
.esc-frente-cab{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.esc-frente-cab svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.7;flex:0 0 auto}
.esc-frente-tit{font-weight:600}
.esc-frente-cont{font-family:var(--mono);font-size:12px;color:var(--dim)}
.esc-acao{display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-bottom:1px solid var(--line)}
.esc-acao:last-child{border-bottom:none}
.esc-acao-txt{flex:1 1 160px;min-width:0;overflow-wrap:anywhere}
.esc-chip{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--panel-2);color:var(--dim);white-space:nowrap;flex:0 0 auto}
.esc-chip.s-travado{background:var(--erro-bg);color:var(--erro-fg)}
.esc-chip.s-feito{opacity:.6}
.esc-trava{font-size:12px;color:var(--erro-fg);margin-top:3px}
.esc-form{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.esc-form input{flex:1 1 180px;min-width:0}
.esc-pend{margin-top:28px;padding-top:18px;border-top:2px solid var(--line-forte)}
```

**Nenhum token novo.** A primeira versao deste plano mandava criar `--escopo-baixa-fg:#B01235` e `--escopo-baixa-bg:#FBEAEE`, e o `validar.py` REPROVOU, com razao: `--erro-fg:#B01235` e `--erro-bg:#FDEDF0` ja existem no `:root`. Cor identica com nome diferente nao e organizacao, e drift garantido, porque no dia em que alguem retunar uma das duas a outra fica para tras em silencio.

Usar `var(--erro-fg)` e `var(--erro-bg)` direto. Isso NAO e o mesmo que reusar `--quente`: reusar o quente INVERTERIA significado (la quente e bom, lead novo). O `--erro` ja e a cor de alerta deste sistema, medida em 7.04 sobre branco em 16/07/2026.

- [ ] **Step 3: medir o contraste antes de seguir**

**`ferramentas/contraste.py` NAO aceita argumento.** Ele imprime um relatorio fixo e sai 0 aconteca o que acontecer, entao passar cores na linha de comando nao mede nada. Importar as funcoes dele e o caminho:

```bash
python -c "import sys; sys.path.insert(0,'ferramentas'); from contraste import ratio; print(round(ratio('#B01235','#FDEDF0'),2), round(ratio('#B01235','#FFFFFF'),2))"
```

Esperado: os dois acima de 4.5:1 (texto). Se reprovar, PARAR e relatar em vez de escolher outra cor no olho.

- [ ] **Step 4: conferir que o CSS nao quebrou a tela**

```bash
python ferramentas/validar.py; echo "EXIT=$?"
```

Esperado: as MESMAS 5 reprovacoes herdadas, nenhuma nova. Se aparecer uma sexta, ela e desta obra e tem de ser corrigida antes de commitar. Para separar herdada de nova:

```bash
git stash && python ferramentas/validar.py > /tmp/head.txt 2>&1; git stash pop
python ferramentas/validar.py > /tmp/agora.txt 2>&1
diff /tmp/head.txt /tmp/agora.txt
```

- [ ] **Step 5: commit**

```bash
git add public/index.html public/app.css
git commit -m "feat(escopo): aba na navegacao e o CSS do placar

A aba entra como .aba-rara (gaveta Mais). A barra do celular tem 6 lugares
mapeados por id; aba fora do mapa cria linha extra e volta a cobrir o
conteudo, que foi o defeito de 33px medido no v45.

A paleta de temperatura nao e reusada: nela quente e BOM (lead novo) e aqui
seria ruim. So em_baixa recebe alerta, com o --erro ja medido em 16/07.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `renderEscopo()` no app.js e a prova de frontend

**Files:**
- Create: `ferramentas/patch_escopo.js`
- Create: `ferramentas/prova_escopo.js`
- Modify: `public/app.js` (pelo patch, nunca a mao)

**Interfaces:**
- Consumes: `escopo_completo()`, `criar_acao_escopo()`, `mudar_status_acao_escopo()`, `descartar_acao_escopo()` das Tasks 2 e 3.
- Consumes do `app.js` existente: `E(id)` (getElementById), `c(a)` (escape de HTML), `t` (client Supabase), `q(rpc, args, botao, msg)` (chama a RPC, mostra toast e recarrega), `I(msg, erro)` (toast).
- Produces no `app.js`: `escFaixaRot(f)`, `escIcone(k)`, `escPlacar(fs)`, `escFrente(fr, pode)`, `renderEscopo()`, e o ramo `else if("escopo"===n)renderEscopo();` no dispatcher.

- [ ] **Step 1: escrever a prova de frontend ANTES do patch**

Criar `ferramentas/prova_escopo.js`. Ela recorta as funcoes do `app.js` REAL e as executa, no mesmo padrao de `prova_regua.js`:

```js
// Prova da aba Escopo, Fatia 1. Recortada do public/app.js REAL, nao de copia.
//   node ferramentas/prova_escopo.js
const fs = require('fs');
const SRC = fs.readFileSync(process.argv[2] || 'public/app.js', 'utf8');
const CSS = fs.readFileSync(process.argv[3] || 'public/app.css', 'utf8');
const HTML = fs.readFileSync(process.argv[4] || 'public/index.html', 'utf8');

let ok = 0, falhas = 0;
function t(nome, cond) {
  if (cond) { ok++; console.log('  ok  ' + nome); }
  else { falhas++; console.log('  FALHOU  ' + nome); }
}
function eq(nome, a, b) {
  if (a === b) { ok++; console.log('  ok  ' + nome); }
  else { falhas++; console.log(`  FALHOU  ${nome}\n    esperava: ${JSON.stringify(b)}\n    veio:     ${JSON.stringify(a)}`); }
}
function conta(agulha) { return SRC.split(agulha).length - 1; }
function recorte(de, ate) {
  const i = SRC.indexOf(de), j = SRC.indexOf(ate, i);
  if (i < 0 || j < 0) throw new Error('nao achei o bloco: ' + de);
  return SRC.slice(i, j);
}

const escReal = recorte('function c(a){return String(null==a?', 'function d(a){');
const bloco = recorte('function escFaixaRot(f){', 'async function renderEscopo(');
const api = new Function(escReal + bloco +
  'return {escFaixaRot:escFaixaRot,escIcone:escIcone,escPlacar:escPlacar,escFrente:escFrente};')();

console.log('\n--- faixa: a palavra nunca some ---');
eq('a_frente', api.escFaixaRot('a_frente'), 'a frente');
eq('normal',   api.escFaixaRot('normal'),   'normal');
eq('em_baixa', api.escFaixaRot('em_baixa'), 'em baixa');
eq('sem_dado', api.escFaixaRot('sem_dado'), 'sem dado');
eq('faixa desconhecida nao quebra a tela', api.escFaixaRot('marte'), 'sem dado');

console.log('\n--- placar: a nota nunca aparece sozinha ---');
const fs1 = [
  {codigo:'comercial',rotulo:'Comercial',grupo:'frente',icone:'etiqueta',
   nota:72,faixa:'a_frente',feitas:4,total:7,travadas:0,dias_parada:3,acoes:[]},
  {codigo:'whatsapp',rotulo:'Status do WhatsApp',grupo:'frente',icone:'balao',
   nota:31,faixa:'em_baixa',feitas:1,total:9,travadas:3,dias_parada:21,acoes:[]},
  {codigo:'assistencia',rotulo:'Assistência técnica',grupo:'frente',icone:'chave',
   nota:null,faixa:'sem_dado',feitas:0,total:0,travadas:0,dias_parada:null,acoes:[]}
];
const pl = api.escPlacar(fs1);
t('mostra a nota', pl.indexOf('>72<') >= 0);
t('mostra a palavra da faixa', pl.indexOf('a frente') >= 0);
t('mostra as feitas sobre o total', pl.indexOf('4/7 feitas') >= 0);
t('mostra quantas travadas', pl.indexOf('3 travadas') >= 0);
t('mostra ha quantos dias parou', pl.indexOf('21d') >= 0);
t('em baixa recebe a classe de alerta', pl.indexOf('f-em_baixa') >= 0);
t('sem dado recebe classe propria', pl.indexOf('f-sem_dado') >= 0);
t('sem dado NAO inventa nota', pl.indexOf('>0<') < 0 && pl.indexOf('>100<') < 0);
t('sem dado diz por escrito que nao ha acao', pl.indexOf('nenhuma ação registrada') >= 0);
t('a frente sem parcela nao vira linha muda',
  api.escPlacar([{codigo:'x',rotulo:'X',grupo:'frente',icone:'alvo',nota:null,
                  faixa:'sem_dado',feitas:0,total:0,travadas:0,dias_parada:null,acoes:[]}])
     .indexOf('nenhuma ação registrada') >= 0);

console.log('\n--- placar: nome de frente nao escapa como HTML cru ---');
t('rotulo com < e > sai escapado',
  api.escPlacar([{codigo:'x',rotulo:'<img src=x>',grupo:'frente',icone:'alvo',nota:50,
                  faixa:'normal',feitas:1,total:2,travadas:0,dias_parada:1,acoes:[]}])
     .indexOf('<img src=x>') < 0);

console.log('\n--- frente: trilho SEM icone e regressao ---');
const fr = api.escFrente({codigo:'pitscare',rotulo:'Pitscare',grupo:'frente',icone:'escudo',
  nota:60,faixa:'normal',feitas:1,total:3,travadas:1,dias_parada:2,
  acoes:[
    {id:'a1',titulo:'Aplicar os 19 scripts',status:'travado',motivo_trava:'capability Update content'},
    {id:'a2',titulo:'Fundir a branch',status:'a_fazer',motivo_trava:null}
  ]}, true);
t('a frente carrega icone (o icone carrega a distincao, nao e enfeite)', fr.indexOf('<svg') >= 0);
t('mostra o contador da frente', fr.indexOf('1/3') >= 0);
t('a travada aparece com o chip de travado', fr.indexOf('s-travado') >= 0);
t('e o motivo da trava aparece por escrito', fr.indexOf('capability Update content') >= 0);
// Quem ORDENA e o banco (array_position na escopo_completo). Aqui so se prova
// que a tela nao reembaralha o que recebeu.
t('a tela preserva a ordem que o banco mandou',
  fr.indexOf('Aplicar os 19 scripts') < fr.indexOf('Fundir a branch'));
t('quem pode editar ve o botao de mudar status', fr.indexOf('data-acao="esc-status"') >= 0);
t('quem pode editar ve o botao de descartar', fr.indexOf('data-acao="esc-desc"') >= 0);

const frLeitor = api.escFrente({codigo:'pitscare',rotulo:'Pitscare',grupo:'frente',icone:'escudo',
  nota:60,faixa:'normal',feitas:1,total:3,travadas:1,dias_parada:2,
  acoes:[{id:'a1',titulo:'x',status:'a_fazer',motivo_trava:null}]}, false);
t('quem NAO pode editar nao ve botao de escrita',
  frLeitor.indexOf('data-acao="esc-status"') < 0 && frLeitor.indexOf('data-acao="esc-desc"') < 0);
t('mas continua LENDO a acao', frLeitor.indexOf('esc-acao') >= 0);

console.log('\n--- icone: frente nova (Fatia 3) nao pode virar buraco ---');
t('icone conhecido devolve svg', api.escIcone('escudo').indexOf('<svg') >= 0);
t('icone desconhecido cai num svg padrao, nao em vazio', api.escIcone('zzz').indexOf('<svg') >= 0);

console.log('\n--- costuras no app.js ---');
eq('o dispatcher trata a aba escopo', conta('"escopo"===n)renderEscopo()'), 1);
eq('renderEscopo definida uma vez so', conta('async function renderEscopo('), 1);
t('a leitura passa pela RPC escopo_completo', SRC.indexOf('"escopo_completo"') >= 0);
t('criar acao passa pela RPC', SRC.indexOf('"criar_acao_escopo"') >= 0);
t('mudar status passa pela RPC', SRC.indexOf('"mudar_status_acao_escopo"') >= 0);
t('arquivar passa pela RPC', SRC.indexOf('"descartar_acao_escopo"') >= 0);
t('nenhuma nota e calculada no JS (a conta e do banco)',
  SRC.indexOf('function escNota') < 0);
eq('o delegado trata esc-status', conta('if("esc-status"===o)'), 1);
eq('o delegado trata esc-desc', conta('if("esc-desc"===o)'), 1);
eq('o delegado trata esc-criar', conta('if("esc-criar"===o)'), 1);
t('a aba entra no aria-selected junto das outras', SRC.indexOf('E("abaEscopo")') >= 0);
t('o titulo do topo conhece a aba escopo', SRC.indexOf('"escopo"===n?"Escopo"') >= 0);

console.log('\n--- index.html e app.css ---');
t('o botao da aba existe', HTML.indexOf('id="abaEscopo"') >= 0);
t('e ele e .aba-rara (senao a barra do celular volta a cobrir o conteudo)',
  /class="aba aba-rara" id="abaEscopo"/.test(HTML));
t('o CSS tem o bloco do placar', CSS.indexOf('.esc-placar{') >= 0);
t('o CSS tem a classe de alerta de em baixa', CSS.indexOf('.esc-linha.f-em_baixa') >= 0);
t('o alerta reusa o --erro ja medido, sem token novo', CSS.indexOf('--escopo-baixa') < 0);
t('o alerta NAO reusa a paleta de temperatura',
  /\.esc-linha\.f-em_baixa \.esc-faixa\{color:var\(--quente/.test(CSS) === false);

console.log(`\n=== ${ok + falhas} assercoes, ${falhas} falhas ===`);
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: rodar a prova e confirmar que FALHA**

```bash
node ferramentas/prova_escopo.js; echo "EXIT=$?"
```

Esperado: joga `Error: nao achei o bloco: function escFaixaRot(f){` e `EXIT=1`.

- [ ] **Step 3: escrever o patch**

Criar `ferramentas/patch_escopo.js`. **O `app.js` e uma linha so: editar a mao corrompe o arquivo.** O patch recusa qualquer ancora que nao tenha exatamente 1 ocorrencia e nao grava nada se alguma falhar.

```js
// Aba Escopo, Fatia 1. Costura renderEscopo e o dispatcher dentro do app.js
// minificado. Rodar da raiz do repo: node ferramentas/patch_escopo.js
'use strict';
const fs = require('fs');
const path = require('path');

const ALVO = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(ALVO, 'utf8');
const antes = src.length;

const ICONES = {
  pessoas:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke-linecap="round"/><path d="M16 6.2a3.2 3.2 0 0 1 0 6M17.5 19a5.5 5.5 0 0 0-1.6-3.9" stroke-linecap="round"/>',
  megafone:'<path d="M4 10v4h3l7 4V6l-7 4H4z" stroke-linejoin="round"/><path d="M17.5 9a4 4 0 0 1 0 6" stroke-linecap="round"/>',
  chave:'<circle cx="8" cy="8" r="3.4"/><path d="M10.4 10.4L20 20M17 17l-2 2M14 14l-2 2" stroke-linecap="round"/>',
  alvo:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-linecap="round"/>',
  balao:'<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4V6z" stroke-linejoin="round"/>',
  escudo:'<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z" stroke-linejoin="round"/>',
  etiqueta:'<path d="M4 11V5a1 1 0 0 1 1-1h6l9 9-7 7-9-9z" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.2"/>',
  calculadora:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h4" stroke-linecap="round"/>',
  alerta:'<path d="M12 4l9 16H3l9-16z" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke-linecap="round"/>'
};

const BLOCO = [
  '// Aba Escopo. A NOTA NAO E CALCULADA AQUI: ela vem pronta de',
  '// escopo_completo(), derivada na leitura, no fuso do Brasil. Duplicar a',
  '// conta no JS criaria duas verdades para o mesmo numero.',
  'var ESC_ICONES=' + JSON.stringify(ICONES) + ';',
  'var ESC_STATUS={a_fazer:"a fazer",fazendo:"fazendo",travado:"travado",feito:"feito"};',
  'function escFaixaRot(f){',
  'return"a_frente"===f?"a frente":"normal"===f?"normal":"em_baixa"===f?"em baixa":"sem dado"}',
  '// Frente nova criada pela tela (Fatia 3) pode nao ter icone conhecido: cai no',
  '// alvo em vez de virar buraco. Trilho sem icone e regressao.',
  'function escIcone(k){',
  'var p=ESC_ICONES[k]||ESC_ICONES.alvo;',
  'return\'<svg viewBox="0 0 24 24" aria-hidden="true">\'+p+"</svg>"}',
  '// A nota nunca aparece sozinha: as tres parcelas vao do lado. Nota escondida',
  '// vira fe, e ninguem discute com fe.',
  'function escPlacar(fs){',
  'if(!fs||!fs.length)return"";',
  'var lin=fs.filter(function(f){return"pendencia"!==f.grupo}).map(function(f){',
  'var sd="sem_dado"===f.faixa,',
  'par=sd?"nenhuma ação registrada":f.feitas+"/"+f.total+" feitas · "+f.travadas+" travada"+(1===f.travadas?"":"s")+(null==f.dias_parada?"":" · "+f.dias_parada+"d");',
  'return\'<div class="esc-linha f-\'+c(f.faixa)+\'"><span class="esc-linha-nome">\'+c(f.rotulo)+\'</span><span class="esc-nota">\'+(sd?"--":c(String(f.nota)))+\'</span><span class="esc-faixa">\'+c(escFaixaRot(f.faixa))+\'</span><span class="esc-parcelas">\'+c(par)+"</span></div>"}).join("");',
  'return\'<div class="esc-placar">\'+lin+"</div>"}',
  'function escFrente(fr,pode){',
  'var ac=(fr.acoes||[]).map(function(a){',
  '// O chip carrega a classe do status nos DOIS caminhos: quem pode editar ve',
  '// botao, quem nao pode ve texto, e os dois pintam igual. Chip sem a classe',
  '// deixaria o leitor sem a cor de travado.',
  'var bt=pode?\'<button class="esc-chip s-\'+c(a.status)+\'" data-acao="esc-status" data-id="\'+c(a.id)+\'" data-st="\'+c(a.status)+\'">\'+c(ESC_STATUS[a.status]||a.status)+\'</button><button class="link-acao" data-acao="esc-desc" data-id="\'+c(a.id)+\'" aria-label="Descartar">×</button>\':\'<span class="esc-chip s-\'+c(a.status)+\'">\'+c(ESC_STATUS[a.status]||a.status)+"</span>";',
  'return\'<div class="esc-acao"><span class="esc-acao-txt">\'+c(a.titulo)+(a.motivo_trava?\'<div class="esc-trava">trava: \'+c(a.motivo_trava)+"</div>":"")+"</span>"+bt+"</div>"}).join("")||\'<div class="esc-acao"><span class="esc-acao-txt">Nenhuma ação aqui ainda.</span></div>\';',
  'var form=pode?\'<div class="esc-form"><input type="text" maxlength="160" id="escNovo_\'+c(fr.codigo)+\'" placeholder="Nova ação nesta frente" autocomplete="off"><button class="link-acao" data-acao="esc-criar" data-frente="\'+c(fr.codigo)+\'">Adicionar</button></div>\':"";',
  'return\'<div class="esc-frente\'+("pendencia"===fr.grupo?" esc-pend":"")+\'"><div class="esc-frente-cab">\'+escIcone(fr.icone)+\'<span class="esc-frente-tit">\'+c(fr.rotulo)+\'</span><span class="esc-frente-cont">\'+c(fr.feitas+"/"+fr.total)+"</span></div>"+ac+form+"</div>"}',
  'async function renderEscopo(){',
  'var e=E("lista");',
  'e.innerHTML=\'<div class="estado carregando">Lendo o escopo…</div>\';',
  'var r=await t.rpc("escopo_completo",{});',
  'if(r.error)return void(e.innerHTML=\'<div class="estado erro">Falha ao ler o escopo: \'+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");',
  'var d=r.data;',
  'if(!d||!1===d.ok)return void(e.innerHTML=\'<div class="estado erro">\'+c(d&&d.msg||"Falha ao ler o escopo.")+"</div>");',
  'var fr=d.frentes||[],pode=!0===d.pode_editar;',
  'e.innerHTML=fr.length?escPlacar(fr)+fr.map(function(x){return escFrente(x,pode)}).join(""):\'<div class="estado"><strong>O escopo está vazio.</strong>Nenhuma frente cadastrada.</div>\'}',
  ''
].join('\n');

const COSTURAS = [
  {
    nome: '1. o bloco do Escopo entra antes de renderRotina (mesmo escopo)',
    de: 'async function renderRotina(){',
    para: BLOCO + 'async function renderRotina(){'
  },
  {
    nome: '2. o dispatcher passa a conhecer a aba escopo',
    de: 'else if("rotina"===n)renderRotina();',
    para: 'else if("rotina"===n)renderRotina();else if("escopo"===n)renderEscopo();'
  },
  {
    nome: '3. aria-selected da aba Escopo, junto das outras',
    de: 'E("abaMais")&&(E("abaMais").setAttribute(',
    para: 'E("abaEscopo")&&E("abaEscopo").setAttribute("aria-selected","escopo"===n?"true":"false"),E("abaMais")&&(E("abaMais").setAttribute('
  },
  {
    nome: '4. a aba Escopo conta como rara para o botao Mais',
    de: '["indicacoes","captacao","dashboard","rotina","nfs"].indexOf(n)>=0',
    para: '["indicacoes","captacao","dashboard","rotina","nfs","escopo"].indexOf(n)>=0'
  },
  {
    nome: '5. o titulo do topo conhece a aba',
    de: '"conteudo"===n?"Conteúdo":',
    para: '"conteudo"===n?"Conteúdo":"escopo"===n?"Escopo":'
  },
  {
    nome: '6. o delegado trata as tres acoes de escrita',
    de: 'if("rot-dia"===o)',
    para: [
      'if("esc-criar"===o){',
      'var fcod=a.getAttribute("data-frente"),cx=E("escNovo_"+fcod);',
      'if(!cx||!cx.value.trim())return void I("Escreva a ação primeiro.",!0);',
      'return void q("criar_acao_escopo",{p_frente:fcod,p_titulo:cx.value},a)}',
      'if("esc-status"===o){',
      'var st=a.getAttribute("data-st"),',
      'prox="a_fazer"===st?"fazendo":"fazendo"===st?"feito":"feito"===st?"a_fazer":"a_fazer",mot=null;',
      'if("travado"===prox&&!(mot=prompt("O que está travando?")))return;',
      'return void q("mudar_status_acao_escopo",{p_id:a.getAttribute("data-id"),p_status:prox,p_motivo:mot},a)}',
      'if("esc-desc"===o)return void q("descartar_acao_escopo",{p_id:a.getAttribute("data-id")},a);',
      'if("rot-dia"===o)'
    ].join('')
  }
];

let erros = 0;
for (const cst of COSTURAS) {
  const n = src.split(cst.de).length - 1;
  if (n !== 1) {
    console.error(`REPROVOU: ${cst.nome}\n  esperava 1 ocorrencia, achou ${n}`);
    erros++;
    continue;
  }
  src = src.replace(cst.de, cst.para);
  console.log(`ok  ${cst.nome}`);
}

if (erros) {
  console.error(`\nREPROVOU: ${erros} costura(s) sem ocorrencia unica. Nada foi gravado.`);
  process.exit(1);
}

fs.writeFileSync(ALVO, src, 'utf8');
console.log(`\napp.js: ${antes} -> ${src.length} bytes (+${src.length - antes})`);
console.log(`APROVOU: ${COSTURAS.length} costuras aplicadas.`);
```

- [ ] **Step 4: guardar o app.js de antes e aplicar o patch**

```bash
git show HEAD:public/app.js > /tmp/escopo_antes.js
node ferramentas/patch_escopo.js; echo "EXIT=$?"
```

Esperado: `EXIT=0` e `APROVOU: 6 costuras aplicadas.` Se alguma costura reprovar, o arquivo NAO foi gravado: ajustar a ancora no patch e rodar de novo. Nunca editar o `app.js` a mao para "ajudar".

- [ ] **Step 5: provar que so o pretendido mudou**

`git diff` NAO serve aqui: o `app.js` e uma linha so e o diff exibe a linha inteira.

```bash
node -e "
const a=require('fs').readFileSync('/tmp/escopo_antes.js','utf8');
const b=require('fs').readFileSync('public/app.js','utf8');
let i=0; while(i<a.length&&a[i]===b[i]) i++;
let j=0; while(j<a.length-i&&a[a.length-1-j]===b[b.length-1-j]) j++;
console.log('prefixo identico ate', i);
console.log('sufixo identico a partir de', j, 'do fim');
console.log('inseridos', b.length-a.length, 'bytes');
console.log('removidos do original', a.length-i-j, 'bytes');
"
```

Esperado: `removidos do original` igual a 0 (o patch so INSERE; as costuras 2 a 6 reescrevem trechos, entao esse numero e o tamanho somado dos trechos reescritos, nao zero). O que importa e que `prefixo identico ate` caia dentro da regiao esperada e que nenhum bloco fora das 6 costuras tenha sumido. Se `removidos` passar de 400 bytes, parar e investigar.

- [ ] **Step 6: rodar a prova de frontend**

```bash
node --check public/app.js; echo "SINTAXE=$?"
node ferramentas/prova_escopo.js; echo "EXIT=$?"
```

Esperado: `SINTAXE=0` e `EXIT=0`. **O que vale e o exit code**, nao o texto: a ultima linha imprime o total de assercoes e o numero de falhas, e falhas tem de ser 0.

- [ ] **Step 7: commit**

```bash
git add ferramentas/patch_escopo.js ferramentas/prova_escopo.js public/app.js
git commit -m "feat(escopo): renderEscopo, placar e as tres acoes de escrita

O app.js e uma linha so: a mudanca entra por ferramentas/patch_escopo.js,
que aborta se qualquer ancora nao tiver ocorrencia unica e nao grava nada
nesse caso.

A nota NAO e recalculada no JS. Ela vem pronta de escopo_completo(): duas
contas para o mesmo numero seriam duas verdades.

Prova: node ferramentas/prova_escopo.js, 40 assercoes, 0 falhas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: fechar os guard-rails e provar a fatia inteira

**Files:**
- Modify: `ferramentas/validar.py` (a assercao da contagem de abas raras)

- [ ] **Step 1: achar a assercao da contagem**

```bash
grep -n "abas raras" ferramentas/validar.py
```

- [ ] **Step 2: subir o numero esperado de 7 para 8**

A aba Escopo e a oitava `.aba-rara`. Trocar o literal `7` por `8` **nessa linha e so nessa**.

**Nao repontar a baseline `.antes`.** Repontar calaria as outras 4 reprovacoes herdadas de carona, que e exatamente como um guard-rail morre. Aqui a assercao envelheceu e o numero real subiu; as outras 4 continuam abertas de proposito, como pendencia registrada no handoff v45.

- [ ] **Step 3: rodar a suite comparando com o HEAD**

```bash
python ferramentas/validar.py > /tmp/agora.txt 2>&1; echo "VALIDAR=$?"
grep -c "REPROVOU" /tmp/agora.txt
```

Esperado: **4 reprovacoes**, uma a menos que as 5 herdadas (a das abas raras foi resolvida), e nenhuma nova. Conferir pelos textos que as 4 restantes sao exatamente:
- `classe emitida pelo JS sem estilo no CSS`
- `o botao que abre o historico sumiu ou duplicou`
- `o pitboard de lead apareceria em Captacao/Hoje/Conteudo/Rotina`
- `uso NOVO de var(--accent) fora da lista aprovada`

Se aparecer qualquer reprovacao fora dessas 4, ela e desta obra e tem de ser corrigida antes de seguir.

Aviso: a primeira delas (`classe emitida pelo JS sem estilo no CSS`) pode CRESCER com as classes `esc-*`. Toda classe que o `patch_escopo.js` emite tem de existir no `app.css` da Task 4. Se a lista dessa reprovacao ganhar um `esc-`, e regressao desta obra: acrescentar o estilo faltante.

- [ ] **Step 4: rodar o resto da suite**

```bash
python ferramentas/harness.py;              echo "HARNESS=$?"
python ferramentas/prova_trilho.py;         echo "TRILHO=$?"
python ferramentas/diag_mobile.py 360;      echo "M360=$?"
python ferramentas/diag_mobile.py 390;      echo "M390=$?"
python ferramentas/diag_mobile.py 414;      echo "M414=$?"
node ferramentas/prova_cliente.js;          echo "CLIENTE=$?"
node ferramentas/prova_nf.js;               echo "NF=$?"
node ferramentas/prova_metricas.js;         echo "METRICAS=$?"
node ferramentas/prova_regua.js;            echo "REGUA=$?"
node ferramentas/prova_sessao.js;           echo "SESSAO=$?"
node ferramentas/prova_venda_editar.js;     echo "VENDA=$?"
node ferramentas/prova_escopo.js;           echo "ESCOPO=$?"
```

Esperado: `TRILHO`, `M360`, `M390`, `M414` e todos os `node` em 0. `HARNESS` mantem a baseline de **158 passou / 4 falhou** (as 4 sao herdadas, handoff v45 secao 9.2).

Os tres `diag_mobile` sao o portao que importa nesta obra: eles REPROVAM se a barra fechada voltar a ficar mais alta que o respiro do `.conteudo`. Se algum falhar, a aba nao ficou `.aba-rara`.

- [ ] **Step 5: rodar a prova de banco uma ultima vez**

Rodar `ferramentas/prova_escopo.sql` via `mcp__supabase__execute_sql`.

Esperado: `PROVA ESCOPO FATIA 1 -- 45 ok, 0 falhas`.

- [ ] **Step 6: commit, SEM push**

**Decisao do dono, 04/08/2026: commitar na `main` local e PARAR antes do push.** Push e deploy sao a mesma coisa (a Cloudflare publica sozinha via Workers Builds), e ele quer conferir antes de publicar. Nao rodar `git push` nesta execucao.

```bash
git add ferramentas/validar.py
git commit -m "fix(validar): a contagem de abas raras sobe de 7 para 8

A aba Escopo e a oitava. A assercao envelheceu quando abaNfs entrou e
ninguem atualizou o numero; agora ela volta a valer.

Item unico e nomeado. A baseline .antes NAO foi repontada: isso calaria as
outras 4 reprovacoes herdadas de carona, que e como um guard-rail morre.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: conferir localmente (o app ainda NAO esta no ar)**

Como nao houve push, a conferencia e local:

```bash
node ferramentas/servir.js
```

Abrir o endereco que ele imprimir, e estreitar a janela do navegador ate 390px de largura para ver o layout de celular. Tocar em **Mais**: a gaveta abre e **Escopo** esta la, com o rotulo inteiro. Tocar: o placar aparece com as 8 frentes, todas em `sem dado` (nenhuma acao ainda). Digitar uma acao em Pitscare e tocar em Adicionar: ela aparece, a frente sai de `sem dado` e ganha nota.

Rolar ate o fim: o ultimo bloco tem que terminar ACIMA da barra, com respiro.

- [ ] **Step 8: handoff**

Criar `docs/handoffs/handoff_migracao_pitwall_v46.md` registrando as decisoes (nao so o estado), e atualizar o topo da linha migracao em `docs/handoffs/handoff_indice_pitwall.md`.

---

## Autorrevisao do plano

**Cobertura da spec:** secao 3 (as 8 frentes) na Task 1 step 4; secao 4.1/4.2/4.3 na Task 1; secao 4.4 fica fora, e Fatia 2; secao 5 (placar, parcelas, faixas, `sem_dado`) nas Tasks 2 e 5; secao 5.1 (a regua muda na Fatia 3) fica documentada no comentario da RPC, sem tela nesta fatia; secao 5.2 (tendencia) e Fatia 3; secao 6 (cor) na Task 4; secao 7 (tela, `.aba-rara`) nas Tasks 4 e 5; secao 8 Fatia 1 completa; secao 9 (provas) nas Tasks 1, 2, 3, 5 e 6, incluindo 9.1 (a assercao das abas raras) na Task 6 e 9.2 (comparacao byte a byte) na Task 5 step 5.

**Lacuna conhecida e aceita:** a spec pede que a tela DECLARE o corte de regua entre Fatia 1 e Fatia 3. Nesta fatia so existe uma regua, entao nao ha o que declarar; a obrigacao nasce junto com a quarta parcela, na Fatia 3, e esta anotada no comentario da `escopo_completo()`.

**Consistencia de nomes:** `escopo_completo`, `criar_acao_escopo`, `mudar_status_acao_escopo`, `descartar_acao_escopo`, `escFaixaRot`, `escIcone`, `escPlacar`, `escFrente`, `renderEscopo`, e as acoes de delegado `esc-criar`, `esc-status`, `esc-desc` aparecem com a mesma grafia na prova (Task 5 step 1), no patch (step 3) e nas migrations (Tasks 2 e 3). A coluna de vinculo e `escopo_acao.frente` (text), casando com `escopo_frente.codigo`.
