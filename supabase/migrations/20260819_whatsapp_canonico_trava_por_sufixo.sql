-- Aplicada em 19/08/2026 (migration 20260819221335).
--
-- Causa raiz: editar_lead gravava o telefone sem canonicalizar o DDI 55, enquanto
-- cadastrar_lead e registrar_venda canonicalizam. O UNIQUE (tenant_id, whatsapp_digitos)
-- comparava textos diferentes para o mesmo numero e deixava passar a duplicata.
-- Caso real: Aretusa virou LEAD-0027 ('21969683300') e LEAD-0030 ('5521969683300').
--
-- Esta migration troca a trava por uma que compara o SUFIXO do numero (imune a formato)
-- e funde os dois registros da mesma pessoa.

-- 1. a trava antiga sai: comparava texto exato e era total (lead arquivado prendia o numero)
alter table public.lead drop constraint lead_tenant_id_whatsapp_digitos_key;

do $$
declare
  v_t    uuid;
  v_orig uuid;
  v_dup  uuid;
  v_antes text;
begin
  select id, tenant_id, whatsapp_digitos into v_orig, v_t, v_antes
    from public.lead where lead_code = 'LEAD-0027';
  select id into v_dup from public.lead where lead_code = 'LEAD-0030';

  if v_orig is null or v_dup is null then
    raise exception 'LEAD-0027 ou LEAD-0030 nao encontrado: fusao abortada';
  end if;

  -- 2. a duplicata e arquivada com a mesma semantica de arquivar_lead()
  update public.lead set arquivado_em = now(), atualizado_em = now()
   where id = v_dup and arquivado_em is null;

  perform privado.fn_cadencia_encerrar(v_dup);

  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
  values (v_t, v_dup, 'arquivado',
    'Arquivado: duplicata de LEAD-0027, mesma pessoa. O WhatsApp do LEAD-0027 tinha sido gravado sem o DDI 55 por editar_lead, entao a trava nao enxergou o par. A consulta de 18/08/2026 foi migrada para o historico do LEAD-0027.',
    null);

  -- 3. a informacao real que so existia na duplicata e preservada no lead que fica
  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
  values (v_t, v_orig, 'nota',
    'Consulta de 18/08/2026 01:48: IPhone 14 512GB, origem indicacao. Veio do LEAD-0030, duplicata desta mesma pessoa, arquivado em 19/08/2026.',
    null);

  -- 4. o telefone do lead que fica volta ao formato canonico 55+DDD
  update public.lead
     set whatsapp_digitos = '55' || whatsapp_digitos, atualizado_em = now()
   where id = v_orig and length(whatsapp_digitos) in (10, 11);

  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
  values (v_t, v_orig, 'nota',
    'WhatsApp corrigido de ' || v_antes || ' para ' || (select whatsapp_digitos from public.lead where id = v_orig) || ' (formato canonico 55+DDD).',
    null);
end $$;

-- 5. a trava nova: compara o sufixo, entao 21969683300 e 5521969683300 colidem.
--    Parcial em arquivado_em is null, no mesmo padrao do lead_tenant_cpf_uniq que ja existia:
--    lead arquivado devolve o numero para a base.
create unique index lead_tenant_whats_uniq
  on public.lead (tenant_id, right(whatsapp_digitos, 11))
  where whatsapp_digitos is not null and arquivado_em is null;

comment on index public.lead_tenant_whats_uniq is
  'Identidade do lead e o telefone. Compara os 11 ultimos digitos para que formato (com ou sem DDI 55) nao abra brecha de duplicata. Substituiu lead_tenant_id_whatsapp_digitos_key em 19/08/2026.';
