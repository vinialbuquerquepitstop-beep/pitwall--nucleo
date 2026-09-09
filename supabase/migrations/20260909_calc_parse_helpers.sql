-- Bloco 2.2 — as funcoes auxiliares do parser, todas em `privado`.
-- Invariante 8: helper vive em `privado`, invisivel ao PostgREST.
--
-- Elas nao leem o banco: sao puras, IMMUTABLE, e existem para que a prova
-- consiga exercitar cada regra de leitura isoladamente em vez de so olhar o
-- resultado final do parse.
--
-- ATENCAO A UMA ARMADILHA DE POSTGRES, medida em 09/09/2026: neste dialeto
-- `\b` e o caractere BACKSPACE, nao fronteira de palavra. Fronteira de palavra
-- e `\y`. Escrever `\b` nao da erro: o regex simplesmente nunca casa, e a
-- funcao devolve NULL em silencio. Foi assim que a primeira versao destas
-- funcoes leu polegada NULL para todo MacBook e capacidade NULL para todo
-- iPhone, com a suite sem nada a dizer. Nunca usar `\b` aqui.

-- ── 1. Normalizacao de texto ────────────────────────────────────────────────
-- minuscula, sem acento, sem aspas de polegada, sem pontuacao de enfeite,
-- espaco colapsado. NAO usa unaccent (extensao): translate e deterministico
-- e nao depende de instalacao.
create or replace function privado.calc_norm(p_txt text)
returns text language sql immutable set search_path = '' as $fn$
  select nullif(
    btrim(
      regexp_replace(
        translate(
          lower(coalesce(p_txt,'')),
          'áàâãäéèêëíìîïóòôõöúùûüçñ' || '"' || chr(8220) || chr(8221) || chr(39) || '`*_|' || chr(8226) || chr(183) || chr(8211) || chr(8212) || '>',
          'aaaaaeeeeiiiiooooouuuucn' || '                    '
        ),
        '\s+', ' ', 'g'
      )
    ), ''
  );
$fn$;

-- ── 2. Limpar o carimbo do WhatsApp ─────────────────────────────────────────
-- Duas formas de export, mais o marcador de lista. Sem isso o nome do
-- REMETENTE entra na linha e vira cabecalho falso de fornecedor, que e
-- exatamente o erro de 27/07/2026 (agrupar por remetente da "um fornecedor so").
create or replace function privado.calc_limpar(p_linha text)
returns text language sql immutable set search_path = '' as $fn$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p_linha,''),
          -- [27/07/2026, 10:32:15] Fulano:
          '^\s*\[[^\]]{4,40}\]\s*[^:]{1,60}:\s*', '', ''),
        -- 27/07/2026 10:32 - Fulano:
        '^\s*\d{1,2}/\d{1,2}/\d{2,4},?\s+\d{1,2}:\d{2}(:\d{2})?\s*[-' || chr(8211) || chr(8212) || ']\s*[^:]{1,60}:\s*', '', ''),
      -- marcador de lista / seta / bullet no comeco
      '^[\s\-\*' || chr(8226) || '>#]+', '', '')
  );
$fn$;

-- ── 3. Ruido do WhatsApp que nunca e produto nem cabecalho ──────────────────
create or replace function privado.calc_e_ruido(p_linha text)
returns boolean language sql immutable set search_path = '' as $fn$
  select privado.calc_norm(p_linha) is null
      or privado.calc_norm(p_linha) ~ '^(midia oculta|imagem ocultada|audio ocultado|video ocultado|figurinha omitida|esta mensagem foi apagada|mensagem apagada|documento omitido|gif omitido|as mensagens (e|sao) ?(sao )?protegidas|voce (criou|adicionou|saiu)|\.+|[0-9\s\+\(\)-]{6,})$';
$fn$;

-- ── 4. Preco ────────────────────────────────────────────────────────────────
-- Devolve o preco em numeric, ou NULL se a linha nao tiver preco legivel.
--
-- A armadilha e ler 256 de "256GB" como preco, ou 13 de 13 polegadas. Por isso
-- a funcao PRIMEIRO apaga da copia de trabalho todo numero que carrega unidade
-- (GB, TB, mm, polegada, par RAM/SSD, chip M4/M5), e so depois procura dinheiro
-- no que sobrou. Faixa de sanidade 20..200000: fora dela nao e preco de tabela.
create or replace function privado.calc_preco(p_linha text)
returns numeric language plpgsql immutable set search_path = '' as $fn$
declare
  v_t   text;
  v_m   text;
  v_n   text;
  v_re  text := '(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{2,6},\d{1,2}|\d{2,6})';
  v_q   int;
