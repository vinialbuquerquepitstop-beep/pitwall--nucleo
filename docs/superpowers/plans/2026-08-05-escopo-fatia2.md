# Escopo Fatia 2: a meta da frente e o dia que a serve

> **Para quem executa:** SUB-SKILL OBRIGATORIA: use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa.
> Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Goal:** cada frente do Escopo declara para onde vai, o placar para de exibir
`a frente` sem destino declarado, e a semana passa a dizer qual frente cada dia
constroi, com uma linha no Hoje.

**Architecture:** uma coluna nova em `escopo_frente` mais um log append-only por
trigger; a leitura existente (`escopo_completo()`) ganha a meta e o teto de faixa; a
tela do Escopo ganha meta, botao e selo; a Fatia 2b acrescenta duas tabelas de molde
semanal, uma RPC leve para o Hoje e a linha.

**Tech Stack:** Postgres/Supabase (RPC em plpgsql, RLS, trigger), frontend trio
servido pela Cloudflare (`public/index.html`, `public/app.css`, `public/app.js`),
provas em SQL (`ferramentas/prova_escopo.sql`) e Python/Chrome headless
(`ferramentas/harness.py`).

**Spec:** `docs/superpowers/specs/2026-08-05-escopo-meta-e-dia-design.md`.

## Global Constraints

Valem em TODA tarefa. Nao repetidas dentro de cada uma.

- **Roteamento (CLAUDE.md, secao A Torre):** migration e schema so pelo subagent
  `base`, unico com `apply_migration`. Tela, `app.js`, `app.css` pelo `vitrine`.
  Prova e aprovacao pelo `bandeira`, que nao escreve. Deploy e handoff pela Torre.
- **Invariantes duros:** toda tabela nova tem `tenant_id` e policy de RLS que o usa
  (7). Helpers de RLS so em `privado` (8). `authenticated` nunca recebe TRUNCATE (9).
  Nunca `CURRENT_DATE` onde se produz data de negocio: usar
  `(now() at time zone 'America/Sao_Paulo')::date` (10). A chave da frente e o
  `codigo`, nunca o `rotulo` (12). Historico e append-only (6).
- **`CREATE OR REPLACE FUNCTION` reseta ACLs.** Toda vez que uma funcao existente for
  substituida, refazer `revoke`/`grant` explicitos no mesmo bloco.
- **Conferir EXIT CODE, nunca o texto da saida.** `validar.py` imprime dezenas de
  linhas verdes e pode terminar em `REPROVOU:`.
- **Baseline `.antes` NAO se reponta nesta obra.** As 4 reprovacoes herdadas do
  `validar.py` seguem abertas por decisao do dono na v45. O criterio e "nenhuma
  reprovacao NOVA", nao "zero reprovacoes".
- **Proibido provar caminho de escrita por `SRC.indexOf(...)`.** String-matching
  sobre a fonte casa igual com o codigo quebrado: foi assim que 69 assercoes verdes
  conviveram com quatro botoes que so lancavam TypeError (v46, secao 4.6). Toda
  escrita nova precisa de uma assercao que CLICA no `harness.py`.
- **No delegado `A(a)`, `a` e o EVENTO e `e` e o ELEMENTO.** Usar `e.getAttribute`.
  Passar `e` (nunca `a`) como argumento de botao para `q()`/`qF()`.
- **Prosa em portugues sem acento, sem cedilha, sem travessao** (CLAUDE.md). Texto
  que vai para a TELA e produto e leva acentuacao correta.
- **Nunca truncar texto em silencio.** Acima do teto, recusar com mensagem que diz o
  tamanho recebido e o limite.
- **Entregar arquivo completo, nunca fragmento.**

---

## Estrutura de arquivos

| arquivo | responsabilidade | tarefas |
|---|---|---|
| migration `escopo_meta_coluna` | coluna `meta`, teto, `escopo_frente_evento`, trigger, RLS, grants | 1 |
| migration `escopo_meta_rpc` | `definir_meta_frente()` | 2 |
| migration `escopo_completo_meta` | leitura com meta, selo e teto de faixa | 3 |
| migration `escopo_seed_metas` | as 3 metas fundamentadas e seus marcos | 5 |
| migration `escopo_molde_semanal` | `escopo_dia_molde`, `escopo_dia_molde_frente`, seed dos 7 dias, `definir_dia_molde()`, `escopo_dia_hoje()` | 6 |
| `ferramentas/prova_escopo.sql` | prova de banco, transacional, termina em rollback | 1, 2, 3, 6 |
| `ferramentas/patch_escopo_meta.js` | patch do delegado minificado: handler `esc-meta` e troca `q` por `qF` | 4 |
| `ferramentas/patch_escopo_molde.js` | patch do delegado: handler `esc-dia` | 7 |
| `public/app.js` (blocos legiveis) | `escPlacar`, `escFrente`, `renderEscopo`, `escGrade`, linha do Hoje | 4, 7, 8 |
| `public/app.css` | `.esc-meta`, `.esc-meta-vazia`, `.esc-selo`, `.esc-grade`, `.hoje-serve` | 4, 7, 8 |
| `ferramentas/harness.py` | stub das RPCs novas e assercoes que CLICAM | 4, 7, 8 |

**Desvio consciente da spec, secao 3.2:** a spec escreveu `frente_id` em
`escopo_frente_evento`. O plano usa **`frente text`** (o `codigo`), porque
`escopo_acao.frente` ja aponta para a frente por codigo. Manter os dois formatos
criaria duas maneiras de apontar para a mesma coisa. Mesma razao para
`definir_meta_frente(p_frente text, ...)`, que espelha
`criar_acao_escopo(p_frente, p_titulo)`.

---

# FATIA 2a: a frente declara destino

### Task 1: coluna `meta`, teto e log auditado

**Files:**
- Modify: `ferramentas/prova_escopo.sql` (bloco novo antes do `raise exception` final)
- Migration (via subagent `base`): `escopo_meta_coluna`

**Interfaces:**
- Produces: `public.escopo_frente.meta text` (null permitido, teto 200);
  `public.escopo_frente_evento(id, tenant_id, frente text, meta_antes, meta_depois, em, por)`;
  trigger `tg_escopo_meta_evento` em `escopo_frente`.

- [ ] **Passo 1: escrever a prova que falha**

Abrir `ferramentas/prova_escopo.sql`. Localizar o fim do bloco do dono (antes das
assercoes de vendedor/tenant vizinho) e inserir:

```sql
  ---------------------------------------------------- Fatia 2a: meta da frente
  -- teto de 200: 201 tem que ser RECUSADO pelo CHECK
  begin
    update public.escopo_frente
       set meta = repeat('x', 201)
     where tenant_id = ten1 and codigo = 'pitscare';
    nfa:=nfa+1; rel:=rel||E'\nFALHOU meta: 201 chars entrou (teto ausente)';
  exception when check_violation then
    nok:=nok+1; rel:=rel||E'\n  ok  meta: 201 chars recusado pelo CHECK';
  end;

  -- 200 exatos tem que PASSAR. Sem esta, o teto poderia estar em qualquer
  -- lugar entre 1 e 200 e a prova acima continuaria verde.
  begin
    update public.escopo_frente
       set meta = repeat('y', 200)
     where tenant_id = ten1 and codigo = 'pitscare';
    nok:=nok+1; rel:=rel||E'\n  ok  meta: 200 chars exatos aceitos';
  exception when others then
    nfa:=nfa+1; rel:=rel||E'\nFALHOU meta: 200 chars recusados';
  end;

  -- o log e garantia do BANCO: UPDATE direto tem que gerar 1 evento
  select count(*) into n from public.escopo_frente_evento
   where tenant_id = ten1 and frente = 'pitscare' and meta_depois = repeat('y', 200);
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  meta: UPDATE direto gerou exatamente 1 evento';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU meta: achei '||n||' eventos, esperava 1'; end if;

  select count(*) into n from public.escopo_frente_evento
   where tenant_id = ten1 and frente = 'pitscare'
     and meta_antes is null and meta_depois = repeat('y', 200);
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  meta: o evento guarda antes e depois';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU meta: evento sem meta_antes/meta_depois corretos'; end if;

  -- append-only de verdade (invariante 6)
  if not has_table_privilege('authenticated', 'public.escopo_frente_evento', 'UPDATE')
     and not has_table_privilege('authenticated', 'public.escopo_frente_evento', 'DELETE')
     and not has_table_privilege('authenticated', 'public.escopo_frente_evento', 'TRUNCATE') then
    nok:=nok+1; rel:=rel||E'\n  ok  meta: authenticated sem UPDATE/DELETE/TRUNCATE no log';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU meta: authenticated tem privilegio demais no log'; end if;
```

