-- migration aplicada: 20260902052903_fin_fatia4_movimentos_contraparte
-- Aplicada por apply_migration em 02/09/2026. Paridade de CORPO conferida
-- contra o ledger por md5 normalizado: 7219f1244ac40da1836c9e5c16faac2c.

-- =====================================================================
-- Fatia 4, Etapa 1. fin_movimentos passa a devolver a contraparte na
-- linha, a filtrar por ela e a resumir o recorte POR contraparte.
--
-- POR QUE O RESUMO EXISTE, medido em 02/09/2026 sobre a base viva:
-- julgar o pendente linha a linha, da maior para a menor, exige 290
-- decisoes para cobrir 95% do valor. Julgar POR CONTRAPARTE exige 68, e
-- 30 cobrem 80%. E a mesma cobertura por um quarto do trabalho.
--
-- O QUE O RESUMO NAO E: nao e saldo, nao e netting, nao e "quanto fulano
-- me deve". F4 barra isso, e o erro ja foi cometido neste projeto sobre a
-- contraparte BR IPHONES, com tres numeros publicados errados. Aqui so ha
-- CONTAGEM e VALOR BRUTO (soma de abs), que nao dependem de ciclo e por
-- isso a janela nao corrompe.
--
-- O resumo tambem NAO grava dominio e NAO sugere dominio (Inv. 18 e D-i).
-- Ele diz de quem veio ou para quem foi. Quem decide o lado e o dono.
--
-- DETALHE QUE DECIDE SE A TELA PRESTA: o resumo respeita janela, dominio
-- e status, mas IGNORA o proprio p_contraparte. Se respeitasse, a lista de
-- contrapartes encolheria para uma linha no instante em que o dono
-- clicasse numa delas, e ele perderia o caminho de volta.
--
-- A assinatura MUDA (5 -> 6 argumentos), entao nao da para create or
-- replace: o 6-arg com default conviveria com o 5-arg e a chamada de 5
-- argumentos ficaria ambigua. Derruba e recria, e os grants sao refeitos
-- no fim de proposito (drop e create resetam ACL). p_ordem CONTINUA
-- existindo e na mesma posicao: a suite depende dela.
--
-- Nenhuma frase de recusa nova: a unica mensagem que este arquivo
-- acrescenta e reaproveitamento das que ja estao na secao 4 do CONTRATO.
-- =====================================================================
drop function if exists public.fin_movimentos(date, date, text, text, text);

create or replace function public.fin_movimentos(
  p_ini date default null, p_fim date default null,
  p_dominio text default null, p_status text default 'todos',
  p_ordem text default 'data', p_contraparte text default null
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
  v_cp_raw text; v_cp text; v_cp_sem boolean := false; v_cp_echo text;
  v_n int; v_total numeric; v_itens json;
  v_cps json; v_cps_n int;
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

  -- ---- filtro por contraparte ------------------------------------------
  -- O sentinela 'sem_contraparte' e testado ANTES da normalizacao, no molde
  -- do 'sem_categoria' que o fin_painel ja usa. Ele existe porque o resumo
  -- devolve um balde de nome nulo (19 linhas de Aplicacao e Resgate RDB,
  -- medidas): balde que aparece na tela e nao pode ser clicado e beco sem
  -- saida.
  -- A normalizacao passa pela MESMA helper que gravou a coluna
  -- (privado.fn_fin_cp_norm), senao o dono digitaria o nome com acento ou
  -- em minuscula e a tela devolveria zero linha em silencio.
  v_cp_raw := nullif(btrim(coalesce(p_contraparte, '')), '');
  if v_cp_raw is not null and lower(v_cp_raw) = 'sem_contraparte' then
    v_cp_sem := true;
    v_cp_echo := 'sem_contraparte';
  elsif v_cp_raw is not null then
    v_cp := privado.fn_fin_cp_norm(v_cp_raw);
    v_cp_echo := v_cp;
  end if;

  -- ---- contadores do recorte EXIBIDO (respeitam p_contraparte) ---------
  select count(*)::int, coalesce(sum(m.valor), 0)
    into v_n, v_total
    from public.fin_movimento m
   where m.tenant_id = v_tenant
     and m.arquivado_em is null
     and m.data between v_ini and v_fim
     and (v_status <> 'nao_classificados' or m.dominio is null)
     and (v_dom is null or m.dominio = v_dom)
     and (not v_cp_sem or m.contraparte is null)
     and (v_cp is null or m.contraparte = v_cp);

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
             m.dominio, m.origem, m.repasse_id, m.contraparte,
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
         and (not v_cp_sem or m.contraparte is null)
         and (v_cp is null or m.contraparte = v_cp)
       order by
         case when v_ordem = 'valor' then abs(m.valor) end desc nulls last,
         m.data desc, m.criado_em desc
       limit 500
    ) t;

  -- ---- resumo POR contraparte ------------------------------------------
  -- Recorte de janela, dominio e status. SEM p_contraparte, de proposito.
  -- `pendente` aqui e a definicao literal do F3, a mesma que a
  -- privado.fn_fin_cobertura usa: sem dominio E sem categoria de natureza
  -- neutro. Aplicacao e resgate nao tem lado a decidir.
  with b as (
    select m.contraparte as nome,
           abs(m.valor) as bruto,
           (m.dominio is null and coalesce(c.natureza_esperada,'') <> 'neutro') as pendente
      from public.fin_movimento m
      left join public.fin_categoria c
        on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
     where m.tenant_id = v_tenant
       and m.arquivado_em is null
       and m.data between v_ini and v_fim
       and (v_status <> 'nao_classificados' or m.dominio is null)
       and (v_dom is null or m.dominio = v_dom)
  ), g as (
    select nome,
           count(*)::int as n,
           coalesce(sum(bruto), 0) as bruto,
           count(*) filter (where pendente)::int as n_pendente,
           coalesce(sum(bruto) filter (where pendente), 0) as valor_pendente
      from b group by nome
  )
  select
    (select count(*)::int from g),
    -- teto de 200 no molde do limit 500 dos itens, e por isso viaja
    -- contrapartes_truncado: a tela DECLARA o recorte em vez de mentir por
    -- omissao. Ordenado por bruto desc, entao o que fica de fora e sempre a
    -- cauda pequena, e as 68 que cobrem 95% do pendente estao no topo.
    coalesce((select json_agg(x) from (
       select nome, n, bruto, n_pendente, valor_pendente
         from g order by bruto desc, nome nulls last limit 200) x), '[]'::json)
    into v_cps_n, v_cps;

  return json_build_object(
    'ok', true, 'ini', v_ini, 'fim', v_fim, 'hoje', v_hoje,
    'dominio', coalesce(v_dom, 'tudo'), 'status', v_status, 'ordem', v_ordem,
    'contraparte', v_cp_echo,
    'n', v_n, 'total', v_total, 'truncado', (v_n > 500),
    'itens', v_itens,
    'contrapartes', v_cps,
    'contrapartes_n', v_cps_n,
    'contrapartes_truncado', (v_cps_n > 200));
end
$$;

revoke all on function public.fin_movimentos(date, date, text, text, text, text) from public;
grant execute on function public.fin_movimentos(date, date, text, text, text, text) to authenticated, postgres, service_role;
