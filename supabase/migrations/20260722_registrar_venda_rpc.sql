create or replace function public.registrar_venda(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, privado as $$
declare v_id uuid; v_code text; v_tenant uuid := privado.fn_tenant_atual();
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'sem tenant');
  end if;
  if coalesce((payload->>'valor_venda')::numeric, 0) <= 0 then
    return jsonb_build_object('ok', false, 'erro', 'valor_venda obrigatorio');
  end if;
  if nullif(payload->>'modelo_id','') is null then
    return jsonb_build_object('ok', false, 'erro', 'modelo obrigatorio');
  end if;
  insert into public.venda (
    tenant_id, lead_id, comprador_nome, comprador_whatsapp, comprador_cpf,
    comprador_nascimento, comprador_instagram, modelo_id, capacidade, cor, condicao, imei,
    fornecedor_nome, fornecedor_contato, fornecedor_local_retirada,
    valor_venda, custo_aparelho, despesa_frete, despesa_taxas,
    tem_trade_in, entrada_modelo, entrada_imei, entrada_valor,
    nf_numero, status, endereco_entrega, valor_a_cobrar,
    motoboy, forma_pagamento, data_venda, observacoes, criado_por
  ) values (
    v_tenant,
    nullif(payload->>'lead_id','')::uuid, payload->>'comprador_nome', payload->>'comprador_whatsapp',
    payload->>'comprador_cpf', nullif(payload->>'comprador_nascimento','')::date, payload->>'comprador_instagram',
    nullif(payload->>'modelo_id','')::uuid, payload->>'capacidade', payload->>'cor',
    nullif(payload->>'condicao',''), payload->>'imei',
    payload->>'fornecedor_nome', payload->>'fornecedor_contato', payload->>'fornecedor_local_retirada',
    (payload->>'valor_venda')::numeric, nullif(payload->>'custo_aparelho','')::numeric,
    nullif(payload->>'despesa_frete','')::numeric, nullif(payload->>'despesa_taxas','')::numeric,
    coalesce((payload->>'tem_trade_in')::boolean,false), payload->>'entrada_modelo', payload->>'entrada_imei',
    nullif(payload->>'entrada_valor','')::numeric,
    payload->>'nf_numero', coalesce(nullif(payload->>'status',''),'concluida'),
    payload->>'endereco_entrega', nullif(payload->>'valor_a_cobrar','')::numeric,
    payload->>'motoboy', nullif(payload->>'forma_pagamento',''), nullif(payload->>'data_venda','')::date,
    payload->>'observacoes', auth.uid()
  ) returning id, venda_code into v_id, v_code;
  return jsonb_build_object('ok', true, 'id', v_id, 'venda_code', v_code);
end $$;

revoke all on function public.registrar_venda(jsonb) from public, anon;
grant execute on function public.registrar_venda(jsonb) to authenticated;
