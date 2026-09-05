-- migration aplicada: 20260905022704_20260904_fin_painel_notas
--
-- E1, passo 3: a nota chega na tela pela RPC que ja serve o numero.
--
-- POR QUE AQUI E NAO NUMA RPC NOVA
-- A nota tem que aparecer COLADA no numero, nao numa aba de historico. Quem serve o
-- numero e fin_painel; uma RPC avulsa obrigaria a tela a fazer duas chamadas e a casar
-- janelas na mao, e no dia em que as duas discordassem a nota apareceria no mes errado,
-- que e pior do que nao aparecer.
--
-- O QUE MUDA: uma variavel nova (v_notas), um SELECT novo sobre fin_nota_numero, e uma
-- chave nova no JSON de retorno ('notas'). NENHUMA linha de calculo foi tocada:
-- placares, secoes, entradas, resultado_venda, cobertura e janela anterior seguem
-- caractere por caractere como estavam. E1 explica numero passado, nao produz numero
-- novo, e o portao proprio da entrega e exatamente esse.
--
-- REGRA DE JANELA: a nota entra quando o MES de competencia dela intersecta a janela
-- pedida. Mes fechado casa com o mes; janela larga (ex. 'Tudo') traz todas.
--
-- A nota NAO e filtrada por p_dominio. Quem sabe onde cada escopo aparece na tela e a
-- tela: 'saldo_empresa' tem alvo visivel quando o filtro e 'tudo' (placar_empresa) e
-- quando o filtro e 'empresa' (placar). Filtrar aqui exigiria mapear escopo -> dominio
-- no servidor, que e conhecimento de layout, nao de dado.
--
-- security invoker (default), STABLE e search_path fixo: inalterados.

