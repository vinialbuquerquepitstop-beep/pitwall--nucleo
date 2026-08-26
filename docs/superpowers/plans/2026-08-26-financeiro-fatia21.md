# Fatia 2.1 do Financeiro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o reembolso parar de virar receita, gravar de qual regra veio cada classificacao, e deixar o dono criar categoria pela tela.

**Architecture:** Cinco entregas em cima do modulo Financeiro ja existente. O abatimento e DERIVADO na leitura a partir de `fin_categoria.natureza_esperada`, sem coluna nova e sem reescrever dado. A procedencia e GRAVADA (`fin_movimento.regra_id`), porque recalcular na leitura mentiria depois que a regra mudasse. A criacao de categoria e uma RPC de escrita no molde das RPCs da Fatia 1, com `codigo` imutavel por slug deterministico.

**Tech Stack:** Postgres/Supabase (migrations via MCP `apply_migration`), frontend trio servido pela Cloudflare (`public/index.html`, `public/app.css`, `public/app.js`), suite de validacao em Python com Chrome headless.

**Spec:** `docs/superpowers/specs/2026-08-26-financeiro-fatia21-design.md`

## Global Constraints

- **Invariante 18:** movimento sem `dominio` nao entra em NENHUM total. `dominio` nunca tem default silencioso.
- **Invariante 4:** nivel e natureza sao DERIVADOS na leitura, nunca armazenados.
- **Invariante 12:** a chave e o `codigo`, nunca o `rotulo`. `codigo` nunca muda depois de criado.
- **Invariante 6:** auditoria e append-only. As 5 tabelas `fin_` ja tem `trg_auditar_*`.
- **Invariante 10:** `CURRENT_DATE` proibido. Sempre `(now() at time zone 'America/Sao_Paulo')::date`.
- **`CREATE OR REPLACE FUNCTION` reseta ACLs:** toda migration que recria funcao refaz `revoke all ... from public` e `grant execute ... to authenticated, postgres, service_role`.
- **`CREATE OR REPLACE VIEW` derruba `security_invoker`:** nao ha view nesta fatia, mas se aparecer, seguir com `ALTER VIEW ... SET (security_invoker = on)`.
- **Helpers de RLS vivem em `privado`**, nunca em `public`.
- **`execute_sql` do MCP so devolve o resultado do ULTIMO statement.** Cada verificacao e uma chamada separada.
- **Toda prova de banco roda sob RLS** (`set local role authenticated` + `request.jwt.claims`) e e desfeita por `raise exception`.
- **Piso da suite: 885 assercoes, 0 falhas.** Nao pode cair. Conferir EXIT CODE, nunca o texto da saida.
- **Cor:** `--morno` para ESTADO (devolucao, pausado, conflito). `--erro` so para falha de sistema. Zero token novo.
- **Prosa:** portugues do Brasil sem acento nos comentarios do Claude; valores reais do sistema (`Operação`, `Alimentação fora`, `iFood`) preservam os caracteres exatos.

## IDs desta sessao

- Supabase project: `unjzpyexgtbcmjfgcqrx`
- Tenant: `00000000-0000-0000-0000-000000000001`
- Dono (auth uid): `fb2aad8e-b728-4e59-a198-71da2156449d`
- Vendedor Brendon (auth uid), para a prova de isolamento: `130353b1-64da-4ed4-b766-776261191a99`

## File Structure

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `supabase/migrations/20260826_fin_fatia21_painel_abatimento.sql` | `fin_painel` com abatimento derivado | 1 |
| `supabase/migrations/20260826_fin_fatia21_regra_id.sql` | coluna `regra_id`, indice, motor e `fin_classificar` gravando/limpando | 2 |
| `supabase/migrations/20260826_fin_fatia21_seed_categorias.sql` | `iFood`, `Obra (casa)`, `Obra (loja)` | 3 |
| `supabase/migrations/20260826_fin_fatia21_categoria_salvar.sql` | slug em `privado`, RPC `fin_categoria_salvar` | 4 |
| `supabase/migrations/20260826_fin_fatia21_movimentos_procedencia.sql` | `fin_movimentos` de 5 parametros com procedencia | 5 |
| `public/app.js` | nota do abatimento, selo, detalhe da categoria, criar categoria | 6, 7, 8 |
| `public/app.css` | classes novas dos tres blocos de tela | 6, 7, 8 |
| `ferramentas/harness.py` | assercoes `fin21:` | 6, 7, 8 |

---

## Task 1: Abatimento derivado no `fin_painel`

**Files:**
- Create: `supabase/migrations/20260826_fin_fatia21_painel_abatimento.sql`
- Reference (copiar o corpo atual daqui): `supabase/migrations/20260826_fin_fatia1_rpcs_leitura.sql:9-171`

**Interfaces:**
- Consumes: `fin_categoria.natureza_esperada` (`saida` | `entrada` | `neutro`), ja populada (24/6/3).
- Produces: `fin_painel(p_ini date, p_fim date, p_dominio text) -> json`. Contrato novo em cada item de `secoes[].categorias[]` e `entradas[].categorias[]`: alem de `codigo`, `rotulo`, `total`, `pct`, `delta_pct`, `n`, passa a devolver **`bruto` numeric** e **`abatido` numeric** (`total = bruto - abatido`). Consumido pelas tarefas 6 e 7.

- [ ] **Step 1: Escrever a prova, ANTES de mexer na funcao**

Rodar via MCP `execute_sql`. Ela deve REPROVAR agora, e e isso que prova que o defeito existe:

```sql
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', true);
with p as (select public.fin_painel('2026-07-28','2026-08-26',null) as j)
select
  (j->'placar'->>'entrou')::numeric                              as entrou,
  (j->'placar'->>'resultado')::numeric                           as resultado,
  (select (c->>'total')::numeric
     from p, json_array_elements(j->'secoes') s,
          json_array_elements(s->'categorias') c
    where c->>'codigo' = 'transporte')                           as transporte,
  (select count(*) from p, json_array_elements(j->'entradas') s,
          json_array_elements(s->'categorias') c
    where c->>'codigo' = 'transporte')                           as transporte_em_entradas
from p;
```

- [ ] **Step 2: Rodar e registrar o numero errado**

Esperado AGORA (o defeito): `transporte = 624.95`, `transporte_em_entradas = 1`.
Anotar tambem o `entrou` e o `resultado` devolvidos: sao a linha de base das proximas assercoes.

- [ ] **Step 3: Escrever a migration**

