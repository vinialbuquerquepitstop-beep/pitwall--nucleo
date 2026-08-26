-- migration aplicada: 20260826015200_fin_fatia1_rpcs_leitura

-- ------------------------------------------------------------------------
-- fin_painel(p_ini, p_fim, p_dominio)
-- Placar de CAIXA. Nunca cruza com venda, que e resultado por competencia.
-- Invariante 18: movimento com dominio null nao entra em entrou/saiu/resultado.
-- Categoria neutro (transferencia, aplicacao, resgate) fica fora de todo total.
-- ------------------------------------------------------------------------
create or replace function public.fin_painel(
  p_ini date default null, p_fim date default null, p_dominio text default null
) returns json
language plpgsql
stable
set search_path to 'public','privado'
as $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date; v_fim date; v_pini date; v_pfim date;
  v_dom text;
  v_entrou numeric; v_saiu numeric; v_result numeric;
  v_nc_val numeric; v_nc_n int;
  v_secoes json; v_entradas json;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Financeiro e restrito ao dono.');
  end if;

  v_fim := coalesce(p_fim, v_hoje);
  v_ini := coalesce(p_ini, date_trunc('month', v_fim)::date);
  if v_ini > v_fim then
    return json_build_object('ok', false, 'msg', 'Janela invertida.');
  end if;
  v_pfim := v_ini - 1;
  v_pini := v_ini - (v_fim - v_ini + 1);

  v_dom := nullif(lower(btrim(coalesce(p_dominio, ''))), '');
  if v_dom = 'tudo' then v_dom := null; end if;
  if v_dom is not null and v_dom not in ('empresa','pessoal') then
    return json_build_object('ok', false, 'msg', 'Dominio invalido: use empresa, pessoal ou tudo.');
  end if;

  -- ---------- placar ----------
  select
    coalesce(sum(b.valor) filter (where b.conta_no_total and b.valor > 0), 0),
    coalesce(-sum(b.valor) filter (where b.conta_no_total and b.valor < 0), 0),
    coalesce(sum(b.valor) filter (where b.conta_no_total), 0),
    coalesce(sum(b.valor) filter (where b.dominio is null), 0),
    coalesce(count(*) filter (where b.dominio is null), 0)
  into v_entrou, v_saiu, v_result, v_nc_val, v_nc_n
  from (
    select m.valor, m.dominio,
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

  -- ---------- secoes (so saidas, somadas em modulo) ----------
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
       and coalesce(c.natureza_esperada, '') <> 'neutro'
       and m.valor < 0
  ), cat as (
    select grupo, codigo, rotulo,
           coalesce(sum(-valor) filter (where atual), 0) as tot,
           coalesce(sum(-valor) filter (where not atual), 0) as ant,
           coalesce(count(*) filter (where atual), 0)::int as n
      from base group by grupo, codigo, rotulo
  ), g as (
    select coalesce(sum(tot), 0) as total from cat
  ), sec as (
    select cat.grupo, sum(cat.tot) as tot, sum(cat.ant) as ant,
           json_agg(json_build_object(
             'codigo', cat.codigo, 'rotulo', cat.rotulo, 'total', cat.tot,
             'pct', case when g.total > 0 then round(100.0 * cat.tot / g.total, 1) else 0 end,
             'delta_pct', case when cat.ant > 0 then round(100.0 * (cat.tot - cat.ant) / cat.ant, 1) else null end,
             'n', cat.n) order by cat.tot desc, cat.rotulo)
             filter (where cat.tot > 0) as cats
      from cat cross join g
     group by cat.grupo, g.total
  )
  select coalesce(json_agg(json_build_object(
           'grupo', sec.grupo, 'total', sec.tot,
           'pct', case when g.total > 0 then round(100.0 * sec.tot / g.total, 1) else 0 end,
           'delta_pct', case when sec.ant > 0 then round(100.0 * (sec.tot - sec.ant) / sec.ant, 1) else null end,
           'categorias', coalesce(sec.cats, '[]'::json))
         order by sec.tot desc, sec.grupo) filter (where sec.tot > 0), '[]'::json)
    into v_secoes
    from sec cross join g;

  -- ---------- entradas ----------
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
       and coalesce(c.natureza_esperada, '') <> 'neutro'
       and m.valor > 0
  ), cat as (
    select grupo, codigo, rotulo,
           coalesce(sum(valor) filter (where atual), 0) as tot,
           coalesce(sum(valor) filter (where not atual), 0) as ant,
           coalesce(count(*) filter (where atual), 0)::int as n
      from base group by grupo, codigo, rotulo
  ), g as (
    select coalesce(sum(tot), 0) as total from cat
  ), sec as (
    select cat.grupo, sum(cat.tot) as tot, sum(cat.ant) as ant,
           json_agg(json_build_object(
             'codigo', cat.codigo, 'rotulo', cat.rotulo, 'total', cat.tot,
             'pct', case when g.total > 0 then round(100.0 * cat.tot / g.total, 1) else 0 end,
             'delta_pct', case when cat.ant > 0 then round(100.0 * (cat.tot - cat.ant) / cat.ant, 1) else null end,
             'n', cat.n) order by cat.tot desc, cat.rotulo)
             filter (where cat.tot > 0) as cats
      from cat cross join g
     group by cat.grupo, g.total
  )
  select coalesce(json_agg(json_build_object(
           'grupo', sec.grupo, 'total', sec.tot,
           'pct', case when g.total > 0 then round(100.0 * sec.tot / g.total, 1) else 0 end,
           'delta_pct', case when sec.ant > 0 then round(100.0 * (sec.tot - sec.ant) / sec.ant, 1) else null end,
           'categorias', coalesce(sec.cats, '[]'::json))
         order by sec.tot desc, sec.grupo) filter (where sec.tot > 0), '[]'::json)
    into v_entradas
    from sec cross join g;

  return json_build_object(
    'ok', true,
    'ini', v_ini, 'fim', v_fim, 'hoje', v_hoje,
    'dominio', coalesce(v_dom, 'tudo'),
    'ini_anterior', v_pini, 'fim_anterior', v_pfim,
    'placar', json_build_object(
      'entrou', v_entrou, 'saiu', v_saiu, 'resultado', v_result,
      'nao_classificado_valor', v_nc_val, 'nao_classificado_n', v_nc_n),
    'secoes', v_secoes,
    'entradas', v_entradas);