create or replace function public.fin_painel(p_ini date default null::date, p_fim date default null::date, p_dominio text default null::text)
 returns json
 language plpgsql
 stable
 set search_path to 'public', 'privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date; v_fim date; v_pini date; v_pfim date;
  v_dom text;
  v_placares json;
  v_rv json;
  v_secoes json; v_entradas json;
  v_pct numeric;
  v_rep_val numeric; v_rep_n int;
  v_orf_val numeric; v_orf_n int;
  v_notas json;
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

  v_pct := (privado.fn_fin_cobertura(v_tenant, v_ini, v_fim) ->> 'pct_julgado')::numeric;

  -- ---------- notas de mudanca de numero (portao 6.3) ----------
  -- Leitura pura. A nota explica um numero que JA mudou; nao entra em conta nenhuma.
  select coalesce(json_agg(json_build_object(
           'codigo',       n.codigo,
           'escopo',       n.escopo,
           'competencia',  n.competencia,
           'valor_antes',  n.valor_antes,
           'valor_depois', n.valor_depois,
           'diferenca',    n.diferenca,
           'causa',        n.causa,
           'mudou_em',     n.mudou_em)
         order by n.competencia desc, n.escopo, n.codigo), '[]'::json)
    into v_notas
    from public.fin_nota_numero n
   where n.tenant_id = v_tenant
     and n.arquivado_em is null
     and n.competencia <= v_fim
     and (n.competencia + interval '1 month')::date > v_ini;

  -- ---------- os placares (caixa) ----------
  -- Um passe so sobre a janela, projetado em ate 3 ESCOPOS. 'principal' e o
  -- filtro pedido; 'empresa' e 'pessoal' so existem quando o filtro e 'tudo'.
  -- `s left join b` (e nao cross join) garante uma linha por escopo mesmo com a
  -- janela vazia: sem isso, mes sem movimento devolveria placar nulo em vez de
  -- placar zerado.
  with b as (
    select m.valor, m.dominio,
           coalesce(m.categoria_codigo, '') as cat,
           m.repasse_id as rep,
           coalesce(c.natureza_esperada, '') as nat,
           coalesce(c.grupo, '') as grp
      from public.fin_movimento m
      left join public.fin_categoria c
        on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
     where m.tenant_id = v_tenant
       and m.arquivado_em is null
       and m.data between v_ini and v_fim
  ), s as (
    select t.escopo, t.dom
      from (values ('principal', v_dom), ('empresa', 'empresa'), ('pessoal', 'pessoal'))
             as t(escopo, dom)
     where t.escopo = 'principal' or v_dom is null
  ), x as (
    select s.escopo, b.valor, b.dominio, b.cat, b.rep, b.nat, b.grp,
           ( b.dominio is not null
             and (s.dom is null or b.dominio = s.dom)
             and b.nat <> 'neutro' ) as conta
      from s left join b on true
  ), a as (
    select x.escopo,
      coalesce(sum(x.valor) filter (where x.conta and x.valor > 0 and x.nat <> 'saida'), 0)
        - coalesce(sum(-x.valor) filter (where x.conta and x.valor < 0 and x.nat = 'entrada'), 0)
        as entrou,
      coalesce(-sum(x.valor) filter (where x.conta and x.valor < 0 and x.nat <> 'entrada'), 0)
        - coalesce(sum(x.valor) filter (where x.conta and x.valor > 0 and x.nat = 'saida'), 0)
        as saiu,
      -- mesma composicao de `saiu`, restrita ao grupo de mercadoria
      coalesce(-sum(x.valor) filter (where x.conta and x.valor < 0 and x.nat <> 'entrada' and x.grp = 'Mercadoria'), 0)
        - coalesce(sum(x.valor) filter (where x.conta and x.valor > 0 and x.nat = 'saida' and x.grp = 'Mercadoria'), 0)
        as estoque,
      coalesce(sum(x.valor) filter (where x.conta), 0) as saldo,
      -- nao classificado: identico ao pendente de privado.fn_fin_cobertura
      coalesce(sum(x.valor) filter (where x.dominio is null and x.nat <> 'neutro'), 0) as nc_val,
      count(*) filter (where x.dominio is null and x.nat <> 'neutro')::int as nc_n,
      coalesce(sum(x.valor) filter (where x.dominio is null and x.nat <> 'neutro' and x.valor > 0), 0) as nc_ent,
      coalesce(sum(x.valor) filter (where x.dominio is null and x.nat <> 'neutro' and x.valor < 0), 0) as nc_sai,
      coalesce(sum(abs(x.valor)) filter (where x.rep is not null), 0) as rep_val,
      count(*) filter (where x.rep is not null)::int as rep_n,
      coalesce(sum(abs(x.valor)) filter (where x.cat = 'repasse' and x.rep is null), 0) as orf_val,
      count(*) filter (where x.cat = 'repasse' and x.rep is null)::int as orf_n
    from x group by x.escopo
  )
  select json_object_agg(a.escopo, json_build_object(
           'entrou',   a.entrou,
           'saiu',     a.saiu,
           'estoque',  a.estoque,
           'gasto',    a.saiu - a.estoque,
           'saldo',    a.saldo,
           'nao_classificado_valor',    a.nc_val,
           'nao_classificado_n',        a.nc_n,
           'nao_classificado_entradas', a.nc_ent,
           'nao_classificado_saidas',   a.nc_sai)),
         coalesce(max(a.rep_val) filter (where a.escopo = 'principal'), 0),
         coalesce(max(a.rep_n)   filter (where a.escopo = 'principal'), 0),
         coalesce(max(a.orf_val) filter (where a.escopo = 'principal'), 0),
         coalesce(max(a.orf_n)   filter (where a.escopo = 'principal'), 0)
    into v_placares, v_rep_val, v_rep_n, v_orf_val, v_orf_n
    from a;

  -- ---------- resultado por competencia (venda, NUNCA o caixa) ----------
  if v_dom is distinct from 'pessoal' then
    with rv as (
      select v.valor_venda, v.lucro,
             (coalesce(v.data_venda, (v.criado_em at time zone 'America/Sao_Paulo')::date)
                between v_ini and v_fim) as atual
        from public.v_venda v
       where v.tenant_id = v_tenant
         and coalesce(v.status, '') = 'concluida'
         and coalesce(v.data_venda, (v.criado_em at time zone 'America/Sao_Paulo')::date)
             between v_pini and v_fim
    ), t as (
      select count(*) filter (where rv.atual)::int                          as n,
             coalesce(sum(rv.valor_venda) filter (where rv.atual), 0)       as faturado,
             coalesce(sum(rv.lucro)       filter (where rv.atual), 0)       as lucro,
             coalesce(sum(rv.lucro)       filter (where not rv.atual), 0)   as lucro_ant
        from rv
    )
    select json_build_object(
             'n', t.n, 'faturado', t.faturado, 'lucro', t.lucro,
             -- D-n: sem base anterior, `null`, e a tela escreve "novo"
             'delta_pct_lucro', case when t.lucro_ant > 0
                                     then round(100.0 * (t.lucro - t.lucro_ant) / t.lucro_ant, 1)
                                     else null end)
      into v_rv
      from t;
  end if;

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
    'placar',         v_placares -> 'principal',
    'placar_empresa', v_placares -> 'empresa',
    'placar_pessoal', v_placares -> 'pessoal',
    'resultado_venda', v_rv,
    'secoes', v_secoes,
    'entradas', v_entradas,
    'notas', v_notas);
end
$function$;

-- CREATE OR REPLACE FUNCTION reseta ACL: refazer REVOKE/GRANT explicitos, sempre.
revoke all on function public.fin_painel(date, date, text) from public;
revoke all on function public.fin_painel(date, date, text) from anon;
grant execute on function public.fin_painel(date, date, text) to authenticated;
grant execute on function public.fin_painel(date, date, text) to service_role;