Copiar o corpo inteiro de `fin_painel` da migration da Fatia 1 e aplicar EXATAMENTE tres mudancas.

**3a. Bloco `placar`** — trocar as duas primeiras expressoes do `select ... into` para que o sinal so conte quando bate com a natureza da categoria:

```sql
  select
    coalesce(sum(b.valor) filter (where b.conta_no_total and b.valor > 0 and b.nat <> 'saida'), 0)
      - coalesce(sum(-b.valor) filter (where b.conta_no_total and b.valor < 0 and b.nat = 'entrada'), 0),
    coalesce(-sum(b.valor) filter (where b.conta_no_total and b.valor < 0 and b.nat <> 'entrada'), 0)
      - coalesce(sum(b.valor) filter (where b.conta_no_total and b.valor > 0 and b.nat = 'saida'), 0),
    coalesce(sum(b.valor) filter (where b.conta_no_total), 0),
    coalesce(sum(b.valor) filter (where b.dominio is null), 0),
    coalesce(count(*) filter (where b.dominio is null), 0)
  into v_entrou, v_saiu, v_result, v_nc_val, v_nc_n
  from (
    select m.valor, m.dominio,
           coalesce(c.natureza_esperada, '') as nat,
           ( m.dominio is not null
             and (v_dom is null or m.dominio = v_dom)
             and coalesce(c.natureza_esperada, '') <> 'neutro' ) as conta_no_total
      from public.fin_movimento m
      left join public.fin_categoria c
        on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
     where m.tenant_id = v_tenant
       and m.arquivado_em is null
       and m.data between v_ini and v_fim
  ) b;
```

`v_result` fica INTACTO de proposito: ele soma com sinal e ja estava certo.

**3b. Bloco `secoes`** — tirar o `and m.valor < 0` do `base` e passar a somar bruto e abatido separados:

```sql
  with base as (
    select coalesce(c.grupo, 'Sem categoria') as grupo,
           coalesce(m.categoria_codigo, 'sem_categoria') as codigo,
           coalesce(c.rotulo, 'Sem categoria') as rotulo,
           m.valor,
           (m.data between v_ini and v_fim) as atual
      from public.fin_movimento m
      left join public.fin_categoria c
        on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
     where m.tenant_id = v_tenant
       and m.arquivado_em is null
       and m.data between v_pini and v_fim
       and m.dominio is not null
       and (v_dom is null or m.dominio = v_dom)
       and ( coalesce(c.natureza_esperada, '') = 'saida'
             or (m.categoria_codigo is null and m.valor < 0) )
  ), cat as (
    select grupo, codigo, rotulo,
           coalesce(sum(-valor) filter (where atual), 0)                  as tot,
           coalesce(sum(-valor) filter (where atual and valor < 0), 0)    as bruto,
           coalesce(sum(valor)  filter (where atual and valor > 0), 0)    as abatido,
           coalesce(sum(-valor) filter (where not atual), 0)              as ant,
           coalesce(count(*)    filter (where atual), 0)::int             as n
      from base group by grupo, codigo, rotulo
  ), g as (
    select coalesce(sum(tot), 0) as total from cat
  ), sec as (
    select cat.grupo, sum(cat.tot) as tot, sum(cat.ant) as ant,
           json_agg(json_build_object(
             'codigo', cat.codigo, 'rotulo', cat.rotulo, 'total', cat.tot,
             'bruto', cat.bruto, 'abatido', cat.abatido,
             'pct', case when g.total > 0 then round(100.0 * cat.tot / g.total, 1) else 0 end,
             'delta_pct', case when cat.ant > 0 then round(100.0 * (cat.tot - cat.ant) / cat.ant, 1) else null end,
             'n', cat.n) order by cat.tot desc, cat.rotulo)
             filter (where cat.tot <> 0 or cat.abatido <> 0) as cats
      from cat cross join g
     group by cat.grupo, g.total
  )
  select coalesce(json_agg(json_build_object(
           'grupo', sec.grupo, 'total', sec.tot,
           'pct', case when g.total > 0 then round(100.0 * sec.tot / g.total, 1) else 0 end,
           'delta_pct', case when sec.ant > 0 then round(100.0 * (sec.tot - sec.ant) / sec.ant, 1) else null end,
           'categorias', coalesce(sec.cats, '[]'::json))
         order by sec.tot desc, sec.grupo) filter (where sec.tot <> 0 or sec.cats is not null), '[]'::json)
    into v_secoes
    from sec cross join g;
```

Tres mudancas de comportamento aqui, todas exigidas pela spec §3:
- `= 'saida'` em vez de `<> 'neutro'` mais `valor < 0`: a secao de gasto passa a olhar a categoria, nao o sinal.
- `filter (where cat.tot <> 0 or cat.abatido <> 0)`: **secao negativa aparece**, e categoria que so teve devolucao tambem. O `> 0` de antes escondia dinheiro que voltou.
- `delta_pct` continua `null` quando `ant` nao e positivo. Base negativa cai no `else null`, entao a tela escreve `novo` e nunca `0%`.

**3c. Bloco `entradas`** — o espelho: `= 'entrada'` em vez de `<> 'neutro'` mais `valor > 0`, com `bruto`/`abatido` invertidos:

```sql
       and ( coalesce(c.natureza_esperada, '') = 'entrada'
             or (m.categoria_codigo is null and m.valor > 0) )
  ), cat as (
    select grupo, codigo, rotulo,
           coalesce(sum(valor)  filter (where atual), 0)                  as tot,
           coalesce(sum(valor)  filter (where atual and valor > 0), 0)    as bruto,
           coalesce(sum(-valor) filter (where atual and valor < 0), 0)    as abatido,
           coalesce(sum(valor)  filter (where not atual), 0)              as ant,
           coalesce(count(*)    filter (where atual), 0)::int             as n
      from base group by grupo, codigo, rotulo
```

O resto do bloco `entradas` recebe as mesmas trocas de `filter` que o `secoes` (3b), com `bruto` e `abatido` no `json_build_object`.

Fechar a migration com:

```sql
revoke all on function public.fin_painel(date, date, text) from public;
grant execute on function public.fin_painel(date, date, text) to authenticated, postgres, service_role;
```

- [ ] **Step 4: Aplicar via `apply_migration`**

Nome: `fin_fatia21_painel_abatimento`.

- [ ] **Step 5: Rodar a prova do Step 1 de novo**

