-- Aplicada em 19/08/2026 (migration 20260819221534).
--
-- O aviso amigavel de duplicata de cadastrar_lead consultava a tabela inteira e
-- comparava texto exato. Desde que a trava virou o indice parcial lead_tenant_whats_uniq
-- (por sufixo, ignorando arquivados), esse aviso ficou incoerente com o banco: barrava o
-- recadastro de alguem que foi arquivado, apontando um lead que nao aparece em tela nenhuma.
-- Aqui ele passa a usar exatamente o mesmo criterio do indice.
create or replace function public.cadastrar_lead(
  p_nome text, p_whatsapp text, p_produto text, p_condicao text, p_perfil text,
  p_origem text, p_indicado_por text default null::text, p_observacoes text default null::text,
  p_upgrade_entrada boolean default null::boolean, p_aparelho_entrada text default null::text,
  p_consentimento boolean default true)
 returns json
 language plpgsql
 set search_path to 'public', 'privado'
as $function$
declare
  v_tenant uuid;
  v_digitos text;
  v_existente record;
  v_num int;
  v_code text;
  v_lead public.lead%rowtype;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  v_tenant := privado.fn_tenant_atual();
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Usuario sem tenant ativo');
  end if;

  -- obrigatorios
  if coalesce(trim(p_nome), '') = '' then
    return json_build_object('ok', false, 'msg', 'Nome obrigatorio');
  end if;
  if coalesce(trim(p_produto), '') = '' then
    return json_build_object('ok', false, 'msg', 'Produto obrigatorio');
  end if;
  if coalesce(trim(p_condicao), '') = '' then
    return json_build_object('ok', false, 'msg', 'Condicao obrigatoria');
  end if;
  if coalesce(trim(p_perfil), '') = '' then
    return json_build_object('ok', false, 'msg', 'Perfil obrigatorio');
  end if;
  if coalesce(trim(p_origem), '') = '' then
    return json_build_object('ok', false, 'msg', 'Origem obrigatoria');
  end if;
  if p_origem = 'indicacao' and coalesce(trim(p_indicado_por), '') = '' then
    return json_build_object('ok', false, 'msg', 'Indicado por e obrigatorio quando a origem e Indicacao');
  end if;

  -- normaliza telefone: so digitos; DDD+numero (10 ou 11 digitos) ganha 55
  v_digitos := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if v_digitos = '' then
    return json_build_object('ok', false, 'msg', 'WhatsApp obrigatorio');
  end if;
  if length(v_digitos) in (10, 11) then
    v_digitos := '55' || v_digitos;
  end if;
  if v_digitos !~ '^[0-9]{10,15}$' then
    return json_build_object('ok', false, 'msg', 'Telefone invalido apos normalizacao: ' || v_digitos);
  end if;

  -- dedup por telefone dentro do tenant. Mesmo criterio do indice lead_tenant_whats_uniq:
  -- compara o sufixo (imune a formato) e ignora arquivado (lead arquivado devolve o numero).
  select id, lead_code, nome into v_existente
    from public.lead
   where tenant_id = v_tenant
     and arquivado_em is null
     and whatsapp_digitos is not null
     and right(whatsapp_digitos, 11) = right(v_digitos, 11)
   limit 1;
  if found then
    return json_build_object(
      'ok', false,
      'duplicado', true,
      'msg', 'Ja existe um lead com esse WhatsApp: ' || v_existente.nome,
      'existente', json_build_object(
        'lead_id', v_existente.id,
        'lead_code', v_existente.lead_code,
        'nome', v_existente.nome
      )
    );
  end if;

  -- lead_code atomico por tenant
  perform pg_advisory_xact_lock(hashtext('lead_code_' || v_tenant::text));
  select coalesce(max(nullif(regexp_replace(lead_code, '\D', '', 'g'), '')::int), 0) + 1
    into v_num
    from public.lead
   where tenant_id = v_tenant;
  v_code := 'LEAD-' || lpad(v_num::text, 4, '0');

  insert into public.lead (
    tenant_id, lead_code, dono_user_id,
    nome, whatsapp_digitos, produto, condicao, perfil, origem, indicado_por,
    status, tipo_msg, situacao, observacoes,
    data_contato, proximo_contato,
    consentimento, consentimento_em,
    upgrade_entrada, aparelho_entrada
  ) values (
    v_tenant, v_code, auth.uid(),
    trim(p_nome), v_digitos, trim(p_produto), p_condicao, p_perfil, p_origem, nullif(trim(coalesce(p_indicado_por, '')), ''),
    'pendente', 'primeiro contato', null, nullif(trim(coalesce(p_observacoes, '')), ''),
    v_hoje, v_hoje,
    coalesce(p_consentimento, true), case when coalesce(p_consentimento, true) then now() else null end,
    p_upgrade_entrada, nullif(trim(coalesce(p_aparelho_entrada, '')), '')
  )
  returning * into v_lead;

  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
  values (v_tenant, v_lead.id, 'cadastro', 'Cadastrado (app)', auth.uid());

  return json_build_object(
    'ok', true,
    'msg', 'Lead cadastrado: ' || v_code,
    'lead_id', v_lead.id,
    'lead_code', v_code
  );

exception
  when unique_violation then
    return json_build_object('ok', false, 'duplicado', true,
      'msg', 'Ja existe um lead com esse WhatsApp (corrida detectada)');
  when check_violation then
    return json_build_object('ok', false,
      'msg', 'Valor invalido em perfil, origem ou condicao (fora do dicionario)');
end;
$function$;

-- CREATE OR REPLACE FUNCTION reseta ACL: grants refeitos explicitamente
revoke all on function public.cadastrar_lead(text, text, text, text, text, text, text, text, boolean, text, boolean) from public;
grant execute on function public.cadastrar_lead(text, text, text, text, text, text, text, text, boolean, text, boolean) to authenticated, service_role, postgres;
