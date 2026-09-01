-- migration aplicada: 20260831235630_fin_fatia3_repasse_conta_por_par
-- migration: fin_fatia3_repasse_conta_por_par
--
-- Conserto do portao, mesma entrega. Defeito medido em producao: uma linha com
-- categoria `repasse` e SEM par saiu dos totais e foi declarada como se fosse
-- repasse legitimo. A exclusao acontece por natureza `neutro`, que nao sabe nada
-- de par, entao o numero da declaracao acertava por sorte.
--
-- Agora `repasse` conta por `repasse_id`, que so a fin_repasse_marcar escreve, e
-- o ORFAO (categoria repasse sem par) e devolvido em separado, para aparecer
-- como PROBLEMA na tela em vez de virar numero certo por acidente.
--
-- Corpo de 20260831233621 com quatro linhas de agregacao e uma de subquery.
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
  v_pct numeric;
  v_rep_val numeric; v_rep_n int;
  v_orf_val numeric; v_orf_n int;
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

  -- A cobertura vem da MESMA helper que a fin_cobertura usa (C1). Ela NAO
  -- respeita o filtro de dominio: quem nao tem dominio nao tem lado, entao
  -- recortar por empresa esconderia justamente o que falta julgar.
  v_pct := (privado.fn_fin_cobertura(v_tenant, v_ini, v_fim) ->> 'pct_julgado')::numeric;

  -- ---------- placar ----------
  select
    coalesce(sum(b.valor) filter (where b.conta_no_total and b.valor > 0 and b.nat <> 'saida'), 0)
      - coalesce(sum(-b.valor) filter (where b.conta_no_total and b.valor < 0 and b.nat = 'entrada'), 0),
    coalesce(-sum(b.valor) filter (where b.conta_no_total and b.valor < 0 and b.nat <> 'entrada'), 0)
      - coalesce(sum(b.valor) filter (where b.conta_no_total and b.valor > 0 and b.nat = 'saida'), 0),
    coalesce(sum(b.valor) filter (where b.conta_no_total), 0),
    coalesce(sum(b.valor) filter (where b.dominio is null), 0),
    coalesce(count(*) filter (where b.dominio is null), 0),
    coalesce(sum(abs(b.valor)) filter (where b.rep is not null), 0),
    coalesce(count(*) filter (where b.rep is not null), 0),
    coalesce(sum(abs(b.valor)) filter (where b.cat = 'repasse' and b.rep is null), 0),
    coalesce(count(*) filter (where b.cat = 'repasse' and b.rep is null), 0)
  into v_entrou, v_saiu, v_result, v_nc_val, v_nc_n, v_rep_val, v_rep_n, v_orf_val, v_orf_n
  from (
    select m.valor, m.dominio,
           coalesce(m.categoria_codigo, '') as cat,
           m.repasse_id as rep,
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

  -- ---------- secoes ----------
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
    into v_entradas
    from sec cross join g;

  return json_build_object(
    'ok', true,
    'ini', v_ini, 'fim', v_fim, 'hoje', v_hoje,
    'dominio', coalesce(v_dom, 'tudo'),
    'pct_julgado', v_pct,
    'repasse', json_build_object('valor', v_rep_val, 'n', v_rep_n,
      'orfao_valor', v_orf_val, 'orfao_n', v_orf_n),
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
