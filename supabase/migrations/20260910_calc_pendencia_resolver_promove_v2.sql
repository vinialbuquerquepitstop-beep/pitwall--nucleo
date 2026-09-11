-- Conserta o chamador que a promocao do v2 DEIXOU PARA TRAS.
--
-- A migration 20260910_calc_carga_abrir_promove_v2.sql trocou o parser de
-- `calc_carga_abrir` e parou ali. Mas `calc_pendencia_resolver` REPROCESSA a
-- carga inteira a cada pendencia resolvida, e continuou chamando o v1.
--
-- O EFEITO, e ele e da classe "preco errado" do handoff v6, onde nada denuncia:
-- a carga abre lida pelo v2 e, na PRIMEIRA resposta do dono, e reescrita pelo
-- v1, que le menos. Medido na fixture B de `ferramentas/prova_calc_parse.sql`,
-- que e formato BLOCO (o jeito como lista real de fornecedor e escrita):
--
--     aberta pelo v2 .................... n_casou = 11 de 12
--     reprocessada pelo v1 .............. n_casou =  0 de 12
--
-- O dono resolve UMA pendencia para melhorar a carga e a carga desaba. Ele fez a
-- coisa certa e o sistema puniu, calado.
--
-- O SEGUNDO ROSTO DO MESMO DEFEITO, e este e o que a promocao anterior deveria
-- ter previsto: o `resumo` era mesclado com `||` atualizando so `cobertura`,
-- `cabecalhos` e `descartes`. Como `||` preserva chave nao citada,
-- `fornecedor_conferir` SOBREVIVIA ao reprocesso e ficava OBSOLETO: descrevia a
-- leitura do v2 enquanto o blob tinha passado a vir do v1. A defesa da D10
-- continuava na tela mentindo, que e pior do que nao estar la.
--
-- Entao aqui os quatro campos do v2 (`fornecedor_conferir` mais os tres
-- contadores de proveniencia) passam a ser REFRESCADOS no reprocesso, do mesmo
-- jeito que `calc_carga_abrir` os grava ao abrir. Depois desta migration os dois
-- caminhos produzem `resumo` com a mesma forma, que e a condicao para a tela
-- poder confiar no que le.
--
-- LICAO REGISTRADA: promover um parser e trocar TODOS os chamadores, nunca um.
-- A consulta que teria pego isso na hora, e que vale rodar em toda promocao
-- futura:
--
--   select p.proname,
--          case when p.prosrc like '%calc_parse_v2%' then 'v2' else 'v1' end
--     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and p.prosrc like '%calc_parse%';
--
-- Nada de schema muda. Nada alem da chamada do parser e da mescla do `resumo`
-- muda: a barreira de papel, a validacao de decisao, o `insert` de alias, a
-- regra de descarte, a trava 4 do fornecedor sem lista nova e o `on conflict`
-- das pendencias ficam byte a byte como estavam.

-- A assinatura e copiada de 20260909_calc_carga_rpcs.sql:95, COM o `default null`.
-- Copiar de `pg_get_function_identity_arguments()` nao serve: ela nao mostra
-- default, e `create or replace` pode ADICIONAR default mas nunca REMOVER
-- (42P13). Aqui o Postgres GRITOU, entao o erro foi benigno. A variante
-- perigosa e silenciosa: se a divergencia fosse de TIPO (`varchar` em vez de
-- `text`), nao haveria recusa, e sim uma SOBRECARGA: duas
-- `public.calc_pendencia_resolver` convivendo, uma no v1 e outra no v2, com o
-- PostgREST escolhendo pelos nomes de argumento do POST.
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

  -- O v2, o MESMO que `calc_carga_abrir` usa para abrir. Abrir com um parser e
  -- reprocessar com outro faz a cobertura mudar sozinha entre os dois passos.
  v_parse := privado.calc_parse_v2(v_tenant, v_txt);
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
                                        'descartes',  coalesce(v_parse->'descartes','[]'::jsonb),
                                        -- Os quatro do v2. Sem refrescar aqui,
                                        -- `fornecedor_conferir` sobrevive ao `||`
                                        -- e passa a descrever uma leitura que nao
                                        -- e mais a do blob.
                                        'fornecedor_conferir', coalesce(v_parse->'fornecedor_conferir','[]'::jsonb),
                                        'n_do_cabecalho',  coalesce(v_parse->'n_do_cabecalho','0'::jsonb),
                                        'n_cor_vizinha',   coalesce(v_parse->'n_cor_vizinha','0'::jsonb),
                                        'n_cond_conflito', coalesce(v_parse->'n_cond_conflito','0'::jsonb))
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

-- `create or replace function` RESETA as ACLs (CLAUDE.md). Refazer explicito,
-- identico ao que 20260909_calc_carga_rpcs.sql deixou.
revoke all on function public.calc_pendencia_resolver(uuid, text, text) from public, anon;
grant execute on function public.calc_pendencia_resolver(uuid, text, text) to authenticated;
