-- 20260914_calc_capacidade_sem_gb.sql
--
-- CAPACIDADE SEM "GB" LOGO DEPOIS DO MODELO (14/09/2026).
--
-- O dono, lendo a lista de 17/08 pela tela: "a leitura ta se perdendo por nao identificar
-- valor de telefone quando ele vem abaixo". Medido na carga `6c4d3491`: 64 cabecalhos
-- escrevem a capacidade sem unidade e poem o preco na linha de baixo:
--   📱*13 128 eSIM+chip físico lacrado importado caixa normal*   (Quality, lacrados)
--   🤍Branco
--   💰3.199,00
--   🍎16 pro max 512  chip físico lacrado importado cpo           (Cristiano)
--   📲IPHONE 16 PRO MAX 512🩶                                      (All imports)
--   📱iPad 11 128 (A16) lacrado importado                          (28 linhas)
-- Dois defeitos, os dois nos helpers:
--   1. `privado.calc_capacidade` so reconhecia `128GB`/`1TB`: o cabecalho ficava sem
--      capacidade, o modelo nao casava e os precos de baixo caiam na pergunta `💰` (46
--      linhas numa carga so).
--   2. `privado.calc_preco` lia o `128`/`512` do cabecalho como PRECO: a linha virava
--      linha de preco (`abaixo da tabela: ... R$ 512,00`) e deixava de ser cabecalho.
--
-- O CONSERTO: 64, 128, 256 ou 512 logo depois do numero do modelo (11 a 17, com `e`) ou
-- de `air`, `pro`, `max`, `plus`, `mini`, `xr`, `xs`, `se` e capacidade, e nao preco.
-- Medido antes em 17 linhas: as 8 de cabecalho sem GB ganham capacidade e perdem o preco
-- falso; `iPhone 13 128 - 2.500` segue 2500; `AirPods Pro 2 - 1.299`, `R$2700`,
-- `💰3.199,00` e `Garmin Forerunner 165 - 1.699` nao mudam.
--
-- COMO E FEITA: le o `prosrc` vivo, confere o md5, 1 troca exata em cada helper, mesma
-- assinatura e os mesmos atributos (plpgsql, immutable, search_path vazio).

begin;

create function pg_temp.troca(s text, a text, b text) returns text
language plpgsql as $f$
declare n int;
begin
  n := (length(s) - length(replace(s, a, ''))) / greatest(length(a), 1);
  if n <> 1 then
    raise exception 'capacidade troca: esperado 1 ocorrencia, achou % para: %', n, left(a, 120);
  end if;
  return replace(s, a, b);
end $f$;

do $m$
declare
  s text;
begin
  -- ── privado.calc_capacidade ─────────────────────────────────────────────────
  select p.prosrc into s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'privado' and p.proname = 'calc_capacidade';
  if md5(s) <> '0c317f655e9a0c17bbb2f621dbb185ef' then
    raise exception 'capacidade: calc_capacidade mudou desde a medida (md5 %). Nada foi aplicado.', md5(s);
  end if;
  s := pg_temp.troca(s,
$t$
  return '';
end;$t$,
$t$
  -- 14/09/2026: capacidade sem unidade logo depois do modelo (`13 128`, `16 pro max
  -- 512`, `ipad 11 128`). So 64, 128, 256 e 512, e so nessa posicao.
  v_x := regexp_match(v_t, '(?:^|[^0-9a-z])(?:1[1-7]e?|air|pro|max|plus|mini|xr|xs|se)\s+(64|128|256|512)(?![0-9])');
  if v_x is not null then return '|' || v_x[1]; end if;

  return '';
end;$t$);
  execute format(
    'create or replace function privado.calc_capacidade(p_txt text) returns text '
    || 'language plpgsql immutable set search_path to '''' as %L', s);

  -- ── privado.calc_preco ──────────────────────────────────────────────────────
  select p.prosrc into s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'privado' and p.proname = 'calc_preco';
  if md5(s) <> 'f3f891db7e99144fb3ff11a0e4c12539' then
    raise exception 'capacidade: calc_preco mudou desde a medida (md5 %). Nada foi aplicado.', md5(s);
  end if;
  s := pg_temp.troca(s,
$t$  v_t := regexp_replace(v_t, '\ys\d{1,2}\y', ' ', 'g');$t$,
$t$  v_t := regexp_replace(v_t, '\ys\d{1,2}\y', ' ', 'g');
  -- 14/09/2026: a capacidade sem unidade depois do modelo nao e preco
  -- (`📲IPHONE 16 PRO MAX 512🩶` virava R$ 512 e a linha deixava de ser cabecalho).
  v_t := regexp_replace(v_t, '((?:^|[^0-9a-z])(?:1[1-7]e?|air|pro|max|plus|mini|xr|xs|se)\s+)(64|128|256|512)(?![0-9])', '\1 ', 'g');
  -- e o tamanho do relogio sem `mm` tambem nao (`Apple Watch s11 46` virava R$ 46).
  if v_t ~ '\ywatch\y' then
    v_t := regexp_replace(v_t, '\y(38|40|41|42|44|45|46|49)\y', ' ', 'g');
  end if;
  -- e o numero do modelo Garmin tambem nao (`GARMIN FORERUNNER 55` virava R$ 55, a linha
  -- deixava de ser cabecalho e o R$ 1.049,99 dele entrava como Apple Watch SE 2 Branco).
  v_t := regexp_replace(v_t, '\y(forerunner|fenix|vivoactive|venu|instinct|epix)\s+\d{1,3}\y', '\1 ', 'g');$t$);
  execute format(
    'create or replace function privado.calc_preco(p_linha text) returns numeric '
    || 'language plpgsql immutable set search_path to '''' as %L', s);
