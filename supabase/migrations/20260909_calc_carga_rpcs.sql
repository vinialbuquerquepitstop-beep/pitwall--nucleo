-- Bloco 2.2 — as tres RPCs da carga.
--
-- Restricao global 1 do plano: `tenant_id` vem SEMPRE de
-- privado.fn_tenant_atual() dentro da funcao, NUNCA do payload do cliente.
-- E a unica regra que impede o lojista A gravar no blob do B.
--
-- Todas SECURITY DEFINER com search_path fixo, e todas exigem papel `dono`:
-- carga mexe em custo de fornecedor, que o vendedor nao ve.

-- `texto_bruto` guarda a lista colada ENQUANTO a carga esta em rascunho, porque
-- calc_pendencia_resolver precisa reprocessar contra o catalogo recem-ensinado.
-- Retencao declarada: e apagado no momento em que a carga e aprovada ou
-- descartada, e so o papel `dono` do proprio tenant enxerga. Nao vai para o
-- repo nem para bucket publico.
alter table public.calc_carga add column if not exists texto_bruto text;

-- ── 1. ABRIR ────────────────────────────────────────────────────────────────
create or replace function public.calc_carga_abrir(p_texto text)
returns uuid language plpgsql security definer set search_path = '' as $fn$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_papel  text := privado.fn_papel_atual();
  v_parse  jsonb;
  v_atual  jsonb;
  v_novos  jsonb;
  v_lidos  text[];
  v_antigos jsonb;
  v_carga  uuid;
begin
  if v_tenant is null or v_papel <> 'dono' then
    raise exception 'calc_carga_abrir: so o papel dono abre carga';
  end if;
  if coalesce(btrim(p_texto),'') = '' then
    raise exception 'calc_carga_abrir: texto vazio';
  end if;

  v_parse := privado.calc_parse(v_tenant, p_texto);
  v_novos := coalesce(v_parse->'produtos', '[]'::jsonb);

  select dados into v_atual from public.calc_dados where tenant_id = v_tenant;

  -- Fornecedor que NAO apareceu nesta rodada nao e apagado nem apresentado
  -- como atual (trava 4 do procedimento): as linhas antigas dele seguem no
  -- blob e o diff da tela mostra "sem lista nova".
  select coalesce(array_agg(distinct p->>'f'), '{}'::text[])
    into v_lidos
    from jsonb_array_elements(v_novos) p;

  select coalesce(jsonb_agg(p), '[]'::jsonb)
    into v_antigos
    from jsonb_array_elements(coalesce(v_atual->'produtos','[]'::jsonb)) p
   where not (p->>'f' = any(v_lidos));

  insert into public.calc_carga (
    tenant_id, status, origem, texto_bruto, blob_proposto, resumo,
    n_lidas, n_casou, n_duvidoso, n_descarte, n_pendencia)
  values (
    v_tenant, 'rascunho', 'colado', p_texto,
    jsonb_build_object(
      -- config, bateria e tela vem INTEIROS do blob atual: as margens moram no
      -- config e o validador exige bateria e tela como array.
      'config',  coalesce(v_atual->'config',  '{}'::jsonb),
      'bateria', coalesce(v_atual->'bateria', '[]'::jsonb),
      'tela',    coalesce(v_atual->'tela',    '[]'::jsonb),
      'produtos', v_novos || v_antigos),
    jsonb_build_object(
      'cabecalhos', coalesce(v_parse->'cabecalhos','[]'::jsonb),
      'descartes',  coalesce(v_parse->'descartes','[]'::jsonb),
      'cobertura',  v_parse->'cobertura',
      'fornecedores_lidos', to_jsonb(v_lidos),
      'produtos_novos',     jsonb_array_length(v_novos),
      'produtos_mantidos',  jsonb_array_length(v_antigos)),
    (v_parse->>'n_lidas')::int,
    (v_parse->>'n_casou')::int,
    (v_parse->>'n_duvidoso')::int,
    (v_parse->>'n_descarte')::int,
    (v_parse->>'n_pendencia')::int)
  returning id into v_carga;

  insert into public.calc_pendencia (tenant_id, carga_id, causa, tipo, texto, n_linhas, exemplo)
  select v_tenant, v_carga, p->>'causa', p->>'tipo', p->>'texto',
         (p->>'n_linhas')::int, p->>'exemplo'
    from jsonb_array_elements(coalesce(v_parse->'pendencias','[]'::jsonb)) p
  on conflict (carga_id, tipo, texto) do nothing;

  return v_carga;
