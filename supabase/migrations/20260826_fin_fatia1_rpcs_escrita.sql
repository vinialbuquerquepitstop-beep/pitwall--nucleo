-- migration aplicada: 20260826015046_fin_fatia1_rpcs_escrita

-- ------------------------------------------------------------------------
-- helper privado: fecha as contagens da importacao.
-- authenticated NAO tem UPDATE em fin_importacao (append-only, invariante 6);
-- a unica escrita permitida e esta, no molde de privado.fn_venda_nf_numero.
-- ------------------------------------------------------------------------
create or replace function privado.fn_fin_importacao_fechar(
  p_id uuid, p_lidas int, p_novas int, p_dup int
) returns void
language plpgsql
security definer
set search_path to 'public','privado'
as $$
begin
  update public.fin_importacao
     set linhas_lidas      = p_lidas,
         linhas_novas      = p_novas,
         linhas_duplicadas = p_dup
   where id = p_id
     and tenant_id = privado.fn_tenant_atual();
end
$$;
revoke all on function privado.fn_fin_importacao_fechar(uuid,int,int,int) from public;
grant execute on function privado.fn_fin_importacao_fechar(uuid,int,int,int) to authenticated;

-- ------------------------------------------------------------------------
-- fin_importar_extrato(payload jsonb)
-- ------------------------------------------------------------------------
create or replace function public.fin_importar_extrato(payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_conta   public.fin_conta%rowtype;
  v_itens   jsonb := coalesce(payload->'itens', '[]'::jsonb);
  v_norm    jsonb := '[]'::jsonb;
  v_occ     jsonb := '{}'::jsonb;
  it        jsonb;
  v_n       int := 0;
  v_raw     text;
  v_data    date;
  v_valor   numeric;
  v_desc    text;
  v_fitid   text;
  v_min     date;
  v_max     date;
  v_ini     date;
  v_fim     date;
  v_saldo   numeric;
  v_arq     text;
  v_banco   text;
  v_imp     uuid;
  v_novas   int := 0;
  v_dup     int := 0;
  v_key     text;
  v_i       int;
  v_hash    text;
  v_ins     uuid;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  -- ---- conta ------------------------------------------------------------
  select * into v_conta
    from public.fin_conta
   where id = nullif(payload->>'conta_id','')::uuid
     and tenant_id = v_tenant;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Conta nao encontrada.');
  end if;
  if not v_conta.ativo then
    return jsonb_build_object('ok', false, 'erro', 'Conta desativada: reative antes de importar.');
  end if;

  if jsonb_typeof(v_itens) <> 'array' or jsonb_array_length(v_itens) = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Nenhum lancamento no arquivo.');
  end if;

  -- ---- 1. valida item a item ANTES de escrever qualquer linha -----------
  for it in select * from jsonb_array_elements(v_itens) loop
    v_n := v_n + 1;

    v_raw := btrim(coalesce(it->>'data',''));
    if v_raw = '' then
      return jsonb_build_object('ok', false, 'erro', 'Data ausente na linha ' || v_n || '.');
    end if;
    begin
      if v_raw ~ '^[0-9]{8}' then
        v_data := to_date(substr(v_raw,1,8), 'YYYYMMDD');
      else
        v_data := v_raw::date;
      end if;
    exception when others then
      return jsonb_build_object('ok', false, 'erro', 'Data invalida na linha ' || v_n || ': ' || v_raw);
    end;

    begin
      v_valor := round(nullif(btrim(replace(coalesce(it->>'valor',''), ',', '.')), '')::numeric, 2);
    exception when others then
      return jsonb_build_object('ok', false, 'erro', 'Valor invalido na linha ' || v_n || '.');
    end;
    if v_valor is null or v_valor = 0 then
      return jsonb_build_object('ok', false, 'erro', 'Valor invalido na linha ' || v_n || '.');
    end if;

    v_desc := nullif(btrim(coalesce(it->>'descricao','')), '');
    if v_desc is null then
      return jsonb_build_object('ok', false, 'erro', 'Descricao vazia na linha ' || v_n || '.');
    end if;

    v_fitid := nullif(btrim(coalesce(it->>'fitid','')), '');

    if v_min is null or v_data < v_min then v_min := v_data; end if;
    if v_max is null or v_data > v_max then v_max := v_data; end if;

    v_norm := v_norm || jsonb_build_object(
      'data', v_data, 'valor', v_valor, 'descricao', v_desc, 'fitid', v_fitid);
  end loop;

  -- ---- 2. cabecalho da importacao --------------------------------------
  begin
    v_ini := nullif(btrim(coalesce(payload->>'periodo_ini','')), '')::date;
    v_fim := nullif(btrim(coalesce(payload->>'periodo_fim','')), '')::date;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Periodo informado invalido.');
  end;
  v_ini := coalesce(v_ini, v_min);
  v_fim := coalesce(v_fim, v_max);
  begin
    v_saldo := round(nullif(btrim(replace(coalesce(payload->>'saldo_final_informado',''), ',', '.')), '')::numeric, 2);
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Saldo final informado invalido.');
  end;
  v_arq   := nullif(btrim(coalesce(payload->>'arquivo','')), '');
  v_banco := nullif(btrim(coalesce(payload->>'banco','')), '');

  if v_arq is not null and v_arq not like v_tenant::text || '/%' then
    return jsonb_build_object('ok', false, 'erro', 'Caminho do arquivo fora da pasta do tenant.');
  end if;

  insert into public.fin_importacao
    (tenant_id, conta_id, arquivo, banco, periodo_ini, periodo_fim, saldo_final_informado, linhas_lidas)
  values
    (v_tenant, v_conta.id, v_arq, v_banco, v_ini, v_fim, v_saldo, v_n)
  returning id into v_imp;

  -- ---- 3. insere os movimentos -----------------------------------------
  v_i := 0;
  for it in select * from jsonb_array_elements(v_norm) loop
    v_i     := v_i + 1;
    v_data  := (it->>'data')::date;
    v_valor := (it->>'valor')::numeric;
    v_desc  := it->>'descricao';
    v_fitid := nullif(it->>'fitid','');

    -- ocorrencia: a n-esima linha IDENTICA dentro deste mesmo arquivo.
    -- Sem ela, duas compras iguais no mesmo dia colidiriam no hash e uma
    -- sumiria calada do caixa. Reimportar o mesmo arquivo reproduz os mesmos
    -- contadores, entao a trava contra reimportacao continua fechada.
    v_key := md5(v_conta.id::text || '|' || v_data::text || '|' ||
                 trim(to_char(v_valor,'FM99999999990.00')) || '|' || v_desc);
    v_occ := jsonb_set(v_occ, array[v_key],
               to_jsonb(coalesce((v_occ->>v_key)::int, 0) + 1), true);
    v_hash := md5(v_conta.id::text || '|' || v_data::text || '|' ||
                  trim(to_char(v_valor,'FM99999999990.00')) || '|' || v_desc || '|' ||
                  (v_occ->>v_key));

    v_ins := null;
    insert into public.fin_movimento
      (tenant_id, conta_id, data, descricao, descricao_original, valor,
       categoria_codigo, dominio, origem, fitid, hash_dedupe, importacao_id)
    values
      (v_tenant, v_conta.id, v_data, v_desc, v_desc, v_valor,
       null, null, 'extrato', v_fitid, v_hash, v_imp)
    on conflict do nothing
    returning id into v_ins;

    if v_ins is null then v_dup := v_dup + 1; else v_novas := v_novas + 1; end if;
  end loop;

  perform privado.fn_fin_importacao_fechar(v_imp, v_n, v_novas, v_dup);

  return jsonb_build_object(
    'ok', true,
    'importacao_id', v_imp,
    'novas', v_novas,
    'duplicadas', v_dup,
    'lidas', v_n,
    'periodo_ini', v_ini,
    'periodo_fim', v_fim,
    'msg', (case when v_novas = 1 then '1 lancamento novo' else v_novas || ' lancamentos novos' end)
           || (case when v_dup = 0 then '.'
                    when v_dup = 1 then ', 1 ja existia.'
                    else ', ' || v_dup || ' ja existiam.' end));
exception
  when check_violation then
    return jsonb_build_object('ok', false, 'erro', 'Lancamento recusado pelo banco: confira data, valor e descricao.');
  when unique_violation then
    return jsonb_build_object('ok', false, 'erro', 'Importacao recusada por duplicidade inesperada. Nada foi gravado.');
  when foreign_key_violation then
    return jsonb_build_object('ok', false, 'erro', 'Conta ou categoria inexistente. Nada foi gravado.');
end
$$;
revoke all on function public.fin_importar_extrato(jsonb) from public;
grant execute on function public.fin_importar_extrato(jsonb) to authenticated, postgres, service_role;

-- ------------------------------------------------------------------------
-- fin_classificar(payload jsonb)
-- ------------------------------------------------------------------------
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
     and m.arquivado_em is null
     and ( (c.natureza_esperada = 'entrada' and m.valor < 0)
        or (c.natureza_esperada = 'saida'   and m.valor > 0) );

  if v_incoer > 0 then
    v_aviso := (case when v_incoer = 1 then '1 lancamento ficou' else v_incoer || ' lancamentos ficaram' end)
               || ' com o sinal do valor contrario a natureza da categoria. Confira se a categoria e a certa.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'n', v_n,
    'aviso', v_aviso,
    'msg', case when v_n = 0 then 'Nada mudou: os lancamentos ja estavam assim.'
                when v_n = 1 then '1 lancamento classificado.'
                else v_n || ' lancamentos classificados.' end);
