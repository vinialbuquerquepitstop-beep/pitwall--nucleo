-- 20260911_calc_catalogo_criar.sql
-- Fatia `2.4a` do plano da calculadora como produto, junto com a `2.4a ter`
-- (guarda de quase-igual) e a `2.4a quater` (origem em tudo que se aprende).
-- Desenho de record: docs/superpowers/specs/2026-09-10-aprendizado-de-fornecedor.md
--
-- O QUE ESTA FATIA RESOLVE
-- Ate aqui o dono so sabia dizer "isto e outro nome de uma coisa que ja existe"
-- (`apontar`) ou "isto nunca e preco" (`descartar`). Fornecedor novo e modelo
-- novo NAO tinham verbo: nasciam so por migration, ou seja, so com o dono do
-- produto do outro lado. No dia 1 de um cliente TODO fornecedor e desconhecido.
-- Agora existe `public.calc_catalogo_criar`.
--
-- TRES COISAS QUE ESTA MIGRATION FAZ DIFERENTE DO QUE A SPEC ESCREVEU, e as
-- tres sao correcao por MEDICAO no banco vivo, em 11/09/2026:
--
--   1. A spec pedia uma RPC nova E separada, o que duplicaria as ~90 linhas de
--      releitura que o `calc_pendencia_resolver` ja tem (G2, G3, remontagem do
--      blob, refresco do resumo, pendencia nova). Duas copias daquele bloco
--      bastaria UMA divergir para a cobertura passar a depender do VERBO usado,
--      e isso nao aparece em contagem nenhuma. Por isso a releitura saiu para
--      `privado.calc_reprocessar`, UMA copia, chamada pelos dois. E a mesma
--      licao da `cond_chave` da fatia anterior.
--   2. A spec e o plano pediam `codigo` por "hash deterministico". O catalogo
--      VIVO nao usa hash: usa slug legivel (`airpods_4_anc`, `mp_imports`,
--      `iphone_15_pro_max_256gb`). Hash aqui criaria um catalogo meio legivel e
--      meio ilegivel, e o `codigo` e o que aparece em apelido e em pendencia.
--      Entao: slug de `privado.calc_norm(nome)`, com sufixo numerico em colisao.
--      Continua deterministico e continua sendo o `codigo`, nunca o rotulo
--      (invariante 12).
--   3. `cor` NAO se cria, e isso e recusa DECLARADA, nao esquecimento. Medido
--      em 11/09/2026: o leitor nunca devolve pendencia de `tipo = 'cor'`. Cor
--      que ele nao conhece cai em `duvidoso` junto com a linha, sem virar
--      pergunta. Criar cor seria caminho sem chamador e sem prova, que e
--      exatamente o que este projeto ja pagou caro (o parser v1). Quando o
--      leitor aprender a PERGUNTAR cor, o ramo entra junto com a prova dele.
--
-- A GUARDA DE QUASE-IGUAL (2.4a ter), e ela protege uma escrita SEM VOLTA
-- Enquanto a 2.4c (desfazer) nao existir, criar fornecedor e permanente. Unir
-- duas grafias sozinho mistura o custo de duas pessoas diferentes (memoria
-- `fornecedores-mesma-pessoa`); nunca perguntar duplica fornecedor ate o
-- catalogo virar lixo (memoria `contas-secundarias-caique`). Entao: antes de
-- criar, compara o NUCLEO do nome (`privado.calc_nucleo`) com o dos fornecedores
-- que ja existem. Achou, NAO cria e NAO une: devolve a pergunta com as duas
-- grafias lado a lado. O dono decide, e a decisao dele vem no proprio payload
-- (`{"confirmar_novo":"sim"}`). Falso positivo custa um clique; falso negativo
-- custa um fornecedor duplicado. O limiar erra para o lado barato de proposito.
--
-- ORIGEM EM TUDO (2.4a quater), e ela entra JUNTO por um motivo
-- `criar` e a primeira RPC que escreve linha NOVA de catalogo. Sem origem
-- gravada, a linha com mais chance de estar errada (a que o cliente acabou de
-- inventar as pressas) e justamente a que ninguem consegue achar depois. As
-- cinco tabelas ganham `origem` / `carga_id` / `criado_por`, e o
-- `calc_pendencia_resolver` passa a carimbar `aprendizado` no que ele aprende.
-- Backfill: TUDO que existe hoje entrou por migration, nunca por aprendizado,
-- entao tudo vira `semente`.
--
-- NAO ha FK de `carga_id` para `calc_carga`: `calc_carga.aprovado_por` ja e uuid
-- solto pelo mesmo motivo (proveniencia nao pode sumir quando a carga sumir), e
-- assim a restricao global 10 continua trivialmente verdadeira.
--
-- `create or replace` PRESERVA dono e ACL (medido em 11/09/2026); o REVOKE/GRANT
-- explicito do fim fica assim mesmo, por custar nada e cobrir um `drop` futuro.

