-- 20260913_calc_responder_em_lote.sql
--
-- RESPONDER EM LOTE (13/09/2026, decisao do dono).
--
-- O DEFEITO, medido no log: toda resposta RELIA A LISTA INTEIRA. Na lista de 17/08
-- (812 linhas lidas, 122 perguntas) abrir levou 30.136 ms, e a primeira resposta
-- (15:24:58 UTC) morreu em 30.340 ms com `canceling statement due to statement
-- timeout`: nada gravado, e a tela ficou em "gravando a resposta..." ate cair.
-- Com 122 perguntas, uma releitura de 30 s por resposta nao e produto.
--
-- O DESENHO:
--   1. `calc_pendencia_anotar` guarda a resposta na propria pendencia (`rascunho`)
--      e NAO escreve no catalogo. Antes de guardar, faz um ENSAIO: roda a resposta de
--      verdade pelas duas RPCs de sempre (`calc_pendencia_resolver`,
--      `calc_catalogo_criar`), sem releitura, e desfaz. Assim toda trava que existe
--      (destino no catalogo, condicao ativa, grafia na lista, quase-igual, T1 a T5)
--      recusa NA HORA, e nenhuma trava e copiada: duas copias divergem.
--   2. `calc_carga_reler` aplica TODAS as anotadas, rele a lista UMA vez e cobra as
--      guardas de cada resposta: G2 (nenhuma linha some), G3 (a pergunta respondida
--      nao volta) e G4 (descarte descarta). Se UMA falhar, nada do lote grava, e a
--      pendencia culpada fica com `rascunho_erro`. Tudo ou nada, como antes era cada
--      resposta sozinha.
--   3. `ignorar` sobre pergunta sem resposta (ou ja ignorada) vale NA HORA e sem
--      releitura, porque ele nao muda nada do que o leitor recebe. Esta mudanca mora
--      no proprio `calc_pendencia_resolver`.
--
-- O SINAL `calc.lote`: dentro do ensaio e do lote, o resolver e o `criar` escrevem e
-- voltam ANTES da releitura. E um `set_config` LOCAL a transacao, ligado so por estas
-- duas RPCs. O cliente nao liga: o PostgREST nao executa SET, e `set_config` nao esta
-- num schema exposto. Se ligasse, a resposta so escreveria sem as guardas, e a
-- barreira de papel (`dono`) continuaria no corpo de cada RPC.
--
-- O `calc_reprocessar` passou a devolver `pendencias` (migration
-- `20260913_calc_leitor_bandeira_iphone_linha.sql`, que vem ANTES desta). O lote usa
-- a lista para a G3; o resolver e o `criar` a tiram da resposta ao cliente.
--
-- COMO E FEITA: le o `prosrc` vivo, confere o md5, trocas exatas, mesma assinatura.

begin;

create function pg_temp.troca(s text, a text, b text) returns text
language plpgsql as $f$
declare n int;
begin
  n := (length(s) - length(replace(s, a, ''))) / greatest(length(a), 1);
  if n <> 1 then
    raise exception 'lote troca: esperado 1 ocorrencia, achou % para: %', n, left(a, 120);
  end if;
  return replace(s, a, b);
end $f$;

alter table public.calc_pendencia
  add column if not exists rascunho      jsonb,
  add column if not exists rascunho_erro text;

comment on column public.calc_pendencia.rascunho is
  'Resposta ANOTADA e ainda nao aplicada: {decisao, aponta, extra, em}. So calc_carga_reler aplica. 13/09/2026.';
comment on column public.calc_pendencia.rascunho_erro is
  'Por que a ultima releitura em lote recusou esta resposta anotada. 13/09/2026.';

do $m$
declare
  s text;
