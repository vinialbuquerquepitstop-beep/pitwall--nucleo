-- migration aplicada: 20260901000657_fin_fatia3_repasse_desmarcar
-- Paridade de CORPO conferida contra o ledger por md5 normalizado:
-- b3376d81622ae017c1663107aa9a66b0.
--
-- Entrega: PAR DE REPASSE MARCADO ERRADO SE DESFAZ, E A TELA MOSTRA QUEM ESTA
-- EM PAR.
--
-- Buraco nomeado no handoff v6 secao 5: marcar ficou facil e desfazer nao
-- existia. Pior, `fin_movimentos` nao devolvia `repasse_id`, entao a tela nao
-- tinha nem como SABER que uma linha estava em par: o dono via duas linhas com
-- categoria Repasse e nenhuma pista de que elas estavam ligadas uma a outra.
--
-- Duas peças:
--   1. `fin_movimentos` passa a devolver `repasse_id`, e a tela le.
--   2. `fin_repasse_desmarcar(payload)` desfaz o par pelos DOIS lados.
--
-- Desfazer limpa `repasse_id` E `categoria_codigo`. Deixar a categoria criaria
-- exatamente o ORFAO que a migration anterior fechou: categoria neutra sem par,
-- valor fora dos totais sem contraparte. E NAO toca `dominio`: repasse nunca
-- teve lado, e escrever um agora seria o Inv. 18.

-- =====================================================================
-- 1) fin_repasse_desmarcar(payload)
-- =====================================================================
-- Aceita `repasse_id` (o par) OU `id` (um dos lados, o que a tela tem em maos).
-- Escrita, entao devolve `erro` e nao `msg` (C4). Dono-only, search_path fixo.
create or replace function public.fin_repasse_desmarcar(payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_par uuid; v_id uuid;
  v_n int; v_val numeric;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  begin
    v_par := nullif(btrim(coalesce(payload->>'repasse_id','')), '')::uuid;
    v_id  := nullif(btrim(coalesce(payload->>'id','')), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Informe o repasse a desfazer.');
  end;
  if v_par is null and v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe o repasse a desfazer.');
  end if;

  -- Pelo lado, chega-se ao par. O id do PAR e a chave estavel do vinculo; o id
  -- da linha e so o caminho ate ele.
  if v_par is null then
    select repasse_id into v_par
      from public.fin_movimento
     where id = v_id and tenant_id = v_tenant and arquivado_em is null;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Lancamento nao encontrado.');
    end if;
  end if;
  if v_par is null then
    return jsonb_build_object('ok', false, 'erro', 'Este lancamento nao esta em nenhum repasse.');
  end if;

  -- O valor declarado e o do lado que ENTROU, que e quanto de fato passou pela
  -- conta. E lido ANTES da limpeza, senao a mensagem sairia zerada.
  select coalesce(sum(valor) filter (where valor > 0), 0)
    into v_val
    from public.fin_movimento
   where repasse_id = v_par and tenant_id = v_tenant;

  update public.fin_movimento
     set repasse_id       = null,
         categoria_codigo = null,
         atualizado_em    = now()
   where repasse_id = v_par and tenant_id = v_tenant;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Este lancamento nao esta em nenhum repasse.');
  end if;

  -- As duas linhas voltam para a fila de julgamento, sem categoria e sem
  -- dominio: desfazer um par nao decide nada sobre o dinheiro, so desfaz.
  return jsonb_build_object('ok', true, 'n', v_n, 'valor', v_val,
    'msg', v_n || ' lancamento' || case when v_n = 1 then '' else 's' end
           || ' voltaram para a fila de julgamento.');
end
$$;
revoke all on function public.fin_repasse_desmarcar(jsonb) from public;
grant execute on function public.fin_repasse_desmarcar(jsonb) to authenticated, postgres, service_role;

-- =====================================================================
-- 2) fin_movimentos devolve repasse_id
-- =====================================================================
-- Sem isto a tela nao sabe que a linha esta em par, e desfazer viraria acao as
-- cegas. Corpo de 20260831180334 com UMA coluna a mais no select interno e
-- nada mais.
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
             m.dominio, m.origem, m.repasse_id,
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
