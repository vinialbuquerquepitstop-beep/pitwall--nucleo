-- =====================================================================
-- Pit Wall 2.0 (Nucleo) — Vitrine do parceiro DERIVADA do calc_dados
-- Caminho no repo: supabase/migrations/20260724_calc_parceiro_derivado.sql
--
-- Opcao B (decisao do dono, 24/07/2026): o parceiro ve SO preco de venda.
-- Nunca ve custo de fornecedor (v), nem o nome do fornecedor (f), nem a
-- praca (l), nem as margens (config). A avaliacao de usado do parceiro fica
-- para uma fatia futura.
--
-- Arquitetura (invariante 4: derivar na leitura, nunca armazenar copia):
-- o blob do parceiro NAO e uma segunda tabela que voce republica. E DERIVADO
-- do proprio calc_dados por uma funcao. Voce alimenta um lugar so (calc_dados)
-- e a vitrine do parceiro acompanha sozinha.
--
-- Venda replica a conta da calc (index.html, vCalc, frete zero):
--   custo   = menor v entre as cores, senao v do produto            (funcao cm)
--   margem  = MacBook -> config.mav/mpc ; resto -> config.iav/ipc    (funcao mg)
--   a vista       = custo + margem a vista
--   parcelado base= custo + margem parcelado
-- Os NUMEROS das margens continuam vivos so no config (invariante 11): a
-- funcao le config, nao carrega numero fixo. Se a margem muda no config, a
-- vitrine muda junto.
-- =====================================================================

-- 0) Papel novo: 'parceiro' passa a existir oficialmente ao lado de
--    'dono' e 'vendedor'. Sem isso, nenhum usuario pode ser marcado parceiro.
alter table public.app_usuario drop constraint if exists app_usuario_papel_check;
alter table public.app_usuario add constraint app_usuario_papel_check
  check (papel = any (array['dono'::text, 'vendedor'::text, 'parceiro'::text]));

-- 1) Endpoint do parceiro: retorna o blob reduzido, ja com venda calculada.
--    SECURITY DEFINER: le calc_dados mesmo quando o papel 'parceiro' esta
--    barrado na tabela crua (passo 2). Escopo preso ao tenant do chamador
--    via privado.fn_tenant_atual() (invariante 8): parceiro do tenant X
--    jamais alcanca o tenant Y.
create or replace function public.calc_dados_parceiro()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with src as (
    select dados, atualizado_em
    from public.calc_dados
    where tenant_id = privado.fn_tenant_atual()
    limit 1
  ),
  cfg as (
    select
      dados,
      atualizado_em,
      coalesce((dados->'config'->>'iav')::numeric, 0) as iav,
      coalesce((dados->'config'->>'ipc')::numeric, 0) as ipc,
      coalesce((dados->'config'->>'mav')::numeric, 0) as mav,
      coalesce((dados->'config'->>'mpc')::numeric, 0) as mpc
    from src
  ),
  prod as (
    select
      p,
      (p->>'c') as cat,
      coalesce(
        (select min((col->>'v')::numeric)
           from jsonb_array_elements(coalesce(p->'cs', '[]'::jsonb)) col
          where (col ? 'v')),
        (p->>'v')::numeric,
        0
      ) as custo
    from cfg, jsonb_array_elements(cfg.dados->'produtos') p
  )
  select jsonb_build_object(
    'produtos',
    coalesce(
      (select jsonb_agg(
         jsonb_build_object(
           'n',  prod.p->'n',
           'c',  prod.p->'c',
           't',  prod.p->'t',
           -- cores sem custo: mantem nome (n) e hex (h), remove o v
           'cs', (
             select coalesce(jsonb_agg(col - 'v'), '[]'::jsonb)
             from jsonb_array_elements(coalesce(prod.p->'cs', '[]'::jsonb)) col
           ),
           'av', round(prod.custo + (case when prod.cat = 'MacBook' then cfg.mav else cfg.iav end)),
           'pc', round(prod.custo + (case when prod.cat = 'MacBook' then cfg.mpc else cfg.ipc end))
         )
         order by prod.p->>'c', prod.p->>'n'
       )
       from prod, cfg),
      '[]'::jsonb
    ),
    'atualizado_em', (select atualizado_em from cfg)
  );
$$;

comment on function public.calc_dados_parceiro() is
  'Vitrine do parceiro (opcao B): produtos com preco de VENDA (av/pc) derivado de calc_dados. Sem custo, sem fornecedor, sem margens. Derivado na leitura, nunca armazenado.';

-- Privilegio minimo (invariante 9): so authenticated executa; anon nunca.
revoke all on function public.calc_dados_parceiro() from public;
revoke all on function public.calc_dados_parceiro() from anon;
grant execute on function public.calc_dados_parceiro() to authenticated;

-- 2) Aperta a RLS da tabela crua: o papel 'parceiro' NAO le calc_dados direto.
--    Ele so tem a funcao do passo 1. Interno/dono continuam lendo tudo.
--    (CREATE OR REPLACE FUNCTION nao mexe em policy; recriamos a policy
--    explicitamente para incluir o corte por papel.)
drop policy if exists calc_dados_sel on public.calc_dados;
create policy calc_dados_sel
  on public.calc_dados
  for select
  to authenticated
  using (
    tenant_id = privado.fn_tenant_atual()
    and coalesce(privado.fn_papel_atual(), '') <> 'parceiro'
  );
