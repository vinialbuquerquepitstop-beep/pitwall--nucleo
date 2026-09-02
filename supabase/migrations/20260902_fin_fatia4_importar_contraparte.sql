-- migration aplicada: 20260902052751_fin_fatia4_importar_contraparte
-- Aplicada por apply_migration em 02/09/2026. Paridade de CORPO conferida
-- contra o ledger por md5 normalizado: 2cd78f636438aaf232c48c08ee427565.

-- =====================================================================
-- Fatia 4, Etapa 1. fin_importar_extrato passa a gravar contraparte.
--
-- Corpo IDENTICO ao de 20260826133005 (fin_fatia2_importar_aplica_regras),
-- com UMA mudanca: o insert do movimento passa a preencher `contraparte`
-- chamando privado.fn_fin_contraparte, a MESMA helper que o backfill de
-- 20260902 usou. C1: motor unico. Se a importacao tivesse regex propria,
-- no dia em que a regra mudasse a linha nova nasceria com nome diferente
-- do nome que a linha velha ganhou.
--
-- Nenhuma outra linha foi tocada: nem a validacao, nem o hash de dedupe,
-- nem o fechamento da importacao, nem a aplicacao das regras da Fatia 2,
-- nem uma unica frase de recusa (a secao 4 do CONTRATO nao muda).
-- Continua sem security definer.
--
-- CREATE OR REPLACE FUNCTION reseta as ACLs para o default do Postgres,
-- entao os REVOKE/GRANT sao refeitos no fim, identicos aos que estavam
-- gravados antes desta migration:
--   postgres=X | authenticated=X | service_role=X
-- =====================================================================
create or replace function public.fin_importar_extrato(payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public', 'privado'
as $function$
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
  v_novos   uuid[] := '{}';
  v_reg     jsonb := jsonb_build_object('classificados', 0, 'por_regra', '[]'::jsonb, 'conflitos', 0);
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
    -- contraparte pela MESMA helper do backfill (C1). Ela nao entra no
    -- hash_dedupe de proposito: o hash e a identidade da linha no extrato e
    -- mudar a regra de extracao nao pode transformar linha velha em linha
    -- nova, senao a proxima importacao duplicaria a base inteira.
    insert into public.fin_movimento
      (tenant_id, conta_id, data, descricao, descricao_original, valor,
       categoria_codigo, dominio, origem, fitid, hash_dedupe, importacao_id, contraparte)
    values
      (v_tenant, v_conta.id, v_data, v_desc, v_desc, v_valor,
       null, null, 'extrato', v_fitid, v_hash, v_imp, privado.fn_fin_contraparte(v_desc))
    on conflict do nothing
    returning id into v_ins;

    if v_ins is null then
      v_dup := v_dup + 1;
    else
      v_novas := v_novas + 1;
      v_novos := v_novos || v_ins;
    end if;
  end loop;

  perform privado.fn_fin_importacao_fechar(v_imp, v_n, v_novas, v_dup);

  -- ---- 4. Fatia 2: regras ativas sobre o que ACABOU de entrar ----------
  -- Alcance seguro e escopo fechado nos ids desta importacao: nenhuma linha
  -- antiga e tocada aqui.
  if array_length(v_novos, 1) > 0
     and exists (select 1 from public.fin_regra
                  where tenant_id = v_tenant and ativo and arquivado_em is null) then
    v_reg := privado.fn_fin_aplicar_regras(v_tenant, null, v_novos, 'nao_classificados');
  end if;

  return jsonb_build_object(
    'ok', true,
    'importacao_id', v_imp,
    'novas', v_novas,
    'duplicadas', v_dup,
    'lidas', v_n,
    'periodo_ini', v_ini,
    'periodo_fim', v_fim,
    'classificados', (v_reg->>'classificados')::int,
    'classificados_por_regra', v_reg->'por_regra',
    'conflitos', (v_reg->>'conflitos')::int,
    'msg', (case when v_novas = 1 then '1 lancamento novo' else v_novas || ' lancamentos novos' end)
           || (case when v_dup = 0 then '.'
                    when v_dup = 1 then ', 1 ja existia.'
                    else ', ' || v_dup || ' ja existiam.' end)
           || (case when (v_reg->>'classificados')::int = 0 then ''
                    when (v_reg->>'classificados')::int = 1 then ' 1 ja nasceu classificado pelas regras.'
                    else ' ' || (v_reg->>'classificados')::int || ' ja nasceram classificados pelas regras.' end));
exception
  when check_violation then
    return jsonb_build_object('ok', false, 'erro', 'Lancamento recusado pelo banco: confira data, valor e descricao.');
  when unique_violation then
    return jsonb_build_object('ok', false, 'erro', 'Importacao recusada por duplicidade inesperada. Nada foi gravado.');
  when foreign_key_violation then
    return jsonb_build_object('ok', false, 'erro', 'Conta ou categoria inexistente. Nada foi gravado.');
end
$function$;

revoke all on function public.fin_importar_extrato(jsonb) from public;
grant execute on function public.fin_importar_extrato(jsonb) to authenticated, postgres, service_role;
