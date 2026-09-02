--
-- PostgreSQL database dump
--

\restrict bN5QXAEXoSTeFWLvSKt4d7CcHEKI8CSeuu3NwB1YMfekF2dlxX2yo2NZIWzbtfQ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Ubuntu 17.11-1.pgdg24.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: privado; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA privado;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: fn_brl(numeric); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_brl(p numeric) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $_$
  -- lc_numeric deste banco e en_US.UTF-8, entao to_char devolve 1,234.50.
  -- translate troca os dois separadores de uma vez: 1.234,50 (pt-BR).
  select 'R$ ' || translate(to_char(coalesce(p,0), 'FM999G999G999G990D00'), ',.', '.,')
$_$;


--
-- Name: fn_cadencia_encerrar(uuid); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_cadencia_encerrar(p_lead_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  update public.cadencia_estado
     set encerrada = true, atualizado_em = now()
   where lead_id = p_lead_id and encerrada = false;
end; $$;


--
-- Name: fn_cadencia_reagendar(uuid, date); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_cadencia_reagendar(p_lead_id uuid, p_data date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  update public.cadencia_estado
     set passo_vence_em = p_data, atualizado_em = now()
   where lead_id = p_lead_id and encerrada = false;
end; $$;


--
-- Name: fn_cadencia_trocar_perfil(uuid, uuid, text, date); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_cadencia_trocar_perfil(p_lead_id uuid, p_tenant uuid, p_perfil text, p_proximo date) RETURNS date
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_regra record;
  v_vence date;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into v_regra from public.cadencia_regra
   where tenant_id = p_tenant and perfil = p_perfil and passo = 1 and ativo limit 1;
  if not found then return null; end if;

  v_vence := greatest(coalesce(p_proximo, v_hoje + v_regra.dias_offset), v_hoje);

  insert into public.cadencia_estado
    (lead_id, tenant_id, perfil, passo_atual, passo_rotulo, passo_vence_em, encerrada)
  values (p_lead_id, p_tenant, p_perfil, 1, v_regra.rotulo, v_vence, false)
  on conflict (lead_id) do update
    set perfil = excluded.perfil, passo_atual = 1, passo_rotulo = excluded.passo_rotulo,
        passo_vence_em = excluded.passo_vence_em, encerrada = false, atualizado_em = now();

  return v_vence;
end; $$;


--
-- Name: fn_cpf_valido(text); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_cpf_valido(p_cpf text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $_$
declare
  d text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  s int; i int; v1 int; v2 int;
begin
  if length(d) <> 11 then return false; end if;
  if d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0;
  for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  v1 := 11 - (s % 11);
  if v1 >= 10 then v1 := 0; end if;
  if v1 <> substr(d, 10, 1)::int then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  v2 := 11 - (s % 11);
  if v2 >= 10 then v2 := 0; end if;
  return v2 = substr(d, 11, 1)::int;
end $_$;


--
-- Name: fn_escopo_evento(); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_escopo_evento() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into public.escopo_acao_evento(tenant_id, acao_id, de_status, para_status, por)
    values (new.tenant_id, new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.escopo_acao_evento(tenant_id, acao_id, de_status, para_status, por)
    values (new.tenant_id, new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;


--
-- Name: FUNCTION fn_escopo_evento(); Type: COMMENT; Schema: privado; Owner: -
--

COMMENT ON FUNCTION privado.fn_escopo_evento() IS 'Garantia estrutural da auditoria do Escopo. Vive em privado (invariante 8). Status repetido e edicao de titulo NAO geram evento: a tendencia da Fatia 3 le este log e evento fantasma seria ruido.';


--
-- Name: fn_escopo_meta_evento(); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_escopo_meta_evento() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
begin
  if new.meta is distinct from old.meta then
    insert into public.escopo_frente_evento(tenant_id, frente, meta_antes, meta_depois, por)
    values (new.tenant_id, new.codigo, old.meta, new.meta, auth.uid());
  end if;
  return new;
end $$;


--
-- Name: fn_fin_aplicar_regras(uuid, uuid[], uuid[], text); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_fin_aplicar_regras(p_tenant uuid, p_regra_ids uuid[], p_mov_ids uuid[], p_alcance text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_todos    boolean := (p_alcance = 'todos');
  v_class    int := 0;
  v_conf     int := 0;
  v_porregra jsonb := '[]'::jsonb;
begin
  with par as materialized (
    select
      m.id                                      as mov_id,
      m.dominio                                 as dom_atual,
      m.categoria_codigo                        as cat_atual,
      r.id                                      as regra_id,
      r.padrao                                  as padrao,
      r.dominio                                 as r_dom,
      r.categoria_codigo                        as r_cat,
      row_number() over (partition by m.id
        order by r.prioridade asc, length(r.padrao) desc, r.criado_em desc, r.id) as rk,
      count(*)    over (partition by m.id)      as n_regras
      from public.fin_movimento m
      join public.fin_regra r
        on  r.tenant_id = p_tenant
        and r.ativo
        and r.arquivado_em is null
        and (p_regra_ids is null or r.id = any(p_regra_ids))
        and privado.fn_fin_casa(
              privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)),
              r.padrao, r.tipo_match)
     where m.tenant_id = p_tenant
       and m.arquivado_em is null
       and (p_mov_ids is null or m.id = any(p_mov_ids))
  ),
  venc as (
    select mov_id, regra_id, padrao, dom_atual, cat_atual,
      case when r_dom is null                    then dom_atual
           when v_todos or dom_atual is null     then r_dom
           else dom_atual end as dom_novo,
      case when r_cat is null                    then cat_atual
           when v_todos or cat_atual is null     then r_cat
           else cat_atual end as cat_novo
      from par where rk = 1
  ),
  mud as (
    select * from venc
     where dom_novo is distinct from dom_atual
        or cat_novo is distinct from cat_atual
  ),
  upd as (
    update public.fin_movimento m
       set dominio          = mud.dom_novo,
           categoria_codigo = mud.cat_novo,
           atualizado_em    = now()
      from mud
     where m.id = mud.mov_id
    returning mud.regra_id as regra_id, mud.padrao as padrao
  ),
  agg as (
    select regra_id, padrao, count(*)::int as n from upd group by 1, 2
  )
  select
    (select coalesce(sum(n), 0)::int from agg),
    (select coalesce(jsonb_agg(jsonb_build_object('id', regra_id, 'padrao', padrao, 'n', n)
              order by n desc, padrao), '[]'::jsonb) from agg),
    (select count(distinct mov_id)::int from par where n_regras > 1)
  into v_class, v_porregra, v_conf;

  -- contador da regra: so sobe quando a regra REALMENTE mudou alguma coluna.
  -- Rodar de novo sem efeito nao infla o numero e nao gera linha de auditoria.
  if v_class > 0 then
    update public.fin_regra r
       set aplicada_n       = r.aplicada_n + x.n,
           ultima_aplicacao = now(),
           atualizado_em    = now()
      from (select (e->>'id')::uuid as id, (e->>'n')::int as n
              from jsonb_array_elements(v_porregra) e) x
     where r.id = x.id and r.tenant_id = p_tenant;
  end if;

  return jsonb_build_object(
    'classificados', v_class,
    'por_regra',     v_porregra,
    'conflitos',     v_conf);
end
$$;


--
-- Name: fn_fin_casa(text, text, text); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_fin_casa(p_alvo_norm text, p_padrao text, p_tipo text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case p_tipo
    when 'exato'  then p_alvo_norm = privado.fn_fin_norm(p_padrao)
    when 'comeca' then p_alvo_norm like privado.fn_fin_esc(p_padrao) || '%' escape '\'
    else               p_alvo_norm like '%' || privado.fn_fin_esc(p_padrao) || '%' escape '\'
  end;
$$;


--
-- Name: fn_fin_cobertura(uuid, date, date); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_fin_cobertura(p_tenant uuid, p_ini date, p_fim date) RETURNS json
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  with b as (
    select m.valor, m.dominio,
           coalesce(c.natureza_esperada, '') as nat
      from public.fin_movimento m
      left join public.fin_categoria c
        on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
     where m.tenant_id = p_tenant
       and m.arquivado_em is null
       and m.data between p_ini and p_fim
  ), t as (
    select
      coalesce(sum(abs(b.valor)), 0)                                                       as bruto,
      coalesce(sum(abs(b.valor)) filter (where b.dominio is not null or b.nat = 'neutro'), 0) as julgado,
      coalesce(sum(abs(b.valor)) filter (where b.dominio is null and b.nat <> 'neutro'), 0)   as pendente,
      count(*)::int                                                                        as linhas,
      count(*) filter (where b.dominio is null and b.nat <> 'neutro')::int                 as linhas_pendentes,
      coalesce(sum(abs(b.valor)) filter (where b.dominio = 'empresa' and b.nat <> 'neutro'), 0) as v_emp,
      count(*) filter (where b.dominio = 'empresa' and b.nat <> 'neutro')::int             as n_emp,
      coalesce(sum(abs(b.valor)) filter (where b.dominio = 'pessoal' and b.nat <> 'neutro'), 0) as v_pes,
      count(*) filter (where b.dominio = 'pessoal' and b.nat <> 'neutro')::int             as n_pes,
      coalesce(sum(abs(b.valor)) filter (where b.nat = 'neutro'), 0)                       as v_neu,
      count(*) filter (where b.nat = 'neutro')::int                                        as n_neu
    from b
  )
  -- Os quatro baldes de por_dominio sao DISJUNTOS e exaustivos, e `neutro`
  -- vence `dominio`: e o mesmo recorte que o fin_painel ja usa para manter
  -- aplicacao e resgate fora dos totais de proposito.
  -- Base vazia devolve 100: nao ha o que julgar, e travar a tela por causa de
  -- zero linha seria cobrar trabalho inexistente. A tela vazia tem estado proprio.
  select json_build_object(
    'valor_bruto_total',   t.bruto,
    'valor_bruto_julgado', t.julgado,
    'valor_pendente',      t.pendente,
    'pct_julgado', case when t.bruto = 0 then 100::numeric
                        else round(100 * t.julgado / t.bruto, 2) end,
    'linhas_total',     t.linhas,
    'linhas_pendentes', t.linhas_pendentes,
    'por_dominio', json_build_object(
      'empresa',  json_build_object('valor', t.v_emp,     'n', t.n_emp),
      'pessoal',  json_build_object('valor', t.v_pes,     'n', t.n_pes),
      'neutro',   json_build_object('valor', t.v_neu,     'n', t.n_neu),
      'pendente', json_build_object('valor', t.pendente,  'n', t.linhas_pendentes)))
  from t;
$$;


--
-- Name: fn_fin_contraparte(text); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_fin_contraparte(t text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $_$
  with d as (
    -- 'i' porque a grafia do prefixo e do banco, nao nossa; o '+' porque
    -- um estorno de estorno nao e impossivel.
    select regexp_replace(coalesce(t, ''), '^(Estorno - )+', '', 'i') as s
  )
  select privado.fn_fin_cp_norm(
    case
      when position(' - ' in d.s) = 0 then null
      -- terminal numerico: pula para o trecho seguinte. Se ele nao existir,
      -- split_part devolve '' e o nullif fecha em NULL, que e o certo:
      -- melhor sem nome do que com um numero de maquininha por nome.
      when split_part(d.s, ' - ', 2) ~ '^[0-9]+$'
           then nullif(split_part(d.s, ' - ', 3), '')
      else nullif(split_part(d.s, ' - ', 2), '')
    end)
  from d;
$_$;


--
-- Name: fn_fin_cp_norm(text); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_fin_cp_norm(t text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select nullif(btrim(regexp_replace(privado.fn_fin_norm(t), '\s+', ' ', 'g')), '');
$$;


--
-- Name: fn_fin_esc(text); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_fin_esc(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select replace(replace(replace(privado.fn_fin_norm(p), '\', '\\'), '%', '\%'), '_', '\_');
$$;


--
-- Name: fn_fin_importacao_fechar(uuid, integer, integer, integer); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_fin_importacao_fechar(p_id uuid, p_lidas integer, p_novas integer, p_dup integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'privado'
    AS $$
begin
  update public.fin_importacao
     set linhas_lidas      = p_lidas,
         linhas_novas      = p_novas,
         linhas_duplicadas = p_dup
   where id = p_id
     and tenant_id = privado.fn_tenant_atual();
end
$$;


--
-- Name: fn_fin_norm(text); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_fin_norm(t text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select upper(translate(coalesce(t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'));
$$;


--
-- Name: FUNCTION fn_fin_norm(t text); Type: COMMENT; Schema: privado; Owner: -
--

COMMENT ON FUNCTION privado.fn_fin_norm(t text) IS 'Normaliza texto para casamento de regra: tira acento (translate, sem depender da extensao unaccent) e sobe para maiuscula. IMMUTABLE porque o indice unico de fin_regra depende dela.';


--
-- Name: fn_pagamentos_salvar(uuid, uuid, jsonb); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_pagamentos_salvar(p_venda_id uuid, p_tenant uuid, p_itens jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'privado'
    AS $$
declare
  it    jsonb;
  v_ord int := 0;
begin
  delete from public.venda_pagamento where venda_id = p_venda_id;
  for it in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    v_ord := v_ord + 1;
    insert into public.venda_pagamento (
      tenant_id, venda_id, forma, valor, parcelas, bandeira, taxa,
      taxa_repassada, observacao, ordem, criado_por
    ) values (
      p_tenant, p_venda_id,
      btrim(it->>'forma'),
      nullif(btrim(replace(coalesce(it->>'valor',''), ',', '.')), '')::numeric,
      coalesce(nullif(btrim(coalesce(it->>'parcelas','')), '')::int, 1),
      nullif(btrim(coalesce(it->>'bandeira','')), ''),
      nullif(btrim(replace(coalesce(it->>'taxa',''), ',', '.')), '')::numeric,
      -- o default do negocio e repassar (decisao do dono, 16/08/2026)
      coalesce(nullif(btrim(coalesce(it->>'taxa_repassada','')), '')::boolean, true),
      nullif(btrim(coalesce(it->>'observacao','')), ''),
      v_ord, auth.uid()
    );
  end loop;
end
$$;


--
-- Name: fn_papel_atual(); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_papel_atual() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select papel from public.app_usuario where id = auth.uid() and ativo
$$;


--
-- Name: fn_regua_desfecho(uuid, uuid, text, text, integer); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_regua_desfecho(p_lead_id uuid, p_tenant uuid, p_perfil text, p_motivo text, p_dias integer) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado', 'pg_temp'
    AS $$
declare
  v_cfg  record;
  v_regra record;
  v_vence date;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_txt  text := case when p_motivo = 'abandono'
                   then p_dias || ' dias com o passo vencido sem toque'
                   else p_dias || ' dias de silencio apos o ultimo passo' end;
begin
  select * into v_cfg from public.cadencia_perfil
   where tenant_id = p_tenant and perfil = p_perfil limit 1;
  if not found then return 'nada'; end if;

  -- PRECEDENCIA 1: transicao de perfil vence esfriamento.
  if v_cfg.perfil_seguinte is not null then
    select * into v_regra from public.cadencia_regra
     where tenant_id = p_tenant and perfil = v_cfg.perfil_seguinte and passo = 1 and ativo limit 1;
    if not found then return 'nada'; end if;

    v_vence := greatest(v_hoje + v_regra.dias_offset, v_hoje);
    update public.lead
       set perfil = v_cfg.perfil_seguinte, proximo_contato = v_vence,
           status = case when status in ('pendente','feito') then 'pendente' else status end
     where id = p_lead_id;
    update public.cadencia_estado
       set perfil = v_cfg.perfil_seguinte, passo_atual = 1, passo_rotulo = v_regra.rotulo,
           passo_vence_em = v_vence, encerrada = false, atualizado_em = now()
     where lead_id = p_lead_id;
    insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe)
      values (p_tenant, p_lead_id, 'perfil_transicionado',
              p_perfil || ' -> ' || v_cfg.perfil_seguinte || ' apos ' || v_txt);
    return 'transicao';
  end if;

  -- PRECEDENCIA 2: esfriar.
  if v_cfg.permite_esfriar then
    update public.lead set status = 'lista_fria', proximo_contato = null where id = p_lead_id;
    update public.cadencia_estado set encerrada = true, atualizado_em = now() where lead_id = p_lead_id;
    insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe)
      values (p_tenant, p_lead_id,
              case when p_motivo = 'abandono' then 'abandonado_sem_toque' else 'esfriado_por_silencio' end,
              v_txt);
    return case when p_motivo = 'abandono' then 'abandono' else 'esfriado' end;
  end if;

  -- PRECEDENCIA 3: encerrar sem esfriar.
  update public.cadencia_estado set encerrada = true, atualizado_em = now() where lead_id = p_lead_id;
  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe)
    values (p_tenant, p_lead_id, 'cadencia_encerrada', 'Cadencia concluida sem esfriamento');
  return 'encerrada';
end;
$$;


--
-- Name: fn_tenant_atual(); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_tenant_atual() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select tenant_id from public.app_usuario where id = auth.uid() and ativo
$$;


--
-- Name: fn_venda_arquivar(uuid, boolean); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_venda_arquivar(p_id uuid, p_arquivar boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'privado'
    AS $$
begin
  update public.venda
     set arquivado_em = case when p_arquivar then now() else null end,
         atualizado_em = now()
   where id = p_id;
end
$$;


--
-- Name: fn_venda_atualizar(uuid, jsonb); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_venda_atualizar(p_id uuid, p_campos jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'privado'
    AS $$
begin
  update public.venda v set
    modelo_texto              = case when p_campos ? 'modelo_texto'              then p_campos->>'modelo_texto' else v.modelo_texto end,
    modelo_id                 = case when p_campos ? 'modelo_id'                 then nullif(p_campos->>'modelo_id','')::uuid else v.modelo_id end,
    capacidade                = case when p_campos ? 'capacidade'                then p_campos->>'capacidade' else v.capacidade end,
    cor                       = case when p_campos ? 'cor'                       then p_campos->>'cor' else v.cor end,
    condicao                  = case when p_campos ? 'condicao'                  then p_campos->>'condicao' else v.condicao end,
    imei                      = case when p_campos ? 'imei'                      then p_campos->>'imei' else v.imei end,
    valor_venda               = case when p_campos ? 'valor_venda'               then (p_campos->>'valor_venda')::numeric else v.valor_venda end,
    custo_aparelho            = case when p_campos ? 'custo_aparelho'            then (p_campos->>'custo_aparelho')::numeric else v.custo_aparelho end,
    despesa_frete             = case when p_campos ? 'despesa_frete'             then (p_campos->>'despesa_frete')::numeric else v.despesa_frete end,
    despesa_taxas             = case when p_campos ? 'despesa_taxas'             then (p_campos->>'despesa_taxas')::numeric else v.despesa_taxas end,
    comprador_nome            = case when p_campos ? 'comprador_nome'            then p_campos->>'comprador_nome' else v.comprador_nome end,
    comprador_whatsapp        = case when p_campos ? 'comprador_whatsapp'        then p_campos->>'comprador_whatsapp' else v.comprador_whatsapp end,
    comprador_cpf             = case when p_campos ? 'comprador_cpf'             then p_campos->>'comprador_cpf' else v.comprador_cpf end,
    comprador_nascimento      = case when p_campos ? 'comprador_nascimento'      then nullif(p_campos->>'comprador_nascimento','')::date else v.comprador_nascimento end,
    comprador_instagram       = case when p_campos ? 'comprador_instagram'       then p_campos->>'comprador_instagram' else v.comprador_instagram end,
    fornecedor_nome           = case when p_campos ? 'fornecedor_nome'           then p_campos->>'fornecedor_nome' else v.fornecedor_nome end,
    fornecedor_contato        = case when p_campos ? 'fornecedor_contato'        then p_campos->>'fornecedor_contato' else v.fornecedor_contato end,
    fornecedor_local_retirada = case when p_campos ? 'fornecedor_local_retirada' then p_campos->>'fornecedor_local_retirada' else v.fornecedor_local_retirada end,
    tem_trade_in              = case when p_campos ? 'tem_trade_in'              then coalesce((p_campos->>'tem_trade_in')::boolean, false) else v.tem_trade_in end,
    entrada_modelo            = case when p_campos ? 'entrada_modelo'            then p_campos->>'entrada_modelo' else v.entrada_modelo end,
    entrada_imei              = case when p_campos ? 'entrada_imei'              then p_campos->>'entrada_imei' else v.entrada_imei end,
    entrada_valor             = case when p_campos ? 'entrada_valor'             then (p_campos->>'entrada_valor')::numeric else v.entrada_valor end,
    status                    = case when p_campos ? 'status'                    then p_campos->>'status' else v.status end,
    etapa                     = case when p_campos ? 'etapa'                     then p_campos->>'etapa' else v.etapa end,
    etapa_em                  = case when p_campos ? 'etapa'
                                      and p_campos->>'etapa' is distinct from v.etapa
                                     then now() else v.etapa_em end,
    endereco_entrega          = case when p_campos ? 'endereco_entrega'          then p_campos->>'endereco_entrega' else v.endereco_entrega end,
    valor_a_cobrar            = case when p_campos ? 'valor_a_cobrar'            then (p_campos->>'valor_a_cobrar')::numeric else v.valor_a_cobrar end,
    motoboy                   = case when p_campos ? 'motoboy'                   then p_campos->>'motoboy' else v.motoboy end,
    motoboy_whatsapp          = case when p_campos ? 'motoboy_whatsapp'          then p_campos->>'motoboy_whatsapp' else v.motoboy_whatsapp end,
    forma_pagamento           = case when p_campos ? 'forma_pagamento'           then p_campos->>'forma_pagamento' else v.forma_pagamento end,
    nf_numero                 = case when p_campos ? 'nf_numero'                 then p_campos->>'nf_numero' else v.nf_numero end,
    observacoes               = case when p_campos ? 'observacoes'               then p_campos->>'observacoes' else v.observacoes end,
    atualizado_em             = now()
  where v.id = p_id;
end
$$;


--
-- Name: fn_venda_code(); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_venda_code() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'privado'
    AS $$
declare n int;
begin
  if new.venda_code is null then
    select coalesce(max((regexp_replace(venda_code,'\D','','g'))::int),0)+1
      into n from public.venda where tenant_id = new.tenant_id;
    new.venda_code := 'VENDA-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$;


--
-- Name: fn_venda_nf_numero(uuid, text); Type: FUNCTION; Schema: privado; Owner: -
--

CREATE FUNCTION privado.fn_venda_nf_numero(p_id uuid, p_numero text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'privado'
    AS $$
begin
  update public.venda
     set nf_numero = p_numero, atualizado_em = now()
   where id = p_id
     and nullif(btrim(coalesce(nf_numero,'')),'') is null;
end
$$;


--
-- Name: adicionar_tarefa(text, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adicionar_tarefa(p_titulo text, p_categoria text, p_data date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_dia     date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
  v_tenant  uuid := privado.fn_tenant_atual();
  v_usuario uuid := auth.uid();
  v_rot text; v_ord integer; v_id uuid;
begin
  if v_tenant is null or v_usuario is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if coalesce(btrim(p_titulo), '') = '' then
    return json_build_object('ok', false, 'msg', 'Escreva a tarefa.');
  end if;
  select rc.rotulo, rc.ordem * 1000 + 999 into v_rot, v_ord
    from public.rotina_categoria rc
   where rc.tenant_id = v_tenant and rc.codigo = p_categoria and rc.ativo;
  if not found then
    return json_build_object('ok', false, 'msg', 'Categoria invalida.');
  end if;

  insert into public.dia_tarefa
    (tenant_id, usuario_id, data, categoria, categoria_rotulo, titulo, origem, ordem, criado_por)
  values (v_tenant, v_usuario, v_dia, p_categoria, v_rot, btrim(p_titulo), 'manual', v_ord, v_usuario)
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'data', v_dia);
end $$;


--
-- Name: anexar_nf(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.anexar_nf(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_venda   uuid := nullif(payload->>'venda_id','')::uuid;
  v_arq     text := nullif(payload->>'arquivo','');
  v_num     text := nullif(btrim(coalesce(payload->>'numero','')),'');
  v_id      uuid;
  v_code    text;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida');
  end if;
  if v_venda is null or v_arq is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe a venda e o arquivo');
  end if;
  if v_arq not like v_tenant::text || '/' || v_venda::text || '/%' then
    return jsonb_build_object('ok', false, 'erro', 'Caminho do arquivo fora da pasta da venda');
  end if;

  select venda_code into v_code
    from public.venda
   where id = v_venda and tenant_id = v_tenant and arquivado_em is null;
  if v_code is null then
    return jsonb_build_object('ok', false, 'erro', 'Venda nao encontrada');
  end if;

  insert into public.venda_nf (tenant_id, venda_id, numero, arquivo, nome_original, mime, tamanho)
  values (
    v_tenant, v_venda, v_num, v_arq,
    nullif(payload->>'nome_original',''),
    nullif(payload->>'mime',''),
    nullif(payload->>'tamanho','')::integer
  )
  returning id into v_id;

  -- o numero da nota da venda so e preenchido se ainda estiver vazio:
  -- a RPC nao sobrescreve numero ja registrado.
  if v_num is not null then
    perform privado.fn_venda_nf_numero(v_venda, v_num);
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'venda_code', v_code);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'erro', 'Esse arquivo ja esta anexado');
end
$$;


--
-- Name: arquivar_lead(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.arquivar_lead(p_lead_id uuid, p_motivo text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare v_lead public.lead%rowtype;
begin
  update public.lead set arquivado_em = now(), atualizado_em = now()
   where id = p_lead_id and arquivado_em is null returning * into v_lead;
  if not found then
    return json_build_object('ok', false, 'msg', 'Lead nao encontrado, ja arquivado ou sem permissao');
  end if;

  perform privado.fn_cadencia_encerrar(v_lead.id);

  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
  values (v_lead.tenant_id, v_lead.id, 'arquivado',
          coalesce('Arquivado: ' || nullif(trim(coalesce(p_motivo,'')), ''), 'Lead arquivado (app)'),
          auth.uid());

  return json_build_object('ok', true, 'msg', 'Lead arquivado', 'lead_id', v_lead.id);
end; $$;


--
-- Name: arquivar_venda(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.arquivar_venda(p_id uuid, p_arquivar boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_venda  public.venda%rowtype;
  v_rest   int;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;

  select * into v_venda from public.venda where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Venda nao encontrada.');
  end if;
  if p_arquivar and v_venda.arquivado_em is not null then
    return jsonb_build_object('ok', false, 'erro', 'Esta venda ja esta arquivada.');
  end if;
  if not p_arquivar and v_venda.arquivado_em is null then
    return jsonb_build_object('ok', false, 'erro', 'Esta venda nao esta arquivada.');
  end if;

  perform privado.fn_venda_arquivar(v_venda.id, p_arquivar);

  -- quantas vendas ATIVAS sobram para esse cliente (a mesma regra que a
  -- v_cliente usa para somar: nao arquivada e nao cancelada)
  select count(*) into v_rest
    from public.venda v
   where v.lead_id = v_venda.lead_id
     and v.tenant_id = v_tenant
     and v.arquivado_em is null
     and coalesce(v.status,'') <> 'cancelada';

  -- Historico e append-only (invariante 6): o evento 'fechou' da venda original
  -- nao se apaga. Sem esta linha, a timeline do cliente anunciaria para sempre
  -- uma venda que nao conta mais.
  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
  values (
    v_tenant, v_venda.lead_id,
    case when p_arquivar then 'arquivado' else 'nota' end,
    v_venda.venda_code || case when p_arquivar
      then ' arquivada: nao conta mais no faturamento nem no total do cliente.'
      else ' desarquivada: volta a contar no faturamento.' end,
    auth.uid());

  return jsonb_build_object(
    'ok', true,
    'venda_code', v_venda.venda_code,
    'arquivada', p_arquivar,
    'cliente_ficou_sem_venda', (p_arquivar and v_rest = 0));
end
$$;


--
-- Name: FUNCTION arquivar_venda(p_id uuid, p_arquivar boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.arquivar_venda(p_id uuid, p_arquivar boolean) IS 'Soft delete de venda. Arquivada sai de v_venda, v_cliente, v_venda_nf e painel_metricas. Devolve cliente_ficou_sem_venda para a tela avisar.';


--
-- Name: cadastrar_lead(text, text, text, text, text, text, text, text, boolean, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cadastrar_lead(p_nome text, p_whatsapp text, p_produto text, p_condicao text, p_perfil text, p_origem text, p_indicado_por text DEFAULT NULL::text, p_observacoes text DEFAULT NULL::text, p_upgrade_entrada boolean DEFAULT NULL::boolean, p_aparelho_entrada text DEFAULT NULL::text, p_consentimento boolean DEFAULT true) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $_$
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
$_$;


--
-- Name: captacao_do_dia(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.captacao_do_dia(p_data date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid; v_dia date; v_linhas json;
begin
  v_tenant := privado.fn_tenant_atual();
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Usuario sem tenant ativo');
  end if;

  v_dia := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);

  -- newest-first (invariante 6). A RLS de captacao decide o que este usuario enxerga.
  select coalesce(json_agg(json_build_object(
           'id', cp.id,
           'identificador', cp.identificador,
           'nome', cp.nome,
           'observacoes', cp.observacoes,
           'frente', cp.frente,
           'frente_rotulo', f.rotulo,
           'hora', to_char(cp.criado_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
           'parou', cp.opt_out_em is not null,
           'virou_lead', cp.virou_lead_id is not null
         ) order by cp.criado_em desc), '[]'::json)
    into v_linhas
  from public.captacao cp
  left join public.captacao_frente f
         on f.tenant_id = cp.tenant_id and f.codigo = cp.frente
  where cp.tenant_id = v_tenant
    and (cp.criado_em at time zone 'America/Sao_Paulo')::date = v_dia;

  return json_build_object('ok', true, 'dia', to_char(v_dia, 'DD/MM/YYYY'), 'linhas', v_linhas);
end;
$$;


--
-- Name: conteudo_periodo(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.conteudo_periodo(p_ini date DEFAULT NULL::date, p_fim date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date; v_fim date; v_itens json; v_sync json;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  select coalesce(p_ini, v_hoje - cf.janela_atras_dias),
         coalesce(p_fim, v_hoje + cf.janela_frente_dias)
    into v_ini, v_fim
    from public.conteudo_fonte cf
   where cf.tenant_id = v_tenant and cf.ativo
   order by cf.codigo limit 1;
  if v_ini is null then
    v_ini := coalesce(p_ini, v_hoje); v_fim := coalesce(p_fim, v_hoje);
  end if;

  select coalesce(json_agg(json_build_object(
           'id', c.id, 'titulo', coalesce(c.titulo, '(sem titulo)'), 'data', c.data,
           'tipo_rotulo', c.tipo_rotulo, 'tipo_codigo', c.tipo_codigo,
           'status_rotulo', c.status_rotulo, 'status_codigo', c.status_codigo,
           'semana', c.semana, 'url', c.url,
           'hoje', c.data = v_hoje,
           'metrica', case when m.medido_em is null then null else json_build_object(
              'alcance', m.alcance, 'conversas', m.conversas,
              'medido_em', m.medido_em,
              'medido_dias', (v_hoje - (m.medido_em at time zone 'America/Sao_Paulo')::date)
           ) end) order by c.data, c.tipo_rotulo nulls last, c.titulo), '[]'::json)
    into v_itens
    from public.conteudo c
    left join lateral (
      select mm.alcance, mm.conversas, mm.medido_em
        from public.conteudo_metrica mm
       where mm.tenant_id = c.tenant_id and mm.conteudo_id = c.id
       order by mm.medido_em desc, mm.criado_em desc
       limit 1) m on true
   where c.tenant_id = v_tenant and c.sumiu_em is null
     and ( c.data between v_ini and v_fim
           or ( c.data < v_hoje
                and coalesce(c.status_codigo, '') not in ('publicado', 'descartado') ) );

  select json_build_object('ok', l.ok, 'quando', l.criado_em, 'msg', l.msg,
                           'horas', round(extract(epoch from (now() - l.criado_em)) / 3600.0)::int)
    into v_sync
    from public.conteudo_sync_log l
   where l.tenant_id = v_tenant order by l.id desc limit 1;

  -- `ini` e `fim` continuam sendo a janela DO FUNIL, e e isso que a tela declara
  -- no topo. `atraso_sem_janela` avisa a tela de que a coluna Atrasados nao
  -- obedece a esse recorte: sem esse aviso o cabecalho declararia uma janela que
  -- uma das cinco colunas nao cumpre, que e a mesma mentira por omissao que a
  -- declaracao de janela veio consertar.
  return json_build_object('ok', true, 'ini', v_ini, 'fim', v_fim, 'hoje', v_hoje,
                           'atraso_sem_janela', true,
                           'itens', v_itens, 'sync', coalesce(v_sync, json_build_object('ok', null)));
end
$$;


--
-- Name: criar_acao_escopo(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.criar_acao_escopo(p_frente text, p_titulo text) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_usuario uuid := auth.uid();
  v_titulo  text := btrim(coalesce(p_titulo, ''));
  v_id uuid;
begin
  if v_tenant is null or v_usuario is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Só o dono edita o escopo.');
  end if;
  if v_titulo = '' then
    return json_build_object('ok', false, 'msg', 'Escreva o que precisa ser feito.');
  end if;

  -- Teto medido: sem ele um titulo de 5000 chars entra inteiro e estoura o card
  -- na tela. Recusa explicita, nunca truncar em silencio: texto cortado sem
  -- aviso e pior que texto recusado.
  if length(v_titulo) > 160 then
    return json_build_object('ok', false, 'msg', 'Ação muito longa. Resuma em até 160 caracteres.');
  end if;

  if not exists (select 1 from public.escopo_frente
                  where tenant_id = v_tenant and codigo = p_frente and ativo) then
    return json_build_object('ok', false, 'msg', 'Essa frente não existe ou está desligada.');
  end if;

  -- O evento de nascimento NAO se insere aqui: o trigger tg_escopo_acao_evento
  -- (Task 1b) grava sozinho. Inserir tambem duplicaria o log.
  insert into public.escopo_acao(tenant_id, frente, titulo, status)
  values (v_tenant, p_frente, v_titulo, 'a_fazer')
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'msg', 'Ação criada.');
end $$;


--
-- Name: definir_meta_frente(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.definir_meta_frente(p_frente text, p_meta text) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_meta   text;
  n        int;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'So o dono define a meta da frente.');
  end if;

  v_meta := nullif(btrim(coalesce(p_meta, '')), '');

  -- recusa explicita com o numero medido. Truncar aqui seria pior que recusar:
  -- texto cortado sem aviso e mentira silenciosa (v46, secao 4.3).
  if v_meta is not null and char_length(v_meta) > 200 then
    return json_build_object('ok', false,
      'msg', 'A meta tem ' || char_length(v_meta) || ' caracteres e o limite e 200. Nada foi gravado.');
  end if;

  update public.escopo_frente
     set meta = v_meta, atualizado_em = now()
   where tenant_id = v_tenant and codigo = p_frente;
  get diagnostics n = row_count;

  if n = 0 then
    return json_build_object('ok', false, 'msg', 'Frente nao encontrada.');
  end if;

  return json_build_object('ok', true,
    'msg', case when v_meta is null then 'Meta limpa.' else 'Meta declarada.' end);
end $$;


--
-- Name: definir_prioridade_acao(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.definir_prioridade_acao(p_id uuid, p_prioridade text) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_usuario uuid := auth.uid();
  -- nullif(btrim(...)) faz nulo e string so-de-espaco caírem no mesmo caminho:
  -- os dois LIMPAM. lower() e defensivo, nao amplia o dominio.
  v_prio    text := lower(nullif(btrim(coalesce(p_prioridade, '')), ''));
  n int;
begin
  if v_tenant is null or v_usuario is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Só o dono edita o escopo.');
  end if;

  -- Validacao EXPLICITA antes do UPDATE. Sem ela o CHECK
  -- escopo_acao_prioridade_ck estoura como SQLSTATE 23514 e o PostgREST devolve
  -- "new row for relation ... violates check constraint" cru na tela do dono.
  -- Mensagem de banco nao e mensagem de produto (spec, secao 5; prova 16).
  if v_prio is not null and v_prio not in ('alta','media','baixa') then
    return json_build_object('ok', false,
      'msg', 'Urgência desconhecida. Use alta, media ou baixa.');
  end if;

  -- Nenhum evento e emitido aqui, e nao ha trigger que emita: tg_escopo_acao_evento
  -- so grava quando new.status is distinct from old.status. E condicao de
  -- existencia do grafico (spec, secao 3): declarar urgencia nao pode zerar
  -- dias_parada e fazer a frente abandonada parecer recem-tocada.
  update public.escopo_acao
     set prioridade    = v_prio,
         atualizado_em = now()
   where id = p_id and tenant_id = v_tenant and not arquivada;
  get diagnostics n = row_count;

  if n = 0 then
    return json_build_object('ok', false, 'msg', 'Ação não encontrada.');
  end if;

  return json_build_object('ok', true, 'prioridade', v_prio,
    'msg', case when v_prio is null then 'Urgência removida.' else 'Pronto.' end);
end $$;


--
-- Name: descartar_acao_escopo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.descartar_acao_escopo(p_id uuid) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  n int;
begin
  if v_tenant is null or auth.uid() is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Só o dono edita o escopo.');
  end if;
  update public.escopo_acao
     set arquivada = true, atualizado_em = now()
   where id = p_id and tenant_id = v_tenant and not arquivada;
  get diagnostics n = row_count;
  if n = 0 then
    return json_build_object('ok', false, 'msg', 'Ação não encontrada.');
  end if;
  return json_build_object('ok', true, 'msg', 'Descartada.');
end $$;


--
-- Name: desligar_motoboy(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.desligar_motoboy(p_id uuid, p_desligar boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_nome text;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  update public.motoboy
     set desligado_em = case when p_desligar then now() else null end,
         atualizado_em = now()
   where id = p_id and tenant_id = v_tenant
  returning nome into v_nome;
  if v_nome is null then
    return jsonb_build_object('ok', false, 'erro', 'Motoboy nao encontrado.');
  end if;
  return jsonb_build_object('ok', true, 'msg',
    v_nome || (case when p_desligar then ' saiu da lista.' else ' voltou para a lista.' end));
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'erro', 'Ja existe um motoboy ativo com esse WhatsApp.');
end
$$;


--
-- Name: editar_lead(uuid, text, text, text, text, text, text, text, text, text, boolean, numeric, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.editar_lead(p_lead_id uuid, p_nome text, p_whatsapp text, p_produto text, p_condicao text, p_perfil text, p_origem text, p_indicado_por text, p_observacoes text, p_aparelho_entrada text, p_upgrade_entrada boolean, p_valor_oferta numeric, p_proximo_contato date, p_data_nascimento date) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $_$
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
end; $_$;


--
-- Name: editar_venda(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.editar_venda(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $_$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_venda  public.venda%rowtype;
  v_campos jsonb := '{}'::jsonb;
  v_id     uuid  := nullif(payload->>'id','')::uuid;
  v_status text;
  v_etapa  text;
  v_dig    text;
  k        text;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe qual venda corrigir.');
  end if;

  -- o RLS isola o tenant aqui: venda de outro tenant simplesmente nao aparece,
  -- e a mensagem nao diz se existe em outro lugar.
  select * into v_venda from public.venda where id = v_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Venda nao encontrada.');
  end if;
  if v_venda.arquivado_em is not null then
    return jsonb_build_object('ok', false, 'erro', 'Venda arquivada: desarquive antes de corrigir.');
  end if;

  -- texto
  foreach k in array array[
    'modelo_texto','capacidade','cor','condicao','imei',
    'comprador_nome','comprador_cpf','comprador_instagram',
    'fornecedor_nome','fornecedor_contato','fornecedor_local_retirada',
    'entrada_modelo','entrada_imei','endereco_entrega','motoboy',
    'forma_pagamento','nf_numero','observacoes'
  ] loop
    if payload ? k then
      v_campos := v_campos || jsonb_build_object(k, nullif(btrim(coalesce(payload->>k,'')), ''));
    end if;
  end loop;

  -- numerico (aceita virgula decimal, como o operador digita)
  foreach k in array array[
    'valor_venda','custo_aparelho','despesa_frete','despesa_taxas',
    'entrada_valor','valor_a_cobrar'
  ] loop
    if payload ? k then
      begin
        v_campos := v_campos || jsonb_build_object(
          k, nullif(btrim(replace(coalesce(payload->>k,''), ',', '.')), '')::numeric);
      exception when others then
        return jsonb_build_object('ok', false, 'erro', 'Numero invalido no campo ' || k || '.');
      end;
    end if;
  end loop;

  if payload ? 'comprador_nascimento' then
    begin
      v_campos := v_campos || jsonb_build_object(
        'comprador_nascimento', nullif(btrim(coalesce(payload->>'comprador_nascimento','')), '')::date);
    exception when others then
      return jsonb_build_object('ok', false, 'erro', 'Data de nascimento invalida.');
    end;
  end if;

  if payload ? 'tem_trade_in' then
    begin
      v_campos := v_campos || jsonb_build_object(
        'tem_trade_in', coalesce(nullif(btrim(coalesce(payload->>'tem_trade_in','')),'')::boolean, false));
    exception when others then
      return jsonb_build_object('ok', false, 'erro', 'Campo de troca invalido.');
    end;
  end if;

  -- telefone: mesma normalizacao do registrar_venda, senao a mesma pessoa vira
  -- dois formatos diferentes na base
  if payload ? 'comprador_whatsapp' then
    v_dig := nullif(regexp_replace(coalesce(payload->>'comprador_whatsapp',''), '\D', '', 'g'), '');
    if v_dig is not null and length(v_dig) in (10,11) then v_dig := '55' || v_dig; end if;
    if v_dig is not null and v_dig !~ '^[0-9]{10,15}$' then
      return jsonb_build_object('ok', false, 'erro', 'Telefone invalido apos normalizacao: ' || v_dig);
    end if;
    v_campos := v_campos || jsonb_build_object('comprador_whatsapp', v_dig);
  end if;

  -- o do motoboy passa pela MESMA normalizacao: o relatorio de entrega monta o
  -- link de WhatsApp a partir dele, e numero fora do formato vira link quebrado.
  if payload ? 'motoboy_whatsapp' then
    v_dig := nullif(regexp_replace(coalesce(payload->>'motoboy_whatsapp',''), '\D', '', 'g'), '');
    if v_dig is not null and length(v_dig) in (10,11) then v_dig := '55' || v_dig; end if;
    if v_dig is not null and v_dig !~ '^[0-9]{10,15}$' then
      return jsonb_build_object('ok', false, 'erro', 'WhatsApp do motoboy invalido: ' || v_dig);
    end if;
    v_campos := v_campos || jsonb_build_object('motoboy_whatsapp', v_dig);
  end if;

  if payload ? 'status' then
    v_status := coalesce(nullif(btrim(coalesce(payload->>'status','')), ''), 'concluida');
    if v_status not in ('pre_venda','concluida','cancelada') then
      return jsonb_build_object('ok', false, 'erro', 'Situacao invalida: ' || v_status);
    end if;
    v_campos := v_campos || jsonb_build_object('status', v_status);
  end if;

  -- etapa: NOT NULL, entao vazio mantem a atual em vez de limpar
  if payload ? 'etapa' then
    v_etapa := coalesce(nullif(btrim(coalesce(payload->>'etapa','')), ''), v_venda.etapa);
    if v_etapa not in ('pendente','a_retirar','em_maos','a_caminho','entregue') then
      return jsonb_build_object('ok', false, 'erro', 'Etapa invalida: ' || v_etapa);
    end if;
    v_campos := v_campos || jsonb_build_object('etapa', v_etapa);
  end if;

  -- validacoes minimas, as mesmas do cadastro
  if v_campos ? 'valor_venda'
     and coalesce((v_campos->>'valor_venda')::numeric, 0) <= 0 then
    return jsonb_build_object('ok', false, 'erro', 'Informe o valor da venda.');
  end if;
  if v_campos ? 'modelo_texto' and nullif(v_campos->>'modelo_texto','') is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe o modelo.');
  end if;

  -- Modelo digitado diferente do que estava: o vinculo com o catalogo cai.
  -- Sem isso a v_venda continuaria exibindo o rotulo antigo do catalogo
  -- (modelo_rotulo = coalesce(catalogo.rotulo, modelo_texto)) e a tela mentiria.
  if v_campos ? 'modelo_texto'
     and coalesce(v_campos->>'modelo_texto','') is distinct from coalesce(v_venda.modelo_texto,'') then
    v_campos := v_campos || jsonb_build_object('modelo_id', null);
  end if;

  perform privado.fn_venda_atualizar(v_venda.id, v_campos);

  return jsonb_build_object('ok', true, 'id', v_venda.id, 'venda_code', v_venda.venda_code);
exception
  when check_violation then
    return jsonb_build_object('ok', false, 'erro', 'Valor recusado pelo banco: confira condicao, situacao e forma de pagamento.');
end
$_$;


--
-- Name: FUNCTION editar_venda(payload jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.editar_venda(payload jsonb) IS 'Corrige venda ja registrada. Whitelist de 28 campos; nao aceita lead_id nem data_venda (ancora do pos-venda). Escreve por privado.fn_venda_atualizar.';


--
-- Name: escopo_completo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.escopo_completo() RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_out    json;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;

  with base as (
    select ef.codigo, ef.rotulo, ef.grupo, ef.icone, ef.ordem, ef.meta,
           count(ea.id)                                              as total,
           count(ea.id) filter (where ea.status = 'feito')            as feitas,
           count(ea.id) filter (where ea.status = 'travado')          as travadas,
           -- Fatia A: quantas acoes vivas estao em andamento. E o SEGUNDO CANAL
           -- do grafico (coluna solida + ponto), nunca a cor: a cor ja carrega
           -- abandono, e empilhar dois significados no mesmo canal e o erro que
           -- o sistema Trilho x Sinal existe para evitar.
           count(ea.id) filter (where ea.status = 'fazendo')          as fazendo,
           -- Fatia A: a MAIOR prioridade entre as acoes vivas nao-feitas.
           -- DERIVADO na leitura, nunca coluna (invariante 4). O rank e 1=alta,
           -- 2=media, 3=baixa, e min() ignora nulo sozinho, entao acao sem
           -- urgencia declarada nao arrasta a frente para baixa.
           -- `filter (where ea.status <> 'feito')`: acao ja feita nao e urgencia
           -- pendente. Frente sem acao nenhuma cai no left join com ea.status
           -- nulo, o filter da falso e urg_rank vem null, como tem que vir.
           min(case ea.prioridade
                 when 'alta'  then 1
                 when 'media' then 2
                 when 'baixa' then 3
               end) filter (where ea.status <> 'feito')               as urg_rank,
           -- `and not a2.arquivada` NAO e detalhe: sem ele, criar e arquivar uma
           -- acao descartavel zera o relogio da frente. Medido em 04/08/2026:
           -- uma frente parada ha 40 dias pulava de nota 30 para 60 com esse
           -- truque, comprando 30 pontos de Movimento sem trabalho nenhum. O
           -- filtro tambem casa com total/feitas/travadas, que ja ignoram
           -- arquivada, e faz dias_parada vir null quando a faixa e sem_dado.
           (select max(ev.em) from public.escopo_acao_evento ev
              join public.escopo_acao a2 on a2.id = ev.acao_id
             where ev.tenant_id = v_tenant and a2.frente = ef.codigo
               and not a2.arquivada) as ult_evento
      from public.escopo_frente ef
      left join public.escopo_acao ea
        on ea.tenant_id = v_tenant and ea.frente = ef.codigo and not ea.arquivada
     where ef.tenant_id = v_tenant and ef.ativo
     group by ef.codigo, ef.rotulo, ef.grupo, ef.icone, ef.ordem, ef.meta
  ), calc as (
    select b.*,
           case when b.ult_evento is null then null
                else (v_hoje - (b.ult_evento at time zone 'America/Sao_Paulo')::date)
           end as dias_parada
      from base b
  ), nota as (
    select c.*,
           case when c.total = 0 then null else round(  -- ::int no fim: sem ele a nota pode sair como 100.0000 no JSON
             (c.feitas::numeric / c.total) * 40
             + (1 - c.travadas::numeric / c.total) * 30
             + case
                 when c.dias_parada is null then 0
                 when c.dias_parada <= 7  then 30
                 when c.dias_parada >= 30 then 0
                 else 30 * (30 - c.dias_parada)::numeric / 23
               end
           )::int end as nota
      from calc c
  )
  select coalesce(json_agg(json_build_object(
           'codigo', n.codigo, 'rotulo', n.rotulo, 'grupo', n.grupo,
           'icone', n.icone, 'ordem', n.ordem,
           'total', n.total, 'feitas', n.feitas, 'travadas', n.travadas,
           'fazendo', n.fazendo,
           'urgencia', case n.urg_rank when 1 then 'alta'
                                       when 2 then 'media'
                                       when 3 then 'baixa' end,
           'dias_parada', n.dias_parada,
           'nota', n.nota,
           'meta', n.meta, 'meta_declarada', (n.meta is not null),
           'faixa', case
                      when n.total = 0            then 'sem_dado'
                      -- teto: sem destino declarado a frente nao exibe "a frente".
                      -- Tres acoes bobas com duas fechadas cravariam desempenho
                      -- onde nao existe referencia.
                      when n.meta is null and n.nota >= 70 then 'normal'
                      when n.nota >= 70           then 'a_frente'
                      when n.nota >= 40           then 'normal'
                      else 'em_baixa' end,
           'acoes', coalesce((
             select json_agg(json_build_object(
                      'id', a.id, 'titulo', a.titulo, 'status', a.status,
                      'motivo_trava', a.motivo_trava,
                      'prioridade', a.prioridade)
                    order by array_position(
                      array['travado','fazendo','a_fazer','feito'], a.status), a.ordem, a.criado_em)
               from public.escopo_acao a
              where a.tenant_id = v_tenant and a.frente = n.codigo and not a.arquivada
           ), '[]'::json)
         )
         -- pendencias sempre por ultimo; entre as frentes, a melhor nota primeiro,
         -- e quem nao tem dado desce pro fim do proprio grupo.
         -- A urgencia NAO entra nesta ordem: o eixo do grafico e o abandono, e
         -- reordenar aqui mudaria a ordem dos blocos que o frontend ja le.
         order by case when n.grupo = 'pendencia' then 1 else 0 end,
                  (n.nota is null), n.nota desc, n.ordem), '[]'::json)
    into v_out
    from nota n;

  return json_build_object('ok', true, 'frentes', v_out,
                           'pode_editar', privado.fn_papel_atual() = 'dono');
end $$;


--
-- Name: fin_classificar(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_classificar(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
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
    -- Repasse so existe em PAR. Deixar escolher a mao faz o valor sair dos
    -- totais sem contraparte, que e despesa escondida atras de categoria neutra.
    -- A defesa vive AQUI, no servidor: sumir do seletor e conforto, o payload
    -- da RPC e publico e a tela nunca e o guarda.
    if exists (select 1 from public.fin_categoria
                where tenant_id = v_tenant and codigo = v_cat and not atribuivel_manual) then
      return jsonb_build_object('ok', false, 'erro', 'Categoria nao pode ser escolhida a mao: ' || v_cat);
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


--
-- Name: fin_cobertura(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_cobertura(p_ini date DEFAULT NULL::date, p_fim date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date; v_fim date;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Financeiro e restrito ao dono.');
  end if;

  v_fim := coalesce(p_fim, v_hoje);
  v_ini := coalesce(p_ini, date_trunc('month', v_fim)::date);
  if v_ini > v_fim then
    return json_build_object('ok', false, 'msg', 'Janela invertida.');
  end if;

  return (jsonb_build_object(
            'ok', true, 'ini', v_ini, 'fim', v_fim, 'hoje', v_hoje, 'teto', 95)
          || privado.fn_fin_cobertura(v_tenant, v_ini, v_fim)::jsonb)::json;
end
$$;


--
-- Name: fin_config(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_config() RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_contas json; v_cats json;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Financeiro e restrito ao dono.');
  end if;

  select coalesce(json_agg(json_build_object(
           'id', id, 'codigo', codigo, 'rotulo', rotulo, 'banco', banco,
           'tipo', tipo, 'dominio_padrao', dominio_padrao, 'ordem', ordem)
         order by ordem, rotulo), '[]'::json)
    into v_contas
    from public.fin_conta
   where tenant_id = v_tenant and ativo;

  select coalesce(json_agg(json_build_object(
           'codigo', codigo, 'rotulo', rotulo, 'grupo', grupo,
           'natureza_esperada', natureza_esperada,
           'dominio_sugerido', dominio_sugerido, 'ordem', ordem,
           'atribuivel_manual', atribuivel_manual)
         order by ordem, rotulo), '[]'::json)
    into v_cats
    from public.fin_categoria
   where tenant_id = v_tenant and ativo;

  return json_build_object('ok', true, 'contas', v_contas, 'categorias', v_cats);
end
$$;


--
-- Name: fin_importar_extrato(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_importar_extrato(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
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
$$;


--
-- Name: fin_lancar(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_lancar(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
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


--
-- Name: fin_movimentos(date, date, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_movimentos(p_ini date DEFAULT NULL::date, p_fim date DEFAULT NULL::date, p_dominio text DEFAULT NULL::text, p_status text DEFAULT 'todos'::text, p_ordem text DEFAULT 'data'::text, p_contraparte text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date; v_fim date;
  v_dom text; v_status text; v_ordem text;
  v_cp_raw text; v_cp text; v_cp_sem boolean := false; v_cp_echo text;
  v_n int; v_total numeric; v_itens json;
  v_cps json; v_cps_n int;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Financeiro e restrito ao dono.');
  end if;

  v_fim := coalesce(p_fim, v_hoje);
  v_ini := coalesce(p_ini, date_trunc('month', v_fim)::date);
  if v_ini > v_fim then
    return json_build_object('ok', false, 'msg', 'Janela invertida.');
  end if;

  v_dom := nullif(lower(btrim(coalesce(p_dominio, ''))), '');
  if v_dom = 'tudo' then v_dom := null; end if;
  if v_dom is not null and v_dom not in ('empresa','pessoal') then
    return json_build_object('ok', false, 'msg', 'Dominio invalido: use empresa, pessoal ou tudo.');
  end if;

  v_status := coalesce(nullif(lower(btrim(coalesce(p_status, ''))), ''), 'todos');
  if v_status not in ('todos','nao_classificados') then
    return json_build_object('ok', false, 'msg', 'Status invalido: use todos ou nao_classificados.');
  end if;
  -- em nao_classificados o filtro de dominio nao faz sentido: dominio e null.
  if v_status = 'nao_classificados' then v_dom := null; end if;

  -- p_ordem existe por causa do F3: julgar do MAIOR valor para o menor e o que
  -- transforma 2% de cobertura em 95% em tempo humano. Ordenar no cliente seria
  -- mentira assim que a lista passar do limit 500: a tela ordenaria as 500 que
  -- recebeu, nao as maiores da janela.
  v_ordem := coalesce(nullif(lower(btrim(coalesce(p_ordem, ''))), ''), 'data');
  if v_ordem not in ('data','valor') then
    return json_build_object('ok', false, 'msg', 'Ordem invalida: use data ou valor.');
  end if;

  -- ---- filtro por contraparte ------------------------------------------
  -- O sentinela 'sem_contraparte' e testado ANTES da normalizacao, no molde
  -- do 'sem_categoria' que o fin_painel ja usa. Ele existe porque o resumo
  -- devolve um balde de nome nulo (19 linhas de Aplicacao e Resgate RDB,
  -- medidas): balde que aparece na tela e nao pode ser clicado e beco sem
  -- saida.
  -- A normalizacao passa pela MESMA helper que gravou a coluna
  -- (privado.fn_fin_cp_norm), senao o dono digitaria o nome com acento ou
  -- em minuscula e a tela devolveria zero linha em silencio.
  v_cp_raw := nullif(btrim(coalesce(p_contraparte, '')), '');
  if v_cp_raw is not null and lower(v_cp_raw) = 'sem_contraparte' then
    v_cp_sem := true;
    v_cp_echo := 'sem_contraparte';
  elsif v_cp_raw is not null then
    v_cp := privado.fn_fin_cp_norm(v_cp_raw);
    v_cp_echo := v_cp;
  end if;

  -- ---- contadores do recorte EXIBIDO (respeitam p_contraparte) ---------
  select count(*)::int, coalesce(sum(m.valor), 0)
    into v_n, v_total
    from public.fin_movimento m
   where m.tenant_id = v_tenant
     and m.arquivado_em is null
     and m.data between v_ini and v_fim
     and (v_status <> 'nao_classificados' or m.dominio is null)
     and (v_dom is null or m.dominio = v_dom)
     and (not v_cp_sem or m.contraparte is null)
     and (v_cp is null or m.contraparte = v_cp);

  select coalesce(json_agg(t order by
           case when v_ordem = 'valor' then abs(t.valor) end desc nulls last,
           t.data desc, t.criado_em desc), '[]'::json)
    into v_itens
    from (
      select m.id, m.data, m.descricao, m.descricao_original, m.valor,
             m.categoria_codigo,
             c.rotulo as categoria_rotulo,
             c.grupo,
             c.natureza_esperada,
             m.dominio, m.origem, m.repasse_id, m.contraparte,
             co.rotulo as conta_rotulo,
             m.observacao, m.venda_id, m.criado_em
        from public.fin_movimento m
        join public.fin_conta co on co.id = m.conta_id
        left join public.fin_categoria c
          on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
       where m.tenant_id = v_tenant
         and m.arquivado_em is null
         and m.data between v_ini and v_fim
         and (v_status <> 'nao_classificados' or m.dominio is null)
         and (v_dom is null or m.dominio = v_dom)
         and (not v_cp_sem or m.contraparte is null)
         and (v_cp is null or m.contraparte = v_cp)
       order by
         case when v_ordem = 'valor' then abs(m.valor) end desc nulls last,
         m.data desc, m.criado_em desc
       limit 500
    ) t;

  -- ---- resumo POR contraparte ------------------------------------------
  -- Recorte de janela, dominio e status. SEM p_contraparte, de proposito.
  -- `pendente` aqui e a definicao literal do F3, a mesma que a
  -- privado.fn_fin_cobertura usa: sem dominio E sem categoria de natureza
  -- neutro. Aplicacao e resgate nao tem lado a decidir.
  with b as (
    select m.contraparte as nome,
           abs(m.valor) as bruto,
           (m.dominio is null and coalesce(c.natureza_esperada,'') <> 'neutro') as pendente
      from public.fin_movimento m
      left join public.fin_categoria c
        on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
     where m.tenant_id = v_tenant
       and m.arquivado_em is null
       and m.data between v_ini and v_fim
       and (v_status <> 'nao_classificados' or m.dominio is null)
       and (v_dom is null or m.dominio = v_dom)
  ), g as (
    select nome,
           count(*)::int as n,
           coalesce(sum(bruto), 0) as bruto,
           count(*) filter (where pendente)::int as n_pendente,
           coalesce(sum(bruto) filter (where pendente), 0) as valor_pendente
      from b group by nome
  )
  select
    (select count(*)::int from g),
    -- teto de 200 no molde do limit 500 dos itens, e por isso viaja
    -- contrapartes_truncado: a tela DECLARA o recorte em vez de mentir por
    -- omissao. Ordenado por bruto desc, entao o que fica de fora e sempre a
    -- cauda pequena, e as 68 que cobrem 95% do pendente estao no topo.
    coalesce((select json_agg(x) from (
       select nome, n, bruto, n_pendente, valor_pendente
         from g order by bruto desc, nome nulls last limit 200) x), '[]'::json)
    into v_cps_n, v_cps;

  return json_build_object(
    'ok', true, 'ini', v_ini, 'fim', v_fim, 'hoje', v_hoje,
    'dominio', coalesce(v_dom, 'tudo'), 'status', v_status, 'ordem', v_ordem,
    'contraparte', v_cp_echo,
    'n', v_n, 'total', v_total, 'truncado', (v_n > 500),
    'itens', v_itens,
    'contrapartes', v_cps,
    'contrapartes_n', v_cps_n,
    'contrapartes_truncado', (v_cps_n > 200));
end
$$;


--
-- Name: fin_painel(date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_painel(p_ini date DEFAULT NULL::date, p_fim date DEFAULT NULL::date, p_dominio text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date; v_fim date; v_pini date; v_pfim date;
  v_dom text;
  v_entrou numeric; v_saiu numeric; v_result numeric;
  v_nc_val numeric; v_nc_n int; v_nc_ent numeric; v_nc_sai numeric;
  v_secoes json; v_entradas json;
  v_pct numeric;
  v_rep_val numeric; v_rep_n int;
  v_orf_val numeric; v_orf_n int;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Financeiro e restrito ao dono.');
  end if;

  v_fim := coalesce(p_fim, v_hoje);
  v_ini := coalesce(p_ini, date_trunc('month', v_fim)::date);
  if v_ini > v_fim then
    return json_build_object('ok', false, 'msg', 'Janela invertida.');
  end if;
  v_pfim := v_ini - 1;
  v_pini := v_ini - (v_fim - v_ini + 1);

  v_dom := nullif(lower(btrim(coalesce(p_dominio, ''))), '');
  if v_dom = 'tudo' then v_dom := null; end if;
  if v_dom is not null and v_dom not in ('empresa','pessoal') then
    return json_build_object('ok', false, 'msg', 'Dominio invalido: use empresa, pessoal ou tudo.');
  end if;

  v_pct := (privado.fn_fin_cobertura(v_tenant, v_ini, v_fim) ->> 'pct_julgado')::numeric;

  select
    coalesce(sum(b.valor) filter (where b.conta_no_total and b.valor > 0 and b.nat <> 'saida'), 0)
      - coalesce(sum(-b.valor) filter (where b.conta_no_total and b.valor < 0 and b.nat = 'entrada'), 0),
    coalesce(-sum(b.valor) filter (where b.conta_no_total and b.valor < 0 and b.nat <> 'entrada'), 0)
      - coalesce(sum(b.valor) filter (where b.conta_no_total and b.valor > 0 and b.nat = 'saida'), 0),
    coalesce(sum(b.valor) filter (where b.conta_no_total), 0),
    coalesce(sum(b.valor) filter (where b.dominio is null), 0),
    coalesce(count(*) filter (where b.dominio is null), 0),
    coalesce(sum(b.valor) filter (where b.dominio is null and b.valor > 0), 0),
    coalesce(sum(b.valor) filter (where b.dominio is null and b.valor < 0), 0),
    coalesce(sum(abs(b.valor)) filter (where b.rep is not null), 0),
    coalesce(count(*) filter (where b.rep is not null), 0),
    coalesce(sum(abs(b.valor)) filter (where b.cat = 'repasse' and b.rep is null), 0),
    coalesce(count(*) filter (where b.cat = 'repasse' and b.rep is null), 0)
  into v_entrou, v_saiu, v_result, v_nc_val, v_nc_n, v_nc_ent, v_nc_sai,
       v_rep_val, v_rep_n, v_orf_val, v_orf_n
  from (
    select m.valor, m.dominio,
           coalesce(m.categoria_codigo, '') as cat,
           m.repasse_id as rep,
           coalesce(c.natureza_esperada, '') as nat,
           ( m.dominio is not null
             and (v_dom is null or m.dominio = v_dom)
             and coalesce(c.natureza_esperada, '') <> 'neutro' ) as conta_no_total
      from public.fin_movimento m
      left join public.fin_categoria c
        on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
     where m.tenant_id = v_tenant
       and m.arquivado_em is null
       and m.data between v_ini and v_fim
  ) b;

  with base as (
    select coalesce(c.grupo, 'Sem categoria') as grupo,
           coalesce(m.categoria_codigo, 'sem_categoria') as codigo,
           coalesce(c.rotulo, 'Sem categoria') as rotulo,
           m.valor,
           (m.data between v_ini and v_fim) as atual
      from public.fin_movimento m
      left join public.fin_categoria c
        on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
     where m.tenant_id = v_tenant
       and m.arquivado_em is null
       and m.data between v_pini and v_fim
       and m.dominio is not null
       and (v_dom is null or m.dominio = v_dom)
       and ( coalesce(c.natureza_esperada, '') = 'saida'
             or (m.categoria_codigo is null and m.valor < 0) )
  ), cat as (
    select grupo, codigo, rotulo,
           coalesce(sum(-valor) filter (where atual), 0)                  as tot,
           coalesce(sum(-valor) filter (where atual and valor < 0), 0)    as bruto,
           coalesce(sum(valor)  filter (where atual and valor > 0), 0)    as abatido,
           coalesce(sum(-valor) filter (where not atual), 0)              as ant,
           coalesce(count(*)    filter (where atual), 0)::int             as n
      from base group by grupo, codigo, rotulo
  ), g as (
    select coalesce(sum(tot), 0) as total from cat
  ), sec as (
    select cat.grupo, sum(cat.tot) as tot, sum(cat.ant) as ant,
           json_agg(json_build_object(
             'codigo', cat.codigo, 'rotulo', cat.rotulo, 'total', cat.tot,
             'bruto', cat.bruto, 'abatido', cat.abatido,
             'pct', case when g.total > 0 then round(100.0 * cat.tot / g.total, 1) else 0 end,
             'delta_pct', case when cat.ant > 0 then round(100.0 * (cat.tot - cat.ant) / cat.ant, 1) else null end,
             'n', cat.n) order by cat.tot desc, cat.rotulo)
             filter (where cat.tot <> 0 or cat.abatido <> 0) as cats
      from cat cross join g
     group by cat.grupo, g.total
  )
  select coalesce(json_agg(json_build_object(
           'grupo', sec.grupo, 'total', sec.tot,
           'pct', case when g.total > 0 then round(100.0 * sec.tot / g.total, 1) else 0 end,
           'delta_pct', case when sec.ant > 0 then round(100.0 * (sec.tot - sec.ant) / sec.ant, 1) else null end,
           'categorias', coalesce(sec.cats, '[]'::json))
         order by sec.tot desc, sec.grupo) filter (where sec.tot <> 0 or sec.cats is not null), '[]'::json)
    into v_secoes
    from sec cross join g;

  with base as (
    select coalesce(c.grupo, 'Sem categoria') as grupo,
           coalesce(m.categoria_codigo, 'sem_categoria') as codigo,
           coalesce(c.rotulo, 'Sem categoria') as rotulo,
           m.valor,
           (m.data between v_ini and v_fim) as atual
      from public.fin_movimento m
      left join public.fin_categoria c
        on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
     where m.tenant_id = v_tenant
       and m.arquivado_em is null
       and m.data between v_pini and v_fim
       and m.dominio is not null
       and (v_dom is null or m.dominio = v_dom)
       and ( coalesce(c.natureza_esperada, '') = 'entrada'
             or (m.categoria_codigo is null and m.valor > 0) )
  ), cat as (
    select grupo, codigo, rotulo,
           coalesce(sum(valor)  filter (where atual), 0)                  as tot,
           coalesce(sum(valor)  filter (where atual and valor > 0), 0)    as bruto,
           coalesce(sum(-valor) filter (where atual and valor < 0), 0)    as abatido,
           coalesce(sum(valor)  filter (where not atual), 0)              as ant,
           coalesce(count(*)    filter (where atual), 0)::int             as n
      from base group by grupo, codigo, rotulo
  ), g as (
    select coalesce(sum(tot), 0) as total from cat
  ), sec as (
    select cat.grupo, sum(cat.tot) as tot, sum(cat.ant) as ant,
           json_agg(json_build_object(
             'codigo', cat.codigo, 'rotulo', cat.rotulo, 'total', cat.tot,
             'bruto', cat.bruto, 'abatido', cat.abatido,
             'pct', case when g.total > 0 then round(100.0 * cat.tot / g.total, 1) else 0 end,
             'delta_pct', case when cat.ant > 0 then round(100.0 * (cat.tot - cat.ant) / cat.ant, 1) else null end,
             'n', cat.n) order by cat.tot desc, cat.rotulo)
             filter (where cat.tot <> 0 or cat.abatido <> 0) as cats
      from cat cross join g
     group by cat.grupo, g.total
  )
  select coalesce(json_agg(json_build_object(
           'grupo', sec.grupo, 'total', sec.tot,
           'pct', case when g.total > 0 then round(100.0 * sec.tot / g.total, 1) else 0 end,
           'delta_pct', case when sec.ant > 0 then round(100.0 * (sec.tot - sec.ant) / sec.ant, 1) else null end,
           'categorias', coalesce(sec.cats, '[]'::json))
         order by sec.tot desc, sec.grupo) filter (where sec.tot <> 0 or sec.cats is not null), '[]'::json)
    into v_entradas
    from sec cross join g;

  return json_build_object(
    'ok', true,
    'ini', v_ini, 'fim', v_fim, 'hoje', v_hoje,
    'dominio', coalesce(v_dom, 'tudo'),
    'pct_julgado', v_pct,
    'repasse', json_build_object('valor', v_rep_val, 'n', v_rep_n,
      'orfao_valor', v_orf_val, 'orfao_n', v_orf_n),
    'ini_anterior', v_pini, 'fim_anterior', v_pfim,
    'placar', json_build_object(
      'entrou', v_entrou, 'saiu', v_saiu, 'resultado', v_result,
      'nao_classificado_valor', v_nc_val, 'nao_classificado_n', v_nc_n,
      'nao_classificado_entradas', v_nc_ent, 'nao_classificado_saidas', v_nc_sai),
    'secoes', v_secoes,
    'entradas', v_entradas);
end
$$;


--
-- Name: fin_regra_aplicar(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_regra_aplicar(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_alc     text;
  v_ids     uuid[] := null;
  v_falta   text;
  v_r       jsonb;
  v_ncdom   int;
  v_nccat   int;
  v_n       int;
  v_conf    int;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  v_alc := coalesce(nullif(btrim(lower(coalesce(payload->>'alcance',''))), ''), 'nao_classificados');
  if v_alc not in ('nao_classificados','todos') then
    return jsonb_build_object('ok', false, 'erro',
      'Alcance invalido: use nao_classificados (padrao) ou todos.');
  end if;

  if payload ? 'ids' and jsonb_typeof(payload->'ids') = 'array' then
    if jsonb_array_length(payload->'ids') = 0 then
      return jsonb_build_object('ok', false, 'erro',
        'Lista de regras vazia. Omita a chave ids para aplicar todas as ativas.');
    end if;
    begin
      select array_agg(e::uuid) into v_ids
        from jsonb_array_elements_text(payload->'ids') e;
    exception when others then
      return jsonb_build_object('ok', false, 'erro', 'Lista de regras com id invalido.');
    end;

    select string_agg(x::text, ', ') into v_falta
      from unnest(v_ids) x
     where not exists (
       select 1 from public.fin_regra r
        where r.id = x and r.tenant_id = v_tenant and r.ativo and r.arquivado_em is null);
    if v_falta is not null then
      return jsonb_build_object('ok', false, 'erro',
        'Regra inexistente, desligada ou arquivada: ' || v_falta);
    end if;
  elsif payload ? 'ids' and payload->>'ids' is not null then
    return jsonb_build_object('ok', false, 'erro', 'ids deve ser uma lista.');
  end if;

  if not exists (select 1 from public.fin_regra
                  where tenant_id = v_tenant and ativo and arquivado_em is null) then
    return jsonb_build_object('ok', true, 'alcance', v_alc, 'classificados', 0,
      'por_regra', '[]'::jsonb, 'conflitos', 0,
      'restam_nao_classificados', (select count(*)::int from public.fin_movimento
         where tenant_id = v_tenant and arquivado_em is null and dominio is null),
      'msg', 'Nenhuma regra ativa. Nada foi alterado.');
  end if;

  v_r := privado.fn_fin_aplicar_regras(v_tenant, v_ids, null, v_alc);
  v_n    := (v_r->>'classificados')::int;
  v_conf := (v_r->>'conflitos')::int;

  select count(*) filter (where dominio is null)::int,
         count(*) filter (where categoria_codigo is null)::int
    into v_ncdom, v_nccat
    from public.fin_movimento
   where tenant_id = v_tenant and arquivado_em is null;

  return jsonb_build_object(
    'ok', true,
    'alcance', v_alc,
    'classificados', v_n,
    'por_regra', v_r->'por_regra',
    'conflitos', v_conf,
    'restam_nao_classificados', v_ncdom,
    'restam_sem_categoria', v_nccat,
    'msg', (case when v_n = 0 then 'Nada mudou: nenhum lancamento pendente casou com as regras.'
                 when v_n = 1 then '1 lancamento classificado.'
                 else v_n || ' lancamentos classificados.' end)
           || (case when v_alc = 'todos' then ' Alcance TODOS: classificacao anterior foi sobrescrita.' else '' end)
           || (case when v_conf = 0 then ''
                    when v_conf = 1 then ' 1 linha casou mais de uma regra; venceu a de menor prioridade.'
                    else ' ' || v_conf || ' linhas casaram mais de uma regra; venceu a de menor prioridade.' end)
           || (case when v_ncdom = 0 then ' Nada mais sem dominio.'
                    else ' Restam ' || v_ncdom || ' sem dominio.' end));
end
$$;


--
-- Name: fin_regra_prever(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_regra_prever(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $$
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


--
-- Name: fin_regra_salvar(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_regra_salvar(payload jsonb) RETURNS jsonb
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


--
-- Name: fin_regra_sugerir(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_regra_sugerir(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $_$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_mid    uuid;
  v_desc   text;
  v_txt    text;
  v_a      text[];
  v_idx    int;
  v_nome   text;
  v_fall   boolean := false;
  v_tot    int;
  v_nc     int;
  v_ex     jsonb;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  begin
    v_mid := nullif(btrim(coalesce(payload->>'movimento_id','')), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'movimento_id invalido.');
  end;
  if v_mid is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe o movimento_id.');
  end if;

  select coalesce(descricao_original, descricao) into v_desc
    from public.fin_movimento where id = v_mid and tenant_id = v_tenant;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Lancamento nao encontrado.');
  end if;

  v_txt := btrim(regexp_replace(v_desc, '\s+', ' ', 'g'));
  v_a   := regexp_split_to_array(v_txt, ' - ');

  select min(k) into v_idx
    from generate_subscripts(v_a, 1) k
   where v_a[k] ~ '^[0-9•][0-9•./-]{5,}$';

  if v_idx is not null and v_idx >= 2 then
    v_nome := v_a[v_idx - 1];
  elsif coalesce(array_length(v_a, 1), 1) >= 2 then
    v_nome := v_a[2];
  else
    v_nome := v_a[1];
  end if;

  -- raiz de CNPJ colada no nome ("57.141.157 REINALDO DA COSTA COENTRO NETO").
  -- So com os pontos, para nao comer o "99" de "99 TECNOLOGIA LTDA".
  v_nome := regexp_replace(v_nome, '^[0-9]{2}\.[0-9]{3}\.[0-9]{3}[ ]+', '');
  v_nome := regexp_replace(v_nome, '\s+[0-9]{4,}$', '');
  v_nome := btrim(regexp_replace(v_nome, '[ .,\-/]+$', ''));

  if length(regexp_replace(privado.fn_fin_norm(v_nome), '[^A-Z0-9]', '', 'g')) < 3 then
    v_nome := btrim(regexp_replace(regexp_replace(v_txt, '[0-9]', '', 'g'), '\s+', ' ', 'g'));
    v_fall := true;
  end if;
  if length(regexp_replace(privado.fn_fin_norm(v_nome), '[^A-Z0-9]', '', 'g')) < 3 then
    return jsonb_build_object('ok', false, 'erro',
      'Nao consegui extrair um padrao util desta descricao. Digite a regra na mao.');
  end if;

  select count(*)::int,
         count(*) filter (where dominio is null or categoria_codigo is null)::int
    into v_tot, v_nc
    from public.fin_movimento m
   where m.tenant_id = v_tenant and m.arquivado_em is null
     and privado.fn_fin_casa(
           privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)), v_nome, 'contem');

  select coalesce(jsonb_agg(to_jsonb(t.texto)), '[]'::jsonb) into v_ex from (
    select distinct coalesce(m.descricao_original, m.descricao) as texto
      from public.fin_movimento m
     where m.tenant_id = v_tenant and m.arquivado_em is null
       and privado.fn_fin_casa(
             privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)), v_nome, 'contem')
     order by 1 limit 5
  ) t;

  return jsonb_build_object(
    'ok', true,
    'movimento_id', v_mid,
    'descricao', v_desc,
    'padrao', v_nome,
    'tipo_match', 'contem',
    'origem', 'aprendida',
    'fallback', v_fall,
    'casaria_n', v_tot,
    'casaria_nao_classificados', v_nc,
    'exemplos', v_ex,
    'msg', (case when v_tot <= 1 then 'Essa regra pega so este lancamento por enquanto.'
                 else 'Essa regra pega outros ' || (v_tot - 1) || '.' end));
end
$_$;


--
-- Name: fin_regras(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_regras() RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_lista  json;
  v_ncdom  int;
  v_nccat  int;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Financeiro e restrito ao dono.');
  end if;

  select count(*) filter (where dominio is null)::int,
         count(*) filter (where categoria_codigo is null)::int
    into v_ncdom, v_nccat
    from public.fin_movimento
   where tenant_id = v_tenant and arquivado_em is null;

  select coalesce(json_agg(x order by x.prioridade, x.aplicada_n desc, x.padrao), '[]'::json)
    into v_lista
  from (
    select r.id, r.padrao, r.tipo_match,
           r.categoria_codigo, c.rotulo as categoria_rotulo, c.grupo as categoria_grupo,
           r.dominio, r.prioridade, r.origem, r.ativo,
           r.aplicada_n, r.ultima_aplicacao, r.criado_em,
           (select count(*)::int
              from public.fin_movimento m
             where m.tenant_id = v_tenant
               and m.arquivado_em is null
               and ( (r.dominio is not null and m.dominio is null)
                  or (r.categoria_codigo is not null and m.categoria_codigo is null) )
               and privado.fn_fin_casa(
                     privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)),
                     r.padrao, r.tipo_match)) as casaria_hoje
      from public.fin_regra r
      left join public.fin_categoria c
        on c.tenant_id = r.tenant_id and c.codigo = r.categoria_codigo
     where r.tenant_id = v_tenant and r.arquivado_em is null
  ) x;

  return json_build_object(
    'ok', true,
    'regras', v_lista,
    'nao_classificados', v_ncdom,
    'sem_categoria', v_nccat);
end
$$;


--
-- Name: fin_repasse_desmarcar(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_repasse_desmarcar(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_par uuid; v_id uuid;
  v_n int; v_val numeric;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  begin
    v_par := nullif(btrim(coalesce(payload->>'repasse_id','')), '')::uuid;
    v_id  := nullif(btrim(coalesce(payload->>'id','')), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Informe o repasse a desfazer.');
  end;
  if v_par is null and v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe o repasse a desfazer.');
  end if;

  -- Pelo lado, chega-se ao par. O id do PAR e a chave estavel do vinculo; o id
  -- da linha e so o caminho ate ele.
  if v_par is null then
    select repasse_id into v_par
      from public.fin_movimento
     where id = v_id and tenant_id = v_tenant and arquivado_em is null;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Lancamento nao encontrado.');
    end if;
  end if;
  if v_par is null then
    return jsonb_build_object('ok', false, 'erro', 'Este lancamento nao esta em nenhum repasse.');
  end if;

  -- O valor declarado e o do lado que ENTROU, que e quanto de fato passou pela
  -- conta. E lido ANTES da limpeza, senao a mensagem sairia zerada.
  select coalesce(sum(valor) filter (where valor > 0), 0)
    into v_val
    from public.fin_movimento
   where repasse_id = v_par and tenant_id = v_tenant;

  update public.fin_movimento
     set repasse_id       = null,
         categoria_codigo = null,
         atualizado_em    = now()
   where repasse_id = v_par and tenant_id = v_tenant;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Este lancamento nao esta em nenhum repasse.');
  end if;

  -- As duas linhas voltam para a fila de julgamento, sem categoria e sem
  -- dominio: desfazer um par nao decide nada sobre o dinheiro, so desfaz.
  return jsonb_build_object('ok', true, 'n', v_n, 'valor', v_val,
    'msg', v_n || ' lancamento' || case when v_n = 1 then '' else 's' end
           || ' voltaram para a fila de julgamento.');
end
$$;


--
-- Name: fin_repasse_marcar(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_repasse_marcar(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_ent_id uuid; v_sai_id uuid;
  v_ent_val numeric; v_sai_val numeric;
  v_ent_rep uuid; v_sai_rep uuid;
  v_maior numeric; v_dif numeric; v_pct numeric;
  v_par uuid;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  begin
    v_ent_id := nullif(btrim(coalesce(payload->>'entrada_id','')), '')::uuid;
    v_sai_id := nullif(btrim(coalesce(payload->>'saida_id','')), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Informe a entrada e a saida do repasse.');
  end;
  if v_ent_id is null or v_sai_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe a entrada e a saida do repasse.');
  end if;
  if v_ent_id = v_sai_id then
    return jsonb_build_object('ok', false, 'erro', 'Entrada e saida sao o mesmo lancamento.');
  end if;

  select valor, repasse_id into v_ent_val, v_ent_rep
    from public.fin_movimento
   where id = v_ent_id and tenant_id = v_tenant and arquivado_em is null;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Lancamento nao encontrado.');
  end if;
  select valor, repasse_id into v_sai_val, v_sai_rep
    from public.fin_movimento
   where id = v_sai_id and tenant_id = v_tenant and arquivado_em is null;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Lancamento nao encontrado.');
  end if;

  -- O sinal define quem e quem. Aceitar invertido faria o par existir com a
  -- entrada no lugar da saida, e a declaracao na Visao contaria ao contrario.
  if v_ent_val <= 0 or v_sai_val >= 0 then
    return jsonb_build_object('ok', false, 'erro',
      'Entrada e saida invertidas: a entrada e o valor positivo e a saida e o negativo.');
  end if;

  if v_ent_rep is not null or v_sai_rep is not null then
    return jsonb_build_object('ok', false, 'erro', 'Lancamento ja faz parte de outro repasse.');
  end if;

  -- 5% do MAIOR valor, nao da media: com a media um par de 1000 contra 1100
  -- passaria, e a folga existe para tarifa e arredondamento, nao para casar o
  -- que nao e par.
  v_maior := greatest(abs(v_ent_val), abs(v_sai_val));
  v_dif   := abs(abs(v_ent_val) - abs(v_sai_val));
  v_pct   := case when v_maior > 0 then round(100 * v_dif / v_maior, 2) else 0 end;
  if v_pct > 5 then
    return jsonb_build_object('ok', false, 'erro',
      'Par desigual: a diferenca e de ' || to_char(v_pct, 'FM990D00') || '%, acima dos 5% permitidos.');
  end if;

  v_par := gen_random_uuid();
  update public.fin_movimento
     set repasse_id       = v_par,
         categoria_codigo = 'repasse',
         atualizado_em    = now()
   where id in (v_ent_id, v_sai_id) and tenant_id = v_tenant;

  -- `dominio` NAO e tocado, nem aqui nem em lugar nenhum desta migration:
  -- dinheiro de terceiro nao tem lado, e default silencioso e o Inv. 18.
  return jsonb_build_object('ok', true, 'repasse_id', v_par,
    'entrada_id', v_ent_id, 'saida_id', v_sai_id,
    'valor', abs(v_ent_val), 'diferenca_pct', v_pct);
end
$$;


--
-- Name: fn_auditar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_auditar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_tenant uuid;
  v_id text;
begin
  if tg_op = 'DELETE' then
    v_tenant := (to_jsonb(old) ->> 'tenant_id')::uuid;
    v_id := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'lead_id');
    insert into auditoria (tenant_id, tabela, registro_id, acao, antes, depois, usuario_id)
    values (v_tenant, tg_table_name, v_id, tg_op, to_jsonb(old), null, auth.uid());
    return old;
  elsif tg_op = 'UPDATE' then
    v_tenant := (to_jsonb(new) ->> 'tenant_id')::uuid;
    v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'lead_id');
    insert into auditoria (tenant_id, tabela, registro_id, acao, antes, depois, usuario_id)
    values (v_tenant, tg_table_name, v_id, tg_op, to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  else
    v_tenant := (to_jsonb(new) ->> 'tenant_id')::uuid;
    v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'lead_id');
    insert into auditoria (tenant_id, tabela, registro_id, acao, antes, depois, usuario_id)
    values (v_tenant, tg_table_name, v_id, tg_op, null, to_jsonb(new), auth.uid());
    return new;
  end if;
end;
$$;


--
-- Name: fn_conteudo_disparar_sync(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_conteudo_disparar_sync() RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_url text; v_key text; v_req bigint; v_falta text; v_msg text;
  v_b text; v_papel text; v_valida boolean := false; f record;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'edge_url_sincronizar_conteudo';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';

  if v_url is null or v_key is null then
    v_falta := case
      when v_url is null and v_key is null then 'edge_url_sincronizar_conteudo e service_role_key'
      when v_url is null then 'edge_url_sincronizar_conteudo'
      else 'service_role_key'
    end;
    v_msg := 'Sync automatico nao rodou: Vault sem ' || v_falta || '. Cadastrar o segredo no SQL editor.';
  else
    -- Duas formas validas: chave nova (sb_secret_...) ou JWT legado com
    -- claim role = service_role. Qualquer outra coisa e texto colado errado.
    if v_key like 'sb_secret_%' then
      v_valida := true;
    else
      begin
        v_b := replace(replace(split_part(v_key, '.', 2), '-', '+'), '_', '/');
        v_papel := (convert_from(decode(v_b || repeat('=', (4 - length(v_b) % 4) % 4), 'base64'), 'utf8')::jsonb ->> 'role');
        v_valida := (v_papel = 'service_role');
      exception when others then
        v_valida := false;
      end;
    end if;

    if not v_valida then
      v_msg := 'Sync automatico nao rodou: o valor salvo em service_role_key nao e uma chave de servico'
            || ' (esperado sb_secret_... ou JWT com role=service_role). Provavel texto colado errado.'
            || ' Trocar com vault.update_secret, nao create_secret.';
    end if;
  end if;

  if v_msg is not null then
    -- Falha VISIVEL. Nao pode ser 'raise exception': dentro da transacao do
    -- pg_cron o raise desfaria estes proprios registros.
    for f in select tenant_id from public.conteudo_fonte where ativo loop
      perform public.registrar_falha_sync(f.tenant_id, 'cron', v_msg, 0);
    end loop;
    raise warning 'fn_conteudo_disparar_sync: %', v_msg;
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object('origem', 'cron'),
    timeout_milliseconds := 30000) into v_req;
  return v_req;
end $$;


--
-- Name: fn_regua_varredura(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_regua_varredura() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'privado', 'pg_temp'
    AS $$
declare
  v_ini timestamptz := clock_timestamp();
  -- now() e constante na transacao e e o carimbo de todo evento que a
  -- varredura gera: serve de marca para separar o que foi feito nesta rodada.
  v_marca timestamptz := now();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r record; v_regra record; v_cfg record; v_prox record;
  v_base date; v_vence date; v_silencio integer; v_parado integer;
  v_dt_venda date; v_acao text;
  n_init integer := 0; n_avanco integer := 0; n_transicao integer := 0;
  n_esfriado integer := 0; n_encerrado integer := 0;
  n_abandono integer := 0; n_higiene integer := 0; n_atrasados integer := 0;
  v_res jsonb;
begin
  update public.cadencia_estado ce
     set encerrada = true, atualizado_em = now()
    from public.lead l
   where l.id = ce.lead_id and ce.encerrada = false
     and (l.arquivado_em is not null or l.status in ('lista_fria','cancelado'));
  get diagnostics n_higiene = row_count;

  for r in
    select l.id, l.tenant_id, l.perfil, l.proximo_contato
    from public.lead l
    left join public.cadencia_estado ce on ce.lead_id = l.id
    where ce.lead_id is null and l.arquivado_em is null and l.perfil is not null
      and l.status in ('pendente','feito','convertido')
  loop
    select * into v_regra from public.cadencia_regra
      where tenant_id = r.tenant_id and perfil = r.perfil and passo = 1 and ativo limit 1;
    continue when not found;

    if v_regra.ancora = 'data_combinada' then
      v_vence := coalesce(r.proximo_contato, v_hoje) + v_regra.dias_offset;
    elsif v_regra.ancora = 'data_venda' then
      select max(v.data_venda) into v_dt_venda from public.venda v
       where v.lead_id = r.id and v.tenant_id = r.tenant_id
         and v.status <> 'cancelada' and v.arquivado_em is null;
      v_vence := coalesce(v_dt_venda, v_hoje) + v_regra.dias_offset;
    else
      v_vence := coalesce(r.proximo_contato, v_hoje + v_regra.dias_offset);
    end if;

    insert into public.cadencia_estado (lead_id, tenant_id, perfil, passo_atual, passo_rotulo, passo_vence_em, encerrada)
      values (r.id, r.tenant_id, r.perfil, 1, v_regra.rotulo, v_vence, false);
    update public.lead set proximo_contato = v_vence where id = r.id;
    insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe)
      values (r.tenant_id, r.id, 'cadencia_iniciada', v_regra.rotulo || ' vence em ' || to_char(v_vence,'DD/MM/YYYY'));
    n_init := n_init + 1;
  end loop;

  for r in
    select ce.lead_id, ce.tenant_id, ce.perfil, ce.passo_atual, ce.passo_vence_em,
           l.ultimo_toque_em, l.proximo_contato
    from public.cadencia_estado ce
    join public.lead l on l.id = ce.lead_id
    join public.cadencia_perfil cp on cp.tenant_id = ce.tenant_id and cp.perfil = ce.perfil
    where ce.encerrada = false and l.arquivado_em is null
      and l.status in ('pendente','feito','convertido')
      and ce.passo_vence_em <= v_hoje
      and (cp.respondido_freia = false
           or l.respondido_em is null
           or (l.ultimo_toque_em is not null and l.ultimo_toque_em > l.respondido_em))
  loop
    if r.ultimo_toque_em is null
       or (r.ultimo_toque_em at time zone 'America/Sao_Paulo')::date < r.passo_vence_em then

      select * into v_cfg from public.cadencia_perfil
        where tenant_id = r.tenant_id and perfil = r.perfil limit 1;
      continue when not found;

      v_parado := v_hoje - r.passo_vence_em;

      if v_cfg.dias_ate_abandono is null or v_parado < v_cfg.dias_ate_abandono then
        n_atrasados := n_atrasados + 1;
        continue;
      end if;

      v_acao := privado.fn_regua_desfecho(r.lead_id, r.tenant_id, r.perfil, 'abandono', v_parado);
      if v_acao = 'transicao' then n_transicao := n_transicao + 1;
      elsif v_acao = 'abandono' then n_abandono := n_abandono + 1;
      elsif v_acao = 'encerrada' then n_encerrado := n_encerrado + 1;
      end if;
      continue;
    end if;

    select * into v_prox from public.cadencia_regra
      where tenant_id = r.tenant_id and perfil = r.perfil and passo = r.passo_atual + 1 and ativo limit 1;

    if found then
      if v_prox.ancora = 'data_combinada' then
        v_base := coalesce(r.proximo_contato, v_hoje);
      elsif v_prox.ancora = 'data_venda' then
        select max(v.data_venda) into v_dt_venda from public.venda v
         where v.lead_id = r.lead_id and v.tenant_id = r.tenant_id
           and v.status <> 'cancelada' and v.arquivado_em is null;
        v_base := coalesce(v_dt_venda, (r.ultimo_toque_em at time zone 'America/Sao_Paulo')::date);
      else
        v_base := (r.ultimo_toque_em at time zone 'America/Sao_Paulo')::date;
      end if;

      v_vence := greatest(v_base + v_prox.dias_offset, v_hoje);
      update public.cadencia_estado set passo_atual = v_prox.passo, passo_rotulo = v_prox.rotulo,
             passo_vence_em = v_vence, atualizado_em = now() where lead_id = r.lead_id;
      update public.lead set proximo_contato = v_vence,
             status = case when status = 'feito' then 'pendente' else status end where id = r.lead_id;
      insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe)
        values (r.tenant_id, r.lead_id, 'cadencia_avancou', v_prox.rotulo || ' vence em ' || to_char(v_vence,'DD/MM/YYYY'));
      n_avanco := n_avanco + 1;
      continue;
    end if;

    select * into v_cfg from public.cadencia_perfil
      where tenant_id = r.tenant_id and perfil = r.perfil limit 1;
    continue when not found;

    v_silencio := v_hoje - (r.ultimo_toque_em at time zone 'America/Sao_Paulo')::date;

    if v_cfg.limite_silencio_dias is null then
      update public.cadencia_estado set encerrada = true, atualizado_em = now() where lead_id = r.lead_id;
      insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe)
        values (r.tenant_id, r.lead_id, 'cadencia_encerrada', 'Cadencia de relacionamento concluida');
      n_encerrado := n_encerrado + 1;
      continue;
    end if;

    if v_silencio < v_cfg.limite_silencio_dias then continue; end if;

    v_acao := privado.fn_regua_desfecho(r.lead_id, r.tenant_id, r.perfil, 'silencio', v_silencio);
    if v_acao = 'transicao' then n_transicao := n_transicao + 1;
    elsif v_acao = 'esfriado' then n_esfriado := n_esfriado + 1;
    elsif v_acao = 'encerrada' then n_encerrado := n_encerrado + 1;
    end if;
  end loop;

  -- LOG POR TENANT: cada loja so enxerga os proprios numeros.
  insert into public.regua_execucao (tenant_id, duracao_ms, ok, resultado)
  select tn.id,
         (extract(epoch from (clock_timestamp() - v_ini)) * 1000)::int,
         true,
         jsonb_build_object(
           'ok', true, 'data', v_hoje,
           'iniciadas',   count(*) filter (where e.tipo = 'cadencia_iniciada'),
           'avancos',     count(*) filter (where e.tipo = 'cadencia_avancou'),
           'transicoes',  count(*) filter (where e.tipo = 'perfil_transicionado'),
           'esfriados',   count(*) filter (where e.tipo = 'esfriado_por_silencio'),
           'encerradas',  count(*) filter (where e.tipo = 'cadencia_encerrada'),
           'abandonados', count(*) filter (where e.tipo = 'abandonado_sem_toque'),
           'atrasados', (
             select count(*) from public.cadencia_estado ce2
              join public.lead l2 on l2.id = ce2.lead_id
             where ce2.tenant_id = tn.id and ce2.encerrada = false
               and l2.arquivado_em is null
               and l2.status in ('pendente','feito','convertido')
               and ce2.passo_vence_em <= v_hoje)
         )
    from public.tenant tn
    left join public.lead_evento e
      on e.tenant_id = tn.id and e.criado_em >= v_marca
     and e.tipo in ('cadencia_iniciada','cadencia_avancou','perfil_transicionado',
                    'esfriado_por_silencio','cadencia_encerrada','abandonado_sem_toque')
   group by tn.id;

  v_res := jsonb_build_object('ok', true, 'data', v_hoje, 'iniciadas', n_init,
    'avancos', n_avanco, 'transicoes', n_transicao, 'esfriados', n_esfriado,
    'encerradas', n_encerrado, 'abandonados', n_abandono, 'atrasados', n_atrasados,
    'higiene', n_higiene);

  return v_res;

exception when others then
  insert into public.regua_execucao (tenant_id, duracao_ms, ok, erro, resultado)
  select tn.id, (extract(epoch from (clock_timestamp() - v_ini)) * 1000)::int,
         false, sqlerrm, jsonb_build_object('ok', false, 'data', v_hoje)
    from public.tenant tn;
  return jsonb_build_object('ok', false, 'msg', sqlerrm);
end;
$$;


--
-- Name: fn_rotina_semear(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_rotina_semear() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_hoje   date     := (now() at time zone 'America/Sao_Paulo')::date;
  v_isodow smallint := extract(isodow from (now() at time zone 'America/Sao_Paulo')::date)::smallint;
  n_novas integer := 0; n_total integer := 0; n_users integer := 0;
  u record;
begin
  for u in select id, tenant_id from public.app_usuario where ativo loop
    insert into public.dia_tarefa
      (tenant_id, usuario_id, data, categoria, categoria_rotulo, titulo, origem, rotina_tarefa_id, ordem, criado_por)
    select rt.tenant_id, u.id, v_hoje, rt.categoria, rc.rotulo, rt.titulo, 'rotina', rt.id,
           rc.ordem * 1000 + rt.ordem, null
      from public.rotina_tarefa rt
      join public.rotina_categoria rc on rc.tenant_id = rt.tenant_id and rc.codigo = rt.categoria
     where rt.tenant_id = u.tenant_id and rt.ativa and rc.ativo
       and (rt.dias_semana is null or v_isodow = any(rt.dias_semana))
    on conflict (tenant_id, usuario_id, data, rotina_tarefa_id) do nothing;
    get diagnostics n_novas = row_count;
    n_total := n_total + n_novas;
    n_users := n_users + 1;
  end loop;
  return jsonb_build_object('ok', true, 'data', v_hoje, 'isodow', v_isodow,
                            'usuarios', n_users, 'novas', n_total);
end $$;


--
-- Name: fn_touch_atualizado_em(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_touch_atualizado_em() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;


--
-- Name: historico_lead(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.historico_lead(p_lead_id uuid) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_rows json;
begin
  select coalesce(json_agg(
           json_build_object(
             'tipo', tipo,
             'rotulo', rotulo,
             'detalhe', detalhe,
             'quando', quando,
             'autor', autor
           ) order by ord desc), '[]'::json)
    into v_rows
  from (
    select le.criado_em as ord,
           le.tipo,
           case le.tipo
             when 'cadastro' then 'Cadastro'
             when 'toque_enviado' then 'Toque enviado'
             when 'respondeu' then 'Respondeu'
             when 'conversando' then 'Conversando'
             when 'reagendado' then 'Reagendado'
             when 'fechou' then 'Fechou'
             when 'sem_interesse' then 'Sem interesse'
             when 'esfriado_por_silencio' then 'Esfriou por silencio'
             when 'consentimento' then 'Consentimento'
             when 'nota' then 'Nota'
             when 'lead_editado' then 'Lead editado'
             when 'arquivado' then 'Arquivado'
             when 'cadencia_iniciada' then 'Cadencia iniciada'
             when 'cadencia_avancou' then 'Cadencia avancou'
             when 'perfil_transicionado' then 'Perfil transicionado'
             when 'cadencia_encerrada' then 'Cadencia encerrada'
             else le.tipo::text
           end as rotulo,
           le.detalhe,
           to_char(le.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as quando,
           u.nome as autor
    from public.lead_evento le
    left join public.app_usuario u on u.id = le.criado_por
    where le.lead_id = p_lead_id
  ) s;

  return json_build_object('ok', true, 'eventos', v_rows);
end;
$$;


--
-- Name: marcar_lembrete(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marcar_lembrete(p_lembrete_id uuid, p_feito boolean) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
begin
  update public.dia_lembrete
     set feito_em = case when p_feito then now() else null end
   where id = p_lembrete_id and removida_em is null;
  if not found then
    return json_build_object('ok', false, 'msg', 'Lembrete nao encontrado.');
  end if;
  return json_build_object('ok', true, 'feito', p_feito);
end $$;


--
-- Name: marcar_tarefa(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marcar_tarefa(p_tarefa_id uuid, p_concluida boolean) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare v_dia date;
begin
  update public.dia_tarefa
     set concluida_em = case when p_concluida then now() else null end
   where id = p_tarefa_id and removida_em is null
  returning data into v_dia;
  if not found then
    return json_build_object('ok', false, 'msg', 'Tarefa nao encontrada.');
  end if;
  return json_build_object('ok', true, 'data', v_dia, 'concluida', p_concluida);
end $$;


--
-- Name: molde_semana(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.molde_semana(p_ref date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_tenant   uuid := privado.fn_tenant_atual();
  v_hoje     date;
  v_ini      date;
  v_fim      date;
  v_horas    integer;
  v_m        public.conteudo_molde%rowtype;
  v_dias     jsonb;
  v_idade    numeric;
  v_desc     text[];
  v_avisos   text[] := '{}';
  v_st_prev  integer;
  v_st_tem   integer;
  v_st_no_ar integer;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'msg', 'Sem tenant no contexto.');
  end if;

  -- Invariante 10: CURRENT_DATE e proibido onde se produz data de negocio.
  v_hoje := coalesce(p_ref, (now() at time zone 'America/Sao_Paulo')::date);
  v_ini  := date_trunc('week', v_hoje::timestamp)::date;  -- segunda
  v_fim  := v_ini + 6;

  -- Invariante 11: o limiar e config, nunca numero cravado no JS.
  select molde_stale_horas into v_horas
    from public.conteudo_fonte
   where tenant_id = v_tenant and codigo = 'calendario' and ativo
   limit 1;
  v_horas := coalesce(v_horas, 24);

  select * into v_m
    from public.conteudo_molde
   where tenant_id = v_tenant
   order by version desc
   limit 1;

  -- CACHE VAZIO. A tela NAO pode desenhar grade aqui: e exatamente o ponto
  -- onde um default embutido entraria, e default embutido foi a causa das
  -- grades conflitantes. "Nao sei" e resposta legitima.
  if v_m.tenant_id is null then
    return jsonb_build_object(
      'ok', true,
      'tem_molde', false,
      'semana_ini', v_ini,
      'semana_fim', v_fim,
      'msg', 'Nunca consegui ler o molde do Notion.');
  end if;

  -- Os dias saem pelo CODIGO, nunca pela ordem do array: ordem de array e
  -- acidente de edicao, codigo e chave (invariante 12).
  with mapa(dia, idx) as (
    values ('segunda',0),('terca',1),('quarta',2),('quinta',3),
           ('sexta',4),('sabado',5),('domingo',6)
  ),
  molde as (
    select m.dia,
           m.idx,
           (v_ini + m.idx)  as data,
           s.x->>'motor'    as motor,
           s.x->>'feed'     as feed_previsto,
           s.x->>'horario'  as horario,
           -- A PONTE molde -> calendario, num lugar so. O molde chama de `feed`
           -- a PECA do dia; o Calendario tem um TIPO chamado `feed`. Mesmo nome,
           -- coisas diferentes, nunca colapsar.
           case s.x->>'feed'
             when 'reel_topo' then 'reels'
             when 'reel'      then 'reels'
             when 'carrossel' then 'carrossel'
             else null
           end              as tipo_pedido
      from mapa m
      left join lateral (
        select x from jsonb_array_elements(v_m.payload->'semana') x
         where x->>'dia' = m.dia limit 1
      ) s on true
  ),
  -- Os cards que DISPUTAM a grade. `story` fica de fora de proposito: ele tem
  -- regua propria (os 7 slots do molde) e, entrando aqui, marcaria como fora do
  -- molde os 7 stories que o proprio molde manda existir.
  -- `descartado` tambem nao entra: card descartado nao e peca que existe.
  cards as (
    select c.data,
           c.tipo_codigo,
           bool_or(c.status_codigo = 'publicado') as no_ar
      from public.conteudo c
     where c.tenant_id   = v_tenant
       and c.sumiu_em is null
       and c.data between v_ini and v_fim
       and c.status_codigo <> 'descartado'
       and c.tipo_codigo in ('reels','carrossel','feed')
     group by c.data, c.tipo_codigo
  )
  select jsonb_agg(
           jsonb_build_object(
             'dia',           d.dia,
             'data',          d.data,
             'motor',         d.motor,
             'feed_previsto', d.feed_previsto,
             'horario',       d.horario,
             -- Planejamento e execucao sao DOIS canais, nunca somados: `existe`
             -- responde "a peca foi criada", `no_ar` responde "ela foi ao ar".
             'existe',        (p.data is not null),
             'no_ar',         coalesce(p.no_ar, false),
             'fora_do_molde', coalesce(f.tipos, array[]::text[])
           ) order by d.idx)
    into v_dias
    from molde d
    left join cards p
      on p.data = d.data
     and p.tipo_codigo = d.tipo_pedido
    left join lateral (
      select array_agg(x.tipo_codigo order by x.tipo_codigo) as tipos
        from cards x
       where x.data = d.data
         and (d.tipo_pedido is null or x.tipo_codigo <> d.tipo_pedido)
    ) f on true;

  -- Story tem regua propria: agregado da semana, nunca dia a dia (49 celulas
  -- seriam uma segunda grade). Os dois canais valem aqui tambem.
  v_st_prev := nullif(v_m.payload->'metas'->>'stories_semana', '')::integer;

  select count(*) filter (where c.status_codigo <> 'descartado'),
         count(*) filter (where c.status_codigo = 'publicado')
    into v_st_tem, v_st_no_ar
    from public.conteudo c
   where c.tenant_id = v_tenant
     and c.sumiu_em is null
     and c.data between v_ini and v_fim
     and c.tipo_codigo = 'story';

  -- Tipo desconhecido vira AVISO VISIVEL, nunca ausencia silenciosa: silencio
  -- aqui reproduziria o bug do titulo nulo com ok:true.
  select array_agg(distinct v)
    into v_desc
    from (select x->>'feed' as v from jsonb_array_elements(v_m.payload->'semana') x) t
   where v is not null and v not in ('reel_topo','reel','carrossel');

  if v_desc is not null then
    v_avisos := v_avisos || format(
      'Tipo de peca nao reconhecido no molde: %s. A ponte molde -> calendario conhece reel_topo, reel e carrossel.',
      array_to_string(v_desc, ', '));
  end if;

  v_idade := round(extract(epoch from (now() - v_m.lido_em)) / 3600.0, 1);

  return jsonb_build_object(
    'ok',            true,
    'tem_molde',     true,
    'version',       v_m.version,
    'vigente_desde', v_m.vigente_desde,
    'lido_em',       v_m.lido_em,
    'idade_horas',   v_idade,
    'stale_horas',   v_horas,
    'stale',         v_idade > v_horas,
    'semana_ini',    v_ini,
    'semana_fim',    v_fim,
    'dias',          coalesce(v_dias, '[]'::jsonb),
    'stories',       jsonb_build_object(
                       'previstos',  v_st_prev,
                       'existentes', coalesce(v_st_tem, 0),
                       'no_ar',      coalesce(v_st_no_ar, 0)),
    'metas',         coalesce(v_m.payload->'metas', '{}'::jsonb),
    -- Fatia 3. Vai como veio do Notion, sem interpretacao: nenhuma destas cinco
    -- e conferida contra o calendario, e o `tetos` em especial NAO TEM COMO ser
    -- conferido, porque nao existe codigo de humor em public.conteudo (so a
    -- palavra no titulo, que e rotulo e nao chave: invariante 12). A tela e
    -- obrigada a declarar isso; medir pelo titulo seria inventar um numero.
    'regras',        jsonb_strip_nulls(jsonb_build_object(
                       'story_slots', v_m.payload->'story_slots',
                       'tetos',       v_m.payload->'tetos',
                       'proibicoes',  v_m.payload->'proibicoes',
                       'garantia',    v_m.payload->'garantia',
                       'caixinha',    v_m.payload->'caixinha')),
    'avisos',        to_jsonb(v_avisos));
end
$$;


--
-- Name: mover_etapa_venda(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mover_etapa_venda(p_id uuid, p_etapa text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant   uuid := privado.fn_tenant_atual();
  v_venda    public.venda%rowtype;
  v_etapa    text := nullif(btrim(coalesce(p_etapa,'')), '');
  v_rot      text;
  v_promoveu boolean := false;
  v_campos   jsonb;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if v_etapa is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe a etapa.');
  end if;
  if v_etapa not in ('pendente','a_retirar','em_maos','a_caminho','entregue') then
    return jsonb_build_object('ok', false, 'erro', 'Etapa invalida: ' || v_etapa);
  end if;

  select * into v_venda from public.venda where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Venda nao encontrada.');
  end if;
  if v_venda.arquivado_em is not null then
    return jsonb_build_object('ok', false, 'erro', 'Venda arquivada: desarquive antes de mover.');
  end if;
  -- Venda cancelada nao anda no fluxo: ela nao esta em lugar nenhum, esta fora.
  if v_venda.status = 'cancelada' then
    return jsonb_build_object('ok', false, 'erro', 'Venda cancelada nao anda no fluxo.');
  end if;
  -- Toque repetido nao vira escrita: sem isso, dois toques no mesmo botao
  -- gerariam dois registros de auditoria identicos e zerariam o "ha X dias".
  if v_venda.etapa = v_etapa then
    return jsonb_build_object('ok', false, 'erro', 'A venda ja esta nesta etapa.');
  end if;

  v_campos := jsonb_build_object('etapa', v_etapa);

  -- Entregue FECHA a venda. `pre_venda` quer dizer "ainda vai acontecer", e
  -- depois de entregue isso deixou de ser verdade: venda entregue presa em
  -- Pre-venda seria a tela contradizendo a rua. NAO mexe no faturamento, porque
  -- pre_venda ja contava (mesmo criterio de painel_metricas e vgAgregar), e a
  -- promocao volta declarada na resposta em vez de acontecer calada.
  if v_etapa = 'entregue' and v_venda.status = 'pre_venda' then
    v_campos   := v_campos || jsonb_build_object('status', 'concluida');
    v_promoveu := true;
  end if;

  perform privado.fn_venda_atualizar(v_venda.id, v_campos);

  select rotulo into v_rot from public.dicionario_rotulos
   where dominio = 'etapa_venda' and codigo = v_etapa;

  return jsonb_build_object(
    'ok', true, 'id', v_venda.id, 'venda_code', v_venda.venda_code,
    'etapa', v_etapa, 'etapa_rotulo', coalesce(v_rot, v_etapa),
    'de', v_venda.etapa, 'status_promovido', v_promoveu,
    'msg', v_venda.venda_code || ' · ' || coalesce(v_rot, v_etapa)
           || case when v_promoveu then ' · situação passou a Concluída' else '' end);
exception
  when check_violation then
    return jsonb_build_object('ok', false, 'erro', 'Etapa recusada pelo banco.');
end
$$;


--
-- Name: mudar_status_acao_escopo(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mudar_status_acao_escopo(p_id uuid, p_status text, p_motivo text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_usuario uuid := auth.uid();
  v_motivo  text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_de text;
begin
  if v_tenant is null or v_usuario is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'Só o dono edita o escopo.');
  end if;
  if p_status not in ('a_fazer','fazendo','travado','feito') then
    return json_build_object('ok', false, 'msg', 'Status desconhecido.');
  end if;
  if p_status = 'travado' and v_motivo is null then
    return json_build_object('ok', false, 'msg', 'Diga o que está travando.');
  end if;

  select status into v_de from public.escopo_acao
   where id = p_id and tenant_id = v_tenant and not arquivada;
  if v_de is null then
    return json_build_object('ok', false, 'msg', 'Ação não encontrada.');
  end if;
  if v_de = p_status then
    return json_build_object('ok', true, 'msg', 'Já estava assim.');
  end if;

  update public.escopo_acao
     set status        = p_status,
         -- sair de travado limpa o motivo: motivo velho na tela mente
         motivo_trava  = case when p_status = 'travado' then v_motivo else null end,
         travado_desde = case when p_status = 'travado'
                              then (now() at time zone 'America/Sao_Paulo')::date else null end,
         atualizado_em = now()
   where id = p_id and tenant_id = v_tenant;

  -- O evento sai do trigger tg_escopo_acao_evento (Task 1b), nao daqui.
  return json_build_object('ok', true, 'msg', 'Pronto.');
end $$;


--
-- Name: painel_do_dia(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.painel_do_dia(p_data date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_dia     date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
  v_tenant  uuid := privado.fn_tenant_atual();
  v_usuario uuid := auth.uid();
  v_cats json; v_nota text; v_lemb json; v_cont json; v_sync json; v_regua json;
  v_feitas integer; v_total integer;
begin
  if v_tenant is null or v_usuario is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;

  select count(*) filter (where concluida_em is not null), count(*)
    into v_feitas, v_total
    from public.dia_tarefa
   where tenant_id = v_tenant and usuario_id = v_usuario and data = v_dia and removida_em is null;

  with cats as (
    select rc.codigo, rc.rotulo, rc.ordem, true as ativa
      from public.rotina_categoria rc
     where rc.tenant_id = v_tenant and rc.ativo
    union
    select distinct dt.categoria, dt.categoria_rotulo, 999999, false
      from public.dia_tarefa dt
     where dt.tenant_id = v_tenant and dt.usuario_id = v_usuario and dt.data = v_dia
       and dt.removida_em is null
       and not exists (select 1 from public.rotina_categoria rc2
                        where rc2.tenant_id = v_tenant and rc2.codigo = dt.categoria and rc2.ativo)
  )
  select coalesce(json_agg(json_build_object(
           'codigo', c.codigo, 'rotulo', c.rotulo, 'ativa', c.ativa,
           'tarefas', coalesce((
             select json_agg(json_build_object(
                      'id', dt.id, 'titulo', dt.titulo, 'origem', dt.origem,
                      'concluida', dt.concluida_em is not null)
                    order by dt.ordem, dt.criado_em)
               from public.dia_tarefa dt
              where dt.tenant_id = v_tenant and dt.usuario_id = v_usuario and dt.data = v_dia
                and dt.removida_em is null and dt.categoria = c.codigo
           ), '[]'::json)
         ) order by c.ordem, c.rotulo), '[]'::json)
    into v_cats from cats c;

  select texto into v_nota from public.dia_nota
   where tenant_id = v_tenant and usuario_id = v_usuario and data = v_dia;

  select coalesce(json_agg(json_build_object(
           'id', id, 'texto', texto, 'feito', feito_em is not null,
           'data', data,
           'vencido', (data < v_dia and feito_em is null),
           'agendado', (data = v_dia and (criado_em at time zone 'America/Sao_Paulo')::date < data)
         ) order by (data < v_dia) desc, data, criado_em), '[]'::json)
    into v_lemb from public.dia_lembrete
   where tenant_id = v_tenant and usuario_id = v_usuario and removida_em is null
     and (data = v_dia or (data < v_dia and feito_em is null));

  select coalesce(json_agg(json_build_object(
           'id', c.id, 'titulo', coalesce(c.titulo, '(sem titulo)'), 'data', c.data,
           'tipo_rotulo', c.tipo_rotulo, 'tipo_codigo', c.tipo_codigo,
           'status_rotulo', c.status_rotulo, 'status_codigo', c.status_codigo,
           'semana', c.semana, 'url', c.url,
           'metrica', case when m.medido_em is null then null else json_build_object(
              'alcance', m.alcance, 'conversas', m.conversas,
              'medido_em', m.medido_em,
              'medido_dias', ((now() at time zone 'America/Sao_Paulo')::date
                              - (m.medido_em at time zone 'America/Sao_Paulo')::date)
           ) end) order by c.tipo_rotulo nulls last, c.titulo), '[]'::json)
    into v_cont
    from public.conteudo c
    left join lateral (
      select mm.alcance, mm.conversas, mm.medido_em
        from public.conteudo_metrica mm
       where mm.tenant_id = c.tenant_id and mm.conteudo_id = c.id
       order by mm.medido_em desc, mm.criado_em desc
       limit 1) m on true
   where c.tenant_id = v_tenant and c.data = v_dia and c.sumiu_em is null;

  select json_build_object('ok', l.ok, 'quando', l.criado_em, 'msg', l.msg,
                           'horas', round(extract(epoch from (now() - l.criado_em)) / 3600.0)::int)
    into v_sync from public.conteudo_sync_log l
   where l.tenant_id = v_tenant order by l.id desc limit 1;

  -- estado da regua: sem isso, uma parada de semanas passa em branco de novo.
  select json_build_object(
           'ok', re.ok, 'quando', re.criado_em, 'erro', re.erro,
           'horas', round(extract(epoch from (now() - re.criado_em)) / 3600.0)::int,
           'atrasados', (re.resultado ->> 'atrasados')::int,
           'avancos',   (re.resultado ->> 'avancos')::int,
           'abandonados', (re.resultado ->> 'abandonados')::int,
           'transicoes', (re.resultado ->> 'transicoes')::int)
    into v_regua from public.regua_execucao re
   where re.tenant_id is null or re.tenant_id = v_tenant
   order by re.id desc limit 1;

  return json_build_object(
    'ok', true, 'data', v_dia, 'isodow', extract(isodow from v_dia),
    'contagem', json_build_object('feitas', coalesce(v_feitas, 0), 'total', coalesce(v_total, 0)),
    'categorias', v_cats, 'nota', coalesce(v_nota, ''), 'lembretes', v_lemb,
    'conteudo', v_cont, 'sync', coalesce(v_sync, json_build_object('ok', null)),
    'regua', coalesce(v_regua, json_build_object('ok', null))
  );
end
$$;


--
-- Name: painel_metricas(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.painel_metricas(p_ini date DEFAULT NULL::date, p_fim date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date; v_fim date;
  v_origem json; v_org_tot json; v_pecas json; v_tipos json; v_cont_tot json;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  v_fim := coalesce(p_fim, v_hoje);
  v_ini := coalesce(p_ini, v_fim - 89);
  if v_ini > v_fim then
    return json_build_object('ok', false, 'msg', 'Janela invertida.');
  end if;

  -- ---------- de onde veio ----------
  with base as (
    select coalesce(nullif(trim(l.origem), ''), 'sem_origem') as cod,
           (l.perfil = 'comprou') as cliente,
           coalesce(l.valor_total, 0) as hist,
           coalesce((select sum(v.valor_venda) from public.venda v
                      where v.lead_id = l.id and v.arquivado_em is null
                        and coalesce(v.status, '') = 'concluida'), 0) as vend
      from public.lead l
     where l.tenant_id = v_tenant
       and l.arquivado_em is null
       and coalesce(l.data_contato, (l.criado_em at time zone 'America/Sao_Paulo')::date)
           between v_ini and v_fim
  ), agg as (
    select cod,
           count(*)::int as leads,
           count(*) filter (where cliente)::int as clientes,
           sum(vend)::numeric as vend,
           sum(hist)::numeric as hist
      from base group by cod
  )
  select coalesce(json_agg(json_build_object(
           'codigo', a.cod,
           'rotulo', coalesce(d.rotulo, case when a.cod = 'sem_origem' then 'Sem origem' else a.cod end),
           'leads', a.leads,
           'clientes', a.clientes,
           'taxa', case when a.leads > 0 then round(100.0 * a.clientes / a.leads)::int else 0 end,
           'valor_venda', a.vend,
           'valor_historico', a.hist)
         order by a.vend desc, a.clientes desc, a.leads desc, a.cod), '[]'::json),
         json_build_object(
           'leads', coalesce(sum(a.leads), 0),
           'clientes', coalesce(sum(a.clientes), 0),
           'valor_venda', coalesce(sum(a.vend), 0),
           'valor_historico', coalesce(sum(a.hist), 0))
    into v_origem, v_org_tot
    from agg a
    left join public.dicionario_rotulos d
      on d.dominio = 'origem' and d.codigo = a.cod;

  -- ---------- o que rendeu ----------
  with pub as (
    select c.id, coalesce(c.titulo, '(sem titulo)') as titulo, c.data,
           c.tipo_codigo, c.tipo_rotulo, c.url,
           m.alcance, m.conversas, m.medido_em
      from public.conteudo c
      left join lateral (
        select mm.alcance, mm.conversas, mm.medido_em
          from public.conteudo_metrica mm
         where mm.tenant_id = c.tenant_id and mm.conteudo_id = c.id
         order by mm.medido_em desc, mm.criado_em desc
         limit 1) m on true
     where c.tenant_id = v_tenant and c.sumiu_em is null
       and c.status_codigo = 'publicado'
       and c.data between v_ini and v_fim
  )
  select coalesce(json_agg(json_build_object(
           'id', p.id, 'titulo', p.titulo, 'data', p.data,
           'tipo_codigo', p.tipo_codigo, 'tipo_rotulo', p.tipo_rotulo, 'url', p.url,
           'alcance', p.alcance, 'conversas', p.conversas,
           'medido_em', p.medido_em,
           'medido_dias', case when p.medido_em is null then null
                          else (v_hoje - (p.medido_em at time zone 'America/Sao_Paulo')::date) end)
         order by p.conversas desc nulls last, p.alcance desc nulls last, p.data desc), '[]'::json),
         json_build_object(
           'publicadas', count(*),
           'afericoes', count(*) filter (where p.medido_em is not null),
           'alcance', coalesce(sum(p.alcance), 0),
           'conversas', coalesce(sum(p.conversas), 0))
    into v_pecas, v_cont_tot
    from pub p;

  with pub as (
    select c.tipo_codigo, c.tipo_rotulo, m.alcance, m.conversas, m.medido_em
      from public.conteudo c
      left join lateral (
        select mm.alcance, mm.conversas, mm.medido_em
          from public.conteudo_metrica mm
         where mm.tenant_id = c.tenant_id and mm.conteudo_id = c.id
         order by mm.medido_em desc, mm.criado_em desc
         limit 1) m on true
     where c.tenant_id = v_tenant and c.sumiu_em is null
       and c.status_codigo = 'publicado'
       and c.data between v_ini and v_fim
  ), agg as (
    select coalesce(tipo_codigo, 'outro') as cod,
           coalesce(max(tipo_rotulo), 'Outro') as rot,
           count(*)::int as publicadas,
           count(*) filter (where medido_em is not null)::int as afericoes,
           coalesce(sum(alcance), 0)::bigint as alcance,
           coalesce(sum(conversas), 0)::bigint as conversas
      from pub group by 1
  )
  select coalesce(json_agg(json_build_object(
           'codigo', cod, 'rotulo', rot,
           'publicadas', publicadas, 'afericoes', afericoes,
           'alcance', alcance, 'conversas', conversas)
         order by conversas desc, alcance desc, publicadas desc), '[]'::json)
    into v_tipos
    from agg;

  return json_build_object(
    'ok', true, 'ini', v_ini, 'fim', v_fim, 'hoje', v_hoje,
    'origem', json_build_object('itens', v_origem, 'total', v_org_tot),
    'conteudo', json_build_object('pecas', v_pecas, 'por_tipo', v_tipos, 'total', v_cont_tot));
end
$$;


--
-- Name: placar_captacao(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.placar_captacao(p_data date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid; v_dia date;
  v_alvo int; v_feitas int; v_total int; v_leads int; v_pararam int;
  v_frentes json;
begin
  v_tenant := privado.fn_tenant_atual();
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Usuario sem tenant ativo');
  end if;

  v_dia := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);

  select alvo into v_alvo from public.captacao_meta
   where tenant_id = v_tenant and codigo = 'abordagens_dia' and ativo;

  select count(*) filter (where (criado_em at time zone 'America/Sao_Paulo')::date = v_dia),
         count(*),
         count(*) filter (where virou_lead_id is not null),
         count(*) filter (where opt_out_em is not null)
    into v_feitas, v_total, v_leads, v_pararam
  from public.captacao
  where tenant_id = v_tenant;

  select coalesce(json_agg(json_build_object(
           'frente', f.codigo, 'rotulo', f.rotulo, 'feitas', coalesce(x.n, 0)
         ) order by f.ordem), '[]'::json)
    into v_frentes
  from public.captacao_frente f
  left join (
    select frente, count(*) as n from public.captacao
     where tenant_id = v_tenant
       and (criado_em at time zone 'America/Sao_Paulo')::date = v_dia
     group by frente
  ) x on x.frente = f.codigo
  where f.tenant_id = v_tenant and f.ativo;

  return json_build_object(
    'ok', true,
    'dia', to_char(v_dia, 'DD/MM/YYYY'),
    'alvo', coalesce(v_alvo, 0),
    'feitas', v_feitas,
    'restantes', greatest(coalesce(v_alvo, 0) - v_feitas, 0),
    'total', v_total,
    'leads_gerados', v_leads,
    'pararam', v_pararam,
    'frentes', v_frentes
  );
end;
$$;


--
-- Name: puxar_rotina(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puxar_rotina(p_data date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_dia     date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
  v_tenant  uuid := privado.fn_tenant_atual();
  v_usuario uuid := auth.uid();
  v_isodow  smallint;
  n_novas   integer := 0;
begin
  if v_tenant is null or v_usuario is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  v_isodow := extract(isodow from v_dia)::smallint;

  insert into public.dia_tarefa
    (tenant_id, usuario_id, data, categoria, categoria_rotulo, titulo, origem, rotina_tarefa_id, ordem, criado_por)
  select rt.tenant_id, v_usuario, v_dia, rt.categoria, rc.rotulo, rt.titulo, 'rotina', rt.id,
         rc.ordem * 1000 + rt.ordem, v_usuario
    from public.rotina_tarefa rt
    join public.rotina_categoria rc on rc.tenant_id = rt.tenant_id and rc.codigo = rt.categoria
   where rt.tenant_id = v_tenant and rt.ativa and rc.ativo
     and (rt.dias_semana is null or v_isodow = any(rt.dias_semana))
  on conflict (tenant_id, usuario_id, data, rotina_tarefa_id) do nothing;

  get diagnostics n_novas = row_count;
  return json_build_object('ok', true, 'data', v_dia, 'novas', n_novas);
end $$;


--
-- Name: reagendar_proximo_contato(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reagendar_proximo_contato(p_lead_id uuid, p_data date) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare v_lead public.lead%rowtype;
begin
  if p_data is null then return json_build_object('ok', false, 'msg', 'Data invalida'); end if;

  update public.lead set proximo_contato = p_data, atualizado_em = now()
   where id = p_lead_id returning * into v_lead;
  if not found then
    return json_build_object('ok', false, 'msg', 'Lead nao encontrado ou sem permissao');
  end if;

  -- o RLS ja aprovou o lead acima; agora sincroniza a regua.
  perform privado.fn_cadencia_reagendar(v_lead.id, p_data);

  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
  values (v_lead.tenant_id, v_lead.id, 'reagendado',
          'Reagendado para ' || to_char(p_data, 'DD/MM/YYYY') || ' (app)', auth.uid());

  return json_build_object('ok', true, 'msg', 'Reagendado',
    'lead_id', v_lead.id, 'proximo_contato', v_lead.proximo_contato);
end; $$;


--
-- Name: registrar_captacao(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_captacao(p_frente text, p_identificador text, p_nome text DEFAULT NULL::text, p_observacoes text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid;
  v_ident text;
  v_existente record;
  v_row public.captacao%rowtype;
begin
  v_tenant := privado.fn_tenant_atual();
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Usuario sem tenant ativo');
  end if;

  v_ident := btrim(coalesce(p_identificador, ''));
  if v_ident = '' then
    return json_build_object('ok', false, 'msg', 'Identificador obrigatorio (ex: @perfil)');
  end if;

  if not exists (select 1 from public.captacao_frente
                  where tenant_id = v_tenant and codigo = p_frente and ativo) then
    return json_build_object('ok', false, 'msg', 'Frente invalida ou inativa');
  end if;

  -- dedup: nao abordar duas vezes a mesma pessoa na mesma frente
  select id, criado_em, opt_out_em into v_existente
    from public.captacao
   where tenant_id = v_tenant and frente = p_frente and identificador = v_ident
   limit 1;
  if found then
    if v_existente.opt_out_em is not null then
      return json_build_object('ok', false, 'msg',
        'Essa pessoa pediu para nao ser mais abordada. Nao insistir.');
    end if;
    return json_build_object('ok', false, 'duplicado', true, 'msg',
      'Voce ja abordou ' || v_ident || ' nessa frente em ' ||
      to_char(v_existente.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'));
  end if;

  insert into public.captacao (tenant_id, frente, identificador, nome, observacoes, criado_por)
  values (v_tenant, p_frente, v_ident,
          nullif(btrim(coalesce(p_nome, '')), ''),
          nullif(btrim(coalesce(p_observacoes, '')), ''),
          auth.uid())
  returning * into v_row;

  return json_build_object('ok', true, 'msg', 'Abordagem registrada', 'captacao_id', v_row.id);

exception
  when unique_violation then
    return json_build_object('ok', false, 'duplicado', true,
      'msg', 'Essa pessoa ja foi abordada nessa frente (corrida detectada)');
end;
$$;


--
-- Name: registrar_conversando(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_conversando(p_lead_id uuid) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_lead public.lead%rowtype;
begin
  update public.lead
     set etapa_cadencia = 'conversando',
         ultimo_toque_em = now(),
         atualizado_em = now()
   where id = p_lead_id
   returning * into v_lead;

  if not found then
    return json_build_object('ok', false, 'msg', 'Lead nao encontrado ou sem permissao');
  end if;

  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
  values (v_lead.tenant_id, v_lead.id, 'conversando', 'Conversando agora (app)', auth.uid());

  return json_build_object(
    'ok', true,
    'msg', 'Conversa registrada',
    'lead_id', v_lead.id,
    'etapa_cadencia', v_lead.etapa_cadencia,
    'ultimo_toque_em', v_lead.ultimo_toque_em
  );
end;
$$;


--
-- Name: registrar_desfecho(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_desfecho(p_lead_id uuid, p_tipo text) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_lead public.lead%rowtype;
  v_status text; v_evento text; v_detalhe text;
begin
  if p_tipo = 'convertido' then
    v_status := 'convertido'; v_evento := 'fechou'; v_detalhe := 'Fechou / Convertido (app)';
  elsif p_tipo = 'sem_interesse' then
    v_status := 'lista_fria'; v_evento := 'sem_interesse'; v_detalhe := 'Sem interesse (app)';
  else
    return json_build_object('ok', false, 'msg', 'Tipo de desfecho invalido: ' || coalesce(p_tipo, 'null'));
  end if;

  update public.lead set status = v_status, atualizado_em = now()
   where id = p_lead_id returning * into v_lead;
  if not found then
    return json_build_object('ok', false, 'msg', 'Lead nao encontrado ou sem permissao');
  end if;

  -- sem interesse fecha a cadencia. convertido NAO: quem comprou entra no
  -- pos-venda, e a promocao de perfil e feita por registrar_venda.
  if p_tipo = 'sem_interesse' then
    perform privado.fn_cadencia_encerrar(v_lead.id);
    update public.lead set proximo_contato = null where id = v_lead.id;
  end if;

  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
  values (v_lead.tenant_id, v_lead.id, v_evento, v_detalhe, auth.uid());

  return json_build_object('ok', true, 'msg', v_detalhe, 'lead_id', v_lead.id, 'status', v_lead.status);
end; $$;


--
-- Name: registrar_falha_molde(uuid, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_falha_molde(p_tenant_id uuid, p_origem text, p_msg text, p_duracao_ms integer DEFAULT NULL::integer) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public', 'pg_temp'
    AS $$
  insert into public.conteudo_sync_log (tenant_id, origem, escopo, ok, msg, duracao_ms)
  values (p_tenant_id, p_origem, 'molde', false, p_msg, p_duracao_ms);
$$;


--
-- Name: registrar_falha_sync(uuid, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_falha_sync(p_tenant_id uuid, p_origem text, p_msg text, p_duracao_ms integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  insert into public.conteudo_sync_log (tenant_id, origem, ok, msg, duracao_ms)
  values (p_tenant_id, coalesce(nullif(p_origem,''),'manual'), false, p_msg, p_duracao_ms);
  return json_build_object('ok', true);
end $$;


--
-- Name: registrar_metrica_conteudo(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_metrica_conteudo(p_conteudo_id uuid, p_alcance integer DEFAULT NULL::integer, p_conversas integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_data   date;
  v_titulo text;
  v_id     uuid;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if p_alcance is null and p_conversas is null then
    return json_build_object('ok', false, 'msg', 'Informe alcance ou conversas.');
  end if;
  if coalesce(p_alcance, 0) < 0 or coalesce(p_conversas, 0) < 0 then
    return json_build_object('ok', false, 'msg', 'Numero negativo nao entra.');
  end if;

  select c.data, coalesce(c.titulo, '(sem titulo)')
    into v_data, v_titulo
    from public.conteudo c
   where c.id = p_conteudo_id and c.tenant_id = v_tenant and c.sumiu_em is null;

  if v_data is null then
    return json_build_object('ok', false, 'msg', 'Peca nao encontrada no calendario.');
  end if;

  -- Peca com data no futuro nao foi ao ar: medir alcance dela seria inventar dado.
  if v_data > v_hoje then
    return json_build_object('ok', false,
      'msg', 'Peca marcada para ' || to_char(v_data, 'DD/MM') || ': ainda nao foi ao ar.');
  end if;

  insert into public.conteudo_metrica (tenant_id, conteudo_id, alcance, conversas, medido_por)
  values (v_tenant, p_conteudo_id, p_alcance, p_conversas, auth.uid())
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'titulo', v_titulo,
                           'alcance', p_alcance, 'conversas', p_conversas,
                           'idade_dias', (v_hoje - v_data));
end
$$;


--
-- Name: registrar_nota(uuid, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_nota(p_lead_id uuid, p_texto text, p_data date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_lead public.lead%rowtype;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_quando timestamptz;
begin
  if p_texto is null or length(btrim(p_texto)) = 0 then
    return json_build_object('ok', false, 'msg', 'Nota vazia');
  end if;

  select * into v_lead from public.lead where id = p_lead_id;
  if not found then
    return json_build_object('ok', false, 'msg', 'Lead nao encontrado ou sem permissao');
  end if;

  if p_data is null then
    v_quando := now();
  elsif p_data > v_hoje then
    return json_build_object('ok', false, 'msg', 'Data no futuro. Use Adiar/Retomar para agendar.');
  else
    v_quando := ((p_data::text || ' 12:00:00')::timestamp) at time zone 'America/Sao_Paulo';
  end if;

  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por, criado_em)
  values (v_lead.tenant_id, v_lead.id, 'nota', btrim(p_texto), auth.uid(), v_quando);

  return json_build_object('ok', true, 'msg', 'Nota registrada');
end;
$$;


--
-- Name: registrar_opt_out(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_opt_out(p_captacao_id uuid) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare v_row public.captacao%rowtype;
begin
  select * into v_row from public.captacao where id = p_captacao_id;
  if not found then
    return json_build_object('ok', false, 'msg', 'Captacao nao encontrada ou sem permissao');
  end if;
  if v_row.opt_out_em is not null then
    return json_build_object('ok', true, 'msg', 'Ja estava marcada como nao abordar');
  end if;

  update public.captacao
     set opt_out_em = now(), consentimento = false
   where id = p_captacao_id;

  return json_build_object('ok', true, 'msg', 'Marcada como nao abordar');
end;
$$;


--
-- Name: registrar_resposta(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_resposta(p_lead_id uuid) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_lead public.lead%rowtype;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  update public.lead
     set respondido_em  = now(),
         ultima_resposta = v_hoje,
         atualizado_em  = now()
   where id = p_lead_id and arquivado_em is null
   returning * into v_lead;

  if not found then
    return json_build_object('ok', false, 'msg', 'Lead nao encontrado, arquivado ou sem permissao');
  end if;

  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
  values (v_lead.tenant_id, v_lead.id, 'respondeu', 'Cliente respondeu (app)', auth.uid());

  return json_build_object('ok', true, 'msg', 'Resposta registrada',
    'lead_id', v_lead.id, 'respondido_em', v_lead.respondido_em);
end;
$$;


--
-- Name: registrar_toque(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_toque(p_lead_id uuid) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_lead public.lead%rowtype;
begin
  update public.lead
     set ultimo_toque_em = now(),
         atualizado_em = now()
   where id = p_lead_id
   returning * into v_lead;

  if not found then
    return json_build_object(
      'ok', false,
      'msg', 'Lead nao encontrado ou sem permissao'
    );
  end if;

  insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
  values (v_lead.tenant_id, v_lead.id, 'toque_enviado', 'Toque enviado (app)', auth.uid());

  return json_build_object(
    'ok', true,
    'msg', 'Toque registrado',
    'lead_id', v_lead.id,
    'ultimo_toque_em', v_lead.ultimo_toque_em
  );
end;
$$;


--
-- Name: registrar_venda(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_venda(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'privado'
    AS $_$
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
end $_$;


--
-- Name: FUNCTION registrar_venda(payload jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.registrar_venda(payload jsonb) IS 'Registra a venda E o cliente no mesmo ato. Sem cliente nao ha venda: vincula o lead escolhido, reaproveita quem ja tem o mesmo WhatsApp ou cria o cadastro. Venda nao cancelada promove o lead a perfil comprou.';


--
-- Name: remover_lembrete(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remover_lembrete(p_lembrete_id uuid) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
begin
  update public.dia_lembrete set removida_em = now()
   where id = p_lembrete_id and removida_em is null;
  if not found then
    return json_build_object('ok', false, 'msg', 'Lembrete nao encontrado.');
  end if;
  return json_build_object('ok', true);
end $$;


--
-- Name: remover_nf(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remover_nf(p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_ok     int;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida');
  end if;
  update public.venda_nf
     set removido_em = now(), removido_por = auth.uid()
   where id = p_id and tenant_id = v_tenant and removido_em is null;
  get diagnostics v_ok = row_count;
  if v_ok = 0 then
    return jsonb_build_object('ok', false, 'erro', 'NF nao encontrada');
  end if;
  return jsonb_build_object('ok', true);
end $$;


--
-- Name: remover_rotina_tarefa(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remover_rotina_tarefa(p_id uuid) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare v_tenant uuid := privado.fn_tenant_atual();
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'So o dono edita a rotina.');
  end if;
  update public.rotina_tarefa set ativa = false where id = p_id and tenant_id = v_tenant and ativa;
  if not found then
    return json_build_object('ok', false, 'msg', 'Tarefa da rotina nao encontrada.');
  end if;
  return json_build_object('ok', true);
end $$;


--
-- Name: remover_tarefa(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remover_tarefa(p_tarefa_id uuid) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare v_dia date;
begin
  update public.dia_tarefa set removida_em = now()
   where id = p_tarefa_id and removida_em is null
  returning data into v_dia;
  if not found then
    return json_build_object('ok', false, 'msg', 'Tarefa nao encontrada.');
  end if;
  return json_build_object('ok', true, 'data', v_dia);
end $$;


--
-- Name: rotina_completa(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rotina_completa() RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_cats json;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  select coalesce(json_agg(json_build_object(
           'codigo', rc.codigo, 'rotulo', rc.rotulo, 'ordem', rc.ordem,
           'tarefas', coalesce((
             select json_agg(json_build_object(
                      'id', rt.id, 'titulo', rt.titulo, 'dias_semana', rt.dias_semana, 'ordem', rt.ordem)
                    order by rt.ordem, rt.criado_em)
               from public.rotina_tarefa rt
              where rt.tenant_id = v_tenant and rt.categoria = rc.codigo and rt.ativa
           ), '[]'::json)
         ) order by rc.ordem, rc.rotulo), '[]'::json)
    into v_cats
    from public.rotina_categoria rc
   where rc.tenant_id = v_tenant and rc.ativo;
  return json_build_object('ok', true, 'categorias', v_cats,
                           'pode_editar', privado.fn_papel_atual() = 'dono');
end $$;


--
-- Name: salvar_identidade(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.salvar_identidade(p_lead_id uuid, payload jsonb) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $_$
declare
  v_lead public.lead%rowtype;
  v_cpf text; v_cep text; v_uf text; v_rg text;
  v_dono text;
  v_mudou text[] := array[]::text[];
  v_antes public.lead%rowtype;
  t text;
begin
  if privado.fn_tenant_atual() is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida');
  end if;

  select * into v_antes from public.lead where id = p_lead_id;
  if not found then
    return json_build_object('ok', false, 'msg', 'Cliente nao encontrado ou sem permissao');
  end if;

  -- CPF: guarda so digitos; recusa numero que nao fecha no digito verificador.
  -- Campo em branco APAGA o dado (o operador esta corrigindo um erro de digitacao).
  v_cpf := nullif(regexp_replace(coalesce(payload->>'cpf', ''), '\D', '', 'g'), '');
  if v_cpf is not null and not privado.fn_cpf_valido(v_cpf) then
    return json_build_object('ok', false, 'msg', 'CPF invalido: confira os numeros');
  end if;
  if v_cpf is not null then
    select nome || ' (' || lead_code || ')' into v_dono
      from public.lead
     where cpf = v_cpf and arquivado_em is null and id <> p_lead_id
     limit 1;
    if v_dono is not null then
      return json_build_object('ok', false, 'msg', 'Esse CPF ja esta em ' || v_dono);
    end if;
  end if;

  v_cep := nullif(regexp_replace(coalesce(payload->>'cep', ''), '\D', '', 'g'), '');
  if v_cep is not null and length(v_cep) <> 8 then
    return json_build_object('ok', false, 'msg', 'CEP precisa ter 8 digitos');
  end if;

  v_uf := nullif(upper(trim(coalesce(payload->>'uf', ''))), '');
  if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then
    return json_build_object('ok', false, 'msg', 'UF e a sigla de dois caracteres (ex.: RJ)');
  end if;

  v_rg := nullif(trim(coalesce(payload->>'rg', '')), '');

  update public.lead set
    cpf         = v_cpf,
    rg          = v_rg,
    cep         = v_cep,
    endereco    = nullif(trim(coalesce(payload->>'endereco', '')), ''),
    complemento = nullif(trim(coalesce(payload->>'complemento', '')), ''),
    bairro      = nullif(trim(coalesce(payload->>'bairro', '')), ''),
    cidade      = nullif(trim(coalesce(payload->>'cidade', '')), ''),
    uf          = v_uf,
    atualizado_em = now()
  where id = p_lead_id
  returning * into v_lead;

  -- O historico do cliente registra QUE mudou, nunca o numero do documento:
  -- o valor antes/depois ja fica na auditoria, que e a tabela protegida.
  if v_antes.cpf is distinct from v_lead.cpf then v_mudou := array_append(v_mudou, 'CPF'); end if;
  if v_antes.rg  is distinct from v_lead.rg  then v_mudou := array_append(v_mudou, 'RG');  end if;
  if v_antes.cep is distinct from v_lead.cep
     or v_antes.endereco is distinct from v_lead.endereco
     or v_antes.complemento is distinct from v_lead.complemento
     or v_antes.bairro is distinct from v_lead.bairro
     or v_antes.cidade is distinct from v_lead.cidade
     or v_antes.uf is distinct from v_lead.uf then v_mudou := array_append(v_mudou, 'endereco'); end if;

  if array_length(v_mudou, 1) > 0 then
    select string_agg(x, ', ') into t from unnest(v_mudou) as x;
    insert into public.lead_evento (tenant_id, lead_id, tipo, detalhe, criado_por)
    values (v_lead.tenant_id, v_lead.id, 'lead_editado', 'Dados do cliente: ' || t, auth.uid());
  end if;

  return json_build_object(
    'ok', true,
    'msg', case when array_length(v_mudou, 1) > 0 then 'Dados do cliente salvos' else 'Nada mudou' end,
    'lead_id', v_lead.id,
    'mudou', to_json(v_mudou)
  );
exception
  when unique_violation then
    return json_build_object('ok', false, 'msg', 'Esse CPF ja esta em outro cliente');
end $_$;


--
-- Name: FUNCTION salvar_identidade(p_lead_id uuid, payload jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.salvar_identidade(p_lead_id uuid, payload jsonb) IS 'Cadastro de identidade do cliente (CPF/RG/endereco) no lead. Valida digito verificador do CPF e recusa CPF ja usado por outro cliente ativo.';


--
-- Name: salvar_lembrete(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.salvar_lembrete(p_texto text, p_data date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_dia     date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
  v_tenant  uuid := privado.fn_tenant_atual();
  v_usuario uuid := auth.uid();
  v_id uuid;
begin
  if v_tenant is null or v_usuario is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if coalesce(btrim(p_texto), '') = '' then
    return json_build_object('ok', false, 'msg', 'Escreva o lembrete.');
  end if;
  insert into public.dia_lembrete (tenant_id, usuario_id, data, texto, criado_por)
  values (v_tenant, v_usuario, v_dia, btrim(p_texto), v_usuario)
  returning id into v_id;
  return json_build_object('ok', true, 'id', v_id, 'data', v_dia);
end $$;


--
-- Name: salvar_motoboy(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.salvar_motoboy(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $_$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_id   uuid := nullif(payload->>'id','')::uuid;
  v_nome text := nullif(btrim(coalesce(payload->>'nome','')), '');
  v_dig  text;
  v_obs  text := nullif(btrim(coalesce(payload->>'observacoes','')), '');
  v_ret  uuid;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if v_nome is null then
    return jsonb_build_object('ok', false, 'erro', 'O motoboy precisa de um nome.');
  end if;
  -- teto com RECUSA, nunca truncagem silenciosa: nome cortado sem aviso e pior
  -- que nome recusado.
  if length(v_nome) > 80 then
    return jsonb_build_object('ok', false, 'erro', 'Nome longo demais (limite 80).');
  end if;

  v_dig := nullif(regexp_replace(coalesce(payload->>'whatsapp',''), '\D', '', 'g'), '');
  if v_dig is not null and length(v_dig) in (10,11) then v_dig := '55' || v_dig; end if;
  if v_dig is not null and v_dig !~ '^[0-9]{10,15}$' then
    return jsonb_build_object('ok', false, 'erro', 'WhatsApp invalido: ' || v_dig);
  end if;
  -- sem telefone o motoboy existe, mas o botao de enviar nao teria destino.
  -- A tela avisa; o banco nao inventa numero.
  if v_id is null and v_dig is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe o WhatsApp: e por ele que o relatorio e enviado.');
  end if;

  if v_id is null then
    insert into public.motoboy (tenant_id, nome, whatsapp, observacoes, criado_por)
    values (v_tenant, v_nome, v_dig, v_obs, auth.uid())
    returning id into v_ret;
    return jsonb_build_object('ok', true, 'id', v_ret, 'msg', v_nome || ' entrou na lista.');
  end if;

  update public.motoboy set
    nome = v_nome, whatsapp = v_dig, observacoes = v_obs, atualizado_em = now()
  where id = v_id and tenant_id = v_tenant
  returning id into v_ret;
  if v_ret is null then
    return jsonb_build_object('ok', false, 'erro', 'Motoboy nao encontrado.');
  end if;
  return jsonb_build_object('ok', true, 'id', v_ret, 'msg', v_nome || ' atualizado.');
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'erro', 'Ja existe um motoboy ativo com esse WhatsApp.');
end
$_$;


--
-- Name: salvar_nota(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.salvar_nota(p_texto text, p_data date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_dia     date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
  v_tenant  uuid := privado.fn_tenant_atual();
  v_usuario uuid := auth.uid();
begin
  if v_tenant is null or v_usuario is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  insert into public.dia_nota (tenant_id, usuario_id, data, texto)
  values (v_tenant, v_usuario, v_dia, coalesce(p_texto, ''))
  on conflict (tenant_id, usuario_id, data) do update set texto = excluded.texto;
  return json_build_object('ok', true, 'data', v_dia);
end $$;


--
-- Name: salvar_pagamentos(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.salvar_pagamentos(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $_$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_venda   public.venda%rowtype;
  v_id      uuid := nullif(payload->>'venda_id','')::uuid;
  v_itens   jsonb := coalesce(payload->'itens', '[]'::jsonb);
  it        jsonb;
  v_forma   text;
  v_valor   numeric;
  v_parc    int;
  v_taxa    numeric;
  v_soma    numeric := 0;
  v_n       int := 0;
  v_formas  text[] := array[]::text[];
  v_derivada text;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe a venda.');
  end if;
  if jsonb_typeof(v_itens) <> 'array' then
    return jsonb_build_object('ok', false, 'erro', 'Lista de pagamentos invalida.');
  end if;

  -- RLS isola o tenant aqui: venda de outro tenant simplesmente nao e encontrada
  select * into v_venda from public.venda where id = v_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Venda nao encontrada.');
  end if;
  if v_venda.arquivado_em is not null then
    return jsonb_build_object('ok', false, 'erro', 'Venda arquivada: desarquive antes de mexer no pagamento.');
  end if;

  -- ---- 1. valida item a item ANTES de apagar o que existe ------------------
  for it in select * from jsonb_array_elements(v_itens) loop
    v_n := v_n + 1;
    v_forma := nullif(btrim(coalesce(it->>'forma','')), '');
    if v_forma is null or v_forma not in ('pix','dinheiro','cartao_credito','cartao_debito') then
      return jsonb_build_object('ok', false, 'erro',
        'Forma invalida na linha ' || v_n || ': ' || coalesce(v_forma,'(vazia)'));
    end if;

    begin
      v_valor := nullif(btrim(replace(coalesce(it->>'valor',''), ',', '.')), '')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'erro', 'Valor invalido na linha ' || v_n || '.');
    end;
    if v_valor is null or v_valor <= 0 then
      return jsonb_build_object('ok', false, 'erro', 'Informe o valor da linha ' || v_n || '.');
    end if;

    begin
      v_parc := coalesce(nullif(btrim(coalesce(it->>'parcelas','')), '')::int, 1);
    exception when others then
      return jsonb_build_object('ok', false, 'erro', 'Parcelas invalidas na linha ' || v_n || '.');
    end;
    if v_parc < 1 or v_parc > 24 then
      return jsonb_build_object('ok', false, 'erro', 'Parcelas fora de 1 a 24 na linha ' || v_n || '.');
    end if;
    if v_parc > 1 and v_forma <> 'cartao_credito' then
      return jsonb_build_object('ok', false, 'erro',
        'So cartao de credito parcela. Linha ' || v_n || ' esta com ' || v_parc || 'x.');
    end if;

    begin
      v_taxa := nullif(btrim(replace(coalesce(it->>'taxa',''), ',', '.')), '')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'erro', 'Taxa invalida na linha ' || v_n || '.');
    end;
    if v_taxa is not null and v_taxa < 0 then
      return jsonb_build_object('ok', false, 'erro', 'Taxa negativa na linha ' || v_n || '.');
    end if;

    v_soma := v_soma + v_valor;
    if not (v_forma = any(v_formas)) then v_formas := v_formas || v_forma; end if;
  end loop;

  -- ---- 2. A REGRA: o detalhe tem que fechar com a venda --------------------
  -- Sem isto o painel vira ficcao: daria para lancar R$ 200 numa venda de
  -- R$ 8.400 e a tela diria "detalhado".
  if v_n > 0 and round(v_soma, 2) <> round(v_venda.valor_venda, 2) then
    return jsonb_build_object('ok', false,
      'erro', 'A soma dos pagamentos (' || privado.fn_brl(v_soma) ||
              ') nao fecha com o valor da venda (' || privado.fn_brl(v_venda.valor_venda) || ').',
      'soma', v_soma, 'valor_venda', v_venda.valor_venda);
  end if;

  -- ---- 3. substitui o conjunto (escrita no ponto unico privado) ------------
  perform privado.fn_pagamentos_salvar(v_venda.id, v_venda.tenant_id, v_itens);

  -- ---- 4. venda.forma_pagamento vira DERIVADO do conjunto ------------------
  -- O campo velho nao morre: e o que o painel de metricas, o recorte da aba
  -- Vendas e o relatorio ja leem. Derivar aqui mantem UMA verdade sobre forma de
  -- pagamento. Conjunto vazio NAO limpa o campo: quem nunca detalhou continua
  -- com o que escolheu no formulario, em vez de perder a informacao calado.
  if v_n > 0 then
    if array_length(v_formas, 1) > 1 then
      if v_formas <@ array['cartao_credito','cartao_debito'] then
        v_derivada := 'cartao';
      else
        v_derivada := 'misto';
      end if;
    else
      v_derivada := case v_formas[1]
        when 'cartao_credito' then 'cartao'
        when 'cartao_debito'  then 'cartao'
        else v_formas[1] end;
    end if;
    perform privado.fn_venda_atualizar(v_venda.id, jsonb_build_object('forma_pagamento', v_derivada));
  end if;

  return jsonb_build_object('ok', true, 'venda_id', v_venda.id,
    'venda_code', v_venda.venda_code, 'n', v_n, 'soma', v_soma,
    'forma_pagamento', coalesce(v_derivada, v_venda.forma_pagamento),
    'msg', case when v_n = 0 then 'Detalhamento de pagamento limpo.'
                else v_n || (case when v_n = 1 then ' forma lancada' else ' formas lancadas' end)
                     || ' · ' || privado.fn_brl(v_soma) end);
exception
  when check_violation then
    return jsonb_build_object('ok', false, 'erro', 'Pagamento recusado pelo banco: confira forma, valor e parcelas.');
end
$_$;


--
-- Name: salvar_rotina_categoria(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.salvar_rotina_categoria(p_codigo text, p_rotulo text, p_ordem integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $_$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_id uuid;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'So o dono edita a rotina.');
  end if;
  if coalesce(btrim(p_rotulo), '') = '' then
    return json_build_object('ok', false, 'msg', 'Escreva o nome da categoria.');
  end if;
  if coalesce(p_codigo, '') !~ '^[a-z0-9_]+$' then
    return json_build_object('ok', false, 'msg', 'Codigo invalido: use so minusculas, numeros e _.');
  end if;

  insert into public.rotina_categoria (tenant_id, codigo, rotulo, ordem)
  values (v_tenant, p_codigo, btrim(p_rotulo),
          coalesce(p_ordem, (select coalesce(max(ordem), -1) + 1 from public.rotina_categoria where tenant_id = v_tenant)))
  on conflict (tenant_id, codigo) do update
    set rotulo = excluded.rotulo,
        ordem  = coalesce(p_ordem, public.rotina_categoria.ordem),
        ativo  = true
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'codigo', p_codigo);
end $_$;


--
-- Name: salvar_rotina_tarefa(text, text, smallint[], uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.salvar_rotina_tarefa(p_titulo text, p_categoria text, p_dias_semana smallint[] DEFAULT NULL::smallint[], p_id uuid DEFAULT NULL::uuid, p_ordem integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public', 'privado'
    AS $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_id uuid;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return json_build_object('ok', false, 'msg', 'So o dono edita a rotina.');
  end if;
  if coalesce(btrim(p_titulo), '') = '' then
    return json_build_object('ok', false, 'msg', 'Escreva a tarefa.');
  end if;
  if not exists (select 1 from public.rotina_categoria
                  where tenant_id = v_tenant and codigo = p_categoria and ativo) then
    return json_build_object('ok', false, 'msg', 'Categoria invalida.');
  end if;
  if p_dias_semana is not null and
     (not (p_dias_semana <@ array[1,2,3,4,5,6,7]::smallint[]) or array_length(p_dias_semana, 1) is null) then
    return json_build_object('ok', false, 'msg', 'Dias da semana invalidos: use 1 (segunda) a 7 (domingo).');
  end if;

  if p_id is null then
    insert into public.rotina_tarefa (tenant_id, categoria, titulo, dias_semana, ordem)
    values (v_tenant, p_categoria, btrim(p_titulo), p_dias_semana,
            coalesce(p_ordem, (select coalesce(max(ordem), -1) + 1 from public.rotina_tarefa
                                where tenant_id = v_tenant and categoria = p_categoria)))
    returning id into v_id;
  else
    update public.rotina_tarefa
       set categoria = p_categoria, titulo = btrim(p_titulo),
           dias_semana = p_dias_semana, ordem = coalesce(p_ordem, ordem), ativa = true
     where id = p_id and tenant_id = v_tenant
    returning id into v_id;
    if not found then
      return json_build_object('ok', false, 'msg', 'Tarefa da rotina nao encontrada.');
    end if;
  end if;

  return json_build_object('ok', true, 'id', v_id);
end $$;


--
-- Name: sincronizar_conteudo(uuid, text, jsonb, date, date, boolean, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sincronizar_conteudo(p_tenant_id uuid, p_fonte text, p_paginas jsonb, p_janela_ini date, p_janela_fim date, p_completo boolean, p_origem text DEFAULT 'manual'::text, p_duracao_ms integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  n_vistos int := 0; n_ins int := 0; n_upd int := 0; n_sumidos int := 0;
begin
  if p_origem not in ('cron','manual') then
    return json_build_object('ok', false, 'msg', 'Origem invalida.');
  end if;
  if not exists (select 1 from public.conteudo_fonte
                  where tenant_id = p_tenant_id and codigo = p_fonte and ativo) then
    return json_build_object('ok', false, 'msg', 'Fonte de conteudo inexistente ou inativa.');
  end if;

  drop table if exists _paginas;
  create temp table _paginas on commit drop as
  select (x->>'notion_page_id')::text as notion_page_id,
         nullif(x->>'titulo','')        as titulo,
         (x->>'data')::date             as data,
         nullif(x->>'tipo_rotulo','')   as tipo_rotulo,
         nullif(x->>'tipo_codigo','')   as tipo_codigo,
         nullif(x->>'status_rotulo','') as status_rotulo,
         nullif(x->>'status_codigo','') as status_codigo,
         nullif(x->>'semana','')        as semana,
         nullif(x->>'url','')           as url
    from jsonb_array_elements(coalesce(p_paginas, '[]'::jsonb)) x
   where (x->>'notion_page_id') is not null and (x->>'data') is not null;

  select count(*) into n_vistos from _paginas;

  with up as (
    insert into public.conteudo
      (tenant_id, fonte, notion_page_id, titulo, data, tipo_rotulo, tipo_codigo,
       status_rotulo, status_codigo, semana, url, sumiu_em, sincronizado_em)
    select p_tenant_id, p_fonte, p.notion_page_id, p.titulo, p.data, p.tipo_rotulo, p.tipo_codigo,
           p.status_rotulo, p.status_codigo, p.semana, p.url, null, now()
      from _paginas p
    on conflict (tenant_id, notion_page_id) do update set
      titulo = excluded.titulo, data = excluded.data,
      tipo_rotulo = excluded.tipo_rotulo, tipo_codigo = excluded.tipo_codigo,
      status_rotulo = excluded.status_rotulo, status_codigo = excluded.status_codigo,
      semana = excluded.semana, url = excluded.url,
      sumiu_em = null,
      sincronizado_em = now()
    returning (xmax = 0) as inserido
  )
  select count(*) filter (where inserido), count(*) filter (where not inserido)
    into n_ins, n_upd from up;

  -- SOFT DELETE. Duas travas, cada uma por um bug concreto:
  --  1) p_completo: fetch quebrado na pagina 2 entrega payload parcial.
  --     Marcar ausentes ai apagaria a tela. Token errado NUNCA chega aqui.
  --  2) escopo de janela: sem o BETWEEN, todo card fora da janela seria
  --     marcado como sumido a cada sync, ou seja, quase toda a base.
  if p_completo then
    update public.conteudo c set sumiu_em = now()
     where c.tenant_id = p_tenant_id and c.fonte = p_fonte
       and c.data between p_janela_ini and p_janela_fim
       and c.sumiu_em is null
       and not exists (select 1 from _paginas p where p.notion_page_id = c.notion_page_id);
    get diagnostics n_sumidos = row_count;
  end if;

  insert into public.conteudo_sync_log
    (tenant_id, origem, ok, msg, vistos, inseridos, atualizados, sumidos, duracao_ms)
  values (p_tenant_id, p_origem, true,
          case when p_completo then null else 'Sync parcial: soft delete nao rodou.' end,
          n_vistos, n_ins, n_upd, n_sumidos, p_duracao_ms);

  return json_build_object('ok', true, 'vistos', n_vistos, 'inseridos', n_ins,
                           'atualizados', n_upd, 'sumidos', n_sumidos, 'completo', p_completo);
end $$;


--
-- Name: sincronizar_molde(uuid, jsonb, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sincronizar_molde(p_tenant_id uuid, p_payload jsonb, p_block_id text DEFAULT NULL::text, p_origem text DEFAULT 'cron'::text, p_duracao_ms integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_version  integer;
  v_hash     text;
  v_max      integer;
  v_hash_ant text;
  v_acao     text;
  v_msg      text;
  v_avisos   text[] := '{}';
  v_dias     text[];
  v_ok       boolean;
  v_esperado text[] := array['segunda','terca','quarta','quinta','sexta','sabado','domingo'];
begin
  -- ---- Portao de validacao. Cada recusa mantem o cache anterior INTACTO. --
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    v_msg := 'Molde recusado: payload ausente ou nao e objeto JSON.';

  -- A chave e o campo `molde`, NUNCA o titulo da secao (invariante 12).
  elsif coalesce(p_payload->>'molde','') <> 'pitstop-grade-conteudo' then
    v_msg := 'Molde recusado: campo "molde" ausente ou diferente de pitstop-grade-conteudo.';

  elsif jsonb_typeof(p_payload->'version') <> 'number'
     or (p_payload->>'version')::numeric <> floor((p_payload->>'version')::numeric)
     or (p_payload->>'version')::integer <= 0 then
    v_msg := 'Molde recusado: "version" ausente, nao inteira ou nao positiva.';

  elsif coalesce(jsonb_typeof(p_payload->'semana'),'') <> 'array'
     or jsonb_array_length(p_payload->'semana') <> 7 then
    v_msg := 'Molde recusado: "semana" precisa de exatamente 7 dias.';

  elsif coalesce(jsonb_typeof(p_payload->'story_slots'),'') <> 'array'
     or jsonb_array_length(p_payload->'story_slots') = 0 then
    v_msg := 'Molde recusado: "story_slots" vazio ou ausente.';

  elsif coalesce(jsonb_typeof(p_payload->'metas'),'') <> 'object' then
    v_msg := 'Molde recusado: "metas" ausente.';
  end if;

  -- Os 7 dias tem que ser os 7 codigos conhecidos, sem faltar nem repetir.
  if v_msg is null then
    select array_agg(x->>'dia' order by ord) into v_dias
      from jsonb_array_elements(p_payload->'semana') with ordinality t(x, ord);
    if v_dias is null or not (v_dias @> v_esperado and v_esperado @> v_dias) then
      v_msg := 'Molde recusado: os 7 dias de "semana" nao batem com os codigos conhecidos. Veio: '
            || coalesce(array_to_string(v_dias, ', '), '(nada)');
    end if;
  end if;

  -- Retrocesso de version: alguem colou um bloco antigo por cima do novo.
  if v_msg is null then
    v_version := (p_payload->>'version')::integer;
    select max(version) into v_max from public.conteudo_molde where tenant_id = p_tenant_id;
    if v_max is not null and v_version < v_max then
      v_msg := format('Molde recusado: version %s e MENOR que a vigente (%s). Cache mantido.', v_version, v_max);
    end if;
  end if;

  if v_msg is not null then
    insert into public.conteudo_sync_log (tenant_id, origem, escopo, ok, msg, duracao_ms)
    values (p_tenant_id, p_origem, 'molde', false, v_msg, p_duracao_ms);
    return jsonb_build_object('ok', false, 'acao', 'recusado', 'msg', v_msg);
  end if;

  -- ---- Escrita ----------------------------------------------------------
  v_hash := md5(p_payload::text);
  select hash into v_hash_ant from public.conteudo_molde
   where tenant_id = p_tenant_id and version = v_version;

  if v_hash_ant is null then
    insert into public.conteudo_molde
      (tenant_id, version, payload, vigente_desde, hash, notion_block_id, lido_em)
    values
      (p_tenant_id, v_version, p_payload,
       nullif(p_payload->>'vigente_desde','')::date, v_hash, p_block_id, now());
    v_acao := 'inserido';

  elsif v_hash_ant = v_hash then
    -- Mesmo molde de novo: so a idade se renova. E isto que zera o staleness.
    update public.conteudo_molde
       set lido_em = now(), notion_block_id = coalesce(p_block_id, notion_block_id)
     where tenant_id = p_tenant_id and version = v_version;
    v_acao := 'inalterado';

  else
    -- A unica escrita que nao e append, e ela grita.
    update public.conteudo_molde
       set payload = p_payload,
           vigente_desde = nullif(p_payload->>'vigente_desde','')::date,
           hash = v_hash,
           notion_block_id = coalesce(p_block_id, notion_block_id),
           lido_em = now()
     where tenant_id = p_tenant_id and version = v_version;
    v_acao := 'atualizado';
    v_avisos := v_avisos || format(
      'O bloco da version %s mudou sem a version subir (hash %s -> %s). A propria pagina do Notion proibe: "Nao editar a mao sem subir a version".',
      v_version, left(v_hash_ant,8), left(v_hash,8));
  end if;

  v_ok := true;
  insert into public.conteudo_sync_log
    (tenant_id, origem, escopo, ok, msg, vistos, inseridos, atualizados, duracao_ms)
  values
    (p_tenant_id, p_origem, 'molde', v_ok,
     format('Molde v%s %s.%s', v_version, v_acao,
            case when array_length(v_avisos,1) is null then ''
                 else ' ' || array_to_string(v_avisos,' ') end),
     1,
     case when v_acao = 'inserido' then 1 else 0 end,
     case when v_acao = 'atualizado' then 1 else 0 end,
     p_duracao_ms);

  return jsonb_build_object(
    'ok', true, 'acao', v_acao, 'version', v_version,
    'hash', v_hash, 'avisos', to_jsonb(v_avisos));
end
$$;


--
-- Name: sugerir_mensagem(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sugerir_mensagem(p_lead_id uuid) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_lead    public.lead%rowtype;
  v_passo   integer;
  v_rotulo  text;
  v_origem  text;
  v_passo_efetivo integer;
  v_nome    text;
  v_produto text;
  v_cond    text;
  v_valor   text;
  v_data    text;
  v_opcoes  json;
  v_primeira json;
begin
  select * into v_lead
    from public.lead
   where id = p_lead_id
     and arquivado_em is null;

  if not found then
    return json_build_object('ok', false, 'msg', 'Lead nao encontrado, arquivado ou sem permissao');
  end if;

  if v_lead.perfil is null then
    return json_build_object('ok', false, 'msg', 'Lead sem perfil definido. Defina o perfil para receber sugestao.');
  end if;

  select passo_atual, passo_rotulo into v_passo, v_rotulo
    from public.cadencia_estado
   where lead_id = v_lead.id
     and encerrada = false;

  -- passo especifico; se nao houver script no passo, cai no fallback do perfil (passo 0)
  if exists (
      select 1 from public.dicionario_scripts
       where tenant_id = v_lead.tenant_id
         and perfil = v_lead.perfil
         and ativo = true
         and passo = coalesce(v_passo, -1)
  ) then
    v_origem := 'passo';
    v_passo_efetivo := v_passo;
  elsif exists (
      select 1 from public.dicionario_scripts
       where tenant_id = v_lead.tenant_id
         and perfil = v_lead.perfil
         and ativo = true
         and passo = 0
  ) then
    v_origem := 'fallback';
    v_passo_efetivo := 0;
  else
    return json_build_object(
      'ok', false,
      'msg', 'Sem script cadastrado para o perfil ' || v_lead.perfil,
      'perfil', v_lead.perfil,
      'passo', v_passo,
      'passo_rotulo', v_rotulo
    );
  end if;

  v_nome    := split_part(btrim(coalesce(v_lead.nome, '')), ' ', 1);
  v_produto := coalesce(nullif(btrim(v_lead.produto), ''), 'aparelho');
  v_cond    := coalesce(nullif(btrim(v_lead.condicao), ''), '');
  v_valor   := coalesce(to_char(v_lead.valor_oferta, 'FM999G999D00'), '');
  v_data    := coalesce(to_char(v_lead.proximo_contato, 'DD/MM'), 'a combinar');

  select json_agg(o order by o_variante), min(o_variante)::text
    into v_opcoes, v_primeira
    from (
      select s.variante as o_variante,
             json_build_object(
               'script_id', s.id,
               'variante', s.variante,
               'rotulo_variante', coalesce(s.rotulo_variante, 'Opcao ' || s.variante),
               'texto',
                 replace(replace(replace(replace(replace(
                   s.texto_template,
                   '{nome}', v_nome),
                   '{produto}', v_produto),
                   '{condicao}', v_cond),
                   '{valor_oferta}', v_valor),
                   '{data_combinada}', v_data)
             ) as o
        from public.dicionario_scripts s
       where s.tenant_id = v_lead.tenant_id
         and s.perfil = v_lead.perfil
         and s.passo = v_passo_efetivo
         and s.ativo = true
    ) t;

  return json_build_object(
    'ok', true,
    'lead_id', v_lead.id,
    'lead_code', v_lead.lead_code,
    'nome', v_lead.nome,
    'whatsapp', v_lead.whatsapp_digitos,
    'perfil', v_lead.perfil,
    'passo', v_passo,
    'passo_rotulo', v_rotulo,
    'origem_script', v_origem,
    'opcoes', v_opcoes,
    -- compatibilidade com o frontend ja publicado: texto e script_id da variante 1
    'script_id', (v_opcoes -> 0 ->> 'script_id'),
    'texto',     (v_opcoes -> 0 ->> 'texto')
  );
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_usuario (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    nome text NOT NULL,
    papel text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_usuario_papel_check CHECK ((papel = ANY (ARRAY['dono'::text, 'vendedor'::text])))
);


--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    id bigint NOT NULL,
    tenant_id uuid,
    tabela text NOT NULL,
    registro_id text NOT NULL,
    acao text NOT NULL,
    antes jsonb,
    depois jsonb,
    usuario_id uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auditoria_acao_check CHECK ((acao = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auditoria ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.auditoria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cadencia_estado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cadencia_estado (
    lead_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    perfil text NOT NULL,
    passo_atual integer DEFAULT 0 NOT NULL,
    passo_rotulo text,
    passo_vence_em date,
    encerrada boolean DEFAULT false NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cadencia_perfil; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cadencia_perfil (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    perfil text NOT NULL,
    limite_silencio_dias integer,
    permite_esfriar boolean DEFAULT true NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    perfil_seguinte text,
    respondido_freia boolean DEFAULT true NOT NULL,
    dias_ate_abandono integer,
    CONSTRAINT cadencia_perfil_abandono_positivo CHECK (((dias_ate_abandono IS NULL) OR (dias_ate_abandono > 0))),
    CONSTRAINT cadencia_perfil_limite_coerente CHECK (((permite_esfriar = false) OR (limite_silencio_dias IS NOT NULL))),
    CONSTRAINT cadencia_perfil_limite_silencio_dias_check CHECK ((limite_silencio_dias > 0)),
    CONSTRAINT cadencia_perfil_perfil_check CHECK ((perfil = ANY (ARRAY['compra_imediata'::text, 'avaliando'::text, 'em_espera'::text, 'repescagem'::text, 'comprou'::text, 'consulta'::text]))),
    CONSTRAINT cadencia_perfil_perfil_seguinte_check CHECK ((perfil_seguinte = ANY (ARRAY['compra_imediata'::text, 'avaliando'::text, 'em_espera'::text, 'repescagem'::text, 'comprou'::text, 'consulta'::text]))),
    CONSTRAINT cadencia_perfil_sem_autoloop CHECK (((perfil_seguinte IS NULL) OR (perfil_seguinte <> perfil)))
);


--
-- Name: COLUMN cadencia_perfil.dias_ate_abandono; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cadencia_perfil.dias_ate_abandono IS 'Dias que um passo vencido aguenta SEM TOQUE antes de a regua decidir sozinha (transicionar ou esfriar). NULL = nunca abandona.';


--
-- Name: cadencia_regra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cadencia_regra (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    perfil text NOT NULL,
    passo integer NOT NULL,
    rotulo text NOT NULL,
    dias_offset integer NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    ancora text DEFAULT 'toque_anterior'::text NOT NULL,
    CONSTRAINT cadencia_regra_ancora_check CHECK ((ancora = ANY (ARRAY['toque_anterior'::text, 'data_combinada'::text, 'data_venda'::text]))),
    CONSTRAINT cadencia_regra_offset_coerente CHECK (((ancora = 'data_combinada'::text) OR (dias_offset >= 0))),
    CONSTRAINT cadencia_regra_passo_check CHECK ((passo >= 1)),
    CONSTRAINT cadencia_regra_perfil_check CHECK ((perfil = ANY (ARRAY['compra_imediata'::text, 'avaliando'::text, 'em_espera'::text, 'repescagem'::text, 'comprou'::text, 'consulta'::text])))
);


--
-- Name: calc_dados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calc_dados (
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    dados jsonb NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: captacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.captacao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    frente text NOT NULL,
    identificador text NOT NULL,
    nome text,
    observacoes text,
    consentimento boolean DEFAULT true NOT NULL,
    opt_out_em timestamp with time zone,
    virou_lead_id uuid,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT captacao_identificador_nao_vazio CHECK ((length(btrim(identificador)) > 0))
);


--
-- Name: COLUMN captacao.identificador; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.captacao.identificador IS 'Quem foi abordado na frente (ex: @handle). Chave de dedup: nao abordar duas vezes a mesma pessoa na mesma frente.';


--
-- Name: COLUMN captacao.consentimento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.captacao.consentimento IS 'Nasce true por decisao consciente do dono em 16/07/2026 ("sim ate que se diga o contrario"), contra recomendacao. Ver handoff v28.';


--
-- Name: COLUMN captacao.opt_out_em; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.captacao.opt_out_em IS 'Quando a pessoa disse o contrario. Preenchido = nunca mais abordar.';


--
-- Name: COLUMN captacao.virou_lead_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.captacao.virou_lead_id IS 'Ligacao com lead, preenchida quando a pessoa responde e qualifica. Resultado observado, NUNCA a meta.';


--
-- Name: captacao_frente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.captacao_frente (
    tenant_id uuid NOT NULL,
    codigo text NOT NULL,
    rotulo text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE captacao_frente; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.captacao_frente IS 'Frentes de prospeccao. Config: entra e sai frente sem tocar em codigo.';


--
-- Name: captacao_meta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.captacao_meta (
    tenant_id uuid NOT NULL,
    codigo text NOT NULL,
    rotulo text NOT NULL,
    alvo integer NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    CONSTRAINT captacao_meta_alvo_check CHECK ((alvo > 0))
);


--
-- Name: TABLE captacao_meta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.captacao_meta IS 'Meta diaria. Mede ESFORCO (abordagem enviada), nunca resultado: o operador controla quantas abordagens faz, nao controla se o estranho responde.';


--
-- Name: catalogo_iphone; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_iphone (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    rotulo text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conteudo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conteudo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    fonte text NOT NULL,
    notion_page_id text NOT NULL,
    titulo text,
    data date NOT NULL,
    tipo_rotulo text,
    tipo_codigo text,
    status_rotulo text,
    status_codigo text,
    semana text,
    url text,
    sumiu_em timestamp with time zone,
    sincronizado_em timestamp with time zone DEFAULT now() NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE conteudo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.conteudo IS 'Cache do Calendario do Notion. NAO auditada, por decisao registrada no handoff v29: e fotocopia de sistema de terceiro, nao registro de decisao de ninguem (invariante 6), e o Notion ja versiona a propria pagina. Tem tenant_id + RLS, entao o invariante 7 esta cumprido de verdade. A contencao e ser SO-LEITURA para o app: so sincronizar_conteudo() escreve. Se um dia aparecer acao de operador aqui, reabrir esta decisao. conteudo_sync_log e a auditoria dela, na granularidade certa.';


--
-- Name: conteudo_fonte; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conteudo_fonte (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    codigo text NOT NULL,
    rotulo text NOT NULL,
    notion_db_id text NOT NULL,
    janela_atras_dias integer DEFAULT 7 NOT NULL,
    janela_frente_dias integer DEFAULT 28 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    notion_molde_page_id text,
    molde_stale_horas integer DEFAULT 24 NOT NULL,
    CONSTRAINT ck_conteudo_fonte_stale CHECK ((molde_stale_horas > 0)),
    CONSTRAINT conteudo_fonte_janela_ck CHECK (((janela_atras_dias >= 0) AND (janela_frente_dias >= 0) AND (((janela_atras_dias + janela_frente_dias) >= 1) AND ((janela_atras_dias + janela_frente_dias) <= 400))))
);


--
-- Name: COLUMN conteudo_fonte.notion_molde_page_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conteudo_fonte.notion_molde_page_id IS 'Pagina do Notion que carrega o bloco de codigo do molde. O bloco se acha pelo campo "molde" dentro do JSON, NUNCA pelo titulo da secao (invariante 12): o titulo ja mudou de v2 para v3 em 13/08/2026.';


--
-- Name: COLUMN conteudo_fonte.molde_stale_horas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conteudo_fonte.molde_stale_horas IS 'Limiar de staleness do molde, em horas. Config, nao JS (invariante 11). 24h porque o cron roda diario.';


--
-- Name: conteudo_metrica; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conteudo_metrica (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    conteudo_id uuid NOT NULL,
    alcance integer,
    conversas integer,
    medido_em timestamp with time zone DEFAULT now() NOT NULL,
    medido_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conteudo_metrica_alcance_ck CHECK (((alcance IS NULL) OR ((alcance >= 0) AND (alcance <= 100000000)))),
    CONSTRAINT conteudo_metrica_conversas_ck CHECK (((conversas IS NULL) OR ((conversas >= 0) AND (conversas <= 1000000)))),
    CONSTRAINT conteudo_metrica_vazia_ck CHECK (((alcance IS NOT NULL) OR (conversas IS NOT NULL)))
);


--
-- Name: TABLE conteudo_metrica; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.conteudo_metrica IS 'Afericao manual de peca publicada (alcance + conversas). Append-only: sem UPDATE e sem DELETE, correcao entra como nova linha e a mais recente vale. Nao mora em public.conteudo porque aquela tabela e cache so-leitura do Notion e a sync sobrescreveria.';


--
-- Name: COLUMN conteudo_metrica.alcance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conteudo_metrica.alcance IS 'Alcance/visualizacoes lidas no Instagram no momento da afericao.';


--
-- Name: COLUMN conteudo_metrica.conversas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conteudo_metrica.conversas IS 'Conversas/DMs que a peca gerou, contadas pelo operador.';


--
-- Name: COLUMN conteudo_metrica.medido_em; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conteudo_metrica.medido_em IS 'Quando o numero foi LIDO. Nao e a data da publicacao: reels medido em D+0 e D+7 sao numeros diferentes.';


--
-- Name: conteudo_molde; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conteudo_molde (
    tenant_id uuid NOT NULL,
    version integer NOT NULL,
    payload jsonb NOT NULL,
    vigente_desde date,
    hash text NOT NULL,
    notion_block_id text,
    lido_em timestamp with time zone DEFAULT now() NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_molde_marca CHECK (((payload ->> 'molde'::text) = 'pitstop-grade-conteudo'::text)),
    CONSTRAINT ck_molde_metas CHECK ((COALESCE(jsonb_typeof((payload -> 'metas'::text)), ''::text) = 'object'::text)),
    CONSTRAINT ck_molde_semana CHECK (((COALESCE(jsonb_typeof((payload -> 'semana'::text)), ''::text) = 'array'::text) AND (jsonb_array_length((payload -> 'semana'::text)) = 7))),
    CONSTRAINT ck_molde_slots CHECK (((COALESCE(jsonb_typeof((payload -> 'story_slots'::text)), ''::text) = 'array'::text) AND (jsonb_array_length((payload -> 'story_slots'::text)) > 0))),
    CONSTRAINT ck_molde_version CHECK ((version > 0))
);


--
-- Name: TABLE conteudo_molde; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.conteudo_molde IS 'A grade oficial de conteudo, lida do Notion. O app NUNCA declara grade: le daqui. Cache vazio renderiza estado vazio, nunca um default embutido, porque default embutido foi a causa das grades conflitantes. Append-only por version: trocar o molde revoga a cadencia da operacao inteira, e isso e decisao (invariante 6), nao fotocopia de sistema de terceiro como o cache do Calendario.';


--
-- Name: COLUMN conteudo_molde.hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conteudo_molde.hash IS 'md5 do payload canonico. Pega quem editou o bloco sem subir a version, que a propria pagina do Notion proibe.';


--
-- Name: COLUMN conteudo_molde.lido_em; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conteudo_molde.lido_em IS 'Ultima leitura BEM SUCEDIDA do Notion. Base do staleness: fetch que falha nao mexe aqui, entao a idade cresce e a tela declara.';


--
-- Name: conteudo_sync_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conteudo_sync_log (
    id bigint NOT NULL,
    tenant_id uuid NOT NULL,
    origem text NOT NULL,
    ok boolean NOT NULL,
    msg text,
    vistos integer DEFAULT 0 NOT NULL,
    inseridos integer DEFAULT 0 NOT NULL,
    atualizados integer DEFAULT 0 NOT NULL,
    sumidos integer DEFAULT 0 NOT NULL,
    duracao_ms integer,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    escopo text DEFAULT 'calendario'::text NOT NULL,
    CONSTRAINT ck_conteudo_sync_log_escopo CHECK ((escopo = ANY (ARRAY['calendario'::text, 'molde'::text]))),
    CONSTRAINT conteudo_sync_log_origem_ck CHECK ((origem = ANY (ARRAY['cron'::text, 'manual'::text])))
);


--
-- Name: COLUMN conteudo_sync_log.escopo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conteudo_sync_log.escopo IS 'calendario | molde. Os dois sincronizam na mesma execucao mas falham de forma independente: um nao pode derrubar o outro, e o log tem que provar qual foi.';


--
-- Name: conteudo_sync_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.conteudo_sync_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.conteudo_sync_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: dia_lembrete; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dia_lembrete (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    data date NOT NULL,
    texto text NOT NULL,
    feito_em timestamp with time zone,
    removida_em timestamp with time zone,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dia_lembrete_texto_ck CHECK ((btrim(texto) <> ''::text))
);


--
-- Name: dia_nota; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dia_nota (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    data date NOT NULL,
    texto text DEFAULT ''::text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dia_tarefa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dia_tarefa (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    data date NOT NULL,
    categoria text NOT NULL,
    categoria_rotulo text NOT NULL,
    titulo text NOT NULL,
    origem text NOT NULL,
    rotina_tarefa_id uuid,
    ordem integer DEFAULT 0 NOT NULL,
    concluida_em timestamp with time zone,
    removida_em timestamp with time zone,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dia_tarefa_origem_ck CHECK ((origem = ANY (ARRAY['rotina'::text, 'manual'::text]))),
    CONSTRAINT dia_tarefa_titulo_ck CHECK ((btrim(titulo) <> ''::text)),
    CONSTRAINT dia_tarefa_vinculo_ck CHECK ((((origem = 'rotina'::text) AND (rotina_tarefa_id IS NOT NULL)) OR ((origem = 'manual'::text) AND (rotina_tarefa_id IS NULL))))
);


--
-- Name: dicionario_rotulos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dicionario_rotulos (
    dominio text NOT NULL,
    codigo text NOT NULL,
    rotulo text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL
);


--
-- Name: dicionario_scripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dicionario_scripts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    perfil text NOT NULL,
    passo integer NOT NULL,
    rotulo_ref text,
    texto_template text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    variante smallint DEFAULT 1 NOT NULL,
    rotulo_variante text,
    CONSTRAINT dicionario_scripts_passo_check CHECK ((passo >= 0)),
    CONSTRAINT dicionario_scripts_perfil_check CHECK ((perfil = ANY (ARRAY['compra_imediata'::text, 'avaliando'::text, 'em_espera'::text, 'repescagem'::text, 'comprou'::text, 'consulta'::text]))),
    CONSTRAINT dicionario_scripts_texto_template_check CHECK ((length(btrim(texto_template)) > 0)),
    CONSTRAINT dicionario_scripts_variante_check CHECK (((variante >= 1) AND (variante <= 5)))
);


--
-- Name: TABLE dicionario_scripts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.dicionario_scripts IS 'Banco de scripts da Fase 3.5. Chave: perfil + passo. passo = 0 e o fallback generico do perfil, usado quando o passo especifico nao tem script.';


--
-- Name: COLUMN dicionario_scripts.passo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.dicionario_scripts.passo IS '0 = fallback generico do perfil. >=1 = script do passo correspondente em cadencia_regra.';


--
-- Name: COLUMN dicionario_scripts.rotulo_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.dicionario_scripts.rotulo_ref IS 'Apenas documentacao humana (ex R3 D14). A chave real e o passo.';


--
-- Name: escopo_acao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escopo_acao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    frente text NOT NULL,
    titulo text NOT NULL,
    status text DEFAULT 'a_fazer'::text NOT NULL,
    motivo_trava text,
    travado_desde date,
    data_alvo date,
    prioridade text,
    esforco text,
    ordem integer DEFAULT 0 NOT NULL,
    arquivada boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT escopo_acao_esforco_ck CHECK (((esforco IS NULL) OR (esforco = ANY (ARRAY['p'::text, 'm'::text, 'g'::text])))),
    CONSTRAINT escopo_acao_prioridade_ck CHECK (((prioridade IS NULL) OR (prioridade = ANY (ARRAY['alta'::text, 'media'::text, 'baixa'::text])))),
    CONSTRAINT escopo_acao_status_ck CHECK ((status = ANY (ARRAY['a_fazer'::text, 'fazendo'::text, 'travado'::text, 'feito'::text]))),
    CONSTRAINT escopo_acao_trava_ck CHECK (((status <> 'travado'::text) OR (motivo_trava IS NOT NULL)))
);


--
-- Name: COLUMN escopo_acao.data_alvo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.escopo_acao.data_alvo IS 'Existe no schema desde a Fatia 1 mas so ganha tela na Fatia 3, junto com prioridade e esforco.';


--
-- Name: COLUMN escopo_acao.arquivada; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.escopo_acao.arquivada IS 'DESCARTADA, nao "guardada". Acao criada errada ou que nao vale mais. Acao concluida nao se descarta: fica com status feito e continua contando o Avanco. Decisao do dono, 04/08/2026.';


--
-- Name: escopo_acao_evento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escopo_acao_evento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    acao_id uuid NOT NULL,
    de_status text,
    para_status text NOT NULL,
    em timestamp with time zone DEFAULT now() NOT NULL,
    por uuid
);


--
-- Name: TABLE escopo_acao_evento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.escopo_acao_evento IS 'Append-only. Nasce na Fatia 1 mesmo sem tela que a leia: a tendencia da Fatia 3 le daqui, e historico nao se constroi retroativamente. de_status nulo = criacao da acao.';


--
-- Name: escopo_frente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escopo_frente (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    codigo text NOT NULL,
    rotulo text NOT NULL,
    grupo text DEFAULT 'frente'::text NOT NULL,
    icone text DEFAULT 'alvo'::text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    meta text,
    CONSTRAINT escopo_frente_grupo_ck CHECK ((grupo = ANY (ARRAY['frente'::text, 'pendencia'::text]))),
    CONSTRAINT escopo_frente_meta_teto CHECK (((meta IS NULL) OR (char_length(meta) <= 200)))
);


--
-- Name: TABLE escopo_frente; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.escopo_frente IS 'Areas de trabalho permanentes da operacao. Config: entra e sai frente sem tocar em codigo. A linha grupo=pendencia e o backlog tecnico, renderizado separado no fim da aba. Frente que nao serve mais se DESLIGA (ativo=false), nunca se apaga.';


--
-- Name: escopo_frente_evento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escopo_frente_evento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    frente text NOT NULL,
    meta_antes text,
    meta_depois text,
    em timestamp with time zone DEFAULT now() NOT NULL,
    por uuid
);


--
-- Name: evento_uso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evento_uso (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    usuario_id uuid,
    tipo text NOT NULL,
    payload jsonb,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fin_categoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fin_categoria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT privado.fn_tenant_atual() NOT NULL,
    codigo text NOT NULL,
    rotulo text NOT NULL,
    grupo text NOT NULL,
    natureza_esperada text NOT NULL,
    dominio_sugerido text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone,
    atribuivel_manual boolean DEFAULT true NOT NULL,
    CONSTRAINT fin_categoria_dominio_sugerido_check CHECK ((dominio_sugerido = ANY (ARRAY['empresa'::text, 'pessoal'::text, 'ambos'::text]))),
    CONSTRAINT fin_categoria_natureza_esperada_check CHECK ((natureza_esperada = ANY (ARRAY['entrada'::text, 'saida'::text, 'neutro'::text])))
);


--
-- Name: TABLE fin_categoria; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fin_categoria IS 'Plano de contas. Config em tabela, nunca hardcoded em funcao (invariante 12): a chave e codigo, o rotulo e display editavel. grupo e a SECAO na tela. natureza_esperada = neutro (transferencia, aplicacao, resgate) fica FORA de todo total de gasto.';


--
-- Name: COLUMN fin_categoria.atribuivel_manual; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fin_categoria.atribuivel_manual IS 'false = a categoria so e atribuida pelo fluxo proprio dela (repasse exige par via fin_repasse_marcar), nunca escolhida a mao no seletor.';


--
-- Name: fin_conta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fin_conta (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT privado.fn_tenant_atual() NOT NULL,
    codigo text NOT NULL,
    rotulo text NOT NULL,
    banco text,
    tipo text NOT NULL,
    dominio_padrao text DEFAULT 'misto'::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone,
    CONSTRAINT fin_conta_dominio_padrao_check CHECK ((dominio_padrao = ANY (ARRAY['empresa'::text, 'pessoal'::text, 'misto'::text]))),
    CONSTRAINT fin_conta_tipo_check CHECK ((tipo = ANY (ARRAY['corrente'::text, 'poupanca'::text, 'dinheiro'::text, 'cartao'::text])))
);


--
-- Name: TABLE fin_conta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fin_conta IS 'Contas de onde o dinheiro entra e sai. Config: chave e o codigo (invariante 12), rotulo e editavel. dominio_padrao e so sugestao para a tela; NUNCA vira default de fin_movimento.dominio (invariante 18).';


--
-- Name: fin_importacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fin_importacao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT privado.fn_tenant_atual() NOT NULL,
    conta_id uuid NOT NULL,
    arquivo text,
    banco text,
    periodo_ini date,
    periodo_fim date,
    saldo_final_informado numeric(14,2),
    linhas_lidas integer DEFAULT 0 NOT NULL,
    linhas_novas integer DEFAULT 0 NOT NULL,
    linhas_duplicadas integer DEFAULT 0 NOT NULL,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    enviado_por uuid DEFAULT auth.uid()
);


--
-- Name: TABLE fin_importacao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fin_importacao IS 'Um envio de extrato OFX. arquivo e o ponteiro no bucket privado extrato. Append-only para authenticated (SELECT + INSERT); as contagens sao fechadas por privado.fn_fin_importacao_fechar, chamada so pela RPC.';


--
-- Name: fin_movimento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fin_movimento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT privado.fn_tenant_atual() NOT NULL,
    conta_id uuid NOT NULL,
    data date NOT NULL,
    descricao text NOT NULL,
    descricao_original text,
    valor numeric(14,2) NOT NULL,
    categoria_codigo text,
    dominio text,
    origem text NOT NULL,
    fitid text,
    hash_dedupe text NOT NULL,
    importacao_id uuid,
    venda_id uuid,
    observacao text,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone,
    arquivado_em timestamp with time zone,
    repasse_id uuid,
    contraparte text,
    CONSTRAINT fin_movimento_dominio_check CHECK ((dominio = ANY (ARRAY['empresa'::text, 'pessoal'::text]))),
    CONSTRAINT fin_movimento_origem_check CHECK ((origem = ANY (ARRAY['extrato'::text, 'manual'::text, 'venda'::text]))),
    CONSTRAINT fin_movimento_valor_check CHECK ((valor <> (0)::numeric))
);


--
-- Name: TABLE fin_movimento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fin_movimento IS 'CAIXA. Nunca se soma com venda, que e RESULTADO por competencia. valor carrega SINAL (negativo = saida); natureza (entrada/saida) e derivada na leitura, nunca coluna (invariante 4). dominio nasce NULL e nao tem default: movimento sem dominio nao entra em nenhum total (invariante 18). Remocao e soft delete por arquivado_em, nunca DELETE.';


--
-- Name: COLUMN fin_movimento.hash_dedupe; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fin_movimento.hash_dedupe IS 'md5(conta_id|data|valor|descricao_base|ocorrencia). A ocorrencia e o indice da linha dentro do grupo de linhas identicas do MESMO arquivo: sem ela, duas compras iguais no mesmo dia (dois Ubers de R$ 20) colidiriam e uma sumiria calada do caixa.';


--
-- Name: COLUMN fin_movimento.venda_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fin_movimento.venda_id IS 'Conciliacao caixa x resultado. A coluna nasce na Fatia 1 sem consumidor: a fatia de conciliacao le daqui, e vinculo nao se constroi retroativamente.';


--
-- Name: COLUMN fin_movimento.repasse_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fin_movimento.repasse_id IS 'Id do PAR de repasse. Os dois lados (entrada e saida) carregam o mesmo uuid. Null = nao e repasse.';


--
-- Name: COLUMN fin_movimento.contraparte; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fin_movimento.contraparte IS 'Nome da contraparte extraido da descricao por privado.fn_fin_contraparte. E NOME, nunca lado: nao diz empresa nem pessoal (Inv. 18). NULL quando a descricao nao carrega nome.';


--
-- Name: fin_regra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fin_regra (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT privado.fn_tenant_atual() NOT NULL,
    padrao text NOT NULL,
    tipo_match text DEFAULT 'contem'::text NOT NULL,
    categoria_codigo text,
    dominio text,
    prioridade integer DEFAULT 100 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    origem text DEFAULT 'aprendida'::text NOT NULL,
    aplicada_n integer DEFAULT 0 NOT NULL,
    ultima_aplicacao timestamp with time zone,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone,
    arquivado_em timestamp with time zone,
    CONSTRAINT fin_regra_classifica_algo CHECK (((categoria_codigo IS NOT NULL) OR (dominio IS NOT NULL))),
    CONSTRAINT fin_regra_dominio_check CHECK ((dominio = ANY (ARRAY['empresa'::text, 'pessoal'::text]))),
    CONSTRAINT fin_regra_origem_check CHECK ((origem = ANY (ARRAY['manual'::text, 'aprendida'::text]))),
    CONSTRAINT fin_regra_padrao_check CHECK ((btrim(padrao) <> ''::text)),
    CONSTRAINT fin_regra_tipo_match_check CHECK ((tipo_match = ANY (ARRAY['contem'::text, 'comeca'::text, 'exato'::text])))
);


--
-- Name: TABLE fin_regra; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fin_regra IS 'Regras de classificacao automatica de fin_movimento. Nasce VAZIA: quem decide que MUDAVENDING e alimentacao/pessoal e o dono, nunca o sistema (invariante 18). Menor prioridade ganha; desempate por padrao mais LONGO (mais especifico), depois criado_em mais recente. Remocao e soft delete por arquivado_em, nunca DELETE.';


--
-- Name: COLUMN fin_regra.padrao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fin_regra.padrao IS 'Texto a casar contra coalesce(descricao_original, descricao). Comparado NORMALIZADO (sem acento, maiusculo) e com os metacaracteres de LIKE escapados.';


--
-- Name: COLUMN fin_regra.origem; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fin_regra.origem IS 'aprendida = nasceu de fin_regra_sugerir a partir de um lancamento real; manual = o dono digitou o padrao.';


--
-- Name: COLUMN fin_regra.aplicada_n; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fin_regra.aplicada_n IS 'Quantos movimentos esta regra JA classificou de fato, acumulado. So sobe quando a aplicacao muda alguma coluna: rodar de novo sem efeito nao infla o contador.';


--
-- Name: lead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    lead_code text NOT NULL,
    dono_user_id uuid,
    nome text NOT NULL,
    whatsapp_digitos text,
    produto text,
    condicao text,
    perfil text,
    origem text,
    indicado_por text,
    status text DEFAULT 'pendente'::text NOT NULL,
    tipo_msg text,
    situacao text,
    observacoes text,
    data_contato date,
    proximo_contato date,
    ultima_resposta date,
    ultimo_toque_em timestamp with time zone,
    respondido_em timestamp with time zone,
    etapa_cadencia text,
    consentimento boolean DEFAULT true NOT NULL,
    consentimento_em timestamp with time zone,
    upgrade_entrada boolean,
    aparelho_entrada text,
    qtd_compras integer,
    valor_total numeric(12,2),
    valor_oferta numeric(12,2),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    data_nascimento date,
    arquivado_em timestamp with time zone,
    cpf text,
    rg text,
    cep text,
    endereco text,
    complemento text,
    bairro text,
    cidade text,
    uf text,
    trafego_ref text,
    trafego_campanha text,
    trafego_data_contato timestamp with time zone,
    CONSTRAINT lead_cep_check CHECK (((cep IS NULL) OR (cep ~ '^[0-9]{8}$'::text))),
    CONSTRAINT lead_condicao_check CHECK ((condicao = ANY (ARRAY['lacrado'::text, 'cpo'::text, 'vitrine'::text, 'seminovo'::text]))),
    CONSTRAINT lead_cpf_check CHECK (((cpf IS NULL) OR (cpf ~ '^[0-9]{11}$'::text))),
    CONSTRAINT lead_etapa_cadencia_check CHECK ((etapa_cadencia = ANY (ARRAY['conversando'::text, 'negociacao_parada'::text]))),
    CONSTRAINT lead_origem_check CHECK ((origem = ANY (ARRAY['indicacao'::text, 'instagram'::text, 'whatsapp_direto'::text, 'loja_fisica'::text, 'prospeccao_ativa'::text, 'parceria_influencer'::text, 'parceria_pag_local'::text, 'whatsapp_status'::text]))),
    CONSTRAINT lead_perfil_check CHECK ((perfil = ANY (ARRAY['compra_imediata'::text, 'avaliando'::text, 'em_espera'::text, 'repescagem'::text, 'comprou'::text, 'consulta'::text]))),
    CONSTRAINT lead_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'feito'::text, 'convertido'::text, 'lista_fria'::text, 'cancelado'::text]))),
    CONSTRAINT lead_uf_check CHECK (((uf IS NULL) OR (uf ~ '^[A-Z]{2}$'::text))),
    CONSTRAINT lead_whatsapp_digitos_check CHECK ((whatsapp_digitos ~ '^[0-9]{10,15}$'::text))
);


--
-- Name: COLUMN lead.cpf; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lead.cpf IS 'So digitos (11). Validado por privado.fn_cpf_valido no RPC salvar_identidade. Unico por tenant entre leads nao arquivados.';


--
-- Name: COLUMN lead.rg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lead.rg IS 'Texto livre: RG nao tem formato nem digito verificador padronizado entre os estados. So trim.';


--
-- Name: COLUMN lead.cep; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lead.cep IS 'So digitos (8).';


--
-- Name: COLUMN lead.endereco; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lead.endereco IS 'Logradouro + numero, como se escreve na NF. Complemento tem campo proprio.';


--
-- Name: COLUMN lead.uf; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lead.uf IS 'Duas letras maiusculas.';


--
-- Name: COLUMN lead.trafego_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lead.trafego_ref IS 'Identificador unico de campanha e criativo vindo do anuncio (parametro ref do CTWA). Formato: {campanha}-{criativo}-{versao}. Ex: mbair-lacrado-v1. NULL = lead nao veio de trafego pago.';


--
-- Name: COLUMN lead.trafego_campanha; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lead.trafego_campanha IS 'Nome legivel da campanha de origem. Preenchido a partir do trafego_ref.';


--
-- Name: COLUMN lead.trafego_data_contato; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lead.trafego_data_contato IS 'Momento do primeiro contato vindo do anuncio. Usado para janela de atribuicao.';


--
-- Name: lead_evento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_evento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    tipo text NOT NULL,
    detalhe text,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lead_evento_tipo_check CHECK ((tipo = ANY (ARRAY['cadastro'::text, 'toque_enviado'::text, 'respondeu'::text, 'conversando'::text, 'reagendado'::text, 'fechou'::text, 'sem_interesse'::text, 'esfriado_por_silencio'::text, 'consentimento'::text, 'nota'::text, 'lead_editado'::text, 'arquivado'::text, 'cadencia_iniciada'::text, 'cadencia_avancou'::text, 'perfil_transicionado'::text, 'cadencia_encerrada'::text, 'abandonado_sem_toque'::text])))
);


--
-- Name: motoboy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.motoboy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    nome text NOT NULL,
    whatsapp text,
    observacoes text,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    desligado_em timestamp with time zone,
    CONSTRAINT motoboy_nome_chk CHECK (((btrim(nome) <> ''::text) AND (length(nome) <= 80))),
    CONSTRAINT motoboy_whatsapp_chk CHECK (((whatsapp IS NULL) OR (whatsapp ~ '^[0-9]{10,15}$'::text)))
);


--
-- Name: regua_execucao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regua_execucao (
    id bigint NOT NULL,
    tenant_id uuid NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    duracao_ms integer,
    ok boolean DEFAULT true NOT NULL,
    erro text,
    resultado jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: regua_execucao_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.regua_execucao ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.regua_execucao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rotina_categoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rotina_categoria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    codigo text NOT NULL,
    rotulo text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rotina_categoria_codigo_ck CHECK ((codigo ~ '^[a-z0-9_]+$'::text)),
    CONSTRAINT rotina_categoria_rotulo_ck CHECK ((btrim(rotulo) <> ''::text))
);


--
-- Name: rotina_tarefa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rotina_tarefa (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    categoria text NOT NULL,
    titulo text NOT NULL,
    dias_semana smallint[],
    ordem integer DEFAULT 0 NOT NULL,
    ativa boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rotina_tarefa_dias_ck CHECK (((dias_semana IS NULL) OR ((dias_semana <@ ARRAY[(1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint, (7)::smallint]) AND (array_length(dias_semana, 1) > 0)))),
    CONSTRAINT rotina_tarefa_titulo_ck CHECK ((btrim(titulo) <> ''::text))
);


--
-- Name: tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_catalogo_venda; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_catalogo_venda WITH (security_invoker='on') AS
 SELECT DISTINCT (p.value ->> 'n'::text) AS nome,
    (p.value ->> 'c'::text) AS categoria
   FROM (public.calc_dados cd
     CROSS JOIN LATERAL jsonb_array_elements((cd.dados -> 'produtos'::text)) p(value))
  WHERE (COALESCE((p.value ->> 'n'::text), ''::text) <> ''::text);


--
-- Name: venda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venda (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    venda_code text,
    lead_id uuid NOT NULL,
    comprador_nome text,
    comprador_whatsapp text,
    comprador_cpf text,
    comprador_nascimento date,
    comprador_instagram text,
    modelo_id uuid,
    capacidade text,
    cor text,
    condicao text,
    imei text,
    fornecedor_nome text,
    fornecedor_contato text,
    fornecedor_local_retirada text,
    fornecedor_pix_url text,
    valor_venda numeric NOT NULL,
    custo_aparelho numeric,
    despesa_frete numeric,
    despesa_taxas numeric,
    tem_trade_in boolean DEFAULT false NOT NULL,
    entrada_modelo text,
    entrada_imei text,
    entrada_valor numeric,
    nf_numero text,
    nf_url text,
    status text DEFAULT 'concluida'::text NOT NULL,
    endereco_entrega text,
    valor_a_cobrar numeric,
    motoboy text,
    forma_pagamento text,
    data_venda date,
    observacoes text,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone,
    arquivado_em timestamp with time zone,
    modelo_texto text,
    motoboy_whatsapp text,
    etapa text DEFAULT 'pendente'::text NOT NULL,
    etapa_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT venda_condicao_check CHECK ((condicao = ANY (ARRAY['lacrado'::text, 'cpo'::text, 'vitrine'::text, 'seminovo'::text]))),
    CONSTRAINT venda_etapa_ck CHECK ((etapa = ANY (ARRAY['pendente'::text, 'a_retirar'::text, 'em_maos'::text, 'a_caminho'::text, 'entregue'::text]))),
    CONSTRAINT venda_forma_pagamento_check CHECK ((forma_pagamento = ANY (ARRAY['pix'::text, 'dinheiro'::text, 'cartao'::text, 'misto'::text]))),
    CONSTRAINT venda_motoboy_whatsapp_chk CHECK (((motoboy_whatsapp IS NULL) OR (motoboy_whatsapp ~ '^[0-9]{10,15}$'::text))),
    CONSTRAINT venda_status_check CHECK ((status = ANY (ARRAY['pre_venda'::text, 'concluida'::text, 'cancelada'::text])))
);


--
-- Name: COLUMN venda.lead_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.venda.lead_id IS 'Cliente da venda. OBRIGATORIO desde 27/07/2026: nao existe venda sem cliente. registrar_venda cria o cliente quando o comprador ainda nao esta na base.';


--
-- Name: COLUMN venda.nf_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.venda.nf_url IS 'LEGADO, sem uso desde 25/07/2026. O arquivo da NF vive em venda_nf + bucket nf. nf_numero segue valendo como o numero da nota da venda.';


--
-- Name: v_cliente; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cliente WITH (security_invoker='on') AS
 SELECT l.id,
    l.tenant_id,
    l.lead_code,
    l.nome,
    l.whatsapp_digitos,
    l.produto,
    l.condicao,
    l.perfil,
    l.origem,
    l.indicado_por,
    l.status,
    l.observacoes,
    l.consentimento,
    l.data_nascimento,
    l.aparelho_entrada,
    l.upgrade_entrada,
    l.valor_oferta,
    l.data_contato,
    l.ultima_resposta,
    l.criado_em,
    l.arquivado_em,
    l.cpf,
    l.rg,
    l.cep,
    l.endereco,
    l.complemento,
    l.bairro,
    l.cidade,
    l.uf,
    (l.cpf IS NOT NULL) AS tem_cpf,
    (l.endereco IS NOT NULL) AS tem_endereco,
    l.qtd_compras,
    l.valor_total,
    COALESCE(x.vendas, (0)::bigint) AS vendas_qtd,
    COALESCE(x.total, (0)::numeric) AS vendas_total,
    x.ultima AS ultima_venda,
    x.aparelhos AS vendas_aparelhos,
    l.situacao
   FROM (public.lead l
     LEFT JOIN LATERAL ( SELECT count(*) AS vendas,
            sum(v.valor_venda) AS total,
            max(v.data_venda) AS ultima,
            string_agg(COALESCE(c.rotulo, v.modelo_texto), ' · '::text ORDER BY v.data_venda DESC) AS aparelhos
           FROM (public.venda v
             LEFT JOIN public.catalogo_iphone c ON ((c.id = v.modelo_id)))
          WHERE ((v.lead_id = l.id) AND (v.tenant_id = l.tenant_id) AND (v.status <> 'cancelada'::text) AND (v.arquivado_em IS NULL))) x ON (true))
  WHERE ((l.perfil = 'comprou'::text) OR (x.vendas > 0));


--
-- Name: VIEW v_cliente; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_cliente IS 'Cliente = lead que comprou. Traz identidade (CPF/RG/endereco) e o lastro das vendas. vendas_* vem da tabela venda; qtd_compras/valor_total sao o agregado herdado do CRM, sem lastro, e nunca se somam aos primeiros.';


--
-- Name: v_conteudo_fonte; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_conteudo_fonte WITH (security_invoker='on') AS
 SELECT id,
    tenant_id,
    codigo,
    rotulo,
    notion_db_id,
    ativo,
    (((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date - janela_atras_dias) AS janela_ini,
    (((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date + janela_frente_dias) AS janela_fim,
    notion_molde_page_id,
    molde_stale_horas
   FROM public.conteudo_fonte cf
  WHERE ativo;


--
-- Name: v_lead; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_lead WITH (security_invoker='on') AS
 SELECT l.id,
    l.tenant_id,
    l.lead_code,
    l.dono_user_id,
    l.nome,
    l.whatsapp_digitos,
    l.produto,
    l.condicao,
    l.perfil,
    l.origem,
    l.indicado_por,
    l.status,
    l.tipo_msg,
    l.situacao,
    l.observacoes,
    l.data_contato,
    l.proximo_contato,
    l.ultima_resposta,
    l.ultimo_toque_em,
    l.respondido_em,
    l.etapa_cadencia,
    l.consentimento,
    l.consentimento_em,
    l.upgrade_entrada,
    l.aparelho_entrada,
    l.qtd_compras,
    l.valor_total,
    l.valor_oferta,
    l.criado_em,
    l.atualizado_em,
        CASE
            WHEN (l.ultimo_toque_em IS NULL) THEN NULL::integer
            WHEN ((l.respondido_em IS NOT NULL) AND (l.respondido_em >= l.ultimo_toque_em)) THEN NULL::integer
            ELSE (EXTRACT(day FROM (now() - l.ultimo_toque_em)))::integer
        END AS dias_silencio,
        CASE
            WHEN ((l.respondido_em IS NOT NULL) AND ((l.ultimo_toque_em IS NULL) OR (l.respondido_em >= l.ultimo_toque_em))) THEN 'quente'::text
            WHEN (l.ultimo_toque_em IS NULL) THEN 'sem_contato'::text
            WHEN ((EXTRACT(day FROM (now() - l.ultimo_toque_em)))::integer <= 2) THEN 'quente'::text
            WHEN ((EXTRACT(day FROM (now() - l.ultimo_toque_em)))::integer <= 6) THEN 'morno'::text
            ELSE 'frio'::text
        END AS nivel,
    l.data_nascimento,
    l.arquivado_em,
    ce.passo_atual AS cadencia_passo,
    ce.passo_rotulo AS cadencia_rotulo,
    ce.passo_vence_em AS cadencia_vence_em,
    COALESCE(ce.encerrada, false) AS cadencia_encerrada,
        CASE
            WHEN ((ce.lead_id IS NULL) OR ce.encerrada) THEN NULL::integer
            ELSE (ce.passo_vence_em - hj.hoje)
        END AS cadencia_dias_para,
    l.cpf,
    l.rg,
    l.cep,
    l.endereco,
    l.complemento,
    l.bairro,
    l.cidade,
    l.uf,
    t.primeiro_toque_em,
        CASE
            WHEN (t.primeiro_toque_em IS NULL) THEN NULL::numeric
            ELSE round((EXTRACT(epoch FROM (t.primeiro_toque_em - l.criado_em)) / 3600.0), 1)
        END AS horas_ate_1o_toque,
        CASE
            WHEN (t.primeiro_toque_em IS NOT NULL) THEN NULL::numeric
            ELSE round((EXTRACT(epoch FROM (now() - l.criado_em)) / 3600.0), 1)
        END AS horas_esperando_1o_toque,
        CASE
            WHEN ((l.arquivado_em IS NOT NULL) OR (l.status = ANY (ARRAY['lista_fria'::text, 'cancelado'::text]))) THEN 'ninguem'::text
            WHEN ((l.respondido_em IS NOT NULL) AND ((l.ultimo_toque_em IS NULL) OR (l.respondido_em >= l.ultimo_toque_em))) THEN 'voce'::text
            WHEN ((ce.lead_id IS NULL) OR ce.encerrada) THEN 'ninguem'::text
            WHEN (ce.passo_vence_em <= hj.hoje) THEN 'voce'::text
            ELSE 'cliente'::text
        END AS bola_com,
    COALESCE(ev.toques, 0) AS toques,
    COALESCE(ev.respostas, 0) AS respostas,
    COALESCE(ev.toques_sem_resposta, 0) AS toques_sem_resposta,
    vlr.valor_em_jogo,
    dup.lead_code AS duplicata_de,
    vd.veredito,
    mt.veredito_ordem,
    mt.veredito_motivo
   FROM (((((((((public.lead l
     CROSS JOIN LATERAL ( SELECT ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date AS hoje) hj)
     LEFT JOIN public.cadencia_estado ce ON (((ce.lead_id = l.id) AND (ce.tenant_id = l.tenant_id))))
     LEFT JOIN LATERAL ( SELECT min(e.criado_em) AS primeiro_toque_em
           FROM public.lead_evento e
          WHERE ((e.lead_id = l.id) AND (e.tipo = 'toque_enviado'::text))) t ON (true))
     LEFT JOIN LATERAL ( SELECT (count(*) FILTER (WHERE (e.tipo = 'toque_enviado'::text)))::integer AS toques,
            (count(*) FILTER (WHERE (e.tipo = 'respondeu'::text)))::integer AS respostas,
            (count(*) FILTER (WHERE ((e.tipo = 'toque_enviado'::text) AND (e.criado_em > COALESCE(( SELECT max(e2.criado_em) AS max
                   FROM public.lead_evento e2
                  WHERE ((e2.lead_id = l.id) AND (e2.tipo = 'respondeu'::text))), '-infinity'::timestamp with time zone)))))::integer AS toques_sem_resposta
           FROM public.lead_evento e
          WHERE (e.lead_id = l.id)) ev ON (true))
     LEFT JOIN LATERAL ( SELECT COALESCE(NULLIF(l.valor_oferta, (0)::numeric), ( SELECT sum(v.valor_venda) AS sum
                   FROM public.venda v
                  WHERE ((v.lead_id = l.id) AND (v.arquivado_em IS NULL) AND (v.status = 'concluida'::text))), (0)::numeric) AS valor_em_jogo) vlr ON (true))
     LEFT JOIN LATERAL ( SELECT d.lead_code
           FROM public.lead d
          WHERE ((d.tenant_id = l.tenant_id) AND (d.id <> l.id) AND (d.arquivado_em IS NULL) AND (d.perfil = 'comprou'::text) AND (l.perfil IS DISTINCT FROM 'comprou'::text) AND (NULLIF("right"(regexp_replace(COALESCE(d.whatsapp_digitos, ''::text), '\D'::text, ''::text, 'g'::text), 11), ''::text) = NULLIF("right"(regexp_replace(COALESCE(l.whatsapp_digitos, ''::text), '\D'::text, ''::text, 'g'::text), 11), ''::text)))
          ORDER BY d.criado_em
         LIMIT 1) dup ON (true))
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN (t.primeiro_toque_em IS NULL) THEN NULL::integer
                    ELSE (hj.hoje - (t.primeiro_toque_em)::date)
                END AS dias_de_tentativa) tt ON (true))
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN ((l.arquivado_em IS NOT NULL) OR (l.status = ANY (ARRAY['lista_fria'::text, 'cancelado'::text]))) THEN 'fora'::text
                    WHEN ((ce.lead_id IS NULL) OR COALESCE(ce.encerrada, false)) THEN 'fora'::text
                    WHEN (dup.lead_code IS NOT NULL) THEN 'nao_mande'::text
                    WHEN (l.consentimento IS NOT TRUE) THEN 'nao_mande'::text
                    WHEN ((COALESCE(ev.respostas, 0) = 0) AND ((COALESCE(ev.toques_sem_resposta, 0) >= 4) OR ((COALESCE(ev.toques_sem_resposta, 0) >= 3) AND (COALESCE(tt.dias_de_tentativa, 0) >= 30)))) THEN 'pare'::text
                    WHEN (ce.passo_vence_em > hj.hoje) THEN 'espere'::text
                    WHEN ((COALESCE(ev.respostas, 0) > 0) AND (COALESCE(ev.toques_sem_resposta, 0) <= 2)) THEN 'prioridade'::text
                    WHEN (l.perfil = 'comprou'::text) THEN 'agora'::text
                    WHEN (COALESCE(ev.toques, 0) = 0) THEN 'agora'::text
                    ELSE 'mande'::text
                END AS veredito) vd ON (true))
     LEFT JOIN LATERAL ( SELECT
                CASE vd.veredito
                    WHEN 'prioridade'::text THEN 1
                    WHEN 'agora'::text THEN 2
                    WHEN 'mande'::text THEN 3
                    WHEN 'espere'::text THEN 4
                    WHEN 'pare'::text THEN 5
                    WHEN 'nao_mande'::text THEN 6
                    ELSE 9
                END AS veredito_ordem,
                CASE
                    WHEN (vd.veredito = 'fora'::text) THEN NULL::text
                    WHEN ((vd.veredito = 'nao_mande'::text) AND (dup.lead_code IS NOT NULL)) THEN (('Mesmo numero do '::text || dup.lead_code) || ', que ja e cliente. Mesclar os cadastros antes de tocar.'::text)
                    WHEN (vd.veredito = 'nao_mande'::text) THEN 'Sem consentimento registrado. A LGPD trava o envio.'::text
                    WHEN (vd.veredito = 'pare'::text) THEN ((((COALESCE(ev.toques_sem_resposta, 0) || ' toques sem uma unica resposta em '::text) || COALESCE(tt.dias_de_tentativa, 0)) || 'd de tentativa. '::text) || 'Sai do calendario: so volta por evento de produto ou preco.'::text)
                    WHEN (vd.veredito = 'prioridade'::text) THEN (((('Ja respondeu '::text || COALESCE(ev.respostas, 0)) || 'x'::text) ||
                    CASE
                        WHEN (l.ultimo_toque_em IS NULL) THEN ''::text
                        ELSE ((' e voltou ao silencio ha '::text || (hj.hoje - (l.ultimo_toque_em)::date)) || 'd'::text)
                    END) || '. Melhor aposta da fila.'::text)
                    WHEN ((vd.veredito = 'agora'::text) AND (l.perfil = 'comprou'::text)) THEN (((('Pos-venda '::text || COALESCE(ce.passo_rotulo, 'vencido'::text)) || ' atrasado ha '::text) || (hj.hoje - ce.passo_vence_em)) || 'd. Cliente entregue e nunca tocado.'::text)
                    WHEN (vd.veredito = 'agora'::text) THEN (('Nunca tocado. Esperando ha '::text || (hj.hoje - l.data_contato)) || 'd desde a entrada. Cada dia parado custa conversao.'::text)
                    WHEN (vd.veredito = 'mande'::text) THEN ((((COALESCE(ce.passo_rotulo, 'Passo'::text) || ' vencido ha '::text) || (hj.hoje - ce.passo_vence_em)) || 'd. '::text) ||
                    CASE
                        WHEN (COALESCE(ev.toques_sem_resposta, 0) = 0) THEN 'Nenhum toque neste passo.'::text
                        ELSE (COALESCE(ev.toques_sem_resposta, 0) || ' toque(s) sem resposta: troque o angulo.'::text)
                    END)
                    WHEN ((vd.veredito = 'espere'::text) AND (l.respondido_em IS NOT NULL) AND ((l.ultimo_toque_em IS NULL) OR (l.respondido_em >= l.ultimo_toque_em))) THEN 'A ultima palavra foi dele. Responda a conversa, nao a cadencia.'::text
                    WHEN (vd.veredito = 'espere'::text) THEN (('Vence em '::text || (ce.passo_vence_em - hj.hoje)) || 'd. Tocar antes atropela o passo anterior.'::text)
                    ELSE NULL::text
                END AS veredito_motivo) mt ON (true));


--
-- Name: VIEW v_lead; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_lead IS 'Leitura unica de lead. Nivel, bola_com e veredito sao DERIVADOS aqui (invariante 4), nunca colunas. veredito responde "vale mandar?" e veredito_ordem ordena a Fila. Fadiga conta pelo PRIMEIRO toque (dias_silencio reinicia a cada toque do operador e por isso nao mede fadiga). Os cortes (4 toques, 3 toques em 30d, 2 toques apos resposta) sao hipotese de benchmark, nao regra medida nesta base: revisar com volume.';


--
-- Name: v_trafego_atribuicao; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_trafego_atribuicao WITH (security_invoker='on') AS
 WITH leads_trafego AS (
         SELECT l.tenant_id,
            l.id AS lead_id,
            COALESCE(l.trafego_ref, 'sem_ref'::text) AS ref,
            COALESCE(l.trafego_campanha, 'nao_informada'::text) AS campanha,
            COALESCE(l.trafego_data_contato, l.criado_em) AS data_contato
           FROM public.lead l
          WHERE ((l.origem = 'trafego_pago'::text) AND (l.arquivado_em IS NULL))
        ), vendas_trafego AS (
         SELECT lt_1.tenant_id,
            lt_1.ref,
            lt_1.lead_id,
            v.id AS venda_id,
            v.valor_venda,
            ((COALESCE(v.custo_aparelho, (0)::numeric) + COALESCE(v.despesa_frete, (0)::numeric)) + COALESCE(v.despesa_taxas, (0)::numeric)) AS custo_total,
            v.data_venda
           FROM (leads_trafego lt_1
             JOIN public.venda v ON (((v.lead_id = lt_1.lead_id) AND (v.tenant_id = lt_1.tenant_id))))
          WHERE (v.arquivado_em IS NULL)
        )
 SELECT lt.tenant_id,
    lt.ref,
    min(lt.campanha) AS campanha,
    count(DISTINCT lt.lead_id) AS conversas,
    count(DISTINCT vt.venda_id) AS vendas,
    round((((count(DISTINCT vt.venda_id))::numeric / (NULLIF(count(DISTINCT lt.lead_id), 0))::numeric) * (100)::numeric), 1) AS taxa_fechamento_pct,
    COALESCE(sum(vt.valor_venda), (0)::numeric) AS receita,
    COALESCE(sum((vt.valor_venda - vt.custo_total)), (0)::numeric) AS lucro_bruto,
    round((COALESCE(sum(vt.valor_venda), (0)::numeric) / (NULLIF(count(DISTINCT vt.venda_id), 0))::numeric), 2) AS ticket_medio,
    round((COALESCE(sum((vt.valor_venda - vt.custo_total)), (0)::numeric) / (NULLIF(count(DISTINCT vt.venda_id), 0))::numeric), 2) AS lucro_medio_por_venda,
    round((COALESCE(sum((vt.valor_venda - vt.custo_total)), (0)::numeric) / (NULLIF(count(DISTINCT lt.lead_id), 0))::numeric), 2) AS cpa_teto_breakeven,
    (min(lt.data_contato))::date AS primeira_conversa,
    (max(lt.data_contato))::date AS ultima_conversa,
        CASE
            WHEN (count(DISTINCT lt.lead_id) >= 50) THEN 'conclusivo'::text
            WHEN (count(DISTINCT lt.lead_id) >= 15) THEN 'direcional'::text
            ELSE 'insuficiente'::text
        END AS confianca
   FROM (leads_trafego lt
     LEFT JOIN vendas_trafego vt ON ((vt.lead_id = lt.lead_id)))
  GROUP BY lt.tenant_id, lt.ref
  ORDER BY (count(DISTINCT lt.lead_id)) DESC;


--
-- Name: VIEW v_trafego_atribuicao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_trafego_atribuicao IS 'Atribuicao de trafego pago por ref de campanha. READ ONLY, consumida pelo agente analista-de-dados. security_invoker on: respeita RLS por tenant. Linha com ref = sem_ref indica lead de trafego cujo registro manual de origem falhou, use como auditoria da disciplina de preenchimento. Coluna confianca: abaixo de 15 conversas nenhum numero desta view pode virar conclusao causal.';


--
-- Name: v_venda; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_venda WITH (security_invoker='on') AS
 SELECT v.id,
    v.tenant_id,
    v.venda_code,
    v.lead_id,
    v.comprador_nome,
    v.comprador_whatsapp,
    v.comprador_cpf,
    v.comprador_nascimento,
    v.comprador_instagram,
    v.modelo_id,
    v.capacidade,
    v.cor,
    v.condicao,
    v.imei,
    v.fornecedor_nome,
    v.fornecedor_contato,
    v.fornecedor_local_retirada,
    v.fornecedor_pix_url,
    v.valor_venda,
    v.custo_aparelho,
    v.despesa_frete,
    v.despesa_taxas,
    v.tem_trade_in,
    v.entrada_modelo,
    v.entrada_imei,
    v.entrada_valor,
    v.nf_numero,
    v.nf_url,
    v.status,
    v.endereco_entrega,
    v.valor_a_cobrar,
    v.motoboy,
    v.forma_pagamento,
    v.data_venda,
    v.observacoes,
    v.criado_por,
    v.criado_em,
    v.atualizado_em,
    v.arquivado_em,
    (((v.valor_venda - COALESCE(v.custo_aparelho, (0)::numeric)) - COALESCE(v.despesa_frete, (0)::numeric)) - COALESCE(v.despesa_taxas, (0)::numeric)) AS lucro,
    COALESCE(c.rotulo, v.modelo_texto) AS modelo_rotulo,
    COALESCE(l.nome, v.comprador_nome) AS cliente_nome,
    v.modelo_texto,
    l.lead_code AS cliente_code,
    l.whatsapp_digitos AS cliente_whatsapp,
    (l.cpf IS NOT NULL) AS cliente_tem_cpf,
    (l.endereco IS NOT NULL) AS cliente_tem_endereco,
    v.motoboy_whatsapp,
    v.etapa,
    v.etapa_em,
    (((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date - ((v.etapa_em AT TIME ZONE 'America/Sao_Paulo'::text))::date) AS dias_na_etapa
   FROM ((public.venda v
     LEFT JOIN public.catalogo_iphone c ON ((c.id = v.modelo_id)))
     LEFT JOIN public.lead l ON ((l.id = v.lead_id)))
  WHERE (v.arquivado_em IS NULL);


--
-- Name: venda_nf; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venda_nf (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT privado.fn_tenant_atual() NOT NULL,
    venda_id uuid NOT NULL,
    numero text,
    arquivo text NOT NULL,
    nome_original text,
    mime text,
    tamanho integer,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    enviado_por uuid DEFAULT auth.uid(),
    removido_em timestamp with time zone,
    removido_por uuid,
    CONSTRAINT venda_nf_arquivo_no_tenant CHECK ((arquivo ~~ ((tenant_id)::text || '/%'::text)))
);


--
-- Name: TABLE venda_nf; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.venda_nf IS 'Ponteiro para a NF no bucket privado nf. Um arquivo por linha; uma venda pode ter mais de uma NF (venda, entrada, compra do fornecedor). Append-only: authenticated so tem SELECT e INSERT; remocao e soft delete pela RPC remover_nf.';


--
-- Name: COLUMN venda_nf.arquivo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.venda_nf.arquivo IS 'Caminho no bucket nf: {tenant_id}/{venda_id}/{uuid}.{ext}. Nunca URL publica: a leitura e por signed URL de curta duracao.';


--
-- Name: v_venda_nf; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_venda_nf WITH (security_invoker='on') AS
 SELECT nf.id,
    nf.tenant_id,
    nf.venda_id,
    nf.numero,
    nf.arquivo,
    nf.nome_original,
    nf.mime,
    nf.tamanho,
    nf.enviado_em,
    nf.enviado_por,
    v.venda_code,
    v.status AS venda_status,
    v.data_venda,
    v.valor_venda,
    v.imei,
    COALESCE(c.rotulo, v.modelo_texto) AS modelo_rotulo,
    v.capacidade,
    v.cor,
    COALESCE(l.nome, v.comprador_nome) AS cliente_nome
   FROM (((public.venda_nf nf
     JOIN public.venda v ON ((v.id = nf.venda_id)))
     LEFT JOIN public.catalogo_iphone c ON ((c.id = v.modelo_id)))
     LEFT JOIN public.lead l ON ((l.id = v.lead_id)))
  WHERE ((nf.removido_em IS NULL) AND (v.arquivado_em IS NULL));


--
-- Name: venda_pagamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venda_pagamento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    venda_id uuid NOT NULL,
    forma text NOT NULL,
    valor numeric NOT NULL,
    parcelas integer DEFAULT 1 NOT NULL,
    bandeira text,
    taxa numeric,
    taxa_repassada boolean DEFAULT true NOT NULL,
    observacao text,
    ordem integer DEFAULT 0 NOT NULL,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT venda_pagamento_forma_ck CHECK ((forma = ANY (ARRAY['pix'::text, 'dinheiro'::text, 'cartao_credito'::text, 'cartao_debito'::text]))),
    CONSTRAINT venda_pagamento_parcela_credito_ck CHECK (((parcelas = 1) OR (forma = 'cartao_credito'::text))),
    CONSTRAINT venda_pagamento_parcelas_ck CHECK (((parcelas >= 1) AND (parcelas <= 24))),
    CONSTRAINT venda_pagamento_taxa_ck CHECK (((taxa IS NULL) OR (taxa >= (0)::numeric))),
    CONSTRAINT venda_pagamento_valor_ck CHECK ((valor > (0)::numeric))
);


--
-- Name: v_venda_pagamento; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_venda_pagamento WITH (security_invoker='on') AS
 SELECT p.id,
    p.tenant_id,
    p.venda_id,
    v.venda_code,
    p.forma,
    COALESCE(d.rotulo, p.forma) AS forma_rotulo,
    p.valor,
    p.parcelas,
    round((p.valor / (p.parcelas)::numeric), 2) AS valor_parcela,
    p.bandeira,
    p.taxa,
    p.taxa_repassada,
    p.observacao,
    p.ordem,
    p.criado_em
   FROM ((public.venda_pagamento p
     JOIN public.venda v ON ((v.id = p.venda_id)))
     LEFT JOIN public.dicionario_rotulos d ON (((d.dominio = 'forma_pgto_item'::text) AND (d.codigo = p.forma))))
  WHERE (v.arquivado_em IS NULL);


--
-- Name: app_usuario app_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_usuario
    ADD CONSTRAINT app_usuario_pkey PRIMARY KEY (id);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: cadencia_estado cadencia_estado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_estado
    ADD CONSTRAINT cadencia_estado_pkey PRIMARY KEY (lead_id);


--
-- Name: cadencia_perfil cadencia_perfil_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_perfil
    ADD CONSTRAINT cadencia_perfil_pkey PRIMARY KEY (id);


--
-- Name: cadencia_perfil cadencia_perfil_unico; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_perfil
    ADD CONSTRAINT cadencia_perfil_unico UNIQUE (tenant_id, perfil);


--
-- Name: cadencia_regra cadencia_regra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_regra
    ADD CONSTRAINT cadencia_regra_pkey PRIMARY KEY (id);


--
-- Name: cadencia_regra cadencia_regra_unica; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_regra
    ADD CONSTRAINT cadencia_regra_unica UNIQUE (tenant_id, perfil, passo);


--
-- Name: calc_dados calc_dados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_dados
    ADD CONSTRAINT calc_dados_pkey PRIMARY KEY (tenant_id);


--
-- Name: captacao_frente captacao_frente_chave; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captacao_frente
    ADD CONSTRAINT captacao_frente_chave UNIQUE (tenant_id, codigo);


--
-- Name: captacao_frente captacao_frente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captacao_frente
    ADD CONSTRAINT captacao_frente_pkey PRIMARY KEY (id);


--
-- Name: captacao_meta captacao_meta_chave; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captacao_meta
    ADD CONSTRAINT captacao_meta_chave UNIQUE (tenant_id, codigo);


--
-- Name: captacao_meta captacao_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captacao_meta
    ADD CONSTRAINT captacao_meta_pkey PRIMARY KEY (id);


--
-- Name: captacao captacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captacao
    ADD CONSTRAINT captacao_pkey PRIMARY KEY (id);


--
-- Name: captacao captacao_sem_duplicata; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captacao
    ADD CONSTRAINT captacao_sem_duplicata UNIQUE (tenant_id, frente, identificador);


--
-- Name: catalogo_iphone catalogo_iphone_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_iphone
    ADD CONSTRAINT catalogo_iphone_pkey PRIMARY KEY (id);


--
-- Name: conteudo_fonte conteudo_fonte_codigo_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo_fonte
    ADD CONSTRAINT conteudo_fonte_codigo_uq UNIQUE (tenant_id, codigo);


--
-- Name: conteudo_fonte conteudo_fonte_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo_fonte
    ADD CONSTRAINT conteudo_fonte_pkey PRIMARY KEY (id);


--
-- Name: conteudo_metrica conteudo_metrica_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo_metrica
    ADD CONSTRAINT conteudo_metrica_pkey PRIMARY KEY (id);


--
-- Name: conteudo conteudo_page_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo
    ADD CONSTRAINT conteudo_page_uq UNIQUE (tenant_id, notion_page_id);


--
-- Name: conteudo conteudo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo
    ADD CONSTRAINT conteudo_pkey PRIMARY KEY (id);


--
-- Name: conteudo_sync_log conteudo_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo_sync_log
    ADD CONSTRAINT conteudo_sync_log_pkey PRIMARY KEY (id);


--
-- Name: dia_lembrete dia_lembrete_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dia_lembrete
    ADD CONSTRAINT dia_lembrete_pkey PRIMARY KEY (id);


--
-- Name: dia_nota dia_nota_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dia_nota
    ADD CONSTRAINT dia_nota_pkey PRIMARY KEY (id);


--
-- Name: dia_nota dia_nota_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dia_nota
    ADD CONSTRAINT dia_nota_uq UNIQUE (tenant_id, usuario_id, data);


--
-- Name: dia_tarefa dia_tarefa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dia_tarefa
    ADD CONSTRAINT dia_tarefa_pkey PRIMARY KEY (id);


--
-- Name: dicionario_rotulos dicionario_rotulos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicionario_rotulos
    ADD CONSTRAINT dicionario_rotulos_pkey PRIMARY KEY (dominio, codigo);


--
-- Name: dicionario_scripts dicionario_scripts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicionario_scripts
    ADD CONSTRAINT dicionario_scripts_pkey PRIMARY KEY (id);


--
-- Name: dicionario_scripts dicionario_scripts_unico; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicionario_scripts
    ADD CONSTRAINT dicionario_scripts_unico UNIQUE (tenant_id, perfil, passo, variante);


--
-- Name: escopo_acao_evento escopo_acao_evento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escopo_acao_evento
    ADD CONSTRAINT escopo_acao_evento_pkey PRIMARY KEY (id);


--
-- Name: escopo_acao escopo_acao_id_tenant_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escopo_acao
    ADD CONSTRAINT escopo_acao_id_tenant_uq UNIQUE (tenant_id, id);


--
-- Name: escopo_acao escopo_acao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escopo_acao
    ADD CONSTRAINT escopo_acao_pkey PRIMARY KEY (id);


--
-- Name: escopo_frente escopo_frente_codigo_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escopo_frente
    ADD CONSTRAINT escopo_frente_codigo_uq UNIQUE (tenant_id, codigo);


--
-- Name: escopo_frente_evento escopo_frente_evento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escopo_frente_evento
    ADD CONSTRAINT escopo_frente_evento_pkey PRIMARY KEY (id);


--
-- Name: escopo_frente escopo_frente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escopo_frente
    ADD CONSTRAINT escopo_frente_pkey PRIMARY KEY (id);


--
-- Name: evento_uso evento_uso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_uso
    ADD CONSTRAINT evento_uso_pkey PRIMARY KEY (id);


--
-- Name: fin_categoria fin_categoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_categoria
    ADD CONSTRAINT fin_categoria_pkey PRIMARY KEY (id);


--
-- Name: fin_categoria fin_categoria_tenant_codigo_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_categoria
    ADD CONSTRAINT fin_categoria_tenant_codigo_uniq UNIQUE (tenant_id, codigo);


--
-- Name: fin_conta fin_conta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_conta
    ADD CONSTRAINT fin_conta_pkey PRIMARY KEY (id);


--
-- Name: fin_conta fin_conta_tenant_codigo_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_conta
    ADD CONSTRAINT fin_conta_tenant_codigo_uniq UNIQUE (tenant_id, codigo);


--
-- Name: fin_importacao fin_importacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_importacao
    ADD CONSTRAINT fin_importacao_pkey PRIMARY KEY (id);


--
-- Name: fin_movimento fin_movimento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_movimento
    ADD CONSTRAINT fin_movimento_pkey PRIMARY KEY (id);


--
-- Name: fin_regra fin_regra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_regra
    ADD CONSTRAINT fin_regra_pkey PRIMARY KEY (id);


--
-- Name: lead_evento lead_evento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_evento
    ADD CONSTRAINT lead_evento_pkey PRIMARY KEY (id);


--
-- Name: lead lead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead
    ADD CONSTRAINT lead_pkey PRIMARY KEY (id);


--
-- Name: lead lead_tenant_id_lead_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead
    ADD CONSTRAINT lead_tenant_id_lead_code_key UNIQUE (tenant_id, lead_code);


--
-- Name: motoboy motoboy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motoboy
    ADD CONSTRAINT motoboy_pkey PRIMARY KEY (id);


--
-- Name: conteudo_molde pk_conteudo_molde; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo_molde
    ADD CONSTRAINT pk_conteudo_molde PRIMARY KEY (tenant_id, version);


--
-- Name: regua_execucao regua_execucao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regua_execucao
    ADD CONSTRAINT regua_execucao_pkey PRIMARY KEY (id);


--
-- Name: rotina_categoria rotina_categoria_codigo_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotina_categoria
    ADD CONSTRAINT rotina_categoria_codigo_uq UNIQUE (tenant_id, codigo);


--
-- Name: rotina_categoria rotina_categoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotina_categoria
    ADD CONSTRAINT rotina_categoria_pkey PRIMARY KEY (id);


--
-- Name: rotina_tarefa rotina_tarefa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotina_tarefa
    ADD CONSTRAINT rotina_tarefa_pkey PRIMARY KEY (id);


--
-- Name: tenant tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_pkey PRIMARY KEY (id);


--
-- Name: venda_nf venda_nf_arquivo_unico; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda_nf
    ADD CONSTRAINT venda_nf_arquivo_unico UNIQUE (tenant_id, arquivo);


--
-- Name: venda_nf venda_nf_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda_nf
    ADD CONSTRAINT venda_nf_pkey PRIMARY KEY (id);


--
-- Name: venda_pagamento venda_pagamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda_pagamento
    ADD CONSTRAINT venda_pagamento_pkey PRIMARY KEY (id);


--
-- Name: venda venda_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda
    ADD CONSTRAINT venda_pkey PRIMARY KEY (id);


--
-- Name: conteudo_data_ix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conteudo_data_ix ON public.conteudo USING btree (tenant_id, data) WHERE (sumiu_em IS NULL);


--
-- Name: conteudo_metrica_pos_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conteudo_metrica_pos_idx ON public.conteudo_metrica USING btree (tenant_id, conteudo_id, medido_em DESC, criado_em DESC);


--
-- Name: conteudo_sync_log_ix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conteudo_sync_log_ix ON public.conteudo_sync_log USING btree (tenant_id, criado_em DESC);


--
-- Name: dia_lembrete_dia_ix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dia_lembrete_dia_ix ON public.dia_lembrete USING btree (tenant_id, usuario_id, data);


--
-- Name: dia_tarefa_dia_ix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dia_tarefa_dia_ix ON public.dia_tarefa USING btree (tenant_id, usuario_id, data);


--
-- Name: dia_tarefa_rotina_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX dia_tarefa_rotina_uq ON public.dia_tarefa USING btree (tenant_id, usuario_id, data, rotina_tarefa_id);


--
-- Name: escopo_acao_evento_acao_ix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX escopo_acao_evento_acao_ix ON public.escopo_acao_evento USING btree (tenant_id, acao_id, em DESC);


--
-- Name: escopo_acao_frente_ix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX escopo_acao_frente_ix ON public.escopo_acao USING btree (tenant_id, frente) WHERE (NOT arquivada);


--
-- Name: fin_imp_conta_fk_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fin_imp_conta_fk_idx ON public.fin_importacao USING btree (conta_id);


--
-- Name: fin_imp_conta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fin_imp_conta_idx ON public.fin_importacao USING btree (tenant_id, enviado_em DESC);


--
-- Name: fin_mov_categoria_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fin_mov_categoria_idx ON public.fin_movimento USING btree (tenant_id, categoria_codigo);


--
-- Name: fin_mov_conta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fin_mov_conta_idx ON public.fin_movimento USING btree (conta_id);


--
-- Name: fin_mov_contraparte_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fin_mov_contraparte_idx ON public.fin_movimento USING btree (tenant_id, contraparte, data) WHERE (arquivado_em IS NULL);


--
-- Name: fin_mov_data_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fin_mov_data_idx ON public.fin_movimento USING btree (tenant_id, data DESC);


--
-- Name: fin_mov_fitid_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fin_mov_fitid_uniq ON public.fin_movimento USING btree (tenant_id, conta_id, fitid) WHERE ((fitid IS NOT NULL) AND (arquivado_em IS NULL));


--
-- Name: fin_mov_hash_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fin_mov_hash_uniq ON public.fin_movimento USING btree (tenant_id, conta_id, hash_dedupe) WHERE (arquivado_em IS NULL);


--
-- Name: fin_mov_importacao_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fin_mov_importacao_idx ON public.fin_movimento USING btree (importacao_id) WHERE (importacao_id IS NOT NULL);


--
-- Name: fin_mov_naoclass_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fin_mov_naoclass_idx ON public.fin_movimento USING btree (tenant_id, data DESC) WHERE ((dominio IS NULL) AND (arquivado_em IS NULL));


--
-- Name: fin_mov_venda_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fin_mov_venda_idx ON public.fin_movimento USING btree (venda_id) WHERE (venda_id IS NOT NULL);


--
-- Name: fin_movimento_repasse_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fin_movimento_repasse_idx ON public.fin_movimento USING btree (tenant_id, repasse_id) WHERE (repasse_id IS NOT NULL);


--
-- Name: fin_regra_ativa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fin_regra_ativa_idx ON public.fin_regra USING btree (tenant_id, prioridade, id) WHERE (ativo AND (arquivado_em IS NULL));


--
-- Name: fin_regra_categoria_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fin_regra_categoria_idx ON public.fin_regra USING btree (tenant_id, categoria_codigo) WHERE (categoria_codigo IS NOT NULL);


--
-- Name: fin_regra_padrao_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fin_regra_padrao_uniq ON public.fin_regra USING btree (tenant_id, privado.fn_fin_norm(padrao), tipo_match) WHERE (arquivado_em IS NULL);


--
-- Name: idx_lead_evento_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_evento_lead ON public.lead_evento USING btree (tenant_id, lead_id, criado_em DESC);


--
-- Name: idx_lead_tenant_fila; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_tenant_fila ON public.lead USING btree (tenant_id, status, proximo_contato);


--
-- Name: idx_lead_trafego_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_trafego_data ON public.lead USING btree (trafego_data_contato) WHERE (trafego_data_contato IS NOT NULL);


--
-- Name: idx_lead_trafego_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_trafego_ref ON public.lead USING btree (trafego_ref) WHERE (trafego_ref IS NOT NULL);


--
-- Name: ix_captacao_tenant_dia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_captacao_tenant_dia ON public.captacao USING btree (tenant_id, criado_em DESC);


--
-- Name: ix_captacao_virou_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_captacao_virou_lead ON public.captacao USING btree (virou_lead_id) WHERE (virou_lead_id IS NOT NULL);


--
-- Name: ix_conteudo_molde_tenant_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_conteudo_molde_tenant_version ON public.conteudo_molde USING btree (tenant_id, version DESC);


--
-- Name: ix_escopo_frente_evento_frente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_escopo_frente_evento_frente ON public.escopo_frente_evento USING btree (tenant_id, frente, em DESC);


--
-- Name: ix_regua_execucao_criado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_regua_execucao_criado ON public.regua_execucao USING btree (criado_em DESC);


--
-- Name: ix_venda_nf_recente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_venda_nf_recente ON public.venda_nf USING btree (tenant_id, enviado_em DESC);


--
-- Name: ix_venda_nf_venda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_venda_nf_venda ON public.venda_nf USING btree (tenant_id, venda_id);


--
-- Name: ix_venda_pagamento_venda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_venda_pagamento_venda ON public.venda_pagamento USING btree (venda_id);


--
-- Name: lead_tenant_cpf_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lead_tenant_cpf_uniq ON public.lead USING btree (tenant_id, cpf) WHERE ((cpf IS NOT NULL) AND (arquivado_em IS NULL));


--
-- Name: lead_tenant_whats_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lead_tenant_whats_uniq ON public.lead USING btree (tenant_id, "right"(whatsapp_digitos, 11)) WHERE ((whatsapp_digitos IS NOT NULL) AND (arquivado_em IS NULL));


--
-- Name: INDEX lead_tenant_whats_uniq; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.lead_tenant_whats_uniq IS 'Identidade do lead e o telefone. Compara os 11 ultimos digitos para que formato (com ou sem DDI 55) nao abra brecha de duplicata. Substituiu lead_tenant_id_whatsapp_digitos_key em 19/08/2026.';


--
-- Name: motoboy_tel_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX motoboy_tel_unico ON public.motoboy USING btree (tenant_id, whatsapp) WHERE ((desligado_em IS NULL) AND (whatsapp IS NOT NULL));


--
-- Name: rotina_tarefa_tenant_ix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rotina_tarefa_tenant_ix ON public.rotina_tarefa USING btree (tenant_id, ativa);


--
-- Name: venda_lead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX venda_lead_idx ON public.venda USING btree (lead_id) WHERE (lead_id IS NOT NULL);


--
-- Name: venda_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX venda_tenant_idx ON public.venda USING btree (tenant_id);


--
-- Name: captacao tg_auditar_captacao; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_auditar_captacao AFTER INSERT OR DELETE OR UPDATE ON public.captacao FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: captacao_frente tg_auditar_captacao_frente; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_auditar_captacao_frente AFTER INSERT OR DELETE OR UPDATE ON public.captacao_frente FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: captacao_meta tg_auditar_captacao_meta; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_auditar_captacao_meta AFTER INSERT OR DELETE OR UPDATE ON public.captacao_meta FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: escopo_acao tg_escopo_acao_evento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_escopo_acao_evento AFTER INSERT OR UPDATE ON public.escopo_acao FOR EACH ROW EXECUTE FUNCTION privado.fn_escopo_evento();


--
-- Name: escopo_frente tg_escopo_meta_evento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_escopo_meta_evento AFTER UPDATE ON public.escopo_frente FOR EACH ROW EXECUTE FUNCTION privado.fn_escopo_meta_evento();


--
-- Name: app_usuario trg_auditar_app_usuario; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_app_usuario AFTER INSERT OR DELETE OR UPDATE ON public.app_usuario FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: cadencia_estado trg_auditar_cadencia; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_cadencia AFTER INSERT OR DELETE OR UPDATE ON public.cadencia_estado FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: cadencia_perfil trg_auditar_cadencia_perfil; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_cadencia_perfil AFTER INSERT OR DELETE OR UPDATE ON public.cadencia_perfil FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: cadencia_regra trg_auditar_cadencia_regra; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_cadencia_regra AFTER INSERT OR DELETE OR UPDATE ON public.cadencia_regra FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: conteudo_fonte trg_auditar_conteudo_fonte; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_conteudo_fonte AFTER INSERT OR DELETE OR UPDATE ON public.conteudo_fonte FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: conteudo_metrica trg_auditar_conteudo_metrica; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_conteudo_metrica AFTER INSERT OR DELETE OR UPDATE ON public.conteudo_metrica FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: dia_lembrete trg_auditar_dia_lembrete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_dia_lembrete AFTER INSERT OR DELETE OR UPDATE ON public.dia_lembrete FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: dia_nota trg_auditar_dia_nota; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_dia_nota AFTER INSERT OR DELETE OR UPDATE ON public.dia_nota FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: dia_tarefa trg_auditar_dia_tarefa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_dia_tarefa AFTER INSERT OR DELETE OR UPDATE ON public.dia_tarefa FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: dicionario_scripts trg_auditar_dicionario_scripts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_dicionario_scripts AFTER INSERT OR DELETE OR UPDATE ON public.dicionario_scripts FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: fin_categoria trg_auditar_fin_categoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_fin_categoria AFTER INSERT OR DELETE OR UPDATE ON public.fin_categoria FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: fin_conta trg_auditar_fin_conta; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_fin_conta AFTER INSERT OR DELETE OR UPDATE ON public.fin_conta FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: fin_importacao trg_auditar_fin_importacao; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_fin_importacao AFTER INSERT OR DELETE OR UPDATE ON public.fin_importacao FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: fin_movimento trg_auditar_fin_movimento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_fin_movimento AFTER INSERT OR DELETE OR UPDATE ON public.fin_movimento FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: fin_regra trg_auditar_fin_regra; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_fin_regra AFTER INSERT OR DELETE OR UPDATE ON public.fin_regra FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: lead trg_auditar_lead; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_lead AFTER INSERT OR DELETE OR UPDATE ON public.lead FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: lead_evento trg_auditar_lead_evento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_lead_evento AFTER INSERT OR DELETE OR UPDATE ON public.lead_evento FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: rotina_categoria trg_auditar_rotina_categoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_rotina_categoria AFTER INSERT OR DELETE OR UPDATE ON public.rotina_categoria FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: rotina_tarefa trg_auditar_rotina_tarefa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_rotina_tarefa AFTER INSERT OR DELETE OR UPDATE ON public.rotina_tarefa FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: venda trg_auditar_venda; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_venda AFTER INSERT OR DELETE OR UPDATE ON public.venda FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: venda_nf trg_auditar_venda_nf; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_venda_nf AFTER INSERT OR DELETE OR UPDATE ON public.venda_nf FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();


--
-- Name: cadencia_perfil trg_touch_cadencia_perfil; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_cadencia_perfil BEFORE UPDATE ON public.cadencia_perfil FOR EACH ROW EXECUTE FUNCTION public.fn_touch_atualizado_em();


--
-- Name: cadencia_regra trg_touch_cadencia_regra; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_cadencia_regra BEFORE UPDATE ON public.cadencia_regra FOR EACH ROW EXECUTE FUNCTION public.fn_touch_atualizado_em();


--
-- Name: conteudo_fonte trg_touch_conteudo_fonte; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_conteudo_fonte BEFORE UPDATE ON public.conteudo_fonte FOR EACH ROW EXECUTE FUNCTION public.fn_touch_atualizado_em();


--
-- Name: dia_nota trg_touch_dia_nota; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_dia_nota BEFORE UPDATE ON public.dia_nota FOR EACH ROW EXECUTE FUNCTION public.fn_touch_atualizado_em();


--
-- Name: dicionario_scripts trg_touch_dicionario_scripts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_dicionario_scripts BEFORE UPDATE ON public.dicionario_scripts FOR EACH ROW EXECUTE FUNCTION public.fn_touch_atualizado_em();


--
-- Name: rotina_categoria trg_touch_rotina_categoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_rotina_categoria BEFORE UPDATE ON public.rotina_categoria FOR EACH ROW EXECUTE FUNCTION public.fn_touch_atualizado_em();


--
-- Name: rotina_tarefa trg_touch_rotina_tarefa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_rotina_tarefa BEFORE UPDATE ON public.rotina_tarefa FOR EACH ROW EXECUTE FUNCTION public.fn_touch_atualizado_em();


--
-- Name: venda venda_code_bi; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER venda_code_bi BEFORE INSERT ON public.venda FOR EACH ROW EXECUTE FUNCTION privado.fn_venda_code();


--
-- Name: app_usuario app_usuario_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_usuario
    ADD CONSTRAINT app_usuario_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: cadencia_estado cadencia_estado_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_estado
    ADD CONSTRAINT cadencia_estado_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.lead(id);


--
-- Name: cadencia_estado cadencia_estado_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_estado
    ADD CONSTRAINT cadencia_estado_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: cadencia_perfil cadencia_perfil_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_perfil
    ADD CONSTRAINT cadencia_perfil_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: cadencia_regra cadencia_regra_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_regra
    ADD CONSTRAINT cadencia_regra_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: captacao captacao_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captacao
    ADD CONSTRAINT captacao_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.app_usuario(id);


--
-- Name: captacao captacao_frente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captacao
    ADD CONSTRAINT captacao_frente_fkey FOREIGN KEY (tenant_id, frente) REFERENCES public.captacao_frente(tenant_id, codigo);


--
-- Name: captacao_frente captacao_frente_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captacao_frente
    ADD CONSTRAINT captacao_frente_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: captacao_meta captacao_meta_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captacao_meta
    ADD CONSTRAINT captacao_meta_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: captacao captacao_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captacao
    ADD CONSTRAINT captacao_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: captacao captacao_virou_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captacao
    ADD CONSTRAINT captacao_virou_lead_id_fkey FOREIGN KEY (virou_lead_id) REFERENCES public.lead(id);


--
-- Name: catalogo_iphone catalogo_iphone_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_iphone
    ADD CONSTRAINT catalogo_iphone_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: conteudo conteudo_fonte_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo
    ADD CONSTRAINT conteudo_fonte_fk FOREIGN KEY (tenant_id, fonte) REFERENCES public.conteudo_fonte(tenant_id, codigo);


--
-- Name: conteudo_fonte conteudo_fonte_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo_fonte
    ADD CONSTRAINT conteudo_fonte_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: conteudo_metrica conteudo_metrica_conteudo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo_metrica
    ADD CONSTRAINT conteudo_metrica_conteudo_id_fkey FOREIGN KEY (conteudo_id) REFERENCES public.conteudo(id);


--
-- Name: conteudo_metrica conteudo_metrica_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo_metrica
    ADD CONSTRAINT conteudo_metrica_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: conteudo_molde conteudo_molde_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo_molde
    ADD CONSTRAINT conteudo_molde_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: conteudo_sync_log conteudo_sync_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo_sync_log
    ADD CONSTRAINT conteudo_sync_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: conteudo conteudo_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conteudo
    ADD CONSTRAINT conteudo_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: dia_lembrete dia_lembrete_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dia_lembrete
    ADD CONSTRAINT dia_lembrete_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: dia_lembrete dia_lembrete_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dia_lembrete
    ADD CONSTRAINT dia_lembrete_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.app_usuario(id);


--
-- Name: dia_nota dia_nota_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dia_nota
    ADD CONSTRAINT dia_nota_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: dia_nota dia_nota_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dia_nota
    ADD CONSTRAINT dia_nota_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.app_usuario(id);


--
-- Name: dia_tarefa dia_tarefa_rotina_tarefa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dia_tarefa
    ADD CONSTRAINT dia_tarefa_rotina_tarefa_id_fkey FOREIGN KEY (rotina_tarefa_id) REFERENCES public.rotina_tarefa(id);


--
-- Name: dia_tarefa dia_tarefa_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dia_tarefa
    ADD CONSTRAINT dia_tarefa_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: dia_tarefa dia_tarefa_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dia_tarefa
    ADD CONSTRAINT dia_tarefa_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.app_usuario(id);


--
-- Name: dicionario_scripts dicionario_scripts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dicionario_scripts
    ADD CONSTRAINT dicionario_scripts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: escopo_acao_evento escopo_acao_evento_acao_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escopo_acao_evento
    ADD CONSTRAINT escopo_acao_evento_acao_fk FOREIGN KEY (tenant_id, acao_id) REFERENCES public.escopo_acao(tenant_id, id);


--
-- Name: escopo_acao_evento escopo_acao_evento_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escopo_acao_evento
    ADD CONSTRAINT escopo_acao_evento_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: escopo_acao escopo_acao_frente_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escopo_acao
    ADD CONSTRAINT escopo_acao_frente_fk FOREIGN KEY (tenant_id, frente) REFERENCES public.escopo_frente(tenant_id, codigo);


--
-- Name: escopo_acao escopo_acao_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escopo_acao
    ADD CONSTRAINT escopo_acao_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: escopo_frente escopo_frente_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escopo_frente
    ADD CONSTRAINT escopo_frente_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: evento_uso evento_uso_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_uso
    ADD CONSTRAINT evento_uso_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: evento_uso evento_uso_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_uso
    ADD CONSTRAINT evento_uso_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.app_usuario(id);


--
-- Name: fin_categoria fin_categoria_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_categoria
    ADD CONSTRAINT fin_categoria_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.app_usuario(id);


--
-- Name: fin_categoria fin_categoria_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_categoria
    ADD CONSTRAINT fin_categoria_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: fin_conta fin_conta_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_conta
    ADD CONSTRAINT fin_conta_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.app_usuario(id);


--
-- Name: fin_conta fin_conta_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_conta
    ADD CONSTRAINT fin_conta_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: fin_importacao fin_importacao_conta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_importacao
    ADD CONSTRAINT fin_importacao_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES public.fin_conta(id);


--
-- Name: fin_importacao fin_importacao_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_importacao
    ADD CONSTRAINT fin_importacao_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: fin_movimento fin_movimento_categoria_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_movimento
    ADD CONSTRAINT fin_movimento_categoria_fk FOREIGN KEY (tenant_id, categoria_codigo) REFERENCES public.fin_categoria(tenant_id, codigo) ON UPDATE CASCADE;


--
-- Name: fin_movimento fin_movimento_conta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_movimento
    ADD CONSTRAINT fin_movimento_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES public.fin_conta(id);


--
-- Name: fin_movimento fin_movimento_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_movimento
    ADD CONSTRAINT fin_movimento_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.app_usuario(id);


--
-- Name: fin_movimento fin_movimento_importacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_movimento
    ADD CONSTRAINT fin_movimento_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES public.fin_importacao(id);


--
-- Name: fin_movimento fin_movimento_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_movimento
    ADD CONSTRAINT fin_movimento_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: fin_movimento fin_movimento_venda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_movimento
    ADD CONSTRAINT fin_movimento_venda_id_fkey FOREIGN KEY (venda_id) REFERENCES public.venda(id);


--
-- Name: fin_regra fin_regra_categoria_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_regra
    ADD CONSTRAINT fin_regra_categoria_fk FOREIGN KEY (tenant_id, categoria_codigo) REFERENCES public.fin_categoria(tenant_id, codigo) ON UPDATE CASCADE;


--
-- Name: fin_regra fin_regra_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_regra
    ADD CONSTRAINT fin_regra_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.app_usuario(id);


--
-- Name: fin_regra fin_regra_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fin_regra
    ADD CONSTRAINT fin_regra_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: lead lead_dono_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead
    ADD CONSTRAINT lead_dono_user_id_fkey FOREIGN KEY (dono_user_id) REFERENCES public.app_usuario(id);


--
-- Name: lead_evento lead_evento_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_evento
    ADD CONSTRAINT lead_evento_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.app_usuario(id);


--
-- Name: lead_evento lead_evento_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_evento
    ADD CONSTRAINT lead_evento_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.lead(id);


--
-- Name: lead_evento lead_evento_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_evento
    ADD CONSTRAINT lead_evento_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: lead lead_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead
    ADD CONSTRAINT lead_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: motoboy motoboy_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motoboy
    ADD CONSTRAINT motoboy_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: regua_execucao regua_execucao_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regua_execucao
    ADD CONSTRAINT regua_execucao_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: rotina_categoria rotina_categoria_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotina_categoria
    ADD CONSTRAINT rotina_categoria_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: rotina_tarefa rotina_tarefa_categoria_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotina_tarefa
    ADD CONSTRAINT rotina_tarefa_categoria_fk FOREIGN KEY (tenant_id, categoria) REFERENCES public.rotina_categoria(tenant_id, codigo);


--
-- Name: rotina_tarefa rotina_tarefa_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotina_tarefa
    ADD CONSTRAINT rotina_tarefa_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: venda venda_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda
    ADD CONSTRAINT venda_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.app_usuario(id);


--
-- Name: venda venda_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda
    ADD CONSTRAINT venda_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.lead(id);


--
-- Name: venda venda_modelo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda
    ADD CONSTRAINT venda_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES public.catalogo_iphone(id);


--
-- Name: venda_nf venda_nf_venda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda_nf
    ADD CONSTRAINT venda_nf_venda_id_fkey FOREIGN KEY (venda_id) REFERENCES public.venda(id) ON DELETE RESTRICT;


--
-- Name: venda_pagamento venda_pagamento_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda_pagamento
    ADD CONSTRAINT venda_pagamento_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: venda_pagamento venda_pagamento_venda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda_pagamento
    ADD CONSTRAINT venda_pagamento_venda_id_fkey FOREIGN KEY (venda_id) REFERENCES public.venda(id) ON DELETE CASCADE;


--
-- Name: venda venda_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda
    ADD CONSTRAINT venda_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: app_usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

--
-- Name: cadencia_estado; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cadencia_estado ENABLE ROW LEVEL SECURITY;

--
-- Name: cadencia_perfil; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cadencia_perfil ENABLE ROW LEVEL SECURITY;

--
-- Name: cadencia_regra; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cadencia_regra ENABLE ROW LEVEL SECURITY;

--
-- Name: calc_dados; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calc_dados ENABLE ROW LEVEL SECURITY;

--
-- Name: calc_dados calc_dados_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_dados_sel ON public.calc_dados FOR SELECT TO authenticated USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: POLICY calc_dados_sel ON calc_dados; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY calc_dados_sel ON public.calc_dados IS 'SELECT so para papel dono do proprio tenant. Custo de fornecedor nao sai para vendedor (17/08/2026).';


--
-- Name: captacao; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.captacao ENABLE ROW LEVEL SECURITY;

--
-- Name: captacao_frente; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.captacao_frente ENABLE ROW LEVEL SECURITY;

--
-- Name: captacao_meta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.captacao_meta ENABLE ROW LEVEL SECURITY;

--
-- Name: catalogo_iphone; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.catalogo_iphone ENABLE ROW LEVEL SECURITY;

--
-- Name: catalogo_iphone catalogo_iphone_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalogo_iphone_ins ON public.catalogo_iphone FOR INSERT WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: catalogo_iphone catalogo_iphone_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalogo_iphone_sel ON public.catalogo_iphone FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: catalogo_iphone catalogo_iphone_upd; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalogo_iphone_upd ON public.catalogo_iphone FOR UPDATE USING ((tenant_id = privado.fn_tenant_atual())) WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: conteudo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conteudo ENABLE ROW LEVEL SECURITY;

--
-- Name: conteudo_fonte; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conteudo_fonte ENABLE ROW LEVEL SECURITY;

--
-- Name: conteudo_metrica; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conteudo_metrica ENABLE ROW LEVEL SECURITY;

--
-- Name: conteudo_molde; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conteudo_molde ENABLE ROW LEVEL SECURITY;

--
-- Name: conteudo_sync_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conteudo_sync_log ENABLE ROW LEVEL SECURITY;

--
-- Name: dia_lembrete; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dia_lembrete ENABLE ROW LEVEL SECURITY;

--
-- Name: dia_nota; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dia_nota ENABLE ROW LEVEL SECURITY;

--
-- Name: dia_tarefa; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dia_tarefa ENABLE ROW LEVEL SECURITY;

--
-- Name: dicionario_rotulos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dicionario_rotulos ENABLE ROW LEVEL SECURITY;

--
-- Name: dicionario_scripts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dicionario_scripts ENABLE ROW LEVEL SECURITY;

--
-- Name: escopo_acao; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escopo_acao ENABLE ROW LEVEL SECURITY;

--
-- Name: escopo_acao_evento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escopo_acao_evento ENABLE ROW LEVEL SECURITY;

--
-- Name: escopo_frente; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escopo_frente ENABLE ROW LEVEL SECURITY;

--
-- Name: escopo_frente_evento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escopo_frente_evento ENABLE ROW LEVEL SECURITY;

--
-- Name: escopo_frente_evento escopo_frente_evento_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escopo_frente_evento_ins ON public.escopo_frente_evento FOR INSERT TO authenticated WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: escopo_frente_evento escopo_frente_evento_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escopo_frente_evento_sel ON public.escopo_frente_evento FOR SELECT TO authenticated USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: evento_uso; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.evento_uso ENABLE ROW LEVEL SECURITY;

--
-- Name: fin_categoria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fin_categoria ENABLE ROW LEVEL SECURITY;

--
-- Name: fin_categoria fin_categoria_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_categoria_sel ON public.fin_categoria FOR SELECT TO authenticated USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: fin_conta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fin_conta ENABLE ROW LEVEL SECURITY;

--
-- Name: fin_conta fin_conta_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_conta_sel ON public.fin_conta FOR SELECT TO authenticated USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: fin_importacao; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fin_importacao ENABLE ROW LEVEL SECURITY;

--
-- Name: fin_importacao fin_importacao_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_importacao_ins ON public.fin_importacao FOR INSERT TO authenticated WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: fin_importacao fin_importacao_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_importacao_sel ON public.fin_importacao FOR SELECT TO authenticated USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: fin_movimento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fin_movimento ENABLE ROW LEVEL SECURITY;

--
-- Name: fin_movimento fin_movimento_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_movimento_ins ON public.fin_movimento FOR INSERT TO authenticated WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: fin_movimento fin_movimento_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_movimento_sel ON public.fin_movimento FOR SELECT TO authenticated USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: fin_movimento fin_movimento_upd; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_movimento_upd ON public.fin_movimento FOR UPDATE TO authenticated USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text))) WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: fin_regra; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fin_regra ENABLE ROW LEVEL SECURITY;

--
-- Name: fin_regra fin_regra_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_regra_ins ON public.fin_regra FOR INSERT TO authenticated WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: fin_regra fin_regra_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_regra_sel ON public.fin_regra FOR SELECT TO authenticated USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: fin_regra fin_regra_upd; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_regra_upd ON public.fin_regra FOR UPDATE TO authenticated USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text))) WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: lead; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_evento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_evento ENABLE ROW LEVEL SECURITY;

--
-- Name: motoboy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.motoboy ENABLE ROW LEVEL SECURITY;

--
-- Name: motoboy motoboy_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY motoboy_ins ON public.motoboy FOR INSERT TO authenticated WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: motoboy motoboy_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY motoboy_sel ON public.motoboy FOR SELECT TO authenticated USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: motoboy motoboy_upd; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY motoboy_upd ON public.motoboy FOR UPDATE TO authenticated USING ((tenant_id = privado.fn_tenant_atual())) WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: auditoria p_auditoria_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_auditoria_select ON public.auditoria FOR SELECT USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: cadencia_perfil p_cadencia_perfil_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_cadencia_perfil_select ON public.cadencia_perfil FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: cadencia_regra p_cadencia_regra_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_cadencia_regra_select ON public.cadencia_regra FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: cadencia_estado p_cadencia_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_cadencia_select ON public.cadencia_estado FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: captacao_frente p_captacao_frente_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_captacao_frente_select ON public.captacao_frente FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: captacao p_captacao_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_captacao_insert ON public.captacao FOR INSERT WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: captacao_meta p_captacao_meta_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_captacao_meta_select ON public.captacao_meta FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: captacao_meta p_captacao_meta_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_captacao_meta_update ON public.captacao_meta FOR UPDATE USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text))) WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: captacao p_captacao_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_captacao_select ON public.captacao FOR SELECT USING (((tenant_id = privado.fn_tenant_atual()) AND ((privado.fn_papel_atual() = 'dono'::text) OR (criado_por = auth.uid()) OR (criado_por IS NULL))));


--
-- Name: captacao p_captacao_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_captacao_update ON public.captacao FOR UPDATE USING (((tenant_id = privado.fn_tenant_atual()) AND ((privado.fn_papel_atual() = 'dono'::text) OR (criado_por = auth.uid()) OR (criado_por IS NULL)))) WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: conteudo_fonte p_conteudo_fonte_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_conteudo_fonte_select ON public.conteudo_fonte FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: conteudo_metrica p_conteudo_metrica_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_conteudo_metrica_insert ON public.conteudo_metrica FOR INSERT WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: conteudo_metrica p_conteudo_metrica_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_conteudo_metrica_select ON public.conteudo_metrica FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: conteudo_molde p_conteudo_molde_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_conteudo_molde_select ON public.conteudo_molde FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: conteudo p_conteudo_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_conteudo_select ON public.conteudo FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: conteudo_sync_log p_conteudo_sync_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_conteudo_sync_log_select ON public.conteudo_sync_log FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: dia_lembrete p_dia_lembrete_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_dia_lembrete_insert ON public.dia_lembrete FOR INSERT WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (usuario_id = auth.uid())));


--
-- Name: dia_lembrete p_dia_lembrete_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_dia_lembrete_select ON public.dia_lembrete FOR SELECT USING (((tenant_id = privado.fn_tenant_atual()) AND ((privado.fn_papel_atual() = 'dono'::text) OR (usuario_id = auth.uid()))));


--
-- Name: dia_lembrete p_dia_lembrete_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_dia_lembrete_update ON public.dia_lembrete FOR UPDATE USING (((tenant_id = privado.fn_tenant_atual()) AND ((privado.fn_papel_atual() = 'dono'::text) OR (usuario_id = auth.uid())))) WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: dia_nota p_dia_nota_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_dia_nota_insert ON public.dia_nota FOR INSERT WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (usuario_id = auth.uid())));


--
-- Name: dia_nota p_dia_nota_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_dia_nota_select ON public.dia_nota FOR SELECT USING (((tenant_id = privado.fn_tenant_atual()) AND ((privado.fn_papel_atual() = 'dono'::text) OR (usuario_id = auth.uid()))));


--
-- Name: dia_nota p_dia_nota_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_dia_nota_update ON public.dia_nota FOR UPDATE USING (((tenant_id = privado.fn_tenant_atual()) AND ((privado.fn_papel_atual() = 'dono'::text) OR (usuario_id = auth.uid())))) WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: dia_tarefa p_dia_tarefa_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_dia_tarefa_insert ON public.dia_tarefa FOR INSERT WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (usuario_id = auth.uid())));


--
-- Name: dia_tarefa p_dia_tarefa_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_dia_tarefa_select ON public.dia_tarefa FOR SELECT USING (((tenant_id = privado.fn_tenant_atual()) AND ((privado.fn_papel_atual() = 'dono'::text) OR (usuario_id = auth.uid()))));


--
-- Name: dia_tarefa p_dia_tarefa_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_dia_tarefa_update ON public.dia_tarefa FOR UPDATE USING (((tenant_id = privado.fn_tenant_atual()) AND ((privado.fn_papel_atual() = 'dono'::text) OR (usuario_id = auth.uid())))) WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: dicionario_scripts p_dicionario_scripts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_dicionario_scripts_select ON public.dicionario_scripts FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: escopo_acao_evento p_escopo_acao_evento_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_escopo_acao_evento_insert ON public.escopo_acao_evento FOR INSERT WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: escopo_acao_evento p_escopo_acao_evento_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_escopo_acao_evento_select ON public.escopo_acao_evento FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: escopo_acao p_escopo_acao_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_escopo_acao_insert ON public.escopo_acao FOR INSERT WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: escopo_acao p_escopo_acao_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_escopo_acao_select ON public.escopo_acao FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: escopo_acao p_escopo_acao_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_escopo_acao_update ON public.escopo_acao FOR UPDATE USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text))) WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: escopo_frente p_escopo_frente_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_escopo_frente_insert ON public.escopo_frente FOR INSERT WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: escopo_frente p_escopo_frente_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_escopo_frente_select ON public.escopo_frente FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: escopo_frente p_escopo_frente_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_escopo_frente_update ON public.escopo_frente FOR UPDATE USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text))) WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: evento_uso p_evento_uso_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_evento_uso_insert ON public.evento_uso FOR INSERT WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: evento_uso p_evento_uso_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_evento_uso_select ON public.evento_uso FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: lead_evento p_lead_evento_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_lead_evento_insert ON public.lead_evento FOR INSERT WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: lead_evento p_lead_evento_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_lead_evento_select ON public.lead_evento FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: lead p_lead_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_lead_insert ON public.lead FOR INSERT WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: lead p_lead_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_lead_select ON public.lead FOR SELECT USING (((tenant_id = privado.fn_tenant_atual()) AND ((privado.fn_papel_atual() = 'dono'::text) OR (dono_user_id = auth.uid()) OR (dono_user_id IS NULL))));


--
-- Name: lead p_lead_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_lead_update ON public.lead FOR UPDATE USING (((tenant_id = privado.fn_tenant_atual()) AND ((privado.fn_papel_atual() = 'dono'::text) OR (dono_user_id = auth.uid()) OR (dono_user_id IS NULL)))) WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: regua_execucao p_regua_execucao_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_regua_execucao_select ON public.regua_execucao FOR SELECT TO authenticated USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: rotina_categoria p_rotina_categoria_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_rotina_categoria_insert ON public.rotina_categoria FOR INSERT WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: rotina_categoria p_rotina_categoria_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_rotina_categoria_select ON public.rotina_categoria FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: rotina_categoria p_rotina_categoria_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_rotina_categoria_update ON public.rotina_categoria FOR UPDATE USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text))) WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: rotina_tarefa p_rotina_tarefa_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_rotina_tarefa_insert ON public.rotina_tarefa FOR INSERT WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: rotina_tarefa p_rotina_tarefa_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_rotina_tarefa_select ON public.rotina_tarefa FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: rotina_tarefa p_rotina_tarefa_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_rotina_tarefa_update ON public.rotina_tarefa FOR UPDATE USING (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text))) WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text)));


--
-- Name: dicionario_rotulos p_rotulos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_rotulos_select ON public.dicionario_rotulos FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: tenant p_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_tenant_select ON public.tenant FOR SELECT USING ((id = privado.fn_tenant_atual()));


--
-- Name: app_usuario p_usuario_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_usuario_select ON public.app_usuario FOR SELECT USING (((id = auth.uid()) OR ((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text))));


--
-- Name: venda_pagamento p_venda_pagamento_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_venda_pagamento_select ON public.venda_pagamento FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: regua_execucao; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regua_execucao ENABLE ROW LEVEL SECURITY;

--
-- Name: rotina_categoria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rotina_categoria ENABLE ROW LEVEL SECURITY;

--
-- Name: rotina_tarefa; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rotina_tarefa ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant ENABLE ROW LEVEL SECURITY;

--
-- Name: venda; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.venda ENABLE ROW LEVEL SECURITY;

--
-- Name: venda venda_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY venda_ins ON public.venda FOR INSERT WITH CHECK ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: venda_nf; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.venda_nf ENABLE ROW LEVEL SECURITY;

--
-- Name: venda_nf venda_nf_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY venda_nf_ins ON public.venda_nf FOR INSERT TO authenticated WITH CHECK (((tenant_id = privado.fn_tenant_atual()) AND (EXISTS ( SELECT 1
   FROM public.venda v
  WHERE ((v.id = venda_nf.venda_id) AND (v.tenant_id = privado.fn_tenant_atual()))))));


--
-- Name: venda_nf venda_nf_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY venda_nf_sel ON public.venda_nf FOR SELECT TO authenticated USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: venda_pagamento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.venda_pagamento ENABLE ROW LEVEL SECURITY;

--
-- Name: venda venda_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY venda_sel ON public.venda FOR SELECT USING ((tenant_id = privado.fn_tenant_atual()));


--
-- Name: SCHEMA privado; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA privado TO authenticated;
GRANT USAGE ON SCHEMA privado TO service_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION fn_brl(p numeric); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_brl(p numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_brl(p numeric) TO authenticated;


--
-- Name: FUNCTION fn_cadencia_encerrar(p_lead_id uuid); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_cadencia_encerrar(p_lead_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_cadencia_encerrar(p_lead_id uuid) TO authenticated;


--
-- Name: FUNCTION fn_cadencia_reagendar(p_lead_id uuid, p_data date); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_cadencia_reagendar(p_lead_id uuid, p_data date) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_cadencia_reagendar(p_lead_id uuid, p_data date) TO authenticated;


--
-- Name: FUNCTION fn_cadencia_trocar_perfil(p_lead_id uuid, p_tenant uuid, p_perfil text, p_proximo date); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_cadencia_trocar_perfil(p_lead_id uuid, p_tenant uuid, p_perfil text, p_proximo date) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_cadencia_trocar_perfil(p_lead_id uuid, p_tenant uuid, p_perfil text, p_proximo date) TO authenticated;


--
-- Name: FUNCTION fn_cpf_valido(p_cpf text); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_cpf_valido(p_cpf text) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_cpf_valido(p_cpf text) TO authenticated;


--
-- Name: FUNCTION fn_fin_aplicar_regras(p_tenant uuid, p_regra_ids uuid[], p_mov_ids uuid[], p_alcance text); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_fin_aplicar_regras(p_tenant uuid, p_regra_ids uuid[], p_mov_ids uuid[], p_alcance text) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_fin_aplicar_regras(p_tenant uuid, p_regra_ids uuid[], p_mov_ids uuid[], p_alcance text) TO authenticated;


--
-- Name: FUNCTION fn_fin_casa(p_alvo_norm text, p_padrao text, p_tipo text); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_fin_casa(p_alvo_norm text, p_padrao text, p_tipo text) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_fin_casa(p_alvo_norm text, p_padrao text, p_tipo text) TO authenticated;


--
-- Name: FUNCTION fn_fin_cobertura(p_tenant uuid, p_ini date, p_fim date); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_fin_cobertura(p_tenant uuid, p_ini date, p_fim date) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_fin_cobertura(p_tenant uuid, p_ini date, p_fim date) TO authenticated;


--
-- Name: FUNCTION fn_fin_contraparte(t text); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_fin_contraparte(t text) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_fin_contraparte(t text) TO authenticated;


--
-- Name: FUNCTION fn_fin_cp_norm(t text); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_fin_cp_norm(t text) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_fin_cp_norm(t text) TO authenticated;


--
-- Name: FUNCTION fn_fin_esc(p text); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_fin_esc(p text) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_fin_esc(p text) TO authenticated;


--
-- Name: FUNCTION fn_fin_importacao_fechar(p_id uuid, p_lidas integer, p_novas integer, p_dup integer); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_fin_importacao_fechar(p_id uuid, p_lidas integer, p_novas integer, p_dup integer) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_fin_importacao_fechar(p_id uuid, p_lidas integer, p_novas integer, p_dup integer) TO authenticated;


--
-- Name: FUNCTION fn_fin_norm(t text); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_fin_norm(t text) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_fin_norm(t text) TO authenticated;


--
-- Name: FUNCTION fn_pagamentos_salvar(p_venda_id uuid, p_tenant uuid, p_itens jsonb); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_pagamentos_salvar(p_venda_id uuid, p_tenant uuid, p_itens jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_pagamentos_salvar(p_venda_id uuid, p_tenant uuid, p_itens jsonb) TO authenticated;


--
-- Name: FUNCTION fn_papel_atual(); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_papel_atual() FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_papel_atual() TO authenticated;
GRANT ALL ON FUNCTION privado.fn_papel_atual() TO service_role;


--
-- Name: FUNCTION fn_regua_desfecho(p_lead_id uuid, p_tenant uuid, p_perfil text, p_motivo text, p_dias integer); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_regua_desfecho(p_lead_id uuid, p_tenant uuid, p_perfil text, p_motivo text, p_dias integer) FROM PUBLIC;


--
-- Name: FUNCTION fn_tenant_atual(); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_tenant_atual() FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_tenant_atual() TO authenticated;
GRANT ALL ON FUNCTION privado.fn_tenant_atual() TO service_role;


--
-- Name: FUNCTION fn_venda_arquivar(p_id uuid, p_arquivar boolean); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_venda_arquivar(p_id uuid, p_arquivar boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_venda_arquivar(p_id uuid, p_arquivar boolean) TO authenticated;


--
-- Name: FUNCTION fn_venda_atualizar(p_id uuid, p_campos jsonb); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_venda_atualizar(p_id uuid, p_campos jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_venda_atualizar(p_id uuid, p_campos jsonb) TO authenticated;


--
-- Name: FUNCTION fn_venda_nf_numero(p_id uuid, p_numero text); Type: ACL; Schema: privado; Owner: -
--

REVOKE ALL ON FUNCTION privado.fn_venda_nf_numero(p_id uuid, p_numero text) FROM PUBLIC;
GRANT ALL ON FUNCTION privado.fn_venda_nf_numero(p_id uuid, p_numero text) TO authenticated;


--
-- Name: FUNCTION adicionar_tarefa(p_titulo text, p_categoria text, p_data date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.adicionar_tarefa(p_titulo text, p_categoria text, p_data date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.adicionar_tarefa(p_titulo text, p_categoria text, p_data date) TO authenticated;
GRANT ALL ON FUNCTION public.adicionar_tarefa(p_titulo text, p_categoria text, p_data date) TO service_role;


--
-- Name: FUNCTION anexar_nf(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.anexar_nf(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.anexar_nf(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.anexar_nf(payload jsonb) TO service_role;


--
-- Name: FUNCTION arquivar_lead(p_lead_id uuid, p_motivo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.arquivar_lead(p_lead_id uuid, p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.arquivar_lead(p_lead_id uuid, p_motivo text) TO authenticated;
GRANT ALL ON FUNCTION public.arquivar_lead(p_lead_id uuid, p_motivo text) TO service_role;


--
-- Name: FUNCTION arquivar_venda(p_id uuid, p_arquivar boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.arquivar_venda(p_id uuid, p_arquivar boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.arquivar_venda(p_id uuid, p_arquivar boolean) TO authenticated;
GRANT ALL ON FUNCTION public.arquivar_venda(p_id uuid, p_arquivar boolean) TO service_role;


--
-- Name: FUNCTION cadastrar_lead(p_nome text, p_whatsapp text, p_produto text, p_condicao text, p_perfil text, p_origem text, p_indicado_por text, p_observacoes text, p_upgrade_entrada boolean, p_aparelho_entrada text, p_consentimento boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cadastrar_lead(p_nome text, p_whatsapp text, p_produto text, p_condicao text, p_perfil text, p_origem text, p_indicado_por text, p_observacoes text, p_upgrade_entrada boolean, p_aparelho_entrada text, p_consentimento boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cadastrar_lead(p_nome text, p_whatsapp text, p_produto text, p_condicao text, p_perfil text, p_origem text, p_indicado_por text, p_observacoes text, p_upgrade_entrada boolean, p_aparelho_entrada text, p_consentimento boolean) TO authenticated;
GRANT ALL ON FUNCTION public.cadastrar_lead(p_nome text, p_whatsapp text, p_produto text, p_condicao text, p_perfil text, p_origem text, p_indicado_por text, p_observacoes text, p_upgrade_entrada boolean, p_aparelho_entrada text, p_consentimento boolean) TO service_role;


--
-- Name: FUNCTION captacao_do_dia(p_data date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.captacao_do_dia(p_data date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.captacao_do_dia(p_data date) TO authenticated;
GRANT ALL ON FUNCTION public.captacao_do_dia(p_data date) TO service_role;


--
-- Name: FUNCTION conteudo_periodo(p_ini date, p_fim date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.conteudo_periodo(p_ini date, p_fim date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.conteudo_periodo(p_ini date, p_fim date) TO authenticated;
GRANT ALL ON FUNCTION public.conteudo_periodo(p_ini date, p_fim date) TO service_role;


--
-- Name: FUNCTION criar_acao_escopo(p_frente text, p_titulo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.criar_acao_escopo(p_frente text, p_titulo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.criar_acao_escopo(p_frente text, p_titulo text) TO authenticated;
GRANT ALL ON FUNCTION public.criar_acao_escopo(p_frente text, p_titulo text) TO service_role;


--
-- Name: FUNCTION definir_meta_frente(p_frente text, p_meta text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.definir_meta_frente(p_frente text, p_meta text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.definir_meta_frente(p_frente text, p_meta text) TO authenticated;
GRANT ALL ON FUNCTION public.definir_meta_frente(p_frente text, p_meta text) TO service_role;


--
-- Name: FUNCTION definir_prioridade_acao(p_id uuid, p_prioridade text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.definir_prioridade_acao(p_id uuid, p_prioridade text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.definir_prioridade_acao(p_id uuid, p_prioridade text) TO authenticated;
GRANT ALL ON FUNCTION public.definir_prioridade_acao(p_id uuid, p_prioridade text) TO service_role;


--
-- Name: FUNCTION descartar_acao_escopo(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.descartar_acao_escopo(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.descartar_acao_escopo(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.descartar_acao_escopo(p_id uuid) TO service_role;


--
-- Name: FUNCTION desligar_motoboy(p_id uuid, p_desligar boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.desligar_motoboy(p_id uuid, p_desligar boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.desligar_motoboy(p_id uuid, p_desligar boolean) TO authenticated;
GRANT ALL ON FUNCTION public.desligar_motoboy(p_id uuid, p_desligar boolean) TO service_role;


--
-- Name: FUNCTION editar_lead(p_lead_id uuid, p_nome text, p_whatsapp text, p_produto text, p_condicao text, p_perfil text, p_origem text, p_indicado_por text, p_observacoes text, p_aparelho_entrada text, p_upgrade_entrada boolean, p_valor_oferta numeric, p_proximo_contato date, p_data_nascimento date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.editar_lead(p_lead_id uuid, p_nome text, p_whatsapp text, p_produto text, p_condicao text, p_perfil text, p_origem text, p_indicado_por text, p_observacoes text, p_aparelho_entrada text, p_upgrade_entrada boolean, p_valor_oferta numeric, p_proximo_contato date, p_data_nascimento date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.editar_lead(p_lead_id uuid, p_nome text, p_whatsapp text, p_produto text, p_condicao text, p_perfil text, p_origem text, p_indicado_por text, p_observacoes text, p_aparelho_entrada text, p_upgrade_entrada boolean, p_valor_oferta numeric, p_proximo_contato date, p_data_nascimento date) TO authenticated;
GRANT ALL ON FUNCTION public.editar_lead(p_lead_id uuid, p_nome text, p_whatsapp text, p_produto text, p_condicao text, p_perfil text, p_origem text, p_indicado_por text, p_observacoes text, p_aparelho_entrada text, p_upgrade_entrada boolean, p_valor_oferta numeric, p_proximo_contato date, p_data_nascimento date) TO service_role;


--
-- Name: FUNCTION editar_venda(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.editar_venda(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.editar_venda(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.editar_venda(payload jsonb) TO service_role;


--
-- Name: FUNCTION escopo_completo(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.escopo_completo() FROM PUBLIC;
GRANT ALL ON FUNCTION public.escopo_completo() TO authenticated;
GRANT ALL ON FUNCTION public.escopo_completo() TO service_role;


--
-- Name: FUNCTION fin_classificar(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_classificar(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_classificar(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fin_classificar(payload jsonb) TO service_role;


--
-- Name: FUNCTION fin_cobertura(p_ini date, p_fim date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_cobertura(p_ini date, p_fim date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_cobertura(p_ini date, p_fim date) TO authenticated;
GRANT ALL ON FUNCTION public.fin_cobertura(p_ini date, p_fim date) TO service_role;


--
-- Name: FUNCTION fin_config(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_config() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_config() TO authenticated;
GRANT ALL ON FUNCTION public.fin_config() TO service_role;


--
-- Name: FUNCTION fin_importar_extrato(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_importar_extrato(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_importar_extrato(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fin_importar_extrato(payload jsonb) TO service_role;


--
-- Name: FUNCTION fin_lancar(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_lancar(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_lancar(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fin_lancar(payload jsonb) TO service_role;


--
-- Name: FUNCTION fin_movimentos(p_ini date, p_fim date, p_dominio text, p_status text, p_ordem text, p_contraparte text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_movimentos(p_ini date, p_fim date, p_dominio text, p_status text, p_ordem text, p_contraparte text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_movimentos(p_ini date, p_fim date, p_dominio text, p_status text, p_ordem text, p_contraparte text) TO authenticated;
GRANT ALL ON FUNCTION public.fin_movimentos(p_ini date, p_fim date, p_dominio text, p_status text, p_ordem text, p_contraparte text) TO service_role;


--
-- Name: FUNCTION fin_painel(p_ini date, p_fim date, p_dominio text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_painel(p_ini date, p_fim date, p_dominio text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_painel(p_ini date, p_fim date, p_dominio text) TO authenticated;
GRANT ALL ON FUNCTION public.fin_painel(p_ini date, p_fim date, p_dominio text) TO service_role;


--
-- Name: FUNCTION fin_regra_aplicar(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_regra_aplicar(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_regra_aplicar(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fin_regra_aplicar(payload jsonb) TO service_role;


--
-- Name: FUNCTION fin_regra_prever(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_regra_prever(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_regra_prever(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fin_regra_prever(payload jsonb) TO service_role;


--
-- Name: FUNCTION fin_regra_salvar(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_regra_salvar(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_regra_salvar(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fin_regra_salvar(payload jsonb) TO service_role;


--
-- Name: FUNCTION fin_regra_sugerir(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_regra_sugerir(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_regra_sugerir(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fin_regra_sugerir(payload jsonb) TO service_role;


--
-- Name: FUNCTION fin_regras(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_regras() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_regras() TO authenticated;
GRANT ALL ON FUNCTION public.fin_regras() TO service_role;


--
-- Name: FUNCTION fin_repasse_desmarcar(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_repasse_desmarcar(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_repasse_desmarcar(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fin_repasse_desmarcar(payload jsonb) TO service_role;


--
-- Name: FUNCTION fin_repasse_marcar(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_repasse_marcar(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_repasse_marcar(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fin_repasse_marcar(payload jsonb) TO service_role;


--
-- Name: FUNCTION fn_auditar(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fn_auditar() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_auditar() TO service_role;


--
-- Name: FUNCTION fn_conteudo_disparar_sync(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fn_conteudo_disparar_sync() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_conteudo_disparar_sync() TO service_role;


--
-- Name: FUNCTION fn_regua_varredura(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fn_regua_varredura() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_regua_varredura() TO service_role;


--
-- Name: FUNCTION fn_rotina_semear(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fn_rotina_semear() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_rotina_semear() TO service_role;


--
-- Name: FUNCTION fn_touch_atualizado_em(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fn_touch_atualizado_em() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fn_touch_atualizado_em() TO service_role;


--
-- Name: FUNCTION historico_lead(p_lead_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.historico_lead(p_lead_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.historico_lead(p_lead_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.historico_lead(p_lead_id uuid) TO service_role;


--
-- Name: FUNCTION marcar_lembrete(p_lembrete_id uuid, p_feito boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.marcar_lembrete(p_lembrete_id uuid, p_feito boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.marcar_lembrete(p_lembrete_id uuid, p_feito boolean) TO authenticated;
GRANT ALL ON FUNCTION public.marcar_lembrete(p_lembrete_id uuid, p_feito boolean) TO service_role;


--
-- Name: FUNCTION marcar_tarefa(p_tarefa_id uuid, p_concluida boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.marcar_tarefa(p_tarefa_id uuid, p_concluida boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.marcar_tarefa(p_tarefa_id uuid, p_concluida boolean) TO authenticated;
GRANT ALL ON FUNCTION public.marcar_tarefa(p_tarefa_id uuid, p_concluida boolean) TO service_role;


--
-- Name: FUNCTION molde_semana(p_ref date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.molde_semana(p_ref date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.molde_semana(p_ref date) TO authenticated;
GRANT ALL ON FUNCTION public.molde_semana(p_ref date) TO service_role;


--
-- Name: FUNCTION mover_etapa_venda(p_id uuid, p_etapa text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mover_etapa_venda(p_id uuid, p_etapa text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mover_etapa_venda(p_id uuid, p_etapa text) TO authenticated;
GRANT ALL ON FUNCTION public.mover_etapa_venda(p_id uuid, p_etapa text) TO service_role;


--
-- Name: FUNCTION mudar_status_acao_escopo(p_id uuid, p_status text, p_motivo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mudar_status_acao_escopo(p_id uuid, p_status text, p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mudar_status_acao_escopo(p_id uuid, p_status text, p_motivo text) TO authenticated;
GRANT ALL ON FUNCTION public.mudar_status_acao_escopo(p_id uuid, p_status text, p_motivo text) TO service_role;


--
-- Name: FUNCTION painel_do_dia(p_data date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.painel_do_dia(p_data date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.painel_do_dia(p_data date) TO authenticated;
GRANT ALL ON FUNCTION public.painel_do_dia(p_data date) TO service_role;


--
-- Name: FUNCTION painel_metricas(p_ini date, p_fim date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.painel_metricas(p_ini date, p_fim date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.painel_metricas(p_ini date, p_fim date) TO authenticated;
GRANT ALL ON FUNCTION public.painel_metricas(p_ini date, p_fim date) TO service_role;


--
-- Name: FUNCTION placar_captacao(p_data date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.placar_captacao(p_data date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.placar_captacao(p_data date) TO authenticated;
GRANT ALL ON FUNCTION public.placar_captacao(p_data date) TO service_role;


--
-- Name: FUNCTION puxar_rotina(p_data date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.puxar_rotina(p_data date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.puxar_rotina(p_data date) TO authenticated;
GRANT ALL ON FUNCTION public.puxar_rotina(p_data date) TO service_role;


--
-- Name: FUNCTION reagendar_proximo_contato(p_lead_id uuid, p_data date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reagendar_proximo_contato(p_lead_id uuid, p_data date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reagendar_proximo_contato(p_lead_id uuid, p_data date) TO authenticated;
GRANT ALL ON FUNCTION public.reagendar_proximo_contato(p_lead_id uuid, p_data date) TO service_role;


--
-- Name: FUNCTION registrar_captacao(p_frente text, p_identificador text, p_nome text, p_observacoes text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_captacao(p_frente text, p_identificador text, p_nome text, p_observacoes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_captacao(p_frente text, p_identificador text, p_nome text, p_observacoes text) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_captacao(p_frente text, p_identificador text, p_nome text, p_observacoes text) TO service_role;


--
-- Name: FUNCTION registrar_conversando(p_lead_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_conversando(p_lead_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_conversando(p_lead_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_conversando(p_lead_id uuid) TO service_role;


--
-- Name: FUNCTION registrar_desfecho(p_lead_id uuid, p_tipo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_desfecho(p_lead_id uuid, p_tipo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_desfecho(p_lead_id uuid, p_tipo text) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_desfecho(p_lead_id uuid, p_tipo text) TO service_role;


--
-- Name: FUNCTION registrar_falha_molde(p_tenant_id uuid, p_origem text, p_msg text, p_duracao_ms integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_falha_molde(p_tenant_id uuid, p_origem text, p_msg text, p_duracao_ms integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_falha_molde(p_tenant_id uuid, p_origem text, p_msg text, p_duracao_ms integer) TO service_role;


--
-- Name: FUNCTION registrar_falha_sync(p_tenant_id uuid, p_origem text, p_msg text, p_duracao_ms integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_falha_sync(p_tenant_id uuid, p_origem text, p_msg text, p_duracao_ms integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_falha_sync(p_tenant_id uuid, p_origem text, p_msg text, p_duracao_ms integer) TO service_role;


--
-- Name: FUNCTION registrar_metrica_conteudo(p_conteudo_id uuid, p_alcance integer, p_conversas integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_metrica_conteudo(p_conteudo_id uuid, p_alcance integer, p_conversas integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_metrica_conteudo(p_conteudo_id uuid, p_alcance integer, p_conversas integer) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_metrica_conteudo(p_conteudo_id uuid, p_alcance integer, p_conversas integer) TO service_role;


--
-- Name: FUNCTION registrar_nota(p_lead_id uuid, p_texto text, p_data date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_nota(p_lead_id uuid, p_texto text, p_data date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_nota(p_lead_id uuid, p_texto text, p_data date) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_nota(p_lead_id uuid, p_texto text, p_data date) TO service_role;


--
-- Name: FUNCTION registrar_opt_out(p_captacao_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_opt_out(p_captacao_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_opt_out(p_captacao_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_opt_out(p_captacao_id uuid) TO service_role;


--
-- Name: FUNCTION registrar_resposta(p_lead_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_resposta(p_lead_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_resposta(p_lead_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_resposta(p_lead_id uuid) TO service_role;


--
-- Name: FUNCTION registrar_toque(p_lead_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_toque(p_lead_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_toque(p_lead_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_toque(p_lead_id uuid) TO service_role;


--
-- Name: FUNCTION registrar_venda(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_venda(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_venda(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_venda(payload jsonb) TO service_role;


--
-- Name: FUNCTION remover_lembrete(p_lembrete_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remover_lembrete(p_lembrete_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remover_lembrete(p_lembrete_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.remover_lembrete(p_lembrete_id uuid) TO service_role;


--
-- Name: FUNCTION remover_nf(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remover_nf(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remover_nf(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.remover_nf(p_id uuid) TO service_role;


--
-- Name: FUNCTION remover_rotina_tarefa(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remover_rotina_tarefa(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remover_rotina_tarefa(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.remover_rotina_tarefa(p_id uuid) TO service_role;


--
-- Name: FUNCTION remover_tarefa(p_tarefa_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remover_tarefa(p_tarefa_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remover_tarefa(p_tarefa_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.remover_tarefa(p_tarefa_id uuid) TO service_role;


--
-- Name: FUNCTION rotina_completa(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rotina_completa() FROM PUBLIC;
GRANT ALL ON FUNCTION public.rotina_completa() TO authenticated;
GRANT ALL ON FUNCTION public.rotina_completa() TO service_role;


--
-- Name: FUNCTION salvar_identidade(p_lead_id uuid, payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.salvar_identidade(p_lead_id uuid, payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.salvar_identidade(p_lead_id uuid, payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.salvar_identidade(p_lead_id uuid, payload jsonb) TO service_role;


--
-- Name: FUNCTION salvar_lembrete(p_texto text, p_data date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.salvar_lembrete(p_texto text, p_data date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.salvar_lembrete(p_texto text, p_data date) TO authenticated;
GRANT ALL ON FUNCTION public.salvar_lembrete(p_texto text, p_data date) TO service_role;


--
-- Name: FUNCTION salvar_motoboy(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.salvar_motoboy(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.salvar_motoboy(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.salvar_motoboy(payload jsonb) TO service_role;


--
-- Name: FUNCTION salvar_nota(p_texto text, p_data date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.salvar_nota(p_texto text, p_data date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.salvar_nota(p_texto text, p_data date) TO authenticated;
GRANT ALL ON FUNCTION public.salvar_nota(p_texto text, p_data date) TO service_role;


--
-- Name: FUNCTION salvar_pagamentos(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.salvar_pagamentos(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.salvar_pagamentos(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.salvar_pagamentos(payload jsonb) TO service_role;


--
-- Name: FUNCTION salvar_rotina_categoria(p_codigo text, p_rotulo text, p_ordem integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.salvar_rotina_categoria(p_codigo text, p_rotulo text, p_ordem integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.salvar_rotina_categoria(p_codigo text, p_rotulo text, p_ordem integer) TO authenticated;
GRANT ALL ON FUNCTION public.salvar_rotina_categoria(p_codigo text, p_rotulo text, p_ordem integer) TO service_role;


--
-- Name: FUNCTION salvar_rotina_tarefa(p_titulo text, p_categoria text, p_dias_semana smallint[], p_id uuid, p_ordem integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.salvar_rotina_tarefa(p_titulo text, p_categoria text, p_dias_semana smallint[], p_id uuid, p_ordem integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.salvar_rotina_tarefa(p_titulo text, p_categoria text, p_dias_semana smallint[], p_id uuid, p_ordem integer) TO authenticated;
GRANT ALL ON FUNCTION public.salvar_rotina_tarefa(p_titulo text, p_categoria text, p_dias_semana smallint[], p_id uuid, p_ordem integer) TO service_role;


--
-- Name: FUNCTION sincronizar_conteudo(p_tenant_id uuid, p_fonte text, p_paginas jsonb, p_janela_ini date, p_janela_fim date, p_completo boolean, p_origem text, p_duracao_ms integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sincronizar_conteudo(p_tenant_id uuid, p_fonte text, p_paginas jsonb, p_janela_ini date, p_janela_fim date, p_completo boolean, p_origem text, p_duracao_ms integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sincronizar_conteudo(p_tenant_id uuid, p_fonte text, p_paginas jsonb, p_janela_ini date, p_janela_fim date, p_completo boolean, p_origem text, p_duracao_ms integer) TO service_role;


--
-- Name: FUNCTION sincronizar_molde(p_tenant_id uuid, p_payload jsonb, p_block_id text, p_origem text, p_duracao_ms integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sincronizar_molde(p_tenant_id uuid, p_payload jsonb, p_block_id text, p_origem text, p_duracao_ms integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sincronizar_molde(p_tenant_id uuid, p_payload jsonb, p_block_id text, p_origem text, p_duracao_ms integer) TO service_role;


--
-- Name: FUNCTION sugerir_mensagem(p_lead_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sugerir_mensagem(p_lead_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sugerir_mensagem(p_lead_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.sugerir_mensagem(p_lead_id uuid) TO service_role;


--
-- Name: TABLE app_usuario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.app_usuario TO service_role;
GRANT SELECT ON TABLE public.app_usuario TO authenticated;


--
-- Name: TABLE auditoria; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.auditoria TO service_role;
GRANT SELECT ON TABLE public.auditoria TO authenticated;


--
-- Name: SEQUENCE auditoria_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.auditoria_id_seq TO service_role;


--
-- Name: TABLE cadencia_estado; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cadencia_estado TO service_role;
GRANT SELECT ON TABLE public.cadencia_estado TO authenticated;


--
-- Name: TABLE cadencia_perfil; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cadencia_perfil TO service_role;
GRANT SELECT ON TABLE public.cadencia_perfil TO authenticated;


--
-- Name: TABLE cadencia_regra; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cadencia_regra TO service_role;
GRANT SELECT ON TABLE public.cadencia_regra TO authenticated;


--
-- Name: TABLE calc_dados; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.calc_dados TO service_role;
GRANT SELECT ON TABLE public.calc_dados TO authenticated;


--
-- Name: TABLE captacao; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.captacao TO authenticated;
GRANT ALL ON TABLE public.captacao TO service_role;


--
-- Name: TABLE captacao_frente; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.captacao_frente TO authenticated;
GRANT ALL ON TABLE public.captacao_frente TO service_role;


--
-- Name: TABLE captacao_meta; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.captacao_meta TO authenticated;
GRANT ALL ON TABLE public.captacao_meta TO service_role;


--
-- Name: COLUMN captacao_meta.alvo; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(alvo) ON TABLE public.captacao_meta TO authenticated;


--
-- Name: COLUMN captacao_meta.ativo; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(ativo) ON TABLE public.captacao_meta TO authenticated;


--
-- Name: COLUMN captacao_meta.atualizado_em; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(atualizado_em) ON TABLE public.captacao_meta TO authenticated;


--
-- Name: TABLE catalogo_iphone; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.catalogo_iphone TO authenticated;
GRANT ALL ON TABLE public.catalogo_iphone TO service_role;


--
-- Name: TABLE conteudo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conteudo TO service_role;
GRANT SELECT ON TABLE public.conteudo TO authenticated;


--
-- Name: TABLE conteudo_fonte; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conteudo_fonte TO service_role;
GRANT SELECT ON TABLE public.conteudo_fonte TO authenticated;


--
-- Name: TABLE conteudo_metrica; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conteudo_metrica TO service_role;
GRANT SELECT,INSERT ON TABLE public.conteudo_metrica TO authenticated;


--
-- Name: TABLE conteudo_molde; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conteudo_molde TO service_role;
GRANT SELECT ON TABLE public.conteudo_molde TO authenticated;


--
-- Name: TABLE conteudo_sync_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conteudo_sync_log TO service_role;
GRANT SELECT ON TABLE public.conteudo_sync_log TO authenticated;


--
-- Name: SEQUENCE conteudo_sync_log_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.conteudo_sync_log_id_seq TO service_role;


--
-- Name: TABLE dia_lembrete; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dia_lembrete TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.dia_lembrete TO authenticated;


--
-- Name: TABLE dia_nota; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dia_nota TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.dia_nota TO authenticated;


--
-- Name: TABLE dia_tarefa; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dia_tarefa TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.dia_tarefa TO authenticated;


--
-- Name: TABLE dicionario_rotulos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dicionario_rotulos TO service_role;
GRANT SELECT ON TABLE public.dicionario_rotulos TO authenticated;


--
-- Name: TABLE dicionario_scripts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dicionario_scripts TO service_role;
GRANT SELECT ON TABLE public.dicionario_scripts TO authenticated;


--
-- Name: TABLE escopo_acao; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.escopo_acao TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.escopo_acao TO authenticated;


--
-- Name: TABLE escopo_acao_evento; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.escopo_acao_evento TO service_role;
GRANT SELECT,INSERT ON TABLE public.escopo_acao_evento TO authenticated;


--
-- Name: TABLE escopo_frente; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.escopo_frente TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.escopo_frente TO authenticated;


--
-- Name: TABLE escopo_frente_evento; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.escopo_frente_evento TO service_role;
GRANT SELECT,INSERT ON TABLE public.escopo_frente_evento TO authenticated;


--
-- Name: TABLE evento_uso; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.evento_uso TO service_role;
GRANT SELECT,INSERT ON TABLE public.evento_uso TO authenticated;


--
-- Name: TABLE fin_categoria; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.fin_categoria TO authenticated;
GRANT ALL ON TABLE public.fin_categoria TO service_role;


--
-- Name: TABLE fin_conta; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.fin_conta TO authenticated;
GRANT ALL ON TABLE public.fin_conta TO service_role;


--
-- Name: TABLE fin_importacao; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.fin_importacao TO authenticated;
GRANT ALL ON TABLE public.fin_importacao TO service_role;


--
-- Name: TABLE fin_movimento; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.fin_movimento TO authenticated;
GRANT ALL ON TABLE public.fin_movimento TO service_role;


--
-- Name: TABLE fin_regra; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.fin_regra TO authenticated;
GRANT ALL ON TABLE public.fin_regra TO service_role;


--
-- Name: TABLE lead; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lead TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.lead TO authenticated;


--
-- Name: TABLE lead_evento; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lead_evento TO service_role;
GRANT SELECT,INSERT ON TABLE public.lead_evento TO authenticated;


--
-- Name: TABLE motoboy; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.motoboy TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.motoboy TO authenticated;


--
-- Name: TABLE regua_execucao; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.regua_execucao TO service_role;
GRANT SELECT ON TABLE public.regua_execucao TO authenticated;


--
-- Name: SEQUENCE regua_execucao_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.regua_execucao_id_seq TO service_role;


--
-- Name: TABLE rotina_categoria; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rotina_categoria TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.rotina_categoria TO authenticated;


--
-- Name: TABLE rotina_tarefa; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rotina_tarefa TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.rotina_tarefa TO authenticated;


--
-- Name: TABLE tenant; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tenant TO service_role;
GRANT SELECT ON TABLE public.tenant TO authenticated;


--
-- Name: TABLE v_catalogo_venda; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_catalogo_venda TO authenticated;
GRANT ALL ON TABLE public.v_catalogo_venda TO service_role;


--
-- Name: TABLE venda; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.venda TO authenticated;
GRANT ALL ON TABLE public.venda TO service_role;


--
-- Name: TABLE v_cliente; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_cliente TO authenticated;
GRANT ALL ON TABLE public.v_cliente TO service_role;


--
-- Name: TABLE v_conteudo_fonte; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_conteudo_fonte TO service_role;
GRANT SELECT ON TABLE public.v_conteudo_fonte TO authenticated;


--
-- Name: TABLE v_lead; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_lead TO service_role;
GRANT SELECT ON TABLE public.v_lead TO authenticated;


--
-- Name: TABLE v_trafego_atribuicao; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_trafego_atribuicao TO authenticated;
GRANT ALL ON TABLE public.v_trafego_atribuicao TO service_role;


--
-- Name: TABLE v_venda; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_venda TO authenticated;
GRANT ALL ON TABLE public.v_venda TO service_role;


--
-- Name: TABLE venda_nf; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.venda_nf TO service_role;
GRANT SELECT,INSERT ON TABLE public.venda_nf TO authenticated;


--
-- Name: TABLE v_venda_nf; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_venda_nf TO service_role;
GRANT SELECT ON TABLE public.v_venda_nf TO authenticated;


--
-- Name: TABLE venda_pagamento; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.venda_pagamento TO authenticated;
GRANT ALL ON TABLE public.venda_pagamento TO service_role;


--
-- Name: TABLE v_venda_pagamento; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_venda_pagamento TO authenticated;
GRANT ALL ON TABLE public.v_venda_pagamento TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict bN5QXAEXoSTeFWLvSKt4d7CcHEKI8CSeuu3NwB1YMfekF2dlxX2yo2NZIWzbtfQ

