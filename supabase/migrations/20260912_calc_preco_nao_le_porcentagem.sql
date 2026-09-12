-- 20260912_calc_preco_nao_le_porcentagem.sql
--
-- PRIMEIRA LISTA REAL PELA TELA (12/09/2026), classe PRECO ERRADO.
--
-- A MP Imports escreve a saude da bateria numa linha propria, antes do preco:
--
--     📲 IPHONE 16 PRO MAX 512GB 🇺🇸
--     🔋94% à 100%          <- `calc_preco` lia 100,00
--     R$5.549,99            <- o preco de verdade
--
-- `calc_preco` pega o ULTIMO numero da linha entre 20 e 200000, entao `100%`
-- passava. E o estrago foi em dobro: a regra de outlier (preco acima de 1,6x o
-- menor da mesma combinacao) viu R$ 5.549,99 contra R$ 100 e EXPULSOU o preco
-- verdadeiro. Medido na carga 43c964ff: 35 linhas com `%`, 35 produtos casados,
-- 35 de 35 abaixo de R$ 500; as 31 linhas com `R$` foram para duvidoso como
-- "outlier". A cobertura de 46,1% era a bateria.
--
-- Nenhuma fixture tinha linha de bateria, e a regra de outlier so olha para
-- cima. Mesma licao da K14: prova verde com amostra mais estreita que a lista.
--
-- O conserto e SO no helper, e so apaga o que nunca e preco antes de procurar o
-- numero: porcentagem, horario (`7:52:23 PM`, que dava 23) e prazo (`30 dias`,
-- `1 ano`). O resto do corpo e byte a byte o vivo (md5 anterior
-- 623a0b5af9c3987ad46d4e18a4c6fea4). `calc_preco` e usado pelo v1 e pelo v2.
--
-- Pre-provado em bloco revertido contra a lista real ANTES de aplicar
-- (PROCESSO 5.4). A guarda contra preco baixo demais e a proxima peca.

begin;

create or replace function privado.calc_preco(p_linha text)
 returns numeric
 language plpgsql
 immutable
 set search_path to ''
as $function$
declare
  v_t   text;
  v_m   text;
  v_n   text;
  -- A ordem das alternativas importa: a mais especifica primeiro, senao
  -- `\d{2,6}` abocanha metade de `4850.00` e o resto vira lixo.
  v_re  text := '(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{2,6},\d{1,2}|\d{2,6}\.\d{1,2}|\d{2,6})';
  v_q   int;
begin
  v_t := privado.calc_norm(p_linha);
  if v_t is null then return null; end if;

  v_t := regexp_replace(v_t, '\d+\s*/\s*\d+\s*(gb|tb)?', ' ', 'g');
  v_t := regexp_replace(v_t, '\d+\s*(gb|tb)\y', ' ', 'g');
  v_t := regexp_replace(v_t, '\d+\s*mm\y', ' ', 'g');
  v_t := regexp_replace(v_t, '\ym\d+\y', ' ', 'g');
  v_t := regexp_replace(v_t, '\y(1|2)\s*(a|' || chr(170) || ')\s*linha\y', ' ', 'g');
  v_t := regexp_replace(v_t, '\y\d{1,2}\s*(polegadas?|pol)\y', ' ', 'g');
  v_t := regexp_replace(v_t, '\ys\d{1,2}\y', ' ', 'g');
  v_t := regexp_replace(v_t, '\y\d{1,2}\s*(un|unid|unidades?|pcs?)\y', ' ', 'g');
  -- 12/09/2026, primeira lista real: porcentagem, horario e prazo nunca sao
  -- preco. `🔋94% à 100%` virava R$ 100 e o outlier expulsava o preco certo.
  v_t := regexp_replace(v_t, '\d+(?:[.,]\d+)?\s*%', ' ', 'g');
  v_t := regexp_replace(v_t, '\y\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:am|pm))?\y', ' ', 'g');
  v_t := regexp_replace(v_t, '\y\d{1,3}\s*(?:dias?|mes|meses|anos?)\y', ' ', 'g');

  select count(*) into v_q from regexp_matches(v_t, v_re, 'g');
  if v_q = 0 then return null; end if;
  select x[1] into v_m from regexp_matches(v_t, v_re, 'g') as x offset v_q - 1;
  if v_m is null then return null; end if;

  if position(',' in v_m) > 0 then
    -- formato brasileiro: ponto e milhar, virgula e decimal
    v_n := replace(replace(v_m, '.', ''), ',', '.');
  elsif v_m ~ '^\d+\.\d{1,2}$' then
    -- ponto DECIMAL (e o que a regra de token produz): 4850.00
    v_n := v_m;
  else
    -- ponto de milhar sem centavos: 4.299
    v_n := replace(v_m, '.', '');
  end if;

  begin
    if v_n::numeric < 20 or v_n::numeric > 200000 then return null; end if;
    return round(v_n::numeric, 2);
  exception when others then
    return null;
  end;
end;
$function$;

-- Desenho, nao esquecimento: helper de `privado` sem grant nenhum.
revoke all on function privado.calc_preco(text) from public;

commit;
