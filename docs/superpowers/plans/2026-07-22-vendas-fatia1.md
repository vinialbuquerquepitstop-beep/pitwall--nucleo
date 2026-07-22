# Aba Vendas — Fatia 1 (registro de venda) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar e listar uma venda no Pit Wall: nova tabela `venda` (com catalogo de iPhones), e a aba Vendas com formulario de cadastro e lista.

**Architecture:** Backend Postgres/Supabase no padrao do Nucleo (tenant_id + RLS + auditoria append-only por trigger; escrita via RPC transacional; leitura via view com lucro derivado). Frontend no trio `public/` (index.html + app.css + app.js), com o JS minificado alterado por script de patch com ancora de texto.

**Tech Stack:** Supabase (Postgres, RLS, PostgREST, RPC), MCP Supabase (`apply_migration`, `execute_sql`), supabase-js no cliente, vanilla JS, Chrome headless + esprima para prova de frontend (`ferramentas/harness.py`, `ferramentas/validar.py`).

## Global Constraints

- Supabase project ID: `unjzpyexgtbcmjfgcqrx`. Tenant ID: `00000000-0000-0000-0000-000000000001`. Auth UID dono: `fb2aad8e-b728-4e59-a198-71da2156449d`.
- Toda tabela de dado tem `tenant_id` e policy de RLS que o usa (invariante 7).
- Helpers de RLS vivem em `privado` (`privado.fn_tenant_atual()`, `privado.fn_papel_atual()`), nunca em `public`.
- `authenticated` nunca recebe TRUNCATE. `anon` sem EXECUTE em funcao de negocio.
- Lucro NAO e coluna: derivado na leitura (`valor_venda - custo_aparelho - despesa_frete - despesa_taxas`).
- `CREATE OR REPLACE VIEW` derruba `security_invoker=on`: seguir com `ALTER VIEW ... SET (security_invoker=on)` e conferir em `pg_class.reloptions`. `CREATE OR REPLACE FUNCTION` reseta ACL: refazer REVOKE/GRANT.
- MCP: `apply_migration` para schema/insert em massa (transacional, aguenta acento). `execute_sql` so retorna o ultimo statement: cada verificacao e uma chamada separada, ou empacotar num `json_build_object`.
- `app.css`/`app.js` sao servidos minificados (uma linha). `index.html` e legivel. Frontend entra por patch com ancora que ABORTA se a ancora nao aparecer exatamente 1x. Ancorar na forma completa (`async function X(`).
- Prosa e copy de tela em portugues do Brasil com acentuacao correta (`Conteúdo`, `Pré-venda`, `Concluída`). Codigo de status/perfil e snake_case sem acento.
- Push em `main` e deploy (Cloudflare). Nao pushar sem o dono pedir.

**Pre-flight (rodar uma vez antes da Task 1, com o MCP Supabase ligado):**
Descobrir os nomes reais que o plano assume. Cada um e uma chamada `execute_sql` separada:
- Nome da funcao de trigger de auditoria generica: `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname ilike '%auditoria%';`
- Assinatura dos helpers: `select proname, pronamespace::regnamespace from pg_proc where proname in ('fn_tenant_atual','fn_papel_atual');`
- Como o `lead_code` e gerado (para copiar o padrao no `venda_code`): `select pg_get_functiondef(oid) from pg_proc where proname ilike '%lead_code%';` (se nao houver funcao, o code e gerado no insert do ETL; ver Task 3).
Anotar os nomes reais; onde este plano usar `privado.fn_auditoria()` como nome, trocar pelo real.

---

### Task 1: Tabela `catalogo_iphone` (lista fechada de modelos)

**Files:**
- Create: `supabase/migrations/20260722_catalogo_iphone.sql`

**Interfaces:**
- Produces: tabela `public.catalogo_iphone(id uuid, tenant_id uuid, rotulo text, ativo bool, ordem int)`; usada pela FK `venda.modelo_id` (Task 2) e pelo dropdown do form (Task 8).

- [ ] **Step 1: Escrever a migration da tabela + RLS + seed**

