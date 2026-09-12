-- 20260911_calc_d18_ancora_por_medida.sql
-- Segunda peca da D18, e ela corrige um erro MEU da primeira, achado pela prova
-- (`REPROVOU: 7 de 113`) no mesmo dia.
--
-- O QUE EU ERREI
-- A primeira peca ancorou o padrao em `^...$` / `^...` e, para as perguntas cujo
-- texto nao e uma linha, criou a trava T5, que recusava `cor` E `preco`. So que
-- `descartar` uma pergunta de COR era uma resposta que FUNCIONAVA: o texto dela
-- (`verde menta`) esta dentro da linha do preco, a regra casava essa linha e a
-- pendencia sumia de verdade. A assercao G6 da prova existe exatamente para
-- pegar isso ("o que ensinava continua ensinando") e pegou. Estreitar o verbo
-- teria custado ao dono uma resposta permanente, deixando so o `ignorar`, que
-- vale para UMA lista.
--
-- O CONSERTO: a ancora sai da MEDIDA, nao do tipo da pergunta
-- O texto da pendencia tem tres formas, e todas as tres se medem contra a
-- propria lista, com a mesma cadeia do leitor (`calc_norm(calc_limpar(linha))`):
--
--   IGUALA uma linha inteira   -> `^texto$`   cabecalho de fornecedor, `PROMO`
--   COMECA uma linha           -> `^texto`    pergunta de modelo, que e a linha
--                                             sem o preco do fim
--   aparece DENTRO de uma      -> `\ytexto\y` pergunta de cor (`verde menta`)
--   nao aparece em nenhuma     -> RECUSA, com mensagem
--
-- A ordem importa e e do mais restrito para o menos: `PROMO` iguala a linha do
-- cabecalho, entao vira `^promo$` e NAO casa mais a linha `- 5.400 PROMO` de
-- outro fornecedor (vetor 17, o que apagava preco alheio). Se `\y` viesse antes,
-- o vetor 17 voltaria.
--
-- `\y` e fronteira de palavra em Postgres. `\b` e BACKSPACE e falha em silencio
-- (CLAUDE.md, medido em 09/09/2026).
--
-- A T5 encolhe para o que ela sempre quis dizer: **pergunta de `preco` nao se
-- descarta**. O texto dela e um MOTIVO por construcao (`preco com condicao
-- pendurada: a calc nao tem onde guardar condicao`, `preco fora de faixa
-- (outlier)`), nunca um pedaco da lista. A guarda de medida acima ja recusaria,
-- mas com a mensagem errada: a T5 diz o caminho (`ignorar`).
--
-- O que NAO muda: o `escopo` (so pergunta de fornecedor fecha bloco), a G4
-- (`descartar` que nao tira linha nenhuma e recusado) e o leitor, que nao e
-- tocado aqui.
--
-- Gerada por script (gera_d18b.py, no scratchpad da sessao) a partir do corpo
-- VIVO do resolver (`3c9723696c3df1aec139d515523d33df`), aplicado como version
-- 20260911200343. Tres trocas, cada uma casando exatamente uma vez.