Esperado AGORA:
- `transporte = 493.93`
- `transporte_em_entradas = 0`
- `entrou` = o valor do Step 2 **menos 131.02**
- `resultado` = **identico** ao do Step 2

Se `resultado` mudou, a migration esta errada. Parar e corrigir.

- [ ] **Step 6: Provar o caso de borda da secao negativa**

Numa transacao desfeita por exception, inserir um reembolso sem gasto correspondente na janela e conferir que a categoria APARECE com total negativo em vez de sumir:

```sql
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', true);
do $$
declare v jsonb; v_tot numeric;
begin
  insert into public.fin_movimento
    (tenant_id, conta_id, data, descricao, valor, categoria_codigo, dominio, origem, hash_dedupe)
  select tenant_id, id, '2026-08-20', 'PROVA devolucao isolada', 90.00,
         'vestuario', 'pessoal', 'manual', 'prova_fatia21_borda'
    from public.fin_conta where tenant_id = privado.fn_tenant_atual() limit 1;

  select public.fin_painel('2026-08-01','2026-08-26',null)::jsonb into v;
  select (c->>'total')::numeric into v_tot
    from jsonb_array_elements(v->'secoes') s,
         jsonb_array_elements(s->'categorias') c
   where c->>'codigo' = 'vestuario';
  raise exception 'PROVA BORDA: vestuario total=% (esperado -90.00, e NAO nulo)', coalesce(v_tot::text,'SUMIU');
end $$;
```

Esperado na mensagem da exception: `vestuario total=-90.00`. Se vier `SUMIU`, o `filter` do Step 3b esta errado.

- [ ] **Step 7: Provar isolamento e ausencia de `CURRENT_DATE`**

```sql
select p.proname, pg_get_functiondef(p.oid) ilike '%current_date%' as usa_current_date
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'fin_painel';
```

Esperado: `usa_current_date = false`.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260826_fin_fatia21_painel_abatimento.sql docs/superpowers/specs/2026-08-26-financeiro-fatia21-design.md
git commit -m "fix(financeiro): reembolso deixa de virar receita

Entrada em categoria de natureza saida vira abatimento, derivado na leitura.
Transporte cai de R$ 624,95 para R$ 493,93 e entrou cai R$ 131,02; resultado
nao se mexe, porque ele soma com sinal e ja estava certo.

Secao que fica negativa passa a aparecer com sinal em vez de sumir: o filtro
antigo derrubava total zero ou menos, escondendo dinheiro que voltou.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

A spec entra neste commit por decisao do dono.

---

## Task 2: Procedencia gravada (`regra_id`)

**Files:**
- Create: `supabase/migrations/20260826_fin_fatia21_regra_id.sql`
- Reference: `supabase/migrations/20260826_fin_fatia2_aplicar_helper.sql:61-67` (o UPDATE do motor), `supabase/migrations/20260826_fin_fatia1_rpcs_escrita.sql:270-281` (o UPDATE do `fin_classificar`)

**Interfaces:**
- Produces: `fin_movimento.regra_id uuid null references public.fin_regra(id)`. Consumido pela tarefa 5 (leitura) e pelas tarefas 7 (tela).

- [ ] **Step 1: Escrever a prova, antes da coluna existir**

```sql
select count(*) as tem_coluna
from information_schema.columns
where table_schema='public' and table_name='fin_movimento' and column_name='regra_id';
```

- [ ] **Step 2: Rodar e confirmar que falha**

Esperado AGORA: `tem_coluna = 0`.

- [ ] **Step 3: Escrever a migration**

```sql
alter table public.fin_movimento
  add column regra_id uuid null references public.fin_regra(id);

comment on column public.fin_movimento.regra_id is
  'Qual regra classificou esta linha. Null = classificada na mao, ou antes da Fatia 2.1. Limpa quando o dono classifica por cima.';

create index fin_movimento_regra_idx
  on public.fin_movimento (tenant_id, regra_id)
  where regra_id is not null;
```

Em seguida, recriar `privado.fn_fin_aplicar_regras` copiando o corpo atual e trocando SO o `set` do UPDATE (o CTE `mud` ja carrega `regra_id`):

```sql
    update public.fin_movimento m
       set dominio          = mud.dom_novo,
           categoria_codigo = mud.cat_novo,
           regra_id         = mud.regra_id,
           atualizado_em    = now()
      from mud
     where m.id = mud.mov_id
    returning mud.regra_id as regra_id, mud.padrao as padrao
```

E recriar `public.fin_classificar` copiando o corpo atual e trocando SO o `set` do UPDATE:

```sql
  update public.fin_movimento m
     set categoria_codigo = case when v_has_cat then v_cat else m.categoria_codigo end,
         dominio          = case when v_has_dom then v_dom else m.dominio end,
         observacao       = case when v_has_obs then v_obs else m.observacao end,
         regra_id         = case when (v_has_cat or v_has_dom) then null else m.regra_id end,
         atualizado_em    = now()
   where m.id = any(v_ids)
     and m.tenant_id = v_tenant
     and m.arquivado_em is null
     and ( (v_has_cat and m.categoria_codigo is distinct from v_cat)
        or (v_has_dom and m.dominio          is distinct from v_dom)
        or (v_has_obs and m.observacao       is distinct from v_obs) );
```

Mexer so em `observacao` NAO limpa a procedencia: anotar nao e reclassificar.

Fechar refazendo os grants das duas funcoes:

```sql
revoke all on function privado.fn_fin_aplicar_regras(uuid, uuid[], uuid[], text) from public;
grant execute on function privado.fn_fin_aplicar_regras(uuid, uuid[], uuid[], text) to authenticated;
revoke all on function public.fin_classificar(jsonb) from public;
grant execute on function public.fin_classificar(jsonb) to authenticated, postgres, service_role;
```

- [ ] **Step 4: Aplicar via `apply_migration`**

Nome: `fin_fatia21_regra_id`.

- [ ] **Step 5: Provar que a regra grava e que a mao limpa**

