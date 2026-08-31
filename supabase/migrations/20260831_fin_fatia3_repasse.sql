-- migration aplicada: 20260831231416_fin_fatia3_repasse
-- Aplicada por apply_migration em 31/08/2026. Paridade de CORPO conferida
-- contra o ledger por md5 normalizado: fe11e66757b7e1e355926f522ac34b12.
--
-- Fatia 3, entrega unica: DINHEIRO QUE SO PASSA PELA CONTA DEIXA DE PARECER
-- RECEITA E DESPESA.
--
-- O problema: existe UMA conta so, e por ela passa dinheiro que nao e da loja
-- nem da casa, e sim de terceiro. Entra e sai. Contado como esta hoje, cada
-- passagem infla `entrou` e `saiu` na mesma medida: o resultado fica certo por
-- acidente e os dois numeros que o dono le ficam errados.
--
-- Contexto DECIDIDO pelo dono, nao inferido e nao ampliado aqui:
--   par Ford (entra AGENCY FORD SUL C MODELOS, sai FORD MODELS SUL),
--   Joao Victor da Cunha Pinheiro, Bruno da Costa Azevedo,
--   Ricardo Meireles de Oliveira.
-- BR IPHONES NAO entra: significado nao definido pelo dono, segue na fila de
-- julgamento. Nenhuma regra, nenhuma classificacao, nenhum chute (Inv. 18).
-- Aporte de investidor NAO existe (D-q): sem categoria de aporte, sem coluna
-- natureza_capital, sem view de saldo por contraparte.
--
-- O par e marcado A MAO, um a um, pelo dono. Casar automatico por valor e data
-- seria inferencia sobre contraparte, exatamente o que o Inv. 18 proibe.

-- =====================================================================
-- 1) A categoria. Grupo Neutro que JA EXISTE, zero grupo novo, zero token
--    de cor novo (C5). natureza `neutro` e o que ja tira aplicacao e resgate
--    dos totais de proposito: repasse entra no mesmo balde, pelo mesmo motivo.
--    Como `neutro`, repasse conta como JULGADO no F3 sem precisar de dominio,
--    e esta certo: dinheiro de terceiro nao tem lado a decidir.
-- =====================================================================
insert into public.fin_categoria
  (tenant_id, codigo, rotulo, grupo, natureza_esperada, dominio_sugerido, ordem)
values
  ('00000000-0000-0000-0000-000000000001', 'repasse', 'Repasse', 'Neutro', 'neutro', 'ambos', 34)
on conflict (tenant_id, codigo) do nothing;

-- =====================================================================
-- 2) O vinculo do par
-- =====================================================================
-- repasse_id e o id DO PAR, nao do lancamento: os dois lados carregam o mesmo
-- uuid. Assim "ja esta em outro par" e uma pergunta de uma linha, e o par
-- inteiro se le sem tabela nova.
alter table public.fin_movimento
  add column if not exists repasse_id uuid;

comment on column public.fin_movimento.repasse_id is
  'Id do PAR de repasse. Os dois lados (entrada e saida) carregam o mesmo uuid. Null = nao e repasse.';

create index if not exists fin_movimento_repasse_idx
  on public.fin_movimento (tenant_id, repasse_id)
  where repasse_id is not null;