end
$$;
revoke all on function public.fin_painel(date, date, text) from public;
grant execute on function public.fin_painel(date, date, text) to authenticated, postgres, service_role;

-- ------------------------------------------------------------------------
-- fin_movimentos(p_ini, p_fim, p_dominio, p_status)
-- ------------------------------------------------------------------------
create or replace function public.fin_movimentos(
  p_ini date default null, p_fim date default null,
  p_dominio text default null, p_status text default 'todos'
) returns json
language plpgsql
stable
set search_path to 'public','privado'
as $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date; v_fim date;
  v_dom text; v_status text;
  v_n int; v_total numeric; v_itens json;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Financeiro e restrito ao dono.');
  end if;

  v_fim := coalesce(p_fim, v_hoje);
  v_ini := coalesce(p_ini, date_trunc('month', v_fim)::date);
  if v_ini > v_fim then
    return json_build_object('ok', false, 'msg', 'Janela invertida.');
  end if;

  v_dom := nullif(lower(btrim(coalesce(p_dominio, ''))), '');
  if v_dom = 'tudo' then v_dom := null; end if;
  if v_dom is not null and v_dom not in ('empresa','pessoal') then
    return json_build_object('ok', false, 'msg', 'Dominio invalido: use empresa, pessoal ou tudo.');
  end if;

  v_status := coalesce(nullif(lower(btrim(coalesce(p_status, ''))), ''), 'todos');
  if v_status not in ('todos','nao_classificados') then
    return json_build_object('ok', false, 'msg', 'Status invalido: use todos ou nao_classificados.');
  end if;
  -- em nao_classificados o filtro de dominio nao faz sentido: dominio e null.
  if v_status = 'nao_classificados' then v_dom := null; end if;

  select count(*)::int, coalesce(sum(m.valor), 0)
    into v_n, v_total
    from public.fin_movimento m
   where m.tenant_id = v_tenant
     and m.arquivado_em is null
     and m.data between v_ini and v_fim
     and (v_status <> 'nao_classificados' or m.dominio is null)
     and (v_dom is null or m.dominio = v_dom);

  select coalesce(json_agg(t order by t.data desc, t.criado_em desc), '[]'::json)
    into v_itens
    from (
      select m.id, m.data, m.descricao, m.descricao_original, m.valor,
             m.categoria_codigo,
             c.rotulo as categoria_rotulo,
             c.grupo,
             c.natureza_esperada,
             m.dominio, m.origem,
             co.rotulo as conta_rotulo,
             m.observacao, m.venda_id, m.criado_em
        from public.fin_movimento m
        join public.fin_conta co on co.id = m.conta_id
        left join public.fin_categoria c
          on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
       where m.tenant_id = v_tenant
         and m.arquivado_em is null
         and m.data between v_ini and v_fim
         and (v_status <> 'nao_classificados' or m.dominio is null)
         and (v_dom is null or m.dominio = v_dom)
       order by m.data desc, m.criado_em desc
       limit 500
    ) t;

  return json_build_object(
    'ok', true, 'ini', v_ini, 'fim', v_fim, 'hoje', v_hoje,
    'dominio', coalesce(v_dom, 'tudo'), 'status', v_status,
    'n', v_n, 'total', v_total, 'truncado', (v_n > 500),
    'itens', v_itens);
end
$$;
revoke all on function public.fin_movimentos(date, date, text, text) from public;
grant execute on function public.fin_movimentos(date, date, text, text) to authenticated, postgres, service_role;

-- ------------------------------------------------------------------------
-- fin_config()  -- a tela monta os seletores daqui, nunca hardcoded
-- ------------------------------------------------------------------------
create or replace function public.fin_config()
returns json
language plpgsql
stable
set search_path to 'public','privado'
as $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_contas json; v_cats json;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Financeiro e restrito ao dono.');
  end if;

  select coalesce(json_agg(json_build_object(
           'id', id, 'codigo', codigo, 'rotulo', rotulo, 'banco', banco,
           'tipo', tipo, 'dominio_padrao', dominio_padrao, 'ordem', ordem)
         order by ordem, rotulo), '[]'::json)
    into v_contas
    from public.fin_conta
   where tenant_id = v_tenant and ativo;

  select coalesce(json_agg(json_build_object(
           'codigo', codigo, 'rotulo', rotulo, 'grupo', grupo,
           'natureza_esperada', natureza_esperada,
           'dominio_sugerido', dominio_sugerido, 'ordem', ordem)
         order by ordem, rotulo), '[]'::json)
    into v_cats
    from public.fin_categoria
   where tenant_id = v_tenant and ativo;

  return json_build_object('ok', true, 'contas', v_contas, 'categorias', v_cats);
end
$$;
revoke all on function public.fin_config() from public;
grant execute on function public.fin_config() to authenticated, postgres, service_role;