```sql
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', true);
do $$
declare v_mov uuid; v_reg uuid; v_dep uuid; v_pos uuid;
begin
  select id into v_reg from public.fin_regra
   where padrao = 'UBER DO BRASIL TECNOLOGIA LTDA' and arquivado_em is null;
  select id into v_mov from public.fin_movimento
   where descricao ilike '%UBER DO BRASIL%' and valor < 0 limit 1;

  update public.fin_movimento set categoria_codigo = null, dominio = null, regra_id = null
   where id = v_mov;
  perform public.fin_regra_aplicar(jsonb_build_object('ids', jsonb_build_array(v_reg)));
  select regra_id into v_dep from public.fin_movimento where id = v_mov;

  perform public.fin_classificar(jsonb_build_object(
    'ids', jsonb_build_array(v_mov), 'categoria_codigo', 'transporte'));
  select regra_id into v_pos from public.fin_movimento where id = v_mov;

  raise exception 'PROVA: apos regra=% (esperado o id da regra), apos mao=% (esperado NULL)',
    coalesce(v_dep::text,'NULL'), coalesce(v_pos::text,'NULL');
end $$;
```

Esperado: `apos regra` traz um uuid, `apos mao=NULL`. A exception desfaz tudo.

- [ ] **Step 6: Confirmar que as 46 antigas seguem sem procedencia**

```sql
select count(*) filter (where categoria_codigo is not null) as classificados,
       count(*) filter (where regra_id is not null)          as com_procedencia
from public.fin_movimento;
```

Esperado: `classificados = 46`, `com_procedencia = 0`. **Sem backfill e proposital** (spec §4).

- [ ] **Step 7: `get_advisors` sem WARN novo**

Rodar `get_advisors` e comparar com a linha de base do v68: **3 WARN pre-existentes**. Se aparecer um quarto, corrigir antes de commitar.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260826_fin_fatia21_regra_id.sql
git commit -m "feat(financeiro): a linha passa a dizer qual regra a classificou

Coluna regra_id na fin_movimento, gravada pelo motor e LIMPA quando o dono
classifica por cima: sem isso, um ajuste manual continuaria dizendo que a
regra fez, que e mentira de procedencia. Mexer so na observacao nao limpa.

Sem backfill: as duas regras de UBER casam exatamente as mesmas 27 linhas,
entao escolher uma seria inventar. As 46 ja classificadas ficam marcadas como
procedencia nao registrada.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: As tres categorias pedidas

**Files:**
- Create: `supabase/migrations/20260826_fin_fatia21_seed_categorias.sql`

**Interfaces:**
- Produces: os codigos `ifood`, `obra_casa`, `obra_loja` em `fin_categoria`. Consumidos pela tela (seletor) e pelas regras que o dono criar.

- [ ] **Step 1: Escrever a prova**

```sql
select codigo, rotulo, grupo, natureza_esperada
from public.fin_categoria
where codigo in ('ifood','obra_casa','obra_loja') order by codigo;
```

- [ ] **Step 2: Rodar e confirmar que falha**

Esperado AGORA: 0 linhas.

- [ ] **Step 3: Escrever a migration**

Acento preservado nos rotulos e no grupo `Operação` (regra de linguagem: valor real do sistema nao se mexe).

```sql
insert into public.fin_categoria
  (tenant_id, codigo, rotulo, grupo, natureza_esperada, dominio_sugerido, ordem, ativo)
select t.tenant_id, v.codigo, v.rotulo, v.grupo, v.natureza, v.dom,
       coalesce((select max(c.ordem) from public.fin_categoria c
                  where c.tenant_id = t.tenant_id and c.grupo = v.grupo), 0) + v.desloc,
       true
from (select '00000000-0000-0000-0000-000000000001'::uuid as tenant_id) t
cross join (values
  ('ifood',     'iFood',       'Vida',      'saida', 'pessoal', 1),
  ('obra_casa', 'Obra (casa)', 'Casa',      'saida', 'pessoal', 1),
  ('obra_loja', 'Obra (loja)', 'Operação',  'saida', 'empresa', 1)
) as v(codigo, rotulo, grupo, natureza, dom, desloc)
on conflict (tenant_id, codigo) do nothing;
```

`dominio_sugerido` e SUGESTAO na tela, nunca default gravado: o invariante 18 continua exigindo que o dono confirme.

- [ ] **Step 4: Aplicar via `apply_migration`**

Nome: `fin_fatia21_seed_categorias`.

- [ ] **Step 5: Rodar a prova do Step 1 de novo**

Esperado: 3 linhas, com `Operação` acentuado e `natureza_esperada = 'saida'` nas tres.

- [ ] **Step 6: Confirmar que aparecem no seletor**

```sql
select count(*) from json_array_elements(public.fin_config()->'categorias') c
where c->>'codigo' in ('ifood','obra_casa','obra_loja');
```

Esperado: `3`. Rodar sob o `request.jwt.claims` do dono.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260826_fin_fatia21_seed_categorias.sql
git commit -m "feat(financeiro): categorias iFood, Obra (casa) e Obra (loja)

Duas Obras porque o dono respondeu que e das duas coisas. Juntar seria
misturar dinheiro da loja com pessoal, que e o que o invariante 18 impede.

Nenhuma regra nasce junto: regra e decisao do dono, a partir de um lancamento
real. As 3 linhas de iFood (R$ 319,36) ficam esperando ele.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: `fin_categoria_salvar`

**Files:**
- Create: `supabase/migrations/20260826_fin_fatia21_categoria_salvar.sql`

**Interfaces:**
- Consumes: `privado.fn_fin_norm(text)` (ja existe, tira acento e sobe caixa).
- Produces: `public.fin_categoria_salvar(payload jsonb) -> jsonb`. Devolve `{ok:true, codigo, criada, categorias}` onde `categorias` e a lista completa no MESMO formato de `fin_config()->'categorias'`, para a tela nao precisar de segunda chamada. Consumido pela tarefa 8.

- [ ] **Step 1: Escrever a prova**

```sql
select count(*) as existe from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='fin_categoria_salvar';
```

- [ ] **Step 2: Rodar e confirmar que falha**

Esperado AGORA: `existe = 0`.

- [ ] **Step 3: Escrever o slug, em `privado`**

```sql
create or replace function privado.fn_fin_slug(t text)
returns text
language sql
immutable
set search_path to ''
as $$
  select btrim(
           regexp_replace(
             regexp_replace(lower(privado.fn_fin_norm(t)), '[^a-z0-9]+', '_', 'g'),
             '_+', '_', 'g'),
           '_');
$$;
grant execute on function privado.fn_fin_slug(text) to authenticated;
```

`iFood` vira `ifood`; `Obra (casa)` vira `obra_casa`. Deterministico e `IMMUTABLE`, no molde de `fn_fin_norm`.

- [ ] **Step 4: Escrever a RPC**