end
$m$;

-- ── privado.calc_parse_v2: `garantia Apple` nao e outra familia ────────────────
-- Medido na pre-prova desta migration: com a capacidade consertada, os cabecalhos
-- `📱*15 pro 256 eSIM lacrado importado CPO 1 ano de garantia Apple*` seguiam sem casar,
-- porque `apple` (a 1a palavra de Apple Watch e Apple Pencil) contava como familia e a
-- linha nao ganhava o token `iphone`. `apple` sai da lista; `watch` ja estava nela e
-- `pencil` entra, entao Apple Watch e Apple Pencil continuam separados.
do $p$
declare
  s text;
begin
  select p.prosrc into s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'privado' and p.proname = 'calc_parse_v2';
  if md5(s) <> '95b1b731040954e6031fa5c757df8203' then
    raise exception 'capacidade: calc_parse_v2 mudou desde a medida (md5 %). Nada foi aplicado.', md5(s);
  end if;
  s := pg_temp.troca(s,
$t$'samsung','galaxy','motorola','realme','pixel'])) s
     where s.w is not null and s.w <> ''$t$,
$t$'samsung','galaxy','motorola','realme','pixel','pencil'])) s
     where s.w is not null and s.w <> '' and s.w <> 'apple'$t$);
  -- E a linha que NOMEIA uma familia de produto abre bloco de modelo, mesmo sem
  -- capacidade nem medida. Medido na pre-prova: com `iPad 11 128` reconhecido, os
  -- cabecalhos `⌚️Apple Watch s11 46 lacrado importado` (sem `mm`) nao abriam bloco, e
  -- R$ 2.400 e R$ 1.900 dos relogios entravam como iPad 11 128GB. Com isto eles viram
  -- pergunta de modelo, como eram antes.
  s := pg_temp.troca(s,
$t$             or privado.calc_polegada(b.txt) is not null
           ) as cara_de_produto$t$,
$t$             or privado.calc_polegada(b.txt) is not null
             or (b.nz ~ '\y(watch|airpods|airtag|ipad|macbook|imac|pencil|garmin|jbl)\y' and b.nz ~ '[0-9]')
           ) as cara_de_produto$t$);
  -- (so com numero na linha: sem isso o banner `🆘 Relógios Garmin(Lacrado)🆘` virava
  -- pergunta de modelo; medido na pre-prova, MP Imports.)
  -- E a cor entre dois precos (bloco com mais cores que precos) desempata para o LADO
  -- em que o bloco poe o preco: cor antes do preco pega o de baixo. Medido na pre-prova,
  -- Cristiano: `💗rosa / 💙azul / R$2700 / 🩶Silver / R$2750` dava Silver 2700.
  s := pg_temp.troca(s,
$t$               order by abs(p.ln - cs.cor_ln), p.ln$t$,
$t$               order by abs(p.ln - cs.cor_ln),
                        (case when (select min(c2.cor_ln) from cor_solta c2 where c2.mod_ln = cs.mod_ln)
                                   < (select min(p2.ln) from precos_nus p2 where p2.mod_ln = cs.mod_ln)
                              then p.ln < cs.cor_ln else p.ln > cs.cor_ln end),
                        p.ln$t$);
  execute format(
    'create or replace function privado.calc_parse_v2(p_tenant uuid, p_texto text, '
    || 'p_condicoes jsonb default ''{}''::jsonb, p_forn_abertos text[] default ''{}''::text[], '
    || 'p_precos_ok text[] default ''{}''::text[]) returns jsonb language plpgsql stable '
    || 'set search_path to '''' as %L', s);
  revoke all on function privado.calc_parse_v2(uuid, text, jsonb, text[], text[]) from public;
end
$p$;

revoke all on function privado.calc_capacidade(text) from public;
revoke all on function privado.calc_preco(text) from public;

commit;
