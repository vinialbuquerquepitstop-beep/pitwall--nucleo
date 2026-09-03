-- 20260903_fin_painel_caixa_x_resultado.sql
--
-- O Financeiro para de chamar caixa de resultado.
--
-- Quatro defeitos, medidos em agosto/2026 antes desta migration:
--
--   1. `placar.resultado` era CAIXA (entrou - saiu) sob uma palavra que qualquer
--      pessoa le como lucro. Agosto exibia -9.351,21 num mes que deu LUCRO de
--      R$ 2.925,98 em 7 vendas (tabela `venda`). Passa a se chamar `saldo`, e a
--      chave `resultado` SOME do payload: campo orfao tem que quebrar alto na
--      tela, nao continuar mentindo em silencio.
--
--   2. `saiu` somava estoque com despesa. Dos R$ 16.054,00 que sairam em empresa,
--      R$ 15.400,00 eram `compra_aparelho` (5 linhas). Isso e MERCADORIA, nao
--      gasto: vira aparelho na prateleira, nao dinheiro queimado. Nascem
--      `estoque` e `gasto` (= saiu - estoque). O gasto real de agosto foi
--      R$ 654,00, nao R$ 16.054,00.
--
--      Por que `grupo = 'Mercadoria'` e nao uma lista de codigos: categoria de
--      estoque nova (ex.: acessorio para revenda) passa a contar sozinha, so por
--      nascer no grupo certo, sem tocar nesta funcao. Config manda, codigo
--      obedece (invariante 12 e C2).
--
--      `estoque` e calculado com a MESMA composicao de `saiu` restrita ao grupo,
--      nao com um `sum(abs(valor))` solto. Motivo: `saiu` ja desconta abatimento
--      (entrada positiva numa categoria de natureza saida, ex.: devolucao de
--      fornecedor). Com `abs()`, uma devolucao de aparelho INFLARIA o estoque e a
--      identidade `gasto = saiu - estoque` quebraria, podendo produzir gasto
--      negativo. Hoje a base nao tem devolucao de mercadoria (10 linhas do grupo,
--      todas negativas), entao os dois calculos dao identico; a diferenca so
--      aparece no dia em que aparecer, e nesse dia este e o certo.
--
--   3. `nao_classificado_*` contava linha de categoria NEUTRA. Em agosto acusava
--      -R$ 4.725,00 em 3 linhas (1 `repasse` de -4.800 e 2 `transferencia_interna`
--      de +50 e +25) num mes que `fin_cobertura` declara 100% julgado. As 3 tem
--      `dominio` nulo POR DESENHO: dinheiro de terceiro nao tem lado a decidir.
--      Dois numeros da mesma tela se contradiziam. A partir daqui o filtro e
--      LITERALMENTE o mesmo de `privado.fn_fin_cobertura`
--      (`dominio is null and nat <> 'neutro'`): os dois numeros concordam por
--      construcao, nao por coincidencia.
--
--   4. Com `p_dominio = 'tudo'`, um `resultado` unico somava empresa e pessoal
--      (-9.351,21 = -9.575,00 + 223,79). Isso e exatamente o que o invariante 18
--      existe para impedir. Nascem `placar_empresa` e `placar_pessoal`, com a
--      mesma forma, preenchidos SO quando o filtro e 'tudo' (quando ja se filtrou
--      um dominio, a tela desenharia dois blocos identicos).
--
-- E nasce `resultado_venda`, que le a tabela `venda` pela view `v_venda` (unica
-- definicao de `lucro` do projeto, o analogo do C1: motor de calculo e UNICO).
-- Lucro NUNCA se calcula a partir do extrato. Caixa e resultado ficam lado a lado
-- no payload, em dois blocos com nomes distintos, e nunca se somam: e o corolario
-- do invariante 18.
--
-- Filtro de `resultado_venda`, declarado: `arquivado_em is null` (ja embutido na
-- view) MAIS `status = 'concluida'`. O `status` admite 'pre_venda', 'concluida' e
-- 'cancelada' (`venda_status_check`); sem o filtro, uma pre-venda ou uma venda
-- cancelada e nao arquivada entraria no lucro do mes, e o Financeiro divergiria do
-- Dashboard, que ja usa `status = 'concluida'` desde a migration
-- `20260817194733_painel_metricas_faturamento_so_concluida`. Hoje as 9 vendas
-- ativas sao todas 'concluida', entao o numero medido e identico nos dois filtros.
--
-- A data da venda usa `coalesce(data_venda, criado_em no fuso de Sao Paulo)`,
-- porque `venda.data_venda` e NULLABLE e venda sem data sumiria da janela em
-- silencio. E o mesmo padrao que `painel_metricas` ja usa para o lead. Hoje
-- nenhuma venda tem `data_venda` nula. `current_date` nao aparece (invariante 10).
--
-- Sem `security definer` nova. Sem recusa nova. `security invoker`, `search_path`
-- fixo, dono-only, como antes.

