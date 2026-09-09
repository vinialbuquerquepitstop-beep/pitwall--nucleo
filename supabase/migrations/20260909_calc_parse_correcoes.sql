-- Bloco 2.2 — quatro correcoes medidas na PRIMEIRA corrida do parse contra a
-- fixture sintetica, em 09/09/2026. Nenhuma delas era visivel no plano; todas
-- so apareceram porque o parse rodou ponta a ponta e o resultado foi conferido
-- linha a linha contra a lista de entrada.

-- ════════════════════════════════════════════════════════════════════════════
-- C1. `novo` casava DENTRO de `seminovo`, e Lacrado engolia todo Seminovo.
-- ════════════════════════════════════════════════════════════════════════════
-- A regra de condicao `lacrado|novo` (prioridade 20) nao tinha fronteira de
-- palavra, entao ela casava com o `novo` de `semi-NOVO`. Como 20 < 30, Lacrado
-- ganhava de Seminovo em TODA linha de seminovo, e tambem no banner de bloco
-- (`SEMINOVOS`).
--
-- Efeito medido na fixture: 5 das 12 linhas que casaram sairam com a condicao
-- ERRADA. Numa carga real isso mistura a tabela de seminovo com a de lacrado,
-- e o consultor passa a cotar seminovo com preco de lacrado.
--
-- E exatamente a mesma classe do CPO invertido de 27/07/2026 (341 produtos com
-- zero CPO): regra de condicao sem ordem/limite explicito. Aquela foi corrigida
-- com `prioridade`; esta precisa de FRONTEIRA DE PALAVRA.
--
-- Vale para as DUAS camadas: a linha do tenant e a SEMENTE (tenant_id is null),
-- senao toda conta nova nasce com o mesmo defeito.
--
-- Em Postgres a fronteira de palavra e `\y`. `\b` e o caractere BACKSPACE e
-- nunca casa, em silencio.
update public.calc_regra
   set padrao = '\ycpo\y|\(cpo\)|certified pre-owned|caixa branca'
 where tipo = 'condicao' and padrao = 'cpo|\(cpo\)|certified pre-owned|caixa branca';

update public.calc_regra
   set padrao = '\ylacrado\y|\ynovo\y'
 where tipo = 'condicao' and padrao = 'lacrado|novo';

update public.calc_regra
   set padrao = '\yseminovo\y|\yseminovos\y|\yusado\y|\yusados\y|\yvitrine\y'
 where tipo = 'condicao' and padrao = 'seminovo|usado|vitrine';

-- ════════════════════════════════════════════════════════════════════════════
-- C2. Preco com PONTO decimal sumia inteiro, sem virar nem pendencia.
-- ════════════════════════════════════════════════════════════════════════════
-- A regra de token `4,850,00 -> 4850.00` (do proprio catalogo) produz um numero
-- com PONTO decimal. O leitor de preco so conhecia o formato brasileiro (ponto
-- de milhar, virgula decimal), entao em `4850.00` ele nao via um numero so: via
-- `4850` e `00`, pegava o ULTIMO (`00`), reprovava na faixa de sanidade e
-- devolvia NULL.
--
-- Resultado medido: a linha `iPhone 15 128GB Preto Lacrado - 4,850,00` NAO
-- entrou no blob E NAO virou pendencia. Sumiu, sem deixar rastro, e nem o
-- denominador da cobertura a contou. Linha que some e pior que linha que erra:
-- ninguem procura o que nao sabe que faltou.
create or replace function privado.calc_preco(p_linha text)
returns numeric language plpgsql immutable set search_path = '' as $fn$
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
$fn$;

revoke all on function privado.calc_preco(text) from public, anon, authenticated;