- [ ] **Passo 2: rodar e ver falhar**

Colar o conteudo de `ferramentas/prova_escopo.sql` em `execute_sql` do MCP do Supabase.

Esperado: erro de Postgres `column "meta" of relation "escopo_frente" does not exist`
(a prova nem chega a contar). **Isso e a falha esperada**, nao um problema do script.

- [ ] **Passo 3: aplicar a migration**

Subagent `base`, `apply_migration` com `name: escopo_meta_coluna`:

```sql
alter table public.escopo_frente add column if not exists meta text;

alter table public.escopo_frente drop constraint if exists escopo_frente_meta_teto;
alter table public.escopo_frente add constraint escopo_frente_meta_teto
  check (meta is null or char_length(meta) <= 200);

create table if not exists public.escopo_frente_evento (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  frente      text not null,
  meta_antes  text,
  meta_depois text,
  em          timestamptz not null default now(),
  por         uuid
);

alter table public.escopo_frente_evento enable row level security;

drop policy if exists escopo_frente_evento_sel on public.escopo_frente_evento;
create policy escopo_frente_evento_sel on public.escopo_frente_evento
  for select to authenticated
  using (tenant_id = privado.fn_tenant_atual());

-- INSERT exige DONO, nao so tenant. Na Fatia 1 a policy de escopo_acao_evento so
-- checava tenant_id, e por isso um vendedor podia inserir evento na mao e inflar
-- a nota de uma frente parada (v46, secao 4.1).
drop policy if exists escopo_frente_evento_ins on public.escopo_frente_evento;
create policy escopo_frente_evento_ins on public.escopo_frente_evento
  for insert to authenticated
  with check (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

revoke all on public.escopo_frente_evento from authenticated;
grant select, insert on public.escopo_frente_evento to authenticated;

create index if not exists ix_escopo_frente_evento_frente
  on public.escopo_frente_evento (tenant_id, frente, em desc);

-- Trigger, nao insert manual dentro da RPC: auditoria que depende de todo mundo
-- lembrar de chamar a RPC certa nao e auditoria, e convencao (v46, decisao 6).
create or replace function privado.fn_escopo_meta_evento()
returns trigger language plpgsql
set search_path to 'public', 'privado'
as $function$
begin
  if new.meta is distinct from old.meta then
    insert into public.escopo_frente_evento(tenant_id, frente, meta_antes, meta_depois, por)
    values (new.tenant_id, new.codigo, old.meta, new.meta, auth.uid());
  end if;
  return new;
end $function$;

drop trigger if exists tg_escopo_meta_evento on public.escopo_frente;
create trigger tg_escopo_meta_evento
  after update on public.escopo_frente
  for each row execute function privado.fn_escopo_meta_evento();
```

- [ ] **Passo 4: rodar e ver passar**

Colar `ferramentas/prova_escopo.sql` de novo em `execute_sql`.

Esperado: erro terminando em **`0 falhas`** e contando 5 assercoes novas (45 -> 50).
Lembrar: `raise exception` com "0 falhas" no fim = APROVOU.

- [ ] **Passo 5: commitar**

```bash
git add ferramentas/prova_escopo.sql
git commit -m "feat(escopo): a frente ganha meta, com teto de 200 e log por trigger"
```

---

### Task 2: `definir_meta_frente()`

**Files:**
- Modify: `ferramentas/prova_escopo.sql`
- Migration (via `base`): `escopo_meta_rpc`

**Interfaces:**
- Consumes: `escopo_frente.meta` e o trigger da Task 1.
- Produces: `public.definir_meta_frente(p_frente text, p_meta text) returns json`,
  devolvendo `{ok:boolean, msg:text}`. `p_meta` nulo ou so espaco LIMPA a meta.

- [ ] **Passo 1: escrever a prova que falha**

Inserir em `ferramentas/prova_escopo.sql`, logo apos o bloco da Task 1:

```sql
  -- a RPC recusa acima do teto e DIZ o tamanho, nunca trunca em silencio
  select public.definir_meta_frente('pitscare', repeat('z', 201)) into r;
  if (r->>'ok')::boolean is false and r->>'msg' like '%201%200%' then
    nok:=nok+1; rel:=rel||E'\n  ok  rpc meta: 201 recusado com o tamanho na mensagem';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU rpc meta: '||coalesce(r::text,'nulo'); end if;

  select public.definir_meta_frente('pitscare', '  Laboratorio proprio operando  ') into r;
  select meta into msg from public.escopo_frente where tenant_id = ten1 and codigo = 'pitscare';
  if (r->>'ok')::boolean and msg = 'Laboratorio proprio operando' then
    nok:=nok+1; rel:=rel||E'\n  ok  rpc meta: grava e apara espaco das pontas';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU rpc meta: gravou "'||coalesce(msg,'nulo')||'"'; end if;

  -- string vazia LIMPA, nao grava frase vazia que a tela leria como declarada
  select public.definir_meta_frente('pitscare', '   ') into r;
  select meta into msg from public.escopo_frente where tenant_id = ten1 and codigo = 'pitscare';
  if (r->>'ok')::boolean and msg is null then
    nok:=nok+1; rel:=rel||E'\n  ok  rpc meta: so espaco LIMPA a meta (volta a nao declarada)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU rpc meta: limpar deixou "'||coalesce(msg,'nulo')||'"'; end if;

  select public.definir_meta_frente('nao_existe', 'x') into r;
  if (r->>'ok')::boolean is false then
    nok:=nok+1; rel:=rel||E'\n  ok  rpc meta: frente inexistente e recusada';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU rpc meta: frente inexistente foi aceita'; end if;
```

E, dentro do bloco de sessao do VENDEDOR que ja existe no arquivo:

```sql
  select public.definir_meta_frente('pitscare', 'meta do vendedor') into r;
  if (r->>'ok')::boolean is false then
    nok:=nok+1; rel:=rel||E'\n  ok  rpc meta: vendedor NAO define meta';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU rpc meta: vendedor definiu meta'; end if;
```

- [ ] **Passo 2: rodar e ver falhar**

Colar a prova em `execute_sql`. Esperado:
`function public.definir_meta_frente(unknown, text) does not exist`.

- [ ] **Passo 3: aplicar a migration**

Subagent `base`, `apply_migration` com `name: escopo_meta_rpc`:

```sql
create or replace function public.definir_meta_frente(p_frente text, p_meta text)
returns json
language plpgsql
-- SECURITY INVOKER (o default). NAO usar SECURITY DEFINER aqui: as 4 RPCs irmas
-- do Escopo sao INVOKER, escopo_frente ja tem policy de UPDATE exigindo dono, e
-- rodando como dono do banco a funcao passaria por cima da RLS, deixando de
-- exercer a policy de INSERT do log criada na Task 1 justamente para exigir dono.
set search_path to 'public', 'privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_meta   text;
  n        int;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'So o dono define a meta da frente.');
  end if;

  v_meta := nullif(btrim(coalesce(p_meta, '')), '');

  -- recusa explicita com o numero medido. Truncar aqui seria pior que recusar:
  -- texto cortado sem aviso e mentira silenciosa (v46, secao 4.3).
  if v_meta is not null and char_length(v_meta) > 200 then
    return json_build_object('ok', false,
      'msg', 'A meta tem ' || char_length(v_meta) || ' caracteres e o limite e 200. Nada foi gravado.');
  end if;

  update public.escopo_frente
     set meta = v_meta, atualizado_em = now()
   where tenant_id = v_tenant and codigo = p_frente;
  get diagnostics n = row_count;

  if n = 0 then
    return json_build_object('ok', false, 'msg', 'Frente nao encontrada.');
  end if;

  return json_build_object('ok', true,
    'msg', case when v_meta is null then 'Meta limpa.' else 'Meta declarada.' end);
end $function$;

revoke all on function public.definir_meta_frente(text, text) from public, anon;
grant execute on function public.definir_meta_frente(text, text) to authenticated;
```