begin;

-- ══ 1. O verbo novo no check da decisao ═════════════════════════════════════
alter table public.calc_pendencia
  drop constraint calc_pendencia_decisao_ck,
  add  constraint calc_pendencia_decisao_ck
       check (decisao is null
              or decisao in ('apontar','descartar','ignorar','definir','criar'));

-- ══ 2. Origem em tudo que se aprende (2.4a quater) ══════════════════════════
alter table public.calc_alias
  add column if not exists origem     text not null default 'manual',
  add column if not exists carga_id   uuid,
  add column if not exists criado_por uuid;
alter table public.calc_regra
  add column if not exists origem     text not null default 'manual',
  add column if not exists carga_id   uuid,
  add column if not exists criado_por uuid;
alter table public.calc_modelo
  add column if not exists origem     text not null default 'manual',
  add column if not exists carga_id   uuid,
  add column if not exists criado_por uuid;
alter table public.calc_cor
  add column if not exists origem     text not null default 'manual',
  add column if not exists carga_id   uuid,
  add column if not exists criado_por uuid;
alter table public.calc_fornecedor
  add column if not exists origem     text not null default 'manual',
  add column if not exists carga_id   uuid,
  add column if not exists criado_por uuid;

-- Tudo o que existe neste banco hoje entrou por migration (semente global ou a
-- copia dela para o tenant). Nada foi aprendido de carga: o verbo que aprende
-- nasce nesta migration. Por isso o backfill e total.
update public.calc_alias      set origem = 'semente' where origem = 'manual';
update public.calc_regra      set origem = 'semente' where origem = 'manual';
update public.calc_modelo     set origem = 'semente' where origem = 'manual';
update public.calc_cor        set origem = 'semente' where origem = 'manual';
update public.calc_fornecedor set origem = 'semente' where origem = 'manual';

alter table public.calc_alias      add constraint calc_alias_origem_ck
  check (origem in ('semente','aprendizado','manual'));
alter table public.calc_regra      add constraint calc_regra_origem_ck
  check (origem in ('semente','aprendizado','manual'));
alter table public.calc_modelo     add constraint calc_modelo_origem_ck
  check (origem in ('semente','aprendizado','manual'));
alter table public.calc_cor        add constraint calc_cor_origem_ck
  check (origem in ('semente','aprendizado','manual'));
alter table public.calc_fornecedor add constraint calc_fornecedor_origem_ck
  check (origem in ('semente','aprendizado','manual'));

-- ══ 3. `privado.calc_nucleo` — o nucleo de um nome de fornecedor ════════════
-- Tira o enfeite comercial (`TABELA`, `IMPORTS`, `DISTRIBUIDORA`, `ATACADO`...)
-- e ordena o que sobra, para que `MP Imports` e `TABELA MP DISTRIBUIDORA` caiam
-- no MESMO nucleo (`mp`) e a pergunta apareca. NAO e medida de distancia: e
-- igualdade sobre o que sobra. Deterministica, sem extensao, e explicavel para
-- o dono em uma frase. O preco disso e falso positivo (dois fornecedores
-- diferentes com o mesmo nucleo geram UMA pergunta a mais) e falso negativo
-- (grafia com erro de digitacao nao e pega). Os dois sao baratos; unir sozinho
-- nao e.
create or replace function privado.calc_nucleo(p_txt text)
returns text
language sql
immutable
set search_path to ''
as $fn$
  select nullif(
    (select string_agg(u.t, ' ' order by u.t)
       from unnest(string_to_array(
              regexp_replace(coalesce(privado.calc_norm(p_txt), ''),
                             '[^a-z0-9 ]+', ' ', 'g'),
              ' ')) as u(t)
      where u.t <> ''
        and u.t not in ('tabela','tabelas','lista','listas','atualizada',
                        'atualizado','hoje','preco','precos','valores',
                        'imports','import','importados','importado','store',
                        'shop','loja','cell','cells','celular','celulares',
                        'distribuidora','distribuidor','atacado','revenda',
                        'e','da','de','do','das','dos')),
    '');
