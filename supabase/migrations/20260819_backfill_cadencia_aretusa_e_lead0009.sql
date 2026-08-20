-- Aplicada em 19/08/2026 (migration 20260819...backfill).
-- Corrige os dois leads que a Fatia 2 listou como quebrados, agora que
-- registrar_venda ja re-ancora sozinha daqui pra frente.

do $$
declare
  v_t uuid; v_id uuid; v_vence date; v_venda date;
begin
  -- 1. Aretusa: comprou em 18/08 (VENDA-0011, R$ 4.300) e continuou na cadencia
  --    'avaliando', passo R2 D3 vencendo 20/08. Ia receber toque de VENDA depois de
  --    ja ter comprado. Ancora na data da venda: o pos-venda dela esta devido, nao futuro.
  select id, tenant_id into v_id, v_t from public.lead where lead_code = 'LEAD-0027';
  select max(data_venda) into v_venda from public.venda
   where lead_id = v_id and status <> 'cancelada';

  v_vence := privado.fn_cadencia_trocar_perfil(v_id, v_t, 'comprou', v_venda);

  update public.lead set proximo_contato = v_vence, atualizado_em = now() where id = v_id;

  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
  values (v_t, v_id, 'cadencia_iniciada',
    'Pos-venda ancorado em ' || to_char(v_vence, 'DD/MM/YYYY') || '. Correcao: a venda de 18/08 promoveu o perfil para comprou mas nao trocou a cadencia, que seguia em avaliando R2 D3.',
    null);

  -- 2. LEAD-0009 (Anderson barbeiro): unico lead ativo sem estado de cadencia.
  --    Veio do ETL de 05/07, zero eventos, nunca entrou na regua. Recebe o mesmo
  --    estado dos pares lista_fria (LEAD-0007, LEAD-0008, LEAD-0017): passo 1
  --    ENCERRADO. Lista fria e decisao da regua (invariante 3): fechar o buraco do
  --    modelo nao pode virar tarefa nova sem o dono pedir.
  insert into public.cadencia_estado
    (lead_id, tenant_id, perfil, passo_atual, passo_rotulo, passo_vence_em, encerrada)
  select l.id, l.tenant_id, l.perfil, 1, r.rotulo,
         coalesce(l.data_contato, l.criado_em::date), true
    from public.lead l
    join public.cadencia_regra r
      on r.tenant_id = l.tenant_id and r.perfil = l.perfil and r.passo = 1 and r.ativo
   where l.lead_code = 'LEAD-0009'
  on conflict (lead_id) do nothing;
end $$;