- [ ] **Passo 4: rodar e ver passar**

Colar a prova. Esperado: `0 falhas`, 5 assercoes novas (50 -> 55).

- [ ] **Passo 5: commitar**

```bash
git add ferramentas/prova_escopo.sql
git commit -m "feat(escopo): definir_meta_frente recusa acima de 200 e limpa com vazio"
```

---

### Task 3: leitura com meta, selo e teto de faixa

**Files:**
- Modify: `ferramentas/prova_escopo.sql`
- Migration (via `base`): `escopo_completo_meta`

**Interfaces:**
- Produces: cada frente devolvida por `escopo_completo()` ganha `meta` (text ou null)
  e `meta_declarada` (boolean). O campo `faixa` passa a respeitar o teto.

- [ ] **Passo 1: escrever a prova que falha**

Inserir em `ferramentas/prova_escopo.sql`. Estas assercoes fecham tambem as **quatro
fronteiras (39/40/69/70)** que a Fatia 1 deixou abertas, incluindo a faixa `normal`,
que nunca foi assertada:

Acrescentar `caso record;` ao `declare` do bloco.

**Nunca `delete from public.escopo_acao` aqui:** existe a FK
`escopo_acao_evento_acao_fk` em `(tenant_id, acao_id)` **sem `on delete cascade`**, e o
trigger da Fatia 1 ja gerou um evento no insert de cada acao. O DELETE estoura com
violacao de chave estrangeira. Zerar a frente e `arquivada = true`, que e o que a
leitura ja filtra em `total`, `feitas`, `travadas` e `ult_evento`.

```sql
  ------------------------------------------- fronteiras de faixa e teto sem meta
  -- monta uma frente de prova com nota controlada por total/feitas
  update public.escopo_frente set meta = null where tenant_id = ten1 and codigo = 'assistencia';
  update public.escopo_acao set arquivada = true
   where tenant_id = ten1 and frente = 'assistencia';

  -- 10 acoes, 10 feitas, nenhuma travada, evento de hoje => nota 100
  insert into public.escopo_acao(tenant_id, frente, titulo, status)
  select ten1, 'assistencia', 'marco ' || g, 'feito' from generate_series(1, 10) g;

  select (f->>'faixa') into msg
    from json_array_elements((public.escopo_completo()->'frentes')) f
   where f->>'codigo' = 'assistencia';
  if msg = 'normal' then
    nok:=nok+1; rel:=rel||E'\n  ok  teto: nota 100 SEM meta le "normal", nao "a_frente"';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU teto: nota 100 sem meta leu "'||coalesce(msg,'nulo')||'"'; end if;

  select (f->>'meta_declarada') into msg
    from json_array_elements((public.escopo_completo()->'frentes')) f
   where f->>'codigo' = 'assistencia';
  if msg = 'false' then
    nok:=nok+1; rel:=rel||E'\n  ok  teto: meta_declarada=false chega na tela';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU teto: meta_declarada="'||coalesce(msg,'nulo')||'"'; end if;

  -- declarada a meta, a MESMA frente sobe para a_frente, sem outra mudanca
  perform public.definir_meta_frente('assistencia', 'Laboratorio proprio operando');
  select (f->>'faixa') into msg
    from json_array_elements((public.escopo_completo()->'frentes')) f
   where f->>'codigo' = 'assistencia';
  if msg = 'a_frente' then
    nok:=nok+1; rel:=rel||E'\n  ok  teto: declarar a meta destrava "a_frente" na mesma leitura';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU teto: com meta leu "'||coalesce(msg,'nulo')||'"'; end if;

  -- sem_dado VENCE o teto: frente sem acao e sem meta continua sem_dado
  update public.escopo_acao set arquivada = true
   where tenant_id = ten1 and frente = 'assistencia';
  perform public.definir_meta_frente('assistencia', null);
  select (f->>'faixa') into msg
    from json_array_elements((public.escopo_completo()->'frentes')) f
   where f->>'codigo' = 'assistencia';
  if msg = 'sem_dado' then
    nok:=nok+1; rel:=rel||E'\n  ok  teto: sem_dado vence o teto (zero acao)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU teto: frente vazia leu "'||coalesce(msg,'nulo')||'"'; end if;

  ------------------------------------- as QUATRO fronteiras de faixa: 39/40/69/70
  -- A Fatia 1 so testou 100 e 0, e a faixa `normal` nunca foi assertada em lugar
  -- nenhum. Deixa de ser opcional aqui: o teto sem meta mexe exatamente na
  -- fronteira dos 70.
  --
  -- Com evento de hoje o Movimento vale 30 cheio, entao com total = 100:
  --   nota = 40*(feitas/100) + 30*(1 - travadas/100) + 30 = 60 + 0.4*feitas - 0.3*travadas
  -- Os quatro pares abaixo caem em inteiro exato, sem depender do round().
  perform public.definir_meta_frente('assistencia', 'Frente de prova, meta declarada');

  for caso in
    select * from (values (25,  0, 70, 'a_frente'),
                          (30, 10, 69, 'normal'),
                          (10, 80, 40, 'normal'),
                          (0,  70, 39, 'em_baixa')) as t(feitas, travadas, nota_esp, faixa_esp)
  loop
    update public.escopo_acao set arquivada = true
     where tenant_id = ten1 and frente = 'assistencia';

    insert into public.escopo_acao(tenant_id, frente, titulo, status, motivo_trava)
    select ten1, 'assistencia', 'a' || g,
           case when g <= caso.feitas                            then 'feito'
                when g <= caso.feitas + caso.travadas            then 'travado'
                else 'a_fazer' end,
           case when g >  caso.feitas
                 and g <= caso.feitas + caso.travadas            then 'motivo de prova' end
      from generate_series(1, 100) g;

    select (f->>'nota')::int, f->>'faixa' into n, msg
      from json_array_elements((public.escopo_completo()->'frentes')) f
     where f->>'codigo' = 'assistencia';

    if n = caso.nota_esp and msg = caso.faixa_esp then
      nok:=nok+1; rel:=rel||E'\n  ok  fronteira '||caso.nota_esp||' le "'||caso.faixa_esp||'"';
    else
      nfa:=nfa+1; rel:=rel||E'\nFALHOU fronteira '||caso.nota_esp||': nota='||
        coalesce(n::text,'nulo')||' faixa="'||coalesce(msg,'nulo')||'"';
    end if;
  end loop;
```

- [ ] **Passo 2: rodar e ver falhar**

Colar a prova. Esperado: **4 falhas** — as do teto e de `meta_declarada` (a faixa
lera `a_frente` e `meta_declarada` vira nulo).

As 4 fronteiras JA passam antes da migration, e isso e o esperado: elas nao testam o
teto, testam a regua que sempre existiu e nunca tinha assercao. Entram como
guarda de regressao, e a fronteira dos 70 e a que vai denunciar se o teto quebrar a
faixa de quem TEM meta.

- [ ] **Passo 3: substituir `escopo_completo()`**

Subagent `base`, `apply_migration` com `name: escopo_completo_meta`. Partir da
definicao ATUAL (`select pg_get_functiondef('public.escopo_completo'::regproc)`) e
aplicar exatamente tres mudancas:

1. no CTE `base`, acrescentar `ef.meta` ao `select` e ao `group by`;
2. no `json_build_object` de saida, acrescentar `'meta', n.meta` e
   `'meta_declarada', (n.meta is not null)`;
3. trocar o `case` da faixa por:

```sql
           'faixa', case
                      when n.total = 0            then 'sem_dado'
                      -- teto: sem destino declarado a frente nao exibe "a frente".
                      -- Tres acoes bobas com duas fechadas cravariam desempenho
                      -- onde nao existe referencia.
                      when n.meta is null and n.nota >= 70 then 'normal'
                      when n.nota >= 70           then 'a_frente'
                      when n.nota >= 40           then 'normal'
                      else 'em_baixa' end,
```

E, no mesmo bloco da migration, porque `CREATE OR REPLACE FUNCTION` reseta ACLs:

```sql
revoke all on function public.escopo_completo() from public, anon;
grant execute on function public.escopo_completo() to authenticated;
```

- [ ] **Passo 4: rodar e ver passar**

Colar a prova. Esperado: `0 falhas`, 8 assercoes novas (55 -> 63).

Conferir tambem que o grant sobreviveu:

```sql
select has_function_privilege('authenticated', 'public.escopo_completo()', 'EXECUTE');
```
Esperado: `true`.

- [ ] **Passo 5: commitar**

```bash
git add ferramentas/prova_escopo.sql
git commit -m "feat(escopo): frente sem meta declarada para em normal, e sem_dado vence o teto"
```

---

### Task 4: a tela do Escopo (meta, botao, selo) e a troca de `q` por `qF`

**Files:**
- Modify: `public/app.js` (blocos legiveis `escPlacar` e `escFrente`)
- Create: `ferramentas/patch_escopo_meta.js` (delegado, dentro do nucleo minificado)
- Modify: `public/app.css`
- Modify: `ferramentas/harness.py` (stub + assercoes que clicam)

**Interfaces:**
- Consumes: `escopo_completo()` com `meta` e `meta_declarada`;
  `definir_meta_frente(p_frente, p_meta)`.
- Produces: elementos `[data-acao="esc-meta"]` com `data-frente` e `data-meta`;
  classes `.esc-meta`, `.esc-meta-vazia`, `.esc-selo`.

- [ ] **Passo 1: escrever as assercoes que falham**

Em `ferramentas/harness.py`, primeiro estender o stub (linha ~215): acrescentar
`meta` e `meta_declarada` nas tres frentes do fixture, e stubar a RPC nova.

Logo acima de `if (nome === 'escopo_completo') {`:

```python
        if (nome === 'definir_meta_frente') {
          // dois interruptores, para provar os caminhos que a Fatia 1 deixou sem
          // assercao: erro de RPC e leitor sem permissao (v46, pendencia 3)
          if (window.__META_ERRO) return Promise.resolve({ data: null, error: { message: 'estouro simulado' } });
          if (args.p_meta && args.p_meta.length > 200) return Promise.resolve({ data: { ok: false, msg: 'A meta tem ' + args.p_meta.length + ' caracteres e o limite e 200. Nada foi gravado.' }, error: null });
          return Promise.resolve({ data: { ok: true, msg: 'Meta declarada.' }, error: null });
        }
```

No fixture de `escopo_completo`, a frente `pitscare` recebe
`meta:'Os 6 passos do perfil comprou falando com voz de cuidado.', meta_declarada:true`
e a frente `assistencia` recebe `meta:null, meta_declarada:false`. Alem disso, trocar
`pode_editar: true` por `pode_editar: window.__ESC_PODE !== false`, para o caminho de
leitor sem permissao ficar testavel.

Depois, no fim do bloco do Escopo (apos a assercao de `nenhum TypeError`, linha ~815),
acrescentar:

```python
  // ---- Fatia 2a: a meta. Assercoes que CLICAM, nunca string-matching.
  ok('a meta declarada aparece no bloco da frente',
     telaTxt().indexOf('Os 6 passos do perfil comprou') >= 0, telaTxt().slice(0, 200));
  ok('frente sem meta mostra o botao declarar meta, nao a frase',
     !!document.querySelector('#lista [data-acao="esc-meta"][data-frente="assistencia"]'));
  ok('o selo "meta nao declarada" aparece no placar da frente sem meta',
     document.querySelectorAll('#lista .esc-selo').length >= 1,
     document.querySelectorAll('#lista .esc-selo').length + ' selos');

  var nMeta = rpcs('definir_meta_frente').length;
  window.prompt = function () { return 'Laboratorio proprio operando'; };
  document.querySelector('#lista [data-acao="esc-meta"][data-frente="assistencia"]').click();
  await espera(160);
  var um = rpcs('definir_meta_frente').pop();
  ok('tocar em declarar meta CHAMA definir_meta_frente com frente e texto',
     rpcs('definir_meta_frente').length === nMeta + 1 &&
     um.args.p_frente === 'assistencia' && um.args.p_meta === 'Laboratorio proprio operando',
     JSON.stringify(um && um.args));

  window.prompt = function () { return null; };
  var nCancelM = rpcs('definir_meta_frente').length;
  document.querySelector('#lista [data-acao="esc-meta"]').click();
  await espera(140);
  ok('prompt cancelado NAO chama definir_meta_frente',
     rpcs('definir_meta_frente').length === nCancelM);
  window.prompt = function () { return 'x'; };

  ok('escrever no Escopo NAO recarrega a base de leads (q -> qF)',
     rpcs('v_lead').length === 0 && window.__rpcChamadas.filter(function(r){ return r.nome === 'metricas_hoje'; }).length === 0,
     'a Fatia 1 chamava B() a cada toque e o celular piscava "Lendo a base..."');

  // ---- caminho de ERRO da RPC: r.error tem que virar aviso visivel, nunca
  // silencio. Buraco nomeado na pendencia 3 do v46.
  window.__META_ERRO = true;
  window.prompt = function () { return 'meta que vai falhar'; };
  document.querySelector('#lista [data-acao="esc-meta"]').click();
  await espera(200);
  var tst = document.getElementById('toast');
  ok('RPC com r.error mostra aviso de falha na tela, nao silencio',
     tst.className.indexOf('visivel') >= 0 && tst.className.indexOf('erro') >= 0 &&
     tst.textContent.indexOf('estouro simulado') >= 0,
     tst.className + ' | ' + tst.textContent);
  window.__META_ERRO = false;

  // ---- leitor sem permissao nao pode ter o controle no DOM
  window.__ESC_PODE = false;
  document.getElementById('abaEscopo').click();
  await espera(260);
  ok('com pode_editar=false o botao declarar meta NAO existe no DOM',
     document.querySelectorAll('#lista [data-acao="esc-meta"]').length === 0,
     document.querySelectorAll('#lista [data-acao="esc-meta"]').length + ' botoes');
  ok('com pode_editar=false a frente sem meta ainda DIZ que nao tem meta',
     document.querySelector('#lista .esc-meta-vazia').textContent.indexOf('não declarada') >= 0,
     document.querySelector('#lista .esc-meta-vazia').textContent);
  window.__ESC_PODE = true;
  document.getElementById('abaEscopo').click();
  await espera(260);

  ok('nenhum TypeError depois dos controles de meta',
     window.__erros.length === 0, window.__erros.join(' | '));
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
python ferramentas/harness.py
```
Esperado: **EXIT 1**, com pelo menos 5 linhas `FALHOU` do bloco novo (o seletor
`[data-acao="esc-meta"]` nao existe ainda, entao o `.click()` vai estourar; se o
harness abortar no `null`, isso tambem conta como falha esperada).

- [ ] **Passo 3: implementar a tela (partes legiveis)**

Em `public/app.js`, dentro de `escPlacar`, trocar a construcao da linha para incluir
o selo. A linha atual termina em `'<span class="esc-parcelas">'+c(par)+"</span></div>"`;
passa a ser:

```js
return'<div class="esc-linha f-'+c(f.faixa)+'"><span class="esc-linha-nome">'+c(f.rotulo)+'</span><span class="esc-nota">'+(sd?"--":c(String(f.nota)))+'</span><span class="esc-faixa">'+c(escFaixaRot(f.faixa))+'</span><span class="esc-parcelas">'+c(par)+"</span>"+(f.meta_declarada?"":'<span class="esc-selo">meta não declarada</span>')+"</div>"
```

