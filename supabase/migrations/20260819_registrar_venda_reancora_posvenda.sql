-- Aplicada em 19/08/2026 (migration registrar_venda_reancora_posvenda_e_dedup_por_sufixo).
--
-- Fatia 2, item que faltava: registrar_venda promovia o lead a perfil 'comprou' mas
-- NAO re-ancorava cadencia_estado. Resultado medido em 19/08/2026: Aretusa (LEAD-0027)
-- fechou R$ 4.300 e continuava na cadencia 'avaliando', passo R2 D3 vencendo em 20/08,
-- ou seja, o sistema ia cobrar toque de VENDA de quem ja comprou. E, do outro lado, o
-- motor de pos-venda nunca recebia quem fecha venda agora.
--
-- Duas correcoes nesta funcao:
--   a) a busca do cliente existente compara o SUFIXO do telefone (mesmo criterio do
--      indice lead_tenant_whats_uniq) e ignora arquivados;
--   b) venda nao cancelada re-ancora a regua no P1 de pos-venda.
--
-- Decisao registrada: venda nova REINICIA o pos-venda no P1. O P1/P2 sao sobre a
-- entrega do aparelho recem-comprado; quem acabou de comprar nao pode receber
-- "quer fazer upgrade?" (P5) no lugar de "chegou tudo certo?".
-- O prazo NAO e hardcoded aqui: fn_cadencia_trocar_perfil le dias_offset da
-- cadencia_regra (invariante 11).
create or replace function public.registrar_venda(payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'privado'
as $function$
declare
  v_id uuid; v_code text; v_tenant uuid := privado.fn_tenant_atual();
  v_lead public.lead%rowtype;
  v_lead_id uuid; v_novo boolean := false;
  v_dig text; v_nome text; v_num int; v_lead_code text;
  v_moto text;
  v_status text := coalesce(nullif(payload->>'status',''), 'concluida');
  v_etapa  text := coalesce(nullif(payload->>'etapa',''), 'pendente');
  v_valor numeric;
  v_vence date;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida');
  end if;
  v_valor := coalesce((payload->>'valor_venda')::numeric, 0);
  if v_valor <= 0 then
    return jsonb_build_object('ok', false, 'erro', 'valor_venda obrigatorio');
  end if;
  if nullif(payload->>'modelo_id','') is null and nullif(payload->>'modelo_texto','') is null then
    return jsonb_build_object('ok', false, 'erro', 'modelo obrigatorio');
  end if;
  if v_etapa not in ('pendente','a_retirar','em_maos','a_caminho','entregue') then
    return jsonb_build_object('ok', false, 'erro', 'Etapa invalida: ' || v_etapa);
  end if;

  -- ---- 1. o cliente, antes de tudo ----------------------------------------
  v_lead_id := nullif(payload->>'lead_id','')::uuid;
  v_nome := nullif(trim(coalesce(payload->>'comprador_nome','')), '');
  v_dig  := nullif(regexp_replace(coalesce(payload->>'comprador_whatsapp',''), '\D', '', 'g'), '');
  if v_dig is not null and length(v_dig) in (10,11) then v_dig := '55' || v_dig; end if;
  if v_dig is not null and v_dig !~ '^[0-9]{10,15}$' then
    return jsonb_build_object('ok', false, 'erro', 'Telefone invalido apos normalizacao: ' || v_dig);
  end if;

  -- mesma normalizacao para o telefone do motoboy (relatorio de entrega)
  v_moto := nullif(regexp_replace(coalesce(payload->>'motoboy_whatsapp',''), '\D', '', 'g'), '');
  if v_moto is not null and length(v_moto) in (10,11) then v_moto := '55' || v_moto; end if;
  if v_moto is not null and v_moto !~ '^[0-9]{10,15}$' then
    return jsonb_build_object('ok', false, 'erro', 'WhatsApp do motoboy invalido: ' || v_moto);
  end if;

  if v_lead_id is not null then
    select * into v_lead from public.lead where id = v_lead_id and tenant_id = v_tenant;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Cliente nao encontrado neste tenant');
    end if;
  else
    if v_dig is not null then
      -- casa pelo SUFIXO, nao por texto exato: numero com e sem DDI e a mesma pessoa.
      -- Ignora arquivado, senao a venda ficaria pendurada em quem saiu da base.
      select * into v_lead from public.lead
       where tenant_id = v_tenant
         and arquivado_em is null
         and whatsapp_digitos is not null
         and right(whatsapp_digitos, 11) = right(v_dig, 11)
       limit 1;
      if found then v_lead_id := v_lead.id; end if;
    end if;
    if v_lead_id is null then
      if v_nome is null then
        return jsonb_build_object('ok', false, 'erro',
          'Toda venda precisa de cliente: escolha alguem da base ou informe o nome do comprador');
      end if;
      perform pg_advisory_xact_lock(hashtext('lead_code_' || v_tenant::text));
      select coalesce(max(nullif(regexp_replace(lead_code, '\D', '', 'g'), '')::int), 0) + 1
        into v_num from public.lead where tenant_id = v_tenant;
      v_lead_code := 'LEAD-' || lpad(v_num::text, 4, '0');
      insert into public.lead (
        tenant_id, lead_code, dono_user_id, nome, whatsapp_digitos, produto, condicao,
        perfil, status, data_contato, consentimento, consentimento_em, data_nascimento
      ) values (
        v_tenant, v_lead_code, auth.uid(), v_nome, v_dig,
        nullif(trim(coalesce(payload->>'modelo_texto','') || coalesce(' ' || nullif(payload->>'capacidade',''), '')), ''),
        nullif(payload->>'condicao',''),
        'comprou', 'convertido', (now() at time zone 'America/Sao_Paulo')::date,
        true, now(), nullif(payload->>'comprador_nascimento','')::date
      ) returning * into v_lead;
      v_lead_id := v_lead.id; v_novo := true;
      insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
      values (v_tenant, v_lead_id, 'cadastro', 'Cadastrado no registro da venda', auth.uid());
    end if;
  end if;

  -- ---- 2. a venda ----------------------------------------------------------
  insert into public.venda (
    tenant_id, lead_id, comprador_nome, comprador_whatsapp, comprador_cpf,
    comprador_nascimento, comprador_instagram, modelo_id, modelo_texto, capacidade, cor, condicao, imei,
    fornecedor_nome, fornecedor_contato, fornecedor_local_retirada,
    valor_venda, custo_aparelho, despesa_frete, despesa_taxas,
    tem_trade_in, entrada_modelo, entrada_imei, entrada_valor,
    nf_numero, status, etapa, etapa_em, endereco_entrega, valor_a_cobrar,
    motoboy, motoboy_whatsapp, forma_pagamento, data_venda, observacoes, criado_por
  ) values (
    v_tenant, v_lead_id,
    coalesce(v_nome, v_lead.nome), coalesce(v_dig, v_lead.whatsapp_digitos),
    payload->>'comprador_cpf', nullif(payload->>'comprador_nascimento','')::date, payload->>'comprador_instagram',
    nullif(payload->>'modelo_id','')::uuid, nullif(payload->>'modelo_texto',''), payload->>'capacidade', payload->>'cor',
    nullif(payload->>'condicao',''), payload->>'imei',
    payload->>'fornecedor_nome', payload->>'fornecedor_contato', payload->>'fornecedor_local_retirada',
    v_valor, nullif(payload->>'custo_aparelho','')::numeric,
    nullif(payload->>'despesa_frete','')::numeric, nullif(payload->>'despesa_taxas','')::numeric,
    coalesce((payload->>'tem_trade_in')::boolean,false), payload->>'entrada_modelo', payload->>'entrada_imei',
    nullif(payload->>'entrada_valor','')::numeric,
    payload->>'nf_numero', v_status, v_etapa, now(),
    payload->>'endereco_entrega', nullif(payload->>'valor_a_cobrar','')::numeric,
    payload->>'motoboy', v_moto, nullif(payload->>'forma_pagamento',''), nullif(payload->>'data_venda','')::date,
    payload->>'observacoes', auth.uid()
  ) returning id, venda_code into v_id, v_code;

  -- ---- 3. o lead vira cliente -----------------------------------------------
  -- Venda cancelada nao promove ninguem: cliente e quem comprou, nao quem tentou.
  if v_status <> 'cancelada' then
    update public.lead set
      perfil = 'comprou',
      status = case when status = 'cancelado' then status else 'convertido' end,
      -- identidade so PREENCHE buraco, nunca sobrescreve o cadastro existente
      cpf = case when cpf is null and privado.fn_cpf_valido(payload->>'comprador_cpf')
                  and not exists (select 1 from public.lead x
                                   where x.tenant_id = v_tenant and x.id <> v_lead_id
                                     and x.arquivado_em is null
                                     and x.cpf = regexp_replace(payload->>'comprador_cpf', '\D', '', 'g'))
                 then regexp_replace(payload->>'comprador_cpf', '\D', '', 'g') else cpf end,
      data_nascimento = coalesce(data_nascimento, nullif(payload->>'comprador_nascimento','')::date),
      atualizado_em = now()
    where id = v_lead_id and tenant_id = v_tenant
    returning * into v_lead;

    insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
    values (v_tenant, v_lead_id, 'fechou',
            v_code || ' registrada: ' || coalesce(nullif(payload->>'modelo_texto',''), 'aparelho')
            || ' por ' || privado.fn_brl(v_valor), auth.uid());

    -- ---- 3.1 quem comprou entra na regua de POS-VENDA -----------------------
    -- Sem isto o lead ficava com perfil 'comprou' e cadencia do perfil antigo:
    -- cobrava toque de venda de quem ja comprou, e o motor de pos-venda ficava vazio.
    v_vence := privado.fn_cadencia_trocar_perfil(v_lead_id, v_tenant, 'comprou', null);
    if v_vence is not null then
      update public.lead set proximo_contato = v_vence, atualizado_em = now()
       where id = v_lead_id;
      insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
      values (v_tenant, v_lead_id, 'cadencia_iniciada',
              'Pos-venda ancorado em ' || to_char(v_vence, 'DD/MM/YYYY') || ' apos ' || v_code,
              auth.uid());
    end if;
  else
    select * into v_lead from public.lead where id = v_lead_id and tenant_id = v_tenant;
  end if;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'venda_code', v_code,
    'lead_id', v_lead_id, 'lead_code', v_lead.lead_code,
    'cliente_nome', v_lead.nome, 'cliente_novo', v_novo,
    'etapa', v_etapa
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'erro', 'Ja existe cliente com esse WhatsApp ou CPF; busque na base e vincule');
end $function$;

-- CREATE OR REPLACE FUNCTION reseta ACL: grants refeitos explicitamente
revoke all on function public.registrar_venda(jsonb) from public;
grant execute on function public.registrar_venda(jsonb) to authenticated, service_role, postgres;