begin
  -- ── 1. calc_pendencia_resolver ──────────────────────────────────────────────
  select p.prosrc into s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'calc_pendencia_resolver';
  if md5(s) <> 'c9d0c78f167b0d93290de37489fd6e67' then
    raise exception 'lote: calc_pendencia_resolver mudou desde a medida (md5 %). Nada foi aplicado.', md5(s);
  end if;

  s := pg_temp.troca(s,
$t$  update public.calc_pendencia
     set decisao = p_decisao, aponta = p_aponta,
         decidido_em = now()
   where id = p_pendencia;$t$,
$t$  -- 13/09/2026 (lote): `ignorar` sobre pergunta sem resposta, ou ja ignorada, nao
  -- muda NADA do que o leitor recebe: resposta de condicao so conta com `definir`,
  -- preco confirmado so com `confirmar`, e pergunta de fornecedor aberta ou ignorada
  -- entra igual em `p_forn_abertos`. Reler a lista para chegar na mesma leitura
  -- custava 30 s na lista de 17/08 e estourava o limite do banco.
  if p_decisao = 'ignorar' and coalesce(v_p.decisao, 'ignorar') = 'ignorar' then
    update public.calc_pendencia
       set decisao = 'ignorar', aponta = null, decidido_em = now()
     where id = p_pendencia;
    return jsonb_build_object('reprocessou', false,
                              'motivo', 'ignorar nao muda a leitura');
  end if;

  update public.calc_pendencia
     set decisao = p_decisao, aponta = p_aponta,
         decidido_em = now()
   where id = p_pendencia;$t$);

  s := pg_temp.troca(s,
$t$  select c.n_descarte into v_desc0$t$,
$t$  -- 13/09/2026 (lote): dentro do ensaio de `calc_pendencia_anotar` ou de
  -- `calc_carga_reler`, a resposta so escreve. A releitura e as guardas G2, G3 e G4
  -- rodam UMA vez, no fim do lote.
  if current_setting('calc.lote', true) = 'on' then
    return jsonb_build_object('reprocessou', false, 'motivo', 'lote');
  end if;

  select c.n_descarte into v_desc0$t$);

  s := pg_temp.troca(s,
$t$  return v_res;
end;$t$,
$t$  return v_res - 'pendencias';
end;$t$);

  execute format(
    'create or replace function public.calc_pendencia_resolver(p_pendencia uuid, p_decisao text, '
    || 'p_aponta text default null) returns jsonb language plpgsql security definer '
    || 'set search_path to '''' as %L', s);

  -- ── 2. calc_catalogo_criar ──────────────────────────────────────────────────
  select p.prosrc into s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'calc_catalogo_criar';
  if md5(s) <> 'cf70594b319b96b7ba313ddab4782af9' then
    raise exception 'lote: calc_catalogo_criar mudou desde a medida (md5 %). Nada foi aplicado.', md5(s);
  end if;

  s := pg_temp.troca(s,
$t$  return privado.calc_reprocessar(v_tenant, v_p.carga_id, v_txt,$t$,
$t$  -- 13/09/2026 (lote): o mesmo sinal de `calc_pendencia_resolver`.
  if current_setting('calc.lote', true) = 'on' then
    return jsonb_build_object('reprocessou', false, 'motivo', 'lote',
                              'codigo', v_cod, 'grafias', v_grafias);
  end if;

  return (privado.calc_reprocessar(v_tenant, v_p.carga_id, v_txt,$t$);

  s := pg_temp.troca(s,
$t$'calc_catalogo_criar')$t$,
$t$'calc_catalogo_criar') - 'pendencias')$t$);

  execute format(
    'create or replace function public.calc_catalogo_criar(p_pendencia uuid, p_nome text, '
    || 'p_extra jsonb default ''{}''::jsonb) returns jsonb language plpgsql security definer '
    || 'set search_path to '''' as %L', s);
end
$m$;

revoke all on function public.calc_pendencia_resolver(uuid, text, text) from public, anon;
grant execute on function public.calc_pendencia_resolver(uuid, text, text) to authenticated;
revoke all on function public.calc_catalogo_criar(uuid, text, jsonb) from public, anon;
grant execute on function public.calc_catalogo_criar(uuid, text, jsonb) to authenticated;

-- ── 3. calc_pendencia_anotar ────────────────────────────────────────────────────
create or replace function public.calc_pendencia_anotar(
  p_pendencia uuid, p_decisao text, p_aponta text default null, p_extra jsonb default null)
returns jsonb
language plpgsql security definer set search_path to ''
as $f$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_papel  text := privado.fn_papel_atual();
  v_p      public.calc_pendencia%rowtype;
  v_rasc   boolean;
