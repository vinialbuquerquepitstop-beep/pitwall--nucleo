-- migration: fin_fatia3_repasse_so_por_par
--
-- Conserto do portao, mesma entrega. Defeito medido em producao em 31/08/2026:
-- o dono escolheu `Repasse` no seletor de categoria de UMA linha, e o valor saiu
-- de `entrou`/`saiu` sem par nenhum. A exclusao acontece por natureza `neutro`,
-- que nao sabe nada de par, entao repasse orfao vira despesa escondida atras de
-- uma categoria neutra: exatamente a exclusao silenciosa que o `repasse_id`
-- existia para impedir.
--
-- Duas peças:
--   1. a categoria deixa de ser atribuivel A MAO, e a defesa vive no SERVIDOR.
--      Sumir do seletor e conforto; recusar no `fin_classificar` e a garantia.
--   2. o `fin_painel` passa a contar repasse por `repasse_id`, e declara o ORFAO
--      em separado, para que uma linha nessa situacao apareça como PROBLEMA em
--      vez de virar numero certo por sorte.

-- =====================================================================
-- 1) Categoria que so se alcanca pelo fluxo dela
-- =====================================================================
-- Flag no servidor, nao lista chumbada no JS (C2). A tela le de fin_config.
alter table public.fin_categoria
  add column if not exists atribuivel_manual boolean not null default true;

comment on column public.fin_categoria.atribuivel_manual is
  'false = a categoria so e atribuida pelo fluxo proprio dela (repasse exige par via fin_repasse_marcar), nunca escolhida a mao no seletor.';

update public.fin_categoria
   set atribuivel_manual = false
 where codigo = 'repasse';

-- =====================================================================
-- 2) fin_config devolve a flag
-- =====================================================================
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
           'dominio_sugerido', dominio_sugerido, 'ordem', ordem,
           'atribuivel_manual', atribuivel_manual)
         order by ordem, rotulo), '[]'::json)
    into v_cats
    from public.fin_categoria
   where tenant_id = v_tenant and ativo;

  return json_build_object('ok', true, 'contas', v_contas, 'categorias', v_cats);
end
$$;
revoke all on function public.fin_config() from public;
grant execute on function public.fin_config() to authenticated, postgres, service_role;

-- =====================================================================
-- 3) fin_classificar RECUSA categoria nao atribuivel a mao
-- =====================================================================
-- Esta e a defesa de verdade. Some do seletor e so conforto: o payload da RPC
-- e publico e a tela nao e o guarda.
create or replace function public.fin_classificar(payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_ids     uuid[];
  v_has_cat boolean := jsonb_exists(payload, 'categoria_codigo');
  v_has_dom boolean := jsonb_exists(payload, 'dominio');
  v_has_obs boolean := jsonb_exists(payload, 'observacao');
  v_cat     text := nullif(btrim(coalesce(payload->>'categoria_codigo','')), '');
  v_dom     text := nullif(btrim(coalesce(payload->>'dominio','')), '');
  v_obs     text := nullif(btrim(coalesce(payload->>'observacao','')), '');
  v_n       int := 0;
  v_incoer  int := 0;
  v_aviso   text;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  if jsonb_typeof(coalesce(payload->'ids','null'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'erro', 'Informe os lancamentos a classificar.');
  end if;
  begin
    select coalesce(array_agg(x::uuid), '{}'::uuid[]) into v_ids
      from jsonb_array_elements_text(payload->'ids') x;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Lista de lancamentos invalida.');
  end;
  if array_length(v_ids, 1) is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe os lancamentos a classificar.');
  end if;

  if not v_has_cat and not v_has_dom and not v_has_obs then
    return jsonb_build_object('ok', false, 'erro', 'Nada para mudar: informe categoria, dominio ou observacao.');
  end if;

  if v_has_cat and v_cat is not null then
    if not exists (select 1 from public.fin_categoria
                    where tenant_id = v_tenant and codigo = v_cat and ativo) then
      return jsonb_build_object('ok', false, 'erro', 'Categoria desconhecida ou desativada: ' || v_cat);
    end if;
    -- Repasse so existe em PAR. Deixar escolher a mao faz o valor sair dos
    -- totais sem contraparte, que e despesa escondida atras de categoria neutra.
    if exists (select 1 from public.fin_categoria
                where tenant_id = v_tenant and codigo = v_cat and not atribuivel_manual) then
      return jsonb_build_object('ok', false, 'erro', 'Categoria nao pode ser escolhida a mao: ' || v_cat);
    end if;
  end if;

  if v_has_dom and v_dom is not null and v_dom not in ('empresa','pessoal') then
    return jsonb_build_object('ok', false, 'erro', 'Dominio invalido: use empresa ou pessoal.');
  end if;

  update public.fin_movimento m
     set categoria_codigo = case when v_has_cat then v_cat else m.categoria_codigo end,
         dominio          = case when v_has_dom then v_dom else m.dominio end,
         observacao       = case when v_has_obs then v_obs else m.observacao end,
         atualizado_em    = now()
   where m.id = any(v_ids)
     and m.tenant_id = v_tenant
     and m.arquivado_em is null
     and ( (v_has_cat and m.categoria_codigo is distinct from v_cat)
        or (v_has_dom and m.dominio          is distinct from v_dom)
        or (v_has_obs and m.observacao       is distinct from v_obs) );
  get diagnostics v_n = row_count;

  select count(*) into v_incoer
    from public.fin_movimento m
    join public.fin_categoria c
      on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
   where m.id = any(v_ids)
     and m.tenant_id = v_tenant
     and ( (c.natureza_esperada = 'entrada' and m.valor < 0)
        or (c.natureza_esperada = 'saida'   and m.valor > 0) );
  if v_incoer > 0 then
    v_aviso := v_incoer || ' lancamento(s) com sinal contrario a natureza da categoria.';
  end if;

  return jsonb_build_object('ok', true, 'n', v_n,
    'msg', v_n || ' lancamento' || case when v_n = 1 then '' else 's' end || ' classificado'
           || case when v_n = 1 then '' else 's' end || '.',
    'aviso', v_aviso);
end
$$;
revoke all on function public.fin_classificar(jsonb) from public;
grant execute on function public.fin_classificar(jsonb) to authenticated, postgres, service_role;