Em `escFrente(fr,pode)`, logo antes do `return` final, montar a faixa da meta:

```js
// A frente abre pela meta. Sem meta, o lugar dela e ocupado pelo botao que
// cobra: progresso sem destino declarado e fracao de uma lista, nao avanco.
var mtx=c(fr.meta||""),
    meta=fr.meta
      ?'<div class="esc-meta">'+mtx+(pode?' <button class="link-acao" data-acao="esc-meta" data-frente="'+c(fr.codigo)+'" data-meta="'+mtx+'">editar</button>':"")+"</div>"
      :(pode?'<div class="esc-meta-vazia"><button class="link-acao" data-acao="esc-meta" data-frente="'+c(fr.codigo)+'" data-meta="">declarar meta</button></div>'
            :'<div class="esc-meta-vazia">meta não declarada</div>');
```

E inserir `meta` no retorno, entre o cabecalho e as acoes:

```js
return'<div class="esc-frente'+("pendencia"===fr.grupo?" esc-pend":"")+'"><div class="esc-frente-cab">'+escIcone(fr.icone)+'<span class="esc-frente-tit">'+c(fr.rotulo)+'</span><span class="esc-frente-cont">'+c(fr.feitas+"/"+fr.total)+"</span></div>"+meta+ac+form+"</div>"
```

- [ ] **Passo 4: implementar o delegado (parte minificada)**

O delegado vive dentro da linha unica do nucleo IIFE, entao NAO se edita a mao.
Criar `ferramentas/patch_escopo_meta.js`:

```js
// Acrescenta o handler `esc-meta` ao delegado e troca q() por qF(...,renderEscopo)
// nas escritas do Escopo.
//
// Por que a troca: q() termina em B(), que faz select em v_lead inteiro. Cada
// toque em chip recarregava a base de leads e o celular piscava "Lendo a base...".
// Rotina e Hoje ja usam qF justamente para nao pagar isso (v46, pendencia 5).
//
// Rodar da raiz do repo: node ferramentas/patch_escopo_meta.js
'use strict';
const fs = require('fs');
const path = require('path');

const ALVO = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(ALVO, 'utf8');

const INI = 'if("esc-criar"===o){';
const FIM = 'if("rot-dia"===o)';
const i = src.indexOf(INI), j = src.indexOf(FIM, i);
if (i < 0 || j < 0) {
  console.error('REPROVOU: nao achei o bloco do Escopo no delegado. Nada foi gravado.');
  process.exit(1);
}

let bloco = src.slice(i, j);

const nQ  = bloco.split('q("').length - 1;
const nAr = bloco.split(',e)').length - 1;
if (nQ !== 4 || nAr !== 4) {
  console.error(`REPROVOU: esperava 4 chamadas q(" e 4 argumentos ",e)" no bloco, achei ${nQ} e ${nAr}.`);
  console.error('O bloco mudou desde que este patch foi escrito. Nada foi gravado.');
  process.exit(1);
}
if (bloco.indexOf('esc-meta') >= 0) {
  console.error('REPROVOU: o bloco ja tem esc-meta. Patch ja aplicado? Nada foi gravado.');
  process.exit(1);
}

// 1. q("x",{...},e) -> qF("x",{...},e,renderEscopo)
bloco = bloco.split('q("').join('qF("').split(',e)').join(',e,renderEscopo)');

// 2. handler novo, colado no fim do bloco do Escopo
const HANDLER = 'if("esc-meta"===o){var mf=e.getAttribute("data-frente"),ma=e.getAttribute("data-meta")||"",mn=prompt("Para onde esta frente tem que chegar?",ma);if(null===mn)return;return void qF("definir_meta_frente",{p_frente:mf,p_meta:mn},e,renderEscopo)}';
bloco = bloco + HANDLER;

src = src.slice(0, i) + bloco + src.slice(j);
fs.writeFileSync(ALVO, src);
console.log(`ok  1. ${nQ} chamadas q( -> qF(, com renderEscopo no lugar de B()`);
console.log('ok  2. handler esc-meta acrescentado ao delegado');
```

Rodar:
```bash
node ferramentas/patch_escopo_meta.js
node --check public/app.js
```
Esperado: duas linhas `ok` e EXIT 0 no `--check`.

- [ ] **Passo 5: CSS das classes novas**

`validar.py` reprova classe emitida pelo JS que nao tem estilo no CSS (e uma das 4
reprovacoes herdadas: nao acrescentar mais uma). Em `public/app.css`, junto do bloco
`.esc-`:

```css
.esc-meta{font-size:13px;color:var(--txt-2);margin:2px 0 8px;line-height:1.45}
.esc-meta-vazia{font-size:13px;color:var(--txt-3);margin:2px 0 8px;font-style:italic}
.esc-selo{font-family:"Geist Mono",monospace;font-size:11px;color:var(--erro-fg);background:var(--erro-bg);padding:1px 6px;border-radius:4px;white-space:nowrap}
```

Nenhum token novo: `--erro-fg` e `--erro-bg` ja existem no `:root`. Cor identica com
nome diferente e drift garantido (v46, secao 5).

- [ ] **Passo 6: rodar tudo e ver passar**

```bash
python ferramentas/harness.py
python ferramentas/validar.py
python ferramentas/prova_trilho.py
python ferramentas/diag_mobile.py 360
python ferramentas/diag_mobile.py 390
python ferramentas/diag_mobile.py 414
node --check public/app.js
```
Esperado: `harness.py` com as 10 assercoes novas verdes (172 -> 182 passou, as 3
falhas herdadas de Vendas/NF seguem); `validar.py` EXIT 1 com **as mesmas 4
reprovacoes herdadas e nenhuma nova**; os demais EXIT 0.

- [ ] **Passo 7: commitar**

```bash
git add public/app.js public/app.css ferramentas/patch_escopo_meta.js ferramentas/harness.py
git commit -m "feat(escopo): a frente abre pela meta, o placar sela quem nao declarou"
```

---

### Task 5: semear as 3 metas fundamentadas e seus marcos

**Files:**
- Migration (via `base`): `escopo_seed_metas`

**Interfaces:**
- Consumes: `definir_meta_frente` e `escopo_acao` da Fatia 1.
- Produces: dado de negocio. Nenhum objeto novo.

**Texto aprovado pelo dono na spec, secao 5.1. Nao reescrever.**

- [ ] **Passo 1: aplicar a migration**

Subagent `base`, `apply_migration` com `name: escopo_seed_metas`. Idempotente de
proposito: rodar duas vezes nao duplica acao.

```sql
do $$
declare ten uuid := '00000000-0000-0000-0000-000000000001';
begin
  update public.escopo_frente set meta =
    'Os 6 passos do perfil comprou falando com voz de cuidado, no ar e provados na Fila.'
   where tenant_id = ten and codigo = 'pitscare';

  update public.escopo_frente set meta =
    'O consultor cota sozinho, sem te perguntar preço.'
   where tenant_id = ten and codigo = 'calculadoras';

  update public.escopo_frente set meta =
    'A semana seguinte pronta antes de começar.'
   where tenant_id = ten and codigo = 'producao_marketing';

  insert into public.escopo_acao(tenant_id, frente, titulo, status, motivo_trava, ordem)
  select ten, v.frente, v.titulo, v.status, v.motivo, v.ordem
    from (values
      ('pitscare', 'Fundir a branch claude/pitscare-estruturacao-o04knt na main', 'a_fazer', null::text, 10),
      ('pitscare', 'Gravar os 19 scripts em dicionario_scripts (perfil comprou, passos 1 a 6)', 'a_fazer', null, 20),
      ('pitscare', 'Provar que sugerir_mensagem devolve o script novo nos 6 passos', 'a_fazer', null, 30),
      ('pitscare', 'Cor de identidade do Pitscare', 'travado', 'adiado pelo dono em 21/07/2026', 40),
      ('calculadoras', 'Backend e login do parceiro na calc existente /calc/consultor/', 'a_fazer', null, 10),
      ('calculadoras', 'Tabela de preço dentro da validade', 'a_fazer', null, 20),
      ('calculadoras', 'Auditoria de divergência entre calc_dados e dados.js', 'a_fazer', null, 30),
      ('producao_marketing', 'Escrita de volta no Notion: mover card dispara PATCH /v1/pages/{page_id}', 'travado',
       'falta a capability "Update content" no NOTION_TOKEN, ato do dono em notion.so/profile/integrations', 10)
    ) as v(frente, titulo, status, motivo, ordem)
   where not exists (
     select 1 from public.escopo_acao a
      where a.tenant_id = ten and a.frente = v.frente and a.titulo = v.titulo);