begin;

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
  v_nz     text;     -- D18: o texto da pendencia na normalizacao do leitor
  v_igual  int;      -- quantas linhas da lista ele IGUALA
  v_ini    int;      -- quantas linhas ele COMECA
  v_dentro int;      -- em quantas ele aparece em qualquer posicao
  v_esc    text;     -- o texto normalizado, escapado para entrar num regex
  v_desc0  int;      -- n_descarte antes da releitura (G4)
  v_res    jsonb;
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

  -- T5. D18. `descartar` grava uma regra de TEXTO DE LINHA, entao so faz sentido
  -- para pergunta cujo texto E uma linha: cabecalho de fornecedor ou de modelo.
  -- Em `cor` o texto e uma palavra dentro da linha (`grafite`) e em `preco` e um
  -- motivo (`preco fora de faixa (outlier)`): a regra ou nao casaria nada, ou
  -- casaria a linha de quem nao tem nada com isso. Antes disto o caso caia na G3
  -- com a mensagem errada ("nao ensina nada"), ou pior, ensinava calando linha
  -- alheia.
  -- Ela vale para `preco` e SO para ele: o texto de uma pergunta de preco e um
  -- MOTIVO por construcao (`preco com condicao pendurada: ...`, `preco fora de
  -- faixa (outlier)`), nunca um pedaco da lista. A guarda de medida la embaixo
  -- ja recusaria, mas com a mensagem errada; esta diz o caminho.
  -- Ate a primeira peca da D18 ela recusava `cor` tambem, e isso estava ERRADO:
  -- descartar uma pergunta de cor funcionava, e a assercao G6 da prova pegou.
  if p_decisao = 'descartar' and v_p.tipo = 'preco' then
    raise exception 'calc_pendencia_resolver: pergunta de preco nao se descarta: o texto dela e o MOTIVO da pergunta ("%"), nao um pedaco da lista. Deixe estas linhas fora desta lista (ignorar). Nada foi gravado.', v_p.texto;
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
    -- D18. O padrao sai do texto NORMALIZADO, porque e contra
    -- `privado.calc_norm(linha)` que o leitor casa. Gravar com `lower()` era
    -- padrao numa normalizacao e texto em outra: acento, `*`, `|` e espaco duplo
    -- nunca casavam, e a falha era CALADA.
    v_nz := privado.calc_norm(v_p.texto);
    if v_nz is null then
      raise exception 'calc_pendencia_resolver: nao da para descartar "%": depois de normalizar nao sobra texto nenhum para casar. Nada foi gravado.', v_p.texto;
    end if;

    -- A ANCORA nao se escolhe no escuro: conta-se na propria lista. O texto de
    -- uma pendencia de fornecedor E a linha inteira; o de uma pendencia de
    -- modelo as vezes e a linha SEM o preco do fim.
    -- `calc_limpar` antes do `calc_norm` porque e ESSA a cadeia do leitor: sem
    -- ele a linha ainda carrega o carimbo do WhatsApp (`[11/09, 10:00] Vini: `)
    -- e nenhum cabecalho comecaria linha nenhuma. As regras de `token` (oito, e
    -- todas de preco malformado) nao entram: nenhuma toca texto de cabecalho.
    select count(*) filter (where privado.calc_norm(privado.calc_limpar(t.l)) = v_nz),
           count(*) filter (where position(v_nz in
                                   privado.calc_norm(privado.calc_limpar(t.l))) = 1),
           count(*) filter (where position(v_nz in
                                   privado.calc_norm(privado.calc_limpar(t.l))) > 0)
      into v_igual, v_ini, v_dentro
      from regexp_split_to_table(v_txt, '\r?\n') as t(l);
    if v_dentro = 0 then
      raise exception 'calc_pendencia_resolver: "%" nao aparece em nenhuma linha desta lista, entao a regra de descarte nunca casaria nada. Nada foi gravado.', v_p.texto;
    end if;
    v_esc := regexp_replace(v_nz, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g');

    insert into public.calc_regra (tenant_id, tipo, padrao, acao, escopo, motivo,
                                   prioridade, origem, carga_id, criado_por)
    values (v_tenant, 'descarte',
            -- Do mais restrito para o menos, e a ORDEM e a defesa do vetor 17:
            -- `PROMO` iguala a linha do cabecalho, entao vira `^promo$` e nao
            -- casa mais a linha `- 5.400 PROMO` de outro fornecedor. Se a forma
            -- de dentro (`\y`) viesse antes, o preco alheio voltava a sumir.
            -- `\y` e fronteira de palavra; `\b` e BACKSPACE e falha calado.
            case when v_igual > 0 then '^' || v_esc || '$'
                 when v_ini   > 0 then '^' || v_esc
                 else                    '\y' || v_esc || '\y' end,
            'descartar',
            -- Propriedades 2 e 3 da D18: descartar um FORNECEDOR fecha o bloco
            -- dele e leva todas as linhas dele, mesmo com cabecalho de modelo no
            -- meio. Descarte de linha continua valendo linha a linha.
            case when v_p.tipo = 'fornecedor' then 'fornecedor' else 'linha' end,
            case when v_p.tipo = 'fornecedor'
                 then 'fornecedor descartado pelo dono em ' else 'descartado pelo dono em ' end
              || to_char((now() at time zone 'America/Sao_Paulo')::date, 'DD/MM/YYYY')
              || ': ' || v_p.texto,
            100,
            'aprendizado', v_p.carga_id, auth.uid())
    -- A mesma grafia descartada de novo, numa carga nova, batia na chave unica
    -- (tenant, tipo, padrao) e voltava erro cru de banco. O dono esta repetindo a
    -- ordem: a regra volta a valer, e o motivo passa a citar a carga de agora.
    on conflict (tenant_id, tipo, padrao) do update
       set ativo = true, acao = 'descartar', escopo = excluded.escopo,
           motivo = excluded.motivo, origem = 'aprendizado',
           carga_id = excluded.carga_id, criado_por = excluded.criado_por;
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
  -- G4. D18. `descartar` TEM QUE DESCARTAR. A G3 nao pega esta classe, e foi por
  -- isso que a D18 viveu meses com a prova verde: quando o descarte falha, as
  -- linhas sao ABSORVIDAS pelo fornecedor de cima e a pendencia some da leitura
  -- do mesmo jeito. Ensinar e engolir ficam indistinguiveis para a G3. O numero
  -- de antes tem que ser lido ANTES, porque a releitura sobrescreve a carga.
  select c.n_descarte into v_desc0
    from public.calc_carga c where c.id = v_p.carga_id;

  v_res := privado.calc_reprocessar(v_tenant, v_p.carga_id, v_txt,
                                    v_p.tipo, v_p.texto,
                                    p_decisao in ('apontar','descartar','definir'),
                                    'calc_pendencia_resolver');

  if p_decisao = 'descartar'
     and coalesce((v_res->>'n_descarte')::int, 0) <= coalesce(v_desc0, 0) then
    raise exception 'calc_pendencia_resolver: o descarte de "%" nao tirou linha nenhuma da lista (n_descarte continua em %). Nada foi gravado.',
      v_p.texto, coalesce(v_desc0, 0);
  end if;

  return v_res;
end;
$fn$;

revoke all on function public.calc_pendencia_resolver(uuid, text, text)
  from public, anon;
grant execute on function public.calc_pendencia_resolver(uuid, text, text)
  to authenticated;

commit;
