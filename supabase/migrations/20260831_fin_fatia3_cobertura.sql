-- migration aplicada: 20260831180334_fin_fatia3_cobertura
-- Aplicada por apply_migration em 31/08/2026. Paridade de CORPO conferida
-- contra o ledger por md5 normalizado: 3c6dbc0359fb31d154d867aa7a6bd456.
--
-- Fatia 3, entrega unica: A TELA NUNCA MAIS MOSTRA UM NUMERO ECONOMICO SOBRE
-- BASE INCOMPLETA. E o guardiao do F3 do docs/financeiro/CONTRATO.md.
--
-- Medido em 31/08/2026, antes desta migration: 181 lancamentos, R$ 79.619,86 de
-- valor bruto, R$ 1.677,85 julgado. 2,11% em VALOR. Todo numero de receita,
-- margem ou meta desenhado hoje esta errado, e o erro ja foi publicado tres
-- vezes (secao 5 do CONTRATO, motivo do F4).
--
-- JULGADO, para efeito deste calculo (F3, literal): tem `dominio`, OU tem
-- categoria de natureza `neutro`. Aplicacao e resgate nao tem lado a decidir,
-- entao exigir dominio deles seria cobrar trabalho que nao existe.
--
-- Tres objetos, uma implementacao so (C1):
--   privado.fn_fin_cobertura  -> a conta, em um lugar so
--   public.fin_cobertura      -> a RPC enderecavel, lida pela tela no estado degradado
--   public.fin_painel         -> passa a devolver pct_julgado, pela MESMA helper
-- e public.fin_movimentos ganha p_ordem, para o atalho cair ordenado por valor:
-- julgar do maior para o menor e o que faz 2% virar 95% em tempo humano.

-- =====================================================================
-- 1) A conta, uma vez so (C1: duas implementacoes divergem)
-- =====================================================================
-- search_path vazio e tudo schema-qualificado, o mesmo endurecimento que o
-- get_advisors cobrou das outras helpers em 20260826133336.
-- NAO e security definer: roda como o chamador, entao a RLS de fin_movimento
-- continua sendo quem recorta o tenant. A unica security definer do modulo
-- segue sendo privado.fn_fin_importacao_fechar (CONTRATO secao 1).
create or replace function privado.fn_fin_cobertura(
  p_tenant uuid, p_ini date, p_fim date
) returns json
language sql
stable
set search_path to ''
as $$
  with b as (
    select m.valor, m.dominio,
           coalesce(c.natureza_esperada, '') as nat
      from public.fin_movimento m
      left join public.fin_categoria c
        on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
     where m.tenant_id = p_tenant
       and m.arquivado_em is null
       and m.data between p_ini and p_fim
  ), t as (
    select
      coalesce(sum(abs(b.valor)), 0)                                                       as bruto,
      coalesce(sum(abs(b.valor)) filter (where b.dominio is not null or b.nat = 'neutro'), 0) as julgado,
      coalesce(sum(abs(b.valor)) filter (where b.dominio is null and b.nat <> 'neutro'), 0)   as pendente,
      count(*)::int                                                                        as linhas,
      count(*) filter (where b.dominio is null and b.nat <> 'neutro')::int                 as linhas_pendentes,
      coalesce(sum(abs(b.valor)) filter (where b.dominio = 'empresa' and b.nat <> 'neutro'), 0) as v_emp,
      count(*) filter (where b.dominio = 'empresa' and b.nat <> 'neutro')::int             as n_emp,
      coalesce(sum(abs(b.valor)) filter (where b.dominio = 'pessoal' and b.nat <> 'neutro'), 0) as v_pes,
      count(*) filter (where b.dominio = 'pessoal' and b.nat <> 'neutro')::int             as n_pes,
      coalesce(sum(abs(b.valor)) filter (where b.nat = 'neutro'), 0)                       as v_neu,
      count(*) filter (where b.nat = 'neutro')::int                                        as n_neu
    from b
  )
  -- Os quatro baldes de por_dominio sao DISJUNTOS e exaustivos, e `neutro`
  -- vence `dominio`: e o mesmo recorte que o fin_painel ja usa para manter
  -- aplicacao e resgate fora dos totais de proposito.
  -- Base vazia devolve 100: nao ha o que julgar, e travar a tela por causa de
  -- zero linha seria cobrar trabalho inexistente. A tela vazia tem estado proprio.
  select json_build_object(
    'valor_bruto_total',   t.bruto,
    'valor_bruto_julgado', t.julgado,
    'valor_pendente',      t.pendente,
    'pct_julgado', case when t.bruto = 0 then 100::numeric
                        else round(100 * t.julgado / t.bruto, 2) end,
    'linhas_total',     t.linhas,
    'linhas_pendentes', t.linhas_pendentes,
    'por_dominio', json_build_object(
      'empresa',  json_build_object('valor', t.v_emp,     'n', t.n_emp),
      'pessoal',  json_build_object('valor', t.v_pes,     'n', t.n_pes),
      'neutro',   json_build_object('valor', t.v_neu,     'n', t.n_neu),
      'pendente', json_build_object('valor', t.pendente,  'n', t.linhas_pendentes)))
  from t;
