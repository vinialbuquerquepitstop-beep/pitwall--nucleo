-- =====================================================================
-- Pit Wall 2.0 (Nucleo) — tabela de dados da Calculadora (pitstop-calc)
-- Caminho no repo: supabase/migrations/20260721_calc_dados.sql
--
-- Aplicada fora do ledger via SQL Editor em 21/07/2026. Reconstruida a partir
-- do estado real do banco em 28/08/2026. Corpo da policy alinhado com
-- 20260817233215. NAO reaplicar.
--
-- Guarda os precos de fornecedor (dado comercial sensivel) ATRAS do login,
-- em vez do dados.js publico. A calc em /calc/ le esta tabela apos a sessao
-- do Supabase, protegida por RLS. Um JSONB por tenant, no mesmo formato que
-- o `DADOS` que a calc ja consome ({config, bateria, tela, produtos}).
--
-- Por que JSONB e nao tabela relacional: a calc espera um unico objeto DADOS.
-- Guardar o blob inteiro mantem o formato, o validador (validarDados) e o
-- fluxo de atualizacao (trocar o blob) sem reescrever nada da calc.
-- =====================================================================

-- 1) Tabela ------------------------------------------------------------
create table if not exists public.calc_dados (
  tenant_id     uuid        not null default '00000000-0000-0000-0000-000000000001',
  dados         jsonb       not null,
  atualizado_em timestamptz not null default now(),
  primary key (tenant_id)
);

-- 2) RLS (invariante 7: toda tabela de dado tem tenant_id + policy que o usa)
alter table public.calc_dados enable row level security;

-- Leitura: SO o papel `dono` do proprio tenant. O recorte por papel entrou em
-- 20260817233215 (calc_dados_select_apenas_dono) porque a tabela carrega custo
-- de fornecedor, e vendedor nunca ve custo (decisao do dono, 17/08/2026).
-- Usa os helpers que vivem no schema `privado` (invariante 8).
drop policy if exists calc_dados_sel on public.calc_dados;
create policy calc_dados_sel
  on public.calc_dados
  for select
  to authenticated
  using (
    tenant_id = privado.fn_tenant_atual()
    and privado.fn_papel_atual() = 'dono'
  );

-- Privilegio minimo (invariante 9: nada de TRUNCATE; so o SELECT necessario).
-- A ESCRITA (atualizar precos) e feita por service role, que ignora RLS,
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