begin
  if v_tenant is null or v_papel <> 'dono' then
    raise exception 'calc_pendencia_anotar: so o papel dono responde pendencia';
  end if;

  select * into v_p from public.calc_pendencia
   where id = p_pendencia and tenant_id = v_tenant;
  if not found then
    raise exception 'calc_pendencia_anotar: pendencia nao encontrada neste tenant';
  end if;

  select c.status = 'rascunho' into v_rasc from public.calc_carga c
   where c.id = v_p.carga_id and c.tenant_id = v_tenant;
  if not coalesce(v_rasc, false) then
    raise exception 'calc_pendencia_anotar: a carga nao esta mais em rascunho. Nada foi anotado.';
  end if;

  -- Tirar a resposta anotada, que ainda nao foi aplicada.
  if p_decisao is null then
    update public.calc_pendencia set rascunho = null, rascunho_erro = null
     where id = p_pendencia;
    return jsonb_build_object('anotada', false, 'aplicada', false);
  end if;

  if p_decisao not in ('apontar','descartar','ignorar','definir','confirmar','criar') then
    raise exception 'calc_pendencia_anotar: decisao invalida: %', p_decisao;
  end if;

  -- `ignorar` que nao muda a leitura vale na hora (o resolver volta sem reler).
  if p_decisao = 'ignorar' and coalesce(v_p.decisao, 'ignorar') = 'ignorar' then
    perform public.calc_pendencia_resolver(p_pendencia, 'ignorar', null);
    update public.calc_pendencia set rascunho = null, rascunho_erro = null
     where id = p_pendencia;
    return jsonb_build_object('anotada', false, 'aplicada', true);
  end if;

  -- O ENSAIO: a resposta roda de verdade pelas RPCs de sempre, com todas as travas
  -- delas, sem releitura, e a subtransacao desfaz. So a recusa sobrevive.
  begin
    perform set_config('calc.lote', 'on', true);
    if p_decisao = 'criar' then
      perform public.calc_catalogo_criar(p_pendencia, p_aponta, coalesce(p_extra, '{}'::jsonb));
    else
      perform public.calc_pendencia_resolver(p_pendencia, p_decisao, p_aponta);
    end if;
    raise exception 'calc_ensaio_ok';
  exception when others then
    if sqlerrm <> 'calc_ensaio_ok' then
      raise;
    end if;
  end;

  update public.calc_pendencia
     set rascunho = jsonb_build_object('decisao', p_decisao, 'aponta', p_aponta,
                                       'extra', coalesce(p_extra, '{}'::jsonb), 'em', now()),
         rascunho_erro = null
   where id = p_pendencia;

  return jsonb_build_object('anotada', true, 'aplicada', false);
end
$f$;

revoke all on function public.calc_pendencia_anotar(uuid, text, text, jsonb) from public, anon;
grant execute on function public.calc_pendencia_anotar(uuid, text, text, jsonb) to authenticated;

-- ── 4. calc_carga_reler ─────────────────────────────────────────────────────────
create or replace function public.calc_carga_reler(p_carga uuid)
returns jsonb
language plpgsql security definer set search_path to ''
as $f$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_papel  text := privado.fn_papel_atual();
  v_txt    text;
  v_desc0  int;
  v_casou0 int;
  v_n      int;
  v_r      record;
  v_res    jsonb;
  v_falhas jsonb := '[]'::jsonb;