end $$;
```

- [ ] **Passo 2: conferir o resultado no banco**

Uma chamada por verificacao (`execute_sql` so devolve o ultimo statement do bloco):

```sql
select codigo, meta is not null as tem_meta from public.escopo_frente
 where tenant_id = '00000000-0000-0000-0000-000000000001' and grupo = 'frente' order by ordem;
```
Esperado: `pitscare`, `calculadoras` e `producao_marketing` com `tem_meta = true`;
as outras cinco `false`.

```sql
select f->>'codigo' as frente, f->>'nota' as nota, f->>'faixa' as faixa
  from json_array_elements((public.escopo_completo()->'frentes')) f;
```
Esperado: as 3 semeadas saem de `sem_dado`; as 5 restantes continuam `sem_dado`.

```sql
select count(*) from public.escopo_frente_evento
 where tenant_id = '00000000-0000-0000-0000-000000000001';
```
Esperado: `3`. O trigger registrou as tres metas, sem ninguem chamar insert.

- [ ] **Passo 3: conferir na tela**

```bash
node ferramentas/servir.js
```
Abrir, tocar em **Mais**, depois em **Escopo**. Esperado: Pitscare com a meta no topo
do bloco e 4 marcos (um `travado` com o motivo visivel); Calculadoras com 3;
Producao e marketing com 1 travado; as outras 5 com `declarar meta` e o selo no placar.

- [ ] **Passo 4: commitar**

```bash
git commit --allow-empty -m "chore(escopo): semeia as 3 metas fundamentadas e seus 8 marcos"
```

> A migration vive no Supabase, nao no repo. O commit vazio existe para o handoff ter
> ancora; se preferir, registrar o SQL em `ferramentas/` antes de commitar.

---

# FATIA 2b: o dia serve uma frente

### Task 6: molde semanal no banco

**Files:**
- Modify: `ferramentas/prova_escopo.sql`
- Migration (via `base`): `escopo_molde_semanal`

**Interfaces:**
- Produces: `escopo_dia_molde(id, tenant_id, dia_semana, objetivo, ativo, ...)`,
  `escopo_dia_molde_frente(tenant_id, molde_id, frente)`;
  `definir_dia_molde(p_dia int, p_objetivo text, p_frentes text[]) returns json`;
  `escopo_dia_hoje() returns json` devolvendo
  `{ok, dia_semana, objetivo, frentes:[{codigo,rotulo}], marco:text|null, n_frentes:int}`.

- [ ] **Passo 1: escrever a prova que falha**

```sql
  ------------------------------------------------------ Fatia 2b: molde semanal
  select count(*) into n from public.escopo_dia_molde where tenant_id = ten1;
  if n = 7 then nok:=nok+1; rel:=rel||E'\n  ok  molde: 7 dias semeados';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU molde: achei '||n||' dias, esperava 7'; end if;

  select public.definir_dia_molde(2, 'Construir', array['pitscare']) into r;
  select count(*) into n from public.escopo_dia_molde_frente mf
    join public.escopo_dia_molde m on m.id = mf.molde_id
   where m.tenant_id = ten1 and m.dia_semana = 2;
  if (r->>'ok')::boolean and n = 1 then
    nok:=nok+1; rel:=rel||E'\n  ok  molde: definir_dia_molde grava 1 frente na terca';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU molde: '||coalesce(r::text,'nulo')||' n='||n; end if;

  -- redefinir SUBSTITUI, nao acumula
  select public.definir_dia_molde(2, 'Construir', array['pitscare','calculadoras']) into r;
  select count(*) into n from public.escopo_dia_molde_frente mf
    join public.escopo_dia_molde m on m.id = mf.molde_id
   where m.tenant_id = ten1 and m.dia_semana = 2;
  if n = 2 then nok:=nok+1; rel:=rel||E'\n  ok  molde: redefinir substitui as frentes do dia';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU molde: acumulou, achei '||n||' frentes'; end if;

  -- dia com 2+ frentes NAO escolhe marco: escolher pela ordem sugeriria uma
  -- prioridade que ninguem declarou
  select public.escopo_dia_hoje() into r;
  if (r->>'ok')::boolean then
    nok:=nok+1; rel:=rel||E'\n  ok  molde: escopo_dia_hoje responde';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU molde: escopo_dia_hoje nao respondeu'; end if;
```

- [ ] **Passo 2: rodar e ver falhar**

Colar em `execute_sql`. Esperado:
`relation "public.escopo_dia_molde" does not exist`.

- [ ] **Passo 3: aplicar a migration**

Subagent `base`, `apply_migration` com `name: escopo_molde_semanal`:

```sql
create table if not exists public.escopo_dia_molde (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  dia_semana    int  not null check (dia_semana between 1 and 7),
  objetivo      text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, dia_semana)
);

create table if not exists public.escopo_dia_molde_frente (
  tenant_id uuid not null,
  molde_id  uuid not null references public.escopo_dia_molde(id) on delete cascade,
  frente    text not null,
  primary key (molde_id, frente)
);

alter table public.escopo_dia_molde        enable row level security;
alter table public.escopo_dia_molde_frente enable row level security;

drop policy if exists escopo_dia_molde_sel on public.escopo_dia_molde;
create policy escopo_dia_molde_sel on public.escopo_dia_molde
  for select to authenticated using (tenant_id = privado.fn_tenant_atual());

drop policy if exists escopo_dia_molde_frente_sel on public.escopo_dia_molde_frente;
create policy escopo_dia_molde_frente_sel on public.escopo_dia_molde_frente
  for select to authenticated using (tenant_id = privado.fn_tenant_atual());

revoke all on public.escopo_dia_molde        from authenticated;
revoke all on public.escopo_dia_molde_frente from authenticated;
grant select on public.escopo_dia_molde        to authenticated;
grant select on public.escopo_dia_molde_frente to authenticated;

-- escrita so pela RPC, que checa papel. authenticated nao escreve direto.
insert into public.escopo_dia_molde(tenant_id, dia_semana)
select '00000000-0000-0000-0000-000000000001', g
  from generate_series(1, 7) g
 where not exists (
   select 1 from public.escopo_dia_molde
    where tenant_id = '00000000-0000-0000-0000-000000000001' and dia_semana = g);

create or replace function public.definir_dia_molde(p_dia int, p_objetivo text, p_frentes text[])
returns json language plpgsql security definer
set search_path to 'public', 'privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_molde  uuid;
  v_obj    text;
begin
  if v_tenant is null then return json_build_object('ok', false, 'msg', 'Sessao invalida.'); end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'So o dono edita o molde da semana.');
  end if;
  if p_dia is null or p_dia < 1 or p_dia > 7 then
    return json_build_object('ok', false, 'msg', 'Dia da semana invalido.');
  end if;

  v_obj := nullif(btrim(coalesce(p_objetivo, '')), '');
  if v_obj is not null and char_length(v_obj) > 120 then
    return json_build_object('ok', false,
      'msg', 'O objetivo tem ' || char_length(v_obj) || ' caracteres e o limite e 120. Nada foi gravado.');
  end if;

  update public.escopo_dia_molde set objetivo = v_obj, atualizado_em = now()
   where tenant_id = v_tenant and dia_semana = p_dia
   returning id into v_molde;
  if v_molde is null then return json_build_object('ok', false, 'msg', 'Dia nao encontrado.'); end if;

  -- substitui, nao acumula
  delete from public.escopo_dia_molde_frente where molde_id = v_molde;
  insert into public.escopo_dia_molde_frente(tenant_id, molde_id, frente)
  select v_tenant, v_molde, f
    from unnest(coalesce(p_frentes, array[]::text[])) f
   where exists (select 1 from public.escopo_frente ef
                  where ef.tenant_id = v_tenant and ef.codigo = f and ef.ativo);

  return json_build_object('ok', true, 'msg', 'Dia atualizado.');