```sql
create or replace function public.fin_categoria_salvar(payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_id      uuid;
  v_cod     text;
  v_rot     text;
  v_grupo   text;
  v_nat     text;
  v_ordem   int;
  v_ativo   boolean;
  v_atual   public.fin_categoria%rowtype;
  v_ocupa   text;
  v_criada  boolean := false;
  v_cats    jsonb;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  begin
    v_id := nullif(btrim(coalesce(payload->>'id','')), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Id de categoria invalido.');
  end;

  if v_id is not null then
    select * into v_atual from public.fin_categoria
     where id = v_id and tenant_id = v_tenant;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Categoria nao encontrada.');
    end if;
  end if;

  -- presenca da chave manda (convencao da Fatia 1)
  v_rot   := coalesce(nullif(btrim(coalesce(payload->>'rotulo','')), ''), v_atual.rotulo);
  v_grupo := coalesce(nullif(btrim(coalesce(payload->>'grupo','')), ''), v_atual.grupo);
  v_nat   := coalesce(nullif(lower(btrim(coalesce(payload->>'natureza_esperada',''))), ''),
                      v_atual.natureza_esperada);
  v_ativo := coalesce((payload->>'ativo')::boolean, v_atual.ativo, true);

  if v_rot is null or v_rot = '' then
    return jsonb_build_object('ok', false, 'erro', 'Informe o rotulo da categoria.');
  end if;
  if not exists (select 1 from public.fin_categoria
                  where tenant_id = v_tenant and grupo = v_grupo) then
    return jsonb_build_object('ok', false, 'erro',
      'Grupo invalido: use um dos grupos existentes.');
  end if;
  if v_nat not in ('saida','entrada','neutro') then
    return jsonb_build_object('ok', false, 'erro',
      'Natureza invalida: use saida, entrada ou neutro.');
  end if;

  if v_id is null then
    -- CRIACAO: o codigo nasce aqui e nunca mais muda (invariante 12)
    v_cod := privado.fn_fin_slug(v_rot);
    if v_cod is null or v_cod = '' then
      return jsonb_build_object('ok', false, 'erro',
        'Rotulo sem letra nem numero: nao da para gerar o codigo.');
    end if;
    select rotulo into v_ocupa from public.fin_categoria
     where tenant_id = v_tenant and codigo = v_cod;
    if found then
      return jsonb_build_object('ok', false, 'erro',
        'Ja existe a categoria "' || v_ocupa || '" com esse mesmo codigo.');
    end if;
    select coalesce(max(ordem), 0) + 1 into v_ordem from public.fin_categoria
     where tenant_id = v_tenant and grupo = v_grupo;
    v_ordem := coalesce((payload->>'ordem')::int, v_ordem);

    insert into public.fin_categoria
      (tenant_id, codigo, rotulo, grupo, natureza_esperada, ordem, ativo)
    values (v_tenant, v_cod, v_rot, v_grupo, v_nat, v_ordem, v_ativo);
    v_criada := true;
  else
    -- EDICAO: rotulo, grupo, natureza, ordem e ativo mudam. codigo NUNCA.
    v_cod   := v_atual.codigo;
    v_ordem := coalesce((payload->>'ordem')::int, v_atual.ordem);
    update public.fin_categoria
       set rotulo = v_rot, grupo = v_grupo, natureza_esperada = v_nat,
           ordem = v_ordem, ativo = v_ativo
     where id = v_id and tenant_id = v_tenant;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'codigo', codigo, 'rotulo', rotulo, 'grupo', grupo,
           'natureza_esperada', natureza_esperada,
           'dominio_sugerido', dominio_sugerido, 'ordem', ordem)
         order by ordem, rotulo), '[]'::jsonb)
    into v_cats
    from public.fin_categoria
   where tenant_id = v_tenant and ativo;

  return jsonb_build_object('ok', true, 'codigo', v_cod,
                            'criada', v_criada, 'categorias', v_cats);
end
$$;
revoke all on function public.fin_categoria_salvar(jsonb) from public;
grant execute on function public.fin_categoria_salvar(jsonb) to authenticated, postgres, service_role;
```

Nao existe caminho de DELETE, de proposito (spec §5).

- [ ] **Step 5: Aplicar via `apply_migration`**

Nome: `fin_fatia21_categoria_salvar`.

- [ ] **Step 6: Provar os seis caminhos, sob RLS, desfeito por exception**

```sql
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', true);
do $$
declare r jsonb; v_id uuid; v_cod text; v_aud int;
begin
  r := public.fin_categoria_salvar('{"rotulo":"Padaria","grupo":"Vida","natureza_esperada":"saida"}');
  if (r->>'ok')::boolean is not true or r->>'codigo' <> 'padaria' then
    raise exception 'FALHOU criacao: %', r;
  end if;

  select id into v_id from public.fin_categoria where codigo = 'padaria';
  r := public.fin_categoria_salvar(jsonb_build_object('id', v_id, 'rotulo', 'Padaria da esquina'));
  select codigo into v_cod from public.fin_categoria where id = v_id;
  if v_cod <> 'padaria' then raise exception 'FALHOU: codigo mudou para %', v_cod; end if;

  r := public.fin_categoria_salvar('{"rotulo":"Padaria","grupo":"Vida","natureza_esperada":"saida"}');
  if (r->>'ok')::boolean is not false then raise exception 'FALHOU: aceitou codigo repetido'; end if;

  r := public.fin_categoria_salvar('{"rotulo":"Teste","grupo":"Inexistente","natureza_esperada":"saida"}');
  if (r->>'ok')::boolean is not false then raise exception 'FALHOU: aceitou grupo inexistente'; end if;

  r := public.fin_categoria_salvar('{"rotulo":"Teste","grupo":"Vida","natureza_esperada":"xpto"}');
  if (r->>'ok')::boolean is not false then raise exception 'FALHOU: aceitou natureza invalida'; end if;

  select count(*)::int into v_aud from public.auditoria
   where tabela = 'fin_categoria' and registro_id = v_id and acao = 'INSERT';

  raise exception 'PROVA OK: criou, editou sem mudar codigo, recusou repetido, grupo e natureza. auditoria INSERT=% (esperado 1)', v_aud;
end $$;
```

A tabela de auditoria e `public.auditoria`, colunas `tabela, registro_id, acao, antes, depois, usuario_id` (conferido em 26/08/2026 no `pg_attribute`).

- [ ] **Step 6b: Provar que desativar tira do seletor e MANTEM o historico**

Criterio de aceite da spec §8 que nenhum outro passo cobre:

```sql
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', true);
do $$
declare v_id uuid; v_no_seletor int; v_no_painel int;
begin
  select id into v_id from public.fin_categoria where codigo = 'transporte';
  perform public.fin_categoria_salvar(jsonb_build_object('id', v_id, 'ativo', false));

  select count(*)::int into v_no_seletor
    from json_array_elements(public.fin_config()->'categorias') c
   where c->>'codigo' = 'transporte';

  select count(*)::int into v_no_painel
    from json_array_elements(public.fin_painel('2026-07-28','2026-08-26',null)->'secoes') s,
         json_array_elements(s->'categorias') c
   where c->>'codigo' = 'transporte';

  raise exception 'PROVA DESATIVAR: no seletor=% (esperado 0), no painel=% (esperado 1)',
    v_no_seletor, v_no_painel;
end $$;
```

Esperado: `no seletor=0, no painel=1`. O `fin_painel` faz `left join` em `fin_categoria` sem filtrar `ativo`, entao o rotulo do mes passado continua resolvendo. Se `no painel=0`, alguem acrescentou um filtro de `ativo` na leitura e o historico passou a mentir.

- [ ] **Step 7: Provar o isolamento**

```sql
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"130353b1-64da-4ed4-b766-776261191a99","role":"authenticated"}', true);
select public.fin_categoria_salvar('{"rotulo":"Invasao","grupo":"Vida","natureza_esperada":"saida"}');
```

Esperado: `{"ok": false, "erro": "Financeiro e restrito ao dono."}`.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260826_fin_fatia21_categoria_salvar.sql
git commit -m "feat(financeiro): criar e editar categoria sem passar por SQL

fin_categoria_salvar, dono-only. O codigo nasce por slug deterministico do
rotulo e NUNCA muda depois: o rotulo e display e editavel, a chave nao
(invariante 12). Nao existe caminho de DELETE; desativar tira do seletor e
mantem o rotulo nos numeros historicos.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: `fin_movimentos` com filtro de categoria e procedencia

**Files:**
- Create: `supabase/migrations/20260826_fin_fatia21_movimentos_procedencia.sql`
- Reference: `supabase/migrations/20260826_fin_fatia1_rpcs_leitura.sql:174-257`

**Interfaces:**
- Consumes: `fin_movimento.regra_id` (tarefa 2).
- Produces: `public.fin_movimentos(p_ini date, p_fim date, p_dominio text, p_status text, p_categoria text default null) -> json`. Cada item de `itens` ganha `regra_id` e `regra_padrao` (null quando nao houver). Consumido pelas tarefas 6 e 7.

- [ ] **Step 1: Escrever a prova**

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='fin_movimentos';
```

- [ ] **Step 2: Rodar e registrar**

Esperado AGORA: **uma** linha, `args = p_ini date, p_fim date, p_dominio text, p_status text`.

- [ ] **Step 3: Escrever a migration**

Comecar derrubando a versao de 4 parametros, senao fica overload e o PostgREST nao resolve:

```sql
drop function if exists public.fin_movimentos(date, date, text, text);
```

Recriar copiando o corpo atual com quatro mudancas:

**3a.** A assinatura ganha o quinto parametro com default, para o `app.js` publicado (que manda 4) continuar resolvendo enquanto a tela nova nao sobe:

```sql
create or replace function public.fin_movimentos(
  p_ini date default null, p_fim date default null,
  p_dominio text default null, p_status text default 'todos',
  p_categoria text default null
) returns json
```

**3b.** Declarar `v_cat text;` e normalizar junto dos outros parametros:

```sql
  v_cat := nullif(btrim(coalesce(p_categoria, '')), '');
  if v_cat is not null
     and not exists (select 1 from public.fin_categoria
                      where tenant_id = v_tenant and codigo = v_cat) then
    return json_build_object('ok', false, 'msg', 'Categoria inexistente: ' || v_cat);
  end if;
```

**3c.** Acrescentar `and (v_cat is null or m.categoria_codigo = v_cat)` nos DOIS `where`: o do `select count(*)` e o do `select ... from ( ... ) t`. Esquecer um faz o contador discordar da lista.

**3d.** No `select` de dentro do `from ( ... ) t`, acrescentar as duas colunas de procedencia e o join:

```sql
        select m.id, m.data, m.descricao, m.descricao_original, m.valor,
               m.categoria_codigo,
               c.rotulo as categoria_rotulo,
               c.grupo,
               c.natureza_esperada,
               m.dominio, m.origem,
               co.rotulo as conta_rotulo,
               m.observacao, m.venda_id, m.criado_em,
               m.regra_id,
               r.padrao as regra_padrao
          from public.fin_movimento m
          join public.fin_conta co on co.id = m.conta_id
          left join public.fin_categoria c
            on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
          left join public.fin_regra r
            on r.id = m.regra_id
```

`regra_padrao` sai do join, entao mostra o padrao ATUAL da regra. Proposital (spec §4): display nao e chave.

Fechar com os grants da assinatura NOVA:

```sql
revoke all on function public.fin_movimentos(date, date, text, text, text) from public;
grant execute on function public.fin_movimentos(date, date, text, text, text) to authenticated, postgres, service_role;
```

- [ ] **Step 4: Aplicar via `apply_migration`**

Nome: `fin_fatia21_movimentos_procedencia`.

- [ ] **Step 5: Provar o filtro e a compatibilidade**

Chamada com 4 parametros nomeados (o que a tela publicada faz hoje):

```sql
select (public.fin_movimentos(p_ini => '2026-07-28', p_fim => '2026-08-26',
                              p_dominio => null, p_status => 'todos')->>'n')::int as n_sem_filtro;
```

Esperado: `181`.

Chamada com o filtro novo:

```sql
select (public.fin_movimentos(p_ini => '2026-07-28', p_fim => '2026-08-26',
                              p_dominio => null, p_status => 'todos',
                              p_categoria => 'transporte')->>'n')::int as n_transporte;
