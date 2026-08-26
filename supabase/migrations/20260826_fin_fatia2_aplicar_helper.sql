-- migration aplicada: 20260826132648_fin_fatia2_aplicar_helper
-- Motor unico de aplicacao de regras. Usado por fin_regra_aplicar E por
-- fin_importar_extrato: uma implementacao so, para as duas nao divergirem.
-- SECURITY INVOKER: a RLS do dono continua valendo dentro dele.
create or replace function privado.fn_fin_aplicar_regras(
  p_tenant     uuid,
  p_regra_ids  uuid[],
  p_mov_ids    uuid[],
  p_alcance    text
) returns jsonb
language plpgsql
set search_path to 'public','privado'
as $$
declare
  v_todos    boolean := (p_alcance = 'todos');
  v_class    int := 0;
  v_conf     int := 0;
  v_porregra jsonb := '[]'::jsonb;
begin
  with par as materialized (
    select
      m.id                                      as mov_id,
      m.dominio                                 as dom_atual,
      m.categoria_codigo                        as cat_atual,
      r.id                                      as regra_id,
      r.padrao                                  as padrao,
      r.dominio                                 as r_dom,
      r.categoria_codigo                        as r_cat,
      row_number() over (partition by m.id
        order by r.prioridade asc, length(r.padrao) desc, r.criado_em desc, r.id) as rk,
      count(*)    over (partition by m.id)      as n_regras
      from public.fin_movimento m
      join public.fin_regra r
        on  r.tenant_id = p_tenant
        and r.ativo
        and r.arquivado_em is null
        and (p_regra_ids is null or r.id = any(p_regra_ids))
        and privado.fn_fin_casa(
              privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)),
              r.padrao, r.tipo_match)
     where m.tenant_id = p_tenant
       and m.arquivado_em is null
       and (p_mov_ids is null or m.id = any(p_mov_ids))
  ),
  venc as (
    select mov_id, regra_id, padrao, dom_atual, cat_atual,
      case when r_dom is null                    then dom_atual
           when v_todos or dom_atual is null     then r_dom
           else dom_atual end as dom_novo,
      case when r_cat is null                    then cat_atual
           when v_todos or cat_atual is null     then r_cat
           else cat_atual end as cat_novo
      from par where rk = 1
  ),
  mud as (
    select * from venc
     where dom_novo is distinct from dom_atual
        or cat_novo is distinct from cat_atual
  ),
  upd as (
    update public.fin_movimento m
       set dominio          = mud.dom_novo,
           categoria_codigo = mud.cat_novo,
           atualizado_em    = now()
      from mud
     where m.id = mud.mov_id
    returning mud.regra_id as regra_id, mud.padrao as padrao
  ),
  agg as (
    select regra_id, padrao, count(*)::int as n from upd group by 1, 2
  )
  select
    (select coalesce(sum(n), 0)::int from agg),
    (select coalesce(jsonb_agg(jsonb_build_object('id', regra_id, 'padrao', padrao, 'n', n)
              order by n desc, padrao), '[]'::jsonb) from agg),
    (select count(distinct mov_id)::int from par where n_regras > 1)
  into v_class, v_porregra, v_conf;

  -- contador da regra: so sobe quando a regra REALMENTE mudou alguma coluna.
  -- Rodar de novo sem efeito nao infla o numero e nao gera linha de auditoria.
  if v_class > 0 then
    update public.fin_regra r
       set aplicada_n       = r.aplicada_n + x.n,
           ultima_aplicacao = now(),
           atualizado_em    = now()
      from (select (e->>'id')::uuid as id, (e->>'n')::int as n
              from jsonb_array_elements(v_porregra) e) x
     where r.id = x.id and r.tenant_id = p_tenant;
  end if;

  return jsonb_build_object(
    'classificados', v_class,
    'por_regra',     v_porregra,
    'conflitos',     v_conf);
end
$$;

revoke all on function privado.fn_fin_aplicar_regras(uuid,uuid[],uuid[],text) from public;
grant execute on function privado.fn_fin_aplicar_regras(uuid,uuid[],uuid[],text) to authenticated;