end $function$;

create or replace function public.escopo_dia_hoje()
returns json language plpgsql stable security definer
set search_path to 'public', 'privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_dia    int;
  v_obj    text;
  v_fr     json;
  v_n      int;
  v_marco  text;
  v_cod    text;
begin
  if v_tenant is null then return json_build_object('ok', false, 'msg', 'Sessao invalida.'); end if;

  -- invariante 10: nunca CURRENT_DATE onde se produz data de negocio
  v_dia := extract(isodow from (now() at time zone 'America/Sao_Paulo')::date)::int;

  select m.objetivo into v_obj
    from public.escopo_dia_molde m
   where m.tenant_id = v_tenant and m.dia_semana = v_dia and m.ativo;

  select coalesce(json_agg(json_build_object('codigo', ef.codigo, 'rotulo', ef.rotulo)
                           order by ef.ordem), '[]'::json), count(*)
    into v_fr, v_n
    from public.escopo_dia_molde_frente mf
    join public.escopo_dia_molde m  on m.id = mf.molde_id
    join public.escopo_frente     ef on ef.tenant_id = v_tenant and ef.codigo = mf.frente and ef.ativo
   where m.tenant_id = v_tenant and m.dia_semana = v_dia and m.ativo;

  -- marco so quando o dia serve UMA frente. Com duas ou mais, escolher pela
  -- ordem sugeriria prioridade que ninguem declarou.
  if v_n = 1 then
    select ef.codigo into v_cod
      from public.escopo_dia_molde_frente mf
      join public.escopo_dia_molde m  on m.id = mf.molde_id
      join public.escopo_frente     ef on ef.tenant_id = v_tenant and ef.codigo = mf.frente
     where m.tenant_id = v_tenant and m.dia_semana = v_dia;

    -- 'fazendo' mais antigo; sem nenhum, o 'a_fazer' de menor ordem.
    -- 'travado' nunca e proposto: esta parado por motivo declarado.
    select a.titulo into v_marco
      from public.escopo_acao a
     where a.tenant_id = v_tenant and a.frente = v_cod and not a.arquivada
       and a.status in ('fazendo', 'a_fazer')
     order by (a.status <> 'fazendo'), a.ordem, a.criado_em
     limit 1;
  end if;

  return json_build_object('ok', true, 'dia_semana', v_dia, 'objetivo', v_obj,
                           'frentes', v_fr, 'n_frentes', v_n, 'marco', v_marco);
end $function$;

revoke all on function public.definir_dia_molde(int, text, text[]) from public, anon;
grant execute on function public.definir_dia_molde(int, text, text[]) to authenticated;
revoke all on function public.escopo_dia_hoje() from public, anon;
grant execute on function public.escopo_dia_hoje() to authenticated;
```

- [ ] **Passo 4: rodar e ver passar**

Colar `ferramentas/prova_escopo.sql`. Esperado: `0 falhas`, 4 assercoes novas
(63 -> 67).

- [ ] **Passo 5: commitar**

```bash
git add ferramentas/prova_escopo.sql
git commit -m "feat(escopo): molde de 7 dias, com marco so quando o dia serve uma frente"
```

---

### Task 7: a grade dos 7 dias na aba Escopo

**Files:**
- Modify: `public/app.js` (`renderEscopo` e funcao nova `escGrade`)
- Create: `ferramentas/patch_escopo_molde.js`
- Modify: `public/app.css`, `ferramentas/harness.py`

**Interfaces:**
- Consumes: `escopo_completo()` (frentes) e `escopo_dia_hoje()`.
- Produces: `escGrade(dias, frentes, pode)`; elementos
  `[data-acao="esc-dia"][data-dia="1..7"]`; classe `.esc-grade`.

> A leitura da grade entra em `escopo_completo()` como a chave `dias`, para a aba
> continuar fazendo UMA leitura. Estender a RPC exige repetir os `revoke`/`grant`
> (ACL reset). O `escopo_dia_hoje()` serve so a linha do Hoje.

- [ ] **Passo 1: estender a leitura**

Subagent `base`, `apply_migration` com `name: escopo_completo_dias`: partir da
definicao atual e acrescentar, antes do `return`:

```sql
  select coalesce(json_agg(json_build_object(
           'dia_semana', m.dia_semana, 'objetivo', m.objetivo,
           'frentes', coalesce((select json_agg(mf.frente order by mf.frente)
                                  from public.escopo_dia_molde_frente mf
                                 where mf.molde_id = m.id), '[]'::json))
         order by m.dia_semana), '[]'::json)
    into v_dias
    from public.escopo_dia_molde m
   where m.tenant_id = v_tenant and m.ativo;
```

com `v_dias json;` no `declare` e `'dias', v_dias` no `json_build_object` final. Repetir
no fim do bloco:

```sql
revoke all on function public.escopo_completo() from public, anon;
grant execute on function public.escopo_completo() to authenticated;
```

- [ ] **Passo 2: escrever as assercoes que falham**

Em `ferramentas/harness.py`, acrescentar `dias` ao fixture de `escopo_completo`
(7 entradas; a terca com `frentes:['pitscare']`, as demais `[]`), stubar
`definir_dia_molde` devolvendo `{ok:true, msg:'Dia atualizado.'}`, e assertar:

```python
  ok('a grade dos 7 dias aparece na aba Escopo',
     document.querySelectorAll('#lista .esc-grade .esc-dia').length === 7,
     document.querySelectorAll('#lista .esc-grade .esc-dia').length + ' dias');
  ok('o dia que serve uma frente mostra o rótulo dela',
     document.querySelector('#lista .esc-grade').textContent.indexOf('Pitscare') >= 0);

  var nDia = rpcs('definir_dia_molde').length;
  window.prompt = function () { return 'pitscare,calculadoras'; };
  document.querySelector('#lista [data-acao="esc-dia"][data-dia="3"]').click();
  await espera(160);
  var ud = rpcs('definir_dia_molde').pop();
  ok('tocar num dia CHAMA definir_dia_molde com o dia e as frentes',
     rpcs('definir_dia_molde').length === nDia + 1 &&
     ud.args.p_dia === 3 && ud.args.p_frentes.length === 2,
     JSON.stringify(ud && ud.args));