```

Esperado: `27`.

- [ ] **Step 6: Provar que a categoria inexistente e recusada**

```sql
select public.fin_movimentos('2026-07-28','2026-08-26',null,'todos','nao_existe');
```

Esperado: `{"ok": false, "msg": "Categoria inexistente: nao_existe"}`.

- [ ] **Step 7: Confirmar que nao ficou overload**

Repetir a consulta do Step 1. Esperado: **uma** linha so, agora com 5 argumentos. Se vierem duas, o `drop` do Step 3 nao pegou e o PostgREST vai falhar.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260826_fin_fatia21_movimentos_procedencia.sql
git commit -m "feat(financeiro): abrir a categoria e ver as linhas por tras do numero

fin_movimentos ganha p_categoria e devolve regra_id e regra_padrao por linha.
A versao de 4 parametros foi derrubada antes de recriar, senao vira overload e
o PostgREST nao resolve; o parametro novo tem default, entao a tela publicada
segue funcionando ate o frontend subir.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Tela — a nota do abatimento e o selo de devolucao

**Files:**
- Modify: `public/app.js` (bloco da Visao do Financeiro e da lista de Movimentos)
- Modify: `public/app.css`
- Modify: `ferramentas/harness.py`

**Interfaces:**
- Consumes: `secoes[].categorias[].bruto` e `.abatido` (tarefa 1); `itens[].natureza_esperada` e `itens[].valor` (ja existentes).

- [ ] **Step 1: Escrever as assercoes que falham**

Em `ferramentas/harness.py`, no bloco `fin`, com o fixture da Visao trazendo `transporte` com `total: 493.93, bruto: 624.95, abatido: 131.02`:

```javascript
  ok('fin21: a secao mostra o liquido, nao o bruto',
     finQ('.fin-sec-cat[data-cod="transporte"] .fin-sec-val').textContent.indexOf('493,93') >= 0,
     finQ('.fin-sec-cat[data-cod="transporte"] .fin-sec-val').textContent);
  ok('fin21: e DECLARA a conta que produziu o liquido',
     finQ('.fin-sec-cat[data-cod="transporte"] .fin-sec-abat').textContent.indexOf('624,95') >= 0 &&
     finQ('.fin-sec-cat[data-cod="transporte"] .fin-sec-abat').textContent.indexOf('131,02') >= 0,
     finQ('.fin-sec-cat[data-cod="transporte"] .fin-sec-abat').textContent);
  ok('fin21: categoria sem devolucao nao ganha nota nenhuma',
     !finQ('.fin-sec-cat[data-cod="alimentacao_fora"] .fin-sec-abat'));
  ok('fin21: secao negativa aparece com sinal, em vez de sumir',
     !!finQ('.fin-sec-cat[data-cod="vestuario"]') &&
     finQ('.fin-sec-cat[data-cod="vestuario"] .fin-sec-val').textContent.indexOf('-') >= 0,
     finQ('.fin-sec-cat[data-cod="vestuario"] .fin-sec-val').textContent);
  ok('fin21: a linha devolvida ganha selo, e ele e --morno e nunca --erro',
     getComputedStyle(fin2Lin('Reembolso recebido').querySelector('.fin-selo-dev')).color
       === 'rgb(148, 101, 0)',
     getComputedStyle(fin2Lin('Reembolso recebido').querySelector('.fin-selo-dev')).color);
```

- [ ] **Step 2: Rodar e confirmar que falham**

```bash
python ferramentas/harness.py
```

Esperado: FALHA nas 5 novas, com `.fin-sec-abat` e `.fin-selo-dev` inexistentes. Conferir o EXIT CODE, nao o texto.

- [ ] **Step 3: Implementar no `app.js` e no `app.css`**

Na funcao que desenha a categoria dentro da secao, emitir a nota so quando houver abatimento:

```javascript
(c.abatido > 0
  ? '<div class="fin-sec-abat">' + moeda(c.bruto) + ' gastos menos ' +
    moeda(c.abatido) + ' devolvidos · ' + c.n + ' linhas</div>'
  : '')
```

Na linha de movimento, o selo quando o sinal contraria a natureza da categoria:

```javascript
(m.natureza_esperada === 'saida' && m.valor > 0
  ? '<span class="fin-selo-dev">devolução</span>' : '')
```

No `app.css`, sem token novo:

```css
.fin-sec-abat{font:400 11px/1.4 var(--mono);color:var(--text-2);margin-top:2px}
.fin-selo-dev{font:500 10px/1 var(--mono);color:var(--morno-txt);background:var(--morno-tint);border-radius:3px;padding:2px 5px;margin-left:6px}
```

Conferir os nomes reais das variaveis de `--morno` em `public/app.css` antes de escrever: a regra 11.1 do `validar.py` reprova hex solto no JS.

- [ ] **Step 4: Rodar as assercoes de novo**

```bash
python ferramentas/harness.py
```

Esperado: as 5 novas PASSAM e o total sobe de 885 para 890. EXIT 0.

- [ ] **Step 5: Rodar a suite inteira**

```bash
python ferramentas/validar.py
python ferramentas/harness.py
python ferramentas/prova_trilho.py
python ferramentas/prova_grafico.py
python ferramentas/prova_atmosfera.py
node --check public/app.js
for w in 360 390 414 1280 1440; do python ferramentas/diag_mobile.py $w; done
```

Esperado: EXIT 0 em todos. Se `validar.py` reprovar por hex no JS, o problema e o CSS ter ido para o lugar errado.

- [ ] **Step 6: Commit**

```bash
git add public/app.js public/app.css ferramentas/harness.py
git commit -m "feat(financeiro): a secao declara a conta em vez de mudar de numero sozinha

Transporte mostra R$ 493,93 com a linha 624,95 menos 131,02 embaixo, e a
linha devolvida ganha selo em --morno. Categoria sem devolucao nao ganha nota,
e secao negativa aparece com sinal em vez de sumir.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Tela — o detalhe da categoria

**Files:**
- Modify: `public/app.js`, `public/app.css`, `ferramentas/harness.py`

**Interfaces:**
- Consumes: `fin_movimentos(..., p_categoria)` com `descricao_original`, `regra_id`, `regra_padrao` (tarefa 5).

- [ ] **Step 1: Escrever as assercoes que falham**

```javascript
  finQ('.fin-sec-cat[data-cod="transporte"]').click();
  await espera(430);
  ok('fin21: clicar na categoria chama fin_movimentos com o filtro dela',
     fin2Ult(window.__rpcChamadas.filter(function (r) { return r.nome === 'fin_movimentos'; }))
       .args.p_categoria === 'transporte');
  ok('fin21: o detalhe lista as 27 linhas',
     finQA('.fin-det .fin-lin').length === 27,
     finQA('.fin-det .fin-lin').length);
  ok('fin21: mostra o texto CRU do banco, sem truncar',
     finQ('.fin-det .fin-lin .fin-det-cru').textContent.indexOf('17.895.646/0001-87') >= 0);
  ok('fin21: linha classificada por regra diz qual foi',
     finQ('.fin-det .fin-lin[data-id="m1"] .fin-det-proc').textContent
       .indexOf('UBER DO BRASIL TECNOLOGIA LTDA') >= 0,
     finQ('.fin-det .fin-lin[data-id="m1"] .fin-det-proc').textContent);
  ok('fin21: linha sem regra_id NAO inventa regra, diz que nao esta registrada',
     finQ('.fin-det .fin-lin[data-id="m2"] .fin-det-proc').textContent
       === 'procedência não registrada',
     finQ('.fin-det .fin-lin[data-id="m2"] .fin-det-proc').textContent);
```