Arquivo `supabase/migrations/20260722_catalogo_iphone.sql`:
```sql
create table public.catalogo_iphone (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  rotulo text not null,
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.catalogo_iphone enable row level security;

create policy catalogo_iphone_sel on public.catalogo_iphone
  for select using (tenant_id = privado.fn_tenant_atual());
create policy catalogo_iphone_ins on public.catalogo_iphone
  for insert with check (tenant_id = privado.fn_tenant_atual());
create policy catalogo_iphone_upd on public.catalogo_iphone
  for update using (tenant_id = privado.fn_tenant_atual())
  with check (tenant_id = privado.fn_tenant_atual());

grant select, insert, update on public.catalogo_iphone to authenticated;

insert into public.catalogo_iphone (tenant_id, rotulo, ordem) values
  ('00000000-0000-0000-0000-000000000001','iPhone 11',10),
  ('00000000-0000-0000-0000-000000000001','iPhone 12',20),
  ('00000000-0000-0000-0000-000000000001','iPhone 13',30),
  ('00000000-0000-0000-0000-000000000001','iPhone 14',40),
  ('00000000-0000-0000-0000-000000000001','iPhone 15',50),
  ('00000000-0000-0000-0000-000000000001','iPhone 16',60);
```
(O dono revisa/estende a lista de modelos depois; a tabela existe pra isso.)

- [ ] **Step 2: Aplicar via MCP**

Aplicar o arquivo com `apply_migration` (name: `catalogo_iphone`, query: conteudo do arquivo).
Expected: sucesso, sem erro.

- [ ] **Step 3: Provar o seed e o RLS ligado (chamada unica)**

`execute_sql`:
```sql
select json_build_object(
  'linhas', (select count(*) from public.catalogo_iphone),
  'rls', (select relrowsecurity from pg_class where oid='public.catalogo_iphone'::regclass)
);
```
Expected: `{"linhas":6,"rls":true}`.

- [ ] **Step 4: Provar isolamento por tenant (tenant errado ve 0)**

