-- Fatia 2.4a bis: o laco de aprendizado para de aceitar resposta calada.
--
-- A spec `2026-09-10-aprendizado-de-fornecedor.md` (secao 3.1 e prova 1 da
-- secao 7) pedia UMA guarda: apelido apontando para codigo inexistente reprova.
-- Antes de escrever, a RPC foi CHAMADA pela primeira vez (ate aqui ela so tinha
-- sido provada na estrutura, handoff v8 secao 9), com as duas fixtures da prova
-- mais uma terceira, cada decisao numa subtransacao, tudo desfeito no fim.
-- Medido em 11/09/2026, 8 combinacoes de pendencia x decisao:
--
--   [modelo] linha normalizada   apontar valido ........ ENSINA (13 -> 14 de 18)
--   [modelo] linha normalizada   descartar ............. ENSINA
--   [cor] "verde menta"          descartar ............. ENSINA
--   [modelo] cabecalho com emoji descartar ............. aceita, NAO ensina
--   [cor] "verde menta"          apontar valido ........ aceita, NAO ensina
--   [preco] (duas causas)        descartar ............. aceita, NAO ensina
--   [condicao] sentinela         as tres ............... aceita, NAO ensina
--   [fornecedor] sentinela       as tres ............... aceita, NAO ensina
--
-- E o caso da spec e PIOR do que ela descrevia. `apontar` modelo para codigo
-- inexistente nao deixa a linha "fora e sem explicacao": a linha SOME DE TODAS
-- AS PILHAS. Medido numa lista de 3 linhas: antes `lidas=3 casou=1
-- nao_reconhecido=2 pendencias=2`; depois `lidas=3 casou=1 nao_reconhecido=0
-- pendencias=0`. Duas linhas evaporam, a carga fica SEM pendencia e pronta para
-- aprovar, e o blob sai sem os dois produtos. Classe PERDA SILENCIOSA, a quarta
-- aparicao dela neste projeto.
--
-- Por isso esta migration nao fecha um caso: fecha a CLASSE, com tres guardas
-- que nao dependem de saber qual combinacao falha.
--
--   G1. DESTINO EXISTE. `apontar` so grava se o codigo existe no catalogo DO
--       TENANT (a semente, `tenant_id is null`, e invisivel em execucao pela
--       D5, entao apontar para ela tambem reprova). E a prova 1 da spec.
--
--   G2. CONSERVACAO DE LINHAS. Toda leitura tem que fechar
--       `n_lidas = n_casou + n_duvidoso + n_nao_reconhecido` (descarte sai de
--       `n_lidas`, por desenho). Medido nas fixtures A e C: fecha (13+4+1=18,
--       0+4+0=4). Vale nos DOIS chamadores do parser: aqui no reprocesso e em
--       `calc_carga_abrir`, porque linha que o leitor perde ao ABRIR some do
--       mesmo jeito, e a primeira lista real do dono passa por ali.
--
--   G3. A RESPOSTA TEM QUE ENSINAR. Depois de `apontar` ou `descartar`, a
--       carga e relida; se a MESMA pendencia (`tipo`, `texto`) voltar, a RPC
--       recusa e nada e gravado. Esta e a guarda que cobre as cinco linhas
--       "aceita, NAO ensina" da tabela acima sem conhecer nenhuma: se amanha o
--       leitor passar a ler alias de cor decorada, a G3 deixa passar sozinha,
--       sem ser reescrita.
--
-- E tres travas pequenas, cada uma de um fato medido:
--
--   T1. `apontar` em `condicao` reprova. O leitor (v1 e v2) le condicao SO de
--       `calc_regra`; nenhum dos dois consulta `calc_alias` com tipo
--       `condicao`. Os 9 apelidos de condicao do tenant sao DADO MORTO. A spec,
--       secao 4.2, supunha que condicao se ensina por apelido: nao se ensina.
--       Os 9 NAO sao apagados aqui (decisao do dono, e nao atrapalham).
--   T2. Pendencia ja respondida com `apontar` ou `descartar` nao se responde de
--       novo: o segundo `descartar` duplicava a regra, o segundo `apontar`
--       estourava a unique com mensagem de banco. Desfazer e a 2.4c.
--   T3. `apontar` e `descartar` exigem a carga em RASCUNHO. Fora dele o
--       `texto_bruto` ja foi apagado e nao ha contra o que provar G2 e G3. Ate
--       aqui a RPC gravava o apelido e devolvia `reprocessou=false`, ou seja,
--       ensinava sem prova. `ignorar` segue aceito em qualquer estado.
--
-- Efeito para o dono, e ele e so este: o que ENSINAVA continua ensinando, byte
-- a byte. O que era aceito sem ensinar passa a ser RECUSADO com uma frase que
-- diz por que, e a tela `Alimentar` (que ainda nao existe) herda a regra: onde
-- a resposta nao ensina, a unica saida e `ignorar`. Isso deixa a tela honesta,
-- nao menor.
--
-- O que esta migration NAO conserta, e fica na fila da 2.4 com a medicao:
--   * cabecalho de fornecedor desconhecido NO TOPO da lista vira a sentinela
--     `(sem cabecalho antes da lista)`: o texto do cabecalho nem chega a
--     pendencia, entao `criar` fornecedor nao tem o que criar. No dia 1 de um
--     cliente TODO fornecedor e desconhecido. E o bloqueador real da 2.4a;
--   * cor decorada (`verde menta`) nao aprende por apelido;
--   * `descartar` de pendencia de CABECALHO de modelo nao pega a linha do
--     preco (a regra casa por linha, e a linha do preco nao repete o nome).
--
-- Nada de schema muda. As assinaturas sao copiadas das migrations de ORIGEM,
-- com defaults (armadilha do handoff v8): `calc_carga_abrir(p_texto text)` de
-- 20260909_calc_carga_rpcs.sql e `calc_pendencia_resolver(uuid, text, text
-- default null)` de 20260909_calc_carga_rpcs.sql:95. Os dois corpos partem das
-- versoes vivas (20260910_calc_carga_abrir_promove_v2.sql e
-- 20260910_calc_pendencia_resolver_promove_v2.sql), e ALEM das guardas nada
-- muda: parser, mescla do `resumo`, trava 4 e `on conflict` iguais.

