-- migration aplicada: 20260826132815_fin_fatia2_rpcs_regra

-- ------------------------------------------------------------------------
-- fin_regra_prever(payload) -> jsonb
-- Mostra o efeito ANTES de gravar. Mesmo principio da previa da importacao:
-- nunca escrever sem o dono ver o que vai acontecer.
-- payload: {padrao, tipo_match, categoria_codigo, dominio, id}
--   id opcional: quando presente, herda da regra existente tudo que a chave
--   nao trouxer, para a tela poder chamar so com {id}.
-- ------------------------------------------------------------------------
create or replace function public.fin_regra_prever(payload jsonb)
returns jsonb
language plpgsql
stable
set search_path to 'public','privado'
as $$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_id      uuid;
  v_reg     public.fin_regra%rowtype;
  v_padrao  text;
  v_tipo    text;
  v_cat     text;
  v_dom     text;
  v_nat     text;
  v_base    int;
  v_uteis   int;
  v_tot     int := 0;
  v_nc      int := 0;
  v_jc      int := 0;
  v_jcd     int := 0;
  v_sob     int := 0;
  v_inc     int := 0;
  v_ex      jsonb := '[]'::jsonb;
  v_avisos  jsonb := '[]'::jsonb;
  v_pct     numeric := 0;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  v_id := nullif(btrim(coalesce(payload->>'id','')), '')::uuid;
  if v_id is not null then
    select * into v_reg from public.fin_regra where id = v_id and tenant_id = v_tenant;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Regra nao encontrada.');
    end if;
  end if;

  v_padrao := coalesce(nullif(btrim(coalesce(payload->>'padrao','')), ''), v_reg.padrao);
  v_tipo   := coalesce(nullif(btrim(lower(coalesce(payload->>'tipo_match',''))), ''), v_reg.tipo_match, 'contem');
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

  if v_padrao is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe o padrao a casar.');
  end if;
  if v_tipo not in ('contem','comeca','exato') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de casamento invalido: use contem, comeca ou exato.');
  end if;
  if v_dom is not null and v_dom not in ('empresa','pessoal') then
    return jsonb_build_object('ok', false, 'erro', 'Dominio invalido: use empresa ou pessoal.');
  end if;

  if v_cat is not null then
    select natureza_esperada into v_nat
      from public.fin_categoria where tenant_id = v_tenant and codigo = v_cat and ativo;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Categoria inexistente ou desativada: ' || v_cat);
    end if;
  end if;

  select count(*)::int into v_base
    from public.fin_movimento where tenant_id = v_tenant and arquivado_em is null;

  v_uteis := length(regexp_replace(privado.fn_fin_norm(v_padrao), '[^A-Z0-9]', '', 'g'));

  with casa as (
    select m.id, m.valor, m.dominio, m.categoria_codigo,
           coalesce(m.descricao_original, m.descricao) as texto,
           ( (v_dom is not null and m.dominio is null)
          or (v_cat is not null and m.categoria_codigo is null) ) as muda_nc,
           ( (v_dom is not null and m.dominio is not null and m.dominio <> v_dom)
          or (v_cat is not null and m.categoria_codigo is not null and m.categoria_codigo <> v_cat) ) as difere
      from public.fin_movimento m
     where m.tenant_id = v_tenant
       and m.arquivado_em is null
       and privado.fn_fin_casa(
             privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)),
             v_padrao, v_tipo)
  )
  select
    count(*)::int,
    count(*) filter (where muda_nc)::int,
    count(*) filter (where not muda_nc)::int,
    count(*) filter (where not muda_nc and difere)::int,
    count(*) filter (where difere)::int,
    count(*) filter (where (v_nat = 'entrada' and valor < 0)
                        or (v_nat = 'saida'   and valor > 0))::int
  into v_tot, v_nc, v_jc, v_jcd, v_sob, v_inc
  from casa;

  select coalesce(jsonb_agg(to_jsonb(t.texto)), '[]'::jsonb) into v_ex from (
    select distinct coalesce(m.descricao_original, m.descricao) as texto
      from public.fin_movimento m
     where m.tenant_id = v_tenant
       and m.arquivado_em is null
       and privado.fn_fin_casa(
             privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)),
             v_padrao, v_tipo)
     order by 1
     limit 5
  ) t;

  if v_base > 0 then v_pct := round(100.0 * v_tot / v_base, 1); end if;

  if v_uteis < 3 then
    v_avisos := v_avisos || to_jsonb('Padrao curto demais: menos de 3 caracteres uteis.'::text);
  end if;
  if v_base > 0 and v_tot * 100 > v_base * 60 then
    v_avisos := v_avisos || to_jsonb(('Padrao generico demais: casa ' || v_pct || '% da base (' ||
      v_tot || ' de ' || v_base || ').')::text);
  end if;
  if v_jcd > 0 then
    v_avisos := v_avisos || to_jsonb((v_jcd || ' ja tem classificacao DIFERENTE. Aplicar com alcance todos sobrescreve a sua decisao.')::text);
  end if;
  if v_inc > 0 then
    v_avisos := v_avisos || to_jsonb((v_inc || ' com sinal contrario ao esperado da categoria (' || v_nat || ').')::text);
  end if;
  if v_tot = 0 then
    v_avisos := v_avisos || to_jsonb('Nenhum lancamento casa com este padrao hoje.'::text);
  end if;

  return jsonb_build_object(
    'ok', true,
    'padrao', v_padrao,
    'tipo_match', v_tipo,
    'categoria_codigo', v_cat,
    'dominio', v_dom,
    'base_total', v_base,
    'casaria_total', v_tot,
    'casaria_pct', v_pct,
    'casaria_nao_classificados', v_nc,
    'casaria_ja_classificados', v_jc,
    'casaria_ja_classificados_diferentes', v_jcd,
    'sobrescreveria_diferente', v_sob,
    'incoerencia_sinal_n', v_inc,
    'exemplos', v_ex,
    'avisos', v_avisos);
end
$$;

revoke all on function public.fin_regra_prever(jsonb) from public;
grant execute on function public.fin_regra_prever(jsonb) to authenticated, postgres, service_role;


-- ------------------------------------------------------------------------
-- fin_regra_salvar(payload) -> jsonb
-- Cria (sem id) ou edita (com id). Convencao da Fatia 1: o que manda e a
-- PRESENCA da chave. Chave ausente nao mexe no campo; chave com null LIMPA.
-- Recusa padrao curto e padrao que casa mais de 60% da base; forcar: true passa.
-- arquivar: true + id faz o soft delete (nunca DELETE).
-- ------------------------------------------------------------------------
create or replace function public.fin_regra_salvar(payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $$
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

revoke all on function public.fin_regra_salvar(jsonb) from public;
grant execute on function public.fin_regra_salvar(jsonb) to authenticated, postgres, service_role;