-- =====================================================================
-- 3) fin_repasse_marcar(payload)
-- =====================================================================
-- Escrita, entao devolve `erro` e nao `msg` (C4). Dono-only, search_path fixo,
-- security invoker: a RLS de fin_movimento continua recortando o tenant.
create or replace function public.fin_repasse_marcar(payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_ent_id uuid; v_sai_id uuid;
  v_ent_val numeric; v_sai_val numeric;
  v_ent_rep uuid; v_sai_rep uuid;
  v_maior numeric; v_dif numeric; v_pct numeric;
  v_par uuid;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  begin
    v_ent_id := nullif(btrim(coalesce(payload->>'entrada_id','')), '')::uuid;
    v_sai_id := nullif(btrim(coalesce(payload->>'saida_id','')), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Informe a entrada e a saida do repasse.');
  end;
  if v_ent_id is null or v_sai_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe a entrada e a saida do repasse.');
  end if;
  if v_ent_id = v_sai_id then
    return jsonb_build_object('ok', false, 'erro', 'Entrada e saida sao o mesmo lancamento.');
  end if;

  select valor, repasse_id into v_ent_val, v_ent_rep
    from public.fin_movimento
   where id = v_ent_id and tenant_id = v_tenant and arquivado_em is null;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Lancamento nao encontrado.');
  end if;
  select valor, repasse_id into v_sai_val, v_sai_rep
    from public.fin_movimento
   where id = v_sai_id and tenant_id = v_tenant and arquivado_em is null;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Lancamento nao encontrado.');
  end if;

  -- O sinal define quem e quem. Aceitar invertido faria o par existir com a
  -- entrada no lugar da saida, e a declaracao na Visao contaria ao contrario.
  if v_ent_val <= 0 or v_sai_val >= 0 then
    return jsonb_build_object('ok', false, 'erro',
      'Entrada e saida invertidas: a entrada e o valor positivo e a saida e o negativo.');
  end if;

  if v_ent_rep is not null or v_sai_rep is not null then
    return jsonb_build_object('ok', false, 'erro', 'Lancamento ja faz parte de outro repasse.');
  end if;

  -- 5% do MAIOR valor, nao da media: com a media um par de 1000 contra 1100
  -- passaria, e a folga existe para tarifa e arredondamento, nao para casar o
  -- que nao e par.
  v_maior := greatest(abs(v_ent_val), abs(v_sai_val));
  v_dif   := abs(abs(v_ent_val) - abs(v_sai_val));
  v_pct   := case when v_maior > 0 then round(100 * v_dif / v_maior, 2) else 0 end;
  if v_pct > 5 then
    return jsonb_build_object('ok', false, 'erro',
      'Par desigual: a diferenca e de ' || to_char(v_pct, 'FM990D00') || '%, acima dos 5% permitidos.');
  end if;

  v_par := gen_random_uuid();
  update public.fin_movimento
     set repasse_id       = v_par,
         categoria_codigo = 'repasse',
         atualizado_em    = now()
   where id in (v_ent_id, v_sai_id) and tenant_id = v_tenant;

  -- `dominio` NAO e tocado, nem aqui nem em lugar nenhum desta migration:
  -- dinheiro de terceiro nao tem lado, e default silencioso e o Inv. 18.
  return jsonb_build_object('ok', true, 'repasse_id', v_par,
    'entrada_id', v_ent_id, 'saida_id', v_sai_id,
    'valor', abs(v_ent_val), 'diferenca_pct', v_pct);
end
$$;
revoke all on function public.fin_repasse_marcar(jsonb) from public;
grant execute on function public.fin_repasse_marcar(jsonb) to authenticated, postgres, service_role;

-- =====================================================================
-- 4) fin_painel DECLARA o repasse excluido
-- =====================================================================
-- Corpo de 20260831180334, com a chave `repasse` no retorno e as duas somas no
-- bloco do placar. A EXCLUSAO em si ja acontece por natureza `neutro`, que o
-- corpo antigo ja respeitava: o que faltava, e entra aqui, e DECLARAR o valor.
-- Esconder e o que a v33 chamou de mentir por omissao.
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
    coalesce(sum(b.valor) filter (where b.cat = 'repasse' and b.valor > 0), 0),
    coalesce(count(*) filter (where b.cat = 'repasse'), 0)
  into v_entrou, v_saiu, v_result, v_nc_val, v_nc_n, v_rep_val, v_rep_n
  from (
    select m.valor, m.dominio,
           coalesce(m.categoria_codigo, '') as cat,
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
    'repasse', json_build_object('valor', v_rep_val, 'n', v_rep_n),
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