begin
  v_t := privado.calc_norm(p_linha);
  if v_t is null then return null; end if;

  -- Apaga os numeros que NAO sao dinheiro, do mais especifico para o mais generico.
  v_t := regexp_replace(v_t, '\d+\s*/\s*\d+\s*(gb|tb)?', ' ', 'g');   -- 16/256GB
  v_t := regexp_replace(v_t, '\d+\s*(gb|tb)\y', ' ', 'g');            -- 256GB, 1TB
  v_t := regexp_replace(v_t, '\d+\s*mm\y', ' ', 'g');                 -- 46mm
  v_t := regexp_replace(v_t, '\ym\d+\y', ' ', 'g');                   -- M4, M5
  v_t := regexp_replace(v_t, '\y(1|2)\s*(a|' || chr(170) || ')\s*linha\y', ' ', 'g');
  v_t := regexp_replace(v_t, '\y\d{1,2}\s*(polegadas?|pol)\y', ' ', 'g');
  v_t := regexp_replace(v_t, '\ys\d{1,2}\y', ' ', 'g');               -- Apple Watch S11
  v_t := regexp_replace(v_t, '\y\d{1,2}\s*(un|unid|unidades?|pcs?)\y', ' ', 'g');

  -- Pega a ULTIMA ocorrencia de dinheiro, que e onde o preco fica na linha
  -- tipica do fornecedor.
  select count(*) into v_q from regexp_matches(v_t, v_re, 'g');
  if v_q = 0 then return null; end if;
  select x[1] into v_m from regexp_matches(v_t, v_re, 'g') as x offset v_q - 1;
  if v_m is null then return null; end if;

  -- Formato brasileiro: virgula e decimal, ponto e milhar.
  if position(',' in v_m) > 0 then
    v_n := replace(replace(v_m, '.', ''), ',', '.');
  else
    v_n := replace(v_m, '.', '');
  end if;

  begin
    if v_n::numeric < 20 or v_n::numeric > 200000 then return null; end if;
    return round(v_n::numeric, 2);
  exception when others then
    return null;
  end;
end;
$fn$;

-- ── 5. Assinatura de capacidade ─────────────────────────────────────────────
-- Reduz "256GB", "1TB", "16/256GB", "16/1TB" a uma forma comparavel: o par
-- `ram|ssd` em GB, com TB virando 1024. Sem capacidade devolve ''.
-- Vale para o nome canonico E para a linha do fornecedor, para os dois lados
-- serem medidos pela mesma regua.
create or replace function privado.calc_capacidade(p_txt text)
returns text language plpgsql immutable set search_path = '' as $fn$
declare
  v_t   text;
  v_a   int;
  v_b   int;
  v_x   text[];
  v_ram int := null;
  v_ssd int := null;
begin
  v_t := privado.calc_norm(p_txt);
  if v_t is null then return ''; end if;

  -- Forma por rotulo, que a Five Cell usa: "16GB Memoria 256GB Armazenamento".
  v_x := regexp_match(v_t, '(\d{1,3})\s*gb\s*(de\s*)?(memoria|ram)');
  if v_x is not null then v_ram := v_x[1]::int; end if;
  v_x := regexp_match(v_t, '(\d{1,4})\s*(gb|tb)\s*(de\s*)?(armazenamento|ssd)');
  if v_x is not null then
    v_ssd := v_x[1]::int * (case when v_x[2] = 'tb' then 1024 else 1 end);
  end if;
  if v_ram is not null and v_ssd is not null then
    return v_ram::text || '|' || v_ssd::text;
  end if;

  -- Par RAM/SSD: 16/256GB, 24/1TB, 16/256.
  v_x := regexp_match(v_t, '(\d{1,3})\s*/\s*(\d{1,4})\s*(gb|tb)?');
  if v_x is not null then
    v_a := v_x[1]::int;
    v_b := v_x[2]::int;
    -- Sem unidade escrita: 1 a 4 so podem ser TB; o resto e GB.
    if v_x[3] = 'tb' or (v_x[3] is null and v_b <= 4) then v_b := v_b * 1024; end if;
    return v_a::text || '|' || v_b::text;
  end if;

  -- Capacidade sozinha: 256GB, 1TB.
  v_x := regexp_match(v_t, '(\d{1,4})\s*tb\y');
  if v_x is not null then return '|' || (v_x[1]::int * 1024)::text; end if;
  v_x := regexp_match(v_t, '(\d{2,4})\s*gb\y');
  if v_x is not null then return '|' || v_x[1]; end if;

  return '';