exception
  when foreign_key_violation then
    return jsonb_build_object('ok', false, 'erro', 'Categoria desconhecida neste tenant.');
  when check_violation then
    return jsonb_build_object('ok', false, 'erro', 'Classificacao recusada pelo banco: confira o dominio.');
end
$$;
revoke all on function public.fin_classificar(jsonb) from public;
grant execute on function public.fin_classificar(jsonb) to authenticated, postgres, service_role;

-- ------------------------------------------------------------------------
-- fin_lancar(payload jsonb)  -- dinheiro vivo nao aparece no OFX
-- ------------------------------------------------------------------------
create or replace function public.fin_lancar(payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_conta  public.fin_conta%rowtype;
  v_data   date;
  v_raw    text;
  v_valor  numeric;
  v_desc   text;
  v_cat    text := nullif(btrim(coalesce(payload->>'categoria_codigo','')), '');
  v_dom    text := nullif(btrim(coalesce(payload->>'dominio','')), '');
  v_obs    text := nullif(btrim(coalesce(payload->>'observacao','')), '');
  v_forcar boolean := coalesce((payload->>'forcar')::boolean, false);
  v_occ    int;
  v_hash   text;
  v_id     uuid;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  select * into v_conta
    from public.fin_conta
   where id = nullif(payload->>'conta_id','')::uuid
     and tenant_id = v_tenant;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Conta nao encontrada.');
  end if;
  if not v_conta.ativo then
    return jsonb_build_object('ok', false, 'erro', 'Conta desativada: reative antes de lancar.');
  end if;

  v_raw := nullif(btrim(coalesce(payload->>'data','')), '');
  begin
    v_data := coalesce(v_raw::date, v_hoje);
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Data invalida.');
  end;
  v_data := coalesce(v_data, v_hoje);

  begin
    v_valor := round(nullif(btrim(replace(coalesce(payload->>'valor',''), ',', '.')), '')::numeric, 2);
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Valor invalido.');
  end;
  if v_valor is null or v_valor = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Informe o valor: negativo e saida, positivo e entrada.');
  end if;

  v_desc := nullif(btrim(coalesce(payload->>'descricao','')), '');
  if v_desc is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe a descricao.');
  end if;

  if v_cat is not null and not exists (
       select 1 from public.fin_categoria
        where tenant_id = v_tenant and codigo = v_cat and ativo) then
    return jsonb_build_object('ok', false, 'erro', 'Categoria desconhecida ou desativada: ' || v_cat);
  end if;
  if v_dom is not null and v_dom not in ('empresa','pessoal') then
    return jsonb_build_object('ok', false, 'erro', 'Dominio invalido: use empresa ou pessoal.');
  end if;

  select count(*) into v_occ
    from public.fin_movimento
   where tenant_id = v_tenant
     and conta_id  = v_conta.id
     and data      = v_data
     and valor     = v_valor
     and coalesce(descricao_original, descricao) = v_desc
     and arquivado_em is null;

  if v_occ > 0 and not v_forcar then
    return jsonb_build_object('ok', false,
      'erro', 'Ja existe um lancamento igual nesse dia.',
      'repetido', true,
      'dica', 'Se aconteceu de verdade duas vezes, reenvie com forcar = true.');
  end if;

  v_hash := md5(v_conta.id::text || '|' || v_data::text || '|' ||
                trim(to_char(v_valor,'FM99999999990.00')) || '|' || v_desc || '|' || (v_occ + 1));

  insert into public.fin_movimento
    (tenant_id, conta_id, data, descricao, descricao_original, valor,
     categoria_codigo, dominio, origem, fitid, hash_dedupe, observacao)
  values
    (v_tenant, v_conta.id, v_data, v_desc, null, v_valor,
     v_cat, v_dom, 'manual', null, v_hash, v_obs)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'data', v_data, 'valor', v_valor,
    'msg', (case when v_valor < 0 then 'Saida de ' else 'Entrada de ' end)
           || privado.fn_brl(abs(v_valor)) || ' lancada em ' || to_char(v_data,'DD/MM/YYYY') || '.');
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'erro', 'Ja existe um lancamento igual nesse dia.', 'repetido', true);
  when check_violation then
    return jsonb_build_object('ok', false, 'erro', 'Lancamento recusado pelo banco: confira valor, origem e dominio.');
  when foreign_key_violation then
    return jsonb_build_object('ok', false, 'erro', 'Conta ou categoria inexistente.');
end
$$;
revoke all on function public.fin_lancar(jsonb) from public;
grant execute on function public.fin_lancar(jsonb) to authenticated, postgres, service_role;
