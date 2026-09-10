-- ─────────────────────────────────────────────────────────────────────────────
-- Margem por CATEGORIA, alteravel e persistida. Pedido do dono, 10/09/2026:
--
--   "prefiro que comissao e margem de acessorio sejam alteraveis"
--
-- ── O que foi medido antes de escrever isto ────────────────────────────────
--
-- 1. **A D4 nunca foi implementada.** O handoff v4 registra, em 07/09, que
--    `Acessório` teria margem propria (`aav`/`apc`). Os dois identificadores
--    **nao existem no codigo**: zero ocorrencias em `public/calc/index.html`.
--    A configuracao viva e so:
--
--      CFG = {iav:550, ipc:650, mav:1200, mpc:1300}
--      mg(c) = SEMMARGEM ? 0 : (c==='MacBook' ? mav/mpc : iav/ipc)
--
--    `Acessório` cai no `else` e leva a margem de iPhone. Efeito medido:
--
--      Fonte turbo   custo R$    70  ->  sugere R$   620   (margem 88%)
--      Cabo original custo R$    90  ->  sugere R$   640   (margem 86%)
--      AirPods 4     custo R$   850  ->  sugere R$ 1.400   (margem 39%)
--
--    Uma decisao listada no handoff como "nao perguntar de novo" faria a
--    proxima sessao assumir que estava pronta.
--
-- 2. **As margens ja sao editaveis na tela, mas NAO sao salvas.** A aba Config
--    tem os campos (`cfia`, `cfip`, `cfma`, `cfmp`) e `cfSv()` recalcula na
--    hora, mas nada persiste: `CFG` nao vai para o `localStorage` nem para o
--    banco. Trocar a margem e recarregar a pagina devolve 550/650/1200/1300.
--    "Alteravel" pela metade e o que existia: alterar sim, guardar nao.
--
-- 3. **Nao havia caminho de escrita.** `public.calc_dados` tem UMA policy, de
--    SELECT. Nenhuma de UPDATE. O unico jeito de gravar hoje e
--    `calc_carga_aprovar`, que e `SECURITY DEFINER`. Por isso este arquivo traz
--    uma RPC, e nao uma policy nova: mantem o padrao das outras quatro `calc_*`
--    (um ponto de escrita, auditavel, com barreira de papel no CORPO).
--
-- ── O desenho: margem por categoria, nao mais um par por tipo ──────────────
--
-- Sai `iav/ipc/mav/mpc` como conceito e entra `config.margens`, um objeto com
-- uma entrada por categoria. Motivo: com o par fixo, TODA categoria nova exige
-- codigo novo. Foi exatamente o que aconteceu com `Acessório` (esquecido) e
-- agora com `JBL`. Com o objeto, categoria nova e DADO.
--
-- `null` significa NAO CONFIGURADA, e nunca zero. Zero e uma margem legitima
-- (as classes de custo puro usam), entao usar zero como "nao sei" apagaria a
-- diferenca entre "vende no custo, de proposito" e "ninguem definiu ainda".
-- A tela mostra "definir" e nao calcula preco de venda, em vez de sugerir um
-- numero inventado. Mesmo espirito do invariante 18: nada de default silencioso
-- onde o default vira dinheiro.
--
-- ── O que este arquivo NAO faz ─────────────────────────────────────────────
--
-- Nao mexe em `public/calc/index.html`. A tela continua lendo `iav/ipc/mav/mpc`
-- ate a mudanca de frontend, e por isso o seed abaixo PRESERVA esses quatro
-- valores exatamente como estao: aplicar esta migration sozinha nao muda um
-- centavo de nenhum preco que a calc mostra hoje.
--
-- Nao mexe na comissao. Ela vive em `config.comissao` do `dados.js`, ARQUIVO
-- ESTATICO do repo que a calc do consultor le, e torna-la alteravel de verdade
-- exige tirar o consultor do repo, que e o Bloco 3 do plano. O que da para
-- adiantar sem isso e a estrutura, e ela entra junto com a tela.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Seed de `config.margens`, preservando o comportamento de hoje ────────
-- iPhone, iPad e Apple Watch levam o par de iPhone porque e o que o `else` do
-- `mg()` ja faz com eles. As tres classes de custo puro levam zero EXPLICITO,
-- que e decisao do dono de 15/08/2026 e nao ausencia de decisao.
-- `Acessório` e `JBL` nascem `null`: sao justamente os que ninguem definiu.
update public.calc_dados
   set dados = jsonb_set(
         dados,
         '{config,margens}',
         jsonb_build_object(
           'iPhone',        jsonb_build_object('av', 550,  'pc', 650),
           'iPad',          jsonb_build_object('av', 550,  'pc', 650),
           'Apple Watch',   jsonb_build_object('av', 550,  'pc', 650),
           'MacBook',       jsonb_build_object('av', 1200, 'pc', 1300),
           'Acessório',     jsonb_build_object('av', null, 'pc', null),
           'JBL',           jsonb_build_object('av', null, 'pc', null),
           '1ª Linha',      jsonb_build_object('av', 0,    'pc', 0),
           'Garmin',        jsonb_build_object('av', 0,    'pc', 0),
           'Moto Elétrica', jsonb_build_object('av', 0,    'pc', 0)
         ),
         true)
 where tenant_id = '00000000-0000-0000-0000-000000000001'
   and dados -> 'config' -> 'margens' is null;