```

Rodar `python ferramentas/harness.py`. Esperado: EXIT 1 com as 3 novas falhando.

- [ ] **Passo 3: implementar**

Em `public/app.js`, antes de `renderEscopo`, acrescentar:

```js
var DIAS_ESC=["","segunda","terça","quarta","quinta","sexta","sábado","domingo"];
function escGrade(dias,frentes,pode){
if(!dias||!dias.length)return"";
var rot={};(frentes||[]).forEach(function(f){rot[f.codigo]=f.rotulo});
var cel=dias.map(function(d){
var fs=(d.frentes||[]).map(function(k){return c(rot[k]||k)}).join(" · ")||"<em>sem frente</em>";
return'<div class="esc-dia"><span class="esc-dia-nome">'+DIAS_ESC[d.dia_semana]+'</span><span class="esc-dia-frentes">'+fs+"</span>"+(pode?'<button class="link-acao" data-acao="esc-dia" data-dia="'+d.dia_semana+'">editar</button>':"")+"</div>"}).join("");
return'<div class="esc-grade"><div class="esc-grade-tit">A semana constrói</div>'+cel+"</div>"}
```

E em `renderEscopo`, trocar a montagem final por:

```js
e.innerHTML=fr.length?escPlacar(fr)+escGrade(d.dias||[],fr,pode)+fr.map(function(x){return escFrente(x,pode)}).join(""):'<div class="estado"><strong>O escopo está vazio.</strong>Nenhuma frente cadastrada.</div>'
```

Criar `ferramentas/patch_escopo_molde.js` no mesmo molde do
`patch_escopo_meta.js` (guardas de contagem, recusa se ja aplicado), acrescentando ao
delegado:

```js
if("esc-dia"===o){var dd=parseInt(e.getAttribute("data-dia"),10),dl=prompt("Quais frentes este dia constrói? Separe por vírgula (código da frente).","");if(null===dl)return;return void qF("definir_dia_molde",{p_dia:dd,p_objetivo:null,p_frentes:dl.split(",").map(function(s){return s.trim()}).filter(Boolean)},e,renderEscopo)}
```

CSS em `public/app.css`:

```css
.esc-grade{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:0 0 14px}
.esc-grade-tit{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--txt-3);margin-bottom:6px}
.esc-dia{display:flex;align-items:baseline;gap:10px;padding:4px 0;border-top:1px solid var(--line-fraca)}
.esc-dia:first-of-type{border-top:0}
.esc-dia-nome{font-family:"Geist Mono",monospace;font-size:12px;color:var(--txt-2);min-width:64px}
.esc-dia-frentes{flex:1;font-size:13px}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
node --check public/app.js
python ferramentas/harness.py
python ferramentas/validar.py
python ferramentas/diag_mobile.py 360
```
Esperado: `harness.py` com as 3 novas verdes; `validar.py` sem reprovacao NOVA;
`diag_mobile 360` EXIT 0 e 0 sobreposicoes (a grade e o bloco mais largo da aba).

- [ ] **Passo 5: commitar**

```bash
git add public/app.js public/app.css ferramentas/patch_escopo_molde.js ferramentas/harness.py
git commit -m "feat(escopo): a grade dos 7 dias mostra e edita o que cada dia constroi"
```

---

### Task 8: a linha no Hoje

**Files:**
- Modify: `public/app.js` (`renderHoje`)
- Modify: `public/app.css`, `ferramentas/harness.py`

**Interfaces:**
- Consumes: `escopo_dia_hoje()`.
- Produces: `<div class="hoje-serve">` como primeiro filho de `#lista` na aba Hoje.

- [ ] **Passo 1: escrever as assercoes que falham**

Stub em `harness.py`:

```python
        if (nome === 'escopo_dia_hoje') {
          if (window.__HOJE_SERVE === 'vazio') return Promise.resolve({ data: { ok: true, dia_semana: 3, objetivo: null, frentes: [], n_frentes: 0, marco: null }, error: null });
          if (window.__HOJE_SERVE === 'varias') return Promise.resolve({ data: { ok: true, dia_semana: 3, objetivo: null, frentes: [{codigo:'pitscare',rotulo:'Pitscare'},{codigo:'calculadoras',rotulo:'Calculadoras'}], n_frentes: 2, marco: null }, error: null });
          return Promise.resolve({ data: { ok: true, dia_semana: 3, objetivo: null, frentes: [{codigo:'pitscare',rotulo:'Pitscare'}], n_frentes: 1, marco: 'gravar os 19 scripts em dicionario_scripts' }, error: null });
        }
```

Assercoes, no bloco da aba Hoje:

```python
  ok('o Hoje declara qual frente o dia serve, com o marco',
     !!document.querySelector('#lista .hoje-serve') &&
     document.querySelector('#lista .hoje-serve').textContent.indexOf('Pitscare') >= 0 &&
     document.querySelector('#lista .hoje-serve').textContent.indexOf('19 scripts') >= 0,
     (document.querySelector('#lista .hoje-serve') || {}).textContent);

  window.__HOJE_SERVE = 'vazio';
  document.getElementById('abaHoje').click();
  await espera(260);
  ok('dia sem frente DIZ que nao serve frente nenhuma (calar esconderia a semana parada)',
     document.querySelector('#lista .hoje-serve').textContent.indexOf('nenhuma frente') >= 0,
     document.querySelector('#lista .hoje-serve').textContent);

  window.__HOJE_SERVE = 'varias';
  document.getElementById('abaHoje').click();
  await espera(260);
  ok('dia com 2+ frentes nomeia todas e NAO escolhe marco',
     document.querySelector('#lista .hoje-serve').textContent.indexOf('Pitscare') >= 0 &&
     document.querySelector('#lista .hoje-serve').textContent.indexOf('Calculadoras') >= 0 &&
     document.querySelector('#lista .hoje-serve').textContent.indexOf('ver Escopo') >= 0,
     document.querySelector('#lista .hoje-serve').textContent);
  window.__HOJE_SERVE = null;
```

Rodar `python ferramentas/harness.py`. Esperado: EXIT 1, 3 falhas novas.

- [ ] **Passo 2: implementar**

Em `public/app.js`, dentro de `renderHoje`, apos a leitura que ja existe e antes de
montar o `innerHTML`, acrescentar:

```js
// Linha, nunca bloco: o Hoje ja tem queixa de altura no celular. A leitura e
// leve de proposito (escopo_dia_hoje), para o Hoje nao pagar a aba inteira.
var serve="";
try{
var rs=await t.rpc("escopo_dia_hoje",{}),ds=rs&&rs.data;
if(ds&&!1!==ds.ok){
var nf=ds.n_frentes||0,nomes=(ds.frentes||[]).map(function(x){return c(x.rotulo)}).join(" · ");
serve=0===nf
  ?'<div class="hoje-serve">Hoje não serve nenhuma frente.</div>'
  :(1===nf
    ?'<div class="hoje-serve">Hoje serve: <strong>'+nomes+'</strong> · próximo marco: '+(ds.marco?c(ds.marco):"sem marco aberto")+"</div>"
    :'<div class="hoje-serve">Hoje serve: <strong>'+nomes+"</strong> · "+nf+" frentes hoje, ver Escopo</div>")}
}catch(_){serve=""}
```

e colar `serve` como primeiro pedaco do `innerHTML` do Hoje.

CSS:

```css
.hoje-serve{font-size:13px;color:var(--txt-2);border-left:3px solid var(--accent);padding:4px 0 4px 10px;margin:0 0 12px}
```

- [ ] **Passo 3: rodar tudo**

```bash
node --check public/app.js
python ferramentas/harness.py
python ferramentas/validar.py
python ferramentas/prova_trilho.py
python ferramentas/diag_mobile.py 360
python ferramentas/diag_mobile.py 390
python ferramentas/diag_mobile.py 414
node ferramentas/prova_escopo.js
```
Esperado: as 3 novas verdes; `validar.py` sem reprovacao NOVA; os demais EXIT 0.

- [ ] **Passo 4: provar a integridade do `app.js`**

Reaplicar os patches sobre o baseline e exigir igualdade TOTAL, com CRLF
normalizado. Comparacao de prefixo e sufixo nao vale: com varias costuras a primeira
ja desalinha e o numero vira lixo (v46, secao 6.2).

```bash
git stash
node ferramentas/patch_escopo_meta.js
node ferramentas/patch_escopo_molde.js
git stash pop
```
Conferir que o `app.js` reconstruido bate byte a byte com o commitado.

- [ ] **Passo 5: commitar**

```bash
git add public/app.js public/app.css ferramentas/harness.py
git commit -m "feat(hoje): uma linha declara qual frente o dia constroi"
```

---

## Fechamento

- [ ] **Rodar a suite inteira e conferir EXIT CODE, nao o texto**

```bash
python ferramentas/validar.py;      echo "validar: $?"
python ferramentas/harness.py;      echo "harness: $?"
python ferramentas/prova_trilho.py; echo "trilho: $?"
node ferramentas/prova_escopo.js;   echo "escopo js: $?"
```

- [ ] **Chamar o subagent `bandeira`** para aprovar ou reprovar com evidencia. Ele nao
      constroi e nao faz deploy.
- [ ] **Deploy:** `git push`. Neste projeto push E deploy: a Cloudflare publica sozinha.
      **Nao subir com revisao pendente** (v46, licao 5: a revisao voltou com um
      CRITICO depois do push).
- [ ] **Handoff:** criar `docs/handoffs/handoff_migracao_pitwall_v47.md` e atualizar
      `docs/handoffs/handoff_indice_pitwall.md`.