$fn$;

-- ══ 4. `privado.calc_reprocessar` — a releitura, UMA copia so ═══════════════
-- Era a cauda do `calc_pendencia_resolver`. Saiu para ca porque o
-- `calc_catalogo_criar` faz exatamente a mesma coisa depois de escrever no
-- catalogo, e duas copias divergem.
--   p_ensinar  — cobra a G3 (a resposta tem que mudar a leitura). `ignorar` nao
--                cobra: ele existe justamente para NAO ensinar.
--   p_quem     — o nome de quem chamou, para a mensagem de erro dizer a verdade
--                sobre onde o dono estava quando levou a recusa.
create or replace function privado.calc_reprocessar(
  p_tenant  uuid,
  p_carga   uuid,
  p_txt     text,
  p_tipo    text,
  p_texto   text,
  p_ensinar boolean,
  p_quem    text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_parse   jsonb;
  v_resp    jsonb;
  v_novos   jsonb;
  v_antigos jsonb;
  v_lidos   text[];
begin
  -- D14. TODAS as respostas de condicao desta carga, a cada releitura, e nao so
  -- a do momento. Esta releitura acontece em QUALQUER resposta: se ela fosse sem
  -- as de condicao, a proxima resposta de modelo devolvia para duvidoso, calada,
  -- cada linha que o dono ja respondeu.
  select coalesce(jsonb_object_agg(q.texto, q.aponta), '{}'::jsonb)
    into v_resp
    from public.calc_pendencia q
   where q.carga_id = p_carga and q.tenant_id = p_tenant
     and q.tipo = 'condicao' and q.decisao = 'definir';

  -- O v2, o MESMO que `calc_carga_abrir` usa para abrir. Abrir com um parser e
  -- reprocessar com outro faz a cobertura mudar sozinha entre os dois passos.
  v_parse := privado.calc_parse_v2(p_tenant, p_txt, v_resp);

  -- G2. Nenhuma linha pode sumir de todas as pilhas. E a guarda que pega o
  -- apelido para destino que o leitor nao acha, sem precisar conhecer o caso.
  if (v_parse->>'n_lidas')::int is distinct from
     (v_parse->>'n_casou')::int + (v_parse->>'n_duvidoso')::int
       + (v_parse->>'n_nao_reconhecido')::int then
    raise exception '%: com esta resposta o leitor perderia linhas (lidas %, casou %, duvidoso %, nao reconhecido %). Nada foi gravado.',
      p_quem, v_parse->>'n_lidas', v_parse->>'n_casou', v_parse->>'n_duvidoso', v_parse->>'n_nao_reconhecido';
  end if;

  -- G3. A resposta tem que mudar a leitura. Se a mesma pendencia volta, o
  -- catalogo ganharia uma linha que nao ensina nada, e o dono veria a mesma
  -- pergunta no mes que vem achando que ja respondeu.
  if p_ensinar and exists (
       select 1 from jsonb_array_elements(coalesce(v_parse->'pendencias','[]'::jsonb)) q
        where q->>'tipo' = p_tipo and q->>'texto' = p_texto) then
    raise exception '%: esta resposta nao ensina nada ao leitor: "%" continua pendente depois de reler a lista. Nada foi gravado. Use ignorar.',
      p_quem, p_texto;
  end if;

  v_novos := coalesce(v_parse->'produtos', '[]'::jsonb);

  select coalesce(array_agg(distinct p->>'f'), '{}'::text[])
    into v_lidos
    from jsonb_array_elements(v_novos) p;

  -- Fornecedor sem lista nova segue no blob (trava 4), igual ao abrir.
  select coalesce(jsonb_agg(p), '[]'::jsonb)
    into v_antigos
    from public.calc_carga c, jsonb_array_elements(c.blob_proposto->'produtos') p
   where c.id = p_carga
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
                                        'n_cond_conflito', coalesce(v_parse->'n_cond_conflito','0'::jsonb),
                                        'n_cond_respondida', coalesce(v_parse->'n_cond_respondida','0'::jsonb))
   where c.id = p_carga;

  -- Pendencia nova que o reprocesso revelou entra; a que sumiu fica com a
  -- decisao registrada (historico e append-only, invariante 6).
  insert into public.calc_pendencia (tenant_id, carga_id, causa, tipo, texto, n_linhas, exemplo)
  select p_tenant, p_carga, p->>'causa', p->>'tipo', p->>'texto',
         (p->>'n_linhas')::int, p->>'exemplo'
    from jsonb_array_elements(coalesce(v_parse->'pendencias','[]'::jsonb)) p
  on conflict (carga_id, tipo, texto) do nothing;

  return jsonb_build_object('reprocessou', true,
                            'cobertura', v_parse->'cobertura',
                            'n_casou',   v_parse->'n_casou',
                            'n_lidas',   v_parse->'n_lidas',
                            'n_cond_respondida', v_parse->'n_cond_respondida');