$$;
revoke all on function privado.fn_fin_cobertura(uuid,date,date) from public;
grant execute on function privado.fn_fin_cobertura(uuid,date,date) to authenticated;

-- =====================================================================
-- 2) A RPC enderecavel
-- =====================================================================
-- Mesmas regras de janela do fin_painel (Inv. 10 e D-m: o fim para em HOJE no
-- mes corrente, senao a tela compara 25 dias contra 31 do mes anterior).
-- `teto` viaja junto: o numero 95 e regra de negocio e mora no servidor, nao
-- chumbado no JS (C2).
create or replace function public.fin_cobertura(
  p_ini date default null, p_fim date default null
) returns json
language plpgsql
stable
set search_path to 'public','privado'
as $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date; v_fim date;
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

  return (jsonb_build_object(
            'ok', true, 'ini', v_ini, 'fim', v_fim, 'hoje', v_hoje, 'teto', 95)
          || privado.fn_fin_cobertura(v_tenant, v_ini, v_fim)::jsonb)::json;
end
$$;
revoke all on function public.fin_cobertura(date, date) from public;
grant execute on function public.fin_cobertura(date, date) to authenticated, postgres, service_role;

-- =====================================================================
-- 3) fin_painel passa a declarar a cobertura da janela pedida
-- =====================================================================
-- Corpo identico ao de 20260826223626 (fin_fatia21_painel_abatimento_sem_categoria),
-- com TRES linhas novas: a declaracao de v_pct, o calculo pela helper, e a chave
-- pct_julgado no retorno. Nenhum total muda de valor: pct_julgado nao entra em
-- conta nenhuma, so diz se a tela pode desenhar as contas.
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

-- =====================================================================
-- 4) fin_movimentos ganha p_ordem
-- =====================================================================
-- A assinatura MUDA (4 -> 5 argumentos), entao nao da para `create or replace`:
-- um 5-arg com default conviveria com o 4-arg e a chamada de 4 argumentos
-- ficaria ambigua. Derruba e recria, e os grants sao refeitos abaixo de
-- proposito (drop e create resetam ACL).
drop function if exists public.fin_movimentos(date, date, text, text);

create or replace function public.fin_movimentos(
  p_ini date default null, p_fim date default null,
  p_dominio text default null, p_status text default 'todos',
  p_ordem text default 'data'
) returns json
language plpgsql
stable
set search_path to 'public','privado'
as $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date; v_fim date;
  v_dom text; v_status text; v_ordem text;
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

  -- p_ordem existe por causa do F3: julgar do MAIOR valor para o menor e o que
  -- transforma 2% de cobertura em 95% em tempo humano. Ordenar no cliente seria
  -- mentira assim que a lista passar do limit 500: a tela ordenaria as 500 que
  -- recebeu, nao as maiores da janela.
  v_ordem := coalesce(nullif(lower(btrim(coalesce(p_ordem, ''))), ''), 'data');
  if v_ordem not in ('data','valor') then
    return json_build_object('ok', false, 'msg', 'Ordem invalida: use data ou valor.');
  end if;

  select count(*)::int, coalesce(sum(m.valor), 0)
    into v_n, v_total
    from public.fin_movimento m
   where m.tenant_id = v_tenant
     and m.arquivado_em is null
     and m.data between v_ini and v_fim
     and (v_status <> 'nao_classificados' or m.dominio is null)
     and (v_dom is null or m.dominio = v_dom);

  select coalesce(json_agg(t order by
           case when v_ordem = 'valor' then abs(t.valor) end desc nulls last,
           t.data desc, t.criado_em desc), '[]'::json)
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
       order by
         case when v_ordem = 'valor' then abs(m.valor) end desc nulls last,
         m.data desc, m.criado_em desc
       limit 500
    ) t;

  return json_build_object(
    'ok', true, 'ini', v_ini, 'fim', v_fim, 'hoje', v_hoje,
    'dominio', coalesce(v_dom, 'tudo'), 'status', v_status, 'ordem', v_ordem,
    'n', v_n, 'total', v_total, 'truncado', (v_n > 500),
    'itens', v_itens);
end
$$;
revoke all on function public.fin_movimentos(date, date, text, text, text) from public;
grant execute on function public.fin_movimentos(date, date, text, text, text) to authenticated, postgres, service_role;