create or replace function public.fin_painel(
  p_ini date default null,
  p_fim date default null,
  p_dominio text default null
)
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
    'entradas', v_entradas);
end
$function$;

-- CREATE OR REPLACE FUNCTION reseta a ACL para o default do Postgres (EXECUTE a
-- PUBLIC). Refazer o hardening explicitamente, senao `anon` passa a poder chamar.
revoke all on function public.fin_painel(date, date, text) from public;
revoke all on function public.fin_painel(date, date, text) from anon;
grant execute on function public.fin_painel(date, date, text) to authenticated;
grant execute on function public.fin_painel(date, date, text) to service_role;

-- Guard-rail: a migration inteira falha se o payload nao ficar exato.
-- Simula os claims do dono para passar pelas guardas; nao troca de role, porque
-- os filtros por tenant_id ja garantem o mesmo recorte.
do $guard$
declare
  r jsonb; pl jsonb; ple jsonb; plp jsonb; rv jsonb;
  v_acl text;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', true);

  r := public.fin_painel('2026-08-01', '2026-08-31', 'tudo')::jsonb;
  if coalesce((r ->> 'ok')::boolean, false) is not true then
    raise exception 'GUARD: fin_painel nao devolveu ok=true: %', r;
  end if;

  pl  := r -> 'placar';
  ple := r -> 'placar_empresa';
  plp := r -> 'placar_pessoal';
  rv  := r -> 'resultado_venda';

  if pl ? 'resultado' then
    raise exception 'GUARD: a chave resultado continua no placar';
  end if;
  if not (pl ? 'saldo' and pl ? 'estoque' and pl ? 'gasto') then
    raise exception 'GUARD: faltam saldo/estoque/gasto no placar: %', pl;
  end if;
  if (pl ->> 'gasto')::numeric <> (pl ->> 'saiu')::numeric - (pl ->> 'estoque')::numeric then
    raise exception 'GUARD: gasto <> saiu - estoque: %', pl;
  end if;
  if (pl ->> 'saldo')::numeric <> (pl ->> 'entrou')::numeric - (pl ->> 'saiu')::numeric then
    raise exception 'GUARD: saldo <> entrou - saiu: %', pl;
  end if;
  if jsonb_typeof(ple) is distinct from 'object' or jsonb_typeof(plp) is distinct from 'object' then
    raise exception 'GUARD: placar_empresa/placar_pessoal ausentes com dominio=tudo';
  end if;
  if (pl ->> 'saldo')::numeric
     <> (ple ->> 'saldo')::numeric + (plp ->> 'saldo')::numeric then
    raise exception 'GUARD: o saldo de tudo nao fecha com empresa + pessoal';
  end if;
  if jsonb_typeof(rv) is distinct from 'object'
     or not (rv ? 'n' and rv ? 'faturado' and rv ? 'lucro' and rv ? 'delta_pct_lucro') then
    raise exception 'GUARD: resultado_venda incompleto: %', rv;
  end if;

  -- pessoal nao ve venda, e nao desenha dois blocos identicos
  r := public.fin_painel('2026-08-01', '2026-08-31', 'pessoal')::jsonb;
  if jsonb_typeof(r -> 'resultado_venda') is distinct from 'null' then
    raise exception 'GUARD: resultado_venda deveria ser null no dominio pessoal, veio %',
      jsonb_typeof(r -> 'resultado_venda');
  end if;
  if jsonb_typeof(r -> 'placar_empresa') is distinct from 'null'
     or jsonb_typeof(r -> 'placar_pessoal') is distinct from 'null' then
    raise exception 'GUARD: sub-placares deveriam ser null quando o filtro ja e um dominio';
  end if;

  select p.proacl::text into v_acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'fin_painel';
  if v_acl is null or v_acl like '%anon=%' or v_acl not like '%authenticated=X%' then
    raise exception 'GUARD: ACL de fin_painel ficou errada: %', coalesce(v_acl, '(default: PUBLIC)');
  end if;
end
$guard$;
