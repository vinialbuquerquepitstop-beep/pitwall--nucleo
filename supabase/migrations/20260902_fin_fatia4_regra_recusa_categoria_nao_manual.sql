-- migration aplicada: 20260903010231 (name: fin_fatia4_regra_recusa_categoria_nao_manual)
-- O `version` do ledger e UTC do momento da aplicacao, por isso 0903 e nao 0902.
-- O casamento arquivo x ledger se sustenta pelo `name`, nunca pelo `version`.
-- =====================================================================
-- Fatia 4, conserto de portao. A trava de categoria nao atribuivel a mao
-- estava em UM caminho de escrita so.
--
-- DEFEITO, medido em 02/09/2026 lendo o codigo (nao houve incidente):
--   public.fin_classificar          -> RECUSA categoria com atribuivel_manual
--                                      = false (conserto de 31/08).
--   public.fin_regra_salvar         -> NAO recusava. Validava so se a
--                                      categoria existe e esta ativa.
--
-- Consequencia: dava para criar uma regra com categoria `repasse`, e ela
-- carimbaria repasse EM LOTE, sem par nenhum. E exatamente o orfao que a
-- 20260831_fin_fatia3_repasse_so_por_par existe para impedir, so que pela
-- porta dos fundos e multiplicado. O caso ia acontecer: em 02/09 o dono
-- classificou quatro contrapartes como "repasse" e o passo seguinte natural
-- era virar regra.
--
-- Por que a defesa fica no fin_regra_salvar e nao num trigger: ele e o UNICO
-- caminho que insere em public.fin_regra (conferido no retrato do schema de
-- 02/09: um unico `insert into public.fin_regra`, dentro dele). Um caminho,
-- uma trava.
--
-- Corpo IDENTICO ao que estava em producao em 02/09/2026, extraido do
-- proprio retrato (supabase/baseline/20260902_schema_baseline.sql), com UMA
-- adicao: o bloco marcado como CONSERTO DO FURO. Nenhuma outra linha muda.
--
-- ZERO recusa nova: a frase e a mesma que o fin_classificar ja devolve, e ela
-- ja esta na secao 4 do docs/financeiro/CONTRATO.md (linha 177).
--
-- CREATE OR REPLACE nao derruba ACL, mas o CLAUDE.md manda refazer REVOKE e
-- GRANT explicitos depois de mexer em funcao, e os de baixo sao copia exata
-- dos que o retrato de 02/09 registra.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fin_regra_salvar(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_id     uuid;
  v_reg    public.fin_regra%rowtype;
  v_padrao text;
  v_tipo   text;
  v_cat    text;
  v_dom    text;
  v_prio   int;
  v_ativo  boolean;
  v_origem text;
  v_forcar boolean := coalesce((payload->>'forcar')::boolean, false);
  v_base   int;
  v_casa   int;
  v_uteis  int;
  v_nc     int;
  v_novo   boolean;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  begin
    v_id := nullif(btrim(coalesce(payload->>'id','')), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Id de regra invalido.');
  end;
  v_novo := (v_id is null);

  if not v_novo then
    select * into v_reg from public.fin_regra where id = v_id and tenant_id = v_tenant;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Regra nao encontrada.');
    end if;
    if coalesce((payload->>'arquivar')::boolean, false) then
      update public.fin_regra
         set arquivado_em = now(), ativo = false, atualizado_em = now()
       where id = v_id and tenant_id = v_tenant;
      return jsonb_build_object('ok', true, 'id', v_id, 'arquivada', true,
        'msg', 'Regra arquivada. As classificacoes ja feitas continuam como estao.');
    end if;
    if v_reg.arquivado_em is not null then
      return jsonb_build_object('ok', false, 'erro', 'Regra arquivada: crie uma nova em vez de editar esta.');
    end if;
  end if;

  v_padrao := coalesce(nullif(btrim(coalesce(payload->>'padrao','')), ''), v_reg.padrao);
  v_tipo   := coalesce(nullif(btrim(lower(coalesce(payload->>'tipo_match',''))), ''), v_reg.tipo_match, 'contem');
  v_origem := coalesce(nullif(btrim(lower(coalesce(payload->>'origem',''))), ''), v_reg.origem, 'aprendida');
  if payload ? 'categoria_codigo' then
    v_cat := nullif(btrim(coalesce(payload->>'categoria_codigo','')), '');
  else
    v_cat := v_reg.categoria_codigo;
  end if;
  if payload ? 'dominio' then
    v_dom := nullif(btrim(lower(coalesce(payload->>'dominio',''))), '');
  else
    v_dom := v_reg.dominio;
  end if;
  begin
    v_prio := coalesce(nullif(btrim(coalesce(payload->>'prioridade','')), '')::int, v_reg.prioridade, 100);
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Prioridade invalida: use um numero inteiro.');
  end;
  v_ativo := coalesce((payload->>'ativo')::boolean, v_reg.ativo, true);

  -- ---- validacao ---------------------------------------------------------
  if v_padrao is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe o padrao a casar.');
  end if;
  v_uteis := length(regexp_replace(privado.fn_fin_norm(v_padrao), '[^A-Z0-9]', '', 'g'));
  if v_uteis < 3 then
    return jsonb_build_object('ok', false, 'erro',
      'Padrao curto demais (' || v_uteis || ' caractere(s) util(eis)). Use pelo menos 3: padrao curto casa o extrato inteiro.');
  end if;
  if v_tipo not in ('contem','comeca','exato') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de casamento invalido: use contem, comeca ou exato.');
  end if;
  if v_origem not in ('manual','aprendida') then
    return jsonb_build_object('ok', false, 'erro', 'Origem invalida: use manual ou aprendida.');
  end if;
  if v_dom is not null and v_dom not in ('empresa','pessoal') then
    return jsonb_build_object('ok', false, 'erro', 'Dominio invalido: use empresa ou pessoal.');
  end if;
  if v_cat is null and v_dom is null then
    return jsonb_build_object('ok', false, 'erro',
      'A regra precisa definir categoria, dominio, ou os dois. Regra que nao classifica nada e ruido.');
  end if;
  if v_cat is not null and not exists (
    select 1 from public.fin_categoria
     where tenant_id = v_tenant and codigo = v_cat and ativo) then
    return jsonb_build_object('ok', false, 'erro', 'Categoria inexistente ou desativada: ' || v_cat);
  end if;
  -- CONSERTO DO FURO, 02/09/2026. A trava de categoria nao atribuivel a mao
  -- vivia SO no fin_classificar. Aqui ela nao existia, entao dava para criar
  -- uma REGRA com categoria `repasse` e o servidor aceitava: a regra entao
  -- carimbava repasse em lote, sem par, produzindo exatamente o orfao que a
  -- migration 20260831_fin_fatia3_repasse_so_por_par existe para impedir.
  -- Defesa posta num caminho e nao no outro nao e defesa, e sorte.
  -- A frase e a MESMA do fin_classificar, ja registrada na secao 4 do
  -- CONTRATO: zero vocabulario de recusa novo.
  if v_cat is not null and exists (
    select 1 from public.fin_categoria
     where tenant_id = v_tenant and codigo = v_cat and not atribuivel_manual) then
    return jsonb_build_object('ok', false, 'erro', 'Categoria nao pode ser escolhida a mao: ' || v_cat);
  end if;
  if v_prio < 0 or v_prio > 9999 then
    return jsonb_build_object('ok', false, 'erro', 'Prioridade fora da faixa: use de 0 a 9999.');
  end if;

  -- ---- trava do padrao generico -----------------------------------------
  select count(*)::int into v_base
    from public.fin_movimento where tenant_id = v_tenant and arquivado_em is null;
  select count(*)::int into v_casa
    from public.fin_movimento m
   where m.tenant_id = v_tenant and m.arquivado_em is null
     and privado.fn_fin_casa(
           privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)), v_padrao, v_tipo);

  if v_base > 0 and v_casa * 100 > v_base * 60 and not v_forcar then
    return jsonb_build_object('ok', false,
      'erro', 'Padrao generico demais: "' || v_padrao || '" casa ' || v_casa || ' de ' || v_base ||
              ' lancamentos (' || round(100.0 * v_casa / v_base, 1) ||
              '%). Uma regra assim classifica quase tudo igual e apaga a distincao entre os gastos. ' ||
              'Use o nome da contraparte. Se for mesmo o que voce quer, reenvie com forcar: true.',
      'casaria_total', v_casa, 'base_total', v_base, 'pode_forcar', true);
  end if;

  -- ---- escrita -----------------------------------------------------------
  begin
    if v_novo then
      insert into public.fin_regra
        (tenant_id, padrao, tipo_match, categoria_codigo, dominio, prioridade, ativo, origem)
      values
        (v_tenant, v_padrao, v_tipo, v_cat, v_dom, v_prio, v_ativo, v_origem)
      returning id into v_id;
    else
      update public.fin_regra
         set padrao = v_padrao, tipo_match = v_tipo, categoria_codigo = v_cat,
             dominio = v_dom, prioridade = v_prio, ativo = v_ativo, origem = v_origem,
             atualizado_em = now()
       where id = v_id and tenant_id = v_tenant;
    end if;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'erro',
        'Ja existe uma regra ativa com este padrao e este tipo de casamento.');
    when foreign_key_violation then
      return jsonb_build_object('ok', false, 'erro', 'Categoria inexistente. Nada foi gravado.');
    when check_violation then
      return jsonb_build_object('ok', false, 'erro', 'Regra recusada pelo banco: confira padrao, dominio e tipo.');
  end;

  select count(*)::int into v_nc
    from public.fin_movimento m
   where m.tenant_id = v_tenant and m.arquivado_em is null
     and ( (v_dom is not null and m.dominio is null)
        or (v_cat is not null and m.categoria_codigo is null) )
     and privado.fn_fin_casa(
           privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)), v_padrao, v_tipo);

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'criada', v_novo,
    'padrao', v_padrao,
    'casaria_total', v_casa,
    'casaria_nao_classificados', v_nc,
    'forcado', (v_forcar and v_base > 0 and v_casa * 100 > v_base * 60),
    'msg', (case when v_novo then 'Regra criada. ' else 'Regra atualizada. ' end) ||
           (case when v_nc = 0 then 'Nenhum lancamento pendente para ela agora.'
                 when v_nc = 1 then 'Ela classifica 1 lancamento ainda nao classificado.'
                 else 'Ela classifica ' || v_nc || ' lancamentos ainda nao classificados.' end));
end
$$;

-- ACLs, identicas as do retrato de 02/09/2026
REVOKE ALL ON FUNCTION public.fin_regra_salvar(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_regra_salvar(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fin_regra_salvar(payload jsonb) TO service_role;

-- Conferencia depois de aplicar (deve devolver 0 linhas):
--   select r.id, r.padrao, r.categoria_codigo   -- qualificado: fin_categoria tambem tem `id`
--     from public.fin_regra r
--     join public.fin_categoria c
--       on c.tenant_id = r.tenant_id and c.codigo = r.categoria_codigo
--    where not c.atribuivel_manual and r.arquivado_em is null;