-- ── 2. A RPC de escrita ─────────────────────────────────────────────────────
-- Mesmo perfil das outras quatro `calc_*`: SECURITY DEFINER, `search_path` vazio,
-- barreira de papel no CORPO (nao em GRANT), e o tenant vindo de
-- `fn_tenant_atual()`, NUNCA do payload do cliente.
create or replace function public.calc_config_margem_salvar(p_margens jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_papel  text := privado.fn_papel_atual();
  v_cats   text[];
  v_k      text;
  v_av     jsonb;
  v_pc     jsonb;
begin
  if v_tenant is null or v_papel <> 'dono' then
    raise exception 'calc_config_margem_salvar: so o papel dono altera margem';
  end if;
  if p_margens is null or jsonb_typeof(p_margens) <> 'object' then
    raise exception 'calc_config_margem_salvar: payload tem que ser objeto';
  end if;

  -- As categorias validas sao as do CHECK de calc_modelo, lidas do catalogo do
  -- proprio tenant. Assim a lista nao vira uma quarta copia que diverge das
  -- outras: quando uma categoria nova entrar no catalogo, ela passa a ser aceita
  -- aqui sem tocar nesta funcao.
  select array_agg(distinct categoria) into v_cats
    from public.calc_modelo where tenant_id = v_tenant and ativo;

  for v_k in select jsonb_object_keys(p_margens) loop
    if not (v_k = any(v_cats)) then
      raise exception 'calc_config_margem_salvar: categoria % nao existe no catalogo', v_k;
    end if;
    v_av := p_margens -> v_k -> 'av';
    v_pc := p_margens -> v_k -> 'pc';
    if v_av is null or v_pc is null then
      raise exception 'calc_config_margem_salvar: % precisa de av e pc (use null explicito para "nao definida")', v_k;
    end if;
    -- `null` passa (e "nao definida"); numero passa se nao for negativo.
    -- Texto, booleano e objeto NAO passam: margem e numero ou nada.
    if jsonb_typeof(v_av) not in ('number','null') or jsonb_typeof(v_pc) not in ('number','null') then
      raise exception 'calc_config_margem_salvar: margem de % tem que ser numero ou null', v_k;
    end if;
    if (jsonb_typeof(v_av) = 'number' and (v_av)::numeric < 0)
    or (jsonb_typeof(v_pc) = 'number' and (v_pc)::numeric < 0) then
      raise exception 'calc_config_margem_salvar: margem de % nao pode ser negativa', v_k;
    end if;
  end loop;

  update public.calc_dados
     set dados = jsonb_set(dados, '{config,margens}', p_margens, true)
   where tenant_id = v_tenant;

  if not found then
    raise exception 'calc_config_margem_salvar: tenant sem calc_dados';
  end if;

  return jsonb_build_object(
    'ok', true,
    'categorias', jsonb_array_length(jsonb_path_query_array(p_margens, '$.keyvalue().key')),
    'margens', p_margens);
end;
$function$;

revoke all on function public.calc_config_margem_salvar(jsonb) from public;
grant execute on function public.calc_config_margem_salvar(jsonb) to authenticated;