`execute_sql` (simula sessao autenticada de outro tenant):
```sql
select set_config('request.jwt.claims', json_build_object('sub','fb2aad8e-b728-4e59-a198-71da2156449d','app_metadata', json_build_object('tenant_id','99999999-9999-9999-9999-999999999999'))::text, true);
set role authenticated;
select count(*) as visiveis_para_tenant_errado from public.catalogo_iphone;
reset role;
```
Expected: `visiveis_para_tenant_errado = 0`. Se vier 6, a policy nao fecha: PARAR e corrigir.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260722_catalogo_iphone.sql
git commit -m "feat(vendas): tabela catalogo_iphone com RLS e seed de modelos"
```

---

### Task 2: Tabela `venda`

**Files:**
- Create: `supabase/migrations/20260722_venda_tabela.sql`

**Interfaces:**
- Consumes: `catalogo_iphone(id)` (Task 1), `lead(id)`, `app_usuario(id)`, `tenant(id)`.
- Produces: tabela `public.venda` com todas as colunas do spec secao 5.1. Consumida pela RPC (Task 4), pela view (Task 5) e pelo trigger de auditoria (Task 3).

- [ ] **Step 1: Escrever a migration da tabela + RLS**

Arquivo `supabase/migrations/20260722_venda_tabela.sql`:
```sql
create table public.venda (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  venda_code text,
  lead_id uuid references public.lead(id),

  comprador_nome text,
  comprador_whatsapp text,
  comprador_cpf text,
  comprador_nascimento date,
  comprador_instagram text,

  modelo_id uuid references public.catalogo_iphone(id),
  capacidade text,
  cor text,
  condicao text check (condicao in ('lacrado','vitrine','seminovo')),
  imei text,

  fornecedor_nome text,
  fornecedor_contato text,
  fornecedor_local_retirada text,
  fornecedor_pix_url text,

  valor_venda numeric not null,
  custo_aparelho numeric,
  despesa_frete numeric,
  despesa_taxas numeric,

  tem_trade_in boolean not null default false,
  entrada_modelo text,
  entrada_imei text,
  entrada_valor numeric,

  nf_numero text,
  nf_url text,

  status text not null default 'concluida' check (status in ('pre_venda','concluida','cancelada')),
  endereco_entrega text,
  valor_a_cobrar numeric,

  motoboy text,
  forma_pagamento text check (forma_pagamento in ('pix','dinheiro','cartao','misto')),
  data_venda date,
  observacoes text,

  criado_por uuid references public.app_usuario(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz,
  arquivado_em timestamptz
);
alter table public.venda enable row level security;

create policy venda_sel on public.venda
  for select using (tenant_id = privado.fn_tenant_atual());
create policy venda_ins on public.venda
  for insert with check (tenant_id = privado.fn_tenant_atual());
create policy venda_upd on public.venda
  for update using (tenant_id = privado.fn_tenant_atual())
  with check (tenant_id = privado.fn_tenant_atual());

grant select, insert, update on public.venda to authenticated;

create index venda_tenant_idx on public.venda(tenant_id);
create index venda_lead_idx on public.venda(lead_id) where lead_id is not null;
```

- [ ] **Step 2: Aplicar via MCP**

`apply_migration` (name: `venda_tabela`). Expected: sucesso.

- [ ] **Step 3: Provar estrutura e RLS (chamada unica)**

`execute_sql`:
```sql
select json_build_object(
  'colunas', (select count(*) from information_schema.columns where table_name='venda'),
  'rls', (select relrowsecurity from pg_class where oid='public.venda'::regclass),
  'policies', (select count(*) from pg_policies where tablename='venda')
);
```
Expected: `rls=true`, `policies=3`, `colunas` = 38.

- [ ] **Step 4: Provar isolamento (dono ve, tenant errado nao ve)**

Inserir uma linha como dono, depois ler como tenant errado:
```sql
insert into public.venda (tenant_id, valor_venda, status)
  values ('00000000-0000-0000-0000-000000000001', 1000, 'concluida');
select set_config('request.jwt.claims', json_build_object('sub','fb2aad8e-b728-4e59-a198-71da2156449d','app_metadata', json_build_object('tenant_id','99999999-9999-9999-9999-999999999999'))::text, true);
set role authenticated;
select count(*) as venda_vista_por_tenant_errado from public.venda;
reset role;
delete from public.venda where venda_code is null and valor_venda = 1000;
```
Expected: `venda_vista_por_tenant_errado = 0`. Limpa a linha de teste no fim.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260722_venda_tabela.sql
git commit -m "feat(vendas): tabela venda com RLS e isolamento provado"
```

---

### Task 3: `venda_code` sequencial + auditoria append-only

**Files:**
- Create: `supabase/migrations/20260722_venda_code_auditoria.sql`

**Interfaces:**
- Consumes: tabela `venda` (Task 2); funcao de auditoria generica (nome real vindo do pre-flight; aqui `privado.fn_auditoria()`).
- Produces: trigger BEFORE INSERT que preenche `venda_code` (`VENDA-0001`, sequencial por tenant); trigger de auditoria em `venda`.

- [ ] **Step 1: Escrever a migration dos triggers**

Arquivo `supabase/migrations/20260722_venda_code_auditoria.sql` (trocar `privado.fn_auditoria` pelo nome real do pre-flight):
```sql
create or replace function privado.fn_venda_code() returns trigger
language plpgsql security definer set search_path = public, privado as $$
declare n int;
begin
  if new.venda_code is null then
    select coalesce(max((regexp_replace(venda_code,'\D','','g'))::int),0)+1
      into n from public.venda where tenant_id = new.tenant_id;
    new.venda_code := 'VENDA-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$;

create trigger venda_code_bi before insert on public.venda
  for each row execute function privado.fn_venda_code();

create trigger venda_auditoria after insert or update or delete on public.venda
  for each row execute function privado.fn_auditoria();
```

- [ ] **Step 2: Aplicar via MCP**

`apply_migration` (name: `venda_code_auditoria`). Expected: sucesso.

- [ ] **Step 3: Provar o code sequencial e a auditoria (uma escrita = um registro)**

```sql
insert into public.venda (tenant_id, valor_venda) values ('00000000-0000-0000-0000-000000000001', 500) returning venda_code;
```
Expected: retorna `VENDA-0001` (ou o proximo numero livre).
Depois, chamada separada:
```sql
select json_build_object(
  'code_ok', (select venda_code from public.venda where valor_venda=500 order by criado_em desc limit 1),
  'auditoria_gerada', (select count(*) from public.auditoria where tabela='venda' and acao='INSERT')
);
```
Expected: `code_ok` casa `^VENDA-\d{4}$`; `auditoria_gerada >= 1`. Limpar depois:
```sql
delete from public.venda where valor_venda = 500;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260722_venda_code_auditoria.sql
git commit -m "feat(vendas): venda_code sequencial e auditoria append-only"
```

---

### Task 4: RPC `registrar_venda`

**Files:**
- Create: `supabase/migrations/20260722_registrar_venda_rpc.sql`

**Interfaces:**
- Consumes: tabela `venda` (Task 2), triggers (Task 3).
- Produces: `public.registrar_venda(payload jsonb) returns jsonb` (retorna `{ok, id, venda_code}`), chamada pelo front (Task 9) via `t.rpc('registrar_venda',{payload})`.

- [ ] **Step 1: Escrever a RPC**

Arquivo `supabase/migrations/20260722_registrar_venda_rpc.sql`:
```sql
create or replace function public.registrar_venda(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, privado as $$
declare v_id uuid; v_code text; v_tenant uuid := privado.fn_tenant_atual();
begin
  if coalesce((payload->>'valor_venda')::numeric, 0) <= 0 then
    return jsonb_build_object('ok', false, 'erro', 'valor_venda obrigatorio');
  end if;
  if payload->>'modelo_id' is null then
    return jsonb_build_object('ok', false, 'erro', 'modelo obrigatorio');
  end if;
  insert into public.venda (
    tenant_id, lead_id, comprador_nome, comprador_whatsapp, comprador_cpf,
    comprador_nascimento, comprador_instagram, modelo_id, capacidade, cor, condicao, imei,
    fornecedor_nome, fornecedor_contato, fornecedor_local_retirada,
    valor_venda, custo_aparelho, despesa_frete, despesa_taxas,
    tem_trade_in, entrada_modelo, entrada_imei, entrada_valor,
    nf_numero, status, endereco_entrega, valor_a_cobrar,
    motoboy, forma_pagamento, data_venda, observacoes, criado_por
  ) values (
    v_tenant,
    nullif(payload->>'lead_id','')::uuid, payload->>'comprador_nome', payload->>'comprador_whatsapp',
    payload->>'comprador_cpf', nullif(payload->>'comprador_nascimento','')::date, payload->>'comprador_instagram',
    nullif(payload->>'modelo_id','')::uuid, payload->>'capacidade', payload->>'cor', payload->>'condicao', payload->>'imei',
    payload->>'fornecedor_nome', payload->>'fornecedor_contato', payload->>'fornecedor_local_retirada',
    (payload->>'valor_venda')::numeric, nullif(payload->>'custo_aparelho','')::numeric,
    nullif(payload->>'despesa_frete','')::numeric, nullif(payload->>'despesa_taxas','')::numeric,
    coalesce((payload->>'tem_trade_in')::boolean,false), payload->>'entrada_modelo', payload->>'entrada_imei',
    nullif(payload->>'entrada_valor','')::numeric,
    payload->>'nf_numero', coalesce(nullif(payload->>'status',''),'concluida'),
    payload->>'endereco_entrega', nullif(payload->>'valor_a_cobrar','')::numeric,
    payload->>'motoboy', nullif(payload->>'forma_pagamento',''), nullif(payload->>'data_venda','')::date,
    payload->>'observacoes', auth.uid()
  ) returning id, venda_code into v_id, v_code;
  return jsonb_build_object('ok', true, 'id', v_id, 'venda_code', v_code);
end $$;

revoke all on function public.registrar_venda(jsonb) from public, anon;
grant execute on function public.registrar_venda(jsonb) to authenticated;
```

- [ ] **Step 2: Aplicar via MCP**

`apply_migration` (name: `registrar_venda_rpc`). Expected: sucesso.

- [ ] **Step 3: Provar a RPC como usuario autenticado (dono)**

```sql
select set_config('request.jwt.claims', json_build_object('sub','fb2aad8e-b728-4e59-a198-71da2156449d','app_metadata', json_build_object('tenant_id','00000000-0000-0000-0000-000000000001'))::text, true);
set role authenticated;
select public.registrar_venda(jsonb_build_object(
  'valor_venda','3200','modelo_id',(select id::text from public.catalogo_iphone where rotulo='iPhone 13' limit 1),
  'capacidade','128GB','cor','Meia-noite','condicao','seminovo','imei','355000000000001'
)) as r;
reset role;
```
Expected: `r` = `{"ok":true,"id":"...","venda_code":"VENDA-0001"}`.

- [ ] **Step 4: Provar rejeicao de payload invalido**

```sql
set role authenticated;
select public.registrar_venda(jsonb_build_object('valor_venda','0')) as r;
reset role;
```
Expected: `{"ok":false,"erro":"valor_venda obrigatorio"}`.
Limpar as vendas de teste:
```sql
delete from public.venda where imei = '355000000000001';
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260722_registrar_venda_rpc.sql
git commit -m "feat(vendas): RPC registrar_venda com validacao minima"
```

---

### Task 5: View de leitura `v_venda` (lucro derivado)

**Files:**
- Create: `supabase/migrations/20260722_v_venda.sql`

**Interfaces:**
- Consumes: `venda` (Task 2), `catalogo_iphone` (Task 1), `lead`.
- Produces: view `public.v_venda` com `lucro` derivado e `modelo_rotulo`/`cliente_nome` resolvidos. Consumida pelo front (Task 7) via `t.from('v_venda').select('*')`.

- [ ] **Step 1: Escrever a view**

Arquivo `supabase/migrations/20260722_v_venda.sql`:
```sql
create or replace view public.v_venda as
select v.*,
  coalesce(v.valor_venda,0) - coalesce(v.custo_aparelho,0)
    - coalesce(v.despesa_frete,0) - coalesce(v.despesa_taxas,0) as lucro,
  c.rotulo as modelo_rotulo,
  coalesce(l.nome, v.comprador_nome) as cliente_nome
from public.venda v
left join public.catalogo_iphone c on c.id = v.modelo_id
left join public.lead l on l.id = v.lead_id
where v.arquivado_em is null;

alter view public.v_venda set (security_invoker = on);
grant select on public.v_venda to authenticated;
```

- [ ] **Step 2: Aplicar via MCP**

`apply_migration` (name: `v_venda`). Expected: sucesso.

- [ ] **Step 3: Provar `security_invoker` e o lucro derivado**

```sql
select json_build_object(
  'invoker', (select reloptions from pg_class where oid='public.v_venda'::regclass),
  'lucro_calcula', (
    select lucro from public.v_venda limit 1
  )
);
```
Expected: `invoker` contem `security_invoker=on`. (Se nao houver venda, `lucro_calcula` vem null; ok.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260722_v_venda.sql
git commit -m "feat(vendas): view v_venda com lucro derivado e security_invoker"
```

---

### Task 6: Aba Vendas na navegacao e roteamento

**Files:**
- Modify: `public/index.html` (barra de abas)
- Modify: `public/app.js` (via patch: roteador de view `k()`)
- Modify: `ferramentas/harness.py` (assercao da nova aba)

**Interfaces:**
- Produces: view `vendas` roteavel; titulo `Vendas`; `blocoBusca` visivel em `vendas`. Consumida pelas Tasks 7-9.

- [ ] **Step 1: Adicionar o botao da aba no index.html**

Em `public/index.html`, logo apos o botao `abaTodos` (bloco `id="abaTodos"`), inserir:
```html
      <button class="aba" id="abaVendas" role="tab" aria-selected="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16l-1.2 11a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 7z" stroke-linejoin="round"/><path d="M8.5 7a3.5 3.5 0 0 1 7 0" stroke-linecap="round"/></svg>
        <span class="aba-txt">Vendas</span>
      </button>
```

- [ ] **Step 2: Localizar as ancoras exatas no app.js minificado**

Rodar, da raiz, para confirmar que cada ancora aparece 1x:
```bash
node -e 'const s=require("fs").readFileSync("public/app.js","utf8");["\"todos\"===n?\"Todos\"","E(\"abaTodos\").setAttribute","\"todos\"===n||\"clientes\"===n?\" visivel\""].forEach(a=>console.log((s.split(a).length-1)+"  "+a))'
```
Expected: cada linha comeca com `1`. Se alguma vier `0` ou `>1`, PARAR e reancorar.

- [ ] **Step 3: Escrever o patch `ferramentas/patch_vendas.py`**

No molde de `ferramentas/patch_hierarquia.py`. Ele faz 3 substituicoes de ancora, cada uma abortando se a ancora nao aparecer exatamente 1x:
1. Titulo: ancora `"todos"===n?"Todos":` -> prefixar `"vendas"===n?"Vendas":`.
2. aria-selected: ancora `E("abaTodos").setAttribute("aria-selected","todos"===n?"true":"false"),` -> acrescentar depois `E("abaVendas")&&E("abaVendas").setAttribute("aria-selected","vendas"===n?"true":"false"),`.
3. Busca visivel: ancora `"todos"===n||"clientes"===n?" visivel"` -> trocar por `"todos"===n||"clientes"===n||"vendas"===n?" visivel"`.
O bind do clique da aba segue o padrao das outras (procurar como `abaTodos` e ligado a `troca`/`irPara` e replicar para `abaVendas` no mesmo ponto; a Task inclui essa 4a ancora apos inspecao no Step 2).

- [ ] **Step 4: Rodar o patch e validar sintaxe**

```bash
python ferramentas/patch_vendas.py && python ferramentas/validar.py; echo "EXIT: $?"
```
Expected: patch aplica as 4 ancoras; `validar.py` termina com `EXIT: 0`. Conferir o EXIT CODE, nunca o texto.

- [ ] **Step 5: Assercao de comportamento no harness**

Em `ferramentas/harness.py`, adicionar assercao: clicar `abaVendas` seleciona a view `vendas`, `topoTit` vira `Vendas`, `blocoBusca` fica visivel. Rodar:
```bash
python ferramentas/harness.py; echo "EXIT: $?"
```
Expected: `EXIT: 0`, contagem de assercoes subiu, 0 falhas.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/app.js ferramentas/patch_vendas.py ferramentas/harness.py
git commit -m "feat(vendas): aba Vendas na navegacao e roteamento de view"
```

---

### Task 7: Carregar e listar vendas (leitura)

**Files:**
- Modify: `public/app.js` (via `patch_vendas.py`: adicionar `carregarVendas`, `fxVenda`, `renderVendas`; ligar no roteador)
- Modify: `ferramentas/harness.py` (stub de `v_venda` + assercao da lista e do estado vazio)

**Interfaces:**
- Consumes: view `v_venda` (Task 5); `t` (client supabase-js), `E`, `c` (escape), helpers ja no IIFE.
- Produces: `vendasData` (array), `renderVendas(lista, ancora)`; consumidas pela Task 9 (refresh apos salvar).

- [ ] **Step 1: Assercao primeiro no harness (estado vazio e um card)**

Em `harness.py`, com um stub de `v_venda` de 1 venda, assertar: a view `vendas` renderiza 1 `.card` com o `venda_code` e o `lucro` formatado; com stub vazio, renderiza o texto do estado vazio "Nenhuma venda ainda". Rodar e ver FALHAR (funcao ainda nao existe):
```bash
python ferramentas/harness.py; echo "EXIT: $?"
```
Expected: `EXIT: 1` (a assercao nova falha).

- [ ] **Step 2: Escrever as funcoes (inseridas pelo patch dentro do IIFE, ancora `var scriptsData={};`)**

```javascript
var vendasData=[];
function fxVenda(v){
  var brl=function(n){return "R$ "+Number(n||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});};
  var chips='<span class="cli-seg">'+c(v.status)+'</span>';
  if(v.tem_trade_in)chips+='<span class="cli-seg">trade-in</span>';
  return '<div class="card-cliente">'+chips+'</div>'+
    '<div class="venda-vals"><span class="v-venda">'+brl(v.valor_venda)+'</span>'+
    '<span class="v-lucro'+(Number(v.lucro)>=0?'':' neg')+'">lucro '+brl(v.lucro)+'</span></div>';
}
function cardVenda(v){
  return '<div class="card"><div class="card-top"><span class="card-code">'+c(v.venda_code||"")+'</span>'+
    '<span class="card-prod">'+c(v.modelo_rotulo||"")+(v.capacidade?' '+c(v.capacidade):'')+(v.cor?' '+c(v.cor):'')+'</span></div>'+
    '<div class="card-sub">'+c(v.cliente_nome||"sem cliente")+(v.data_venda?' · '+c(v.data_venda):'')+(v.imei?' · IMEI '+c(v.imei):'')+'</div>'+
    fxVenda(v)+'</div>';
}
function renderVendas(lista,ancora){
  ancora.innerHTML = lista.length
    ? lista.map(cardVenda).join("")
    : '<div class="estado"><strong>Nenhuma venda ainda.</strong><br>Toque em Nova venda pra registrar a primeira.</div>';
}
async function carregarVendas(){
  var r=await t.from("v_venda").select("*").order("criado_em",{ascending:false});
  vendasData = (r&&r.data)||[];
}
```

- [ ] **Step 3: Ligar no roteador**

No patch, na cadeia de views de `k()` (ancora do ramo `else if("clientes"===n)...`), acrescentar o ramo:
```javascript
else if("vendas"===n){ renderVendas(g(vendasData, E("inputBusca").value), E("lista")); }
```
E garantir que `carregarVendas()` roda no boot junto com o carregamento de leads (ancora do `await t.from("v_lead")`), para `vendasData` existir antes do primeiro render.

- [ ] **Step 4: Rodar patch, validar e testar**

```bash
python ferramentas/patch_vendas.py && python ferramentas/validar.py && python ferramentas/harness.py; echo "EXIT: $?"
```
Expected: `EXIT: 0`, a assercao do Step 1 agora passa.

- [ ] **Step 5: CSS dos elementos novos**

Em `public/app.css`, adicionar (arquivo e legivel; append no bloco de cards):
```css
.venda-vals{display:flex;justify-content:space-between;margin-top:7px;font-family:var(--mono);font-size:13px}
.v-lucro{color:var(--ok)} .v-lucro.neg{color:var(--erro)}
```

- [ ] **Step 6: Commit**

```bash
git add public/app.js public/app.css ferramentas/patch_vendas.py ferramentas/harness.py
git commit -m "feat(vendas): lista de vendas lendo v_venda com estado vazio"
```

---

### Task 8: Formulario Nova venda (markup e lucro ao vivo)

**Files:**
- Modify: `public/index.html` (painel do form, no molde do editor de lead existente)
- Modify: `public/app.js` (via patch: abrir/fechar o painel, popular dropdown do catalogo, recalcular lucro ao vivo)
- Modify: `public/app.css` (estilo do painel, se necessario)
- Modify: `ferramentas/harness.py` (assercao: lucro ao vivo)

**Interfaces:**
- Consumes: `catalogo_iphone` via `t.from('catalogo_iphone')`; botao `+ Nova venda` na Task 7 (adicionar no cabecalho da view vendas).
- Produces: painel `#formVenda` com campos nomeados (`fvValorVenda`, `fvCusto`, `fvFrete`, `fvTaxas`, `fvModelo`, ...); `#fvLucro` atualizado ao vivo; consumidos pela Task 9 (submit).

- [ ] **Step 1: Markup do painel no index.html**

Adicionar um `<div id="formVenda" class="painel" hidden>` com os blocos do spec 9.2 (Cliente, Aparelho, Fornecedor, Dinheiro com `#fvLucro`, Trade-in com toggle, Entrega, Fechamento, Anexos desabilitados). Campos com ids `fv*`. (Estrutura completa segue o painel de edicao de lead ja presente no index.html; replicar as classes.)

- [ ] **Step 2: Assercao do lucro ao vivo (harness), ver falhar**

Em `harness.py`: preencher `fvValorVenda=3200`, `fvCusto=2600`, `fvFrete=30`, `fvTaxas=30`, disparar o recalculo, assertar `#fvLucro` textContent contem `540,00`. Rodar: Expected `EXIT: 1`.

- [ ] **Step 3: Logica no app.js (via patch)**

```javascript
function calcLucro(){
  var num=function(id){var x=parseFloat((E(id).value||"").replace(",","."));return isNaN(x)?0:x;};
  var lu=num("fvValorVenda")-num("fvCusto")-num("fvFrete")-num("fvTaxas");
  E("fvLucro").textContent="lucro R$ "+lu.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
}
async function abrirFormVenda(){
  var r=await t.from("catalogo_iphone").select("id,rotulo").eq("ativo",true).order("ordem");
  var opts='<option value="">modelo…</option>'+((r&&r.data)||[]).map(function(m){return '<option value="'+m.id+'">'+c(m.rotulo)+'</option>';}).join("");
  E("fvModelo").innerHTML=opts; calcLucro(); E("formVenda").hidden=false;
}
function fecharFormVenda(){ E("formVenda").hidden=true; }
```
Ligar: botao `+ Nova venda` -> `abrirFormVenda`; inputs de dinheiro -> `calcLucro` no `input`; toggle trade-in revela/esconde o bloco de entrada.

- [ ] **Step 4: Rodar patch, validar, testar**

```bash
python ferramentas/patch_vendas.py && python ferramentas/validar.py && python ferramentas/harness.py; echo "EXIT: $?"
```
Expected: `EXIT: 0`, assercao do lucro passa.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/app.js public/app.css ferramentas/patch_vendas.py ferramentas/harness.py
git commit -m "feat(vendas): formulario Nova venda com catalogo e lucro ao vivo"
```

---

### Task 9: Salvar a venda (submit -> RPC -> refresh)

**Files:**
- Modify: `public/app.js` (via patch: `salvarVenda`)
- Modify: `ferramentas/harness.py` (assercao: submit chama a RPC com o payload certo, via stub de `t.rpc`)

**Interfaces:**
- Consumes: `registrar_venda` (Task 4) via `t.rpc`; `#formVenda` (Task 8); `carregarVendas`/`renderVendas` (Task 7); `I()` (toast, ja existe).
- Produces: fluxo completo — cadastra e a venda aparece na lista.

- [ ] **Step 1: Assercao do submit (harness), ver falhar**

Em `harness.py`, com `t.rpc` stubado retornando `{ok:true,venda_code:"VENDA-0007"}`: preencher o form, clicar salvar, assertar que `t.rpc` recebeu `registrar_venda` com `valor_venda` e `modelo_id` no payload, que o toast mostrou o `venda_code`, e que o form fechou. Rodar: Expected `EXIT: 1`.

- [ ] **Step 2: Implementar `salvarVenda` (via patch)**

```javascript
async function salvarVenda(){
  var val=function(id){return E(id)?E(id).value:"";};
  var payload={
    valor_venda:val("fvValorVenda"), modelo_id:val("fvModelo"), capacidade:val("fvCapacidade"),
    cor:val("fvCor"), condicao:val("fvCondicao"), imei:val("fvImei"), lead_id:val("fvLeadId"),
    comprador_nome:val("fvNome"), comprador_whatsapp:val("fvWhats"), comprador_cpf:val("fvCpf"),
    comprador_nascimento:val("fvNasc"), comprador_instagram:val("fvInsta"),
    fornecedor_nome:val("fvFornNome"), fornecedor_contato:val("fvFornContato"),
    fornecedor_local_retirada:val("fvFornLocal"),
    custo_aparelho:val("fvCusto"), despesa_frete:val("fvFrete"), despesa_taxas:val("fvTaxas"),
    tem_trade_in:E("fvTradeIn")&&E("fvTradeIn").checked, entrada_modelo:val("fvEntModelo"),
    entrada_imei:val("fvEntImei"), entrada_valor:val("fvEntValor"),
    nf_numero:val("fvNfNum"), status:val("fvStatus"), endereco_entrega:val("fvEndereco"),
    valor_a_cobrar:val("fvCobrar"), motoboy:val("fvMotoboy"), forma_pagamento:val("fvPgto"),
    data_venda:val("fvData"), observacoes:val("fvObs")
  };
  var r=await t.rpc("registrar_venda",{payload:payload});
  var d=r&&r.data;
  if(d&&d.ok){ I("Venda "+d.venda_code+" registrada"); fecharFormVenda(); await carregarVendas(); k(); }
  else { I((d&&d.erro)||"Falha ao salvar",true); }
}
```
Ligar o botao Salvar do form -> `salvarVenda`.

- [ ] **Step 3: Rodar patch, validar, testar**

```bash
python ferramentas/patch_vendas.py && python ferramentas/validar.py && python ferramentas/harness.py; echo "EXIT: $?"
```
Expected: `EXIT: 0`.

- [ ] **Step 4: Prova de ponta a ponta com o banco (MCP ligado)**

Com o app servido localmente (ou apos deploy de teste), cadastrar uma venda real pelo form e conferir no banco:
```sql
select venda_code, valor_venda, status from public.venda order by criado_em desc limit 1;
select count(*) from public.auditoria where tabela='venda' and acao='INSERT';
```
Expected: a venda cadastrada aparece; a auditoria registrou o INSERT.

- [ ] **Step 5: Commit**

```bash
git add public/app.js ferramentas/patch_vendas.py ferramentas/harness.py
git commit -m "feat(vendas): salvar venda via registrar_venda e refletir na lista"
```

---

## Self-Review

**Spec coverage (fatia 1 do spec):**
- Tabela `venda` com todos os campos do 5.1 → Task 2 (inclui status/endereco_entrega/valor_a_cobrar da 7.5, que nascem na fatia 1). OK.
- `catalogo_iphone` semeado → Task 1. OK.
- RLS + isolamento provado (dono/tenant errado) → Tasks 1, 2. Falta prova explicita como `vendedor`: adicionar no Step 4 da Task 2 uma terceira simulacao com papel vendedor do mesmo tenant (deve VER). Anotado como ajuste na execucao.
- Auditoria append-only → Task 3. OK.
- Lucro derivado → Task 5 (view) e Task 8 (ao vivo no form). OK.
- Aba Vendas: form + lista → Tasks 6-9. OK.
- Anexos nascem vazios / promocao a comprou fora da fatia 1 → nao ha task de Storage nem de regua aqui. Correto (fatias 3 e 4).
- Agregacao no `v_lead` (faixa da aba Clientes) → é a fatia 2, fora deste plano. Correto.

**Placeholder scan:** os pontos "seguir o padrao do editor de lead" (Task 8 Step 1) e "replicar o bind de abaTodos" (Task 6 Step 3) dependem de inspecao do codigo em execucao; nao sao placeholders de logica, sao referencias a padrao existente que o executor tem a mao. Aceitavel.

**Type consistency:** `registrar_venda(payload jsonb)` chamado como `t.rpc("registrar_venda",{payload})` (Task 9) casa a assinatura da Task 4. `v_venda` colunas (`lucro`, `modelo_rotulo`, `cliente_nome`, `venda_code`) usadas na Task 7 casam a Task 5. `vendasData`/`renderVendas`/`carregarVendas` consistentes entre Tasks 7 e 9.

**Dependencia externa:** Tasks 1-5 e a prova E2E da Task 9 exigem o conector Supabase autorizado (MCP). Tasks 6-8 rodam so com o trio local + Python/Chrome. O pre-flight tem que rodar antes da Task 1 para fixar o nome real da funcao de auditoria e do gerador de code.