-- ── 1. ABRIR: so a G2 ──────────────────────────────────────────────────────────
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

  -- G2. Linha lida tem que estar em alguma pilha. Se nao estiver, o leitor a
  -- perdeu, e aprovar esta carga tiraria o produto da calc sem ninguem saber.
  -- Chave ausente reprova tambem (o `::int` de null nao soma), de proposito.
  if (v_parse->>'n_lidas')::int is distinct from
     (v_parse->>'n_casou')::int + (v_parse->>'n_duvidoso')::int
       + (v_parse->>'n_nao_reconhecido')::int then
    raise exception 'calc_carga_abrir: o leitor perdeu linhas desta lista (lidas %, casou %, duvidoso %, nao reconhecido %). Nada foi gravado. Isto e defeito do leitor, nao da lista.',
      v_parse->>'n_lidas', v_parse->>'n_casou', v_parse->>'n_duvidoso', v_parse->>'n_nao_reconhecido';
  end if;

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

-- `create or replace function` RESETA as ACLs (CLAUDE.md). Refazer explicito.
revoke all on function public.calc_carga_abrir(text) from public, anon;
grant execute on function public.calc_carga_abrir(text) to authenticated;


-- ── 2. RESOLVER: G1, G2, G3, T1, T2, T3 ───────────────────────────────────────
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
  v_existe boolean;
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

  -- T2. Resposta que ja escreveu no catalogo nao se repete.
  if v_p.decisao in ('apontar','descartar') then
    raise exception 'calc_pendencia_resolver: esta pendencia ja foi respondida (%). Desfazer uma resposta ainda nao existe.', v_p.decisao;
  end if;

  -- A lista crua so existe enquanto a carga esta em rascunho.
  select texto_bruto into v_txt from public.calc_carga
   where id = v_p.carga_id and tenant_id = v_tenant and status = 'rascunho';

  -- T3. Sem a lista nao ha como provar que a resposta ensina (G2 e G3).
  if v_txt is null and p_decisao in ('apontar','descartar') then
    raise exception 'calc_pendencia_resolver: a carga nao esta mais em rascunho, entao nao da para conferir se a resposta ensina. Nada foi gravado. A mesma pendencia volta na proxima lista, e se responde la.';
  end if;

  if p_decisao = 'apontar' then
    if coalesce(btrim(p_aponta),'') = '' then
      raise exception 'calc_pendencia_resolver: apontar exige o destino';
    end if;
    if v_p.tipo not in ('modelo','cor','fornecedor','condicao') then
      raise exception 'calc_pendencia_resolver: tipo % nao se ensina por apelido', v_p.tipo;
    end if;
    -- T1. O leitor le condicao so de `calc_regra`, nunca de `calc_alias`.
    if v_p.tipo = 'condicao' then
      raise exception 'calc_pendencia_resolver: condicao nao se ensina por apelido: o leitor nao le apelido de condicao. Nada foi gravado.';
    end if;
    -- G1. O destino tem que existir no catalogo DESTE tenant. O apelido aponta
    -- para o CODIGO, nunca para o rotulo (invariante 12).
    v_existe := case v_p.tipo
      when 'modelo'     then exists (select 1 from public.calc_modelo
                                      where tenant_id = v_tenant and codigo = p_aponta)
      when 'cor'        then exists (select 1 from public.calc_cor
                                      where tenant_id = v_tenant and codigo = p_aponta)
      when 'fornecedor' then exists (select 1 from public.calc_fornecedor
                                      where tenant_id = v_tenant and codigo = p_aponta)
    end;
    if not v_existe then
      raise exception 'calc_pendencia_resolver: o destino "%" nao existe no catalogo de % deste tenant. Nada foi gravado.', p_aponta, v_p.tipo;
    end if;
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

  -- So `ignorar` chega aqui sem a lista (T3 barrou os outros dois).
  if v_txt is null then
    return jsonb_build_object('reprocessou', false,
                              'motivo', 'a carga nao esta mais em rascunho');
  end if;

  -- O v2, o MESMO que `calc_carga_abrir` usa para abrir. Abrir com um parser e
  -- reprocessar com outro faz a cobertura mudar sozinha entre os dois passos.
  v_parse := privado.calc_parse_v2(v_tenant, v_txt);

  -- G2. Nenhuma linha pode sumir de todas as pilhas. E a guarda que pega o
  -- apelido para destino que o leitor nao acha, sem precisar conhecer o caso.
  if (v_parse->>'n_lidas')::int is distinct from
     (v_parse->>'n_casou')::int + (v_parse->>'n_duvidoso')::int
       + (v_parse->>'n_nao_reconhecido')::int then
    raise exception 'calc_pendencia_resolver: com esta resposta o leitor perderia linhas (lidas %, casou %, duvidoso %, nao reconhecido %). Nada foi gravado.',
      v_parse->>'n_lidas', v_parse->>'n_casou', v_parse->>'n_duvidoso', v_parse->>'n_nao_reconhecido';
  end if;

  -- G3. A resposta tem que mudar a leitura. Se a mesma pendencia volta, o
  -- catalogo ganharia uma linha que nao ensina nada, e o dono veria a mesma
  -- pergunta no mes que vem achando que ja respondeu.
  if p_decisao in ('apontar','descartar') and exists (
       select 1 from jsonb_array_elements(coalesce(v_parse->'pendencias','[]'::jsonb)) q
        where q->>'tipo' = v_p.tipo and q->>'texto' = v_p.texto) then
    raise exception 'calc_pendencia_resolver: esta resposta nao ensina nada ao leitor: "%" continua pendente depois de reler a lista. Nada foi gravado. Use ignorar.', v_p.texto;
  end if;

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

-- `create or replace function` RESETA as ACLs (CLAUDE.md). Refazer explicito.
revoke all on function public.calc_pendencia_resolver(uuid, text, text) from public, anon;
grant execute on function public.calc_pendencia_resolver(uuid, text, text) to authenticated;