- [ ] **Step 2: Rodar e confirmar que falham**

```bash
python ferramentas/harness.py
```

Esperado: FALHA nas 5, `.fin-det` inexistente.

- [ ] **Step 3: Implementar**

A categoria vira alvo clicavel (`role="button"`, `tabindex="0"`, `aria-expanded`), e o detalhe abre embaixo dela chamando `fin_movimentos` com `p_categoria`. A procedencia:

```javascript
(m.regra_padrao
  ? 'pela regra ' + esc(m.regra_padrao)
  : (m.regra_id ? 'por regra arquivada' : 'procedência não registrada'))
```

Quando a linha foi classificada na mao (`categoria_codigo` preenchido, `regra_id` nulo) e o movimento e posterior a esta fatia, o texto certo continua sendo `procedência não registrada`: a tela nao tem como distinguir, e inventar seria pior.

- [ ] **Step 4: Rodar as assercoes de novo**

Esperado: as 5 PASSAM, total em 895. EXIT 0.

- [ ] **Step 5: Rodar a suite inteira e as 5 larguras**

Os mesmos 7 comandos da tarefa 6, Step 5. O detalhe aberto e o bloco mais largo desta fatia: se alguma largura reprovar, e aqui.

- [ ] **Step 6: Commit**

```bash
git add public/app.js public/app.css ferramentas/harness.py
git commit -m "feat(financeiro): abrir a categoria e ver de onde veio cada linha

Clicar na categoria da Visao abre os lancamentos por tras do numero, com o
texto cru do banco e a procedencia. Linha sem regra_id diz procedencia nao
registrada em vez de chutar uma regra.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Tela — `+ Nova categoria`

**Files:**
- Modify: `public/app.js`, `public/app.css`, `ferramentas/harness.py`

**Interfaces:**
- Consumes: `fin_categoria_salvar(payload)` devolvendo `{ok, codigo, criada, categorias}` (tarefa 4).

- [ ] **Step 1: Escrever as assercoes que falham**

```javascript
  ok('fin21: o seletor de categoria oferece criar uma nova',
     !!finQ('.fin-cat-sel option[value="__nova__"]'));
  ok('fin21: escolher nova abre o formulario NA LINHA, sem sair da tela',
     (function () {
        var s = finQ('.fin-cat-sel'); s.value = '__nova__';
        s.dispatchEvent(new Event('change', {bubbles: true}));
        return !!finQ('.fin-lin .fin-cat-nova');
     })());
  ok('fin21: o grupo vem de fin_config, nunca chumbado no JS',
     finQA('.fin-cat-nova select[name="grupo"] option').length === 9,
     finQA('.fin-cat-nova select[name="grupo"] option').length);
  ok('fin21: salvar manda rotulo, grupo e natureza',
     (function () {
        finQ('.fin-cat-nova input[name="rotulo"]').value = 'Padaria';
        finQ('.fin-cat-nova .fin-cat-nova-ok').click();
        var a = fin2Ult(window.__rpcChamadas.filter(function (r) {
          return r.nome === 'fin_categoria_salvar'; })).args.payload;
        return a.rotulo === 'Padaria' && !!a.grupo && !!a.natureza_esperada;
     })());
  ok('fin21: a categoria nova entra no seletor sem recarregar',
     !!finQ('.fin-cat-sel option[value="padaria"]'));
  ok('fin21: a recusa do servidor aparece como veio, sem ser engolida',
     finQ('.fin-cat-nova .fin-cat-nova-erro').textContent
       .indexOf('Ja existe a categoria') >= 0,
     finQ('.fin-cat-nova .fin-cat-nova-erro').textContent);
```

- [ ] **Step 2: Rodar e confirmar que falham**

Esperado: FALHA nas 6.

- [ ] **Step 3: Implementar**

A lista de grupos sai de `fin_config()->categorias`, por `distinct grupo`, **nunca chumbada** (a Fatia 1 ja estabeleceu isso para categoria). Depois do `ok:true`, substituir a lista local por `resposta.categorias` e selecionar `resposta.codigo` na linha que disparou.

- [ ] **Step 4: Rodar as assercoes de novo**

Esperado: as 6 PASSAM, total em 901. EXIT 0.

- [ ] **Step 5: Rodar a suite inteira e as 5 larguras**

Os mesmos 7 comandos.

- [ ] **Step 6: Commit (sem push)**

```bash
git add public/app.js public/app.css ferramentas/harness.py
git commit -m "feat(financeiro): criar categoria sem sair da linha

Ultima opcao do seletor abre o formulario na propria linha, no mesmo padrao da
regra que nasce do lancamento. Os grupos vem do fin_config, nunca chumbados.
A categoria nova entra no seletor sem recarregar e sem deploy seguinte.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

**O push NAO entra aqui.** Push e deploy, e o classificador do modo automatico
barra `git push` tanto no Bash quanto no PowerShell (medido em 26/08/2026, duas
tentativas). Quem publica e o dono, digitando `!` no prompt vazio e depois
`git push origin main`.

Confirmar o deploy so DEPOIS que ele publicar:

```bash
curl -s https://flat-resonance-09ba.pitstopimports.workers.dev/app.js | grep -c fin_categoria_salvar
```

Esperado: maior que zero.

---

## Fechamento

- [ ] **Handoff v69** em `docs/handoffs/handoff_migracao_pitwall_v69.md`, registrando decisoes e nao so estado, e atualizando `docs/handoffs/handoff_indice_pitwall.md` e a linha do topo no `CLAUDE.md`.
- [ ] Conferir o piso da suite no `CLAUDE.md` (hoje diz 885) e atualizar para o numero medido.
- [ ] Sugerir ao dono arquivar a regra `uber` (minuscula, sem dominio, pausada, 27 aplicacoes no historico). Entulho que vai confundir daqui a dois meses.