begin
  if v_tenant is null or v_papel <> 'dono' then
    raise exception 'calc_carga_reler: so o papel dono rele a lista';
  end if;

  select c.texto_bruto, c.n_descarte, c.n_casou
    into v_txt, v_desc0, v_casou0
    from public.calc_carga c
   where c.id = p_carga and c.tenant_id = v_tenant and c.status = 'rascunho';
  if v_txt is null then
    raise exception 'calc_carga_reler: a carga nao esta em rascunho neste tenant. Nada foi gravado.';
  end if;

  select count(*) into v_n from public.calc_pendencia q
   where q.carga_id = p_carga and q.tenant_id = v_tenant and q.rascunho is not null;
  if v_n = 0 then
    return jsonb_build_object('ok', true, 'aplicadas', 0, 'reprocessou', false);
  end if;

  begin
    -- (a) Cada resposta anotada, na ordem em que as perguntas nasceram. Uma recusa
    --     aqui (o catalogo mudou desde a anotacao, por exemplo) entra na lista e o
    --     lote inteiro volta.
    perform set_config('calc.lote', 'on', true);
    for v_r in
      select q.id, q.rascunho from public.calc_pendencia q
       where q.carga_id = p_carga and q.tenant_id = v_tenant and q.rascunho is not null
       order by q.criado_em, q.id
    loop
      begin
        if v_r.rascunho->>'decisao' = 'criar' then
          perform public.calc_catalogo_criar(v_r.id, v_r.rascunho->>'aponta',
                    coalesce(nullif(v_r.rascunho->'extra', 'null'::jsonb), '{}'::jsonb));
        else
          perform public.calc_pendencia_resolver(v_r.id, v_r.rascunho->>'decisao',
                                                 v_r.rascunho->>'aponta');
        end if;
      exception when others then
        v_falhas := v_falhas || jsonb_build_array(jsonb_build_object('id', v_r.id, 'erro', sqlerrm));
      end;
    end loop;
    perform set_config('calc.lote', 'off', true);
    if jsonb_array_length(v_falhas) > 0 then
      raise exception 'calc_lote_falhou';
    end if;

    -- (b) UMA releitura. A G2 mora dentro dela e levanta sozinha.
    v_res := privado.calc_reprocessar(v_tenant, p_carga, v_txt, null, null, false,
                                      'calc_carga_reler');

    -- (c) G3, resposta a resposta: a pergunta respondida nao pode continuar na leitura.
    select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'erro',
             'esta resposta nao ensina nada ao leitor: "' || q.texto
             || '" continua pendente depois de reler a lista. Deixe fora desta lista, ou tire a resposta.')),
           '[]'::jsonb)
      into v_falhas
      from public.calc_pendencia q
     where q.carga_id = p_carga and q.tenant_id = v_tenant and q.rascunho is not null
       and q.rascunho->>'decisao' in ('apontar','descartar','definir','confirmar','criar')
       and exists (select 1 from jsonb_array_elements(coalesce(v_res->'pendencias', '[]'::jsonb)) x
                    where x->>'tipo' = q.tipo and x->>'texto' = q.texto);

    -- (d) G4: se o lote descarta, a contagem de descarte tem que subir.
    if coalesce((v_res->>'n_descarte')::int, 0) <= coalesce(v_desc0, 0) then
      v_falhas := v_falhas || coalesce((
        select jsonb_agg(jsonb_build_object('id', q.id, 'erro',
                 'o descarte de "' || q.texto || '" nao tirou linha nenhuma da lista (n_descarte continua em '
                 || coalesce(v_desc0, 0) || ').'))
          from public.calc_pendencia q
         where q.carga_id = p_carga and q.tenant_id = v_tenant and q.rascunho is not null
           and q.rascunho->>'decisao' = 'descartar'), '[]'::jsonb);
    end if;

    if jsonb_array_length(v_falhas) > 0 then
      raise exception 'calc_lote_falhou';
    end if;

    update public.calc_pendencia q set rascunho = null, rascunho_erro = null
     where q.carga_id = p_carga and q.tenant_id = v_tenant and q.rascunho is not null;
  exception when others then
    if sqlerrm <> 'calc_lote_falhou' then
      raise;
    end if;
    -- A subtransacao voltou inteira. Fica gravado so o PORQUE, em cada culpada.
    update public.calc_pendencia q set rascunho_erro = null
     where q.carga_id = p_carga and q.tenant_id = v_tenant and q.rascunho is not null;
    update public.calc_pendencia q set rascunho_erro = f->>'erro'
      from jsonb_array_elements(v_falhas) f
     where q.id = (f->>'id')::uuid and q.tenant_id = v_tenant;
    return jsonb_build_object('ok', false, 'aplicadas', 0, 'falhas', v_falhas);
  end;

  return (v_res - 'pendencias')
         || jsonb_build_object('ok', true, 'aplicadas', v_n, 'n_casou_antes', v_casou0);
end
$f$;

revoke all on function public.calc_carga_reler(uuid) from public, anon;
grant execute on function public.calc_carga_reler(uuid) to authenticated;

commit;
