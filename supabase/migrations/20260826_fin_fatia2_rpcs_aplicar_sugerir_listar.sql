-- migration aplicada: 20260826132924_fin_fatia2_rpcs_aplicar_sugerir_listar

-- ------------------------------------------------------------------------
-- fin_regra_aplicar(payload) -> jsonb
-- {ids: [uuid] ou ausente/null (= todas as ativas),
--  alcance: 'nao_classificados' (default, seguro) | 'todos' (sobrescreve)}
-- Empate: menor prioridade ganha; depois padrao mais LONGO; depois criado_em
-- mais recente. conflitos = quantas linhas casaram mais de uma regra.
-- ------------------------------------------------------------------------
create or replace function public.fin_regra_aplicar(payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_alc     text;
  v_ids     uuid[] := null;
  v_falta   text;
  v_r       jsonb;
  v_ncdom   int;
  v_nccat   int;
  v_n       int;
  v_conf    int;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  v_alc := coalesce(nullif(btrim(lower(coalesce(payload->>'alcance',''))), ''), 'nao_classificados');
  if v_alc not in ('nao_classificados','todos') then
    return jsonb_build_object('ok', false, 'erro',
      'Alcance invalido: use nao_classificados (padrao) ou todos.');
  end if;

  if payload ? 'ids' and jsonb_typeof(payload->'ids') = 'array' then
    if jsonb_array_length(payload->'ids') = 0 then
      return jsonb_build_object('ok', false, 'erro',
        'Lista de regras vazia. Omita a chave ids para aplicar todas as ativas.');
    end if;
    begin
      select array_agg(e::uuid) into v_ids
        from jsonb_array_elements_text(payload->'ids') e;
    exception when others then
      return jsonb_build_object('ok', false, 'erro', 'Lista de regras com id invalido.');
    end;

    select string_agg(x::text, ', ') into v_falta
      from unnest(v_ids) x
     where not exists (
       select 1 from public.fin_regra r
        where r.id = x and r.tenant_id = v_tenant and r.ativo and r.arquivado_em is null);
    if v_falta is not null then
      return jsonb_build_object('ok', false, 'erro',
        'Regra inexistente, desligada ou arquivada: ' || v_falta);
    end if;
  elsif payload ? 'ids' and payload->>'ids' is not null then
    return jsonb_build_object('ok', false, 'erro', 'ids deve ser uma lista.');
  end if;

  if not exists (select 1 from public.fin_regra
                  where tenant_id = v_tenant and ativo and arquivado_em is null) then
    return jsonb_build_object('ok', true, 'alcance', v_alc, 'classificados', 0,
      'por_regra', '[]'::jsonb, 'conflitos', 0,
      'restam_nao_classificados', (select count(*)::int from public.fin_movimento
         where tenant_id = v_tenant and arquivado_em is null and dominio is null),
      'msg', 'Nenhuma regra ativa. Nada foi alterado.');
  end if;

  v_r := privado.fn_fin_aplicar_regras(v_tenant, v_ids, null, v_alc);
  v_n    := (v_r->>'classificados')::int;
  v_conf := (v_r->>'conflitos')::int;

  select count(*) filter (where dominio is null)::int,
         count(*) filter (where categoria_codigo is null)::int
    into v_ncdom, v_nccat
    from public.fin_movimento
   where tenant_id = v_tenant and arquivado_em is null;

  return jsonb_build_object(
    'ok', true,
    'alcance', v_alc,
    'classificados', v_n,
    'por_regra', v_r->'por_regra',
    'conflitos', v_conf,
    'restam_nao_classificados', v_ncdom,
    'restam_sem_categoria', v_nccat,
    'msg', (case when v_n = 0 then 'Nada mudou: nenhum lancamento pendente casou com as regras.'
                 when v_n = 1 then '1 lancamento classificado.'
                 else v_n || ' lancamentos classificados.' end)
           || (case when v_alc = 'todos' then ' Alcance TODOS: classificacao anterior foi sobrescrita.' else '' end)
           || (case when v_conf = 0 then ''
                    when v_conf = 1 then ' 1 linha casou mais de uma regra; venceu a de menor prioridade.'
                    else ' ' || v_conf || ' linhas casaram mais de uma regra; venceu a de menor prioridade.' end)
           || (case when v_ncdom = 0 then ' Nada mais sem dominio.'
                    else ' Restam ' || v_ncdom || ' sem dominio.' end));
end
$$;

revoke all on function public.fin_regra_aplicar(jsonb) from public;
grant execute on function public.fin_regra_aplicar(jsonb) to authenticated, postgres, service_role;


-- ------------------------------------------------------------------------
-- fin_regra_sugerir(payload) -> jsonb   {movimento_id}
-- Extrai o NOME DA CONTRAPARTE. Regra: o nome e o segmento imediatamente
-- ANTES do CPF/CNPJ. Isso resolve o caso "Estorno - Transferencia ... - NOME -
-- CNPJ", em que pegar o 2o segmento devolveria "Transferencia enviada pelo
-- Pix" e a regra casaria metade do extrato. Sem CPF/CNPJ, cai no 2o segmento
-- (Compra no debito - MUDAVENDING); sem ' - ' nenhum, na descricao sem digitos.
-- NAO sugere categoria nem dominio: isso e decisao do dono (invariante 18).
-- ------------------------------------------------------------------------
create or replace function public.fin_regra_sugerir(payload jsonb)
returns jsonb
language plpgsql
stable
set search_path to 'public','privado'
as $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_mid    uuid;
  v_desc   text;
  v_txt    text;
  v_a      text[];
  v_idx    int;
  v_nome   text;
  v_fall   boolean := false;
  v_tot    int;
  v_nc     int;
  v_ex     jsonb;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  begin
    v_mid := nullif(btrim(coalesce(payload->>'movimento_id','')), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'movimento_id invalido.');
  end;
  if v_mid is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe o movimento_id.');
  end if;

  select coalesce(descricao_original, descricao) into v_desc
    from public.fin_movimento where id = v_mid and tenant_id = v_tenant;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Lancamento nao encontrado.');
  end if;

  v_txt := btrim(regexp_replace(v_desc, '\s+', ' ', 'g'));
  v_a   := regexp_split_to_array(v_txt, ' - ');

  select min(k) into v_idx
    from generate_subscripts(v_a, 1) k
   where v_a[k] ~ '^[0-9•][0-9•./-]{5,}$';

  if v_idx is not null and v_idx >= 2 then
    v_nome := v_a[v_idx - 1];
  elsif coalesce(array_length(v_a, 1), 1) >= 2 then
    v_nome := v_a[2];
  else
    v_nome := v_a[1];
  end if;

  -- raiz de CNPJ colada no nome ("57.141.157 REINALDO DA COSTA COENTRO NETO").
  -- So com os pontos, para nao comer o "99" de "99 TECNOLOGIA LTDA".
  v_nome := regexp_replace(v_nome, '^[0-9]{2}\.[0-9]{3}\.[0-9]{3}[ ]+', '');
  v_nome := regexp_replace(v_nome, '\s+[0-9]{4,}$', '');
  v_nome := btrim(regexp_replace(v_nome, '[ .,\-/]+$', ''));

  if length(regexp_replace(privado.fn_fin_norm(v_nome), '[^A-Z0-9]', '', 'g')) < 3 then
    v_nome := btrim(regexp_replace(regexp_replace(v_txt, '[0-9]', '', 'g'), '\s+', ' ', 'g'));
    v_fall := true;
  end if;
  if length(regexp_replace(privado.fn_fin_norm(v_nome), '[^A-Z0-9]', '', 'g')) < 3 then
    return jsonb_build_object('ok', false, 'erro',
      'Nao consegui extrair um padrao util desta descricao. Digite a regra na mao.');
  end if;

  select count(*)::int,
         count(*) filter (where dominio is null or categoria_codigo is null)::int
    into v_tot, v_nc
    from public.fin_movimento m
   where m.tenant_id = v_tenant and m.arquivado_em is null
     and privado.fn_fin_casa(
           privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)), v_nome, 'contem');

  select coalesce(jsonb_agg(to_jsonb(t.texto)), '[]'::jsonb) into v_ex from (
    select distinct coalesce(m.descricao_original, m.descricao) as texto
      from public.fin_movimento m
     where m.tenant_id = v_tenant and m.arquivado_em is null
       and privado.fn_fin_casa(
             privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)), v_nome, 'contem')
     order by 1 limit 5
  ) t;

  return jsonb_build_object(
    'ok', true,
    'movimento_id', v_mid,
    'descricao', v_desc,
    'padrao', v_nome,
    'tipo_match', 'contem',
    'origem', 'aprendida',
    'fallback', v_fall,
    'casaria_n', v_tot,
    'casaria_nao_classificados', v_nc,
    'exemplos', v_ex,
    'msg', (case when v_tot <= 1 then 'Essa regra pega so este lancamento por enquanto.'
                 else 'Essa regra pega outros ' || (v_tot - 1) || '.' end));