end;
$fn$;

-- ── 6. Polegada de uma LINHA ────────────────────────────────────────────────
-- So conta numero de polegada que NAO carrega GB/TB e NAO e o par RAM/SSD.
create or replace function privado.calc_polegada(p_txt text)
returns int language plpgsql immutable set search_path = '' as $fn$
declare
  v_t text;
  v_x text[];
begin
  v_t := privado.calc_norm(p_txt);
  if v_t is null then return null; end if;
  v_t := regexp_replace(v_t, '\d+\s*/\s*\d+\s*(gb|tb)?', ' ', 'g');
  v_t := regexp_replace(v_t, '\d+\s*(gb|tb)\y', ' ', 'g');
  v_t := regexp_replace(v_t, '\ym\d+\y', ' ', 'g');
  v_x := regexp_match(v_t, '\y(11|13|14|15|16)\y\s*(polegadas?|pol)?');
  if v_x is null then return null; end if;
  return v_x[1]::int;
end;
$fn$;

-- ── 6b. Polegada do NOME CANONICO ───────────────────────────────────────────
-- No catalogo a polegada sempre vem marcada (`MacBook Air M4 13" 16/256GB`,
-- `iPad Pro M5 11" 256GB`). Sem essa marca o nome NAO tem polegada, e o numero
-- que sobra e o MODELO: `iPhone 16 256GB` tem modelo 16, nao tela de 16
-- polegadas. Ler o canonico com calc_polegada() direto devolveria 16 para todo
-- iPhone 16 e 11 para todo iPhone 11.
create or replace function privado.calc_polegada_canon(p_nome text)
returns int language sql immutable set search_path = '' as $fn$
  select case
           when coalesce(p_nome,'') ~ ('\d\s*(' || '"' || '|' || chr(8221) || '|polegadas?|pol\y)')
           then privado.calc_polegada(p_nome)
           else null
         end;
$fn$;

-- ── 7. Tokens significativos de um nome ─────────────────────────────────────
-- O nome vira multiconjunto de tokens, JA sem capacidade e sem polegada (essas
-- duas sao medidas por funcao propria, com faixa).
--
-- Multiconjunto e nao conjunto porque `MacBook Pro M5 Pro` tem `pro` DUAS
-- vezes, e e so isso que o distingue de `MacBook Pro M5`.
--
-- ARMADILHA, e ela quase entrou: polegada so pode sair quando vem com a MARCA
-- de polegada (13", 13 polegadas). Tirar todo `\y(11|13|14|15|16)\y` apagaria o
-- NUMERO DO MODELO de `iPhone 16 256GB` e de `iPad 11 128GB`, que colidiriam
-- com `iPhone 11` e com todo iPad. Por isso a limpeza acontece ANTES da
-- normalizacao, enquanto o caractere de aspas ainda existe.
create or replace function privado.calc_tokens(p_nome text)
returns text[] language sql immutable set search_path = '' as $fn$
  select coalesce(array_agg(t order by t), '{}'::text[])
  from (
    select regexp_split_to_table(
      privado.calc_norm(
        regexp_replace(
          regexp_replace(
            regexp_replace(coalesce(p_nome,''),
              -- polegada COM marca: 13", 13 polegadas
              '\d{1,2}\s*(' || '"' || '|' || chr(8221) || '|\s*polegadas?\y|\s*pol\y)', ' ', 'g'),
            '\d+\s*/\s*\d+\s*(GB|TB|gb|tb)?', ' ', 'g'),
          '\d+\s*(GB|TB|gb|tb)\y', ' ', 'g')
      ),
      ' ') as t
  ) s
  where t <> '' and t is not null;
$fn$;

revoke all on function privado.calc_norm(text)           from public, anon, authenticated;
revoke all on function privado.calc_limpar(text)         from public, anon, authenticated;
revoke all on function privado.calc_e_ruido(text)        from public, anon, authenticated;
revoke all on function privado.calc_preco(text)          from public, anon, authenticated;
revoke all on function privado.calc_capacidade(text)     from public, anon, authenticated;
revoke all on function privado.calc_polegada(text)       from public, anon, authenticated;
revoke all on function privado.calc_polegada_canon(text) from public, anon, authenticated;
revoke all on function privado.calc_tokens(text)         from public, anon, authenticated;
