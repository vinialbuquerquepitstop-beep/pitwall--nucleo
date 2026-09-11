-- Promove o parser v2 a caminho vivo (item 4 da secao 5 do handoff v7).
--
-- ATE AQUI `calc_carga_abrir` chamava `privado.calc_parse`, o v1. O v2 existia
-- desde 09/09 e nunca teve consumidor: era construcao provada e nao usada, que
-- e exatamente o que o CLAUDE.md chama de encanamento sem entrega.
--
-- DUAS mudancas, e a segunda NAO e opcional:
--
--   1. `privado.calc_parse` -> `privado.calc_parse_v2`.
--
--   2. `fornecedor_conferir` passa a viajar no `resumo`.
--      A D10 inverteu o comportamento: no v1 um cabecalho de fornecedor
--      desconhecido QUEBRA o bloco (e as linhas dele viram pendencia); no v2 ele
--      NAO quebra, porque "linha que eu nao reconheco" e o caso COMUM numa lista
--      de WhatsApp e a regra antiga derrubou 25, 14 e 28 linhas em tres rodadas
--      de medicao contra lista real.
--      A trava nao sumiu, MUDOU DE LUGAR: foi para `fornecedor_conferir`. Se ela
--      nao chegar ao `resumo`, a tela nao tem de onde ler, e ai a defesa NAO
--      EXISTE EM LUGAR NENHUM: o cabecalho ignorado some calado e as linhas dele
--      saem com o nome do fornecedor anterior. Preco certo no fornecedor errado
--      passa no validador e so aparece quando alguem compra pelo custo de outra
--      loja.
--      Por isso promover o chamador e carregar `fornecedor_conferir` sao o MESMO
--      commit, e nenhum dos dois entra sozinho.
--
-- De brinde, os tres contadores que so o v2 produz (`n_do_cabecalho`,
-- `n_cor_vizinha`, `n_cond_conflito`) tambem viajam: eles dizem POR ONDE a
-- cobertura veio, e o passo 4 do wizard mostra isso em vez de so um percentual.
--
-- O v1 NAO e derrubado NESTE passo, e isso e DIVIDA, nao seguranca. Uma versao
-- anterior deste comentario dizia que ele ficava como "rede para comparar se a
-- cobertura cair": esta ERRADO e fica registrado. O portao do Bloco 2 (D7)
-- compara a tela contra o caminho MANUAL da skill, na mesma entrada, nunca
-- contra o v1. Depois desta migration o v1 fica sem chamador, e depois da
-- mudanca correspondente em `ferramentas/prova_calc_parse.sql` fica quase sem
-- prova (so a assercao B0 ainda o executa, e ela so cobra que ele casa 0 no
-- formato bloco).
-- Ele nao e derrubado aqui apenas para a promocao ser reversivel por um
-- `create or replace` de uma linha enquanto a tela ainda nao rodou carga real.
-- DERRUBAR assim que o portao do Bloco 2 fechar: codigo sem consumidor e sem
-- prova e exatamente o que este projeto ja pagou caro para aprender.
--
-- Nada de schema muda: `resumo` ja e jsonb.

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

  -- O v2 (D10, 09/09/2026). O v1 segue existindo, sem chamador.
  v_parse := privado.calc_parse_v2(v_tenant, p_texto);
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
      'produtos_mantidos',  jsonb_array_length(v_antigos),
      -- A defesa da D10. A tela poe isto na frente do dono ANTES do botao de
      -- aprovar, e `suspeita_alta` merece parada real, nao aviso cinza no rodape.
      'fornecedor_conferir', coalesce(v_parse->'fornecedor_conferir','[]'::jsonb),
      -- Por ONDE a cobertura veio, nao so quanto ela foi.
      'n_do_cabecalho',   coalesce(v_parse->'n_do_cabecalho','0'::jsonb),
      'n_cor_vizinha',    coalesce(v_parse->'n_cor_vizinha','0'::jsonb),
      'n_cond_conflito',  coalesce(v_parse->'n_cond_conflito','0'::jsonb)),
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

-- `create or replace function` RESETA as ACLs (CLAUDE.md). Refazer explicito,
-- identico ao que 20260909_calc_carga_rpcs.sql deixou.
revoke all on function public.calc_carga_abrir(text) from public, anon;
grant execute on function public.calc_carga_abrir(text) to authenticated;