end
$$;

revoke all on function public.fin_regra_sugerir(jsonb) from public;
grant execute on function public.fin_regra_sugerir(jsonb) to authenticated, postgres, service_role;


-- ------------------------------------------------------------------------
-- fin_regras() -> json
-- Lista as regras NAO ARQUIVADAS (inclui as desligadas, com o flag ativo:
-- filtrar por ativo esconderia da tela a regra pausada e ela ficaria orfa).
-- casaria_hoje = quantos lancamentos ela classificaria AGORA no alcance seguro.
-- ------------------------------------------------------------------------
create or replace function public.fin_regras()
returns json
language plpgsql
stable
set search_path to 'public','privado'
as $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_lista  json;
  v_ncdom  int;
  v_nccat  int;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Financeiro e restrito ao dono.');
  end if;

  select count(*) filter (where dominio is null)::int,
         count(*) filter (where categoria_codigo is null)::int
    into v_ncdom, v_nccat
    from public.fin_movimento
   where tenant_id = v_tenant and arquivado_em is null;

  select coalesce(json_agg(x order by x.prioridade, x.aplicada_n desc, x.padrao), '[]'::json)
    into v_lista
  from (
    select r.id, r.padrao, r.tipo_match,
           r.categoria_codigo, c.rotulo as categoria_rotulo, c.grupo as categoria_grupo,
           r.dominio, r.prioridade, r.origem, r.ativo,
           r.aplicada_n, r.ultima_aplicacao, r.criado_em,
           (select count(*)::int
              from public.fin_movimento m
             where m.tenant_id = v_tenant
               and m.arquivado_em is null
               and ( (r.dominio is not null and m.dominio is null)
                  or (r.categoria_codigo is not null and m.categoria_codigo is null) )
               and privado.fn_fin_casa(
                     privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)),
                     r.padrao, r.tipo_match)) as casaria_hoje
      from public.fin_regra r
      left join public.fin_categoria c
        on c.tenant_id = r.tenant_id and c.codigo = r.categoria_codigo
     where r.tenant_id = v_tenant and r.arquivado_em is null
  ) x;

  return json_build_object(
    'ok', true,
    'regras', v_lista,
    'nao_classificados', v_ncdom,
    'sem_categoria', v_nccat);
end
$$;

revoke all on function public.fin_regras() from public;
grant execute on function public.fin_regras() to authenticated, postgres, service_role;