end;
$fn$;

-- ── 2. RESOLVER ─────────────────────────────────────────────────────────────
-- E o laco de aprendizado, e o coracao do produto: resolver pendencia ESCREVE
-- no catalogo do tenant. Sem essa escrita a mesma pendencia volta no mes
-- seguinte e o cliente paga a mesma curva para sempre.
create or replace function public.calc_pendencia_resolver(
  p_pendencia uuid, p_decisao text, p_aponta text default null)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_papel  text := privado.fn_papel_atual();
  v_p      public.calc_pendencia%rowtype;
  v_txt    text;
  v_parse  jsonb;
  v_novos  jsonb;
  v_antigos jsonb;
  v_lidos  text[];
begin
  if v_tenant is null or v_papel <> 'dono' then
    raise exception 'calc_pendencia_resolver: so o papel dono resolve pendencia';
  end if;
  if p_decisao not in ('apontar','descartar','ignorar') then
    raise exception 'calc_pendencia_resolver: decisao invalida: %', p_decisao;
  end if;

  select * into v_p from public.calc_pendencia
   where id = p_pendencia and tenant_id = v_tenant;
  if not found then
    raise exception 'calc_pendencia_resolver: pendencia nao encontrada neste tenant';
  end if;

  if p_decisao = 'apontar' then
    if coalesce(btrim(p_aponta),'') = '' then
      raise exception 'calc_pendencia_resolver: apontar exige o destino';
    end if;
    if v_p.tipo not in ('modelo','cor','fornecedor','condicao') then
      raise exception 'calc_pendencia_resolver: tipo % nao se ensina por apelido', v_p.tipo;
    end if;
    -- O apelido aponta para o CODIGO, nunca para o rotulo (invariante 12).
    insert into public.calc_alias (tenant_id, tipo, texto, aponta)
    values (v_tenant, v_p.tipo, v_p.texto, p_aponta);

  elsif p_decisao = 'descartar' then
    -- Descarte permanente: a proxima carga ja nao traz esta linha.
    insert into public.calc_regra (tenant_id, tipo, padrao, acao, motivo, prioridade)
    values (v_tenant, 'descarte',
            regexp_replace(lower(v_p.texto), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g'),
            'descartar',
            'aprendido ao resolver pendencia em ' ||
              to_char((now() at time zone 'America/Sao_Paulo')::date, 'DD/MM/YYYY'),
            100);
  end if;

  update public.calc_pendencia
     set decisao = p_decisao, aponta = p_aponta,
         decidido_em = now()
   where id = p_pendencia;

  -- Reprocessa a carga contra o catalogo recem-ensinado, para o dono ver a
  -- cobertura subir na hora em vez de so no mes que vem.
  select texto_bruto into v_txt from public.calc_carga
   where id = v_p.carga_id and tenant_id = v_tenant and status = 'rascunho';

  if v_txt is null then
    return jsonb_build_object('reprocessou', false,
                              'motivo', 'a carga nao esta mais em rascunho');
  end if;

  v_parse := privado.calc_parse(v_tenant, v_txt);
  v_novos := coalesce(v_parse->'produtos', '[]'::jsonb);

  select coalesce(array_agg(distinct p->>'f'), '{}'::text[])
    into v_lidos
    from jsonb_array_elements(v_novos) p;

  -- Fornecedor sem lista nova segue no blob (trava 4), igual ao abrir.
  select coalesce(jsonb_agg(p), '[]'::jsonb)
    into v_antigos
    from public.calc_carga c, jsonb_array_elements(c.blob_proposto->'produtos') p
   where c.id = v_p.carga_id
     and not (p->>'f' = any(v_lidos));

  update public.calc_carga c
     set n_lidas    = (v_parse->>'n_lidas')::int,
         n_casou    = (v_parse->>'n_casou')::int,
         n_duvidoso = (v_parse->>'n_duvidoso')::int,
         n_descarte = (v_parse->>'n_descarte')::int,
         n_pendencia= (v_parse->>'n_pendencia')::int,
         blob_proposto = jsonb_set(c.blob_proposto, '{produtos}', v_novos || v_antigos),
         resumo = c.resumo
                  || jsonb_build_object('cobertura', v_parse->'cobertura',
                                        'cabecalhos', coalesce(v_parse->'cabecalhos','[]'::jsonb),
                                        'descartes',  coalesce(v_parse->'descartes','[]'::jsonb))
   where c.id = v_p.carga_id;

  -- Pendencia nova que o reprocesso revelou entra; a que sumiu fica com a
  -- decisao registrada (historico e append-only, invariante 6).
  insert into public.calc_pendencia (tenant_id, carga_id, causa, tipo, texto, n_linhas, exemplo)
  select v_tenant, v_p.carga_id, p->>'causa', p->>'tipo', p->>'texto',
         (p->>'n_linhas')::int, p->>'exemplo'
    from jsonb_array_elements(coalesce(v_parse->'pendencias','[]'::jsonb)) p
  on conflict (carga_id, tipo, texto) do nothing;

  return jsonb_build_object('reprocessou', true,
                            'cobertura', v_parse->'cobertura',
                            'n_casou',   v_parse->'n_casou',
                            'n_lidas',   v_parse->'n_lidas');
end;
$fn$;

-- ── 3. APROVAR ──────────────────────────────────────────────────────────────
-- Valida, grava calc_dados e fecha a carga, tudo na MESMA transacao.
--
-- CORRECAO DO PLANO, medida em 09/09/2026: o plano manda esta RPC "derivar e
-- gravar calc_venda". `calc_venda` NAO EXISTE — o consultor ainda le o
-- `dados.js` estatico do repo, e a tabela nasce no Bloco 3 ("o consultor sai do
-- repo"). A derivacao entra aqui quando a tabela existir; ate la, aprovar grava
-- custo e so.
create or replace function public.calc_carga_aprovar(p_carga uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_papel  text := privado.fn_papel_atual();
  v_c      public.calc_carga%rowtype;
  v_blob   jsonb;
  v_esp_produtos int;
  v_esp_precos   int;
  v_esp_soma     numeric;
  v_produtos     int;
  v_precos       int;
  v_soma         numeric;
  v_abertas      int;
begin
  if v_tenant is null or v_papel <> 'dono' then
    raise exception 'calc_carga_aprovar: so o papel dono aprova carga';
  end if;

  select * into v_c from public.calc_carga
   where id = p_carga and tenant_id = v_tenant;
  if not found then
    raise exception 'calc_carga_aprovar: carga nao encontrada neste tenant';
  end if;
  if v_c.status <> 'rascunho' then
    raise exception 'calc_carga_aprovar: carga ja esta %', v_c.status;
  end if;

  v_blob := v_c.blob_proposto;
  if v_blob is null or jsonb_array_length(coalesce(v_blob->'produtos','[]'::jsonb)) = 0 then
    raise exception 'calc_carga_aprovar: blob proposto vazio, nada a gravar';
  end if;

  -- Pendencia aberta nao bloqueia, mas o numero volta para a tela dizer.
  select count(*) into v_abertas from public.calc_pendencia
   where carga_id = p_carga and decidido_em is null;

  -- ── Os tres esperados saem do blob ANTES da escrita ──────────────────────
  v_esp_produtos := jsonb_array_length(v_blob->'produtos');

  select count(*)::int, coalesce(sum(v),0)
    into v_esp_precos, v_esp_soma
    from (
      select (p->>'v')::numeric as v
        from jsonb_array_elements(v_blob->'produtos') p
       where p ? 'v'
      union all
      select (c->>'v')::numeric
        from jsonb_array_elements(v_blob->'produtos') p,
             jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
    ) s;

  if v_esp_precos = 0 then
    raise exception 'calc_carga_aprovar: blob sem preco nenhum';
  end if;

  -- ── Escrita ──────────────────────────────────────────────────────────────
  insert into public.calc_dados (tenant_id, dados, atualizado_em)
  values (v_tenant, v_blob, now())
  on conflict (tenant_id) do update
     set dados = excluded.dados, atualizado_em = now();

  -- ── Trava de tres numeros, RELIDA do que ficou gravado ───────────────────
  -- Em BLOCO, nunca inline: `case when ok then true else (select 1/0) end` nao
  -- funciona, o Postgres dobra 1/0 em tempo de planejamento e reprova carga
  -- correta.
  select jsonb_array_length(d.dados->'produtos') into v_produtos
    from public.calc_dados d where d.tenant_id = v_tenant;

  select count(*)::int, coalesce(sum(v),0)
    into v_precos, v_soma
    from (
      select (p->>'v')::numeric as v
        from public.calc_dados d, jsonb_array_elements(d.dados->'produtos') p
       where d.tenant_id = v_tenant and p ? 'v'
      union all
      select (c->>'v')::numeric
        from public.calc_dados d,
             jsonb_array_elements(d.dados->'produtos') p,
             jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
       where d.tenant_id = v_tenant
    ) s;

  if v_produtos <> v_esp_produtos then
    raise exception 'guarda produtos: gravou %, esperava %', v_produtos, v_esp_produtos;
  end if;
  if v_precos <> v_esp_precos then
    raise exception 'guarda precos: gravou %, esperava %', v_precos, v_esp_precos;
  end if;
  if v_soma <> v_esp_soma then
    raise exception 'guarda soma: gravou %, esperava %', v_soma, v_esp_soma;
  end if;

  -- ── Fecha a carga e joga fora a lista bruta ──────────────────────────────
  update public.calc_carga
     set status = 'aprovada', aprovado_por = auth.uid(), aprovado_em = now(),
         texto_bruto = null
   where id = p_carga;

  return jsonb_build_object(
    'carga', p_carga, 'produtos', v_produtos, 'precos', v_precos,
    'soma', v_soma, 'pendencias_abertas', v_abertas);
end;
$fn$;

-- ── 4. DESCARTAR ────────────────────────────────────────────────────────────
-- Sem isso a lista bruta de uma carga abandonada fica no banco para sempre.
create or replace function public.calc_carga_descartar(p_carga uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
declare
  v_tenant uuid := privado.fn_tenant_atual();
begin
  if v_tenant is null or privado.fn_papel_atual() <> 'dono' then
    raise exception 'calc_carga_descartar: so o papel dono descarta carga';
  end if;
  update public.calc_carga
     set status = 'descartada', texto_bruto = null
   where id = p_carga and tenant_id = v_tenant and status = 'rascunho';
end;
$fn$;

-- ── GRANT explicito: CREATE OR REPLACE FUNCTION reseta ACL ──────────────────
revoke all on function public.calc_carga_abrir(text)                       from public, anon;
revoke all on function public.calc_pendencia_resolver(uuid, text, text)    from public, anon;
revoke all on function public.calc_carga_aprovar(uuid)                     from public, anon;
revoke all on function public.calc_carga_descartar(uuid)                   from public, anon;

grant execute on function public.calc_carga_abrir(text)                    to authenticated;
grant execute on function public.calc_pendencia_resolver(uuid, text, text) to authenticated;
grant execute on function public.calc_carga_aprovar(uuid)                  to authenticated;
grant execute on function public.calc_carga_descartar(uuid)                to authenticated;

-- ── 5. calc_uso.competencia e' o PRIMEIRO DIA DO MES, no fuso do Brasil ─────
-- O comentario da coluna dizia isso, mas nada no schema impedia gravar outra
-- coisa (nem uma data em UTC). Invariante 10: data de negocio nunca sai de
-- CURRENT_DATE; aqui o check garante ao menos a forma.
alter table public.calc_uso
  add constraint calc_uso_competencia_ck
  check (competencia = date_trunc('month', competencia)::date);
