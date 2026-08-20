-- Aplicada em 19/08/2026 (migration 20260819221406).
--
-- editar_lead era a unica das tres portas de escrita de telefone que nao
-- canonicalizava o DDI 55 (cadastrar_lead e registrar_venda sempre fizeram).
-- Editar um lead salvando o numero como DDD+numero tirava o registro do formato
-- canonico e cegava a trava de duplicata. Alem disso, campo vazio apagava o
-- telefone, que e a identidade do lead.
create or replace function public.editar_lead(
  p_lead_id uuid, p_nome text, p_whatsapp text, p_produto text, p_condicao text,
  p_perfil text, p_origem text, p_indicado_por text, p_observacoes text,
  p_aparelho_entrada text, p_upgrade_entrada boolean, p_valor_oferta numeric,
  p_proximo_contato date, p_data_nascimento date)
 returns json
 language plpgsql
 set search_path to 'public', 'privado'
as $function$
declare
  v_lead public.lead%rowtype;
  v_digitos text; v_perfil_antes text; v_vence date;
  v_tenant uuid; v_atual text; v_existente record;
begin
  if nullif(trim(coalesce(p_nome,'')), '') is null then
    return json_build_object('ok', false, 'msg', 'Nome e obrigatorio');
  end if;

  select perfil, whatsapp_digitos, tenant_id
    into v_perfil_antes, v_atual, v_tenant
    from public.lead where id = p_lead_id;

  -- normalizacao identica a cadastrar_lead e registrar_venda: DDD+numero ganha o 55
  v_digitos := nullif(regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g'), '');
  if v_digitos is not null and length(v_digitos) in (10, 11) then
    v_digitos := '55' || v_digitos;
  end if;
  if v_digitos is not null and v_digitos !~ '^[0-9]{10,15}$' then
    return json_build_object('ok', false,
      'msg', 'Telefone invalido apos normalizacao: ' || v_digitos);
  end if;

  -- campo vazio NAO apaga o telefone de quem tem: o numero e a identidade do lead
  if v_digitos is null then
    v_digitos := v_atual;
  end if;

  -- aviso amigavel de duplicata, no mesmo criterio de sufixo do indice lead_tenant_whats_uniq
  if v_digitos is not null then
    select lead_code, nome into v_existente
      from public.lead
     where tenant_id = v_tenant
       and id <> p_lead_id
       and arquivado_em is null
       and whatsapp_digitos is not null
       and right(whatsapp_digitos, 11) = right(v_digitos, 11)
     limit 1;
    if found then
      return json_build_object('ok', false, 'duplicado', true,
        'msg', 'Ja existe outro lead com esse WhatsApp: ' || v_existente.nome
               || ' (' || v_existente.lead_code || ')');
    end if;
  end if;

  update public.lead
     set nome = trim(p_nome), whatsapp_digitos = v_digitos, produto = p_produto,
         condicao = p_condicao, perfil = p_perfil, origem = p_origem,
         indicado_por = nullif(trim(coalesce(p_indicado_por,'')), ''),
         observacoes = nullif(trim(coalesce(p_observacoes,'')), ''),
         aparelho_entrada = nullif(trim(coalesce(p_aparelho_entrada,'')), ''),
         upgrade_entrada = coalesce(p_upgrade_entrada, false),
         valor_oferta = p_valor_oferta, proximo_contato = p_proximo_contato,
         data_nascimento = p_data_nascimento, atualizado_em = now()
   where id = p_lead_id and arquivado_em is null
   returning * into v_lead;

  if not found then
    return json_build_object('ok', false, 'msg', 'Lead nao encontrado, arquivado ou sem permissao');
  end if;

  -- perfil novo = estrategia nova: a cadencia reinicia no passo 1 do perfil novo.
  if p_perfil is distinct from v_perfil_antes and p_perfil is not null then
    v_vence := privado.fn_cadencia_trocar_perfil(v_lead.id, v_lead.tenant_id, p_perfil, v_lead.proximo_contato);
    if v_vence is not null then
      update public.lead set proximo_contato = v_vence where id = v_lead.id;
      insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
      values (v_lead.tenant_id, v_lead.id, 'perfil_transicionado',
              coalesce(v_perfil_antes,'(sem perfil)') || ' -> ' || p_perfil || ' (manual)', auth.uid());
    end if;
  end if;

  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
  values (v_lead.tenant_id, v_lead.id, 'lead_editado', 'Dados do lead editados (app)', auth.uid());

  return json_build_object('ok', true, 'msg', 'Lead atualizado', 'lead_id', v_lead.id);
exception
  when unique_violation then
    return json_build_object('ok', false, 'duplicado', true,
      'msg', 'Ja existe outro lead com este WhatsApp');
  when check_violation then
    return json_build_object('ok', false,
      'msg', 'Valor invalido em condicao, perfil, origem ou WhatsApp');
end; $function$;

-- CREATE OR REPLACE FUNCTION reseta ACL: os grants sao refeitos explicitamente
revoke all on function public.editar_lead(uuid, text, text, text, text, text, text, text, text, text, boolean, numeric, date, date) from public;
grant execute on function public.editar_lead(uuid, text, text, text, text, text, text, text, text, text, boolean, numeric, date, date) to authenticated, service_role, postgres;