end;
$fn$;

-- ══ 5. `calc_pendencia_resolver` — mesma assinatura, cauda extraida ═════════
create or replace function public.calc_pendencia_resolver(
  p_pendencia uuid, p_decisao text, p_aponta text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_papel  text := privado.fn_papel_atual();
  v_p      public.calc_pendencia%rowtype;
  v_txt    text;
  v_existe boolean;
begin
  if v_tenant is null or v_papel <> 'dono' then
    raise exception 'calc_pendencia_resolver: so o papel dono resolve pendencia';
  end if;
  if p_decisao not in ('apontar','descartar','ignorar','definir') then
    raise exception 'calc_pendencia_resolver: decisao invalida: %', p_decisao;
  end if;

  select * into v_p from public.calc_pendencia
   where id = p_pendencia and tenant_id = v_tenant;
  if not found then
    raise exception 'calc_pendencia_resolver: pendencia nao encontrada neste tenant';
  end if;

  -- T2. Resposta que ja escreveu no catalogo nao se repete. `criar` entra aqui
  -- porque ele escreve MAIS do que os outros dois: uma linha de catalogo.
  if v_p.decisao in ('apontar','descartar','criar') then
    raise exception 'calc_pendencia_resolver: esta pendencia ja foi respondida (%). Desfazer uma resposta ainda nao existe.', v_p.decisao;
  end if;

  -- A lista crua so existe enquanto a carga esta em rascunho.
  select texto_bruto into v_txt from public.calc_carga
   where id = v_p.carga_id and tenant_id = v_tenant and status = 'rascunho';

  -- T3. Sem a lista nao ha como provar que a resposta ensina (G2 e G3).
  if v_txt is null and p_decisao in ('apontar','descartar','definir') then
    raise exception 'calc_pendencia_resolver: a carga nao esta mais em rascunho, entao nao da para conferir se a resposta ensina. Nada foi gravado. A mesma pendencia volta na proxima lista, e se responde la.';
  end if;

  -- T4. Condicao nao se descarta. Ja era recusado, mas por ACASO (a G3 pegava).
  -- O texto da pergunta de condicao e o `codigo` do fornecedor: descarta-lo
  -- gravaria regra de descarte com o nome dele, e o bloco inteiro sairia de toda
  -- lista futura (D16) por uma pergunta que era so "qual a condicao".
  if p_decisao = 'descartar' and v_p.tipo = 'condicao' then
    raise exception 'calc_pendencia_resolver: condicao nao se descarta. Diga qual e (definir) ou deixe estas linhas fora desta lista (ignorar). Nada foi gravado.';
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
    insert into public.calc_alias (tenant_id, tipo, texto, aponta,
                                   origem, carga_id, criado_por)
    values (v_tenant, v_p.tipo, v_p.texto, p_aponta,
            'aprendizado', v_p.carga_id, auth.uid());

  elsif p_decisao = 'definir' then
    -- D14. A resposta vale para ESTA lista e NAO escreve no catalogo: fica so na
    -- propria pendencia (`aponta`), e o leitor a recebe na releitura abaixo. Por
    -- isso pode ser trocada (definir de novo) e desfeita (ignorar).
    if v_p.tipo <> 'condicao' then
      raise exception 'calc_pendencia_resolver: definir so vale para pergunta de condicao (esta e de %). Nada foi gravado.', v_p.tipo;
    end if;
    -- Condicao ATIVA do tenant, grafia exata: e o valor que vai para o `t` do blob.
    if not exists (select 1 from public.calc_regra r
                    where r.tenant_id = v_tenant and r.tipo = 'condicao' and r.ativo
                      and r.valor = p_aponta) then
      raise exception 'calc_pendencia_resolver: a condicao "%" nao existe neste tenant (validas: %). Nada foi gravado.',
        coalesce(p_aponta, '(vazia)'),
        (select string_agg(distinct r.valor, ', ' order by r.valor) from public.calc_regra r
          where r.tenant_id = v_tenant and r.tipo = 'condicao' and r.ativo);
    end if;

  elsif p_decisao = 'descartar' then
    -- Descarte permanente: a proxima carga ja nao traz esta linha.
    insert into public.calc_regra (tenant_id, tipo, padrao, acao, motivo, prioridade,
                                   origem, carga_id, criado_por)
    values (v_tenant, 'descarte',
            regexp_replace(lower(v_p.texto), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g'),
            'descartar',
            'aprendido ao resolver pendencia em ' ||
              to_char((now() at time zone 'America/Sao_Paulo')::date, 'DD/MM/YYYY'),
            100,
            'aprendizado', v_p.carga_id, auth.uid());
  end if;

  update public.calc_pendencia
     set decisao = p_decisao, aponta = p_aponta,
         decidido_em = now()
   where id = p_pendencia;

  -- So `ignorar` chega aqui sem a lista (T3 barrou os outros tres).
  if v_txt is null then
    return jsonb_build_object('reprocessou', false,
                              'motivo', 'a carga nao esta mais em rascunho');
  end if;

  -- A releitura mora em `privado.calc_reprocessar`, UMA copia so, porque o
  -- `calc_catalogo_criar` faz exatamente a mesma coisa depois de escrever no
  -- catalogo. Duas copias bastaria uma divergir para a cobertura passar a
  -- depender do VERBO, e isso nao aparece em contagem nenhuma.
  return privado.calc_reprocessar(v_tenant, v_p.carga_id, v_txt,
                                  v_p.tipo, v_p.texto,
                                  p_decisao in ('apontar','descartar','definir'),
                                  'calc_pendencia_resolver');
end;
$fn$;

-- ══ 6. `calc_catalogo_criar` — o verbo novo ════════════════════════════════
-- `p_extra` carrega SO o que nao da para deduzir (spec 4.2, o orcamento de
-- perguntas):
--   fornecedor -> {"praca":"Campo Grande — RJ"}  e, se ele ja respondeu a
--                 pergunta de quase-igual, {"confirmar_novo":"sim"}
--   modelo     -> {"categoria":"iPhone"}         (a unica pergunta obrigatoria
--                 com lista fechada em todo o fluxo: ela decide a margem, e
--                 margem errada e dinheiro errado)
-- O `tipo` vem SEMPRE da pendencia, nunca do payload: quem escolhe em que
-- tabela se escreve e o leitor, nao o cliente.
create or replace function public.calc_catalogo_criar(
  p_pendencia uuid, p_nome text, p_extra jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_papel   text := privado.fn_papel_atual();
  v_uid     uuid := auth.uid();
  v_p       public.calc_pendencia%rowtype;
  v_extra   jsonb := coalesce(p_extra, '{}'::jsonb);
  v_txt     text;
  v_nome    text;
  v_base    text;
  v_cod     text;
  v_tab     text;
  v_n       int := 1;
  v_bate    boolean;
  v_cat     text;
  v_praca   text;
  v_perto   text;
  v_grafias int;
  -- Espelha `calc_modelo_categoria_ck`. Se o check mudar, esta lista muda
  -- junto: a assercao C9 da prova compara as duas e reprova se divergirem.
  v_cats    text[] := array['iPhone','iPad','MacBook','Apple Watch','Acessório',
                            '1ª Linha','Garmin','Moto Elétrica','JBL'];
begin
  if v_tenant is null or v_papel <> 'dono' then
    raise exception 'calc_catalogo_criar: so o papel dono cria no catalogo';
  end if;

  v_nome := btrim(coalesce(p_nome, ''));
  if v_nome = '' then
    raise exception 'calc_catalogo_criar: criar exige o nome. Nada foi gravado.';
  end if;

  select * into v_p from public.calc_pendencia
   where id = p_pendencia and tenant_id = v_tenant;
  if not found then
    raise exception 'calc_catalogo_criar: pendencia nao encontrada neste tenant';
  end if;

  -- T2, o mesmo do resolver: resposta que escreveu no catalogo nao se repete.
  if v_p.decisao in ('apontar','descartar','criar') then
    raise exception 'calc_catalogo_criar: esta pendencia ja foi respondida (%). Desfazer uma resposta ainda nao existe.', v_p.decisao;
  end if;

  -- O tipo vem da PENDENCIA. `cor` e `condicao` sao recusa declarada: o leitor
  -- nunca devolve pendencia de cor (medido em 11/09/2026, cor desconhecida cai
  -- em duvidoso junto com a linha), e condicao nao mora no catalogo (D14: a
  -- resposta vale so para aquela lista, verbo `definir`).
  if v_p.tipo = 'condicao' then
    raise exception 'calc_catalogo_criar: condicao nao se cria no catalogo. Diga qual e, so para esta lista (definir). Nada foi gravado.';
  end if;
  if v_p.tipo not in ('modelo','fornecedor') then
    raise exception 'calc_catalogo_criar: nao se cria % no catalogo (so modelo e fornecedor). Nada foi gravado.', v_p.tipo;
  end if;

  -- T3, o mesmo do resolver: sem a lista crua nao ha como provar que a criacao
  -- ensina alguma coisa (G3).
  select texto_bruto into v_txt from public.calc_carga
   where id = v_p.carga_id and tenant_id = v_tenant and status = 'rascunho';
  if v_txt is null then
    raise exception 'calc_catalogo_criar: a carga nao esta mais em rascunho, entao nao da para conferir se a criacao ensina. Nada foi gravado. A mesma pendencia volta na proxima lista, e se responde la.';
  end if;

  -- ── O que so o dono sabe ────────────────────────────────────────────────
  if v_p.tipo = 'modelo' then
    v_cat := btrim(coalesce(v_extra->>'categoria',''));
    if v_cat = '' then
      raise exception 'calc_catalogo_criar: modelo novo exige a categoria, porque e ela que decide a margem. Validas: %. Nada foi gravado.',
        array_to_string(v_cats, ', ');
    end if;
    if not (v_cat = any(v_cats)) then
      raise exception 'calc_catalogo_criar: categoria "%" nao existe. Validas: %. Nada foi gravado.',
        v_cat, array_to_string(v_cats, ', ');
    end if;
  else
    v_praca := btrim(coalesce(v_extra->>'praca',''));
    if v_praca = '' then
      raise exception 'calc_catalogo_criar: fornecedor novo exige a praca (de onde ele e). Nada foi gravado.';
    end if;
  end if;

  -- ── Ja existe com este nome? Entao e `apontar`, nao `criar` ─────────────
  v_tab := case v_p.tipo when 'modelo' then 'calc_modelo' else 'calc_fornecedor' end;
  execute format(
    'select exists (select 1 from public.%I x where x.tenant_id = $1 '
    || 'and privado.calc_norm(x.nome) = privado.calc_norm($2))', v_tab)
    into v_bate using v_tenant, v_nome;
  if v_bate then
    raise exception 'calc_catalogo_criar: "%" ja esta no catalogo de %. Isto e outro nome da mesma coisa: use apontar. Nada foi gravado.',
      v_nome, v_p.tipo;
  end if;

  -- ── 2.4a ter. A guarda de quase-igual, so em fornecedor ─────────────────
  -- Nao cria e NAO une: devolve a pergunta com as duas grafias lado a lado. O
  -- dono responde no proprio payload, e a resposta dele fica gravada na
  -- pendencia (`aponta`) quando ele apontar, ou aqui quando ele confirmar.
  if v_p.tipo = 'fornecedor'
     and lower(coalesce(v_extra->>'confirmar_novo','')) not in ('sim','true') then
    select string_agg(f.nome || ' (codigo ' || f.codigo || ')', ', ' order by f.nome)
      into v_perto
      from public.calc_fornecedor f
     where f.tenant_id = v_tenant and f.ativo
       and privado.calc_nucleo(f.nome) is not null
       and privado.calc_nucleo(f.nome) = privado.calc_nucleo(v_nome);
    if v_perto is not null then
      raise exception 'calc_catalogo_criar: voce ja tem % e a lista traz "%". Se for a mesma pessoa, use apontar para o codigo dela. Se for outro fornecedor mesmo, repita com {"confirmar_novo":"sim"}. Nada foi gravado.',
        v_perto, v_nome;
    end if;
  end if;

  -- ── O codigo: slug de `calc_norm(nome)`, sufixo numerico em colisao ─────
  -- Deterministico e legivel, como o catalogo inteiro ja e. A chave e o
  -- `codigo`, nunca o rotulo (invariante 12): o rotulo o dono edita depois sem
  -- quebrar apelido nenhum.
  v_base := btrim(regexp_replace(coalesce(privado.calc_norm(v_nome),''),
                                 '[^a-z0-9]+', '_', 'g'), '_');
  if coalesce(v_base,'') = '' then
    raise exception 'calc_catalogo_criar: o nome "%" nao gera codigo nenhum (so pontuacao). Nada foi gravado.', v_nome;
  end if;
  v_cod := v_base;
  loop
    execute format(
      'select exists (select 1 from public.%I x where x.tenant_id = $1 and x.codigo = $2)', v_tab)
      into v_bate using v_tenant, v_cod;
    exit when not v_bate;
    v_n := v_n + 1;
    v_cod := v_base || '_' || v_n;
  end loop;

  -- ── A escrita ───────────────────────────────────────────────────────────
  if v_p.tipo = 'modelo' then
    insert into public.calc_modelo (tenant_id, codigo, nome, categoria,
                                    origem, carga_id, criado_por)
    values (v_tenant, v_cod, v_nome, v_cat, 'aprendizado', v_p.carga_id, v_uid);
  else
    insert into public.calc_fornecedor (tenant_id, codigo, nome, praca,
                                        origem, carga_id, criado_por)
    values (v_tenant, v_cod, v_nome, v_praca, 'aprendizado', v_p.carga_id, v_uid);
  end if;

  -- Apelido para a grafia que gerou a pendencia E para toda outra pendencia
  -- ABERTA desta carga, do mesmo tipo, que normaliza para o MESMO texto. So
  -- isso: "todas as grafias vistas na carga" sem um teste de igualdade seria a
  -- uniao automatica que a 4.3 da spec proibe. `XPTO CELL IMPORTS`,
  -- `*Xpto  Cell  Imports*` e `xpto cell imports` sao a mesma coisa PROVADA
  -- (mesmo `calc_norm`), e viram tres apelidos de um clique so.
  insert into public.calc_alias (tenant_id, tipo, texto, aponta,
                                 origem, carga_id, criado_por)
  select v_tenant, v_p.tipo, q.texto, v_cod, 'aprendizado', v_p.carga_id, v_uid
    from public.calc_pendencia q
   where q.carga_id = v_p.carga_id and q.tenant_id = v_tenant
     and q.tipo = v_p.tipo and q.decisao is null
     and privado.calc_norm(q.texto) = privado.calc_norm(v_p.texto)
  on conflict (tenant_id, tipo, texto) do nothing;
  get diagnostics v_grafias = row_count;

  -- As irmas saem da fila junto: responder tres vezes a mesma coisa e a
  -- pergunta repetida que o produto existe para nao fazer.
  update public.calc_pendencia q
     set decisao = 'criar', aponta = v_cod, decidido_em = now()
   where q.carga_id = v_p.carga_id and q.tenant_id = v_tenant
     and q.tipo = v_p.tipo and q.decisao is null
     and privado.calc_norm(q.texto) = privado.calc_norm(v_p.texto);

  return privado.calc_reprocessar(v_tenant, v_p.carga_id, v_txt,
                                  v_p.tipo, v_p.texto, true,
                                  'calc_catalogo_criar')
         || jsonb_build_object('codigo', v_cod, 'grafias', v_grafias);
end;
$fn$;

-- ══ 7. Grants explicitos (restricao global 5) ══════════════════════════════
-- `calc_nucleo` e `calc_reprocessar` vivem em `privado` e NAO recebem grant: a
-- barreira de papel mora nas RPCs de `public`, e dar grant aqui criaria caminho
-- que pula a barreira (memoria `parse-v2-sem-grant-e-desenho`).
revoke all on function privado.calc_nucleo(text) from public, anon, authenticated, service_role;
revoke all on function privado.calc_reprocessar(uuid, uuid, text, text, text, boolean, text)
  from public, anon, authenticated, service_role;

revoke all on function public.calc_pendencia_resolver(uuid, text, text) from public, anon;
grant execute on function public.calc_pendencia_resolver(uuid, text, text) to authenticated, service_role;

revoke all on function public.calc_catalogo_criar(uuid, text, jsonb) from public, anon;
grant execute on function public.calc_catalogo_criar(uuid, text, jsonb) to authenticated, service_role;

commit;
