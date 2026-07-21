-- =====================================================================
-- Pit Wall 2.0 (Nucleo) — tabela de dados da Calculadora (pitstop-calc)
-- Caminho no repo: supabase/migrations/20260721_calc_dados.sql
--
-- Guarda os precos de fornecedor (dado comercial sensivel) ATRAS do login,
-- em vez do dados.js publico. A calc em /calc/ le esta tabela apos a sessao
-- do Supabase, protegida por RLS. Um JSONB por tenant, no mesmo formato que
-- o `DADOS` que a calc ja consome ({config, bateria, tela, produtos}).
--
-- Por que JSONB e nao tabela relacional: a calc espera um unico objeto DADOS.
-- Guardar o blob inteiro mantem o formato, o validador (validarDados) e o
-- fluxo de atualizacao (trocar o blob) sem reescrever nada da calc.
--
-- APLICAR NO Supabase Dashboard > SQL Editor (voce e dono do projeto).
-- =====================================================================

-- 1) Tabela ------------------------------------------------------------
create table if not exists public.calc_dados (
  tenant_id     uuid        not null default '00000000-0000-0000-0000-000000000001',
  dados         jsonb       not null,
  atualizado_em timestamptz not null default now(),
  primary key (tenant_id)
);

comment on table public.calc_dados is
  'Blob DADOS da calculadora (produtos/config/bateria/tela). Um por tenant. Lido pela pagina /calc/ apos login.';

-- 2) RLS (invariante 7: toda tabela de dado tem tenant_id + policy que o usa)
alter table public.calc_dados enable row level security;

-- Leitura: qualquer usuario autenticado do tenant ve a linha do proprio tenant.
-- Usa o helper de tenant que vive no schema `privado` (invariante 8).
drop policy if exists calc_dados_sel on public.calc_dados;
create policy calc_dados_sel
  on public.calc_dados
  for select
  to authenticated
  using (tenant_id = privado.fn_tenant_atual());

-- Privilegio minimo (invariante 9: nada de TRUNCATE; so o SELECT necessario).
-- A ESCRITA (atualizar precos) e feita aqui no Dashboard (service role, ignora RLS),
-- entao `authenticated` NAO recebe insert/update.
revoke all on public.calc_dados from authenticated;
grant select on public.calc_dados to authenticated;

-- =====================================================================
-- 3) SEED / ATUALIZACAO DE PRECOS  (rode sempre que a tabela mudar)
--
--   Cole o conteudo do seu produtos.json (o objeto {config,bateria,tela,produtos})
--   entre os marcadores $j$ ... $j$. Dollar-quoting evita ter que escapar aspas.
--   O upsert deixa este mesmo comando servir para semear E para atualizar depois.
-- =====================================================================
--
-- insert into public.calc_dados (tenant_id, dados) values (
--   '00000000-0000-0000-0000-000000000001',
--   $j$
--   {  ... COLE AQUI O produtos.json INTEIRO ...  }
--   $j$::jsonb
-- )
-- on conflict (tenant_id) do update
--   set dados = excluded.dados, atualizado_em = now();

-- =====================================================================
-- 4) VERIFICAR (rode como usuario logado, ou confira via app)
--
--   Se a calc mostrar "Tabela vazia?" mesmo com a linha inserida, o helper
--   privado.fn_tenant_atual() nao casou. Confirme o nome exato:
--     select proname, pronamespace::regnamespace
--       from pg_proc where proname ilike '%tenant%';
--   Se o nome/logica diferir, ajuste a policy calc_dados_sel acima.
--   Fallback provisorio (libera para QUALQUER autenticado, sem recorte de tenant):
--     drop policy if exists calc_dados_sel on public.calc_dados;
--     create policy calc_dados_sel on public.calc_dados
--       for select to authenticated using (true);
-- =====================================================================
